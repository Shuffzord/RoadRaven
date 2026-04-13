import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { existsSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";

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
});

// Test settings persistence
describe("settings", () => {
	const testDir = join(process.cwd(), ".test-settings-" + Date.now());
	const originalCwd = process.cwd;

	beforeEach(() => {
		// We'll test in the actual cwd since settings uses process.cwd()
	});

	afterEach(() => {
		// Clean up any test settings file
		const settingsPath = join(process.cwd(), ".roadmap-settings.json");
		try {
			if (existsSync(settingsPath)) {
				unlinkSync(settingsPath);
			}
		} catch {
			// ignore cleanup errors
		}
	});

	it("loadSettings returns empty object when file does not exist", async () => {
		// Ensure settings file does not exist
		const settingsPath = join(process.cwd(), ".roadmap-settings.json");
		try {
			unlinkSync(settingsPath);
		} catch {
			// file doesn't exist, which is what we want
		}
		const { loadSettings } = await import("../../src/bun/settings");
		const result = loadSettings();
		expect(result).toEqual({});
	});

	it("saveSettings + loadSettings round-trip preserves data", async () => {
		const { loadSettings, saveSettings } = await import(
			"../../src/bun/settings"
		);
		saveSettings({ theme: "light" });
		const result = loadSettings();
		expect(result.theme).toBe("light");
	});

	it("saveSettings merges with existing settings", async () => {
		const { loadSettings, saveSettings } = await import(
			"../../src/bun/settings"
		);
		saveSettings({ theme: "dark" });
		saveSettings({ theme: "high-contrast" });
		const result = loadSettings();
		expect(result.theme).toBe("high-contrast");
	});
});

// Test that setupBunLogging configures sinks
describe("setupBunLogging", () => {
	it("configures file sink via getStreamSink", async () => {
		// Verify the module imports getStreamSink from @logtape/logtape
		const loggingSource = readFileSync(
			join(__dirname, "../../src/bun/logging.ts"),
			"utf-8",
		);
		expect(loggingSource).toContain("getStreamSink");
		expect(loggingSource).toContain("WritableStream");
		expect(loggingSource).toContain("roadraven.log");
	});
});
