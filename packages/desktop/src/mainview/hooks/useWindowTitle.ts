import { useEffect } from "react";
import { basename } from "../lib/filePath";
import { electroview } from "../rpc";
import { useRoadmapStore } from "../store/roadmapStore";

const APP_NAME = "RoadRaven";

/** OS window title for the current document (v0.8.2 D3 / F2). */
export function windowTitleFor(state: {
	schema: unknown;
	filePath: string | null;
	isUntitled: boolean;
}): string {
	if (!state.schema) return APP_NAME;
	if (state.isUntitled || !state.filePath) return `Untitled — ${APP_NAME}`;
	return `${basename(state.filePath)} — ${APP_NAME}`;
}

/**
 * Keep the OS window title in sync with the open document. Mounted once in
 * App; the RPC fires only when the computed title actually changes.
 */
export function useWindowTitle(): void {
	useEffect(() => {
		let last: string | null = null;
		const sync = (state: ReturnType<typeof useRoadmapStore.getState>) => {
			const title = windowTitleFor(state);
			if (title === last) return;
			last = title;
			electroview?.rpc?.request.setWindowTitle({ title }).catch(() => {
				// Bun may not be ready yet; the next document change retries.
			});
		};
		sync(useRoadmapStore.getState());
		return useRoadmapStore.subscribe(sync);
	}, []);
}
