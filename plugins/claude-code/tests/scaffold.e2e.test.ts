// Phase 6 — connectivity check. ONE test. Drives the renderer dispatcher
// (handleAgentRequest in agentRpcHandler.ts) directly via dynamic import so the
// fixture works without a desktop process or real WebSocket.
//
// This is intentionally NOT a per-tool E2E — the unit tests in 06-01..06-04
// already prove correctness for each layer. This single test asserts that all
// Phase 6 layers wire together: schema bootstrap → multi-step tree assembly →
// drawer audit grew per call → triggerSave was invoked.
//
// Cross-workspace import: this test file lives in plugins/claude-code/tests but
// imports from packages/desktop/src/mainview/... — both workspaces use vitest 4.x
// with the project's pinned bun runtime, so the relative-path import resolves
// without additional config.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("Phase 6 scaffold story (connectivity check)", () => {
	beforeEach(async () => {
		// Stub triggerSave — in vitest there is no Bun process to receive the
		// electroview.rpc.request.saveFile IPC call. Override with a no-op so the
		// saveFile branch in handleAgentRequest can complete without a real save.
		const { useRoadmapStore } = await import(
			"../../../packages/desktop/src/mainview/store/roadmapStore"
		);
		const noopTriggerSave = (): void => {
			/* no-op — vitest has no Bun process to receive the IPC saveFile call */
		};
		vi.spyOn(useRoadmapStore.getState(), "triggerSave").mockImplementation(
			noopTriggerSave,
		);
		// Belt-and-suspenders: also patch the action on the store state so a fresh
		// getState() call after a setState resolves to the no-op too.
		useRoadmapStore.setState({ triggerSave: noopTriggerSave });
	});

	afterEach(async () => {
		const { useRoadmapStore } = await import(
			"../../../packages/desktop/src/mainview/store/roadmapStore"
		);
		const { useEventLogStore } = await import(
			"../../../packages/desktop/src/mainview/store/eventLogStore"
		);
		useRoadmapStore.setState({
			schema: null,
			filePath: null,
			nodeIndex: new Map(),
		});
		useEventLogStore.setState({ rows: [] });
		vi.restoreAllMocks();
	});

	it("createRoadmap → 5 createNode → saveFile assembles a tree, audit drawer shows 7 events", async () => {
		const { handleAgentRequest } = await import(
			"../../../packages/desktop/src/mainview/rpc/agentRpcHandler"
		);
		const { useRoadmapStore } = await import(
			"../../../packages/desktop/src/mainview/store/roadmapStore"
		);
		const { useEventLogStore } = await import(
			"../../../packages/desktop/src/mainview/store/eventLogStore"
		);

		// 1. createRoadmap (no schema → goes through SCHEMA_OPTIONAL branch)
		const r1 = await handleAgentRequest("createRoadmap", {
			title: "Service X migration",
		});
		expect(r1.ok).toBe(true);

		// biome-ignore lint/style/noNonNullAssertion: createRoadmap success guarantees schema
		const schema = useRoadmapStore.getState().schema!;
		expect(schema).toBeTruthy();
		const rootId = schema.nodes[0].id;

		// 2. five createNode calls under the root
		const ids: string[] = [];
		for (const title of [
			"Discovery",
			"Schema migration",
			"Smoke tests",
			"Deploy",
			"Cutover",
		]) {
			const r = await handleAgentRequest("createNode", {
				parentId: rootId,
				title,
			});
			expect(r.ok).toBe(true);
			const data = (r as { ok: true; data: { nodeId: string } }).data;
			ids.push(data.nodeId);
		}

		// 3. saveFile (triggers Phase 3 autosave flush — stubbed in beforeEach)
		const r2 = await handleAgentRequest("saveFile", {});
		expect(r2.ok).toBe(true);

		// Tree assertions
		const post = useRoadmapStore.getState();
		expect(post.nodeIndex.size).toBeGreaterThanOrEqual(6); // root + 5 children
		// biome-ignore lint/style/noNonNullAssertion: post-createRoadmap schema is guaranteed
		const root = post.schema!.nodes[0];
		expect(root.children?.length).toBe(5);

		// Drawer audit assertions: 7 mutating events (createRoadmap + 5 createNode + saveFile)
		const rows = useEventLogStore.getState().rows;
		expect(rows.length).toBe(7);
		expect(rows.every((r) => r.source === "claude-code")).toBe(true);
		const tools = rows.map((r) => r.meta?.tool);
		expect(tools).toEqual([
			"createRoadmap",
			"createNode",
			"createNode",
			"createNode",
			"createNode",
			"createNode",
			"saveFile",
		]);
	});
});
