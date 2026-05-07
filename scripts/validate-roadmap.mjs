#!/usr/bin/env bun
// Generic RoadRaven roadmap JSON validator. Works on any *.roadmap.json or
// *.subtree.json file (entry-shape OR single-node-shape). Pure structural
// checks — no project-specific budget rules live here. Domain validators
// (e.g. validate-cfa-roadmap.mjs) import `validateRoadmapFile` and layer
// extra rules on top.
//
// Usage:
//   bun run scripts/validate-roadmap.mjs <file> [--json] [--strict]
//   bun run scripts/validate-roadmap.mjs <file1> <file2> ...
//
// Exit codes: 0 = ok (warnings allowed), 1 = errors (or --strict + warnings).
//
// --json prints a single machine-readable JSON object per file to stdout.
// Agents should prefer --json so output parses without ambiguity.

import { existsSync, readFileSync, statSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";

export const VALID_STATUSES = new Set([
	"not-started",
	"in-progress",
	"completed",
	"blocked",
]);

export const VALID_TYPES = new Set([
	"milestone",
	"phase",
	"plan",
	"task",
	"gate",
	"research",
]);

// Matches what Zod's z.string().uuid() accepts in this codebase: 8-4-4-4-12
// hex segments, no enforcement of UUID version digit. (Empirically verified
// against packages/core/src/schema.ts — see test in CLAUDE.md.)
export const UUID_REGEX =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Walk a node tree depth-first. Visit signature: (node, depth, parent).
 */
export function walkNodes(root, visit, depth = 0, parent = null) {
	visit(root, depth, parent);
	if (Array.isArray(root.children)) {
		for (const c of root.children) walkNodes(c, visit, depth + 1, root);
	}
}

export function isLeaf(node) {
	return !Array.isArray(node.children) || node.children.length === 0;
}

/**
 * Validate one file. Returns:
 *   {
 *     file, ok, errors: [...], warnings: [...],
 *     stats: { phases, plans, tasks, leaves, leafHours, ids, refs },
 *     shape: "entry" | "subtree"
 *   }
 */
export function validateRoadmapFile(filePath) {
	const result = {
		file: filePath,
		ok: false,
		errors: [],
		warnings: [],
		stats: {
			phases: 0,
			plans: 0,
			tasks: 0,
			leaves: 0,
			leafHours: 0,
			ids: 0,
			refsFound: 0,
			refsResolved: 0,
		},
		shape: "unknown",
	};

	if (!existsSync(filePath)) {
		result.errors.push(`file_not_found: ${filePath}`);
		return result;
	}

	let raw;
	try {
		raw = readFileSync(filePath, "utf-8");
	} catch (err) {
		result.errors.push(`read_failed: ${err.message}`);
		return result;
	}

	let data;
	try {
		data = JSON.parse(raw);
	} catch (err) {
		result.errors.push(`invalid_json: ${err.message}`);
		return result;
	}

	// Detect shape: entry (has nodes[]) vs subtree (single node with children[])
	const isEntry =
		data &&
		typeof data === "object" &&
		Array.isArray(data.nodes) &&
		typeof data.version === "string";
	result.shape = isEntry ? "entry" : "subtree";

	if (isEntry) {
		for (const f of ["version", "title", "nodes"]) {
			if (data[f] === undefined)
				result.errors.push(`missing_top_level_field: ${f}`);
		}
		const baseDir = dirname(filePath);
		for (const node of data.nodes) {
			if (node.$ref) {
				result.stats.refsFound++;
				const refAbs = resolve(baseDir, node.$ref);
				if (existsSync(refAbs) && statSync(refAbs).isFile()) {
					result.stats.refsResolved++;
				} else {
					result.errors.push(`ref_target_missing: ${node.$ref}`);
				}
			}
			validateNodeTree(node, result);
		}
	} else {
		validateNodeTree(data, result);
	}

	result.stats.leafHours = Number(result.stats.leafHours.toFixed(2));
	result.ok = result.errors.length === 0;
	return result;
}

function validateNodeTree(root, result) {
	const seenIds = new Set();
	walkNodes(root, (n, depth) => {
		// Required fields
		for (const f of ["id", "title", "status", "type"]) {
			if (n[f] === undefined || n[f] === null || n[f] === "") {
				result.errors.push(
					`missing_required_field:${f} at depth ${depth} (id=${n.id ?? "?"})`,
				);
			}
		}
		// Status whitelist
		if (n.status && !VALID_STATUSES.has(n.status)) {
			result.errors.push(`invalid_status:${n.status} on ${n.id ?? "?"}`);
		}
		// Type whitelist
		if (n.type && !VALID_TYPES.has(n.type)) {
			result.errors.push(`invalid_type:${n.type} on ${n.id ?? "?"}`);
		}
		// ID uniqueness
		if (n.id) {
			if (seenIds.has(n.id))
				result.errors.push(`duplicate_id:${n.id}`);
			seenIds.add(n.id);
			if (!UUID_REGEX.test(n.id))
				result.warnings.push(
					`uuid_shape_invalid:${n.id} (Zod will reject; non-blocking)`,
				);
		}
		// Counters
		if (n.type === "phase") result.stats.phases++;
		if (n.type === "plan") result.stats.plans++;
		if (n.type === "task") result.stats.tasks++;
		if (n.type === "task" && isLeaf(n)) {
			result.stats.leaves++;
			const meta = n.metadata ?? {};
			const hours = Number(meta.estimated_hours);
			if (Number.isFinite(hours) && hours > 0) {
				result.stats.leafHours += hours;
			} else {
				result.errors.push(
					`leaf_missing_hours:${n.id} title="${n.title}"`,
				);
			}
			if (typeof meta.difficulty !== "number" || meta.difficulty < 1 || meta.difficulty > 5) {
				result.errors.push(
					`leaf_bad_difficulty:${n.id} (${meta.difficulty})`,
				);
			}
			if (!Array.isArray(meta.suggested_resources) || meta.suggested_resources.length < 2) {
				result.errors.push(
					`leaf_under_2_resources:${n.id} (${meta.suggested_resources?.length ?? 0})`,
				);
			}
			if (!Array.isArray(meta.common_pitfalls) || meta.common_pitfalls.length < 1) {
				result.errors.push(`leaf_missing_pitfall:${n.id}`);
			}
			if (!n.notes || n.notes.trim().length < 20) {
				result.errors.push(`leaf_notes_too_short:${n.id}`);
			}
		}
	});
	result.stats.ids = seenIds.size;
}

// --- CLI -------------------------------------------------------------------

function printHuman(r) {
	const status = r.ok
		? r.warnings.length
			? "PASS-warn"
			: "PASS"
		: "FAIL";
	console.log(`\n[${status}] ${basename(r.file)} (${r.shape})`);
	const s = r.stats;
	console.log(
		`  ids=${s.ids} phases=${s.phases} plans=${s.plans} tasks=${s.tasks} leaves=${s.leaves} hours=${s.leafHours}` +
			(s.refsFound ? ` refs=${s.refsResolved}/${s.refsFound}` : ""),
	);
	for (const w of r.warnings.slice(0, 3)) console.log(`  WARN ${w}`);
	if (r.warnings.length > 3) console.log(`  WARN +${r.warnings.length - 3} more`);
	for (const e of r.errors.slice(0, 10)) console.log(`  ERR  ${e}`);
	if (r.errors.length > 10) console.log(`  ERR  +${r.errors.length - 10} more`);
}

const args = process.argv.slice(2);
const json = args.includes("--json");
const strict = args.includes("--strict");
const files = args.filter((a) => !a.startsWith("--"));

if (!files.length) {
	console.error("usage: validate-roadmap.mjs <file> [...] [--json] [--strict]");
	process.exit(2);
}

const reports = files.map((f) => validateRoadmapFile(resolve(f)));
if (json) {
	console.log(JSON.stringify(reports, null, 2));
} else {
	for (const r of reports) printHuman(r);
}
const errCount = reports.reduce((a, r) => a + r.errors.length, 0);
const warnCount = reports.reduce((a, r) => a + r.warnings.length, 0);
process.exit(errCount > 0 || (strict && warnCount > 0) ? 1 : 0);
