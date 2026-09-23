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
	/**
	 * Open the inline rename input on this node once it is revealed (RC4).
	 *
	 * Creating used to be a store mutation plus a separate
	 * `roadraven:open-rename` window event that Canvas answered one frame
	 * later, knowing nothing about where the new card had landed — so the
	 * input could open outside the viewport while focus stayed on the parent
	 * (P0-4). The reveal is the only thing that knows when the card exists
	 * and where it is, so it owns the rename too.
	 */
	rename: boolean;
}

export function requestNodeFocus(
	nodeId: string,
	opts: { align: PanAlign; select?: boolean; rename?: boolean },
): void {
	const store = useRoadmapStore.getState();
	// A stale id (deleted between a search query and its follow, an event-log
	// row for a node from another file) must never become the target.
	if (!store.nodeIndex.has(nodeId)) return;
	store.setFocusedNode(nodeId);
	if (opts.select) store.setSelectedNode(nodeId);
	window.dispatchEvent(
		new CustomEvent<NodeFocusRequest>(FOCUS_NODE_EVENT, {
			detail: {
				nodeId,
				align: opts.align,
				select: opts.select === true,
				rename: opts.rename === true,
			},
		}),
	);
}
