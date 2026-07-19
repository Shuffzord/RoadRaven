/**
 * writeLoadBackup tests (v0.7 phase 3).
 *
 * Covers:
 *  - #1 backup lands in <base>/backups/<stem>.<timestamp>.bak.json with the
 *       original bytes; NOTHING is written next to the source file
 *  - #2 rotation keeps only the newest 5 backups per original file
 *  - #3 rotation is scoped per original basename (other stems untouched)
 */

import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getBackupsDir, writeLoadBackup } from "../../../src/bun/backups";

describe("writeLoadBackup (v0.7 phase 3)", () => {
	let baseDir: string;
	let sourceDir: string;
	let now: number;

	beforeEach(() => {
		baseDir = mkdtempSync(join(tmpdir(), "rr-bak-base-"));
		sourceDir = mkdtempSync(join(tmpdir(), "rr-bak-src-"));
		now = 1_000_000;
		vi.spyOn(Date, "now").mockImplementation(() => now);
	});

	afterEach(() => {
		vi.restoreAllMocks();
		for (const dir of [baseDir, sourceDir]) {
			try {
				rmSync(dir, { recursive: true, force: true });
			} catch {
				// ignore Windows file handle delays
			}
		}
	});

	it("#1 writes into <base>/backups and NOT next to the source file", () => {
		const original = join(sourceDir, "main.roadmap.json");
		const bakPath = writeLoadBackup(original, '{"version":"1.0"}', baseDir);

		expect(bakPath).toBe(
			join(getBackupsDir(baseDir), "main.roadmap.1000000.bak.json"),
		);
		expect(readFileSync(bakPath, "utf-8")).toBe('{"version":"1.0"}');
		// The roadmap's own directory stays clean — no .bak litter.
		expect(readdirSync(sourceDir)).toEqual([]);
	});

	it("#2 keeps only the newest 5 backups per original file", () => {
		const original = join(sourceDir, "main.roadmap.json");
		for (let i = 0; i < 7; i++) {
			now = 1_000_000 + i;
			writeLoadBackup(original, `{"rev":${i}}`, baseDir);
		}

		const remaining = readdirSync(getBackupsDir(baseDir)).sort();
		expect(remaining).toEqual([
			"main.roadmap.1000002.bak.json",
			"main.roadmap.1000003.bak.json",
			"main.roadmap.1000004.bak.json",
			"main.roadmap.1000005.bak.json",
			"main.roadmap.1000006.bak.json",
		]);
	});

	it("#3 rotation is scoped per original basename", () => {
		const a = join(sourceDir, "alpha.json");
		const b = join(sourceDir, "beta.json");
		writeLoadBackup(b, "{}", baseDir);
		for (let i = 1; i <= 6; i++) {
			now = 1_000_000 + i;
			writeLoadBackup(a, "{}", baseDir);
		}

		const remaining = readdirSync(getBackupsDir(baseDir));
		// beta's single backup survives alpha's rotation.
		expect(remaining).toContain("beta.1000000.bak.json");
		expect(remaining.filter((f) => f.startsWith("alpha."))).toHaveLength(5);
	});
});
