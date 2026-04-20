import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RoadmapSchema } from "../../../../../packages/core/src/schema";
import { useRoadmapStore } from "../../../src/mainview/store/roadmapStore";
import { resetStore } from "../../helpers/resetStore";

const ROOT_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const CHILD_A_ID = "11111111-2222-4333-8444-555555555555";
const CHILD_B_ID = "22222222-3333-4444-8555-666666666666";
const GRANDCHILD_ID = "33333333-4444-4555-8666-777777777777";
const GREAT_GRAND_ID = "44444444-5555-4666-8777-888888888888";

function makeTestSchema(): RoadmapSchema {
	return {
		version: "1.0",
		title: "Test Schema",
		nodes: [
			{
				id: ROOT_ID,
				title: "Root",
				status: "not-started",
				children: [
					{ id: CHILD_A_ID, title: "A", status: "not-started" },
					{
						id: CHILD_B_ID,
						title: "B",
						status: "not-started",
						children: [
							{
								id: GRANDCHILD_ID,
								title: "B1",
								status: "not-started",
								children: [
									{
										id: GREAT_GRAND_ID,
										title: "B1a",
										status: "not-started",
									},
								],
							},
						],
					},
				],
			},
		],
	};
}

function loadTestSchema(): void {
	useRoadmapStore.getState().loadSchema(makeTestSchema(), "/tmp/test.json");
}

afterEach(() => {
	resetStore();
	vi.restoreAllMocks();
});

describe("addChild", () => {
	beforeEach(() => loadTestSchema());

	it("creates a new RoadmapNode with fresh UUID, default title, appends to parent.children, bumps dataKey", () => {
		const before = useRoadmapStore.getState().dataKey;
		const newId = useRoadmapStore.getState().addChild(CHILD_A_ID);
		expect(newId).toBeTruthy();

		const state = useRoadmapStore.getState();
		expect(Number(state.dataKey)).toBe(Number(before) + 1);
		const child = state.nodeIndex.get(newId as string);
		expect(child).toBeDefined();
		expect(child?.title).toBe("Untitled");
		expect(child?.status).toBe("not-started");
		expect(child?.createdAt).toBeTruthy();
		expect(child?.updatedAt).toBeTruthy();

		const parent = state.nodeIndex.get(CHILD_A_ID);
		expect(parent?.children?.length).toBe(1);
		expect(parent?.children?.[0].id).toBe(newId);
	});

	it("returns null when parentId is unknown", () => {
		const before = useRoadmapStore.getState().dataKey;
		const result = useRoadmapStore.getState().addChild("nonexistent-id");
		expect(result).toBeNull();
		expect(useRoadmapStore.getState().dataKey).toBe(before);
	});

	it("accepts an optional title parameter", () => {
		const id = useRoadmapStore.getState().addChild(CHILD_A_ID, "Custom Title");
		const node = useRoadmapStore.getState().nodeIndex.get(id as string);
		expect(node?.title).toBe("Custom Title");
	});
});

describe("addSiblingAbove", () => {
	beforeEach(() => loadTestSchema());

	it("inserts a new node BEFORE the target in its parent's children and bumps dataKey", () => {
		const before = useRoadmapStore.getState().dataKey;
		const newId = useRoadmapStore.getState().addSiblingAbove(CHILD_B_ID);
		expect(newId).toBeTruthy();
		const state = useRoadmapStore.getState();
		expect(Number(state.dataKey)).toBe(Number(before) + 1);
		const root = state.nodeIndex.get(ROOT_ID);
		const ids = root?.children?.map((c) => c.id) ?? [];
		// Order: A, (new), B, ...
		expect(ids[1]).toBe(newId);
		expect(ids[2]).toBe(CHILD_B_ID);
	});

	it("on a root-level node inserts into schema.nodes at the index before target", () => {
		// Load schema with 2 roots
		const schema: RoadmapSchema = {
			version: "1.0",
			title: "Two-Root",
			nodes: [
				{ id: ROOT_ID, title: "Root1", status: "not-started" },
				{ id: CHILD_A_ID, title: "Root2", status: "not-started" },
			],
		};
		useRoadmapStore.getState().loadSchema(schema, "/tmp/two.json");
		const newId = useRoadmapStore.getState().addSiblingAbove(CHILD_A_ID);
		expect(newId).toBeTruthy();
		const ids = useRoadmapStore.getState().schema?.nodes.map((n) => n.id) ?? [];
		expect(ids[0]).toBe(ROOT_ID);
		expect(ids[1]).toBe(newId);
		expect(ids[2]).toBe(CHILD_A_ID);
	});
});

