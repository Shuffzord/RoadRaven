/** @vitest-environment jsdom */
// v0.8.2 F4 — the recent-files list refetches whenever the open file changes.
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RoadmapSchema } from "../../../../../packages/core/src/schema";

const { loadSettingsMock } = vi.hoisted(() => ({
	loadSettingsMock: vi.fn(),
}));

vi.mock("../../../src/mainview/rpc", () => ({
	electroview: { rpc: { request: { loadSettings: loadSettingsMock } } },
}));

import { useRecentFiles } from "../../../src/mainview/hooks/useRecentFiles";
import { useRoadmapStore } from "../../../src/mainview/store/roadmapStore";
import { resetStore } from "../../helpers/resetStore";

const NODE_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const SCHEMA: RoadmapSchema = {
	version: "1.0",
	title: "T",
	nodes: [{ id: NODE_ID, title: "Root", status: "not-started" }],
};

beforeEach(() => {
	loadSettingsMock.mockReset();
	loadSettingsMock.mockResolvedValue({ settings: { recentFiles: [] } });
	resetStore();
});

afterEach(() => {
	cleanup();
	resetStore();
});

describe("useRecentFiles", () => {
	it("fetches on mount and again when filePath changes", async () => {
		loadSettingsMock.mockResolvedValueOnce({
			settings: { recentFiles: ["/tmp/a.json"] },
		});
		const { result } = renderHook(() => useRecentFiles());
		await vi.waitFor(() => expect(result.current).toEqual(["/tmp/a.json"]));
		expect(loadSettingsMock).toHaveBeenCalledTimes(1);

		loadSettingsMock.mockResolvedValueOnce({
			settings: { recentFiles: ["/tmp/b.json", "/tmp/a.json"] },
		});
		act(() => {
			useRoadmapStore.getState().loadSchema(SCHEMA, "/tmp/b.json");
		});
		await vi.waitFor(() =>
			expect(result.current).toEqual(["/tmp/b.json", "/tmp/a.json"]),
		);
		expect(loadSettingsMock).toHaveBeenCalledTimes(2);
	});

	it("ignores store traffic that leaves filePath alone", async () => {
		loadSettingsMock.mockResolvedValue({ settings: { recentFiles: [] } });
		renderHook(() => useRecentFiles());
		await vi.waitFor(() => expect(loadSettingsMock).toHaveBeenCalledTimes(1));

		act(() => {
			useRoadmapStore.getState().loadSchema(SCHEMA, null);
			useRoadmapStore.getState().addChild(NODE_ID);
		});
		await Promise.resolve();
		expect(loadSettingsMock).toHaveBeenCalledTimes(1);
	});
});
