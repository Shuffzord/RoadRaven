// v0.8.3 Phase 5 (RC1 / RC2): the pure half of the theme editor — field
// groups in display order, the token -> contrast-pair mapping, the live
// verdicts (same registry and tiers as CI) and the draft reducer.
import { describe, expect, it } from "vitest";
import {
	CONTRAST_PAIRS,
	THEME_TOKENS,
} from "../../../../../shared/themeContract";
import type { ThemeFile } from "../../../../../shared/themeSchema";
import {
	applyFieldChange,
	FIELD_GROUPS,
	fieldByToken,
	pairsForToken,
	REQUIRED_FIELDS,
	slugify,
	verdictsFor,
} from "../../../src/mainview/lib/themeEditor";
import { BUILT_IN_THEMES, themeForId } from "../../../src/mainview/themes";

const amber = themeForId("amber");

/** A twelve-colour file: every optional token is derived. */
const minimal: ThemeFile = {
	id: "mine",
	meta: { name: "Mine", mode: "dark" },
	colors: Object.fromEntries(
		REQUIRED_FIELDS.map((f) => [f.key, themeForId("dark").colors[f.key]]),
	),
};

// What `bun run theme:lint` prints per built-in (advisory rows, 2026-09-23).
const ADVISORY: Record<string, number> = {
	dark: 5,
	light: 5,
	"high-contrast": 2,
	paper: 5,
	amber: 5,
	contrast: 4,
	slate: 5,
	moss: 4,
};

describe("theme editor field groups", () => {
	const all = FIELD_GROUPS.flatMap((g) => g.fields);

	it("cover every colour token in THEME_TOKENS exactly once, the twelve required first in contract order", () => {
		const colourTokens = THEME_TOKENS.filter((t) => t.kind === "color").map(
			(t) => t.name,
		);
		for (const name of colourTokens) {
			expect(
				all.filter((f) => f.token === name),
				name,
			).toHaveLength(1);
		}
		const required = THEME_TOKENS.filter(
			(t) => t.kind === "color" && t.tier === "required",
		).map((t) => t.name);
		expect(REQUIRED_FIELDS.map((f) => f.token)).toEqual(required);
		expect(all.slice(0, 12).map((f) => f.token)).toEqual(required);
		expect(REQUIRED_FIELDS.every((f) => f.required)).toBe(true);
	});

	it("cover every non-colour token exactly once, in the Shape / Fonts / Shadows groups", () => {
		const nonColour = THEME_TOKENS.filter((t) => t.kind === "non-color").map(
			(t) => t.name,
		);
		for (const name of nonColour) {
			expect(
				all.filter((f) => f.token === name),
				name,
			).toHaveLength(1);
		}
		expect(all.filter((f) => f.section !== "colors")).toHaveLength(
			nonColour.length,
		);
	});

	it("list nothing that is not a token, and give every field a unique label", () => {
		const known = new Set(THEME_TOKENS.map((t) => t.name));
		for (const f of all) expect(known.has(f.token), f.token).toBe(true);
		const labels = all.map((f) => f.label);
		expect(new Set(labels).size).toBe(labels.length);
		expect(fieldByToken("--rv-bg-base")?.key).toBe("bg-base");
		expect(fieldByToken("--rv-shadow-node")).toMatchObject({
			section: "shadows",
			key: "node",
		});
		expect(fieldByToken("--rv-nope")).toBeUndefined();
	});
});

describe("pairsForToken", () => {
	it("returns the pairs whose ink or surface includes the token, in registry order", () => {
		const pairs = pairsForToken("--rv-text-primary");
		const expected = CONTRAST_PAIRS.filter(
			(p) =>
				p.ink === "--rv-text-primary" ||
				p.surface.includes("--rv-text-primary"),
		);
		expect(expected.length).toBeGreaterThan(0);
		expect(pairs.map((p) => p.pair.id)).toEqual(expected.map((p) => p.id));
		expect(pairs.every((p) => p.role === "ink")).toBe(true);
	});

	it("marks a surface layer as such (the card under the node title)", () => {
		const card = pairsForToken("--rv-bg-node");
		expect(card.find((p) => p.pair.id === "node-title")?.role).toBe("surface");
		// A translucent upper layer counts too (the badge fill over the card).
		expect(
			pairsForToken("--rv-status-completed-bg").map((p) => p.pair.id),
		).toContain("badge-completed");
	});

	it("is empty for a token no pair measures", () => {
		expect(pairsForToken("--rv-radius-md")).toEqual([]);
	});
});

