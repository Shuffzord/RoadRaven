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

const { loadFileMock, newFileMock } = vi.hoisted(() => ({
	loadFileMock: vi.fn(),
	newFileMock: vi.fn(),
}));

vi.mock("../../../src/mainview/rpc", () => ({
	electroview: {
		rpc: {
			request: { loadFile: loadFileMock, newFile: newFileMock },
		},
	},
}));

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

// Isolated dispatcher suites intentionally reset the same singleton stores.
// fallow-ignore-next-line code-duplication
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

	it("creates all initial fields with one notification and one revision bump", async () => {
		const before = useRoadmapStore.getState();
		let notifications = 0;
		const unsubscribe = useRoadmapStore.subscribe(() => notifications++);
		const result = await handleAgentRequest("createNode", {
			parentId: "00000000-0000-0000-0000-000000000001",
			title: "Atomic child",
			status: "completed",
			type: "task",
			notes: "Ready",
			metadata: { owner: "alice" },
		});
		unsubscribe();

		expect(result.ok).toBe(true);
		const id = (result as { ok: true; data: { nodeId: string } }).data.nodeId;
		const after = useRoadmapStore.getState();
		expect(notifications).toBe(1);
		expect(after.agentRevision).toBe(before.agentRevision + 1);
		expect(after.schema?.revision).toBe((before.schema?.revision ?? 0) + 1);
		expect(after.nodeIndex.get(id)).toMatchObject({
			status: "completed",
			type: "task",
			notes: "Ready",
			metadata: { owner: "alice" },
		});
		expect(after.liveEventMeta[id]?.source).toBe("claude-code");
		expect(useEventLogStore.getState().rows[0]?.status).toBe("completed");
	});

	it("rejects an invalid create status before mutating", async () => {
		const before = useRoadmapStore.getState();
		const result = await handleAgentRequest("createNode", {
			parentId: "00000000-0000-0000-0000-000000000001",
			title: "Invalid child",
			status: "custom",
		});

		expect(result).toMatchObject({ ok: false, code: "invalid_status" });
		expect(useRoadmapStore.getState().nodeIndex.size).toBe(
			before.nodeIndex.size,
		);
		expect(useRoadmapStore.getState().agentRevision).toBe(before.agentRevision);
		expect(useEventLogStore.getState().rows).toHaveLength(0);
	});
});

