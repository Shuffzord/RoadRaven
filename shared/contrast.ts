/**
 * WCAG 2.x contrast math and the static theme linter (v0.8.3 Phase 0).
 *
 * Pure functions only: no I/O, no console. Callers (the `theme:lint` CLI,
 * the vitest gate, later the theme editor) hand in a token map and get
 * findings back.
 */

import {
	CONTRAST_PAIRS,
	type ContrastPair,
	DERIVED_TOKENS,
} from "./themeContract";

export type RGB = readonly [number, number, number];
export type RGBA = readonly [number, number, number, number];

export interface Finding {
	pairId: string;
	theme?: string;
	/** Resolved ink colour as #rrggbb (or the raw token value when unparsable). */
	ink: string;
	/** Resolved, fully composited surface colour as #rrggbb. */
	surface: string;
	ratio: number;
	min: number;
	tier: ContrastPair["tier"];
	pass: boolean;
	/** Set when the pair could not be measured (missing or unparsable token). */
	reason?: string;
}

const HEX6 = /^#([0-9a-f]{6})$/i;
const RGB_FN =
	/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)$/;

/** Parses `#rrggbb`, `rgb(r, g, b)` or `rgba(r, g, b, a)`; anything else is null. */
export function parseColor(value: string | undefined): RGBA | null {
	if (value === undefined) return null;
	const c = value.trim();
	const h = HEX6.exec(c);
	if (h) {
		const n = Number.parseInt(h[1], 16);
		return [n >> 16, (n >> 8) & 255, n & 255, 1];
	}
	const r = RGB_FN.exec(c);
	if (r) return [+r[1], +r[2], +r[3], r[4] === undefined ? 1 : +r[4]];
	return null;
}

/** Source-over: `fg` with its alpha painted onto an opaque `bg`. */
export function composite(fg: RGBA, bg: RGB): RGB {
	const a = fg[3];
	return [
		Math.round(fg[0] * a + bg[0] * (1 - a)),
		Math.round(fg[1] * a + bg[1] * (1 - a)),
		Math.round(fg[2] * a + bg[2] * (1 - a)),
	];
}

function linear(channel: number): number {
	const c = channel / 255;
	return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance([r, g, b]: RGB): number {
	return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

export function contrastRatio(a: RGB, b: RGB): number {
	const la = relativeLuminance(a);
	const lb = relativeLuminance(b);
	return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

function toHex([r, g, b]: RGB): string {
	return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

function describe(token: string, value: string | undefined): string {
	return value === undefined
		? `${token} is not defined`
		: `${token} is "${value}", not a #rrggbb / rgb() / rgba() colour`;
}

/**
 * Fills every `DERIVED_TOKENS` entry the map leaves unset, the way the
 * components' `var(--x, var(--y))` fallbacks do. An explicit value wins.
 */
export function resolveDerivedTokens(
	tokens: Record<string, string>,
): Record<string, string> {
	const out = { ...tokens };
	for (const [name, derive] of Object.entries(DERIVED_TOKENS)) {
		if (out[name] !== undefined) continue;
		const value = derive(tokens);
		if (value !== undefined) out[name] = value;
	}
	return out;
}

/**
 * Measures every pair against a token map. A pair whose ink or surface
 * cannot be parsed yields a failing finding with a `reason` instead of
 * throwing, so one bad value never hides the rest of the report.
 */
export function lintTheme(
	rawTokens: Record<string, string>,
	pairs: readonly ContrastPair[] = CONTRAST_PAIRS,
): Finding[] {
	const tokens = resolveDerivedTokens(rawTokens);
	return pairs.map((pair) => {
		const base = { pairId: pair.id, min: pair.min, tier: pair.tier };
		const unmeasurable = (reason: string): Finding => ({
			...base,
			ink: tokens[pair.ink] ?? "",
			surface: "",
			ratio: 0,
			pass: false,
			reason,
		});

		let surface: RGB | null = null;
		for (const token of pair.surface) {
			const layer = parseColor(tokens[token]);
			if (!layer) return unmeasurable(describe(token, tokens[token]));
			// The bottom layer is the opaque backdrop; alpha only matters above it.
			surface = surface
				? composite(layer, surface)
				: [layer[0], layer[1], layer[2]];
		}
		const inkLayer = parseColor(tokens[pair.ink]);
		if (!inkLayer || !surface) {
			return unmeasurable(describe(pair.ink, tokens[pair.ink]));
		}

		const ink = composite(inkLayer, surface);
		const ratio = contrastRatio(ink, surface);
		return {
			...base,
			ink: toHex(ink),
			surface: toHex(surface),
			ratio,
			pass: ratio >= pair.min,
		};
	});
}

const THEME_BLOCK = /\[data-theme="([a-z-]+)"\]\s*\{([^}]*)\}/g;
const TOKEN_DECL = /(--rv-[a-z0-9-]+):\s*([^;]+);/g;

/**
 * Reads the `[data-theme="x"] { --rv-*: ...; }` blocks out of index.css.
 * The dark block is `:root, [data-theme="dark"]`; other themes inherit any
 * token they do not set from it via the cascade, which is the caller's job
 * (`{ ...blocks.dark, ...blocks[name] }`). Multiple blocks for one theme
 * merge. Phase 3 moves themes to JSON and deletes this.
 */
export function parseThemeBlocks(
	css: string,
): Record<string, Record<string, string>> {
	const themes: Record<string, Record<string, string>> = {};
	for (const block of css.matchAll(THEME_BLOCK)) {
		themes[block[1]] ??= {};
		const tokens = themes[block[1]];
		for (const decl of block[2].matchAll(TOKEN_DECL)) {
			tokens[decl[1]] = decl[2].replace(/\s+/g, " ").trim();
		}
	}
	return themes;
}
