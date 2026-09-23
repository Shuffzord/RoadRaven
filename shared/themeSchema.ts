/**
 * The theme file format and its resolution into `--rv-*` tokens (v0.8.3
 * Phase 3, D2). One JSON file per theme; the twelve required colours are the
 * whole authoring surface, every other token has a rule here.
 *
 * Pure and dependency-free: `shared/` is typechecked with the desktop package
 * but cannot resolve `zod` (bun's isolated linker only links it under
 * packages/desktop and packages/core), so the runtime validator built from
 * these grammars lives in packages/desktop/src/mainview/themes/schema.ts.
 * This module owns the shape (`ThemeFile`), the value grammars, the
 * file -> token flattening and the derivation table; the validator, the
 * built-in registry, the linter and the editor all read from it.
 */

import {
	composite,
	contrastRatio,
	mix,
	parseColor,
	type RGB,
	toHex,
	withAlpha,
} from "./contrast";
import {
	DERIVED_TOKENS,
	STATUS_IDS,
	STATUS_TOKENS,
	TEXT_NODE_TOKEN,
	THEME_TOKENS,
} from "./themeContract";

export type ThemeMode = "dark" | "light";

export const SHAPE_KEYS = [
	"border-width",
	"radius-xs",
	"radius-sm",
	"radius-md",
	"radius-lg",
	"radius-xl",
	"radius-pill",
] as const;
export type ShapeKey = (typeof SHAPE_KEYS)[number];

export const FONT_KEYS = ["sans", "heading"] as const;
export type FontKey = (typeof FONT_KEYS)[number];

export const SHADOW_KEYS = ["node", "node-hover", "panel", "config"] as const;
export type ShadowKey = (typeof SHADOW_KEYS)[number];

/**
 * A theme file. `colors` keys are token names without the `--rv-` prefix
 * (`"bg-base"`, `"status-completed-fg"`); values are `#rrggbb` or `rgba()`.
 */
export interface ThemeFile {
	id: string;
	meta: {
		name: string;
		/** Drives the "system" resolution and the mode-aware derivations. */
		mode: ThemeMode;
		description?: string;
		author?: string;
	};
	colors: Record<string, string>;
	shape?: Partial<Record<ShapeKey, string>>;
	fonts?: Partial<Record<FontKey, string>>;
	shadows?: Partial<Record<ShadowKey, string>>;
}

const TOKEN_PREFIX = "--rv-";

/** Every colour token a file may set, as `colors` keys. */
export const THEME_COLOR_KEYS: readonly string[] = THEME_TOKENS.filter(
	(t) => t.kind === "color",
).map((t) => t.name.slice(TOKEN_PREFIX.length));

/** The twelve a file must set. */
export const REQUIRED_COLOR_KEYS: readonly string[] = THEME_TOKENS.filter(
	(t) => t.kind === "color" && t.tier === "required",
).map((t) => t.name.slice(TOKEN_PREFIX.length));

