/**
 * Static theme contrast report (v0.8.3 Phase 0).
 *
 *   bun run theme:lint          markdown summary + failures
 *   bun run theme:lint --json   machine-readable findings
 *
 * Lints every [data-theme] block in index.css against the shared pair
 * registry. Exits 1 when a required-tier pair fails and is not listed in
 * tests/unit/theme/known-failures.json (the same rule the vitest gate
 * applies). Advisory failures are reported only.
 */

import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
	type Finding,
	lintTheme,
	parseThemeBlocks,
} from "../../../shared/contrast";
import { CONTRAST_PAIRS } from "../../../shared/themeContract";

const here = (rel: string) => fileURLToPath(new URL(rel, import.meta.url));
const CSS_PATH = here("../src/mainview/index.css");
const BASELINE_PATH = here("../tests/unit/theme/known-failures.json");

const json = process.argv.includes("--json");

const blocks = parseThemeBlocks(readFileSync(CSS_PATH, "utf8"));
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

const findings: Finding[] = Object.keys(blocks).flatMap((theme) =>
	lintTheme({ ...blocks.dark, ...blocks[theme] }).map((f) => ({
		theme,
		...f,
	})),
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
	for (const theme of Object.keys(blocks)) {
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
