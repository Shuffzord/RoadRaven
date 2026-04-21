/** @vitest-environment jsdom */
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RoadmapSchema } from "../../../../../packages/core/src/schema";
import { useInlineRename } from "../../../src/mainview/hooks/useInlineRename";
import { useRoadmapStore } from "../../../src/mainview/store/roadmapStore";
import { resetStore } from "../../helpers/resetStore";

const NODE_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";

function loadSchema(): void {
	const schema: RoadmapSchema = {
		version: "1.0",
		title: "T",
		nodes: [{ id: NODE_ID, title: "Original", status: "not-started" }],
	};
	useRoadmapStore.getState().loadSchema(schema, "/tmp/t.json");
}

beforeEach(() => {
	vi.restoreAllMocks();
	vi.clearAllMocks();
	loadSchema();
});

afterEach(() => {
	resetStore();
	vi.restoreAllMocks();
});

describe("useInlineRename", () => {
	it("open() sets screenPos to localX*k + tx + rect.left, localY*k + ty + rect.top", () => {
		const { result } = renderHook(() => useInlineRename());
		act(() => {
			result.current.open(
				NODE_ID,
				100,
				50,
				{ x: 20, y: 10, k: 2 },
				{ left: 30, top: 40 },
			);
		});
		expect(result.current.state.screenPos?.x).toBe(100 * 2 + 20 + 30); // 250
		expect(result.current.state.screenPos?.y).toBe(50 * 2 + 10 + 40); // 150
		expect(result.current.state.nodeId).toBe(NODE_ID);
		expect(result.current.state.title).toBe("Original");
	});

	it("commit() with non-empty trimmed title calls renameNode and clears state", () => {
		const renameSpy = vi.spyOn(useRoadmapStore.getState(), "renameNode");
		const { result } = renderHook(() => useInlineRename());
		act(() => {
			result.current.open(
				NODE_ID,
				0,
				0,
				{ x: 0, y: 0, k: 1 },
				{ left: 0, top: 0 },
			);
			result.current.setTitle("  New Title  ");
		});
		act(() => {
			result.current.commit();
		});
		expect(renameSpy).toHaveBeenCalledWith(NODE_ID, "New Title");
		expect(result.current.state.nodeId).toBeNull();
	});

	it("commit() with empty title does NOT call renameNode", () => {
		const renameSpy = vi.spyOn(useRoadmapStore.getState(), "renameNode");
		const { result } = renderHook(() => useInlineRename());
		act(() => {
			result.current.open(
				NODE_ID,
				0,
				0,
				{ x: 0, y: 0, k: 1 },
				{ left: 0, top: 0 },
			);
			result.current.setTitle("   ");
		});
		act(() => {
			result.current.commit();
		});
		expect(renameSpy).not.toHaveBeenCalled();
	});

	it("cancel() clears state without calling renameNode", () => {
		const renameSpy = vi.spyOn(useRoadmapStore.getState(), "renameNode");
		const { result } = renderHook(() => useInlineRename());
		act(() => {
			result.current.open(
				NODE_ID,
				0,
				0,
				{ x: 0, y: 0, k: 1 },
				{ left: 0, top: 0 },
			);
			result.current.setTitle("Different");
		});
		act(() => {
			result.current.cancel();
		});
		expect(renameSpy).not.toHaveBeenCalled();
		expect(result.current.state.nodeId).toBeNull();
	});

	it("updateForTransform recomputes screenPos when transform changes", () => {
		const { result } = renderHook(() => useInlineRename());
		act(() => {
			result.current.open(
				NODE_ID,
				100,
				50,
				{ x: 0, y: 0, k: 1 },
				{ left: 0, top: 0 },
			);
		});
		expect(result.current.state.screenPos?.x).toBe(100);
		act(() => {
			result.current.updateForTransform(
				100,
				50,
				{ x: 50, y: 25, k: 2 },
				{ left: 10, top: 5 },
			);
		});
		expect(result.current.state.screenPos?.x).toBe(100 * 2 + 50 + 10); // 260
		expect(result.current.state.screenPos?.y).toBe(50 * 2 + 25 + 5); // 130
	});

	it("state.nodeId is null after commit", () => {
		const { result } = renderHook(() => useInlineRename());
		act(() => {
			result.current.open(
				NODE_ID,
				0,
				0,
				{ x: 0, y: 0, k: 1 },
				{ left: 0, top: 0 },
			);
			result.current.setTitle("abc");
		});
		act(() => {
			result.current.commit();
		});
		expect(result.current.state.nodeId).toBeNull();
	});
});
