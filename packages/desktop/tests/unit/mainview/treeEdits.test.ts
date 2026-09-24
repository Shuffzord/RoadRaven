// v0.8.4 Phase 5 — pure indent/outdent target math. No store involved.
import { describe, expect, it } from "vitest";
import type { RoadmapNode } from "../../../../../packages/core/src/schema";
import {
	indentTarget,
	outdentTarget,
} from "../../../src/mainview/lib/treeEdits";

// Root
//  ├─ A
//  │   ├─ A1
//  │   ├─ A2
//  │   └─ A3
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
					children: [
						{ id: "a1", title: "A1", status: "not-started" },
						{ id: "a2", title: "A2", status: "not-started" },
						{ id: "a3", title: "A3", status: "not-started" },
					],
				},
				{ id: "b", title: "B", status: "not-started" },
			],
		},
	];
}

describe("indentTarget", () => {
	it("is null when the node has no previous sibling", () => {
		expect(indentTarget(makeNodes(), "a1")).toBeNull();
	});

	it("targets the previous sibling as last child when it has no children yet", () => {
		expect(indentTarget(makeNodes(), "a2")).toEqual({
			newParentId: "a1",
			position: 0,
		});
	});

	it("targets the previous sibling's existing children length (append at end)", () => {
		// "b"'s previous sibling is "a", which already has 3 children.
		expect(indentTarget(makeNodes(), "b")).toEqual({
			newParentId: "a",
			position: 3,
		});
	});

	it("is null for the sole root node (no previous sibling)", () => {
		expect(indentTarget(makeNodes(), "root")).toBeNull();
	});

	it("is null when the id is not found", () => {
		expect(indentTarget(makeNodes(), "missing")).toBeNull();
	});
});

describe("outdentTarget", () => {
	it("moves a middle child to right after its parent", () => {
		expect(outdentTarget(makeNodes(), "a2")).toEqual({
			newParentId: "root",
			position: 1,
		});
	});

	it("moves the LAST child to right after its parent, not one past (position check)", () => {
		expect(outdentTarget(makeNodes(), "a3")).toEqual({
			newParentId: "root",
			position: 1,
		});
	});

	it("is null when the node's parent is itself a root-level node", () => {
		expect(outdentTarget(makeNodes(), "a")).toBeNull();
	});

	it("is null when the id is not found", () => {
		expect(outdentTarget(makeNodes(), "missing")).toBeNull();
	});
});
