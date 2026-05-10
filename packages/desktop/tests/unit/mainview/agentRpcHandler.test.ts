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

// WR-05 (06-REVIEW): drawer-audit meta.args must be truncated when payload
// exceeds the 2KB cap, so an agent (or malicious WS client) cannot pin ~1GB
// of metadata in the renderer via 1000 oversized updateNodeNotes calls.
describe("agentRpcHandler — drawer audit args truncation (WR-05)", () => {
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

	it("updateNodeNotes with a multi-KB notes payload is truncated in the drawer row (WR-05)", async () => {
		const bigNotes = "x".repeat(20_000); // 20KB raw
		const result = await handleAgentRequest("updateNodeNotes", {
			nodeId: "00000000-0000-0000-0000-000000000002",
			notes: bigNotes,
		});
		expect(result.ok).toBe(true);
		const row = useEventLogStore.getState().rows[0];
		expect(row).toBeDefined();
		const auditArgs = row.meta?.args as Record<string, unknown>;
		// notes string must NOT be present in full.
		expect(auditArgs.notes).not.toBe(bigNotes);
		// And the truncation marker must be set.
		expect(auditArgs._truncated).toBe(true);
		// Final serialized payload must be within the 2KB cap.
		const finalBytes = new TextEncoder().encode(
			JSON.stringify(auditArgs),
		).byteLength;
		expect(finalBytes).toBeLessThanOrEqual(2 * 1024);
	});

	it("small payloads pass through unchanged (no truncation false-positive)", async () => {
		const result = await handleAgentRequest("renameNode", {
			nodeId: "00000000-0000-0000-0000-000000000002",
			title: "Renamed",
		});
		expect(result.ok).toBe(true);
		const row = useEventLogStore.getState().rows[0];
		expect(row.meta?.args).toEqual({
			nodeId: "00000000-0000-0000-0000-000000000002",
			title: "Renamed",
		});
		expect(
			(row.meta?.args as { _truncated?: unknown })._truncated,
		).toBeUndefined();
	});
});

// CR-01 / CR-02 (06-REVIEW): moveNode(X, X) must be rejected with
// move_would_create_cycle, NOT silently delete X. Two layers must catch the
// case: (a) the explicit self-move short-circuit in the dispatcher, and (b)
// the reflexive `isDescendantOf(X, X) === true` (via `if (rootNodeId ===
// candidateId) return true`). This test exercises the dispatcher contract
// (the user-visible behaviour); the helper's reflexive contract is asserted
// indirectly because removing the explicit short-circuit would still leave
// this test passing as long as the helper stays reflexive.
describe("agentRpcHandler — moveNode self-move rejection (CR-01 / CR-02)", () => {
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

	it("returns code='move_would_create_cycle' when nodeId === newParentId; node is NOT deleted", async () => {
		const target = "00000000-0000-0000-0000-000000000002"; // Login flow
		const result = await handleAgentRequest("moveNode", {
			nodeId: target,
			newParentId: target,
		});
		expect(result.ok).toBe(false);
		const err = result as { ok: false; code: string; error: string };
		expect(err.code).toBe("move_would_create_cycle");
		// Critically: the node MUST still exist (CR-01 originally deleted it).
		const node = useRoadmapStore.getState().nodeIndex.get(target);
		expect(node).toBeDefined();
		expect(node?.title).toBe("Login flow");
		// And no drawer audit row should be emitted on a rejected mutation.
		expect(useEventLogStore.getState().rows.length).toBe(0);
	});

	// CR-02 reflexive coverage exercised through a strict-descendant scenario:
	// moveNode(parent, ownChild) used to be the ONLY case isDescendantOf
	// caught — moveNode(parent, parent) slipped past. This test pins the
	// reflexive form by moving the root onto itself, which can ONLY be
	// rejected when isDescendantOf(rootId, rootId) returns true.
	it("rejects moving the root onto itself (depends on reflexive isDescendantOf — CR-02)", async () => {
		const root = "00000000-0000-0000-0000-000000000001"; // Authentication
		const result = await handleAgentRequest("moveNode", {
			nodeId: root,
			newParentId: root,
		});
		expect(result.ok).toBe(false);
		const err = result as { ok: false; code: string };
		expect(err.code).toBe("move_would_create_cycle");
		// Children intact — none reparented as a side effect.
		const rootNode = useRoadmapStore.getState().nodeIndex.get(root);
		expect(rootNode?.children?.length).toBe(2);
	});
});

