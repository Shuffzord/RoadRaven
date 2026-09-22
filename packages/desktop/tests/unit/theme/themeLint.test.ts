import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { lintTheme, parseThemeBlocks } from "../../../../../shared/contrast";
import {
	CONTRAST_PAIRS,
	THEME_TOKENS,
} from "../../../../../shared/themeContract";

// Static contrast gate over the shipped themes (v0.8.3 Phase 0).
//
// Every [data-theme] block in index.css is linted against the shared pair
// registry. Required-tier failures must be listed in known-failures.json —
// a snapshot of today's debt that Phase 2 burns down to zero. A new failure
// fails CI; a baseline row that starts passing also fails, so the snapshot
// can only shrink.

const css = readFileSync(
	resolve(__dirname, "../../../src/mainview/index.css"),
	"utf8",
);
const blocks = parseThemeBlocks(css);
const themeNames = Object.keys(blocks);

// Non-dark themes inherit any token they do not set from the dark block,
// exactly as the cascade does (:root carries the dark values).
const resolvedTokens = (theme: string) => ({
	...blocks.dark,
	...blocks[theme],
});

type KnownFailure = { theme: string; pairId: string };
const baseline: KnownFailure[] = JSON.parse(
	readFileSync(resolve(__dirname, "known-failures.json"), "utf8"),
);
const baselineKeys = new Set(baseline.map((b) => `${b.theme}/${b.pairId}`));

const requiredTokens = THEME_TOKENS.filter(
	(t) => t.kind === "color" && t.tier === "required",
).map((t) => t.name);

describe("theme token contract", () => {
	it("finds the eight shipped theme blocks", () => {
		expect(themeNames).toEqual([
			"dark",
			"light",
			"high-contrast",
			"paper",
			"amber",
			"contrast",
			"slate",
			"moss",
		]);
	});

	it.each(themeNames)("%s defines every required token itself", (theme) => {
		const missing = requiredTokens.filter((name) => !(name in blocks[theme]));
		expect(missing).toEqual([]);
	});

	it("every token any theme defines is listed in THEME_TOKENS", () => {
		const known = new Set(THEME_TOKENS.map((t) => t.name));
		const unlisted = new Set<string>();
		for (const theme of themeNames) {
			for (const name of Object.keys(blocks[theme])) {
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

	it.each(baseline)("$theme/$pairId still fails (burn-down hygiene)", ({
		theme,
		pairId,
	}) => {
		const finding = lintTheme(resolvedTokens(theme)).find(
			(f) => f.pairId === pairId && f.tier === "required",
		);
		expect(
			finding?.pass,
			`remove ${theme}/${pairId} from known-failures.json`,
		).toBe(false);
	});
});
