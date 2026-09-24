import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
	RoadmapNode,
	RoadmapSchema,
} from "../../../../../packages/core/src/schema";
import { COALESCE_MS } from "../../../src/mainview/lib/historyEntries";
import {
	useHistoryStore,
	withoutHistory,
} from "../../../src/mainview/store/historyStore";
import { useRoadmapStore } from "../../../src/mainview/store/roadmapStore";
import { resetStore } from "../../helpers/resetStore";

// v0.8.4 Phase 6 — undo/redo of the user's own edits. Time is pinned so the
// updatedAt every mutation stamps equals the fixture's, which makes "undo
// restores the pre-state" a plain deep equality on schema.nodes.
const NOW = new Date("2026-01-01T00:00:00.000Z");
const T = NOW.toISOString();

const node = (id: string, extra: Partial<RoadmapNode> = {}): RoadmapNode => ({
	id,
	title: id.toUpperCase(),
	status: "not-started",
	updatedAt: T,
	...extra,
});

function makeSchema(): RoadmapSchema {
	return {
		version: "1.0",
		title: "Undo",
		nodes: [
			node("root", {
				children: [
					node("a", {
						children: [
							node("a1", {
								type: "task",
								notes: "first",
								metadata: { owner: "ann" },
								children: [node("a1a")],
							}),
							node("a2"),
							node("a3"),
						],
					}),
					node("b", { children: [node("b1")] }),
				],
			}),
		],
	};
}

const store = () => useRoadmapStore.getState();
const history = () => useHistoryStore.getState();
const snapshot = () => structuredClone(store().schema?.nodes);

beforeEach(() => {
	vi.useFakeTimers({ toFake: ["Date"] });
	vi.setSystemTime(NOW);
	store().loadSchema(makeSchema(), "/tmp/undo.json");
	history().clear();
});

afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
	resetStore();
	history().clear();
	vi.restoreAllMocks();
});

// Each user-facing edit the brief lists, as it is reached from the UI.
const EDITS: Array<[string, () => unknown]> = [
	["addChild", () => store().addChild("a")],
	["addSiblingAbove", () => store().addSiblingAbove("a2")],
	["addSiblingBelow", () => store().addSiblingBelow("a2")],
	["delete (leaf)", () => store().requestDelete("b1")],
	[
		"delete (confirmed subtree)",
		() => {
			store().requestDelete("a");
			store().confirmDelete();
		},
	],
	["duplicateNode", () => store().duplicateNode("a1")],
	[
		"pasteFromClipboard",
		async () => {
			await store().copySubtreeToClipboard("a1");
			await store().pasteFromClipboard("b");
		},
	],
	["moveNodeUp", () => store().moveNodeUp("a2")],
	["moveNodeDown", () => store().moveNodeDown("a2")],
	["indentNode", () => store().indentNode("a2")],
	["outdentNode", () => store().outdentNode("a1a")],
	["moveNode (context menu)", () => store().moveNode("a3", "b", 0)],
	["renameNode", () => store().renameNode("a1", "Renamed")],
	["updateNodeStatus", () => store().updateNodeStatus("a1", "blocked")],
	["updateNodeType", () => store().updateNodeType("a1", "milestone")],
	[
		"updateNodeMetadata",
		() => store().updateNodeMetadata("a1", { owner: "bob" }),
	],
	["updateNodeNotes", () => store().updateNodeNotes("a1", "second")],
	["updateNodeNotes (from none)", () => store().updateNodeNotes("b1", "new")],
];

describe("roadmapStore undo/redo — every user edit round-trips", () => {
	it.each(
		EDITS,
	)("%s: undo restores the pre-state, redo the post-state", async (_name, edit) => {
		// Clipboard API is absent in node; copy/paste fall back to the buffer.
		vi.stubGlobal("navigator", {});
		const before = snapshot();
		await edit();
		const after = snapshot();
		expect(after).not.toEqual(before);
		expect(history().past).toHaveLength(1);

		store().undo();
		expect(store().schema?.nodes).toEqual(before);
		expect(history().past).toHaveLength(0);
		expect(history().future).toHaveLength(1);

		store().redo();
		expect(store().schema?.nodes).toEqual(after);
		expect(history().past).toHaveLength(1);
		expect(history().future).toHaveLength(0);
	});

	it("a no-op edit records nothing", () => {
		store().updateNodeStatus("a1", "not-started");
		store().renameNode("a1", "A1");
		store().moveNodeUp("a1");
		expect(history().past).toEqual([]);
	});

	it("several steps undo in reverse order", () => {
		const s0 = snapshot();
		store().renameNode("a2", "One");
		const s1 = snapshot();
		store().updateNodeStatus("a3", "completed");
		store().undo();
		expect(store().schema?.nodes).toEqual(s1);
		store().undo();
		expect(store().schema?.nodes).toEqual(s0);
		store().undo(); // empty — no throw, no change
		expect(store().schema?.nodes).toEqual(s0);
	});
});

