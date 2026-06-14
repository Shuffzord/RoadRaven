import { useEffect, useState } from "react";
import { electroview } from "../rpc";

/**
 * useRecentFiles — single source of truth for the recent-files list.
 *
 * Fetches `settings.recentFiles` once on mount via the Bun `loadSettings` RPC.
 * Both WelcomeScreen (via Canvas) and the Sidebar read from this hook so the
 * two surfaces never drift. In dev / HMR mode (no `electroview`) the RPC is
 * unavailable and the list stays empty — callers render their own empty state.
 */
export function useRecentFiles(): string[] {
	const [recentFiles, setRecentFiles] = useState<string[]>([]);

	useEffect(() => {
		if (!electroview?.rpc) return;
		electroview.rpc.request
			.loadSettings({})
			.then((result) => {
				setRecentFiles(result.settings.recentFiles ?? []);
			})
			.catch(() => {
				// Settings load failed; leave empty
			});
	}, []);

	return recentFiles;
}
