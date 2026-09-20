/**
 * Canonical serialization round-trip tests (v0.7 phase 3).
 *
 * Uses the REAL atomicWrite (no spy) so bytes on disk are asserted.
 *
 * Covers:
 *  - #1 load → save → load → save is byte-identical on the second save,
 *       and the canonical form starts with version/revision
 *  - #2 arbitrary metadata keys and plugin/subscribe payloads survive the
 *       round-trip (validation behavior unchanged)
 *  - #3 loading no longer writes a .bak.json next to the source file
 */

import {
	mkdtempSync,
	readdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { RoadmapSchema } from "../../../../../packages/core/src/schema";
import { resetRefMap } from "../../../src/bun/refMap";
import {
	loadFileHandler,
	__resetSaveFileModuleForTests as reset,
	saveFileHandler,
} from "../../../src/bun/saveFile";
import { useRoadmapStore } from "../../../src/mainview/store/roadmapStore";
import { resetStore } from "../../helpers/resetStore";

const uuid = (seed: string): string =>
	`${seed.padEnd(8, "0").slice(0, 8)}-bbbb-4ccc-8ddd-000000000000`;

// Deliberately scrambled key order — canonicalization must normalize it.
const fixture = `{
	"title": "Round Trip",
	"nodes": [
		{
			"metadata": { "zebra": 1, "alpha": { "y": 2, "b": 3 } },
			"status": "not-started",
			"plugin": { "kind": "test" },
			"subscribe": { "topic": "t" },
			"title": "Root",
			"id": "${uuid("a1")}",
			"createdAt": "2026-01-01T00:00:00Z",
			"children": [
				{ "status": "in-progress", "id": "${uuid("a2")}", "title": "Child" }
			]
		}
	],
	"statusConfig": [{ "label": "Done", "id": "done", "color": "#0f0" }],
	"version": "1.0",
	"revision": 2
}`;

describe("canonical round-trip (v0.7 phase 3)", () => {
	let tempDir: string;
	let mainPath: string;

	beforeEach(() => {
		resetStore();
		tempDir = mkdtempSync(join(tmpdir(), "rr-rt-test-"));
		mainPath = join(tempDir, "main.roadmap.json");
		reset();
		resetRefMap();
		writeFileSync(mainPath, fixture, "utf-8");
	});

	afterEach(() => {
		resetStore();
		try {
			rmSync(tempDir, { recursive: true, force: true });
		} catch {
			// ignore Windows file handle delays
		}
	});

	it("#1 no-edit load/save/reload through the real store is byte-stable", async () => {
		const load1 = await loadFileHandler({ path: mainPath });
		expect(load1.errors).toEqual([]);
		expect(load1.data).not.toBeNull();
		useRoadmapStore
			.getState()
			.loadSchema(load1.data as RoadmapSchema, mainPath);
		expect(useRoadmapStore.getState().schema?.revision).toBe(2);

		const save1 = await saveFileHandler({
			schema: useRoadmapStore.getState().schema as RoadmapSchema,
		});
		expect(save1).toEqual({ ok: true });
		const bytes1 = readFileSync(mainPath, "utf-8");

		const load2 = await loadFileHandler({ path: mainPath });
		expect(load2.errors).toEqual([]);
		const tokenBeforeReload = useRoadmapStore.getState().agentRevision;
		useRoadmapStore.getState().reloadSchema(load2.data as RoadmapSchema);
		expect(useRoadmapStore.getState().schema?.revision).toBe(2);
		expect(useRoadmapStore.getState().agentRevision).toBeGreaterThan(
			tokenBeforeReload,
		);
		const save2 = await saveFileHandler({
			schema: useRoadmapStore.getState().schema as RoadmapSchema,
		});
		expect(save2).toEqual({ ok: true });
		const bytes2 = readFileSync(mainPath, "utf-8");

		expect(bytes2).toBe(bytes1);
		// Canonical shape: version first, revision right after, LF + trailing \n.
		expect(bytes2.startsWith('{\n  "version": "1.0",\n  "revision": 2,')).toBe(
			true,
		);
		expect(bytes2.endsWith("}\n")).toBe(true);
		expect(bytes2).not.toContain("\r");
	});

	it("#2 metadata/plugin/subscribe payloads survive the round-trip", async () => {
		const load1 = await loadFileHandler({ path: mainPath });
		await saveFileHandler({ schema: load1.data as RoadmapSchema });

		const written = JSON.parse(readFileSync(mainPath, "utf-8")) as {
			nodes: Array<Record<string, unknown>>;
		};
		const root = written.nodes[0];
		expect(root.metadata).toEqual({ alpha: { b: 3, y: 2 }, zebra: 1 });
		expect(root.plugin).toEqual({ kind: "test" });
		expect(root.subscribe).toEqual({ topic: "t" });
		// Metadata keys are written alphabetically.
		const metadataKeys = Object.keys(root.metadata as Record<string, unknown>);
		expect(metadataKeys).toEqual(["alpha", "zebra"]);
	});

	it("#3 loading writes NO .bak.json next to the source file", async () => {
		await loadFileHandler({ path: mainPath });

		const litter = readdirSync(tempDir).filter((f) => f.endsWith(".bak.json"));
		expect(litter).toEqual([]);
	});

	it("#4 a store mutation persists one revision and advances the agent token", async () => {
		const loaded = await loadFileHandler({ path: mainPath });
		useRoadmapStore
			.getState()
			.loadSchema(loaded.data as RoadmapSchema, mainPath);
		const tokenBefore = useRoadmapStore.getState().agentRevision;

		useRoadmapStore.getState().renameNode(uuid("a1"), "Renamed Root");

		const state = useRoadmapStore.getState();
		expect(state.schema?.revision).toBe(3);
		expect(state.agentRevision).toBe(tokenBefore + 1);
		expect(
			await saveFileHandler({ schema: state.schema as RoadmapSchema }),
		).toEqual({ ok: true });
		expect(JSON.parse(readFileSync(mainPath, "utf-8")).revision).toBe(3);
	});
});
