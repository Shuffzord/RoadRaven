/**
 * Undo/redo as the user reaches it (v0.8.4 Phase 8): the one helper both the
 * keyboard router (Ctrl+Z / Ctrl+Y) and the canvas context menu call.
 *
 * Glue, not math — it imports the store and focusRequest, which the pure lib
 * modules never do. The store's `undo`/`redo` already focus and select the
 * node the step touched; this reveals it on the canvas.
 */

import { useRoadmapStore } from "../store/roadmapStore";
import { requestNodeFocus } from "./focusRequest";
import type { HistoryDirection } from "./historyEntries";

export function stepHistoryAndReveal(direction: HistoryDirection): void {
	const target = useRoadmapStore.getState()[direction]();
	if (target) requestNodeFocus(target, { align: "nearest", select: true });
}
