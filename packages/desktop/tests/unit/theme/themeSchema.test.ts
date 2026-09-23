import { describe, expect, it } from "vitest";
import type { ThemeFile } from "../../../../../shared/themeSchema";
import { BUILT_IN_THEMES } from "../../../src/mainview/themes";
import { ThemeFileSchema } from "../../../src/mainview/themes/schema";

// The theme file format (v0.8.3 Phase 3). Phase 4 loads user files through
// this schema, so every string that reaches CSS is validated here.

const minimal: ThemeFile = {
	id: "probe",
	meta: { name: "Probe", mode: "dark" },
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

function issuesOf(input: unknown): string {
	const result = ThemeFileSchema.safeParse(input);
	if (result.success) return "";
	return result.error.issues
		.map((i) => `${i.path.join(".")}: ${i.message}`)
		.join("\n");
}

describe("ThemeFileSchema", () => {
	it("accepts a file with only the twelve required colours", () => {
		expect(ThemeFileSchema.safeParse(minimal).success).toBe(true);
	});

	it.each(
		BUILT_IN_THEMES.map((t) => t.id),
	)("accepts the built-in %s file", (id) => {
		const file = BUILT_IN_THEMES.find((t) => t.id === id);
		expect(issuesOf(file)).toBe("");
	});

	it("rejects a missing required colour and names it", () => {
		const { "bg-node": _dropped, ...rest } = minimal.colors;
		const issues = issuesOf({ ...minimal, colors: rest });
		expect(issues).toContain("bg-node");
	});

	it("rejects an unknown colour key and names it", () => {
		const issues = issuesOf({
			...minimal,
			colors: { ...minimal.colors, "bg-sidebar": "#000000" },
		});
		expect(issues).toContain("bg-sidebar");
	});

	it("rejects a 3-digit hex colour", () => {
		const issues = issuesOf({
			...minimal,
			colors: { ...minimal.colors, accent: "#fff" },
		});
		expect(issues).toContain("accent");
	});

	it("accepts rgba() colours", () => {
		const ok = ThemeFileSchema.safeParse({
			...minimal,
			colors: { ...minimal.colors, "accent-muted": "rgba(74, 158, 255, 0.12)" },
		});
		expect(ok.success).toBe(true);
	});

	it("rejects a font stack containing ';' or 'url('", () => {
		expect(
			issuesOf({ ...minimal, fonts: { sans: "Inter; color: red" } }),
		).toContain("fonts.sans");
		expect(
			issuesOf({ ...minimal, fonts: { heading: 'url("x") serif' } }),
		).toContain("fonts.heading");
	});

	it("accepts a plain font stack", () => {
		const ok = ThemeFileSchema.safeParse({
			...minimal,
			fonts: { sans: '"JetBrains Mono", ui-monospace, Menlo, monospace' },
		});
		expect(ok.success).toBe(true);
	});

	it("rejects a shadow containing '{' or 'url('", () => {
		expect(issuesOf({ ...minimal, shadows: { node: "0 0 0 { }" } })).toContain(
			"shadows.node",
		);
		expect(issuesOf({ ...minimal, shadows: { panel: "url(x)" } })).toContain(
			"shadows.panel",
		);
	});

	it("accepts a var() shadow and 'none'", () => {
		const ok = ThemeFileSchema.safeParse({
			...minimal,
			shadows: { node: "none", "node-hover": "0 0 0 2px var(--rv-accent)" },
		});
		expect(ok.success).toBe(true);
	});

	it("validates shape values as px lengths (or 0)", () => {
		expect(
			issuesOf({ ...minimal, shape: { "border-width": "2em" } }),
		).toContain("shape.border-width");
		expect(
			ThemeFileSchema.safeParse({
				...minimal,
				shape: { "border-width": "2px", "radius-xs": "0", "radius-md": "2px" },
			}).success,
		).toBe(true);
	});

	it("rejects a bad id and a bad mode", () => {
		expect(issuesOf({ ...minimal, id: "My Theme" })).toContain("id");
		expect(
			issuesOf({ ...minimal, meta: { name: "x", mode: "sepia" } }),
		).toContain("meta.mode");
	});
});
