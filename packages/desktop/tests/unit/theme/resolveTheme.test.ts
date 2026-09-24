import { describe, expect, it } from "vitest";
import {
	contrastRatio,
	lintTheme,
	parseColor,
} from "../../../../../shared/contrast";
import { THEME_TOKENS } from "../../../../../shared/themeContract";
import {
	resolveTheme,
	type ThemeFile,
} from "../../../../../shared/themeSchema";

// The derivation table (v0.8.3 Phase 3): a file with only the twelve
// required colours resolves to a complete, contrast-clean token set. This is
// the promise the Phase 5 editor relies on ("authoring a theme = 12 colours").

const minimalDark: ThemeFile = {
	id: "min-dark",
	meta: { name: "Minimal dark", mode: "dark" },
	colors: {
		"bg-base": "#131313",
		"bg-canvas": "#131313",
		"bg-node": "#1e1e20",
		"text-primary": "#e0e0e0",
		"text-secondary": "#a8a8a8",
		border: "#2a2a2c",
		"border-focus": "#4a9eff",
		accent: "#4a9eff",
		"status-not-started": "#939393",
		"status-in-progress": "#4a9eff",
		"status-completed": "#4ade80",
		"status-blocked": "#ff5252",
	},
};

const minimalLight: ThemeFile = {
	id: "min-light",
	meta: { name: "Minimal light", mode: "light" },
	colors: {
		"bg-base": "#ffffff",
		"bg-canvas": "#fafafa",
		"bg-node": "#ffffff",
		"text-primary": "#1a1a1a",
		"text-secondary": "#666666",
		border: "#e0e0e0",
		"border-focus": "#155bb8",
		accent: "#155bb8",
		"status-not-started": "#6b6b6b",
		"status-in-progress": "#155bb8",
		"status-completed": "#137537",
		"status-blocked": "#c92020",
	},
};

const colourTokens = THEME_TOKENS.filter((t) => t.kind === "color").map(
	(t) => t.name,
);

const rgb = (value: string | undefined) => {
	const c = parseColor(value);
	if (!c) throw new Error(`unparsable ${value}`);
	return [c[0], c[1], c[2]] as const;
};

describe("resolveTheme", () => {
	it.each([
		minimalDark,
		minimalLight,
	])("$id: fills every colour token in THEME_TOKENS", (file) => {
		const resolved = resolveTheme(file);
		const missing = colourTokens.filter((name) => resolved[name] === undefined);
		expect(missing).toEqual([]);
		const unparsable = colourTokens.filter(
			(name) => parseColor(resolved[name]) === null,
		);
		expect(unparsable).toEqual([]);
	});

	it("only emits tokens the contract lists", () => {
		const known = new Set(THEME_TOKENS.map((t) => t.name));
		const resolved = resolveTheme({
			...minimalDark,
			shape: { "border-width": "2px", "radius-md": "2px" },
			fonts: { sans: "monospace", heading: "serif" },
			shadows: { node: "none" },
		});
		expect(Object.keys(resolved).filter((k) => !known.has(k))).toEqual([]);
		expect(resolved["--rv-border-width"]).toBe("2px");
		expect(resolved["--rv-radius-md"]).toBe("2px");
		expect(resolved["--rv-font-sans"]).toBe("monospace");
		expect(resolved["--rv-font-heading"]).toBe("serif");
		expect(resolved["--rv-shadow-node"]).toBe("none");
	});

	it("an explicit value beats the derived one", () => {
		const resolved = resolveTheme({
			...minimalDark,
			colors: {
				...minimalDark.colors,
				"text-tertiary": "#123456",
				"bg-surface": "#654321",
				"status-completed-fg": "#abcdef",
			},
		});
		expect(resolved["--rv-text-tertiary"]).toBe("#123456");
		expect(resolved["--rv-bg-surface"]).toBe("#654321");
		expect(resolved["--rv-status-completed-fg"]).toBe("#abcdef");
	});

	it("derives the cascade fallbacks exactly as the components' var() chains do", () => {
		const resolved = resolveTheme({
			...minimalDark,
			colors: { ...minimalDark.colors, "status-blocked-card": "#000000" },
		});
		expect(resolved["--rv-text-node"]).toBe("#e0e0e0");
		expect(resolved["--rv-status-completed-card"]).toBe("#4ade80");
		expect(resolved["--rv-status-completed-fg"]).toBe("#4ade80");
		expect(resolved["--rv-status-blocked-fg"]).toBe("#000000");
	});

	it("text-on-accent picks whichever of black and white contrasts more with the accent", () => {
		const onLightAccent = resolveTheme(minimalDark)["--rv-text-on-accent"];
		expect(onLightAccent).toBe("#000000");
		const onDarkAccent = resolveTheme(minimalLight)["--rv-text-on-accent"];
		expect(onDarkAccent).toBe("#ffffff");
	});

	it.each([
		minimalDark,
		minimalLight,
	])("$id: line-connector meets the 2:1 visibility floor on the canvas", (file) => {
		const resolved = resolveTheme(file);
		const connector = parseColor(resolved["--rv-line-connector"]);
		expect(connector).not.toBeNull();
		if (!connector) return;
		expect(connector[3]).toBeLessThan(1);
		const canvas = rgb(resolved["--rv-bg-canvas"]);
		const painted = [
			Math.round(connector[0] * connector[3] + canvas[0] * (1 - connector[3])),
			Math.round(connector[1] * connector[3] + canvas[1] * (1 - connector[3])),
			Math.round(connector[2] * connector[3] + canvas[2] * (1 - connector[3])),
		] as const;
		expect(contrastRatio(painted, canvas)).toBeGreaterThanOrEqual(2);
	});

	it("badge fills and accent tints are the ink at a fixed alpha", () => {
		const resolved = resolveTheme(minimalDark);
		expect(resolved["--rv-status-completed-bg"]).toBe(
			"rgba(74, 222, 128, 0.1)",
		);
		expect(resolved["--rv-accent-muted"]).toBe("rgba(74, 158, 255, 0.12)");
		expect(resolved["--rv-accent-border"]).toBe("rgba(74, 158, 255, 0.3)");
	});

	it("shape and shadow defaults follow the mode", () => {
		expect(resolveTheme(minimalDark)["--rv-border-width"]).toBe("1px");
		expect(resolveTheme(minimalDark)["--rv-shadow-node"]).toContain("0.3)");
		expect(resolveTheme(minimalLight)["--rv-shadow-node"]).toContain("0.08)");
	});

	it.each([
		minimalDark,
		minimalLight,
	])("$id: a sane minimal file has no required-tier contrast failure", (file) => {
		const failures = lintTheme(resolveTheme(file))
			.filter((f) => f.tier === "required" && !f.pass)
			.map(
				(f) =>
					`${f.pairId} ${f.ratio.toFixed(2)}:1 < ${f.min}${f.reason ? ` (${f.reason})` : ""}`,
			);
		expect(failures).toEqual([]);
	});
});