describe("addSiblingAbove vs addSiblingBelow", () => {
	beforeEach(() => loadTestSchema());

	it("produce distinct array positions when targeting the same middle sibling", () => {
		// Build a 3-sibling array [A, B, C] under ROOT so a middle target
		// (B) has both a left and right neighbor — this exposes the
		// 'above = index, below = index+1' difference most clearly.
		const SIB_C_ID = "55555555-6666-4777-8888-999999999999";
		const schema: RoadmapSchema = {
			version: "1.0",
			title: "Three Siblings",
			nodes: [
				{
					id: ROOT_ID,
					title: "Root",
					status: "not-started",
					children: [
						{ id: CHILD_A_ID, title: "A", status: "not-started" },
						{ id: CHILD_B_ID, title: "B", status: "not-started" },
						{ id: SIB_C_ID, title: "C", status: "not-started" },
					],
				},
			],
		};

		// addSiblingAbove(B) → [A, new, B, C]
		useRoadmapStore.getState().loadSchema(schema, "/tmp/above.json");
		const aboveId = useRoadmapStore.getState().addSiblingAbove(CHILD_B_ID);
		const aboveOrder = useRoadmapStore
			.getState()
			.nodeIndex.get(ROOT_ID)
			?.children?.map((c) => c.id);
		expect(aboveOrder).toEqual([CHILD_A_ID, aboveId, CHILD_B_ID, SIB_C_ID]);

		// Reload and addSiblingBelow(B) → [A, B, new, C]
		useRoadmapStore.getState().loadSchema(schema, "/tmp/below.json");
		const belowId = useRoadmapStore.getState().addSiblingBelow(CHILD_B_ID);
		const belowOrder = useRoadmapStore
			.getState()
			.nodeIndex.get(ROOT_ID)
			?.children?.map((c) => c.id);
		expect(belowOrder).toEqual([CHILD_A_ID, CHILD_B_ID, belowId, SIB_C_ID]);

		// Guard against regression to the same slot
		expect(aboveOrder?.indexOf(aboveId as string)).toBe(1);
		expect(belowOrder?.indexOf(belowId as string)).toBe(2);
	});
});

describe("addSiblingBelow", () => {
	beforeEach(() => loadTestSchema());

	it("inserts a new node AFTER the target in its parent's children and bumps dataKey", () => {
		const before = useRoadmapStore.getState().dataKey;
		const newId = useRoadmapStore.getState().addSiblingBelow(CHILD_A_ID);
		expect(newId).toBeTruthy();
		const state = useRoadmapStore.getState();
		expect(Number(state.dataKey)).toBe(Number(before) + 1);
		const root = state.nodeIndex.get(ROOT_ID);
		const ids = root?.children?.map((c) => c.id) ?? [];
		expect(ids[0]).toBe(CHILD_A_ID);
		expect(ids[1]).toBe(newId);
		expect(ids[2]).toBe(CHILD_B_ID);
	});

	it("on a root-level node inserts into schema.nodes at the index after target", () => {
		const schema: RoadmapSchema = {
			version: "1.0",
			title: "Two-Root",
			nodes: [
				{ id: ROOT_ID, title: "Root1", status: "not-started" },
				{ id: CHILD_A_ID, title: "Root2", status: "not-started" },
			],
		};
		useRoadmapStore.getState().loadSchema(schema, "/tmp/two.json");
		const newId = useRoadmapStore.getState().addSiblingBelow(ROOT_ID);
		expect(newId).toBeTruthy();
		const ids = useRoadmapStore.getState().schema?.nodes.map((n) => n.id) ?? [];
		expect(ids[0]).toBe(ROOT_ID);
		expect(ids[1]).toBe(newId);
		expect(ids[2]).toBe(CHILD_A_ID);
	});
});

