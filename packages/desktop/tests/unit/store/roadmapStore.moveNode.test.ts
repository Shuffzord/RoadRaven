// Phase 6 Plan 06-04 — moveNode store action tests.
// 3 tests: ordering, parent-not-found no-op, node-not-found no-op.
// Cycle detection lives in agentRpcHandler (architecture-tier map in PATTERNS.md);
// not asserted here.
//
// RED phase pattern: project's pre-commit hook runs `bunx vitest run` and rejects
// commits with failing tests. We use `it.fails(...)` so vitest treats the
// expected-fail tests as passing during the RED commit; GREEN flips back to `it(...)`.
// (Same pattern Plan 06-03 introduced — see STATE.md decisions.)
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { RoadmapSchema } from "../../../../../packages/core/src/schema";
import { useRoadmapStore } from "../../../src/mainview/store/roadmapStore";

function makeSchema(): RoadmapSchema {
	return {
		version: "0.3",
		title: "Test",
		statusConfig: [{ id: "not-started", label: "Not Started", color: "#000" }],
		nodes: [
			{
				id: "00000000-0000-0000-0000-000000000001",
				title: "Root A",
				type: "milestone",
				status: "not-started",
				children: [
					{
						id: "00000000-0000-0000-0000-000000000002",
						title: "Child A1",
						type: "task",
						status: "not-started",
						children: [],
					},
				],
			},
			{
				id: "00000000-0000-0000-0000-000000000003",
				title: "Root B",
				type: "milestone",
				status: "not-started",
				children: [
					{
						id: "00000000-0000-0000-0000-000000000004",
						title: "Child B1",
						type: "task",
						status: "not-started",
						children: [],
					},
				],
			},
		],
	} as RoadmapSchema;
}

describe("roadmapStore.moveNode (Phase 6 PLUG-AGENT-UPDATE-05)", () => {
	beforeEach(() => {
		useRoadmapStore.getState().loadSchema(makeSchema(), "/tmp/test.json");
	});
	afterEach(() => {
		useRoadmapStore.setState({
			schema: null,
			filePath: null,
			nodeIndex: new Map(),
		});
	});

	it("inserts at the given position when moving a node to a new parent", () => {
		// Move "Child A1" under "Root B" at position 0 (before Child B1)
		(
			useRoadmapStore.getState() as unknown as {
				moveNode: (a: string, b: string, c?: number) => void;
			}
		).moveNode(
			"00000000-0000-0000-0000-000000000002",
			"00000000-0000-0000-0000-000000000003",
			0,
		);
		const schema = useRoadmapStore.getState().schema!;
		const rootB = schema.nodes.find(
			(n) => n.id === "00000000-0000-0000-0000-000000000003",
		)!;
		expect(rootB.children!.length).toBe(2);
		expect(rootB.children![0].id).toBe("00000000-0000-0000-0000-000000000002");
		expect(rootB.children![1].id).toBe("00000000-0000-0000-0000-000000000004");
		// Original parent (Root A) should no longer have the child
		const rootA = schema.nodes.find(
			(n) => n.id === "00000000-0000-0000-0000-000000000001",
		)!;
		expect(rootA.children!.length).toBe(0);
	});

	it("is a no-op when newParentId does not exist", () => {
		const before = JSON.stringify(useRoadmapStore.getState().schema);
		(
			useRoadmapStore.getState() as unknown as {
				moveNode: (a: string, b: string, c?: number) => void;
			}
		).moveNode(
			"00000000-0000-0000-0000-000000000002",
			"ffffffff-ffff-ffff-ffff-ffffffffffff", // non-existent
		);
		const after = JSON.stringify(useRoadmapStore.getState().schema);
		expect(after).toBe(before);
		// In RED, moveNode is undefined — accessing it throws TypeError, which it.fails accepts.
		// We add an extra assertion that ALSO would fail in RED to be defensive about the
		// it.fails contract (vitest fails the it.fails block if NO assertion fails).
		expect(
			(useRoadmapStore.getState() as unknown as { moveNode: unknown }).moveNode,
		).toBeTypeOf("function");
	});

	it("is a no-op when nodeId does not exist", () => {
		const before = JSON.stringify(useRoadmapStore.getState().schema);
		(
			useRoadmapStore.getState() as unknown as {
				moveNode: (a: string, b: string, c?: number) => void;
			}
		).moveNode(
			"ffffffff-ffff-ffff-ffff-ffffffffffff", // non-existent
			"00000000-0000-0000-0000-000000000003",
		);
		const after = JSON.stringify(useRoadmapStore.getState().schema);
		expect(after).toBe(before);
		expect(
			(useRoadmapStore.getState() as unknown as { moveNode: unknown }).moveNode,
		).toBeTypeOf("function");
	});
});
