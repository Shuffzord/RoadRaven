import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { AppSettings } from "../../../../shared/types";

const SETTINGS_FILE = ".roadmap-settings.json";

function getSettingsPath(): string {
	// Settings file in current working directory per D-05
	return join(process.cwd(), SETTINGS_FILE);
}

export function loadSettings(): AppSettings {
	const path = getSettingsPath();
	if (!existsSync(path)) return {};
	try {
		const raw = readFileSync(path, "utf-8");
		return JSON.parse(raw) as AppSettings;
	} catch {
		return {};
	}
}

export function saveSettings(settings: Partial<AppSettings>): void {
	const path = getSettingsPath();
	const existing = loadSettings();
	const merged: AppSettings = { ...existing, ...settings };
	writeFileSync(path, JSON.stringify(merged, null, 2), "utf-8");
}
