import { describe, expect, it } from "vitest";
import type { RoadmapNode } from "../../../../../packages/core/src/schema";
import {
	COALESCE_MS,
	coalesce,
	focusTargetOf,
	HISTORY_LIMIT,
	type HistoryEntry,
	invert,
	isApplicable,
} from "../../../src/mainview/lib/historyEntries";
import { buildNodeIndex } from "../../../src/mainview/store/roadmapStore";

const leaf: RoadmapNode = { id: "leaf", title: "Leaf", status: "not-started" };

const DELETE_LEAF = {
	kind: "delete",
	at: 1,
	parentId: null,
	index: 0,
	subtree: leaf,
} satisfies HistoryEntry;
const RENAME = {
	kind: "rename",
	at: 1,
	nodeId: "n",
	before: "Old",
	after: "New",
} satisfies HistoryEntry;

const ENTRIES: HistoryEntry[] = [
	{ kind: "create", at: 1, parentId: "p", index: 2, subtree: leaf },
	DELETE_LEAF,
	{
		kind: "move",
		at: 1,
		nodeId: "n",
		fromParentId: "a",
		fromIndex: 0,
		toParentId: "b",
		toIndex: 3,
	},
	RENAME,
	{
		kind: "status",
		at: 1,
		nodeId: "n",
		before: "not-started",
		after: "blocked",
	},
	{ kind: "type", at: 1, nodeId: "n", before: undefined, after: "task" },
	{ kind: "metadata", at: 1, nodeId: "n", before: { a: 1 }, after: { a: 2 } },
	{ kind: "notes", at: 1, nodeId: "n", before: "x", after: "xy" },
];

describe("historyEntries — contract constants", () => {
	it("keeps 50 steps and coalesces within one second", () => {
		expect(HISTORY_LIMIT).toBe(50);
		expect(COALESCE_MS).toBe(1000);
	});
});

describe("historyEntries — invert", () => {
	it.each(
		ENTRIES.map((e) => [e.kind, e] as const),
	)("%s: invert is an involution", (_kind, entry) => {
		expect(invert(invert(entry))).toEqual(entry);
	});

	it("create and delete are each other's inverse and keep the SAME subtree object", () => {
		const created = ENTRIES[0];
		const inverted = invert(created);
		expect(inverted.kind).toBe("delete");
		expect(inverted.kind === "delete" && inverted.subtree).toBe(leaf);
		expect(invert(ENTRIES[1]).kind).toBe("create");
	});

	it("move swaps the from and to positions", () => {
		expect(invert(ENTRIES[2])).toMatchObject({
			fromParentId: "b",
			fromIndex: 3,
			toParentId: "a",
			toIndex: 0,
		});
	});

	it("field edits swap before and after", () => {
		expect(invert(ENTRIES[3])).toMatchObject({ before: "New", after: "Old" });
		expect(invert(ENTRIES[6])).toMatchObject({
			before: { a: 2 },
			after: { a: 1 },
		});
	});
});

describe("historyEntries — coalesce", () => {
	const notes = (at: number, before: string, after: string, nodeId = "n") =>
		({ kind: "notes", at, nodeId, before, after }) as const;

	it("merges consecutive notes edits of the same node within COALESCE_MS, keeping the first before", () => {
		const merged = coalesce(notes(0, "", "a"), notes(COALESCE_MS, "a", "ab"));
		expect(merged).toEqual(notes(COALESCE_MS, "", "ab"));
	});

	it("merges consecutive renames of the same node", () => {
		const merged = coalesce(
			{ kind: "rename", at: 0, nodeId: "n", before: "A", after: "B" },
			{ kind: "rename", at: 10, nodeId: "n", before: "B", after: "C" },
		);
		expect(merged).toMatchObject({ before: "A", after: "C", at: 10 });
	});

	it("does not merge past COALESCE_MS", () => {
		expect(coalesce(notes(0, "", "a"), notes(COALESCE_MS + 1, "a", "ab"))).toBe(
			null,
		);
	});

	it("does not merge different nodes, different kinds, or other kinds", () => {
		expect(coalesce(notes(0, "", "a"), notes(1, "", "b", "other"))).toBe(null);
		expect(
			coalesce(notes(0, "", "a"), {
				kind: "rename",
				at: 1,
				nodeId: "n",
				before: "a",
				after: "b",
			}),
		).toBe(null);
		const status = ENTRIES[4];
		expect(coalesce(status, { ...status, at: 2 })).toBe(null);
		expect(coalesce(undefined, notes(0, "", "a"))).toBe(null);
	});
});

describe("historyEntries — isApplicable / focusTargetOf", () => {
	const tree: RoadmapNode[] = [
		{
			id: "root",
			title: "Root",
			status: "not-started",
			children: [
				{
					id: "a",
					title: "A",
					status: "not-started",
					children: [{ id: "a1", title: "A1", status: "not-started" }],
				},
				{ id: "b", title: "B", status: "not-started" },
			],
		},
	];
	const index = buildNodeIndex(tree);

	it("create needs its parent and must not already exist", () => {
		const create = (parentId: string | null, id: string): HistoryEntry => ({
			kind: "create",
			at: 0,
			parentId,
			index: 0,
			subtree: { id, title: id, status: "not-started" },
		});
		expect(isApplicable(create("b", "new"), index)).toBe(true);
		expect(isApplicable(create(null, "new"), index)).toBe(true);
		expect(isApplicable(create("gone", "new"), index)).toBe(false);
		expect(isApplicable(create("b", "a1"), index)).toBe(false);
	});

	it("delete and field edits need their node", () => {
		expect(isApplicable({ ...DELETE_LEAF, subtree: tree[0] }, index)).toBe(
			true,
		);
		expect(isApplicable(DELETE_LEAF, index)).toBe(false);
		expect(isApplicable({ ...RENAME, nodeId: "a1" }, index)).toBe(true);
		expect(isApplicable(RENAME, index)).toBe(false);
	});

	it("move needs node and target parent, and never into its own subtree", () => {
		const move = (nodeId: string, toParentId: string): HistoryEntry => ({
			kind: "move",
			at: 0,
			nodeId,
			fromParentId: "root",
			fromIndex: 0,
			toParentId,
			toIndex: 0,
		});
		expect(isApplicable(move("a1", "b"), index)).toBe(true);
		expect(isApplicable(move("a", "a1"), index)).toBe(false);
		expect(isApplicable(move("a", "a"), index)).toBe(false);
		expect(isApplicable(move("a", "gone"), index)).toBe(false);
	});

	it("focus lands on the inserted node, the parent of a removed one, or the edited node", () => {
		expect(focusTargetOf(ENTRIES[0])).toBe("leaf");
		expect(focusTargetOf({ ...DELETE_LEAF, parentId: "p" })).toBe("p");
		expect(focusTargetOf(DELETE_LEAF)).toBe(null);
		expect(focusTargetOf(ENTRIES[2])).toBe("n");
		expect(focusTargetOf(ENTRIES[7])).toBe("n");
	});
});
