// v0.7 CONC-01 — revision counter contract tests.
// loadSchema seeding + one bump per agent-visible mutation. The stale_write
// enforcement path lives in tests/unit/mainview/agentRpcHandler.test.ts.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type {
	RoadmapNode,
	RoadmapSchema,
} from "../../../../../packages/core/src/schema";
import { useRoadmapStore } from "../../../src/mainview/store/roadmapStore";
import { resetStore } from "../../helpers/resetStore";

const ROOT_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const CHILD_A_ID = "11111111-2222-4333-8444-555555555555";
const CHILD_B_ID = "22222222-3333-4444-8555-666666666666";

function makeTestSchema(revision?: number): RoadmapSchema {
	return {
		version: "1.0",
		title: "Revision Test",
		...(revision !== undefined ? { revision } : {}),
		nodes: [
			{
				id: ROOT_ID,
				title: "Root",
				status: "not-started",
				children: [
					{ id: CHILD_A_ID, title: "A", status: "not-started" },
					{ id: CHILD_B_ID, title: "B", status: "not-started" },
				],
			},
		],
	};
}

function revision(): number | undefined {
	return useRoadmapStore.getState().schema?.revision;
}

afterEach(() => {
	resetStore();
});

describe("loadSchema revision seeding (CONC-01)", () => {
	it("loads a pre-v0.7 file (no revision field) as revision 1", () => {
		useRoadmapStore.getState().loadSchema(makeTestSchema(), "/tmp/test.json");
		expect(revision()).toBe(1);
	});

	it("advances past the file's revision on load (external-reload safety)", () => {
		useRoadmapStore.getState().loadSchema(makeTestSchema(5), "/tmp/test.json");
		expect(revision()).toBe(6);
	});

	it("never goes backwards past the in-memory revision on reload", () => {
		useRoadmapStore.getState().loadSchema(makeTestSchema(5), "/tmp/test.json"); // → 6
		useRoadmapStore.getState().renameNode(ROOT_ID, "Renamed"); // → 7
		// Reload a file carrying an OLDER revision (external edit that kept the
		// stale counter) — must still land above the in-memory value.
		useRoadmapStore.getState().loadSchema(makeTestSchema(2), "/tmp/test.json");
		expect(revision()).toBe(8);
	});
});

describe("revision bumps on agent-visible mutations (CONC-01)", () => {
	beforeEach(() => {
		useRoadmapStore.getState().loadSchema(makeTestSchema(), "/tmp/test.json"); // revision 1
	});

	it("structural mutations bump: addChild, renameNode, moveNode, deleteNode", () => {
		useRoadmapStore.getState().addChild(CHILD_A_ID, "New");
		expect(revision()).toBe(2);
		useRoadmapStore.getState().renameNode(CHILD_A_ID, "Renamed");
		expect(revision()).toBe(3);
		useRoadmapStore.getState().moveNode(CHILD_B_ID, CHILD_A_ID);
		expect(revision()).toBe(4);
		useRoadmapStore.getState().deleteNode(CHILD_B_ID);
		expect(revision()).toBe(5);
	});

	it("in-place mutations bump: status, type, metadata, notes", () => {
		const s = useRoadmapStore.getState();
		s.updateNodeStatus(CHILD_A_ID, "in-progress");
		expect(revision()).toBe(2);
		s.updateNodeType(CHILD_A_ID, "task");
		expect(revision()).toBe(3);
		s.updateNodeMetadata(CHILD_A_ID, { owner: "alice" });
		expect(revision()).toBe(4);
		s.updateNodeNotes(CHILD_A_ID, "notes");
		expect(revision()).toBe(5);
	});

	it("no-op in-place update does NOT bump (same status short-circuits)", () => {
		useRoadmapStore.getState().updateNodeStatus(CHILD_A_ID, "not-started");
		expect(revision()).toBe(1);
	});

	it("paste bumps via the structural chokepoint", async () => {
		const node = useRoadmapStore.getState().nodeIndex.get(CHILD_B_ID);
		expect(node).toBeDefined();
		// Seed the in-memory buffer directly — navigator.clipboard is not
		// available in the test env, and pasteFromClipboard falls back to it.
		useRoadmapStore.setState({
			lastCopiedSubtree: structuredClone(node as RoadmapNode),
		});
		const newId = await useRoadmapStore
			.getState()
			.pasteFromClipboard(CHILD_A_ID);
		expect(newId).toBeTruthy();
		expect(revision()).toBe(2);
	});
});
