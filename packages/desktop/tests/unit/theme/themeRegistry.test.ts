import { describe, expect, it } from "vitest";
import { resolveTheme } from "../../../../../shared/themeSchema";
import {
	BUILT_IN_THEMES,
	DEFAULT_THEME_ID,
	getBuiltInTheme,
	THEME_IDS,
} from "../../../src/mainview/themes";
import fixtureJson from "./fixtures/css-tokens-pre-phase3.json";

// Phase 3 equivalence gate: every built-in theme file, resolved through the
// derivation table, reproduces the token values its index.css block painted
// before the migration (fixture generated from parseThemeBlocks with the
// dark-inheritance rule, before the blocks were deleted).

const fixture = fixtureJson as Record<string, Record<string, string>>;

/** `rgba( 1, 2 ,3, .5)` and `rgba(1, 2, 3, 0.5)` are the same colour. */
function normalise(value: string): string {
	return value
		.replace(/\s+/g, " ")
		.replace(/\(\s+/g, "(")
		.replace(/\s+\)/g, ")")
		.replace(/\s*,\s*/g, ", ")
		.replace(/(?<![\d.])\.(\d)/g, "0.$1")
		.trim();
}

describe("built-in theme registry", () => {
	it("registers the eight shipped ids in picker order", () => {
		expect([...THEME_IDS]).toEqual(Object.keys(fixture));
		expect(BUILT_IN_THEMES.map((t) => t.id)).toEqual([...THEME_IDS]);
	});

	it("defaults to amber (D-8, owner 2026-09-23)", () => {
		expect(DEFAULT_THEME_ID).toBe("amber");
		expect(getBuiltInTheme(DEFAULT_THEME_ID)?.id).toBe("amber");
	});

	it("returns undefined for an unknown id", () => {
		expect(getBuiltInTheme("solarized")).toBeUndefined();
	});

	it.each(
		Object.keys(fixture),
	)("%s: resolveTheme reproduces every token the CSS block painted", (id) => {
		const file = getBuiltInTheme(id);
		expect(file, `${id} is registered`).toBeDefined();
		if (!file) return;
		const resolved = resolveTheme(file);
		const expected = Object.fromEntries(
			Object.entries(fixture[id]).map(([k, v]) => [k, normalise(v)]),
		);
		const actual = Object.fromEntries(
			Object.keys(fixture[id]).map((k) => [k, normalise(resolved[k] ?? "")]),
		);
		expect(actual).toEqual(expected);
	});
});
