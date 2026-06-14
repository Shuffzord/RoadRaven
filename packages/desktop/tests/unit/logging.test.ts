import { existsSync, mkdtempSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

// Test getLogDirectory platform-specific paths
describe("getLogDirectory", () => {
	const originalPlatform = process.platform;
	const originalEnv = { ...process.env };

	afterEach(() => {
		Object.defineProperty(process, "platform", { value: originalPlatform });
		process.env = { ...originalEnv };
	});

	it("returns Windows path on win32", async () => {
		Object.defineProperty(process, "platform", { value: "win32" });
		process.env.LOCALAPPDATA = "C:\\Users\\Test\\AppData\\Local";
		// Re-import to get fresh module
		const { getLogDirectory } = await import("../../src/bun/logging");
		const dir = getLogDirectory();
		expect(dir).toContain("RoadRaven");
		expect(dir).toContain("logs");
	});

	it("returns macOS path on darwin", async () => {
		Object.defineProperty(process, "platform", { value: "darwin" });
		process.env.HOME = "/Users/test";
		const { getLogDirectory } = await import("../../src/bun/logging");
		const dir = getLogDirectory();
		expect(dir).toContain("RoadRaven");
	});

	it("returns Linux path on linux", async () => {
		Object.defineProperty(process, "platform", { value: "linux" });
		process.env.HOME = "/home/test";
		delete process.env.XDG_DATA_HOME;
		const { getLogDirectory } = await import("../../src/bun/logging");
		const dir = getLogDirectory();
		expect(dir).toContain("RoadRaven");
		expect(dir).toContain("logs");
	});

	it("uses XDG_DATA_HOME on linux when set", async () => {
		Object.defineProperty(process, "platform", { value: "linux" });
		process.env.HOME = "/home/test";
		process.env.XDG_DATA_HOME = "/custom/data";
		const { getLogDirectory } = await import("../../src/bun/logging");
		const dir = getLogDirectory();
		// Normalize separators for cross-platform test execution
		const normalized = dir.replace(/\\/g, "/");
		expect(normalized).toContain("/custom/data");
		expect(normalized).toContain("RoadRaven");
	});

	it("falls back to USERPROFILE when HOME is unset on win32", async () => {
		Object.defineProperty(process, "platform", { value: "win32" });
		delete process.env.HOME;
		delete process.env.LOCALAPPDATA;
		process.env.USERPROFILE = "C:\\Users\\Fallback";
		const { getLogDirectory } = await import("../../src/bun/logging");
		const dir = getLogDirectory();
		expect(dir).toContain("RoadRaven");
		expect(dir).toContain("AppData");
	});
});

// Test settings persistence using isolated temp directories
describe("settings", () => {
	let tempDir: string;

	const createTempDir = () => {
		tempDir = mkdtempSync(join(tmpdir(), "roadraven-test-"));
		return tempDir;
	};

	afterEach(() => {
		// Clean up temp settings file
		if (tempDir) {
			const settingsPath = join(tempDir, "settings.json");
			try {
				if (existsSync(settingsPath)) {
					unlinkSync(settingsPath);
				}
			} catch {
				// ignore cleanup errors
			}
		}
	});

	it("getSettingsPath uses basePath when provided", async () => {
		const { getSettingsPath } = await import("../../src/bun/settings");
		const result = getSettingsPath("/some/custom/path");
		const normalized = result.replace(/\\/g, "/");
		expect(normalized).toBe("/some/custom/path/settings.json");
	});

	it("loadSettings returns empty object when file does not exist", async () => {
		const dir = createTempDir();
		const { loadSettings } = await import("../../src/bun/settings");
		const result = loadSettings(dir);
		expect(result).toEqual({});
	});

	it("saveSettings + loadSettings round-trip preserves data", async () => {
		const dir = createTempDir();
		const { loadSettings, saveSettings } = await import(
			"../../src/bun/settings"
		);
		saveSettings({ theme: "light" }, dir);
		const result = loadSettings(dir);
		expect(result.theme).toBe("light");
	});

	it("saveSettings merges with existing settings", async () => {
		const dir = createTempDir();
		const { loadSettings, saveSettings } = await import(
			"../../src/bun/settings"
		);
		saveSettings({ theme: "dark" }, dir);
		saveSettings({ theme: "high-contrast" }, dir);
		const result = loadSettings(dir);
		expect(result.theme).toBe("high-contrast");
	});
});

// NOTE: setupBunLogging cannot be tested in vitest because it depends on
// Bun.file() and the Bun-native WritableStream/FileSink APIs which are not
// available in the vitest (Node.js) runtime. The Vite build smoke test in
// tests/integration/build.test.ts validates that the module compiles and
// bundles correctly, which would catch import resolution and top-level
// compatibility issues.
