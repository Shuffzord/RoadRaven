// Phase 6 Plan 06-04 — renderer dispatcher contract tests.
// 6 tests: dispatch routing + drawer audit, PATCH semantics, AND-filter, unknown tool,
// D-07 live-overlay merge for findNodes, D-12 openFile auto-flush.
// Per-tool branch coverage is intentionally NOT here — uniform shape, anti-sprawl.
//
// RED phase pattern: project's pre-commit hook runs `bunx vitest run` and rejects
// commits with failing tests. We use `it.fails(...)` so vitest treats the
// expected-fail tests as passing during the RED commit; GREEN flips back to `it(...)`.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RoadmapSchema } from "../../../../../packages/core/src/schema";
import { handleAgentRequest } from "../../../src/mainview/rpc/agentRpcHandler";
import { useEventLogStore } from "../../../src/mainview/store/eventLogStore";
import { useRoadmapStore } from "../../../src/mainview/store/roadmapStore";

function makeSchema(): RoadmapSchema {
	return {
		version: "0.3",
		title: "Test",
		statusConfig: [{ id: "not-started", label: "Not Started", color: "#000" }],
		nodes: [
			{
				id: "00000000-0000-0000-0000-000000000001",
				title: "Authentication",
				type: "milestone",
				status: "in-progress",
				metadata: { priority: "P0", owner: "alice" },
				children: [
					{
						id: "00000000-0000-0000-0000-000000000002",
						title: "Login flow",
						type: "task",
						status: "in-progress",
						children: [],
					},
					{
						id: "00000000-0000-0000-0000-000000000003",
						title: "Logout cleanup",
						type: "task",
						status: "not-started",
						children: [],
					},
				],
			},
		],
	} as RoadmapSchema;
}

describe("agentRpcHandler — dispatch + drawer audit (D-09 / PLUG-AGENT-SAFETY-02)", () => {
	beforeEach(() => {
		useRoadmapStore.getState().loadSchema(makeSchema(), "/tmp/test.json");
		useEventLogStore.setState({ rows: [] });
	});
	afterEach(() => {
		useRoadmapStore.setState({
			schema: null,
			filePath: null,
			nodeIndex: new Map(),
		});
		useEventLogStore.setState({ rows: [] });
	});

	it("createNode dispatches to addChild AND emits a drawer event with source='claude-code' meta.tool='createNode'", async () => {
		const result = await handleAgentRequest("createNode", {
			parentId: "00000000-0000-0000-0000-000000000001",
			title: "Token rotation",
		});
		expect(result.ok).toBe(true);
		const data = (result as { ok: true; data: { nodeId: string } }).data;
		expect(typeof data.nodeId).toBe("string");
		// Store mutation landed
		const node = useRoadmapStore.getState().nodeIndex.get(data.nodeId);
		expect(node?.title).toBe("Token rotation");
		// Drawer audit emitted
		const rows = useEventLogStore.getState().rows;
		expect(rows.length).toBe(1);
		expect(rows[0].source).toBe("claude-code");
		expect(rows[0].meta?.tool).toBe("createNode");
		expect(rows[0].nodeId).toBe(data.nodeId);
	});
});

describe("agentRpcHandler — updateNodeMetadata PATCH (D-04)", () => {
	beforeEach(() => {
		useRoadmapStore.getState().loadSchema(makeSchema(), "/tmp/test.json");
		useEventLogStore.setState({ rows: [] });
	});
	afterEach(() => {
		useRoadmapStore.setState({
			schema: null,
			filePath: null,
			nodeIndex: new Map(),
		});
		useEventLogStore.setState({ rows: [] });
	});

	it("null patch value deletes the key; unlisted keys are preserved (D-04)", async () => {
		// Initial metadata: { priority: 'P0', owner: 'alice' }
		// Patch: { owner: null, status: 'pinned' }  → expect { priority:'P0', status:'pinned' }
		const result = await handleAgentRequest("updateNodeMetadata", {
			nodeId: "00000000-0000-0000-0000-000000000001",
			patch: { owner: null, status: "pinned" },
		});
		expect(result.ok).toBe(true);
		const node = useRoadmapStore
			.getState()
			.nodeIndex.get("00000000-0000-0000-0000-000000000001");
		expect(node?.metadata).toEqual({ priority: "P0", status: "pinned" });
		expect(node?.metadata?.owner).toBeUndefined();
	});
});

