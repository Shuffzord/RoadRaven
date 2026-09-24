import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { lintTheme } from "../../../../../shared/contrast";
import {
	CONTRAST_PAIRS,
	THEME_TOKENS,
} from "../../../../../shared/themeContract";
import { resolveTheme } from "../../../../../shared/themeSchema";
import { BUILT_IN_THEMES } from "../../../src/mainview/themes";

// Static contrast gate over the shipped themes (v0.8.3 Phase 0; registry-
// driven since Phase 3).
//
// Every built-in theme file is resolved through the derivation table and
// linted against the shared pair registry. A required-tier failure fails CI
// unless it is listed in known-failures.json; that file was burnt down to
// nothing and deleted in Phase 2, so a missing file is an empty baseline. If
// debt is ever taken on again the file can come back: a baseline row that
// starts passing fails too, so the snapshot can only shrink.

const themeNames = BUILT_IN_THEMES.map((t) => t.id);
const resolvedTokens = (theme: string) => {
	const file = BUILT_IN_THEMES.find((t) => t.id === theme);
	if (!file) throw new Error(`${theme} is not a built-in theme`);
	return resolveTheme(file);
};

type KnownFailure = { theme: string; pairId: string };
const BASELINE_PATH = resolve(__dirname, "known-failures.json");
const baseline: KnownFailure[] = existsSync(BASELINE_PATH)
	? JSON.parse(readFileSync(BASELINE_PATH, "utf8"))
	: [];
const baselineKeys = new Set(baseline.map((b) => `${b.theme}/${b.pairId}`));

const requiredKeys = THEME_TOKENS.filter(
	(t) => t.kind === "color" && t.tier === "required",
).map((t) => t.name.replace(/^--rv-/, ""));

describe("theme token contract", () => {
	it("lints the eight registered themes", () => {
		expect(themeNames).toHaveLength(8);
	});

	it.each(themeNames)("%s sets every required colour itself", (theme) => {
		const file = BUILT_IN_THEMES.find((t) => t.id === theme);
		const missing = requiredKeys.filter(
			(key) => !(key in (file?.colors ?? {})),
		);
		expect(missing).toEqual([]);
	});

	it("every token a resolved theme carries is listed in THEME_TOKENS", () => {
		const known = new Set(THEME_TOKENS.map((t) => t.name));
		const unlisted = new Set<string>();
		for (const theme of themeNames) {
			for (const name of Object.keys(resolvedTokens(theme))) {
				if (!known.has(name)) unlisted.add(name);
			}
		}
		expect([...unlisted]).toEqual([]);
	});

	it("pair ids are unique and every pair references listed colour tokens", () => {
		const ids = CONTRAST_PAIRS.map((p) => p.id);
		expect(new Set(ids).size).toBe(ids.length);
		const colours = new Set(
			THEME_TOKENS.filter((t) => t.kind === "color").map((t) => t.name),
		);
		for (const p of CONTRAST_PAIRS) {
			expect(colours.has(p.ink), `${p.id}: ${p.ink}`).toBe(true);
			for (const s of p.surface) {
				expect(colours.has(s), `${p.id}: ${s}`).toBe(true);
			}
		}
	});
});

describe("contrast gate", () => {
	it.each(
		themeNames,
	)("%s: every required-tier failure is in known-failures.json", (theme) => {
		const unexpected = lintTheme(resolvedTokens(theme))
			.filter(
				(f) =>
					f.tier === "required" &&
					!f.pass &&
					!baselineKeys.has(`${theme}/${f.pairId}`),
			)
			.map((f) => `${f.pairId} ${f.ratio.toFixed(2)}:1 < ${f.min}`);
		expect(unexpected).toEqual([]);
	});

	it("known-failures.json only names shipped themes and registered pairs", () => {
		const pairIds = new Set(CONTRAST_PAIRS.map((p) => p.id));
		for (const row of baseline) {
			expect(themeNames, `${row.theme}/${row.pairId}`).toContain(row.theme);
			expect(pairIds.has(row.pairId), `${row.theme}/${row.pairId}`).toBe(true);
		}
	});

	it("ships with no contrast debt: known-failures.json does not exist", () => {
		expect(existsSync(BASELINE_PATH)).toBe(false);
	});

	it("every known-failures.json row still fails (burn-down hygiene)", () => {
		const stale = baseline
			.filter(
				({ theme, pairId }) =>
					lintTheme(resolvedTokens(theme)).find(
						(f) => f.pairId === pairId && f.tier === "required",
					)?.pass,
			)
			.map((b) => `remove ${b.theme}/${b.pairId} from known-failures.json`);
		expect(stale).toEqual([]);
	});
});
