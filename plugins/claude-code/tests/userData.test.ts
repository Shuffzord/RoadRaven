// userData path resolution tests — Plan 04-05 Task 1
// NOTE: Running on Windows — node:path.join uses backslashes on all platforms.
// Tests use path.join() to build expected values so they're cross-platform correct.
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	getSentinelPath,
	getUserDataDir,
	SENTINEL_FILENAME,
} from "../src/userData";

describe("userData path resolution", () => {
	const originalEnv = { ...process.env };
	let originalPlatform: string;

	beforeEach(() => {
		// Save original platform
		originalPlatform = process.platform;
	});

	afterEach(() => {
		// Restore env
		for (const key of Object.keys(process.env)) {
			if (!(key in originalEnv)) {
				delete process.env[key];
			}
		}
		Object.assign(process.env, originalEnv);
		// Restore platform
		Object.defineProperty(process, "platform", {
			value: originalPlatform,
			writable: true,
			configurable: true,
		});
	});

	it("returns LOCALAPPDATA/RoadRaven on win32", () => {
		Object.defineProperty(process, "platform", {
			value: "win32",
			writable: true,
			configurable: true,
		});
		process.env.LOCALAPPDATA = "C:\\Users\\test\\AppData\\Local";
		process.env.HOME = "";
		process.env.USERPROFILE = "";

		const dir = getUserDataDir();
		expect(dir).toBe(join("C:\\Users\\test\\AppData\\Local", "RoadRaven"));
	});

	it("falls back to USERPROFILE/AppData/Local/RoadRaven on win32 when LOCALAPPDATA unset", () => {
		Object.defineProperty(process, "platform", {
			value: "win32",
			writable: true,
			configurable: true,
		});
		delete process.env.LOCALAPPDATA;
		process.env.USERPROFILE = "C:\\Users\\testuser";
		process.env.HOME = "";

		const dir = getUserDataDir();
		// Should contain RoadRaven and AppData\Local
		expect(dir).toContain("RoadRaven");
		expect(dir).toContain("AppData");
		expect(dir).toContain("Local");
	});

	it("returns ~/Library/Application Support/RoadRaven on darwin", () => {
		Object.defineProperty(process, "platform", {
			value: "darwin",
			writable: true,
			configurable: true,
		});
		process.env.HOME = "/Users/testuser";
		delete process.env.LOCALAPPDATA;
		delete process.env.XDG_CONFIG_HOME;

		const dir = getUserDataDir();
		// Use join to build expected path — handles Windows vs Unix separators
		expect(dir).toBe(
			join("/Users/testuser", "Library", "Application Support", "RoadRaven"),
		);
	});

	it("returns XDG_CONFIG_HOME/RoadRaven on linux when XDG_CONFIG_HOME is set", () => {
		Object.defineProperty(process, "platform", {
			value: "linux",
			writable: true,
			configurable: true,
		});
		process.env.XDG_CONFIG_HOME = "/home/testuser/.config-custom";
		process.env.HOME = "/home/testuser";
		delete process.env.LOCALAPPDATA;

		const dir = getUserDataDir();
		expect(dir).toBe(join("/home/testuser/.config-custom", "RoadRaven"));
	});

	it("returns ~/.config/RoadRaven on linux when XDG_CONFIG_HOME is not set", () => {
		Object.defineProperty(process, "platform", {
			value: "linux",
			writable: true,
			configurable: true,
		});
		delete process.env.XDG_CONFIG_HOME;
		process.env.HOME = "/home/testuser";
		delete process.env.LOCALAPPDATA;

		const dir = getUserDataDir();
		expect(dir).toBe(join("/home/testuser", ".config", "RoadRaven"));
	});

	it("getSentinelPath joins getUserDataDir with event-api.json", () => {
		Object.defineProperty(process, "platform", {
			value: "linux",
			writable: true,
			configurable: true,
		});
		delete process.env.XDG_CONFIG_HOME;
		process.env.HOME = "/home/testuser";
		delete process.env.LOCALAPPDATA;

		const sentinelPath = getSentinelPath();
		expect(sentinelPath).toContain("RoadRaven");
		expect(sentinelPath).toContain(SENTINEL_FILENAME);
		expect(sentinelPath).toContain("event-api.json");
	});
});