// WR-03 (06-REVIEW): createRoadmap must apply overrides through Zustand
// setState (immutable spread) so subscribers receive a state-change
// notification, AND Zod-validate statusConfig / typeConfig so malformed
// config entries don't slip through the unchecked `as` cast.
describe("agentRpcHandler — createRoadmap immutable update + Zod validation (WR-03)", () => {
	beforeEach(() => {
		useRoadmapStore.setState({
			schema: null,
			filePath: null,
			nodeIndex: new Map(),
		});
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

	it("applies title via setState (a Zustand subscriber sees the change)", async () => {
		const seen: Array<string | null> = [];
		const unsub = useRoadmapStore.subscribe((s) =>
			seen.push(s.schema?.title ?? null),
		);
		try {
			await handleAgentRequest("createRoadmap", {
				title: "Migration Roadmap",
			});
			// Subscriber must have observed at least one snapshot whose title
			// matches the override (proves setState ran, not direct mutation).
			expect(seen).toContain("Migration Roadmap");
		} finally {
			unsub();
		}
	});

	it("rejects statusConfig with missing required fields (id / label) — WR-03", async () => {
		const result = await handleAgentRequest("createRoadmap", {
			statusConfig: [{ id: "x" }], // missing label
		});
		expect(result.ok).toBe(false);
		const err = result as { ok: false; code: string };
		expect(err.code).toBe("invalid_input");
		// State is still post-newUntitledSchema; the old code would have
		// silently accepted the malformed config via the unchecked cast.
		const schema = useRoadmapStore.getState().schema;
		// statusConfig must NOT have been overwritten with the malformed value.
		expect(schema?.statusConfig?.[0]?.id).not.toBe("x");
	});

	it("accepts well-formed statusConfig + typeConfig (regression on the happy path)", async () => {
		const result = await handleAgentRequest("createRoadmap", {
			title: "T",
			statusConfig: [{ id: "open", label: "Open" }],
			typeConfig: [{ id: "task", label: "Task" }],
		});
		expect(result.ok).toBe(true);
		const schema = useRoadmapStore.getState().schema;
		expect(schema?.title).toBe("T");
		expect(schema?.statusConfig).toEqual([{ id: "open", label: "Open" }]);
		expect(schema?.typeConfig).toEqual([{ id: "task", label: "Task" }]);
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

	// WR-04 (06-REVIEW): autosave timeout must surface as a structured
	// `autosave_timeout` code, not the generic `internal_error` from the
	// outer catch in agentRequestHandler. The agent needs to distinguish
	// "previous file may not be saved" from any other internal failure.
	it("returns code='autosave_timeout' when autosave never lands within 5s (WR-04)", async () => {
		vi.useFakeTimers();
		try {
			useRoadmapStore.setState({
				dataKey: "999",
				lastSavedDataKey: "0",
				saveState: "saving",
			} as never);

			// triggerSave is a no-op so saveState stays 'saving' forever.
			vi.spyOn(useRoadmapStore.getState(), "triggerSave").mockImplementation(
				() => {
					/* never settles */
				},
			);

			const promise = handleAgentRequest("openFile", {
				path: "/tmp/test/other.json",
			});
			// Advance past the 5s timeout window.
			await vi.advanceTimersByTimeAsync(5_001);
			const result = await promise;
			expect(result.ok).toBe(false);
			const err = result as { ok: false; code: string; error: string };
			expect(err.code).toBe("autosave_timeout");
			expect(err.error.toLowerCase()).toContain("autosave");
		} finally {
			vi.useRealTimers();
		}
	});
});
