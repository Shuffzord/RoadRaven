/**
 * writeLoadBackup persistence tests.
 */

import {
	existsSync,
	mkdtempSync,
	readdirSync,
	readFileSync,
	rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getBackupsDir, writeLoadBackup } from "../../../src/bun/backups";
import * as renameModule from "../../../src/bun/renameSync";

describe("writeLoadBackup", () => {
	let baseDir: string;
	let sourceDirA: string;
	let sourceDirB: string;
	let now: number;

	beforeEach(() => {
		baseDir = mkdtempSync(join(tmpdir(), "rr-bak-base-"));
		sourceDirA = mkdtempSync(join(tmpdir(), "rr-bak-src-a-"));
		sourceDirB = mkdtempSync(join(tmpdir(), "rr-bak-src-b-"));
		now = 1_000_000;
		vi.spyOn(Date, "now").mockImplementation(() => now);
	});

	afterEach(() => {
		vi.restoreAllMocks();
		for (const dir of [baseDir, sourceDirA, sourceDirB]) {
			try {
				rmSync(dir, { recursive: true, force: true });
			} catch {
				// ignore Windows file handle delays
			}
		}
	});

	it("writes atomically into the backups directory with a unique completed name", () => {
		const original = join(sourceDirA, "main.roadmap.json");
		const bakPath = writeLoadBackup(original, '{"version":"1.0"}', baseDir);

		expect(dirname(bakPath)).toBe(getBackupsDir(baseDir));
		expect(basename(bakPath)).toMatch(
			/^main\.roadmap\.[0-9a-f]{64}\.1000000\.[0-9a-f-]{36}\.bak\.json$/,
		);
		expect(readFileSync(bakPath, "utf-8")).toBe('{"version":"1.0"}');
		expect(readdirSync(sourceDirA)).toEqual([]);
		expect(
			readdirSync(getBackupsDir(baseDir)).some((name) => name.endsWith(".tmp")),
		).toBe(false);
	});

	it("keeps the newest five of seven same-tick snapshots without collisions", () => {
		const original = join(sourceDirA, "main.roadmap.json");
		const written = Array.from({ length: 7 }, (_, revision) =>
			writeLoadBackup(original, `{"rev":${revision}}`, baseDir),
		);

		expect(new Set(written)).toHaveLength(7);
		expect(readdirSync(getBackupsDir(baseDir))).toHaveLength(5);
		for (const removed of written.slice(0, 2))
			expect(existsSync(removed)).toBe(false);
		for (const [revision, retained] of written.slice(2).entries()) {
			expect(readFileSync(retained, "utf-8")).toBe(`{"rev":${revision + 2}}`);
		}
	});

	it("retains five independent snapshots for same-basename sources", () => {
		const sourceA = join(sourceDirA, "main.json");
		const sourceB = join(sourceDirB, "main.json");
		const pathsA: string[] = [];
		const pathsB: string[] = [];
		for (let revision = 0; revision < 7; revision++) {
			pathsA.push(writeLoadBackup(sourceA, `a-${revision}`, baseDir));
			pathsB.push(writeLoadBackup(sourceB, `b-${revision}`, baseDir));
		}

		expect(readdirSync(getBackupsDir(baseDir))).toHaveLength(10);
		for (const path of [...pathsA.slice(2), ...pathsB.slice(2)]) {
			expect(existsSync(path)).toBe(true);
		}
		for (const path of [...pathsA.slice(0, 2), ...pathsB.slice(0, 2)]) {
			expect(existsSync(path)).toBe(false);
		}
	});

	it("retains and returns the newly completed backup after clock rollback", () => {
		const original = join(sourceDirA, "main.json");
		for (let revision = 0; revision < 5; revision++) {
			writeLoadBackup(original, `before-${revision}`, baseDir);
		}
		now = 1;

		const rolledBack = writeLoadBackup(original, "after-rollback", baseDir);

		expect(existsSync(rolledBack)).toBe(true);
		expect(readFileSync(rolledBack, "utf-8")).toBe("after-rollback");
		expect(readdirSync(getBackupsDir(baseDir))).toHaveLength(5);
	});

	it("cleans a failed temp publish without changing completed backups", () => {
		const original = join(sourceDirA, "main.json");
		for (let revision = 0; revision < 3; revision++) {
			writeLoadBackup(original, `prior-${revision}`, baseDir);
		}
		const backupDir = getBackupsDir(baseDir);
		const before = new Map(
			readdirSync(backupDir).map((name) => [
				name,
				readFileSync(join(backupDir, name)),
			]),
		);
		vi.spyOn(renameModule, "renameWithRetry").mockImplementationOnce(() => {
			throw new Error("injected rename failure");
		});

		expect(() => writeLoadBackup(original, "partial", baseDir)).toThrow(
			"injected rename failure",
		);

		expect(readdirSync(backupDir).sort()).toEqual([...before.keys()].sort());
		for (const [name, bytes] of before) {
			expect(readFileSync(join(backupDir, name))).toEqual(bytes);
		}
	});
});
