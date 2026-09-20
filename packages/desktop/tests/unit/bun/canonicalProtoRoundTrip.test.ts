import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { RoadmapSchema } from "../../../../../packages/core/src/schema";
import { resetRefMap } from "../../../src/bun/refMap";
import {
	loadFileHandler,
	__resetSaveFileModuleForTests as resetSaveFile,
	saveFileHandler,
} from "../../../src/bun/saveFile";

const fixture = `{
	"version": "1.0",
	"title": "Prototype Key Round Trip",
	"nodes": [
		{
			"id": "root",
			"title": "Root",
			"status": "not-started",
			"metadata": {
				"nested": [
					{ "__proto__": { "preserved": true } }
				]
			}
		}
	]
}`;

describe("canonical __proto__ persistence", () => {
	let tempDir: string;
	let mainPath: string;

	beforeEach(() => {
		tempDir = mkdtempSync(join(tmpdir(), "rr-proto-roundtrip-"));
		mainPath = join(tempDir, "main.roadmap.json");
		resetSaveFile();
		resetRefMap();
		writeFileSync(mainPath, fixture, "utf-8");
	});

	afterEach(() => {
		try {
			rmSync(tempDir, { recursive: true, force: true });
		} catch {
			// ignore Windows file handle delays
		}
	});

	it("survives a real load-save-reload-save cycle", async () => {
		const firstLoad = await loadFileHandler({ path: mainPath });
		expect(firstLoad.errors).toEqual([]);
		expect(
			await saveFileHandler({ schema: firstLoad.data as RoadmapSchema }),
		).toEqual({ ok: true });

		const secondLoad = await loadFileHandler({ path: mainPath });
		expect(secondLoad.errors).toEqual([]);
		const nested = secondLoad.data?.nodes[0].metadata?.nested as Array<
			Record<string, unknown>
		>;
		expect(
			Object.getOwnPropertyDescriptor(nested[0], "__proto__")?.value,
		).toEqual({ preserved: true });

		expect(
			await saveFileHandler({ schema: secondLoad.data as RoadmapSchema }),
		).toEqual({ ok: true });
		const written = JSON.parse(readFileSync(mainPath, "utf-8"));
		const persisted = written.nodes[0].metadata.nested[0];
		expect(
			Object.getOwnPropertyDescriptor(persisted, "__proto__")?.value,
		).toEqual({ preserved: true });
	});
});
