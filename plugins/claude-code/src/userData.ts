import { join } from "node:path";

/**
 * Resolve the platform-specific user data directory for RoadRaven.
 * Mirrors packages/desktop/src/bun/settings.ts getUserDataDir() verbatim.
 * Uses node:* APIs only — zero Bun.* calls (Pitfall 8).
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

export const SENTINEL_FILENAME = "event-api.json";

export function getSentinelPath(): string {
	return join(getUserDataDir(), SENTINEL_FILENAME);
}