// v0.8.1 test audit gap (2026-09-21) — the MCP-facing "one Fit to View":
// cameraFitView is viewport-only (no node target), so it dispatches through
// store.fitView() (the same roadraven:fit-view event TopBar and the canvas
// context menu use) rather than mutating the tree. This suite runs in the
// `node` test environment (no `window`), where fitView's own `typeof window`
// guard makes it a no-op on the camera — see roadmapStore.test.ts's "fitView
// is a no-op on the camera with no window to dispatch into" — so the
// dispatcher contract under test here is that cameraFitView CALLS
// store.fitView() and audits the call, not that a camera event actually
// fires (that is the Canvas.viewport.test.tsx / canvas-focus.spec.ts layer).
describe("agentRpcHandler — cameraFitView (v0.8.1 viewport tool)", () => {
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

	it("calls store.fitView() AND emits a drawer event with meta.tool='cameraFitView'", async () => {
		const fitViewSpy = vi.spyOn(useRoadmapStore.getState(), "fitView");

		const result = await handleAgentRequest("cameraFitView", {});

		expect(result).toEqual({ ok: true, data: { ok: true } });
		expect(fitViewSpy).toHaveBeenCalledTimes(1);
		const rows = useEventLogStore.getState().rows;
		expect(rows.length).toBe(1);
		expect(rows[0].source).toBe("claude-code");
		expect(rows[0].meta?.tool).toBe("cameraFitView");
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

// WR-09 (06-REVIEW): when no live-overlay entries exist, getRoadmap should
// short-circuit the per-node clone and return the in-store schema.nodes
// reference directly. mergeLiveStatus is documented as a no-op, so the
// tree clone was pure garbage on every call.
describe("agentRpcHandler — getRoadmap short-circuits when no live overlay (WR-09)", () => {
	beforeEach(() => {
		useRoadmapStore.getState().loadSchema(makeSchema(), "/tmp/test.json");
		useRoadmapStore.setState({ liveEventMeta: {} });
	});
	afterEach(() => {
		useRoadmapStore.setState({
			schema: null,
			filePath: null,
			nodeIndex: new Map(),
			liveEventMeta: {},
		});
	});

	it("returns schema.nodes by reference (no clone) when liveEventMeta is empty", async () => {
		const before = useRoadmapStore.getState().schema?.nodes;
		if (!before) throw new Error("fixture broken");
		const result = await handleAgentRequest("getRoadmap", {});
		expect(result.ok).toBe(true);
		const data = (
			result as {
				ok: true;
				data: { schema: { nodes: unknown } };
			}
		).data;
		// Reference equality proves no clone was performed.
		expect(data.schema.nodes).toBe(before);
	});

	it("DOES clone when liveEventMeta has entries (regression — overlay still works)", async () => {
		const before = useRoadmapStore.getState().schema?.nodes;
		if (!before) throw new Error("fixture broken");
		useRoadmapStore.setState({
			liveEventMeta: {
				"00000000-0000-0000-0000-000000000002": {
					lastEventAt: Date.now(),
					source: "ci",
				},
			},
		});
		const result = await handleAgentRequest("getRoadmap", {});
		const data = (
			result as {
				ok: true;
				data: { schema: { nodes: unknown[] } };
			}
		).data;
		// With overlay entries present, the result is a fresh tree.
		expect(data.schema.nodes).not.toBe(before);
		// And the structure is preserved (regression on the merged path).
		expect(data.schema.nodes.length).toBe(before.length);
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
// Isolated dispatcher suites intentionally reset the same singleton stores.
// fallow-ignore-next-line code-duplication
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
		// Validation happens before replacing the current document.
		expect(useRoadmapStore.getState().schema).toBeNull();
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
		loadFileMock.mockReset();
		newFileMock.mockReset();
		loadFileMock.mockResolvedValue({
			data: { version: "0.3", title: "T", statusConfig: [], nodes: [] },
			errors: [],
		});
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

	it("does not load when a new mutation lands while the pending save completes", async () => {
		vi.useFakeTimers();
		try {
			useRoadmapStore.setState({
				dataKey: "999",
				lastSavedDataKey: "0",
				saveState: "saving",
			} as never);
			vi.spyOn(useRoadmapStore.getState(), "triggerSave").mockImplementation(
				() => {
					useRoadmapStore.setState({
						saveState: "saved",
						lastSavedDataKey: "999",
					});
					useRoadmapStore
						.getState()
						.renameNode(
							"00000000-0000-0000-0000-000000000002",
							"Edited during save",
						);
				},
			);

			const promise = handleAgentRequest("openFile", {
				path: "/tmp/test/other.json",
			});
			await vi.advanceTimersByTimeAsync(5_001);
			const result = await promise;

			expect(result).toMatchObject({ ok: false, code: "autosave_timeout" });
			expect(loadFileMock).not.toHaveBeenCalled();
			expect(
				useRoadmapStore
					.getState()
					.nodeIndex.get("00000000-0000-0000-0000-000000000002")?.title,
			).toBe("Edited during save");
		} finally {
			vi.useRealTimers();
		}
	});

	it("keeps renderer edits and restores the old Bun binding after a mutation during load", async () => {
		let finishLoad: ((value: unknown) => void) | undefined;
		loadFileMock
			.mockImplementationOnce(
				() =>
					new Promise((resolve) => {
						finishLoad = resolve;
					}),
			)
			.mockResolvedValueOnce({ data: makeSchema(), errors: [] });

		const promise = handleAgentRequest("openFile", {
			path: "/tmp/test/other.json",
		});
		await vi.waitFor(() => expect(loadFileMock).toHaveBeenCalledTimes(1));
		useRoadmapStore
			.getState()
			.renameNode("00000000-0000-0000-0000-000000000002", "Edited during load");
		finishLoad?.({
			data: { version: "0.3", title: "Other", nodes: [] },
			errors: [],
		});
		const result = await promise;

		expect(result).toMatchObject({
			ok: false,
			code: "stale_write",
			data: { retry: true, backendBindingRestored: true },
		});
		expect(loadFileMock).toHaveBeenNthCalledWith(1, {
			path: "/tmp/test/other.json",
		});
		expect(loadFileMock).toHaveBeenNthCalledWith(2, {
			path: "/tmp/test.json",
		});
		expect(useRoadmapStore.getState().filePath).toBe("/tmp/test.json");
		expect(
			useRoadmapStore
				.getState()
				.nodeIndex.get("00000000-0000-0000-0000-000000000002")?.title,
		).toBe("Edited during load");
	});

	it("serializes overlapping opens through renderer state application", async () => {
		let finishFirst: ((value: unknown) => void) | undefined;
		loadFileMock
			.mockImplementationOnce(
				() =>
					new Promise((resolve) => {
						finishFirst = resolve;
					}),
			)
			.mockResolvedValueOnce({
				data: { version: "1.0", title: "Second", nodes: [] },
				errors: [],
			});

		const first = handleAgentRequest("openFile", { path: "/tmp/first.json" });
		await vi.waitFor(() => expect(loadFileMock).toHaveBeenCalledTimes(1));
		const second = handleAgentRequest("openFile", { path: "/tmp/second.json" });
		await Promise.resolve();
		expect(loadFileMock).toHaveBeenCalledTimes(1);

		finishFirst?.({
			data: { version: "1.0", title: "First", nodes: [] },
			errors: [],
		});
		expect((await first).ok).toBe(true);
		expect((await second).ok).toBe(true);
		expect(loadFileMock).toHaveBeenNthCalledWith(2, {
			path: "/tmp/second.json",
		});
		expect(useRoadmapStore.getState().filePath).toBe("/tmp/second.json");
		expect(useRoadmapStore.getState().schema?.title).toBe("Second");
	});
});

// v0.7 CONC-01: optimistic concurrency. Writes carrying a stale
// expectedRevision must fail loudly with stale_write + data.currentRevision;
// a matching or omitted expectedRevision keeps pre-v0.7 behavior.
describe("agentRpcHandler — stale_write optimistic concurrency (CONC-01)", () => {
	beforeEach(() => {
		useRoadmapStore.getState().loadSchema(makeSchema(), "/tmp/test.json"); // revision 1
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

	it("rejects a write whose expectedRevision is stale with code='stale_write' and data.currentRevision; write does NOT land", async () => {
		const target = "00000000-0000-0000-0000-000000000002"; // Login flow
		const previous = useRoadmapStore.getState().agentRevision;
		// A user edit lands between the agent's read and its write.
		useRoadmapStore.getState().renameNode(target, "User renamed");
		const current = useRoadmapStore.getState().agentRevision;
		const result = await handleAgentRequest("updateNodeStatus", {
			nodeId: target,
			status: "completed",
			expectedRevision: previous,
		});
		expect(result.ok).toBe(false);
		const err = result as {
			ok: false;
			error: string;
			code: string;
			hint?: string;
			data?: { currentRevision: number };
		};
		expect(err.code).toBe("stale_write");
		expect(err.error).toBe("Roadmap changed since your last read.");
		expect(err.hint).toBe(
			"Call getRoadmap for the current revision and replay your change.",
		);
		expect(err.data?.currentRevision).toBe(current);
		// The stale write must NOT have landed.
		const node = useRoadmapStore.getState().nodeIndex.get(target);
		expect(node?.status).toBe("in-progress");
	});

	it("accepts a write whose expectedRevision matches the current revision", async () => {
		const current = useRoadmapStore.getState().agentRevision;
		const result = await handleAgentRequest("updateNodeStatus", {
			nodeId: "00000000-0000-0000-0000-000000000002",
			status: "completed",
			expectedRevision: current,
		});
		expect(result.ok).toBe(true);
	});

	it("accepts a write with no expectedRevision (pre-v0.7 last-writer-wins)", async () => {
		useRoadmapStore
			.getState()
			.renameNode("00000000-0000-0000-0000-000000000002", "User renamed");
		const result = await handleAgentRequest("updateNodeStatus", {
			nodeId: "00000000-0000-0000-0000-000000000002",
			status: "completed",
		});
		expect(result.ok).toBe(true);
	});

	it("returns invalid_status without mutating when called directly", async () => {
		const before = useRoadmapStore.getState();
		const result = await handleAgentRequest("updateNodeStatus", {
			nodeId: "00000000-0000-0000-0000-000000000002",
			status: "custom",
		});

		expect(result).toMatchObject({ ok: false, code: "invalid_status" });
		expect(
			useRoadmapStore
				.getState()
				.nodeIndex.get("00000000-0000-0000-0000-000000000002")?.status,
		).toBe("in-progress");
		expect(useRoadmapStore.getState().agentRevision).toBe(before.agentRevision);
	});

	it("getRoadmap and getNode responses include the current revision", async () => {
		const current = useRoadmapStore.getState().agentRevision;
		const r1 = await handleAgentRequest("getRoadmap", {});
		expect(r1.ok).toBe(true);
		expect((r1 as { ok: true; data: { revision: number } }).data.revision).toBe(
			current,
		);
		const r2 = await handleAgentRequest("getNode", {
			nodeId: "00000000-0000-0000-0000-000000000001",
		});
		expect(r2.ok).toBe(true);
		expect((r2 as { ok: true; data: { revision: number } }).data.revision).toBe(
			current,
		);
	});
});

// v0.7 Phase 4 — caller-supplied createNode id. Recovery/recreation keeps node
// identity stable so history/metadata continuity survives file churn.
// Isolated dispatcher suites intentionally reset the same singleton stores.
// fallow-ignore-next-line code-duplication
describe("agentRpcHandler — createNode caller-supplied id (v0.7 Phase 4)", () => {
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

	it("round-trips an exact caller-supplied UUID id", async () => {
		const id = "7c9e6679-7425-40de-944b-e07fc1f90ae7";
		const result = await handleAgentRequest("createNode", {
			parentId: "00000000-0000-0000-0000-000000000001",
			title: "Recreated node",
			id,
		});
		expect(result.ok).toBe(true);
		expect((result as { ok: true; data: { nodeId: string } }).data.nodeId).toBe(
			id,
		);
		const node = useRoadmapStore.getState().nodeIndex.get(id);
		expect(node?.title).toBe("Recreated node");
	});

	it("round-trips an exact caller-supplied slug id", async () => {
		const id = "phase-4.retry_1";
		const result = await handleAgentRequest("createNode", {
			parentId: "00000000-0000-0000-0000-000000000001",
			title: "Slug node",
			id,
		});
		expect(result.ok).toBe(true);
		expect((result as { ok: true; data: { nodeId: string } }).data.nodeId).toBe(
			id,
		);
		expect(useRoadmapStore.getState().nodeIndex.get(id)?.title).toBe(
			"Slug node",
		);
	});

	it("returns code='duplicate_id' when the id exists anywhere in the tree; nothing is created", async () => {
		const before = useRoadmapStore.getState().nodeIndex.size;
		const result = await handleAgentRequest("createNode", {
			parentId: "00000000-0000-0000-0000-000000000001",
			title: "Clone attempt",
			id: "00000000-0000-0000-0000-000000000002", // existing 'Login flow'
		});
		expect(result.ok).toBe(false);
		expect((result as { ok: false; code: string }).code).toBe("duplicate_id");
		expect(useRoadmapStore.getState().nodeIndex.size).toBe(before);
		// No drawer audit row on a rejected mutation.
		expect(useEventLogStore.getState().rows.length).toBe(0);
	});
});

// v0.7 Phase 4 — updateNodeNotes mode: "append" joins existing + "\n\n" + new;
// empty/absent existing notes → plain set; default stays REPLACE.
describe("agentRpcHandler — updateNodeNotes append mode (v0.7 Phase 4)", () => {
	const target = "00000000-0000-0000-0000-000000000002"; // Login flow (no notes)

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

	it("append preserves existing notes with a blank-line separator", async () => {
		useRoadmapStore.getState().updateNodeNotes(target, "first line");
		const result = await handleAgentRequest("updateNodeNotes", {
			nodeId: target,
			notes: "progress: done",
			mode: "append",
		});
		expect(result.ok).toBe(true);
		expect(useRoadmapStore.getState().nodeIndex.get(target)?.notes).toBe(
			"first line\n\nprogress: done",
		);
	});

	it("append to empty/absent notes sets the text plainly (no leading separator)", async () => {
		const result = await handleAgentRequest("updateNodeNotes", {
			nodeId: target,
			notes: "solo entry",
			mode: "append",
		});
		expect(result.ok).toBe(true);
		expect(useRoadmapStore.getState().nodeIndex.get(target)?.notes).toBe(
			"solo entry",
		);
	});

	it("default (no mode) still REPLACES the entire notes field", async () => {
		useRoadmapStore.getState().updateNodeNotes(target, "old content");
		const result = await handleAgentRequest("updateNodeNotes", {
			nodeId: target,
			notes: "clean slate",
		});
		expect(result.ok).toBe(true);
		expect(useRoadmapStore.getState().nodeIndex.get(target)?.notes).toBe(
			"clean slate",
		);
	});
});

// v0.7 Phase 4 dogfood fix — openFile must be SCHEMA_OPTIONAL. With no schema
// loaded (e.g. after a webview reload), the no_file_loaded hint says "call
// openFile(path)"; gating openFile itself behind the schema was a deadlock.
describe("agentRpcHandler — openFile dispatches with no schema loaded (v0.7 Phase 4)", () => {
	beforeEach(() => {
		useRoadmapStore.setState({
			schema: null,
			filePath: null,
			nodeIndex: new Map(),
		});
		useEventLogStore.setState({ rows: [] });
		loadFileMock.mockReset();
	});
	afterEach(() => {
		useRoadmapStore.setState({
			schema: null,
			filePath: null,
			nodeIndex: new Map(),
		});
		useEventLogStore.setState({ rows: [] });
		vi.restoreAllMocks();
	});

	it("reaches the openFile handler (NOT no_file_loaded) and skips the autosave flush when schema is null", async () => {
		// Dirty markers set: without the schema guard, the handler would wait on
		// an autosave that can never fire (triggerSave spy never settles).
		useRoadmapStore.setState({
			dataKey: "999",
			lastSavedDataKey: "0",
			saveState: "saving",
		} as never);
		const triggerSpy = vi
			.spyOn(useRoadmapStore.getState(), "triggerSave")
			.mockImplementation(() => {
				/* never settles — must not be called */
			});
		// The D-12 tests above spied this same store action; zustand's setState
		// copies the mock fn into later state objects, so spyOn returns the old
		// mock WITH its historical calls. Clear before acting.
		triggerSpy.mockClear();

		const loaded = makeSchema();
		loaded.title = "Recovered";
		loadFileMock.mockResolvedValue({
			data: loaded,
			errors: [],
			sidecarUpdates: [
				{
					nodeId: "00000000-0000-0000-0000-000000000003",
					status: "completed",
					lastEventAt: Date.now(),
					source: "ci",
				},
			],
		});

		const result = await handleAgentRequest("openFile", {
			path: "/tmp/test/recovered.json",
		});
		expect(result.ok).toBe(true);
		expect(
			(result as { ok: true; data: { filePath: string } }).data.filePath,
		).toBe("/tmp/test/recovered.json");
		expect(triggerSpy).not.toHaveBeenCalled();

		const roadmap = await handleAgentRequest("getRoadmap", {});
		const openFile = await handleAgentRequest("getOpenFile", {});
		expect(roadmap.ok).toBe(true);
		expect(openFile.ok).toBe(true);
		const roadmapData = (
			roadmap as {
				ok: true;
				data: { filePath: string; revision: number };
			}
		).data;
		const openFileData = (
			openFile as {
				ok: true;
				data: { filePath: string; nodeCount: number; title: string };
			}
		).data;
		expect(roadmapData.filePath).toBe("/tmp/test/recovered.json");
		expect(roadmapData.revision).toBe(useRoadmapStore.getState().agentRevision);
		expect(openFileData).toMatchObject({
			filePath: "/tmp/test/recovered.json",
			nodeCount: 3,
			title: "Recovered",
		});
		expect(
			useRoadmapStore
				.getState()
				.nodeIndex.get("00000000-0000-0000-0000-000000000003")?.status,
		).toBe("completed");
		expect(useEventLogStore.getState().rows).toHaveLength(1);
	});

	it("does not append an openFile audit event when Bun reports a load failure", async () => {
		loadFileMock.mockResolvedValue({
			data: null,
			errors: [{ path: "", message: "missing", code: "file_read_error" }],
		});

		const result = await handleAgentRequest("openFile", {
			path: "/tmp/test/missing.json",
		});

		expect(result).toMatchObject({ ok: false, code: "file_read_error" });
		expect(useRoadmapStore.getState().schema).toBeNull();
		expect(useEventLogStore.getState().rows).toHaveLength(0);
	});
});
