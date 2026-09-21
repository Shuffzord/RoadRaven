import { useRoadmapStore } from "../store/roadmapStore";
import type { PanAlign } from "./viewportMath";

/**
 * The one way to say "make this node the target" (v0.8.1 RC3).
 *
 * Canvas used to derive its viewport target implicitly from
 * `focusedNodeId ?? selectedNodeId`, so an event-log click could not move a
 * camera that already had a focused node, and selecting a node re-panned a
 * second time when the SidePanel resized the canvas. Every mover now asks
 * explicitly and says what it wants.
 *
 * The LOGICAL half runs synchronously here, because selection drives the
 * SidePanel and must not depend on a mounted Canvas (the router, EventLog and
 * integration tests run without one). The REVEAL half — expanding collapsed
 * ancestors, waiting for the card to mount, measuring and panning — is the
 * canvas controller's, reached through this window event, the same bridge
 * pattern as `roadraven:fit-view`.
 */

export const FOCUS_NODE_EVENT = "roadraven:focus-node";

export interface NodeFocusRequest {
	nodeId: string;
	align: PanAlign;
	select: boolean;
}

export function requestNodeFocus(
	nodeId: string,
	opts: { align: PanAlign; select?: boolean },
): void {
	const store = useRoadmapStore.getState();
	// A stale id (deleted between a search query and its follow, an event-log
	// row for a node from another file) must never become the target.
	if (!store.nodeIndex.has(nodeId)) return;
	store.setFocusedNode(nodeId);
	if (opts.select) store.setSelectedNode(nodeId);
	window.dispatchEvent(
		new CustomEvent<NodeFocusRequest>(FOCUS_NODE_EVENT, {
			detail: { nodeId, align: opts.align, select: opts.select === true },
		}),
	);
}
