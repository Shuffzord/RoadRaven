// Phase 4 Plan 04-03 Task 1 — real tests for roadmapStore.applyEventBatch.
// Sources: D-25, D-11 in 04-CONTEXT.md.

import { afterEach, describe, expect, it } from "vitest";
import type { RoadmapSchema } from "../../../../../packages/core/src/schema";
import { handleAgentRequest } from "../../../src/mainview/rpc/agentRpcHandler";
import {
	hasUnsavedEdits,
	useRoadmapStore,
} from "../../../src/mainview/store/roadmapStore";
import { resetStore } from "../../helpers/resetStore";

const TEST_SCHEMA: RoadmapSchema = {
	version: "1.0",
	title: "Batch Test",
	statusConfig: [
		{ id: "not-started", label: "Not Started" },
		{ id: "done", label: "Done" },
		{ id: "in-progress", label: "In Progress" },
	],
	nodes: [
		{ id: "a", title: "A", status: "not-started" },
		{ id: "b", title: "B", status: "not-started" },
		{ id: "c", title: "C", status: "not-started" },
		{ id: "d", title: "D", status: "not-started" },
		{ id: "e", title: "E", status: "not-started" },
	],
};

// Helper: load a fresh copy of the schema each time (prevents in-place mutation
// from one test leaking the node.status into the next).
function loadFresh() {
	useRoadmapStore
		.getState()
		.loadSchema(JSON.parse(JSON.stringify(TEST_SCHEMA)), "/test.json");
}

afterEach(() => {
	resetStore();
});

describe("roadmapStore.applyEventBatch", () => {
	it("applies 5 updates in one set() call — only one subscribe notification", () => {
		loadFresh();

		let calls = 0;
		const unsub = useRoadmapStore.subscribe(() => {
			calls++;
		});

		useRoadmapStore.getState().applyEventBatch([
			{ nodeId: "a", status: "done", lastEventAt: Date.now() },
			{ nodeId: "b", status: "done", lastEventAt: Date.now() },
			{ nodeId: "c", status: "done", lastEventAt: Date.now() },
			{ nodeId: "d", status: "done", lastEventAt: Date.now() },
			{ nodeId: "e", status: "done", lastEventAt: Date.now() },
		]);

		expect(calls).toBe(1);
		unsub();
	});

	it("does NOT increment dataKey", () => {
		loadFresh();
		const before = useRoadmapStore.getState().dataKey;

		useRoadmapStore
			.getState()
			.applyEventBatch([
				{ nodeId: "a", status: "done", lastEventAt: Date.now() },
			]);

		expect(useRoadmapStore.getState().dataKey).toBe(before);
	});

	it("increments statusTick exactly once per batch regardless of batch size", () => {
		loadFresh();
		const before = useRoadmapStore.getState();

		useRoadmapStore.getState().applyEventBatch([
			{ nodeId: "a", status: "done", lastEventAt: Date.now() },
			{ nodeId: "b", status: "done", lastEventAt: Date.now() },
			{ nodeId: "c", status: "done", lastEventAt: Date.now() },
		]);

		const after = useRoadmapStore.getState();
		expect(after.statusTick).toBe(before.statusTick + 1);
		expect(after.schema?.revision).toBe(1);
		expect(after.agentRevision).toBe(before.agentRevision + 1);
	});

	it("does not bump revisions when event statuses are all no-ops", () => {
		loadFresh();
		const before = useRoadmapStore.getState();
		expect(hasUnsavedEdits(before)).toBe(false);

		useRoadmapStore.getState().applyEventBatch([
			{
				nodeId: "a",
				status: "not-started",
				lastEventAt: Date.now(),
				source: "ci",
				meta: { run: 42 },
			},
		]);

		const after = useRoadmapStore.getState();
		expect(after.schema?.revision).toBe(before.schema?.revision);
		expect(after.agentRevision).toBe(before.agentRevision);
		expect(after.statusTick).toBe(before.statusTick);
		expect(hasUnsavedEdits(after)).toBe(false);
		expect(after.liveEventMeta.a?.meta).toEqual({ run: 42 });
	});

	it("status events invalidate old tokens and stale guarded writes are rejected", async () => {
		loadFresh();
		const oldToken = useRoadmapStore.getState().agentRevision;

		useRoadmapStore
			.getState()
			.applyEventBatch([
				{ nodeId: "a", status: "in-progress", lastEventAt: Date.now() },
			]);

		expect(useRoadmapStore.getState().agentRevision).toBe(oldToken + 1);
		const result = await handleAgentRequest("renameNode", {
			nodeId: "a",
			title: "Stale rename",
			expectedRevision: oldToken,
		});
		expect(result).toMatchObject({
			ok: false,
			code: "stale_write",
			data: { currentRevision: oldToken + 1 },
		});
		expect(useRoadmapStore.getState().nodeIndex.get("a")?.title).toBe("A");
	});

	it("mutates each node status in-place via nodeIndex", () => {
		loadFresh();

		useRoadmapStore.getState().applyEventBatch([
			{ nodeId: "a", status: "done", lastEventAt: Date.now() },
			{ nodeId: "b", status: "in-progress", lastEventAt: Date.now() },
		]);

		const idx = useRoadmapStore.getState().nodeIndex;
		expect(idx.get("a")?.status).toBe("done");
		expect(idx.get("b")?.status).toBe("in-progress");
		expect(idx.get("c")?.status).toBe("not-started");
	});

	it("populates liveEventMeta with lastEventAt, source, and meta", () => {
		loadFresh();
		const now = Date.now();

		useRoadmapStore.getState().applyEventBatch([
			{
				nodeId: "a",
				status: "done",
				lastEventAt: now,
				source: "claude-code",
				meta: { pr: 42 },
			},
		]);

		const meta = useRoadmapStore.getState().liveEventMeta;
		expect(meta.a).toBeDefined();
		expect(meta.a.lastEventAt).toBe(now);
		expect(meta.a.source).toBe("claude-code");
		expect(meta.a.meta).toEqual({ pr: 42 });
	});

	it("no-ops on empty batch — statusTick unchanged, subscribe not called", () => {
		loadFresh();
		const before = useRoadmapStore.getState().statusTick;

		let calls = 0;
		const unsub = useRoadmapStore.subscribe(() => {
			calls++;
		});

		useRoadmapStore.getState().applyEventBatch([]);

		expect(calls).toBe(0);
		expect(useRoadmapStore.getState().statusTick).toBe(before);
		unsub();
	});
});
