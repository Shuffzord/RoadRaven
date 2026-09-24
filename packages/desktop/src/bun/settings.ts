import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { AppSettings } from "../../../../shared/types";

const SETTINGS_FILE = "settings.json";

/**
 * Resolve the platform-specific user data directory for RoadRaven.
 * Exported as getUserDataDir() so sentinel.ts and other modules can reuse it
 * without duplicating the platform switch.
 */
export function getUserDataDir(): string {
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
	return join(basePath ?? getUserDataDir(), SETTINGS_FILE);
}

export function loadSettings(basePath?: string): AppSettings {
	const path = getSettingsPath(basePath);
	if (!existsSync(path)) return {};
	try {
		const raw = readFileSync(path, "utf-8");
		return JSON.parse(raw) as AppSettings;
	} catch (e) {
		console.warn("[settings] Failed to parse settings.json:", e);
		return {};
	}
}

export function saveSettings(
	settings: Partial<AppSettings>,
	basePath?: string,
	preloaded?: AppSettings,
): void {
	const dir = basePath ?? getUserDataDir();
	const path = join(dir, SETTINGS_FILE);
	try {
		if (!existsSync(dir)) {
			mkdirSync(dir, { recursive: true });
		}
		const existing = preloaded ?? loadSettings(basePath);
		// Per-path deep merge: a write of one path's fields (e.g. just `layout`)
		// must not drop that same path's other fields (e.g. `layoutKnobs`) —
		// the shallow `{...a, ...b}` merge above replaced the whole per-path
		// value. No deeper than one path level; each path's value is still
		// merged shallowly.
		const fileSettings: AppSettings["fileSettings"] = {
			...existing.fileSettings,
		};
		for (const [path, value] of Object.entries(settings.fileSettings ?? {})) {
			fileSettings[path] = { ...fileSettings[path], ...value };
		}
		const merged: AppSettings = {
			...existing,
			...settings,
			fileSettings,
		};
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
	const existing = loadSettings(basePath);
	const recentFiles = existing.recentFiles ?? [];
	const updated = [
		filePath,
		...recentFiles.filter((f) => f !== filePath),
	].slice(0, 10);
	saveSettings({ recentFiles: updated }, basePath, existing);
}
