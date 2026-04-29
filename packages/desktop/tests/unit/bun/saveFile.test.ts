/**
 * saveFile handler tests (Plan 03-04a).
 *
 * Covers:
 *  - #1 path-traversal rejection (T-03.04-01)
 *  - #2 cachedMainPath default accepted
 *  - #3 paths returned by Utils.saveFileDialog via dialogAllowlist accepted
 *  - #4 Zod pre-write validation via RoadmapSchemaSchema.safeParse (T-03.04-07)
 *  - #5 flushPending idempotency when no cached schema
 *  - #6 flushPending writes every owner in the ownership map
 *  - #7 loadFile hydrates the ownership map for $ref descendants
 *
 * Task 1 ships this file RED (module-resolution failure because saveFile.ts
 * does not yet export the test hooks). Task 2 implements the test hooks in
 * bun/index.ts and flips this suite GREEN.
 */

import {
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RoadmapSchema } from "../../../../../packages/core/src/schema";
import * as atomicWriteModule from "../../../src/bun/atomicWrite";
import { getOwnership, resetRefMap } from "../../../src/bun/refMap";
// Test hooks exported from bun/saveFile (real implementation lives in Task 2).
// The hooks let us exercise the handler without booting the whole Electrobun runtime.
import {
	flushPending,
	loadFileHandler,
	__pushDialogAllowlistPathForTests as pushDialogAllowlist,
	__resetSaveFileModuleForTests as reset,
	saveFileHandler,
	__setCachedMainPathForTests as setCachedMainPath,
} from "../../../src/bun/saveFile";

const uuid = (seed: string): string =>
	`${seed.padEnd(8, "0").slice(0, 8)}-bbbb-4ccc-8ddd-000000000000`;

function validSchema(): RoadmapSchema {
	return {
		version: "1.0",
		title: "t",
		nodes: [
			{
				id: uuid("a1"),
				title: "Root",
				status: "not-started",
			},
		],
	};
}

describe("saveFile handler (T-03.04-01 + T-03.04-07)", () => {
	let tempDir: string;
	let mainPath: string;
	let atomicWriteSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		tempDir = mkdtempSync(join(tmpdir(), "rr-sf-test-"));
		mainPath = resolve(join(tempDir, "main.roadmap.json"));
		reset();
		resetRefMap();
		atomicWriteSpy = vi
			.spyOn(atomicWriteModule, "atomicWrite")
			.mockResolvedValue(undefined);
	});

	afterEach(() => {
		vi.restoreAllMocks();
		try {
			rmSync(tempDir, { recursive: true, force: true });
		} catch {
			// ignore Windows file handle delays
		}
	});

	it("#1 rejects filePath outside the session allowlist (path-traversal)", async () => {
		setCachedMainPath(mainPath);

		const result = await saveFileHandler({
			schema: validSchema(),
			filePath: join(tempDir, "..", "etc", "passwd"),
		});

		expect(result).toEqual({
			ok: false,
			error: expect.stringMatching(/allowlist|traversal|unauthorized/i),
		});
		expect(atomicWriteSpy).not.toHaveBeenCalled();
	});

	it("#2 accepts cached main path when filePath is omitted", async () => {
		setCachedMainPath(mainPath);

		const result = await saveFileHandler({ schema: validSchema() });

		expect(result).toEqual({ ok: true });
		expect(atomicWriteSpy).toHaveBeenCalledTimes(1);
		expect(atomicWriteSpy.mock.calls[0][0]).toBe(mainPath);
	});

	it("#3 accepts a filePath that was returned by Utils.saveFileDialog this session", async () => {
		const dialogPath = resolve(join(tempDir, "picked.roadmap.json"));
		pushDialogAllowlist(dialogPath);

		const result = await saveFileHandler({
			schema: validSchema(),
			filePath: dialogPath,
		});

		expect(result).toEqual({ ok: true });
		expect(atomicWriteSpy).toHaveBeenCalledTimes(1);
		expect(atomicWriteSpy.mock.calls[0][0]).toBe(dialogPath);
	});

	it("#4 runs RoadmapSchemaSchema.safeParse BEFORE atomicWrite (Zod pre-write)", async () => {
		setCachedMainPath(mainPath);
		const invalid = {
			title: "no-version",
			nodes: [],
		} as unknown as RoadmapSchema;

		const result = await saveFileHandler({ schema: invalid });

		expect(result.ok).toBe(false);
		expect((result as { ok: false; error: string }).error).toMatch(
			/invalid|schema|validation/i,
		);
		expect(atomicWriteSpy).not.toHaveBeenCalled();
	});

	it("#5 flushPending is a no-op when cachedSchema/cachedMainPath are null", async () => {
		// State is freshly reset in beforeEach — no cache populated
		await expect(flushPending()).resolves.toBeUndefined();
		expect(atomicWriteSpy).not.toHaveBeenCalled();
	});

	it("#6 flushPending writes every owner in the ownership map", async () => {
		const refPath = resolve(join(tempDir, "referenced-part.json"));
		// Seed cached state via a successful saveFile
		setCachedMainPath(mainPath);

		const schema = validSchema();
		// Expand to 2 owners: main + ref
		schema.nodes[0].children = [
			{ id: uuid("b1"), title: "Ref Root", status: "not-started" },
		];

		// Seed ownership so the ref child is owned by refPath
		getOwnership().set(uuid("a1"), mainPath);
		getOwnership().set(uuid("b1"), refPath);

		await saveFileHandler({ schema });
		atomicWriteSpy.mockClear();

		await flushPending();

		// 2 owners → exactly 2 atomicWrite calls
		expect(atomicWriteSpy).toHaveBeenCalledTimes(2);
		const targets = atomicWriteSpy.mock.calls.map((c) => c[0]).sort();
		expect(targets).toEqual([mainPath, refPath].sort());
	});

	it("#7 loadFile hydrates the ownership map for all $ref descendants", async () => {
		// Build a real fixture pair on disk so loadFileHandler has files to read
		const refFile = join(tempDir, "referenced-part.json");
		writeFileSync(
			refFile,
			JSON.stringify({
				nodes: [
					{
						id: uuid("b1"),
						title: "Ref Root",
						status: "not-started",
						children: [
							{ id: uuid("b2"), title: "Ref Child", status: "not-started" },
						],
					},
				],
			}),
			"utf-8",
		);

		const mainFile = join(tempDir, "main.roadmap.json");
		writeFileSync(
			mainFile,
			JSON.stringify({
				version: "1.0",
				title: "Ref Test",
				nodes: [
					{
						id: uuid("a1"),
						title: "Main Root",
						status: "not-started",
						children: [
							{ id: uuid("a2"), title: "Main Child", status: "not-started" },
							{ $ref: "./referenced-part.json" },
						],
					},
				],
			}),
			"utf-8",
		);

		await loadFileHandler({ path: mainFile });

		const map = getOwnership();
		expect(map.get(uuid("a1"))).toBe(resolve(mainFile));
		expect(map.get(uuid("a2"))).toBe(resolve(mainFile));
		expect(map.get(uuid("b1"))).toBe(resolve(refFile));
		expect(map.get(uuid("b2"))).toBe(resolve(refFile));

		// Ensure the .bak.json cleanup doesn't leak test state
		try {
			rmSync(mainFile.replace(/\.json$/, ".bak.json"), { force: true });
		} catch {
			// ignore
		}
	});
});