describe("deleteNode", () => {
	beforeEach(() => loadTestSchema());

	it("removes a leaf node from parent.children and returns {deletedCount:1}", () => {
		const before = useRoadmapStore.getState().dataKey;
		const result = useRoadmapStore.getState().deleteNode(CHILD_A_ID);
		expect(result.deletedCount).toBe(1);
		const state = useRoadmapStore.getState();
		expect(Number(state.dataKey)).toBe(Number(before) + 1);
		expect(state.nodeIndex.has(CHILD_A_ID)).toBe(false);
		const root = state.nodeIndex.get(ROOT_ID);
		expect(root?.children?.find((c) => c.id === CHILD_A_ID)).toBeUndefined();
	});

	it("returns deletedCount equal to subtree size (including root) for non-leaf deletes", () => {
		// CHILD_B has B1 which has B1a -> 3 nodes total
		const result = useRoadmapStore.getState().deleteNode(CHILD_B_ID);
		expect(result.deletedCount).toBe(3);
	});

	it("is a no-op when attempting to delete the last remaining root node", () => {
		const schema: RoadmapSchema = {
			version: "1.0",
			title: "One-Root",
			nodes: [{ id: ROOT_ID, title: "Root", status: "not-started" }],
		};
		useRoadmapStore.getState().loadSchema(schema, "/tmp/one.json");
		const before = useRoadmapStore.getState().dataKey;
		const result = useRoadmapStore.getState().deleteNode(ROOT_ID);
		expect(result.deletedCount).toBe(0);
		expect(useRoadmapStore.getState().dataKey).toBe(before);
		expect(useRoadmapStore.getState().schema?.nodes.length).toBe(1);
	});

	it("clears selectedNodeId and focusedNodeId if they pointed at deleted node", () => {
		useRoadmapStore.getState().setSelectedNode(CHILD_A_ID);
		useRoadmapStore.getState().setFocusedNode(CHILD_A_ID);
		useRoadmapStore.getState().deleteNode(CHILD_A_ID);
		const state = useRoadmapStore.getState();
		expect(state.selectedNodeId).toBeNull();
		expect(state.focusedNodeId).toBeNull();
	});
});

describe("duplicateNode", () => {
	beforeEach(() => loadTestSchema());

	it("duplicates subtree structure and assigns FRESH uuids to EVERY descendant, inserted as sibling after source", () => {
		const before = useRoadmapStore.getState().dataKey;
		const newId = useRoadmapStore.getState().duplicateNode(CHILD_B_ID);
		expect(newId).toBeTruthy();
		expect(newId).not.toBe(CHILD_B_ID);
		const state = useRoadmapStore.getState();
		expect(Number(state.dataKey)).toBe(Number(before) + 1);

		// New duplicate inserted immediately after source
		const root = state.nodeIndex.get(ROOT_ID);
		const ids = root?.children?.map((c) => c.id) ?? [];
		const srcIdx = ids.indexOf(CHILD_B_ID);
		expect(ids[srcIdx + 1]).toBe(newId);

		// Every descendant has a fresh UUID (not equal to any existing)
		const dup = state.nodeIndex.get(newId as string);
		expect(dup).toBeDefined();
		const b1 = dup?.children?.[0];
		expect(b1?.id).not.toBe(GRANDCHILD_ID);
		const b1a = b1?.children?.[0];
		expect(b1a?.id).not.toBe(GREAT_GRAND_ID);

		// Structure preserved
		expect(dup?.title).toBe("B");
		expect(dup?.children?.length).toBe(1);
		expect(b1?.title).toBe("B1");
		expect(b1a?.title).toBe("B1a");
	});

	it("assigns new timestamps to duplicated root and its descendants", () => {
		const newId = useRoadmapStore.getState().duplicateNode(CHILD_B_ID);
		const state = useRoadmapStore.getState();
		const dup = state.nodeIndex.get(newId as string);
		expect(dup?.createdAt).toBeTruthy();
		expect(dup?.updatedAt).toBeTruthy();
		const b1 = dup?.children?.[0];
		expect(b1?.createdAt).toBeTruthy();
		expect(b1?.updatedAt).toBeTruthy();
	});
});

describe("moveNodeUp / moveNodeDown", () => {
	beforeEach(() => loadTestSchema());

	it("moveNodeUp swaps target with previous sibling, bumps dataKey, keeps nodeIndex reference unchanged", () => {
		const before = useRoadmapStore.getState().dataKey;
		const indexBefore = useRoadmapStore.getState().nodeIndex;
		useRoadmapStore.getState().moveNodeUp(CHILD_B_ID);
		const state = useRoadmapStore.getState();
		expect(Number(state.dataKey)).toBe(Number(before) + 1);
		// Same Map instance — tests assert identity
		expect(state.nodeIndex).toBe(indexBefore);
		const root = state.nodeIndex.get(ROOT_ID);
		const ids = root?.children?.map((c) => c.id) ?? [];
		expect(ids[0]).toBe(CHILD_B_ID);
		expect(ids[1]).toBe(CHILD_A_ID);
	});

	it("moveNodeUp on first child is a no-op (no dataKey bump)", () => {
		const before = useRoadmapStore.getState().dataKey;
		useRoadmapStore.getState().moveNodeUp(CHILD_A_ID);
		expect(useRoadmapStore.getState().dataKey).toBe(before);
	});

	it("moveNodeDown on last child is a no-op", () => {
		const before = useRoadmapStore.getState().dataKey;
		useRoadmapStore.getState().moveNodeDown(CHILD_B_ID);
		expect(useRoadmapStore.getState().dataKey).toBe(before);
	});
});

