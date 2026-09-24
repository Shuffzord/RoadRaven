// v0.8.4 Phase 5 extraction — findParentAndIndex was previously only tested
// indirectly (through roadmapStore's addChild/moveNode/etc. and
// treeEdits.test.ts's indentTarget/outdentTarget). These pin the pure lookup
// itself now that it lives in lib/treeWalk.ts, independent of the store.
import { describe, expect, it } from "vitest";
import type { RoadmapNode } from "../../../../../packages/core/src/schema";
import {
	findParentAndIndex,
	isDescendantOf,
} from "../../../src/mainview/lib/treeWalk";
import { buildNodeIndex } from "../../../src/mainview/store/roadmapStore";

// Root
//  ├─ A
//  │   └─ A1
//  └─ B
function makeNodes(): RoadmapNode[] {
	return [
		{
			id: "root",
			title: "Root",
			status: "not-started",
			children: [
				{
					id: "a",
					title: "A",
					status: "not-started",
					children: [{ id: "a1", title: "A1", status: "not-started" }],
				},
				{ id: "b", title: "B", status: "not-started" },
			],
		},
	];
}

describe("findParentAndIndex", () => {
	it("returns parent: null for a root-level node, with its index in the top-level array", () => {
		expect(findParentAndIndex(makeNodes(), "root")).toEqual({
			parent: null,
			parentArray: makeNodes(),
			index: 0,
		});
	});

	it("returns the owning parent node and index for a nested node", () => {
		const nodes = makeNodes();
		const root = nodes[0];
		const found = findParentAndIndex(nodes, "b");
		expect(found?.parent).toBe(root);
		expect(found?.index).toBe(1);
		expect(found?.parentArray).toBe(root.children);
	});

	it("finds a node nested two levels deep", () => {
		const nodes = makeNodes();
		const a = nodes[0].children?.[0];
		const found = findParentAndIndex(nodes, "a1");
		expect(found?.parent).toBe(a);
		expect(found?.index).toBe(0);
	});

	it("returns null when the id is not found", () => {
		expect(findParentAndIndex(makeNodes(), "missing")).toBeNull();
	});
});

// v0.8.4 Phase 8: the one cycle check (store moveNode, undo history, agent
// moveNode tool). Reflexive — a node is in its own subtree (CR-02).
describe("isDescendantOf", () => {
	const index = buildNodeIndex(makeNodes());

	it.each([
		["direct child", "root", "a", true],
		["deep descendant", "root", "a1", true],
		["self", "a", "a", true],
		["unrelated sibling branch", "b", "a1", false],
		["ancestor is not a descendant", "a1", "a", false],
		["unknown ancestor", "gone", "a", false],
	] as const)("%s", (_name, ancestorId, nodeId, expected) => {
		expect(isDescendantOf(index, ancestorId, nodeId)).toBe(expected);
	});
});