// --- Value grammars. Every string here reaches CSS through applyTheme, and
// Phase 4 loads user-written files, so each one is closed: no `;`, `{`, `}`
// or `url(` can get through.
export const THEME_ID_PATTERN = /^[a-z][a-z0-9-]*$/;
export const COLOR_VALUE_PATTERN =
	/^(?:#[0-9a-f]{6}|rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(?:,\s*(?:0|1|0?\.\d+)\s*)?\))$/i;
export const PX_VALUE_PATTERN = /^(?:0|\d+(?:\.\d+)?px)$/;
export const FONT_STACK_PATTERN = /^[A-Za-z0-9 ,"'-]+$/;
/** Lengths, colours, `none`, `var(--rv-*)`; `url(` is refused separately. */
export const SHADOW_VALUE_PATTERN = /^[A-Za-z0-9 ,.()#-]+$/;

export function isSafeCssValue(value: string): boolean {
	return !/url\s*\(/i.test(value) && !/[;{}]/.test(value);
}

/** The optional groups of a file and how their keys become token names. */
const OPTIONAL_GROUPS: readonly {
	keys: readonly string[];
	tokenPrefix: string;
	of: (file: ThemeFile) => Partial<Record<string, string>> | undefined;
}[] = [
	{ keys: SHAPE_KEYS, tokenPrefix: "", of: (f) => f.shape },
	{ keys: FONT_KEYS, tokenPrefix: "font-", of: (f) => f.fonts },
	{ keys: SHADOW_KEYS, tokenPrefix: "shadow-", of: (f) => f.shadows },
];

/** The file's explicit values as a `--rv-*` token map. */
export function themeFileToTokens(file: ThemeFile): Record<string, string> {
	const out: Record<string, string> = {};
	for (const [key, value] of Object.entries(file.colors)) {
		out[`${TOKEN_PREFIX}${key}`] = value;
	}
	for (const group of OPTIONAL_GROUPS) {
		const values = group.of(file) ?? {};
		for (const key of group.keys) {
			const value = values[key];
			if (value !== undefined) {
				out[`${TOKEN_PREFIX}${group.tokenPrefix}${key}`] = value;
			}
		}
	}
	return out;
}

// --- Derivation table -------------------------------------------------------

/** Fills one optional token from the (progressively filled) map. */
export type DerivationRule = (
	tokens: Record<string, string>,
	mode: ThemeMode,
) => string | undefined;

const BLACK: RGB = [0, 0, 0];
const WHITE: RGB = [255, 255, 255];

function rgbOf(tokens: Record<string, string>, name: string): RGB | undefined {
	const c = parseColor(tokens[name]);
	return c ? [c[0], c[1], c[2]] : undefined;
}

/** Copy another token. */
const same =
	(source: string): DerivationRule =>
	(t) =>
		t[source];

/** `source` moved `weight` of the way toward the `target` token. */
const toward =
	(source: string, target: string, weight: number): DerivationRule =>
	(t) => {
		const a = rgbOf(t, source);
		const b = rgbOf(t, target);
		return a && b ? toHex(mix(a, b, weight)) : undefined;
	};

/** `source` moved `weight` of the way toward a fixed colour. */
const shade =
	(source: string, target: RGB, weight: number): DerivationRule =>
	(t) => {
		const a = rgbOf(t, source);
		return a ? toHex(mix(a, target, weight)) : undefined;
	};

/** `source` at a fixed alpha. */
const tint =
	(source: string, alpha: number): DerivationRule =>
	(t) => {
		const c = rgbOf(t, source);
		return c ? withAlpha(c, alpha) : undefined;
	};

const byMode =
	(dark: DerivationRule, light: DerivationRule): DerivationRule =>
	(t, mode) =>
		(mode === "light" ? light : dark)(t, mode);

const fixed =
	(value: string): DerivationRule =>
	() =>
		value;

/**
 * `ink` at the smallest alpha (0.01 steps) that, painted over `surface`,
 * still reaches `min`:1 against it — the connector visibility floor.
 */
const floorAlpha =
	(ink: string, surface: string, min: number): DerivationRule =>
	(t) => {
		const i = rgbOf(t, ink);
		const s = rgbOf(t, surface);
		if (!i || !s) return undefined;
		for (let alpha = 0.05; alpha < 1; alpha = +(alpha + 0.01).toFixed(2)) {
			const painted = composite([i[0], i[1], i[2], alpha], s);
			if (contrastRatio(painted, s) >= min) return withAlpha(i, alpha);
		}
		return withAlpha(i, 1);
	};

/** Black or white, whichever contrasts more with the accent. */
const onAccent: DerivationRule = (t) => {
	const accent = rgbOf(t, "--rv-accent");
	if (!accent) return undefined;
	return contrastRatio(BLACK, accent) >= contrastRatio(WHITE, accent)
		? toHex(BLACK)
		: toHex(WHITE);
};

const BASE = "--rv-bg-base";
const TEXT = "--rv-text-primary";
const ACCENT = "--rv-accent";

/**
 * Every optional token's rule, in dependency order: a rule may read tokens
 * filled by the rules above it. The Phase 2 cascade fallbacks
 * (`DERIVED_TOKENS`: node ink, status card ink, status badge ink) are the
 * same functions, so the linter and the resolver cannot disagree.
 */
export const TOKEN_DERIVATIONS: readonly (readonly [string, DerivationRule])[] =
	[
		// Text
		["--rv-text-tertiary", same("--rv-text-secondary")],
		["--rv-text-on-accent", onAccent],
		[TEXT_NODE_TOKEN, DERIVED_TOKENS[TEXT_NODE_TOKEN]],
		// Surfaces: small steps from the base toward the text ink
		["--rv-bg-surface", toward(BASE, TEXT, 0.04)],
		["--rv-bg-input", toward(BASE, TEXT, 0.05)],
		["--rv-bg-elevated", byMode(toward(BASE, TEXT, 0.09), same(BASE))],
		["--rv-bg-hover", toward(BASE, TEXT, 0.1)],
		["--rv-bg-active", toward(BASE, TEXT, 0.16)],
		["--rv-bg-node-hover", toward("--rv-bg-node", TEXT_NODE_TOKEN, 0.03)],
		["--rv-bg-toolbar", same("--rv-bg-surface")],
		["--rv-bg-panel", same("--rv-bg-surface")],
		["--rv-bg-config", same("--rv-bg-surface")],
		["--rv-bg-statusbar", same("--rv-bg-surface")],
		// Borders
		["--rv-border-subtle", toward("--rv-border", BASE, 0.5)],
		["--rv-border-width", fixed("1px")],
		// Accent
		[
			"--rv-accent-hover",
			byMode(shade(ACCENT, WHITE, 0.1), shade(ACCENT, BLACK, 0.15)),
		],
		["--rv-accent-muted", tint(ACCENT, 0.12)],
		["--rv-accent-border", tint(ACCENT, 0.3)],
		// Canvas visuals: the text ink at the alpha that meets the 2:1 floor
		["--rv-dot-grid", floorAlpha(TEXT, "--rv-bg-canvas", 2)],
		["--rv-line-connector", floorAlpha(TEXT, "--rv-bg-canvas", 2)],
		// Shadows (the dark / light built-ins' values)
		[
			"--rv-shadow-node",
			byMode(
				fixed("0 1px 3px rgba(0, 0, 0, 0.3)"),
				fixed("0 1px 3px rgba(0, 0, 0, 0.08)"),
			),
		],
		[
			"--rv-shadow-node-hover",
			byMode(
				fixed("0 3px 10px rgba(0, 0, 0, 0.4)"),
				fixed("0 3px 10px rgba(0, 0, 0, 0.12)"),
			),
		],
		[
			"--rv-shadow-panel",
			byMode(
				fixed("-2px 0 16px rgba(0, 0, 0, 0.4)"),
				fixed("-2px 0 16px rgba(0, 0, 0, 0.08)"),
			),
		],
		[
			"--rv-shadow-config",
			byMode(
				fixed("0 4px 20px rgba(0, 0, 0, 0.5)"),
				fixed("0 4px 20px rgba(0, 0, 0, 0.12)"),
			),
		],
		// Scrollbar
		["--rv-scrollbar-track", same("--rv-bg-input")],
		["--rv-scrollbar-thumb", toward(BASE, TEXT, 0.2)],
		// Status: card ink <- general ink; badge ink <- card ink; fill = ink @ 10 %
		...STATUS_IDS.flatMap((s): (readonly [string, DerivationRule])[] => [
			[STATUS_TOKENS[s].card, DERIVED_TOKENS[STATUS_TOKENS[s].card]],
			[STATUS_TOKENS[s].fg, DERIVED_TOKENS[STATUS_TOKENS[s].fg]],
			[STATUS_TOKENS[s].bg, tint(STATUS_TOKENS[s].ink, 0.1)],
		]),
		// Rings
		["--rv-pulse", same("--rv-status-completed")],
		["--rv-search", same(ACCENT)],
		// Plugin attribution glyph fills: brand colours, the same in every theme
		["--rv-plugin-claude-code-bg", fixed("#d97757")],
		["--rv-plugin-github-actions-bg", fixed("#2088ff")],
		["--rv-plugin-default-bg", fixed("#64748b")],
	];

/**
 * The file's explicit tokens plus every optional token it leaves unset,
 * filled by `TOKEN_DERIVATIONS`. An explicit value always wins. The result is
 * what `applyTheme` paints and what the linter measures.
 */
export function resolveTheme(file: ThemeFile): Record<string, string> {
	const tokens = themeFileToTokens(file);
	for (const [name, rule] of TOKEN_DERIVATIONS) {
		if (tokens[name] !== undefined) continue;
		const value = rule(tokens, file.meta.mode);
		if (value !== undefined) tokens[name] = value;
	}
	return tokens;
}
