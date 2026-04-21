/** @vitest-environment jsdom */
import { fireEvent, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RoadmapSchema } from "../../../../../packages/core/src/schema";
import { useKeyboardRouter } from "../../../src/mainview/hooks/useKeyboardRouter";
import { useRoadmapStore } from "../../../src/mainview/store/roadmapStore";
import { resetStore } from "../../helpers/resetStore";

const ROOT_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const CHILD_A_ID = "11111111-2222-4333-8444-555555555555";
const CHILD_B_ID = "22222222-3333-4444-8555-666666666666";
const CHILD_B1_ID = "33333333-4444-4555-8666-777777777777";

function makeTestSchema(): RoadmapSchema {
	return {
		version: "1.0",
		title: "T",
		nodes: [
			{
				id: ROOT_ID,
				title: "Root",
				status: "not-started",
				children: [
					{ id: CHILD_A_ID, title: "A", status: "not-started" },
					{
						id: CHILD_B_ID,
						title: "B",
						status: "not-started",
						children: [{ id: CHILD_B1_ID, title: "B1", status: "not-started" }],
					},
				],
			},
		],
	};
}

interface RenderOpts {
	inlineRename?: {
		state: { nodeId: string | null };
		open: ReturnType<typeof vi.fn>;
		cancel: ReturnType<typeof vi.fn>;
	};
	togglePanelFocus?: ReturnType<typeof vi.fn>;
	getNodePosition?: (id: string) => { x: number; y: number } | null;
}

function renderRouter(opts: RenderOpts = {}) {
	const inlineRename = opts.inlineRename ?? {
		state: { nodeId: null },
		open: vi.fn(),
		cancel: vi.fn(),
		commit: vi.fn(),
		setTitle: vi.fn(),
		updateForTransform: vi.fn(),
	};
	const togglePanelFocus = opts.togglePanelFocus ?? vi.fn();

	renderHook(() =>
		useKeyboardRouter({
			inlineRename: inlineRename as never,
			getTransform: () => ({ x: 0, y: 0, k: 1 }),
			getContainerRect: () => ({ left: 0, top: 0 }),
			getNodePosition: opts.getNodePosition ?? (() => ({ x: 0, y: 0 })),
			togglePanelFocus,
		}),
	);

	return { inlineRename, togglePanelFocus };
}

beforeEach(() => {
	useRoadmapStore.getState().loadSchema(makeTestSchema(), "/tmp/t.json");
});

afterEach(() => {
	// Cleanup any stray event listeners from renderHook
	resetStore();
	vi.restoreAllMocks();
	document.body.innerHTML = "";
});

