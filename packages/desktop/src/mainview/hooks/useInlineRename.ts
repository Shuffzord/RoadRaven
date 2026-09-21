import { useCallback, useRef, useState } from "react";
import { useRoadmapStore } from "../store/roadmapStore";

export interface InlineRenameState {
	nodeId: string | null;
	title: string;
}

/** Write a non-empty draft back to the store. Shared by `commit` and `open`. */
function commitDraft(draft: InlineRenameState): void {
	if (draft.nodeId && draft.title.trim()) {
		useRoadmapStore.getState().renameNode(draft.nodeId, draft.title.trim());
	}
}

/**
 * Which node is being renamed, and the draft title.
 *
 * The input renders inside the node card itself (card-matched rename), so the
 * hook carries no screen position: the card is already in the right place at
 * the right zoom, and it moves with the camera for free. The floating-overlay
 * position maths this hook used to own was orphaned when v0.8.1 Phase 2 made
 * the DOM the node registry and deleted Canvas's layout-position cache.
 */
export function useInlineRename() {
	const [state, setState] = useState<InlineRenameState>({
		nodeId: null,
		title: "",
	});
	// Mirror the latest state in a ref so callbacks can read fresh values
	// without re-binding on every re-render. Avoids calling side-effects
	// (renameNode) inside functional setState updaters, which can execute
	// twice under React StrictMode / testing-library's act wrappers.
	const stateRef = useRef(state);
	stateRef.current = state;

	const open = useCallback((nodeId: string) => {
		// Moving the rename to another node commits the draft in flight
		// instead of dropping it: React fires no blur when the input
		// unmounts, and every other way of leaving a rename in this app
		// commits (the card's onBlur). Escape stays the one route that
		// discards. Reachable since v0.8.1 Phase 4 made the focus controller
		// the only opener — a newer request supersedes an older one.
		const current = stateRef.current;
		if (current.nodeId && current.nodeId !== nodeId) commitDraft(current);
		const node = useRoadmapStore.getState().nodeIndex.get(nodeId);
		const next: InlineRenameState = { nodeId, title: node?.title ?? "" };
		stateRef.current = next;
		setState(next);
	}, []);

	const setTitle = useCallback((title: string) => {
		const next = { ...stateRef.current, title };
		stateRef.current = next;
		setState(next);
	}, []);

	const commit = useCallback(() => {
		commitDraft(stateRef.current);
		const next: InlineRenameState = { nodeId: null, title: "" };
		stateRef.current = next;
		setState(next);
	}, []);

	const cancel = useCallback(() => {
		const next: InlineRenameState = { nodeId: null, title: "" };
		stateRef.current = next;
		setState(next);
	}, []);

	return { state, open, setTitle, commit, cancel };
}