describe("renameNode", () => {
	beforeEach(() => loadTestSchema());

	it("updates title in nodeIndex, rebuilds treeData, bumps dataKey, sets updatedAt", () => {
		const before = useRoadmapStore.getState().dataKey;
		useRoadmapStore.getState().renameNode(CHILD_A_ID, "Renamed");
		const state = useRoadmapStore.getState();
		expect(Number(state.dataKey)).toBe(Number(before) + 1);
		expect(state.nodeIndex.get(CHILD_A_ID)?.title).toBe("Renamed");
		expect(state.nodeIndex.get(CHILD_A_ID)?.updatedAt).toBeTruthy();
	});

	it("does nothing when title is empty or whitespace-only", () => {
		const before = useRoadmapStore.getState().dataKey;
		useRoadmapStore.getState().renameNode(CHILD_A_ID, "   ");
		expect(useRoadmapStore.getState().dataKey).toBe(before);
		expect(useRoadmapStore.getState().nodeIndex.get(CHILD_A_ID)?.title).toBe(
			"A",
		);
	});
});

describe("updateNodeType / updateNodeMetadata / updateNodeNotes (in-place)", () => {
	beforeEach(() => loadTestSchema());

	it("updateNodeType mutates in-place, does NOT bump dataKey, bumps statusTick", () => {
		const dataKeyBefore = useRoadmapStore.getState().dataKey;
		const tickBefore = useRoadmapStore.getState().statusTick;
		useRoadmapStore.getState().updateNodeType(CHILD_A_ID, "milestone");
		const state = useRoadmapStore.getState();
		expect(state.dataKey).toBe(dataKeyBefore);
		expect(state.statusTick).toBe(tickBefore + 1);
		expect(state.nodeIndex.get(CHILD_A_ID)?.type).toBe("milestone");
		expect(state.nodeIndex.get(CHILD_A_ID)?.updatedAt).toBeTruthy();
	});

	it("updateNodeMetadata mutates in-place, does NOT bump dataKey, bumps statusTick", () => {
		const dataKeyBefore = useRoadmapStore.getState().dataKey;
		const tickBefore = useRoadmapStore.getState().statusTick;
		useRoadmapStore
			.getState()
			.updateNodeMetadata(CHILD_A_ID, { priority: "high" });
		const state = useRoadmapStore.getState();
		expect(state.dataKey).toBe(dataKeyBefore);
		expect(state.statusTick).toBe(tickBefore + 1);
		expect(state.nodeIndex.get(CHILD_A_ID)?.metadata?.priority).toBe("high");
	});

	it("updateNodeNotes mutates in-place, does NOT bump dataKey, bumps statusTick", () => {
		const dataKeyBefore = useRoadmapStore.getState().dataKey;
		const tickBefore = useRoadmapStore.getState().statusTick;
		useRoadmapStore.getState().updateNodeNotes(CHILD_A_ID, "# Hello");
		const state = useRoadmapStore.getState();
		expect(state.dataKey).toBe(dataKeyBefore);
		expect(state.statusTick).toBe(tickBefore + 1);
		expect(state.nodeIndex.get(CHILD_A_ID)?.notes).toBe("# Hello");
	});
});

describe("dataKey discipline", () => {
	beforeEach(() => loadTestSchema());

	it("updateNodeStatus (existing) does NOT bump dataKey (regression guard)", () => {
		const before = useRoadmapStore.getState().dataKey;
		useRoadmapStore.getState().updateNodeStatus(CHILD_A_ID, "in-progress");
		expect(useRoadmapStore.getState().dataKey).toBe(before);
	});

	it("addChild ALWAYS bumps dataKey", () => {
		const before = useRoadmapStore.getState().dataKey;
		useRoadmapStore.getState().addChild(CHILD_A_ID);
		expect(Number(useRoadmapStore.getState().dataKey)).toBe(Number(before) + 1);
	});
});

describe("setFocusedNode", () => {
	beforeEach(() => loadTestSchema());

	it("sets focusedNodeId without touching selectedNodeId or dataKey", () => {
		useRoadmapStore.getState().setSelectedNode(ROOT_ID);
		const before = useRoadmapStore.getState().dataKey;
		useRoadmapStore.getState().setFocusedNode(CHILD_A_ID);
		const state = useRoadmapStore.getState();
		expect(state.focusedNodeId).toBe(CHILD_A_ID);
		expect(state.selectedNodeId).toBe(ROOT_ID);
		expect(state.dataKey).toBe(before);
	});

	it("setFocusedNode(null) clears it", () => {
		useRoadmapStore.getState().setFocusedNode(CHILD_A_ID);
		useRoadmapStore.getState().setFocusedNode(null);
		expect(useRoadmapStore.getState().focusedNodeId).toBeNull();
	});
});
