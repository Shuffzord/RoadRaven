/** @vitest-environment jsdom */
// v0.8.2 D3 / F2 — OS window title follows the open document.
import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RoadmapSchema } from "../../../../../packages/core/src/schema";

const { setWindowTitleMock } = vi.hoisted(() => ({
	setWindowTitleMock: vi.fn(() => Promise.resolve(undefined)),
}));

vi.mock("../../../src/mainview/rpc", () => ({
	electroview: { rpc: { request: { setWindowTitle: setWindowTitleMock } } },
}));

import {
	useWindowTitle,
	windowTitleFor,
} from "../../../src/mainview/hooks/useWindowTitle";
import { useRoadmapStore } from "../../../src/mainview/store/roadmapStore";
import { resetStore } from "../../helpers/resetStore";

const NODE_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const SCHEMA: RoadmapSchema = {
	version: "1.0",
	title: "T",
	nodes: [{ id: NODE_ID, title: "Root", status: "not-started" }],
};

beforeEach(() => {
	resetStore();
	setWindowTitleMock.mockClear();
});

afterEach(() => {
	resetStore();
});

describe("windowTitleFor", () => {
	it("no schema → app name only", () => {
		expect(
			windowTitleFor({ schema: null, filePath: null, isUntitled: false }),
		).toBe("RoadRaven");
	});

	it("untitled → Untitled — RoadRaven", () => {
		expect(
			windowTitleFor({ schema: SCHEMA, filePath: null, isUntitled: true }),
		).toBe("Untitled — RoadRaven");
	});

	it("file-backed → basename — RoadRaven (either separator)", () => {
		expect(
			windowTitleFor({
				schema: SCHEMA,
				filePath: "C:\\work\\plans\\plan.json",
				isUntitled: false,
			}),
		).toBe("plan.json — RoadRaven");
		expect(
			windowTitleFor({
				schema: SCHEMA,
				filePath: "/home/u/plan.json",
				isUntitled: false,
			}),
		).toBe("plan.json — RoadRaven");
	});
});

describe("useWindowTitle", () => {
	it("pushes the title on mount and once per document change", () => {
		renderHook(() => useWindowTitle());
		expect(setWindowTitleMock).toHaveBeenCalledTimes(1);
		expect(setWindowTitleMock).toHaveBeenLastCalledWith({ title: "RoadRaven" });

		useRoadmapStore.getState().loadSchema(SCHEMA, "/tmp/plan.json");
		expect(setWindowTitleMock).toHaveBeenCalledTimes(2);
		expect(setWindowTitleMock).toHaveBeenLastCalledWith({
			title: "plan.json — RoadRaven",
		});

		// Edits and other store traffic do not re-send an unchanged title.
		useRoadmapStore.getState().addChild(NODE_ID);
		useRoadmapStore.getState().bumpLiveTick();
		expect(setWindowTitleMock).toHaveBeenCalledTimes(2);

		useRoadmapStore.getState().newUntitledSchema();
		expect(setWindowTitleMock).toHaveBeenCalledTimes(3);
		expect(setWindowTitleMock).toHaveBeenLastCalledWith({
			title: "Untitled — RoadRaven",
		});

		useRoadmapStore.getState().closeSchema();
		expect(setWindowTitleMock).toHaveBeenCalledTimes(4);
		expect(setWindowTitleMock).toHaveBeenLastCalledWith({ title: "RoadRaven" });
	});

	it("stops listening on unmount", () => {
		const { unmount } = renderHook(() => useWindowTitle());
		unmount();
		useRoadmapStore.getState().loadSchema(SCHEMA, "/tmp/plan.json");
		expect(setWindowTitleMock).toHaveBeenCalledTimes(1);
	});
});
