import { useCallback, useRef, useState } from "react";
import { useRoadmapStore } from "../store/roadmapStore";

export const OPEN_RENAME_EVENT = "roadraven:open-rename";

export interface OpenRenameEventDetail {
	nodeId: string;
}

/** Dispatch the cross-component bridge so Canvas opens inline rename on a node. */
export function dispatchOpenRename(nodeId: string | null | undefined): void {
	if (!nodeId) return;
	window.dispatchEvent(
		new CustomEvent<OpenRenameEventDetail>(OPEN_RENAME_EVENT, {
			detail: { nodeId },
		}),
	);
}

export interface InlineRenameState {
	nodeId: string | null;
	title: string;
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
		const current = stateRef.current;
		if (current.nodeId && current.title.trim()) {
			useRoadmapStore
				.getState()
				.renameNode(current.nodeId, current.title.trim());
		}
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
