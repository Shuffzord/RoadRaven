// v0.8.2 A3 — the agent's openFile / saveFileAs tools run the same
// module-level functions as the UI, so an agent-driven file switch updates
// filePath, linkedFiles and the Save As bookkeeping identically.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RoadmapSchema } from "../../../../../packages/core/src/schema";

const rpcMocks = vi.hoisted(() => ({
	loadFile: vi.fn(),
	newFile: vi.fn(),
	saveFileAs: vi.fn(),
}));

vi.mock("../../../src/mainview/rpc", () => ({
	electroview: { rpc: { request: rpcMocks } },
}));

import { handleAgentRequest } from "../../../src/mainview/rpc/agentRpcHandler";
import { useEventLogStore } from "../../../src/mainview/store/eventLogStore";
import { useRoadmapStore } from "../../../src/mainview/store/roadmapStore";
import { useToastStore } from "../../../src/mainview/store/toastStore";
import { resetStore } from "../../helpers/resetStore";

const NODE_ID = "00000000-0000-4000-8000-000000000001";

function schema(title: string): RoadmapSchema {
	return {
		version: "1.0",
		title,
		nodes: [{ id: NODE_ID, title: "Root", status: "not-started" }],
	};
}

beforeEach(() => {
	resetStore();
	useEventLogStore.setState({ rows: [] });
	useToastStore.setState({ toasts: [] });
	for (const mock of Object.values(rpcMocks)) mock.mockReset();
});

afterEach(() => {
	resetStore();
});

describe("agentRpcHandler — openFile via the shared load path", () => {
	it("records linkedFiles from the loadFile response and audits the open", async () => {
		rpcMocks.loadFile.mockResolvedValue({
			data: schema("Root"),
			filePath: "/tmp/root.json",
			linkedFiles: ["/tmp/part.json"],
			errors: [],
		});

		const result = await handleAgentRequest("openFile", {
			path: "/tmp/root.json",
		});

		expect(result).toMatchObject({
			ok: true,
			data: { filePath: "/tmp/root.json" },
		});
		const state = useRoadmapStore.getState();
		expect(state.filePath).toBe("/tmp/root.json");
		expect(state.linkedFiles).toEqual(["/tmp/part.json"]);
		expect(state.isUntitled).toBe(false);
		expect(useEventLogStore.getState().rows).toHaveLength(1);
	});
});

describe("agentRpcHandler — saveFileAs via the shared Save As", () => {
	it("seeds the dialog from the current file and updates the store on success", async () => {
		useRoadmapStore
			.getState()
			.loadSchema(schema("Root"), "/tmp/plans/root.json", ["/tmp/part.json"]);
		rpcMocks.saveFileAs.mockResolvedValue({
			filePath: "/tmp/plans/copy.json",
			linkedFilesNotCopied: ["/tmp/part.json"],
		});

		const result = await handleAgentRequest("saveFileAs", {});

		expect(result).toEqual({
			ok: true,
			data: { filePath: "/tmp/plans/copy.json" },
		});
		expect(rpcMocks.saveFileAs).toHaveBeenCalledWith(
			expect.objectContaining({
				defaultPath: "/tmp/plans",
				defaultName: "root.json",
			}),
		);
		const state = useRoadmapStore.getState();
		expect(state.filePath).toBe("/tmp/plans/copy.json");
		expect(state.linkedFiles).toEqual([]);
		expect(useToastStore.getState().toasts[0]?.type).toBe("file_info");
		expect(useEventLogStore.getState().rows).toHaveLength(1);
	});

	it("keeps the save_error contract when the user cancels", async () => {
		useRoadmapStore.getState().loadSchema(schema("Root"), "/tmp/root.json");
		rpcMocks.saveFileAs.mockResolvedValue({ filePath: null });

		const result = await handleAgentRequest("saveFileAs", {});

		expect(result).toMatchObject({ ok: false, code: "save_error" });
		expect(useRoadmapStore.getState().filePath).toBe("/tmp/root.json");
	});
});