describe("verdictsFor", () => {
	it.each(
		BUILT_IN_THEMES.map((t) => [t.id, t] as const),
	)("%s: 0 required failures and the advisory count theme:lint prints", (id, file) => {
		const v = verdictsFor(file);
		expect(v.requiredFailures).toBe(0);
		expect(v.advisoryFailures).toBe(ADVISORY[id]);
	});

	it("chips carry the tier: a failing required pair is fail, a failing advisory pair is warn, a passing one is pass", () => {
		const murky = {
			...amber,
			colors: { ...amber.colors, "text-primary": "#3a3a3a" },
		};
		const v = verdictsFor(murky);
		const primary = v.byToken["--rv-text-primary"];
		expect(
			primary.find((c) => c.pair.id === "text-primary-on-base"),
		).toMatchObject({ status: "fail", role: "ink" });
		expect(v.requiredFailures).toBeGreaterThan(0);

		const ok = verdictsFor(amber);
		expect(
			ok.byToken["--rv-border"].find((c) => c.pair.id === "border-vs-node")
				?.status,
		).toBe("warn");
		expect(
			ok.byToken["--rv-text-primary"].find(
				(c) => c.pair.id === "text-primary-on-base",
			),
		).toMatchObject({ status: "pass" });
		const first = ok.byToken["--rv-text-primary"][0].finding;
		expect(first.ratio).toBeGreaterThan(1);
		expect(first.min).toBe(4.5);
	});

	it("lists a token under every pair it participates in, ink or surface", () => {
		const v = verdictsFor(amber);
		expect(v.byToken["--rv-bg-node"].map((c) => c.pair.id)).toEqual(
			pairsForToken("--rv-bg-node").map((p) => p.pair.id),
		);
		expect(v.byToken["--rv-radius-md"]).toBeUndefined();
	});
});

describe("applyFieldChange", () => {
	it("an edit sets the colour, lower-cased", () => {
		const next = applyFieldChange(minimal, "--rv-accent", "#FF00AA");
		expect(next).not.toBe(minimal);
		expect(next.colors.accent).toBe("#ff00aa");
		expect(minimal.colors.accent).toBe(themeForId("dark").colors.accent);
	});

	it("null removes an optional key (and an emptied section); null on a required key is ignored", () => {
		const withTertiary = applyFieldChange(
			minimal,
			"--rv-text-tertiary",
			"#ff00ff",
		);
		expect(withTertiary.colors["text-tertiary"]).toBe("#ff00ff");
		const back = applyFieldChange(withTertiary, "--rv-text-tertiary", null);
		expect("text-tertiary" in back.colors).toBe(false);
		expect(back.colors).toEqual(minimal.colors);

		const withRadius = applyFieldChange(minimal, "--rv-radius-md", "10px");
		expect(withRadius.shape).toEqual({ "radius-md": "10px" });
		expect(applyFieldChange(withRadius, "--rv-radius-md", null).shape).toBe(
			undefined,
		);

		expect(applyFieldChange(minimal, "--rv-bg-base", null)).toBe(minimal);
	});

	it("an invalid value is ignored and the same draft comes back", () => {
		expect(applyFieldChange(minimal, "--rv-accent", "#12")).toBe(minimal);
		expect(applyFieldChange(minimal, "--rv-accent", "red")).toBe(minimal);
		expect(applyFieldChange(minimal, "--rv-accent", "#ggggggg")).toBe(minimal);
		expect(applyFieldChange(minimal, "--rv-nope", "#000000")).toBe(minimal);
		// Same value: nothing to change.
		expect(
			applyFieldChange(minimal, "--rv-accent", minimal.colors.accent),
		).toBe(minimal);
	});

	it("optional colour tokens also take rgba(), the form the derived values use", () => {
		const next = applyFieldChange(
			minimal,
			"--rv-accent-muted",
			"rgba(255, 0, 0, 0.12)",
		);
		expect(next.colors["accent-muted"]).toBe("rgba(255, 0, 0, 0.12)");
	});

	it("non-colour sections are validated by the schema grammars", () => {
		expect(applyFieldChange(minimal, "--rv-radius-md", "10")).toBe(minimal);
		expect(applyFieldChange(minimal, "--rv-font-sans", "x; y")).toBe(minimal);
		expect(
			applyFieldChange(minimal, "--rv-shadow-node", "0 0 4px url(x)"),
		).toBe(minimal);
		expect(
			applyFieldChange(minimal, "--rv-font-heading", "Georgia, serif").fonts,
		).toEqual({ heading: "Georgia, serif" });
		expect(
			applyFieldChange(minimal, "--rv-shadow-panel", "0 1px 3px #000000")
				.shadows,
		).toEqual({ panel: "0 1px 3px #000000" });
	});
});

describe("slugify", () => {
	it("matches the Bun side: lowercase, runs of non-alphanumerics become hyphens, leading digit prefixed", () => {
		expect(slugify("My Theme!")).toBe("my-theme");
		expect(slugify("  Amber  copy ")).toBe("amber-copy");
		expect(slugify("2nd")).toBe("theme-2nd");
		expect(slugify("!!!")).toBeNull();
	});
});
