// Platform seam — see window.ts for the allow-listed-import rationale.
import { Updater, type UpdateStatusEntry } from "electrobun/bun";

export type { UpdateStatusEntry };
// electrobun/bun does not re-export the UpdateInfo interface; derive it.
export type UpdateInfo = ReturnType<typeof Updater.updateInfo>;

/**
 * Get the current release channel (e.g. "dev", "canary", "stable").
 * SCAF-09: Updater.localInfo.channel() throws when version.json is absent
 * (dev checkout). We catch that and default to "dev" channel.
 */
export async function getReleaseChannel(): Promise<string> {
	try {
		return await Updater.localInfo.channel();
	} catch {
		// version.json not found -- treating as dev channel
		return "dev";
	}
}

export function checkForUpdate(): Promise<UpdateInfo> {
	return Updater.checkForUpdate();
}

export function downloadUpdate(): Promise<void> {
	return Updater.downloadUpdate();
}

export function applyUpdate(): Promise<void> {
	return Updater.applyUpdate();
}

/** Electrobun keeps a single status callback; a second call replaces the first. */
export function onStatusChange(cb: (entry: UpdateStatusEntry) => void): void {
	Updater.onStatusChange(cb);
}

export function updateInfo(): UpdateInfo {
	return Updater.updateInfo();
}
