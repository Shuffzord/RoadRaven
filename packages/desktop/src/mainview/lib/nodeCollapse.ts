/**
 * Programmatic collapse/expand for canvas nodes — the keyboard router, the
 * context menu and the focus controller all go through here.
 *
 * v0.8.4 Phase 4: collapse state is owned by `fileViewStore.collapsedIds`
 * (RC1); react-d3-tree only renders the tree pruned from it. Whether a node
 * has children comes from the roadmap's `nodeIndex`, so none of this needs
 * the node's card to be mounted.
 */

import { useFileViewStore } from "../store/fileViewStore";
import { useRoadmapStore } from "../store/roadmapStore";
import { ancestorsToExpand } from "./collapseTree";

function hasChildNodes(nodeId: string): boolean {
	const node = useRoadmapStore.getState().nodeIndex.get(nodeId);
	return (node?.children?.length ?? 0) > 0;
}

/** Collapse state of a node. */
export function getNodeCollapseState(nodeId: string): {
	/** True when the node has children (its card shows a chevron). */
	hasChildren: boolean;
	/** True when the subtree is currently collapsed. */
	collapsed: boolean;
} {
	if (!hasChildNodes(nodeId)) return { hasChildren: false, collapsed: false };
	return {
		hasChildren: true,
		collapsed: useFileViewStore.getState().collapsedIds.has(nodeId),
	};
}

/**
 * Toggle collapse/expand on a node's subtree. No-op (returns false) when the
 * node has no children.
 */
export function toggleNodeCollapse(nodeId: string): boolean {
	if (!hasChildNodes(nodeId)) return false;
	useFileViewStore.getState().toggleCollapsed(nodeId);
	return true;
}

/**
 * Expand every collapsed ancestor on a top-down path in ONE store write, then
 * invoke `onDone` on the next frame, once the re-render has mounted the
 * descendants. Used by jump-to focus requests (search, event log) to reveal a
 * node buried inside collapsed subtrees before measuring it.
 *
 * Returns a cancel function: a caller that re-invokes on rapid input (typing,
 * holding F3) cancels the previous `onDone` so only the latest one runs.
 */
export function expandAncestors(
	pathTopDown: string[],
	onDone: () => void,
): () => void {
	let cancelled = false;
	const { collapsedIds, expandMany } = useFileViewStore.getState();
	const toExpand = ancestorsToExpand(pathTopDown, collapsedIds);
	if (toExpand.length > 0) expandMany(toExpand);
	requestAnimationFrame(() => {
		if (!cancelled) onDone();
	});
	return () => {
		cancelled = true;
	};
}
