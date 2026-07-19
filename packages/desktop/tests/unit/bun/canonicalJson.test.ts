/**
 * canonicalizeSchemaJson tests (v0.7 phase 3).
 *
 * Covers:
 *  - #1 root key order: version, revision, title, statusConfig, typeConfig,
 *       nodes, then unknown keys alphabetically
 *  - #2 node key order: id, title, status, type, createdAt, updatedAt, notes,
 *       metadata, plugin, $ref, children, then unknown keys alphabetically
 *  - #3 children are ordered recursively
 *  - #4 statusConfig/typeConfig entries: id, label, color, then unknown
 *  - #5 metadata keys alphabetical at every depth
 *  - #6 output format: 2-space indent, LF only, trailing newline
 *  - #7 unknown keys are preserved, undefined values dropped
 */

import { describe, expect, it } from "vitest";
import { canonicalizeSchemaJson } from "../../../src/bun/canonicalJson";

const parse = (json: string) => JSON.parse(json) as Record<string, unknown>;

describe("canonicalizeSchemaJson (v0.7 phase 3)", () => {
	it("#1 orders root keys with unknown keys alphabetically after nodes", () => {
		const out = canonicalizeSchemaJson({
			zebra: 1,
			nodes: [],
			title: "t",
			themeConfig: { nodeRadius: 4 },
			version: "1.0",
			revision: 3,
			typeConfig: [],
			statusConfig: [],
			aardvark: 2,
		});
		expect(Object.keys(parse(out))).toEqual([
			"version",
			"revision",
			"title",
			"statusConfig",
			"typeConfig",
			"nodes",
			"aardvark",
			"themeConfig",
			"zebra",
		]);
	});

	it("#1b serializes revision directly after version when present", () => {
		const out = canonicalizeSchemaJson({
			title: "t",
			revision: 7,
			nodes: [],
			version: "1.0",
		});
		expect(out.indexOf('"version"')).toBeLessThan(out.indexOf('"revision"'));
		expect(out.indexOf('"revision"')).toBeLessThan(out.indexOf('"title"'));
	});

	it("#2 orders node keys with unknown keys alphabetically after children", () => {
		const out = canonicalizeSchemaJson({
			version: "1.0",
			title: "t",
			nodes: [
				{
					subscribe: { topic: "x" },
					children: [],
					$ref: "./part.json",
					plugin: { p: 1 },
					metadata: {},
					notes: "n",
					updatedAt: "2026-01-01T00:00:00Z",
					createdAt: "2026-01-01T00:00:00Z",
					type: "task",
					status: "not-started",
					title: "Node",
					id: "a",
					custom: true,
				},
			],
		});
		const node = (parse(out).nodes as Record<string, unknown>[])[0];
		expect(Object.keys(node)).toEqual([
			"id",
			"title",
			"status",
			"type",
			"createdAt",
			"updatedAt",
			"notes",
			"metadata",
			"plugin",
			"$ref",
			"children",
			"custom",
			"subscribe",
		]);
	});

	it("#3 orders children recursively", () => {
		const out = canonicalizeSchemaJson({
			version: "1.0",
			title: "t",
			nodes: [
				{
					id: "a",
					title: "Root",
					status: "not-started",
					children: [{ status: "not-started", title: "Child", id: "b" }],
				},
			],
		});
		const root = (parse(out).nodes as Record<string, unknown>[])[0];
		const child = (root.children as Record<string, unknown>[])[0];
		expect(Object.keys(child)).toEqual(["id", "title", "status"]);
	});

	it("#4 orders statusConfig/typeConfig entries as id, label, color, then unknown", () => {
		const out = canonicalizeSchemaJson({
			version: "1.0",
			title: "t",
			statusConfig: [{ color: "#fff", extra: 1, label: "Done", id: "done" }],
			typeConfig: [{ label: "Task", id: "task" }],
			nodes: [],
		});
		const parsed = parse(out);
		const status = (parsed.statusConfig as Record<string, unknown>[])[0];
		const type = (parsed.typeConfig as Record<string, unknown>[])[0];
		expect(Object.keys(status)).toEqual(["id", "label", "color", "extra"]);
		expect(Object.keys(type)).toEqual(["id", "label"]);
	});

	it("#5 sorts metadata keys alphabetically at every depth", () => {
		const out = canonicalizeSchemaJson({
			version: "1.0",
			title: "t",
			nodes: [
				{
					id: "a",
					title: "Node",
					status: "not-started",
					metadata: {
						zulu: 1,
						alpha: { yankee: 2, bravo: [{ z: 1, a: 2 }] },
					},
				},
			],
		});
		const node = (parse(out).nodes as Record<string, unknown>[])[0];
		const metadata = node.metadata as Record<string, unknown>;
		expect(Object.keys(metadata)).toEqual(["alpha", "zulu"]);
		const alpha = metadata.alpha as Record<string, unknown>;
		expect(Object.keys(alpha)).toEqual(["bravo", "yankee"]);
		const inArray = (alpha.bravo as Record<string, unknown>[])[0];
		expect(Object.keys(inArray)).toEqual(["a", "z"]);
	});

	it("#6 emits 2-space indent, LF only, and a trailing newline", () => {
		const out = canonicalizeSchemaJson({
			version: "1.0",
			title: "t",
			nodes: [],
		});
		expect(out.startsWith('{\n  "version"')).toBe(true);
		expect(out.endsWith("}\n")).toBe(true);
		expect(out).not.toContain("\r");
	});

	it("#7 omits absent optional keys and undefined values", () => {
		const out = canonicalizeSchemaJson({
			version: "1.0",
			title: "t",
			nodes: [
				{ id: "a", title: "Node", status: "not-started", children: undefined },
			],
		});
		expect(out).not.toContain('"revision"');
		expect(out).not.toContain('"children"');
	});
});
