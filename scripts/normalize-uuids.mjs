#!/usr/bin/env bun
// Walk every roadmap subtree JSON in a directory (default samples/cfa-l1/),
// regenerate every node id with crypto.randomUUID(), preserve the original id
// at metadata.legacy_id. Existing legacy_id is kept (fixed-point on re-run).
//
// Usage:
//   bun run scripts/normalize-uuids.mjs                          # default samples/cfa-l1/
//   bun run scripts/normalize-uuids.mjs samples/cfa-l1/          # explicit dir
//   bun run scripts/normalize-uuids.mjs path/file.json [...]     # explicit files
//   bun run scripts/normalize-uuids.mjs --dry-run [target]       # report only
//
// Writes are atomic (temp file + rename) so a failure mid-write doesn't
// leave a partial file. Files that fail to JSON.parse are skipped and
// reported, never silently mangled.

import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, readdirSync, renameSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

function walkAndRewrite(node, stats) {
	if (typeof node !== "object" || node === null) return;
	if (typeof node.id === "string") {
		const meta = node.metadata && typeof node.metadata === "object" ? node.metadata : {};
		if (meta.legacy_id === undefined) meta.legacy_id = node.id;
		node.metadata = meta;
		node.id = randomUUID();
		stats.replaced++;
	}
	if (Array.isArray(node.children)) {
		for (const c of node.children) walkAndRewrite(c, stats);
	}
}

function processFile(file, dryRun) {
	const out = { file, status: "ok", replaced: 0, message: "" };
	let raw;
	try {
		raw = readFileSync(file, "utf-8");
	} catch (err) {
		out.status = "read_failed";
		out.message = err.message;
		return out;
	}
	let data;
	try {
		data = JSON.parse(raw);
	} catch (err) {
		out.status = "parse_failed";
		out.message = err.message;
		return out;
	}
	const stats = { replaced: 0 };
	if (Array.isArray(data?.nodes)) {
		// entry-shape file
		for (const n of data.nodes) walkAndRewrite(n, stats);
	} else {
		walkAndRewrite(data, stats);
	}
	out.replaced = stats.replaced;
	if (dryRun) {
		out.status = "dry-run";
		return out;
	}
	const tmp = `${file}.tmp-${process.pid}-${Date.now()}`;
	try {
		writeFileSync(tmp, JSON.stringify(data, null, 2) + "\n", "utf-8");
		renameSync(tmp, file);
	} catch (err) {
		try { unlinkSync(tmp); } catch {}
		out.status = "write_failed";
		out.message = err.message;
	}
	return out;
}

function discoverFiles(target) {
	const abs = resolve(target);
	if (!existsSync(abs)) return [];
	const st = statSync(abs);
	if (st.isFile()) return [abs];
	if (st.isDirectory()) {
		return readdirSync(abs)
			.filter((f) => f.startsWith("topic-") && f.endsWith(".json"))
			.map((f) => join(abs, f))
			.sort();
	}
	return [];
}

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const explicit = args.filter((a) => !a.startsWith("--"));
const targets = explicit.length ? explicit : ["samples/cfa-l1/"];

const allFiles = [];
for (const t of targets) allFiles.push(...discoverFiles(t));

if (!allFiles.length) {
	console.error("no matching files found");
	process.exit(1);
}

console.log(`${dryRun ? "[DRY-RUN] " : ""}normalize-uuids: ${allFiles.length} file(s)`);
let totalReplaced = 0;
let okCount = 0;
let failCount = 0;
for (const f of allFiles) {
	const r = processFile(f, dryRun);
	const tag = r.status === "ok" ? "OK" : r.status === "dry-run" ? "DRY" : "FAIL";
	console.log(`  [${tag}] ${r.replaced.toString().padStart(4, " ")} ids -- ${f}${r.message ? ` -- ${r.message}` : ""}`);
	totalReplaced += r.replaced;
	if (r.status === "ok" || r.status === "dry-run") okCount++;
	else failCount++;
}
console.log(`done: ${okCount} processed, ${failCount} failed, ${totalReplaced} ids replaced`);
process.exit(failCount > 0 ? 1 : 0);
