import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { AppSettings } from "../../../../shared/types";

const SETTINGS_FILE = ".roadmap-settings.json";

export function getSettingsPath(basePath?: string): string {
	// Settings file in current working directory per D-05
	return join(basePath ?? process.cwd(), SETTINGS_FILE);
}

export function loadSettings(basePath?: string): AppSettings {
	const path = getSettingsPath(basePath);
	if (!existsSync(path)) return {};
	try {
		const raw = readFileSync(path, "utf-8");
		return JSON.parse(raw) as AppSettings;
	} catch {
		return {};
	}
}

export function saveSettings(
	settings: Partial<AppSettings>,
	basePath?: string,
): void {
	const path = getSettingsPath(basePath);
	const existing = loadSettings(basePath);
	const merged: AppSettings = { ...existing, ...settings };
	writeFileSync(path, JSON.stringify(merged, null, 2), "utf-8");
}
