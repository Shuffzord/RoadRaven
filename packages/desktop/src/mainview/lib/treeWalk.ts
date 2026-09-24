/**
 * Pure tree-walking helpers shared by the store and the lib modules that
 * compute against a tree without mutating it (v0.8.4 Phase 5 extraction).
 *
 * Dependency-free besides the schema type: nothing here reaches a store,
 * `../rpc` or `electrobun/*`, so it can be imported from either side of the
 * store without creating a cycle.
 */

import type { RoadmapNode } from "../../../../../packages/core/src/schema";

export type ParentLookup = {
	parent: RoadmapNode | null;
	parentArray: RoadmapNode[];
	index: number;
};

/**
 * Locate a node's parent-array + index (or `null` if not found).
 * For root-level targets returns { parent: null, parentArray: nodes, index }.
 */
export function findParentAndIndex(
	nodes: RoadmapNode[],
	nodeId: string,
): ParentLookup | null {
	// Check root level first
	for (let i = 0; i < nodes.length; i++) {
		if (nodes[i].id === nodeId) {
			return { parent: null, parentArray: nodes, index: i };
		}
	}
	// Recurse into children
	function walk(list: RoadmapNode[]): ParentLookup | null {
		for (const node of list) {
			if (node.children) {
				for (let i = 0; i < node.children.length; i++) {
					if (node.children[i].id === nodeId) {
						return { parent: node, parentArray: node.children, index: i };
					}
				}
				const deeper = walk(node.children);
				if (deeper) return deeper;
			}
		}
		return null;
	}
	return walk(nodes);
}

/**
 * Whether `nodeId` is in the subtree rooted at `ancestorId`, INCLUDING the
 * ancestor itself (a node is in its own subtree — the reflexive form, CR-02
 * in 06-REVIEW.md: excluding the root once let `moveNode(X, X)` through and
 * deleted X). False when `ancestorId` is unknown. The one cycle check shared
 * by the store's `moveNode`, the undo history and the agent `moveNode` tool.
 */
export function isDescendantOf(
	nodeIndex: ReadonlyMap<string, RoadmapNode>,
	ancestorId: string,
	nodeId: string,
): boolean {
	if (ancestorId === nodeId) return true;
	const stack = [...(nodeIndex.get(ancestorId)?.children ?? [])];
	for (let n = stack.pop(); n; n = stack.pop()) {
		if (n.id === nodeId) return true;
		if (n.children) stack.push(...n.children);
	}
	return false;
}
