import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { AppSettings } from "../../../../shared/types";

const SETTINGS_FILE = "settings.json";

function getSettingsDirectory(): string {
	const home = process.env.HOME || process.env.USERPROFILE || "";
	if (process.platform === "win32") {
		return join(
			process.env.LOCALAPPDATA || join(home, "AppData", "Local"),
			"RoadRaven",
		);
	}
	if (process.platform === "darwin") {
		return join(home, "Library", "Application Support", "RoadRaven");
	}
	return join(
		process.env.XDG_CONFIG_HOME || join(home, ".config"),
		"RoadRaven",
	);
}

export function getSettingsPath(basePath?: string): string {
	return join(basePath ?? getSettingsDirectory(), SETTINGS_FILE);
}

export function loadSettings(basePath?: string): AppSettings {
	const path = getSettingsPath(basePath);
	if (!existsSync(path)) return {};
	try {
		const raw = readFileSync(path, "utf-8");
		return JSON.parse(raw) as AppSettings;
	} catch (e) {
		console.warn("[settings] Failed to parse .roadmap-settings.json:", e);
		return {};
	}
}

export function saveSettings(
	settings: Partial<AppSettings>,
	basePath?: string,
): void {
	const dir = basePath ?? getSettingsDirectory();
	const path = join(dir, SETTINGS_FILE);
	try {
		if (!existsSync(dir)) {
			mkdirSync(dir, { recursive: true });
		}
		const existing = loadSettings(basePath);
		const merged: AppSettings = { ...existing, ...settings };
		writeFileSync(path, JSON.stringify(merged, null, 2), "utf-8");
	} catch (e) {
		console.warn("[settings] Failed to save settings:", e);
	}
}

/**
 * Add a file path to the recent files list.
 * Deduplicates (moves existing entry to front) and caps at 10 entries.
 */
export function addRecentFile(filePath: string, basePath?: string): void {
	const settings = loadSettings(basePath);
	const recentFiles = settings.recentFiles ?? [];
	const updated = [
		filePath,
		...recentFiles.filter((f) => f !== filePath),
	].slice(0, 10);
	saveSettings({ recentFiles: updated }, basePath);
}
