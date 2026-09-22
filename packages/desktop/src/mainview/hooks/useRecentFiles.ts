import { useEffect, useState } from "react";
import { electroview } from "../rpc";
import { useRoadmapStore } from "../store/roadmapStore";

/**
 * useRecentFiles — single source of truth for the recent-files list.
 *
 * Fetches `settings.recentFiles` via the Bun `loadSettings` RPC on mount and
 * again whenever the open file changes (v0.8.2 F4): Bun records the path in
 * `addRecentFile` before `loadFile` / `saveFileAs` respond, so the refetch
 * after the store update sees the new list. Both WelcomeScreen (via Canvas)
 * and the Sidebar read from this hook so the two surfaces never drift. In
 * dev / HMR mode (no `electroview`) the RPC is unavailable and the list stays
 * empty — callers render their own empty state.
 */
export function useRecentFiles(): string[] {
	const [recentFiles, setRecentFiles] = useState<string[]>([]);

	useEffect(() => {
		if (!electroview?.rpc) return;
		const rpc = electroview.rpc;
		const refetch = (): void => {
			rpc.request
				.loadSettings({})
				.then((result) => {
					setRecentFiles(result.settings.recentFiles ?? []);
				})
				.catch(() => {
					// Settings load failed; leave the last list in place
				});
		};
		refetch();
		let lastPath = useRoadmapStore.getState().filePath;
		return useRoadmapStore.subscribe((state) => {
			if (state.filePath === lastPath) return;
			lastPath = state.filePath;
			refetch();
		});
	}, []);

	return recentFiles;
}