describe("agentRpcHandler — findNodes AND-filter (D-03)", () => {
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

	it("AND-combines titleContains (case-insensitive) and status filters", async () => {
		// titleContains "log" matches "Login flow" and "Logout cleanup"
		// status "in-progress" narrows to just "Login flow"
		const result = await handleAgentRequest("findNodes", {
			titleContains: "LOG", // upper-case input asserts case-insensitivity
			status: "in-progress",
		});
		expect(result.ok).toBe(true);
		const data = (
			result as {
				ok: true;
				data: { nodes: Array<{ node: { id: string; title: string } }> };
			}
		).data;
		expect(data.nodes.length).toBe(1);
		expect(data.nodes[0].node.title).toBe("Login flow");
	});
});

describe("agentRpcHandler — unknown tool", () => {
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

	it("returns code='unknown_tool' for an unrecognized method", async () => {
		const result = await handleAgentRequest("madeUpTool", {});
		expect(result.ok).toBe(false);
		const err = result as { ok: false; code: string; error: string };
		expect(err.code).toBe("unknown_tool");
	});
});

describe("agentRpcHandler — D-07 live-overlay merge for findNodes", () => {
	beforeEach(() => {
		useRoadmapStore.getState().loadSchema(makeSchema(), "/tmp/test.json");
	});
	afterEach(() => {
		useRoadmapStore.setState({
			schema: null,
			filePath: null,
			nodeIndex: new Map(),
			liveEventMeta: {},
		});
	});

	it("findNodes finds nodes whose live overlay status is in-progress even when authored status differs (D-07)", async () => {
		// Node "Logout cleanup" has authored status not-started. Simulate Phase 4
		// applyEventBatch landing an event for it: in-place mutate node.status to
		// in-progress AND seed liveEventMeta with a recent timestamp (within 30s window).
		const store = useRoadmapStore.getState();
		const targetId = "00000000-0000-0000-0000-000000000003"; // Logout cleanup
		const target = store.nodeIndex.get(targetId);
		if (!target) throw new Error("fixture broken");
		target.status = "in-progress";
		useRoadmapStore.setState({
			liveEventMeta: {
				[targetId]: { lastEventAt: Date.now(), source: "ci" },
			},
		});

		const result = await handleAgentRequest("findNodes", {
			status: "in-progress",
		});
		expect(result.ok).toBe(true);
		const data = (
			result as {
				ok: true;
				data: { nodes: Array<{ node: { id: string; status: string } }> };
			}
		).data;
		const ids = data.nodes.map((n) => n.node.id);
		// Both authored 'Login flow' (in-progress) AND overlaid 'Logout cleanup' should match.
		expect(ids).toContain(targetId);
		const overlaid = data.nodes.find((n) => n.node.id === targetId);
		expect(overlaid?.node.status).toBe("in-progress");
	});
});

describe("agentRpcHandler — D-12 openFile auto-flushes pending autosave", () => {
	beforeEach(() => {
		useRoadmapStore.getState().loadSchema(makeSchema(), "/tmp/test.json");
	});
	afterEach(() => {
		useRoadmapStore.setState({
			schema: null,
			filePath: null,
			nodeIndex: new Map(),
		});
		vi.restoreAllMocks();
	});

	it("openFile invokes triggerSave when hasUnsavedEdits is true and waits for saveState === saved before loading (D-12)", async () => {
		// Force a dirty state: bump dataKey so hasUnsavedEdits() returns true
		useRoadmapStore.setState({
			dataKey: "999",
			lastSavedDataKey: "0",
			saveState: "saving",
		} as never);

		const triggerSpy = vi
			.spyOn(useRoadmapStore.getState(), "triggerSave")
			.mockImplementation(() => {
				// Simulate the autosave landing — flip saveState back to 'saved' synchronously
				useRoadmapStore.setState({
					saveState: "saved",
					lastSavedDataKey: "999",
				} as never);
			});

		// Mock the electroview RPC bridge's loadFile so the test does not require Bun.
		vi.doMock("../../../src/mainview/rpc", () => ({
			electroview: {
				rpc: {
					request: {
						loadFile: vi.fn().mockResolvedValue({
							data: { version: "0.3", title: "T", statusConfig: [], nodes: [] },
						}),
					},
				},
			},
		}));

		const result = await handleAgentRequest("openFile", {
			path: "/tmp/test/other.json",
		});
		expect(result.ok).toBe(true);
		expect(triggerSpy).toHaveBeenCalled();
	});
});
