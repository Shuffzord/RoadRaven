/**
 * Watches `<userData>/themes` (v0.8.3 Phase 4 hot reload). Unlike
 * fileWatcher.ts, which watches one roadmap file at a time, this is one
 * directory watcher whose debounced callback names every `.json` basename
 * that changed in the window, so the renderer can re-list once and re-apply
 * only if the active theme is among them.
 */

import { type FSWatcher, watch } from "node:fs";
import { getLogger } from "@logtape/logtape";
import { getThemesDir, type ThemeDirOptions } from "./themes";

const log = getLogger(["bun", "theme"]);

let watcher: FSWatcher | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let pending = new Set<string>();

export interface ThemeWatcherOptions extends ThemeDirOptions {
	debounceMs?: number;
}

/** Starts (or restarts) the themes-dir watcher. */
export function startThemeWatcher(
	onChanged: (ids: string[]) => void,
	opts: ThemeWatcherOptions = {},
): void {
	stopThemeWatcher();
	const dir = getThemesDir(opts);
	const debounceMs = opts.debounceMs ?? 250;

	watcher = watch(dir, (_eventType, filename) => {
		const name = filename?.toString();
		if (!name?.endsWith(".json")) return;
		pending.add(name.slice(0, -".json".length));
		if (timer) clearTimeout(timer);
		timer = setTimeout(() => {
			timer = null;
			const ids = [...pending].sort();
			pending = new Set();
			log.info`theme files changed: ${ids.join(", ")}`;
			onChanged(ids);
		}, debounceMs);
	});
	watcher.on("error", (err) => {
		log.error`theme watcher failed on ${dir}: ${String(err)}`;
		stopThemeWatcher();
	});
	log.debug`watching ${dir}`;
}

export function stopThemeWatcher(): void {
	watcher?.close();
	watcher = null;
	if (timer) clearTimeout(timer);
	timer = null;
	pending = new Set();
}
