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

export function toHex([r, g, b]: RGB): string {
	return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

/** Per-channel blend: `weight` 0 is `a`, 1 is `b` (Phase 3 derivations). */
export function mix(a: RGB, b: RGB, weight: number): RGB {
	return [
		Math.round(a[0] + (b[0] - a[0]) * weight),
		Math.round(a[1] + (b[1] - a[1]) * weight),
		Math.round(a[2] + (b[2] - a[2]) * weight),
	];
}

/** The colour as an `rgba(r, g, b, a)` string, the form the theme files use. */
export function withAlpha([r, g, b]: RGB, alpha: number): string {
	return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const BLACK: RGB = [0, 0, 0];
const WHITE: RGB = [255, 255, 255];
const SUGGEST_STEPS = 50;
const SUGGEST_STEP = 0.02;

/**
 * "Suggest fix" (v0.8.3 Phase 5): the ink stepped away from the surface in
 * 2 % lightness steps — toward white in a dark theme, toward black in a
 * light one — until the pair reaches `min`, at most 50 steps. Mixing toward
 * a neutral keeps the hue. When the mode's direction cannot reach `min` at
 * all (a bright accent in a dark theme) the other direction is used; when
 * neither can, null. The ink comes back unchanged when it already passes.
 * Returns `#rrggbb`; a translucent ink is measured composited over the
 * surface and the suggestion is opaque.
 */
export function suggestInk(
	ink: string,
	surface: string,
	min: number,
	mode: "dark" | "light",
): string | null {
	const inkLayer = parseColor(ink);
	const surfaceLayer = parseColor(surface);
	if (!inkLayer || !surfaceLayer) return null;
	const bg: RGB = [surfaceLayer[0], surfaceLayer[1], surfaceLayer[2]];
	const start = composite(inkLayer, bg);
	if (contrastRatio(start, bg) >= min) return toHex(start);
	const preferred = mode === "dark" ? WHITE : BLACK;
	const other = mode === "dark" ? BLACK : WHITE;
	const target = [preferred, other].find((t) => contrastRatio(t, bg) >= min);
	if (!target) return null;
	for (let step = 1; step <= SUGGEST_STEPS; step++) {
		const candidate = mix(start, target, step * SUGGEST_STEP);
		if (contrastRatio(candidate, bg) >= min) return toHex(candidate);
	}
	return null;
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
