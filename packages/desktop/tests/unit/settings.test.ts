import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	addRecentFile,
	loadSettings,
	saveSettings,
} from "../../src/bun/settings";

describe("settings persistence", () => {
	let tempDir: string;

	beforeEach(() => {
		tempDir = mkdtempSync(join(tmpdir(), "roadraven-settings-test-"));
	});

	afterEach(() => {
		rmSync(tempDir, { recursive: true, force: true });
	});

	it("loadSettings returns empty object when no file exists", () => {
		const result = loadSettings(tempDir);
		expect(result).toEqual({});
	});

	it("saveSettings persists and loadSettings retrieves the same data", () => {
		saveSettings({ theme: "dark" }, tempDir);
		const result = loadSettings(tempDir);
		expect(result.theme).toBe("dark");
	});

	it("saveSettings merges with existing settings", () => {
		saveSettings({ theme: "dark" }, tempDir);
		saveSettings({ recentFiles: ["/path/to/file.json"] }, tempDir);
		const result = loadSettings(tempDir);
		expect(result.theme).toBe("dark");
		expect(result.recentFiles).toEqual(["/path/to/file.json"]);
	});
});

describe("addRecentFile", () => {
	let tempDir: string;

	beforeEach(() => {
		tempDir = mkdtempSync(join(tmpdir(), "roadraven-recent-test-"));
	});

	afterEach(() => {
		rmSync(tempDir, { recursive: true, force: true });
	});

	it("adds a file path to the front of recentFiles", () => {
		addRecentFile("/path/a.json", tempDir);
		const settings = loadSettings(tempDir);
		expect(settings.recentFiles).toEqual(["/path/a.json"]);
	});

	it("deduplicates by moving existing entry to front", () => {
		addRecentFile("/path/a.json", tempDir);
		addRecentFile("/path/b.json", tempDir);
		addRecentFile("/path/a.json", tempDir);
		const settings = loadSettings(tempDir);
		expect(settings.recentFiles).toEqual(["/path/a.json", "/path/b.json"]);
	});

	it("caps the list at 10 entries (oldest removed)", () => {
		for (let i = 0; i < 15; i++) {
			addRecentFile(`/path/file-${i}.json`, tempDir);
		}
		const settings = loadSettings(tempDir);
		expect(settings.recentFiles).toHaveLength(10);
		// Most recent should be first
		expect(settings.recentFiles?.[0]).toBe("/path/file-14.json");
		// Oldest kept should be file-5 (0-4 were pushed out)
		expect(settings.recentFiles?.[9]).toBe("/path/file-5.json");
	});

	it("loadSettings returns recentFiles from persisted settings", () => {
		saveSettings({ recentFiles: ["/saved/a.json", "/saved/b.json"] }, tempDir);
		const result = loadSettings(tempDir);
		expect(result.recentFiles).toEqual(["/saved/a.json", "/saved/b.json"]);
	});

	it("saveSettings with recentFiles updates the stored list", () => {
		saveSettings({ recentFiles: ["/old.json"] }, tempDir);
		saveSettings({ recentFiles: ["/new.json", "/old.json"] }, tempDir);
		const result = loadSettings(tempDir);
		expect(result.recentFiles).toEqual(["/new.json", "/old.json"]);
	});
});
