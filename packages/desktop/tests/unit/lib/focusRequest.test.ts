/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RoadmapSchema } from "../../../../../packages/core/src/schema";
import {
	FOCUS_NODE_EVENT,
	type NodeFocusRequest,
	requestNodeFocus,
} from "../../../src/mainview/lib/focusRequest";
import { useRoadmapStore } from "../../../src/mainview/store/roadmapStore";
import { resetStore } from "../../helpers/resetStore";

// v0.8.1 Phase 2 (RC3) — .planning/v0.8.1-canvas-focus-PLAN.md.
// Every mover (arrows, click, search, event log) asks for focus explicitly
// instead of relying on Canvas's old implicit `focusedNodeId ?? selectedNodeId`
// target. The logical half of a request is written to the store synchronously
// so it never depends on a mounted Canvas; only the reveal is deferred to the
// canvas controller through the window event this module dispatches.

const ROOT_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const CHILD_ID = "11111111-2222-4333-8444-555555555555";

const SCHEMA: RoadmapSchema = {
	version: "1.0",
	title: "Focus request fixture",
	nodes: [
		{
			id: ROOT_ID,
			title: "Root",
			status: "not-started",
			children: [{ id: CHILD_ID, title: "Child", status: "not-started" }],
		},
	],
};

function captureRequests(): NodeFocusRequest[] {
	const seen: NodeFocusRequest[] = [];
	const listener = (e: Event): void => {
		seen.push((e as CustomEvent<NodeFocusRequest>).detail);
	};
	window.addEventListener(FOCUS_NODE_EVENT, listener);
	listeners.push(() => window.removeEventListener(FOCUS_NODE_EVENT, listener));
	return seen;
}

const listeners: Array<() => void> = [];

beforeEach(() => {
	useRoadmapStore.getState().loadSchema(SCHEMA, "/tmp/focus.json");
});

afterEach(() => {
	while (listeners.length) listeners.pop()?.();
	resetStore();
	vi.restoreAllMocks();
});

describe("requestNodeFocus", () => {
	it("sets focusedNodeId synchronously", () => {
		requestNodeFocus(CHILD_ID, { align: "nearest" });

		expect(useRoadmapStore.getState().focusedNodeId).toBe(CHILD_ID);
	});

	it("leaves the selection alone without the select flag", () => {
		requestNodeFocus(CHILD_ID, { align: "nearest" });

		expect(useRoadmapStore.getState().selectedNodeId).toBeNull();
	});

	it("selects synchronously with the select flag (event log / search contract)", () => {
		requestNodeFocus(CHILD_ID, { align: "center", select: true });

		const state = useRoadmapStore.getState();
		expect(state.selectedNodeId).toBe(CHILD_ID);
		expect(state.focusedNodeId).toBe(CHILD_ID);
	});

	it("defaults select to false in the event detail", () => {
		const seen = captureRequests();

		requestNodeFocus(ROOT_ID, { align: "nearest" });

		expect(seen).toEqual([
			{ nodeId: ROOT_ID, align: "nearest", select: false, rename: false },
		]);
	});

	// v0.8.1 Phase 4 (RC4): create-and-rename is one request, not a create
	// followed by a separate rename bridge that knew nothing about the camera.
	it("carries the rename intent in the event detail", () => {
		const seen = captureRequests();

		requestNodeFocus(CHILD_ID, { align: "center", rename: true });

		expect(seen).toEqual([
			{ nodeId: CHILD_ID, align: "center", select: false, rename: true },
		]);
	});

	it("is a no-op for an id that is not in the node index", () => {
		const seen = captureRequests();
		useRoadmapStore.getState().setFocusedNode(ROOT_ID);

		requestNodeFocus("deleted-between-query-and-follow", { align: "center" });

		const state = useRoadmapStore.getState();
		expect(state.focusedNodeId).toBe(ROOT_ID);
		expect(state.selectedNodeId).toBeNull();
		expect(seen).toEqual([]);
	});
});