describe("roadmapStore undo/redo — bookkeeping", () => {
	it("a structural undo bumps dataKey like the forward edit", () => {
		store().renameNode("a1", "Renamed");
		const key = store().dataKey;
		store().undo();
		expect(Number(store().dataKey)).toBe(Number(key) + 1);
	});

	it("an in-place undo bumps statusTick like the forward edit", () => {
		store().updateNodeStatus("a1", "blocked");
		const tick = store().statusTick;
		store().undo();
		expect(store().statusTick).toBe(tick + 1);
	});

	it("a new edit after an undo clears the redo stack", () => {
		store().renameNode("a1", "One");
		store().undo();
		expect(history().future).toHaveLength(1);
		store().updateNodeStatus("a2", "completed");
		expect(history().future).toEqual([]);
		store().redo();
		expect(store().nodeIndex.get("a1")?.title).toBe("A1");
	});

	it("typing notes within COALESCE_MS is one undo step", () => {
		store().updateNodeNotes("a1", "firs");
		vi.setSystemTime(NOW.getTime() + COALESCE_MS - 1);
		store().updateNodeNotes("a1", "firsT");
		expect(history().past).toHaveLength(1);
		store().undo();
		expect(store().nodeIndex.get("a1")?.notes).toBe("first");
	});

	it("a stale entry (node deleted outside the history) is skipped; the one before it still undoes", () => {
		store().updateNodeStatus("b1", "completed");
		store().renameNode("a1", "Renamed");
		withoutHistory(() => store().deleteNode("a1"));
		expect(() => store().undo()).not.toThrow();
		expect(store().nodeIndex.get("b1")?.status).toBe("not-started");
		expect(history().past).toEqual([]);
		expect(history().future).toHaveLength(1);
	});

	it("undo of a create focuses and selects the parent", () => {
		const id = store().addChild("a");
		store().setFocusedNode(id);
		expect(store().undo()).toBe("a");
		expect(store().focusedNodeId).toBe("a");
		expect(store().selectedNodeId).toBe("a");
	});

	it("undo of a delete restores the node at its position and focuses it", () => {
		store().setFocusedNode("a2");
		store().deleteNode("a2");
		expect(store().undo()).toBe("a2");
		expect(
			store()
				.nodeIndex.get("a")
				?.children?.map((c) => c.id),
		).toEqual(["a1", "a2", "a3"]);
		expect(store().focusedNodeId).toBe("a2");
		expect(store().selectedNodeId).toBe("a2");
	});

	it("undo/redo of a field edit focuses the edited node", () => {
		store().updateNodeType("a3", "task");
		store().setFocusedNode("root");
		expect(store().undo()).toBe("a3");
		expect(store().focusedNodeId).toBe("a3");
		store().setFocusedNode("root");
		expect(store().redo()).toBe("a3");
		expect(store().focusedNodeId).toBe("a3");
	});
});

describe("roadmapStore undo/redo — what is not history", () => {
	beforeEach(() => {
		// One past and one future entry, so both stacks are observable.
		store().renameNode("a1", "One");
		vi.setSystemTime(NOW.getTime() + COALESCE_MS * 5);
		store().renameNode("a2", "Two");
		store().undo();
	});

	it("applyEventBatch, updateNodesBatch and recordLiveSource leave both stacks alone", () => {
		const past = history().past;
		const future = history().future;
		store().applyEventBatch([
			{ nodeId: "a1", status: "completed", lastEventAt: Date.now() },
		]);
		store().updateNodesBatch([{ nodeId: "a3", status: "blocked", notes: "x" }]);
		store().recordLiveSource("a1", "claude-code");
		expect(history().past).toBe(past);
		expect(history().future).toBe(future);
	});

	it.each([
		["loadSchema", () => store().loadSchema(makeSchema(), "/tmp/other.json")],
		["reloadSchema", () => store().reloadSchema(makeSchema())],
		["newUntitledSchema", () => store().newUntitledSchema()],
		["closeSchema", () => store().closeSchema()],
	])("%s clears both stacks", (_name, act) => {
		act();
		expect(history().past).toEqual([]);
		expect(history().future).toEqual([]);
	});

	it("Save As keeps the history (same document, new path)", () => {
		// useFileActions.saveAs publishes the new path with a plain setState.
		useRoadmapStore.setState({ filePath: "/tmp/copy.json", isUntitled: false });
		expect(history().past).toHaveLength(1);
		expect(history().future).toHaveLength(1);
	});
});
