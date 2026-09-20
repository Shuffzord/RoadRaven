/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RoadmapSchema } from "../../../../../packages/core/src/schema";

const { loadFileMock } = vi.hoisted(() => ({ loadFileMock: vi.fn() }));

vi.mock("../../../src/mainview/rpc", () => ({
	electroview: {
		rpc: { request: { loadFile: loadFileMock } },
	},
}));

import { handleExternalFileChange } from "../../../src/mainview/hooks/useFileActions";
import { useRoadmapStore } from "../../../src/mainview/store/roadmapStore";
import { resetStore } from "../../helpers/resetStore";

const NODE_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const CURRENT_PATH = "/tmp/current.json";

function schema(title: string): RoadmapSchema {
	return {
		version: "1.0",
		title,
		nodes: [{ id: NODE_ID, title: "Root", status: "not-started" }],
	};
}

beforeEach(() => {
	resetStore();
	loadFileMock.mockReset();
	useRoadmapStore.getState().loadSchema(schema("Current"), CURRENT_PATH);
});

afterEach(() => {
	resetStore();
});

describe("handleExternalFileChange serialization", () => {
	it("preserves an edit made while the reload RPC is pending", async () => {
		let finishLoad: ((value: unknown) => void) | undefined;
		loadFileMock.mockImplementation(
			() =>
				new Promise((resolve) => {
					finishLoad = resolve;
				}),
		);

		const reload = handleExternalFileChange({ path: CURRENT_PATH });
		await vi.waitFor(() => expect(loadFileMock).toHaveBeenCalledTimes(1));
		useRoadmapStore.getState().renameNode(NODE_ID, "Edited during reload");
		finishLoad?.({ data: schema("Reloaded"), errors: [] });
		await reload;

		expect(useRoadmapStore.getState().schema?.title).toBe("Current");
		expect(useRoadmapStore.getState().nodeIndex.get(NODE_ID)?.title).toBe(
			"Edited during reload",
		);
		expect(useRoadmapStore.getState().externalEditPending?.path).toBe(
			CURRENT_PATH,
		);
	});

	it("ignores a delayed watcher event from a previously open roadmap", async () => {
		await handleExternalFileChange({ path: "/tmp/previous.json" });

		expect(loadFileMock).not.toHaveBeenCalled();
		expect(useRoadmapStore.getState().filePath).toBe(CURRENT_PATH);
	});

	it("reloads the current main roadmap when a referenced file changes", async () => {
		loadFileMock.mockResolvedValue({
			data: schema("Reloaded refs"),
			errors: [],
		});

		await handleExternalFileChange({
			path: "/tmp/topics/topic.json",
			mainPath: CURRENT_PATH,
		});

		expect(loadFileMock).toHaveBeenCalledWith({ path: CURRENT_PATH });
		expect(useRoadmapStore.getState().schema?.title).toBe("Reloaded refs");
	});
});
