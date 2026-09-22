/** @vitest-environment jsdom */
// v0.8.2 Phase 3b — the router stands down for node shortcuts while a
// sidebar Outline row holds DOM focus; global shortcuts still fire.
import { fireEvent, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RoadmapSchema } from "../../../../../packages/core/src/schema";
import { useKeyboardRouter } from "../../../src/mainview/hooks/useKeyboardRouter";
import {
	FOCUS_NODE_EVENT,
	type NodeFocusRequest,
} from "../../../src/mainview/lib/focusRequest";
import { useRoadmapStore } from "../../../src/mainview/store/roadmapStore";
import { useUiStore } from "../../../src/mainview/store/uiStore";
import { resetStore } from "../../helpers/resetStore";

const SCHEMA: RoadmapSchema = {
	version: "1.0",
	title: "T",
	nodes: [
		{
			id: "root",
			title: "Root",
			status: "not-started",
			children: [
				{ id: "a", title: "A", status: "not-started" },
				{ id: "b", title: "B", status: "not-started" },
			],
		},
	],
};

const cleanups: Array<() => void> = [];

function captureRequests(): NodeFocusRequest[] {
	const seen: NodeFocusRequest[] = [];
	const listener = (e: Event): void => {
		seen.push((e as CustomEvent<NodeFocusRequest>).detail);
	};
	window.addEventListener(FOCUS_NODE_EVENT, listener);
	cleanups.push(() => window.removeEventListener(FOCUS_NODE_EVENT, listener));
	return seen;
}

function renderRouter() {
	renderHook(() =>
		useKeyboardRouter({
			inlineRename: {
				state: { nodeId: null },
				open: vi.fn(),
				cancel: vi.fn(),
			} as never,
			togglePanelFocus: vi.fn(),
		}),
	);
}

/** A stand-in for an Outline row: a button inside the `data-outline-tree` container. */
function focusOutlineRow(): HTMLButtonElement {
	const tree = document.createElement("div");
	tree.setAttribute("data-outline-tree", "");
	const row = document.createElement("button");
	tree.appendChild(row);
	document.body.appendChild(tree);
	row.focus();
	return row;
}

beforeEach(() => {
	useRoadmapStore.getState().loadSchema(SCHEMA, "/tmp/t.json");
	useRoadmapStore.getState().setFocusedNode("a");
	useUiStore.setState({ sidebarCollapsed: false });
});

afterEach(() => {
	while (cleanups.length) cleanups.pop()?.();
	resetStore();
	vi.restoreAllMocks();
	document.body.innerHTML = "";
});

describe("useKeyboardRouter — outline focus guard", () => {
	it("ignores arrows, Enter and Delete while an outline row has focus", () => {
		const seen = captureRequests();
		const addChild = vi.spyOn(useRoadmapStore.getState(), "addChild");
		const requestDelete = vi.spyOn(useRoadmapStore.getState(), "requestDelete");
		renderRouter();
		const row = focusOutlineRow();

		for (const key of ["ArrowDown", "ArrowRight", "ArrowLeft", "ArrowUp"]) {
			const ev = fireEvent.keyDown(row, { key });
			expect(ev, key).toBe(true); // not preventDefault-ed: router did not claim it
		}
		fireEvent.keyDown(row, { key: "Enter" });
		fireEvent.keyDown(row, { key: "Delete" });

		expect(seen).toEqual([]);
		expect(addChild).not.toHaveBeenCalled();
		expect(requestDelete).not.toHaveBeenCalled();
		expect(useRoadmapStore.getState().focusedNodeId).toBe("a");
	});

	it("still navigates from the canvas when nothing in the outline is focused", () => {
		const seen = captureRequests();
		renderRouter();
		fireEvent.keyDown(document, { key: "ArrowRight" });
		expect(seen).toEqual([
			{ nodeId: "b", align: "nearest", select: false, rename: false },
		]);
	});

	it("keeps Ctrl+B and Ctrl+F working from inside the outline", () => {
		renderRouter();
		const row = focusOutlineRow();
		const focusSearch = vi.fn();
		window.addEventListener("roadraven:focus-search", focusSearch);
		cleanups.push(() =>
			window.removeEventListener("roadraven:focus-search", focusSearch),
		);

		fireEvent.keyDown(row, { key: "b", ctrlKey: true });
		expect(useUiStore.getState().sidebarCollapsed).toBe(true);

		fireEvent.keyDown(row, { key: "f", ctrlKey: true });
		expect(focusSearch).toHaveBeenCalledTimes(1);
	});
});
