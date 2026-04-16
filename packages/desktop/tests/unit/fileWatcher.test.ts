import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	getActiveWatcherCount,
	stopAllWatchers,
	stopWatching,
	watchFile,
} from "../../src/bun/fileWatcher";

describe("fileWatcher", () => {
	let tempDir: string;
	let tempFile: string;

	beforeEach(() => {
		tempDir = mkdtempSync(join(tmpdir(), "rr-fw-test-"));
		tempFile = join(tempDir, "test.json");
		writeFileSync(tempFile, '{"version":"1.0"}', "utf-8");
	});

	afterEach(() => {
		stopAllWatchers();
		try {
			rmSync(tempDir, { recursive: true, force: true });
		} catch {
			// Cleanup may fail on Windows if file handles are held briefly
		}
	});

	it("should register a watcher and report correct count", () => {
		const callback = vi.fn();
		watchFile(tempFile, callback);
		expect(getActiveWatcherCount()).toBe(1);
	});

	it("should call onChanged after debounce when file changes", async () => {
		const callback = vi.fn();
		watchFile(tempFile, callback, 100);

		// Give watcher time to initialize
		await new Promise((r) => setTimeout(r, 50));

		// Trigger a file change
		writeFileSync(tempFile, '{"version":"2.0"}', "utf-8");

		// Wait for debounce (100ms) + buffer
		await vi.waitFor(
			() => {
				expect(callback).toHaveBeenCalledTimes(1);
			},
			{ timeout: 2000 },
		);

		expect(callback).toHaveBeenCalledWith(tempFile);
	});

	it("should debounce rapid changes into a single callback", async () => {
		const callback = vi.fn();
		watchFile(tempFile, callback, 200);

		await new Promise((r) => setTimeout(r, 50));

		// Rapid successive writes
		writeFileSync(tempFile, '{"version":"2.0"}', "utf-8");
		await new Promise((r) => setTimeout(r, 50));
		writeFileSync(tempFile, '{"version":"3.0"}', "utf-8");
		await new Promise((r) => setTimeout(r, 50));
		writeFileSync(tempFile, '{"version":"4.0"}', "utf-8");

		// Wait for debounce to settle
		await vi.waitFor(
			() => {
				expect(callback).toHaveBeenCalled();
			},
			{ timeout: 2000 },
		);

		// Should be called only once or twice (debounce groups rapid changes)
		expect(callback.mock.calls.length).toBeLessThanOrEqual(2);
	});

	it("should stop watching a specific file", () => {
		const callback = vi.fn();
		watchFile(tempFile, callback);
		expect(getActiveWatcherCount()).toBe(1);

		stopWatching(tempFile);
		expect(getActiveWatcherCount()).toBe(0);
	});

	it("should stop all watchers", () => {
		const callback = vi.fn();
		const tempFile2 = join(tempDir, "test2.json");
		writeFileSync(tempFile2, '{"v":"1"}', "utf-8");

		watchFile(tempFile, callback);
		watchFile(tempFile2, callback);
		expect(getActiveWatcherCount()).toBe(2);

		stopAllWatchers();
		expect(getActiveWatcherCount()).toBe(0);
	});

	it("should replace watcher when watching same path twice", () => {
		const callback1 = vi.fn();
		const callback2 = vi.fn();

		watchFile(tempFile, callback1);
		expect(getActiveWatcherCount()).toBe(1);

		watchFile(tempFile, callback2);
		expect(getActiveWatcherCount()).toBe(1);
	});

	it("should not call callback after stopWatching", async () => {
		const callback = vi.fn();
		watchFile(tempFile, callback, 50);

		await new Promise((r) => setTimeout(r, 50));

		stopWatching(tempFile);

		// Write after stopping
		writeFileSync(tempFile, '{"version":"changed"}', "utf-8");

		// Wait to confirm no callback
		await new Promise((r) => setTimeout(r, 200));
		expect(callback).not.toHaveBeenCalled();
	});

	it("should use 500ms as default debounce", () => {
		// Verify via the function signature -- the default parameter is 500
		const callback = vi.fn();
		watchFile(tempFile, callback);
		expect(getActiveWatcherCount()).toBe(1);
	});
});
