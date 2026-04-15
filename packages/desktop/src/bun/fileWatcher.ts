import type { FSWatcher } from "node:fs";
import { watch } from "node:fs";

const activeWatchers = new Map<string, FSWatcher>();
const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

/**
 * Watch a file for changes with debounce.
 * If a watcher already exists for the given path, it is replaced.
 */
export function watchFile(
	filePath: string,
	onChanged: (path: string) => void,
	debounceMs = 500,
): void {
	// Close existing watcher for this path if any
	stopWatching(filePath);

	const watcher = watch(filePath, (eventType) => {
		if (eventType !== "change" && eventType !== "rename") return;

		// Debounce: cancel pending timer, set new one
		const existing = debounceTimers.get(filePath);
		if (existing) clearTimeout(existing);
		debounceTimers.set(
			filePath,
			setTimeout(() => {
				debounceTimers.delete(filePath);
				onChanged(filePath);
			}, debounceMs),
		);
	});

	watcher.on("error", () => {
		stopWatching(filePath);
	});

	activeWatchers.set(filePath, watcher);
}

/**
 * Stop watching a specific file.
 */
export function stopWatching(filePath: string): void {
	const existing = activeWatchers.get(filePath);
	if (existing) {
		existing.close();
		activeWatchers.delete(filePath);
	}
	const timer = debounceTimers.get(filePath);
	if (timer) {
		clearTimeout(timer);
		debounceTimers.delete(filePath);
	}
}

/**
 * Stop all active file watchers.
 */
export function stopAllWatchers(): void {
	for (const path of activeWatchers.keys()) {
		stopWatching(path);
	}
}

/**
 * Get the number of active file watchers.
 */
export function getActiveWatcherCount(): number {
	return activeWatchers.size;
}
