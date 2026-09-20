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

function persistedRevision(): number | undefined {
	return useRoadmapStore.getState().schema?.revision;
}

function agentRevision(): number {
	return useRoadmapStore.getState().agentRevision;
}

afterEach(() => {
	resetStore();
});

describe("loadSchema agent revision seeding (CONC-01)", () => {
	it("keeps a pre-v0.7 payload unchanged and creates a valid agent token", () => {
		useRoadmapStore.getState().loadSchema(makeTestSchema(), "/tmp/test.json");
		expect(persistedRevision()).toBeUndefined();
		expect(agentRevision()).toBe(1);
	});

	it("advances the agent token past the file revision without changing it", () => {
		useRoadmapStore.getState().loadSchema(makeTestSchema(5), "/tmp/test.json");
		expect(persistedRevision()).toBe(5);
		expect(agentRevision()).toBe(6);
	});

	it("external reload invalidates an old token without rewriting the loaded revision", () => {
		useRoadmapStore.getState().loadSchema(makeTestSchema(5), "/tmp/test.json");
		const oldToken = agentRevision();
		useRoadmapStore.getState().renameNode(ROOT_ID, "Renamed");
		// Reload a file carrying an OLDER revision (external edit that kept the
		// stale counter) — the agent token must still move forward.
		useRoadmapStore.getState().reloadSchema(makeTestSchema(2));
		expect(persistedRevision()).toBe(2);
		expect(agentRevision()).toBeGreaterThan(oldToken);
		expect(agentRevision()).toBe(8);
	});

	it("new untitled roadmaps receive a valid agent token", () => {
		useRoadmapStore.getState().newUntitledSchema();
		expect(agentRevision()).toBeGreaterThan(0);
	});
});

describe("revision bumps on agent-visible mutations (CONC-01)", () => {
	beforeEach(() => {
		useRoadmapStore.getState().loadSchema(makeTestSchema(), "/tmp/test.json"); // revision 1
	});

	it("structural mutations bump: addChild, renameNode, moveNode, deleteNode", () => {
		useRoadmapStore.getState().addChild(CHILD_A_ID, "New");
		expect(agentRevision()).toBe(2);
		useRoadmapStore.getState().renameNode(CHILD_A_ID, "Renamed");
		expect(agentRevision()).toBe(3);
		useRoadmapStore.getState().moveNode(CHILD_B_ID, CHILD_A_ID);
		expect(agentRevision()).toBe(4);
		useRoadmapStore.getState().deleteNode(CHILD_B_ID);
		expect(agentRevision()).toBe(5);
		expect(persistedRevision()).toBe(4);
	});

	it("in-place mutations bump: status, type, metadata, notes", () => {
		const s = useRoadmapStore.getState();
		s.updateNodeStatus(CHILD_A_ID, "in-progress");
		expect(agentRevision()).toBe(2);
		s.updateNodeType(CHILD_A_ID, "task");
		expect(agentRevision()).toBe(3);
		s.updateNodeMetadata(CHILD_A_ID, { owner: "alice" });
		expect(agentRevision()).toBe(4);
		s.updateNodeNotes(CHILD_A_ID, "notes");
		expect(agentRevision()).toBe(5);
		expect(persistedRevision()).toBe(4);
	});

	it("no-op in-place update does NOT bump (same status short-circuits)", () => {
		useRoadmapStore.getState().updateNodeStatus(CHILD_A_ID, "not-started");
		expect(agentRevision()).toBe(1);
		expect(persistedRevision()).toBeUndefined();
	});

	it("a mutation persists one revision and advances the agent token once", () => {
		useRoadmapStore.getState().renameNode(CHILD_A_ID, "Renamed");
		expect(persistedRevision()).toBe(1);
		expect(agentRevision()).toBe(2);
	});

	it("publishes a new schema without mutating the subscriber's previous snapshot", () => {
		const before = useRoadmapStore.getState();
		const beforeSchema = before.schema;
		const beforeNodes = before.schema?.nodes;
		const beforeTreeData = before.treeData;
		let observed: { next: typeof before; previous: typeof before } | undefined;
		const unsubscribe = useRoadmapStore.subscribe((next, previous) => {
			observed = { next, previous };
		});

		useRoadmapStore.getState().updateNodeStatus(CHILD_A_ID, "in-progress");
		unsubscribe();

		expect(observed?.previous.schema).toBe(beforeSchema);
		expect(observed?.previous.schema?.revision).toBeUndefined();
		expect(observed?.next.schema).not.toBe(beforeSchema);
		expect(observed?.next.schema?.revision).toBe(1);
		expect(observed?.next.schema?.nodes).toBe(beforeNodes);
		expect(observed?.next.treeData).toBe(beforeTreeData);
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
		expect(agentRevision()).toBe(2);
		expect(persistedRevision()).toBe(1);
	});
});
