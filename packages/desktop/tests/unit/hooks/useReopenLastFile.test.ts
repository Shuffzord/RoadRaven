/** @vitest-environment jsdom */
// v0.8.2 A8 — reopen the most recent roadmap on launch.
import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RoadmapSchema } from "../../../../../packages/core/src/schema";

const { loadSettingsMock, openRecentMock } = vi.hoisted(() => ({
	loadSettingsMock: vi.fn(),
	openRecentMock: vi.fn(() => Promise.resolve()),
}));

vi.mock("../../../src/mainview/rpc", () => ({
	electroview: { rpc: { request: { loadSettings: loadSettingsMock } } },
}));
vi.mock("../../../src/mainview/hooks/useFileActions", () => ({
	openRecent: openRecentMock,
}));

import { useReopenLastFile } from "../../../src/mainview/hooks/useReopenLastFile";
import { useRoadmapStore } from "../../../src/mainview/store/roadmapStore";
import { resetStore } from "../../helpers/resetStore";

const NODE_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const SCHEMA: RoadmapSchema = {
	version: "1.0",
	title: "T",
	nodes: [{ id: NODE_ID, title: "Root", status: "not-started" }],
};

const flush = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
	vi.clearAllMocks();
	resetStore();
});

afterEach(() => {
	cleanup();
	resetStore();
});

describe("useReopenLastFile", () => {
	it("opens the first recent file when nothing is loaded", async () => {
		loadSettingsMock.mockResolvedValue({
			settings: { recentFiles: ["/tmp/last.json", "/tmp/older.json"] },
		});
		renderHook(() => useReopenLastFile());
		await flush();

		expect(openRecentMock).toHaveBeenCalledTimes(1);
		expect(openRecentMock).toHaveBeenCalledWith("/tmp/last.json");
	});

	it("does nothing when reopenLastFile is off", async () => {
		loadSettingsMock.mockResolvedValue({
			settings: { reopenLastFile: false, recentFiles: ["/tmp/last.json"] },
		});
		renderHook(() => useReopenLastFile());
		await flush();

		expect(openRecentMock).not.toHaveBeenCalled();
	});

	it("does nothing without recent files", async () => {
		loadSettingsMock.mockResolvedValue({ settings: { recentFiles: [] } });
		renderHook(() => useReopenLastFile());
		await flush();

		expect(openRecentMock).not.toHaveBeenCalled();
	});

	it("does not run when a document is already loaded", async () => {
		useRoadmapStore.getState().loadSchema(SCHEMA, "/tmp/open.json");
		loadSettingsMock.mockResolvedValue({
			settings: { recentFiles: ["/tmp/last.json"] },
		});
		renderHook(() => useReopenLastFile());
		await flush();

		expect(loadSettingsMock).not.toHaveBeenCalled();
		expect(openRecentMock).not.toHaveBeenCalled();
	});

	it("yields to a document that arrived while settings were loading", async () => {
		let resolve: (v: unknown) => void = () => undefined;
		loadSettingsMock.mockReturnValue(
			new Promise((r) => {
				resolve = r;
			}),
		);
		renderHook(() => useReopenLastFile());
		useRoadmapStore.getState().loadSchema(SCHEMA, "/tmp/launch-arg.json");
		resolve({ settings: { recentFiles: ["/tmp/last.json"] } });
		await flush();

		expect(openRecentMock).not.toHaveBeenCalled();
	});

	it("runs once per mount, not on re-render", async () => {
		loadSettingsMock.mockResolvedValue({
			settings: { recentFiles: ["/tmp/last.json"] },
		});
		const { rerender } = renderHook(() => useReopenLastFile());
		await flush();
		rerender();
		await flush();

		expect(loadSettingsMock).toHaveBeenCalledTimes(1);
		expect(openRecentMock).toHaveBeenCalledTimes(1);
	});
});