describe("useKeyboardRouter", () => {
	it("F2 with focusedNodeId set opens inline rename", () => {
		useRoadmapStore.getState().setFocusedNode(CHILD_A_ID);
		const { inlineRename } = renderRouter();
		fireEvent.keyDown(document, { key: "F2" });
		expect(inlineRename.open).toHaveBeenCalled();
	});

	it("Enter adds a child to focusedNodeId", () => {
		useRoadmapStore.getState().setFocusedNode(CHILD_A_ID);
		const addChildSpy = vi.spyOn(useRoadmapStore.getState(), "addChild");
		renderRouter();
		fireEvent.keyDown(document, { key: "Enter" });
		expect(addChildSpy).toHaveBeenCalledWith(CHILD_A_ID);
	});

	it("Shift+Enter adds a sibling above", () => {
		useRoadmapStore.getState().setFocusedNode(CHILD_A_ID);
		const spy = vi.spyOn(useRoadmapStore.getState(), "addSiblingAbove");
		renderRouter();
		fireEvent.keyDown(document, { key: "Enter", shiftKey: true });
		expect(spy).toHaveBeenCalledWith(CHILD_A_ID);
	});

	it("Tab (with preventDefault) adds a sibling below", () => {
		useRoadmapStore.getState().setFocusedNode(CHILD_A_ID);
		const spy = vi.spyOn(useRoadmapStore.getState(), "addSiblingBelow");
		renderRouter();
		fireEvent.keyDown(document, { key: "Tab" });
		expect(spy).toHaveBeenCalledWith(CHILD_A_ID);
	});

	it("Del on a leaf deletes immediately; Del on a non-leaf sets pendingConfirmation", () => {
		useRoadmapStore.getState().setFocusedNode(CHILD_A_ID);
		renderRouter();
		fireEvent.keyDown(document, { key: "Delete" });
		// CHILD_A was a leaf - it's gone
		expect(useRoadmapStore.getState().nodeIndex.has(CHILD_A_ID)).toBe(false);
		expect(useRoadmapStore.getState().pendingConfirmation).toBeNull();

		// Now focus B (has one child) — should NOT delete immediately
		useRoadmapStore.getState().setFocusedNode(CHILD_B_ID);
		fireEvent.keyDown(document, { key: "Delete" });
		expect(useRoadmapStore.getState().nodeIndex.has(CHILD_B_ID)).toBe(true);
		expect(useRoadmapStore.getState().pendingConfirmation).not.toBeNull();
		expect(useRoadmapStore.getState().pendingConfirmation?.nodeId).toBe(
			CHILD_B_ID,
		);
	});

	it("Ctrl+D duplicates focused node", () => {
		useRoadmapStore.getState().setFocusedNode(CHILD_A_ID);
		const spy = vi.spyOn(useRoadmapStore.getState(), "duplicateNode");
		renderRouter();
		fireEvent.keyDown(document, { key: "d", ctrlKey: true });
		expect(spy).toHaveBeenCalledWith(CHILD_A_ID);
	});

	it("Ctrl+Up / Ctrl+Down move focused up/down", () => {
		useRoadmapStore.getState().setFocusedNode(CHILD_B_ID);
		const upSpy = vi.spyOn(useRoadmapStore.getState(), "moveNodeUp");
		const downSpy = vi.spyOn(useRoadmapStore.getState(), "moveNodeDown");
		renderRouter();
		fireEvent.keyDown(document, { key: "ArrowUp", ctrlKey: true });
		expect(upSpy).toHaveBeenCalledWith(CHILD_B_ID);
		fireEvent.keyDown(document, { key: "ArrowDown", ctrlKey: true });
		expect(downSpy).toHaveBeenCalledWith(CHILD_B_ID);
	});

	it("Ctrl+C when canvas focused calls copySubtreeToClipboard; when input focused, does NOT", () => {
		useRoadmapStore.getState().setFocusedNode(CHILD_A_ID);
		const copySpy = vi
			.spyOn(useRoadmapStore.getState(), "copySubtreeToClipboard")
			.mockResolvedValue();
		renderRouter();

		// Canvas focus (no input in focus)
		fireEvent.keyDown(document, { key: "c", ctrlKey: true });
		expect(copySpy).toHaveBeenCalledWith(CHILD_A_ID);

		// Now put focus in an input element — keyboard event dispatches on input
		// which bubbles up to document, but our router checks document.activeElement.
		copySpy.mockClear();
		const input = document.createElement("input");
		document.body.appendChild(input);
		input.focus();
		// Fire event on the focused input — its target is input, handler reads activeElement
		fireEvent.keyDown(input, { key: "c", ctrlKey: true });
		expect(copySpy).not.toHaveBeenCalled();
	});

	it("Ctrl+V when canvas focused calls pasteFromClipboard; when input focused, does NOT", () => {
		useRoadmapStore.getState().setFocusedNode(CHILD_A_ID);
		const pasteSpy = vi
			.spyOn(useRoadmapStore.getState(), "pasteFromClipboard")
			.mockResolvedValue(null);
		renderRouter();

		fireEvent.keyDown(document, { key: "v", ctrlKey: true });
		expect(pasteSpy).toHaveBeenCalled();

		pasteSpy.mockClear();
		const input = document.createElement("input");
		document.body.appendChild(input);
		input.focus();
		fireEvent.keyDown(input, { key: "v", ctrlKey: true });
		expect(pasteSpy).not.toHaveBeenCalled();
	});

	// Arrow mapping matches the TB (top-to-bottom) tree layout:
	//   ArrowRight → next sibling    ArrowLeft  → previous sibling
	//   ArrowDown  → enter child     ArrowUp    → return to parent
	it("ArrowRight on focused sibling moves focus to next sibling", () => {
		useRoadmapStore.getState().setFocusedNode(CHILD_A_ID);
		renderRouter();
		fireEvent.keyDown(document, { key: "ArrowRight" });
		expect(useRoadmapStore.getState().focusedNodeId).toBe(CHILD_B_ID);
	});

	it("ArrowDown on a focused parent moves focus into its first child", () => {
		useRoadmapStore.getState().setFocusedNode(CHILD_B_ID);
		renderRouter();
		fireEvent.keyDown(document, { key: "ArrowDown" });
		expect(useRoadmapStore.getState().focusedNodeId).toBe(CHILD_B1_ID);
	});

	it("ArrowUp on a focused child returns focus to its parent", () => {
		useRoadmapStore.getState().setFocusedNode(CHILD_B1_ID);
		renderRouter();
		fireEvent.keyDown(document, { key: "ArrowUp" });
		expect(useRoadmapStore.getState().focusedNodeId).toBe(CHILD_B_ID);
	});
});
