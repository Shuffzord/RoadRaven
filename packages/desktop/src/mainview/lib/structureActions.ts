/**
 * Indent/outdent as the user reaches it (v0.8.4 Phase 8 follow-up): the one
 * path both the keyboard router (Alt+arrow) and the node context menu call,
 * so the two entry points cannot drift.
 *
 * Glue, not math — it imports the stores and focusRequest, which the pure lib
 * modules never do. Target math is pure (lib/treeEdits.ts).
 */

import { useFileViewStore } from "../store/fileViewStore";
import { useRoadmapStore } from "../store/roadmapStore";
import { requestNodeFocus } from "./focusRequest";
import { indentTarget, outdentTarget } from "./treeEdits";

/**
 * Make `nodeId` the last child of its previous sibling. Expands a collapsed
 * target first so the moved node doesn't vanish, then reveals it (keeping
 * its focus and selection). No-op without a previous sibling.
 */
export function indentAndReveal(nodeId: string): void {
	const schema = useRoadmapStore.getState().schema;
	if (!schema) return;
	const target = indentTarget(schema.nodes, nodeId);
	if (!target) return;
	useFileViewStore.getState().setCollapsed(target.newParentId, false);
	useRoadmapStore.getState().indentNode(nodeId);
	requestNodeFocus(nodeId, { align: "nearest" });
}

/**
 * Move `nodeId` out to right after its parent, then reveal it. No-op when the
 * parent is a root (see lib/treeEdits.ts); the target is always visible
 * already, so no collapse check is needed here.
 */
export function outdentAndReveal(nodeId: string): void {
	const schema = useRoadmapStore.getState().schema;
	if (!schema) return;
	if (!outdentTarget(schema.nodes, nodeId)) return;
	useRoadmapStore.getState().outdentNode(nodeId);
	requestNodeFocus(nodeId, { align: "nearest" });
}
