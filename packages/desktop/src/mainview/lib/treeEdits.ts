/**
 * Pure indent/outdent target math (v0.8.4 Phase 5).
 *
 * Built on `findParentAndIndex` (lib/treeWalk.ts) so the two functions here
 * never duplicate tree-walking logic. Neither function mutates anything —
 * they return the `{ newParentId, position }` the caller hands to
 * `roadmapStore.moveNode`, or `null` when the move is a no-op.
 */

import type { RoadmapNode } from "../../../../../packages/core/src/schema";
import { findParentAndIndex } from "./treeWalk";

export interface MoveTarget {
	newParentId: string;
	position: number;
}

/**
 * Indent: `id` becomes the LAST child of its previous sibling. `null` when
 * `id` is not found or has no previous sibling (it is already first in its
 * parent array).
 */
export function indentTarget(
	nodes: RoadmapNode[],
	id: string,
): MoveTarget | null {
	const found = findParentAndIndex(nodes, id);
	if (!found || found.index === 0) return null;
	const prevSibling = found.parentArray[found.index - 1];
	return {
		newParentId: prevSibling.id,
		position: prevSibling.children?.length ?? 0,
	};
}

/**
 * Outdent: `id` moves out to become the sibling right after its parent.
 * `null` when `id` is not found or its parent is itself a root-level node
 * (there is no grandparent to move into).
 */
export function outdentTarget(
	nodes: RoadmapNode[],
	id: string,
): MoveTarget | null {
	const found = findParentAndIndex(nodes, id);
	if (!found?.parent) return null;
	const parentLookup = findParentAndIndex(nodes, found.parent.id);
	if (!parentLookup?.parent) return null;
	return {
		newParentId: parentLookup.parent.id,
		position: parentLookup.index + 1,
	};
}
