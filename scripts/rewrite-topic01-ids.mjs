#!/usr/bin/env bun
// One-shot script: rewrite IDs in samples/cfa-l1/topic-01-ethics.json from
// the old 9-char-first-segment shape (legacy_id) to the SPEC.md §3 8-char
// shape. Preserves all content (notes, metadata, common_pitfalls, etc.).
// Sets metadata.legacy_id to the previous id on every node.

import { readFileSync, writeFileSync } from "node:fs";

const FILE = "samples/cfa-l1/topic-01-ethics.json";

// Map old 9-char prefix → new 8-char prefix. Hand-derived from the legacy
// taxonomy of topic-01-ethics.json (12 unique prefixes).
const PREFIX_MAP = {
	cfa010000: "cfa01000", // milestone root
	cfa010100: "cfa01010", // phase LM01
	cfa010101: "cfa01011", // LM01 direct-phase task series
	cfa010200: "cfa01020", // phase LM02
	cfa010201: "cfa01021", // LM02 plan 1 — Six Principles
	cfa010202: "cfa01022", // LM02 plan 2 — Standards I-VII
	cfa010300: "cfa01030", // phase LM03
	cfa010301: "cfa01031", // LM03 plan 1 — Guidance overviews
	cfa010302: "cfa01032", // LM03 plan 2 — Application case studies
	cfa010400: "cfa01040", // phase LM04
	cfa010401: "cfa01041", // LM04 plan 1 — GIPS overview
	cfa010500: "cfa01050", // phase LM05
};

function rewriteId(legacyId) {
	if (!legacyId || typeof legacyId !== "string") return null;
	const parts = legacyId.split("-");
	if (parts.length !== 5) return null;
	const oldHead = parts[0];
	const newHead = PREFIX_MAP[oldHead];
	if (!newHead) {
		throw new Error(`unknown legacy prefix: ${oldHead} (full: ${legacyId})`);
	}
	parts[0] = newHead;
	return parts.join("-");
}

function walk(node) {
	const legacy = node.metadata?.legacy_id;
	if (!legacy) {
		throw new Error(`node missing metadata.legacy_id: id=${node.id} title="${node.title}"`);
	}
	const newId = rewriteId(legacy);
	if (!newId) {
		throw new Error(`could not rewrite legacy_id: ${legacy}`);
	}
	const previousUuid = node.id;
	node.id = newId;
	// Preserve the chain: legacy_id stays as the original cfa-prefix legacy.
	// Add an extra field to record the intermediate UUID we just replaced.
	node.metadata = node.metadata ?? {};
	node.metadata.legacy_id = legacy; // already set, keep canonical legacy
	node.metadata.previous_uuid = previousUuid;
	if (Array.isArray(node.children)) {
		for (const c of node.children) walk(c);
	}
}

const raw = readFileSync(FILE, "utf-8");
const data = JSON.parse(raw);

if (!Array.isArray(data.nodes)) {
	throw new Error("expected entry-shape file with nodes[]");
}
for (const n of data.nodes) walk(n);

writeFileSync(FILE, JSON.stringify(data, null, 2) + "\n", "utf-8");
console.log(`rewrote ${FILE}`);
