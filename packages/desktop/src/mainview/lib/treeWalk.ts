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
