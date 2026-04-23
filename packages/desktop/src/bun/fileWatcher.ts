import type { FSWatcher } from "node:fs";
import { watch } from "node:fs";
import { resolve as pathResolve } from "node:path";

const activeWatchers = new Map<string, FSWatcher>();
const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

// Self-write suppression. saveFile / saveFileAs / flushPending call
// markSelfWrite(path) right after atomicWrite returns; the watcher's debounced
// callback checks isRecentSelfWrite(path) and skips dispatching when the change
// was caused by our own write. Without this, every save triggers a watcher
// event 500ms later and — if the user has started a new edit in that window —
// the dirty/active branch in handleExternalFileChange shows the
// ExternalEditToast as if a third party edited the file.
const selfWriteTimestamps = new Map<string, number>();
const SELF_WRITE_WINDOW_MS = 2000;

/** Record that we just wrote to `filePath` so the next watcher fire is suppressed. */
export function markSelfWrite(filePath: string): void {
	selfWriteTimestamps.set(pathResolve(filePath), Date.now());
}

function isRecentSelfWrite(filePath: string): boolean {
	const ts = selfWriteTimestamps.get(pathResolve(filePath));
	if (ts === undefined) return false;
	if (Date.now() - ts < SELF_WRITE_WINDOW_MS) return true;
	// Window elapsed — clean up the stale entry so the map doesn't grow unbounded.
	selfWriteTimestamps.delete(pathResolve(filePath));
	return false;
}

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
				// Self-write suppression: if we just wrote this path ourselves
				// (saveFile/saveFileAs/flushPending), don't fire pushFileChanged
				// — otherwise the user sees "File changed externally" toast on
				// their own save. The window covers the watcher's 500ms debounce
				// plus headroom for slow writes.
				if (isRecentSelfWrite(filePath)) return;
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
