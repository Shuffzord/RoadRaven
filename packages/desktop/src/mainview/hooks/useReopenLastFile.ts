import { useEffect } from "react";
import { electroview } from "../rpc";
import { useRoadmapStore } from "../store/roadmapStore";
import { openRecent } from "./useFileActions";

/**
 * v0.8.2 A8 — reopen the most recent roadmap on launch.
 *
 * Runs once on mount, in Electrobun mode only. Skipped when the user turned
 * `reopenLastFile` off, when there is no recent file, or when a document is
 * already (being) loaded — checked both before the settings round-trip and
 * after it, so a file handed to the app at launch always wins. A recent
 * file that no longer exists takes `openRecent`'s ordinary failure path.
 */
export function useReopenLastFile(): void {
	useEffect(() => {
		const rpc = electroview?.rpc;
		if (!rpc) return;
		const documentPresent = (): boolean => {
			const { schema, filePath } = useRoadmapStore.getState();
			return schema !== null || filePath !== null;
		};
		if (documentPresent()) return;
		rpc.request
			.loadSettings({})
			.then(({ settings }) => {
				if (settings.reopenLastFile === false) return;
				const last = settings.recentFiles?.[0];
				if (!last || documentPresent()) return;
				void openRecent(last);
			})
			.catch(() => {
				// Settings unavailable — start on the Welcome screen as before.
			});
	}, []);
}
