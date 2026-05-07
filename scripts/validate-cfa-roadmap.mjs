#!/usr/bin/env bun
// CFA L1 2026 roadmap validator — domain overlay on top of validate-roadmap.mjs.
// Adds: per-topic hour budgets, 93-LM coverage check, 300-400h aggregate band.
//
// Usage:
//   bun run scripts/validate-cfa-roadmap.mjs                    # validate all CFA files
//   bun run scripts/validate-cfa-roadmap.mjs path/file.json     # single file (agent use)
//   bun run scripts/validate-cfa-roadmap.mjs --json             # machine-readable
//   bun run scripts/validate-cfa-roadmap.mjs --strict           # exit 1 on warnings

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { validateRoadmapFile } from "./validate-roadmap.mjs";

const TOPIC_BUDGETS = {
	"01": { name: "Ethics", min: 35, max: 50 },
	"02": { name: "Quant", min: 30, max: 40 },
	"03": { name: "Economics", min: 25, max: 35 },
	"04": { name: "FSA", min: 50, max: 70 },
	"05": { name: "Corp Issuers", min: 20, max: 30 },
	"06": { name: "Equity", min: 35, max: 50 },
	"07": { name: "Fixed Income", min: 40, max: 55 },
	"08": { name: "Derivatives", min: 20, max: 30 },
	"09": { name: "Alternatives", min: 15, max: 25 },
	"10": { name: "Portfolio Mgmt", min: 25, max: 35 },
};

function topicNumberFromFile(path) {
	const m = basename(path).match(/topic-(\d{2})/);
	return m ? m[1] : null;
}

function applyCfaOverlay(report) {
	if (report.shape !== "subtree") return;
	const tt = topicNumberFromFile(report.file);
	const budget = tt ? TOPIC_BUDGETS[tt] : null;
	if (budget) {
		const h = report.stats.leafHours;
		if (h < budget.min || h > budget.max) {
			report.warnings.push(
				`cfa_budget:${budget.name} hours ${h} outside [${budget.min}, ${budget.max}]`,
			);
		}
		report.cfaBudget = budget;
	}
	// Verify metadata.lm_count matches phase count if present
	try {
		const root = JSON.parse(readFileSync(report.file, "utf-8"));
		if (root.metadata?.lm_count !== undefined) {
			if (root.metadata.lm_count !== report.stats.phases) {
				report.errors.push(
					`cfa_lm_count_mismatch: metadata.lm_count=${root.metadata.lm_count}, actual phases=${report.stats.phases}`,
				);
				report.ok = false;
			}
		}
	} catch {
		// ignore — generic validator already reported the parse error
	}
}

function discoverFiles(repoRoot) {
	const out = [];
	const entry = join(repoRoot, "samples", "cfa-l1-roadmap.json");
	if (existsSync(entry)) out.push(entry);
	const dir = join(repoRoot, "samples", "cfa-l1");
	if (existsSync(dir)) {
		for (const f of readdirSync(dir).sort()) {
			if (f.startsWith("topic-") && f.endsWith(".json"))
				out.push(join(dir, f));
		}
	}
	return out;
}

const args = process.argv.slice(2);
const json = args.includes("--json");
const strict = args.includes("--strict");
const explicit = args.filter((a) => !a.startsWith("--"));

const targets = explicit.length
	? explicit.map((f) => resolve(f))
	: discoverFiles(process.cwd());

const reports = targets.map((t) => {
	const r = validateRoadmapFile(t);
	applyCfaOverlay(r);
	return r;
});

const totals = {
	files: reports.length,
	totalLMs: 0,
	totalLeaves: 0,
	totalLeafHours: 0,
	errors: 0,
	warnings: 0,
};
for (const r of reports) {
	if (r.shape === "subtree") {
		totals.totalLMs += r.stats.phases;
		totals.totalLeaves += r.stats.leaves;
		totals.totalLeafHours += r.stats.leafHours;
	}
	totals.errors += r.errors.length;
	totals.warnings += r.warnings.length;
}
totals.totalLeafHours = Number(totals.totalLeafHours.toFixed(2));
totals.lmCoverage = `${totals.totalLMs}/93`;
totals.hoursInBand = totals.totalLeafHours >= 300 && totals.totalLeafHours <= 400;

if (json) {
	console.log(JSON.stringify({ reports, totals }, null, 2));
} else {
	for (const r of reports) {
		const status = r.ok ? (r.warnings.length ? "PASS-warn" : "PASS") : "FAIL";
		console.log(`\n[${status}] ${basename(r.file)} (${r.shape})`);
		const s = r.stats;
		const budget = r.cfaBudget ? ` budget=${r.cfaBudget.min}-${r.cfaBudget.max}h` : "";
		console.log(
			`  ids=${s.ids} phases=${s.phases} plans=${s.plans} tasks=${s.tasks} leaves=${s.leaves} hours=${s.leafHours}${budget}` +
				(s.refsFound ? ` refs=${s.refsResolved}/${s.refsFound}` : ""),
		);
		for (const w of r.warnings.slice(0, 3)) console.log(`  WARN ${w}`);
		if (r.warnings.length > 3) console.log(`  WARN +${r.warnings.length - 3} more`);
		for (const e of r.errors.slice(0, 5)) console.log(`  ERR  ${e}`);
		if (r.errors.length > 5) console.log(`  ERR  +${r.errors.length - 5} more`);
	}
	console.log("\n" + "=".repeat(60));
	console.log("CFA L1 Aggregate");
	console.log("=".repeat(60));
	console.log(`  Files            : ${totals.files}`);
	console.log(`  LMs              : ${totals.lmCoverage}`);
	console.log(`  Leaves           : ${totals.totalLeaves}`);
	console.log(`  Leaf hours total : ${totals.totalLeafHours} ${totals.hoursInBand ? "(within 300-400h)" : "(target: 300-400h)"}`);
	console.log(`  Errors           : ${totals.errors}`);
	console.log(`  Warnings         : ${totals.warnings}`);
}

process.exit(totals.errors > 0 || (strict && totals.warnings > 0) ? 1 : 0);
