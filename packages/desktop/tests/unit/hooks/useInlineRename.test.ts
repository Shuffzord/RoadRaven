/** @vitest-environment jsdom */
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RoadmapSchema } from "../../../../../packages/core/src/schema";
import { useInlineRename } from "../../../src/mainview/hooks/useInlineRename";
import { useRoadmapStore } from "../../../src/mainview/store/roadmapStore";
import { resetStore } from "../../helpers/resetStore";

const NODE_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const OTHER_ID = "11111111-2222-4333-8444-555555555555";

function loadSchema(): void {
	const schema: RoadmapSchema = {
		version: "1.0",
		title: "T",
		nodes: [
			{
				id: NODE_ID,
				title: "Original",
				status: "not-started",
				children: [{ id: OTHER_ID, title: "Other", status: "not-started" }],
			},
		],
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
	// v0.8.1 Phase 2: the input renders inside the node card, so the hook no
	// longer carries a screen position — `open` takes the node id alone and the
	// overlay's transform plumbing (`screenPos`, `updateForTransform`) is gone
	// with Canvas's layout-position cache.
	it("open() targets the node and seeds the draft from its current title", () => {
		const { result } = renderHook(() => useInlineRename());
		act(() => {
			result.current.open(NODE_ID);
		});
		expect(result.current.state.nodeId).toBe(NODE_ID);
		expect(result.current.state.title).toBe("Original");
	});

	it("commit() with non-empty trimmed title calls renameNode and clears state", () => {
		const renameSpy = vi.spyOn(useRoadmapStore.getState(), "renameNode");
		const { result } = renderHook(() => useInlineRename());
		act(() => {
			result.current.open(NODE_ID);
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
			result.current.open(NODE_ID);
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
			result.current.open(NODE_ID);
			result.current.setTitle("Different");
		});
		act(() => {
			result.current.cancel();
		});
		expect(renameSpy).not.toHaveBeenCalled();
		expect(result.current.state.nodeId).toBeNull();
	});

	// v0.8.1 Phase 4: the focus controller is now the only thing that opens a
	// rename, and a newer request supersedes an older one. React fires no blur
	// when the input unmounts, so switching the target would silently discard
	// the draft — while every other way of leaving a rename in this app
	// commits it (the card's onBlur). Escape stays the one route that discards.
	it("open() on another node commits the draft in flight", () => {
		const renameSpy = vi.spyOn(useRoadmapStore.getState(), "renameNode");
		const { result } = renderHook(() => useInlineRename());
		act(() => {
			result.current.open(NODE_ID);
			result.current.setTitle("Typed but not confirmed");
		});

		act(() => {
			result.current.open(OTHER_ID);
		});

		expect(renameSpy).toHaveBeenCalledWith(NODE_ID, "Typed but not confirmed");
		expect(result.current.state.nodeId).toBe(OTHER_ID);
		expect(result.current.state.title).toBe("Other");
	});

	it("open() on the same node does not commit anything", () => {
		const renameSpy = vi.spyOn(useRoadmapStore.getState(), "renameNode");
		const { result } = renderHook(() => useInlineRename());
		act(() => {
			result.current.open(NODE_ID);
			result.current.setTitle("Half typed");
		});

		act(() => {
			result.current.open(NODE_ID);
		});

		expect(renameSpy).not.toHaveBeenCalled();
		// Re-opening reseeds the draft from the stored title.
		expect(result.current.state.title).toBe("Original");
	});

	it("state.nodeId is null after commit", () => {
		const { result } = renderHook(() => useInlineRename());
		act(() => {
			result.current.open(NODE_ID);
			result.current.setTitle("abc");
		});
		act(() => {
			result.current.commit();
		});
		expect(result.current.state.nodeId).toBeNull();
	});
});
