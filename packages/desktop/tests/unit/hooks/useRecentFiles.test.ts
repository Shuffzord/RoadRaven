/** @vitest-environment jsdom */
// v0.8.2 F4 — the recent-files list refetches whenever the open file changes,
// and (A4) whenever the renderer edits the list through useFileActions.ts.
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RoadmapSchema } from "../../../../../packages/core/src/schema";

const { loadSettingsMock, saveSettingsMock } = vi.hoisted(() => ({
	loadSettingsMock: vi.fn(),
	saveSettingsMock: vi.fn(),
}));

vi.mock("../../../src/mainview/rpc", () => ({
	electroview: {
		rpc: {
			request: {
				loadSettings: loadSettingsMock,
				saveSettings: saveSettingsMock,
			},
		},
	},
}));

import {
	clearRecentFiles,
	RECENT_FILES_CHANGED_EVENT,
	removeRecentFile,
} from "../../../src/mainview/hooks/useFileActions";
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
	saveSettingsMock.mockReset();
	saveSettingsMock.mockResolvedValue({ success: true });
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

describe("useRecentFiles — renderer-side edits (A4)", () => {
	it("refetches when the recent-files-changed event fires", async () => {
		renderHook(() => useRecentFiles());
		await vi.waitFor(() => expect(loadSettingsMock).toHaveBeenCalledTimes(1));

		act(() => {
			window.dispatchEvent(new Event(RECENT_FILES_CHANGED_EVENT));
		});
		await vi.waitFor(() => expect(loadSettingsMock).toHaveBeenCalledTimes(2));
	});

	it("stops listening once unmounted", async () => {
		const { unmount } = renderHook(() => useRecentFiles());
		await vi.waitFor(() => expect(loadSettingsMock).toHaveBeenCalledTimes(1));
		unmount();

		window.dispatchEvent(new Event(RECENT_FILES_CHANGED_EVENT));
		await Promise.resolve();
		expect(loadSettingsMock).toHaveBeenCalledTimes(1);
	});

	it("removeRecentFile drops one path and the mounted list follows", async () => {
		loadSettingsMock.mockResolvedValue({
			settings: { recentFiles: ["/tmp/a.json", "/tmp/b.json"] },
		});
		const { result } = renderHook(() => useRecentFiles());
		await vi.waitFor(() =>
			expect(result.current).toEqual(["/tmp/a.json", "/tmp/b.json"]),
		);

		// The helper reads the persisted list first; the hook's refetch that
		// follows the save sees the shortened one.
		loadSettingsMock
			.mockResolvedValueOnce({
				settings: { recentFiles: ["/tmp/a.json", "/tmp/b.json"] },
			})
			.mockResolvedValue({ settings: { recentFiles: ["/tmp/b.json"] } });
		await act(() => removeRecentFile("/tmp/a.json"));

		expect(saveSettingsMock).toHaveBeenCalledWith({
			settings: { recentFiles: ["/tmp/b.json"] },
		});
		await vi.waitFor(() => expect(result.current).toEqual(["/tmp/b.json"]));
	});

	it("clearRecentFiles saves an empty list without reading first", async () => {
		await clearRecentFiles();
		expect(loadSettingsMock).not.toHaveBeenCalled();
		expect(saveSettingsMock).toHaveBeenCalledWith({
			settings: { recentFiles: [] },
		});
	});
});
