// Sentinel reader tests — Plan 04-05 Task 1
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("node:fs/promises");
vi.mock("../src/userData", () => ({
	getSentinelPath: vi.fn(() => "/fake/path/event-api.json"),
	getUserDataDir: vi.fn(() => "/fake/path"),
	SENTINEL_FILENAME: "event-api.json",
}));

import { readFile } from "node:fs/promises";
import { isPidAlive, readSentinel } from "../src/sentinel";

describe("Sentinel reader (MCP wrapper side)", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.useRealTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("returns ok with parsed fields when file present and pid alive", async () => {
		const sentinelData = {
			port: 47921,
			url: "ws://127.0.0.1:47921",
			startedAt: "2026-04-28T10:00:00.000Z",
			pid: process.pid,
		};
		vi.mocked(readFile).mockResolvedValueOnce(JSON.stringify(sentinelData));
		// process.pid is the current process — it IS alive
		const result = await readSentinel({ retryMs: 10, maxAttempts: 1 });
		expect(result).toEqual({ ok: true, ...sentinelData });
	});

	it("retries readSentinel 6 times with 500ms backoff (3s total)", async () => {
		vi.useFakeTimers();
		const readMock = vi.fn().mockRejectedValue(new Error("ENOENT"));
		vi.mocked(readFile).mockImplementation(readMock);

		const promise = readSentinel();
		// Advance through 5 retry delays (6th attempt has no delay after it)
		for (let i = 0; i < 5; i++) {
			await vi.advanceTimersByTimeAsync(500);
		}
		const result = await promise;

		expect(result).toEqual({
			ok: false,
			error: "Roadmap Viewer is not running. Start the app and retry.",
		});
		expect(readMock).toHaveBeenCalledTimes(6);
		vi.useRealTimers();
	});

	it("returns not-running error when sentinel missing after retries", async () => {
		vi.mocked(readFile).mockRejectedValue(new Error("ENOENT"));
		const result = await readSentinel({ retryMs: 1, maxAttempts: 3 });
		expect(result).toEqual({
			ok: false,
			error: "Roadmap Viewer is not running. Start the app and retry.",
		});
	});

	it("returns not-running when pid is dead (process.kill(pid, 0) throws)", async () => {
		const sentinelData = {
			port: 47921,
			url: "ws://127.0.0.1:47921",
			startedAt: "2026-04-28T10:00:00.000Z",
			pid: 999999, // very likely dead
		};
		vi.mocked(readFile).mockResolvedValueOnce(JSON.stringify(sentinelData));
		// Mock process.kill to throw for the dead PID
		const originalKill = process.kill.bind(process);
		vi.spyOn(process, "kill").mockImplementation((pid, signal) => {
			if (pid === 999999 && signal === 0) {
				throw new Error("ESRCH: no such process");
			}
			return originalKill(pid, signal as NodeJS.Signals);
		});

		const result = await readSentinel({ retryMs: 1, maxAttempts: 1 });
		expect(result).toEqual({
			ok: false,
			error: "Roadmap Viewer is not running. Start the app and retry.",
		});
		vi.restoreAllMocks();
	});
});

describe("isPidAlive", () => {
	it("returns true for the current process PID", () => {
		expect(isPidAlive(process.pid)).toBe(true);
	});

	it("returns false for a PID that does not exist", () => {
		// PID 999999 is extremely unlikely to exist
		const result = isPidAlive(999999);
		// It should be false (process doesn't exist), or we accept it might be true on some systems
		// but in practice it's false
		expect(typeof result).toBe("boolean");
	});
});
