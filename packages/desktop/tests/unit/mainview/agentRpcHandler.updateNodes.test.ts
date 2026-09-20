// v0.7 Phase 2 — batch updateNodes contract tests.
// 4 tests: atomic apply + single revision bump, all-or-nothing rejection with
// per-item report, stale_write gate, 13-item replay in one call.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	type RoadmapSchema,
	RoadmapSchemaSchema,
} from "../../../../../packages/core/src/schema";
import { handleAgentRequest } from "../../../src/mainview/rpc/agentRpcHandler";
import { useEventLogStore } from "../../../src/mainview/store/eventLogStore";
import { useRoadmapStore } from "../../../src/mainview/store/roadmapStore";

const ROOT_ID = "00000000-0000-0000-0000-000000000000";

function childId(n: number): string {
	return `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
}

function makeSchema(childCount = 13): RoadmapSchema {
	return {
		version: "0.3",
		title: "Batch Test",
		statusConfig: [
			{ id: "not-started", label: "Not Started" },
			{ id: "in-progress", label: "In Progress" },
			{ id: "completed", label: "Completed" },
		],
		nodes: [
			{
				id: ROOT_ID,
				title: "Root",
				status: "not-started",
				children: Array.from({ length: childCount }, (_, i) => ({
					id: childId(i + 1),
					title: `Task ${i + 1}`,
					status: "not-started",
					metadata: { seq: i + 1 },
					children: [],
				})),
			},
		],
	} as RoadmapSchema;
}

function revision(): number {
	return useRoadmapStore.getState().agentRevision;
}

describe("agentRpcHandler — updateNodes batch (v0.7 Phase 2)", () => {
	beforeEach(() => {
		useRoadmapStore.getState().loadSchema(makeSchema(), "/tmp/test.json"); // revision 1
		useEventLogStore.setState({ rows: [] });
	});
	afterEach(() => {
		useRoadmapStore.setState({
			schema: null,
			filePath: null,
			nodeIndex: new Map(),
			agentRevision: 0,
		});
		useEventLogStore.setState({ rows: [] });
	});

	it("applies a 3-item batch atomically with ONE revision bump and returns {updated, revision}", async () => {
		const statusTickBefore = useRoadmapStore.getState().statusTick;
		const result = await handleAgentRequest("updateNodes", {
			updates: [
				{ nodeId: childId(1), status: "in-progress" },
				{ nodeId: childId(2), notes: "batch notes" },
				// D-04 patch semantics: null deletes `seq`, adds `owner`
				{ nodeId: childId(3), metadata: { seq: null, owner: "alice" } },
			],
		});
		expect(result.ok).toBe(true);
		const data = (
			result as { ok: true; data: { updated: number; revision: number } }
		).data;
		expect(data.updated).toBe(3);
		expect(data.revision).toBe(2); // exactly one bump for the whole batch
		expect(revision()).toBe(2);
		expect(useRoadmapStore.getState().schema?.revision).toBe(1);
		expect(useRoadmapStore.getState().statusTick).toBe(statusTickBefore + 1);
		const idx = useRoadmapStore.getState().nodeIndex;
		expect(idx.get(childId(1))?.status).toBe("in-progress");
		expect(idx.get(childId(2))?.notes).toBe("batch notes");
		expect(idx.get(childId(3))?.metadata).toEqual({ owner: "alice" });
		// Drawer audit: one event per item, tool='updateNodes' (D-09)
		const rows = useEventLogStore.getState().rows;
		expect(rows.length).toBe(3);
		expect(rows.every((r) => r.meta?.tool === "updateNodes")).toBe(true);
	});

	it("applies repeated metadata patches for one node in input order with one revision bump", async () => {
		const result = await handleAgentRequest("updateNodes", {
			updates: [
				{ nodeId: childId(1), metadata: { owner: "alice" } },
				{ nodeId: childId(1), metadata: { reviewer: "bob" } },
			],
		});

		expect(result.ok).toBe(true);
		expect(
			useRoadmapStore.getState().nodeIndex.get(childId(1))?.metadata,
		).toEqual({ seq: 1, owner: "alice", reviewer: "bob" });
		expect(revision()).toBe(2);
	});

	it("does not resurrect a metadata key deleted by an earlier patch in the batch", async () => {
		const result = await handleAgentRequest("updateNodes", {
			updates: [
				{ nodeId: childId(1), metadata: { seq: null } },
				{ nodeId: childId(1), metadata: { owner: "alice" } },
			],
		});

		expect(result.ok).toBe(true);
		expect(
			useRoadmapStore.getState().nodeIndex.get(childId(1))?.metadata,
		).toEqual({ owner: "alice" });
		expect(revision()).toBe(2);
	});

	it("rejects the WHOLE batch with per-item failures when any item is invalid — nothing applied", async () => {
		const result = await handleAgentRequest("updateNodes", {
			updates: [
				{ nodeId: childId(1), status: "in-progress" },
				{ nodeId: "no-such-node", status: "completed" },
				{ nodeId: childId(2), status: "not-a-status" },
			],
		});
		expect(result.ok).toBe(false);
		const err = result as {
			ok: false;
			code: string;
			data?: {
				failures: Array<{ index: number; nodeId: string; code: string }>;
			};
		};
		expect(err.code).toBe("batch_validation_failed");
		expect(err.data?.failures).toEqual([
			{ index: 1, nodeId: "no-such-node", code: "node_not_found" },
			{ index: 2, nodeId: childId(2), code: "invalid_status" },
		]);
		// NOTHING applied — even the valid item 0 — and no revision bump
		const idx = useRoadmapStore.getState().nodeIndex;
		expect(idx.get(childId(1))?.status).toBe("not-started");
		expect(revision()).toBe(1);
		expect(useEventLogStore.getState().rows.length).toBe(0);
	});

	it("rejects a configured custom status without mutating state or poisoning save validation", async () => {
		useRoadmapStore.setState((state) => ({
			schema: state.schema
				? {
						...state.schema,
						statusConfig: [
							...(state.schema.statusConfig ?? []),
							{ id: "custom", label: "Custom" },
						],
					}
				: null,
		}));
		const stateBefore = useRoadmapStore.getState();
		const eventLogBefore = useEventLogStore.getState();

		const result = await handleAgentRequest("updateNodes", {
			updates: [
				{ nodeId: childId(1), notes: "must not land" },
				{ nodeId: childId(2), status: "custom" },
			],
		});

		expect(result.ok).toBe(false);
		expect(result).toMatchObject({
			code: "batch_validation_failed",
			data: {
				failures: [{ index: 1, nodeId: childId(2), code: "invalid_status" }],
			},
		});
		expect(useRoadmapStore.getState()).toBe(stateBefore);
		expect(useEventLogStore.getState()).toBe(eventLogBefore);
		expect(revision()).toBe(stateBefore.agentRevision);
		expect(RoadmapSchemaSchema.safeParse(stateBefore.schema).success).toBe(
			true,
		);
	});

	it("returns stale_write with data.currentRevision when expectedRevision mismatches", async () => {
		const result = await handleAgentRequest("updateNodes", {
			updates: [{ nodeId: childId(1), status: "in-progress" }],
			expectedRevision: 5, // store is at revision 1
		});
		expect(result.ok).toBe(false);
		const err = result as {
			ok: false;
			code: string;
			data?: { currentRevision: number };
		};
		expect(err.code).toBe("stale_write");
		expect(err.data?.currentRevision).toBe(1);
		expect(useRoadmapStore.getState().nodeIndex.get(childId(1))?.status).toBe(
			"not-started",
		);
		expect(revision()).toBe(1);
	});

	it("replays a 13-item status batch in ONE call (agent recovery scenario)", async () => {
		const updates = Array.from({ length: 13 }, (_, i) => ({
			nodeId: childId(i + 1),
			status: "completed",
		}));
		const result = await handleAgentRequest("updateNodes", {
			updates,
			expectedRevision: 1,
		});
		expect(result.ok).toBe(true);
		const data = (
			result as { ok: true; data: { updated: number; revision: number } }
		).data;
		expect(data.updated).toBe(13);
		expect(data.revision).toBe(2); // 13 items, still ONE bump
		const idx = useRoadmapStore.getState().nodeIndex;
		for (let i = 1; i <= 13; i++) {
			expect(idx.get(childId(i))?.status).toBe("completed");
		}
	});
});
