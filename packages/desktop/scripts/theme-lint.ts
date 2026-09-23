/**
 * Static theme contrast report (v0.8.3 Phase 0; registry-driven since Phase 3).
 *
 *   bun run theme:lint                  every built-in theme
 *   bun run theme:lint path/theme.json  one theme file (Phase 4 user themes)
 *   bun run theme:lint --json           machine-readable findings
 *
 * Each theme is resolved through the derivation table and linted against
 * the shared pair registry. Exits 1 when a required-tier pair fails and is
 * not listed in tests/unit/theme/known-failures.json (the same rule the
 * vitest gate applies; the file was burnt down and deleted in Phase 2, so a
 * missing file is an empty baseline), or when the given file is invalid.
 * Advisory failures are reported only.
 */

import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { type Finding, lintTheme } from "../../../shared/contrast";
import { CONTRAST_PAIRS } from "../../../shared/themeContract";
import { resolveTheme, type ThemeFile } from "../../../shared/themeSchema";
import { BUILT_IN_THEMES } from "../src/mainview/themes";
import { ThemeFileSchema } from "../src/theme/themeFileSchema";

const here = (rel: string) => fileURLToPath(new URL(rel, import.meta.url));
const BASELINE_PATH = here("../tests/unit/theme/known-failures.json");

const args = process.argv.slice(2);
const json = args.includes("--json");
const filePath = args.find((a) => !a.startsWith("--"));

function loadThemeFile(path: string): ThemeFile {
	const parsed = ThemeFileSchema.safeParse(
		JSON.parse(readFileSync(path, "utf8")),
	);
	if (parsed.success) return parsed.data;
	console.error(`${path}: not a valid theme file`);
	for (const issue of parsed.error.issues) {
		console.error(`  ${issue.path.join(".")}: ${issue.message}`);
	}
	process.exit(1);
}

const themes: readonly ThemeFile[] = filePath
	? [loadThemeFile(filePath)]
	: BUILT_IN_THEMES;
const themeIds = themes.map((t) => t.id);

const baseline = new Set<string>(
	existsSync(BASELINE_PATH)
		? (
				JSON.parse(readFileSync(BASELINE_PATH, "utf8")) as {
					theme: string;
					pairId: string;
				}[]
			).map((b) => `${b.theme}/${b.pairId}`)
		: [],
);

const findings: Finding[] = themes.flatMap((theme) =>
	lintTheme(resolveTheme(theme)).map((f) => ({ theme: theme.id, ...f })),
);
const failures = findings.filter((f) => !f.pass);
const newRequired = failures.filter(
	(f) => f.tier === "required" && !baseline.has(`${f.theme}/${f.pairId}`),
);

if (json) {
	console.log(
		JSON.stringify(
			{
				findings,
				newRequiredFailures: newRequired.map((f) => ({
					theme: f.theme,
					pairId: f.pairId,
				})),
			},
			null,
			2,
		),
	);
} else {
	const labelOf = new Map(CONTRAST_PAIRS.map((p) => [p.id, p.label]));
	const fmt = (f: Finding) =>
		f.reason ? `?? (${f.reason})` : `${f.ratio.toFixed(2)}:1`;

	console.log("## Summary\n");
	console.log("| theme | required fails | advisory fails | checked | worst |");
	console.log("|---|---|---|---|---|");
	for (const theme of themeIds) {
		const mine = findings.filter((f) => f.theme === theme);
		const req = mine.filter((f) => f.tier === "required" && !f.pass).length;
		const adv = mine.filter((f) => f.tier === "advisory" && !f.pass).length;
		const worst = mine.reduce((w, f) => (f.ratio < w.ratio ? f : w));
		console.log(
			`| ${theme} | ${req} | ${adv} | ${mine.length} | ${labelOf.get(worst.pairId)} ${fmt(worst)} |`,
		);
	}

	console.log("\n## Failures\n");
	console.log("| theme | pair | tier | ink | surface | ratio | min | status |");
	console.log("|---|---|---|---|---|---|---|---|");
	for (const f of failures) {
		const status =
			f.tier === "advisory"
				? "advisory"
				: baseline.has(`${f.theme}/${f.pairId}`)
					? "known"
					: "NEW";
		console.log(
			`| ${f.theme} | ${f.pairId} | ${f.tier} | ${f.ink} | ${f.surface} | ${fmt(f)} | ${f.min} | ${status} |`,
		);
	}

	console.log(
		`\n${newRequired.length} new required failure(s) not in known-failures.json`,
	);
}

if (newRequired.length > 0) process.exitCode = 1;
