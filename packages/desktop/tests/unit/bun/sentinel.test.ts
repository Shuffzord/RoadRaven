// Phase 4 Wave 1 — real test implementations for Plan 04-02 Task 4.
// Sources: D-04, D-05 in 04-CONTEXT.md, §1.4 in 04-RESEARCH.md.

import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock getUserDataDir so sentinel writes go to a temp dir rather than real user data.
vi.mock("../../../src/bun/settings", () => ({
	getUserDataDir: vi.fn(),
}));

// Must import AFTER the mock is set up
import { deleteSentinel, getSentinelPath, writeSentinel } from "../../../src/bun/sentinel";
import { getUserDataDir } from "../../../src/bun/settings";

describe("Sentinel file lifecycle", () => {
	let tempDir: string;

	beforeEach(() => {
		tempDir = mkdtempSync(join(tmpdir(), "sentinel-test-"));
		vi.mocked(getUserDataDir).mockReturnValue(tempDir);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("writes event-api.json atomically with correct shape { port, url, startedAt, pid }", async () => {
		const data = {
			port: 47921,
			url: "ws://127.0.0.1:47921",
			startedAt: new Date().toISOString(),
			pid: process.pid,
		};
		await writeSentinel(data);

		const sentinelPath = getSentinelPath();
		expect(existsSync(sentinelPath)).toBe(true);

		const contents = JSON.parse(readFileSync(sentinelPath, "utf-8"));
		expect(contents).toMatchObject({
			port: 47921,
			url: "ws://127.0.0.1:47921",
			pid: process.pid,
		});
		expect(typeof contents.startedAt).toBe("string");
		// Shape has exactly these 4 keys
		expect(Object.keys(contents).sort()).toEqual(["pid", "port", "startedAt", "url"]);
	});

	it("deletes sentinel on clean shutdown", async () => {
		const data = {
			port: 47921,
			url: "ws://127.0.0.1:47921",
			startedAt: new Date().toISOString(),
			pid: process.pid,
		};
		await writeSentinel(data);
		expect(existsSync(getSentinelPath())).toBe(true);

		await deleteSentinel();
		expect(existsSync(getSentinelPath())).toBe(false);
	});

	it("embeds the current process pid", async () => {
		const data = {
			port: 47922,
			url: "ws://127.0.0.1:47922",
			startedAt: new Date().toISOString(),
			pid: process.pid,
		};
		await writeSentinel(data);

		const contents = JSON.parse(readFileSync(getSentinelPath(), "utf-8"));
		expect(contents.pid).toBe(process.pid);
	});
});
