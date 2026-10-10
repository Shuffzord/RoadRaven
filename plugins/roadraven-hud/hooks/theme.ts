import type { HudPalette } from "../types";

export type ThemeFile = {
	meta?: { name?: string; mode?: string };
	colors: Record<string, string | undefined>;
};

// Amber, pre-resolved: drawn until the theme file is read, and when none can be.
export const AMBER: HudPalette = {
	name: "Amber",
	bg: "#14110e",
	accent: "#ffa83d",
	onAccent: "#1a1208",
	primary: "#f2d6a4",
	secondary: "#b99975",
	tertiary: "#a48864",
	border: "#6b4a24",
	notStarted: "#9e8f6e",
	inProgress: "#ffa83d",
	completed: "#a8c775",
	blocked: "#e87f4e",
};

type Rgba = [number, number, number, number];
type Ink = Exclude<keyof HudPalette, "name" | "bg" | "onAccent" | "border">;

// Each painted ink and the theme tokens it falls back through (themeSchema.ts TOKEN_DERIVATIONS).
const INKS: Record<Ink, string[]> = {
	accent: ["accent"],
	primary: ["text-primary"],
	secondary: ["text-secondary"],
	tertiary: ["text-tertiary", "text-secondary"],
	notStarted: ["status-not-started"],
	inProgress: ["status-in-progress"],
	completed: ["status-completed"],
	blocked: ["status-blocked"],
};

function parseHex(c: string): Rgba | undefined {
	const m = /^#([0-9a-f]{6})$/i.exec(c);
	if (!m) return undefined;
	const n = Number.parseInt(m[1] ?? "0", 16);
	return [n >> 16, (n >> 8) & 255, n & 255, 1];
}

function parseRgbFn(c: string): Rgba | undefined {
	const m = /^rgba?\(([^)]+)\)$/i.exec(c);
	if (!m) return undefined;
	const [r = 0, g = 0, b = 0, a = 1] = (m[1] ?? "").split(",").map(Number);
	return [r, g, b, a];
}

export function rgbOf(c: string): Rgba | undefined {
	return parseHex(c) ?? parseRgbFn(c);
}

const hex = (parts: number[]) =>
	`#${parts.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;

// Terminals have no alpha: flatten rgba() over the panel background.
export function solid(c: string | undefined, over: string): string | undefined {
	const f = c ? rgbOf(c) : undefined;
	const o = rgbOf(over);
	if (!f || !o) return c;
	const a = f[3];
	return hex([0, 1, 2].map((i) => (f[i] ?? 0) * a + (o[i] ?? 0) * (1 - a)));
}

export function luminance(c: string): number {
	const [r = 0, g = 0, b = 0] = (rgbOf(c) ?? [0, 0, 0, 1])
		.slice(0, 3)
		.map((v) => {
			const s = v / 255;
			return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
		});
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function withAlpha(c: string | undefined, a: number): string | undefined {
	const f = c ? rgbOf(c) : undefined;
	return f ? `rgba(${f[0]},${f[1]},${f[2]},${a})` : undefined;
}

function firstSolid(
	colors: ThemeFile["colors"],
	keys: string[],
	bg: string,
	fallback: string,
): string {
	for (const k of keys) {
		const v = solid(colors[k], bg);
		if (v) return v;
	}
	return fallback;
}

const contrastInk = (accent: string) =>
	luminance(accent) > 0.179 ? "#000000" : "#ffffff";

const borderOf = (c: ThemeFile["colors"], bg: string) =>
	solid(c["accent-border"] ?? withAlpha(c.accent, 0.3), bg) ?? AMBER.border;

// Only the tokens the pane paints, each solid over the theme's panel background.
export function toPalette(t: ThemeFile): HudPalette {
	const c = t.colors;
	const bg = firstSolid(
		c,
		["bg-panel", "bg-surface", "bg-base"],
		AMBER.bg,
		AMBER.bg,
	);
	const inks = Object.fromEntries(
		(Object.keys(INKS) as Ink[]).map((k) => [
			k,
			firstSolid(c, INKS[k], bg, AMBER[k]),
		]),
	) as Record<Ink, string>;
	return {
		...inks,
		name: t.meta?.name ?? "Theme",
		bg,
		onAccent: firstSolid(c, ["text-on-accent"], bg, contrastInk(inks.accent)),
		border: borderOf(c, bg),
	};
}
