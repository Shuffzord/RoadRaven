// v0.8.4 Phase 4 — the pure collapse math behind the store-owned collapse.
import type { RawNodeDatum } from "react-d3-tree";
import { describe, expect, it } from "vitest";
import {
	ancestorsToExpand,
	idsAtDepth,
	parentIds,
	pruneCollapsed,
	shownChildCount,
} from "../../../src/mainview/lib/collapseTree";

function datum(id: string, children?: RawNodeDatum[]): RawNodeDatum {
	return { name: id, attributes: { id, status: "not-started" }, children };
}

// root ─ a ─ a1
//      │   └ a2 ─ a2x
//      └ b
function tree(): RawNodeDatum {
	return datum("root", [
		datum("a", [datum("a1"), datum("a2", [datum("a2x")])]),
		datum("b"),
	]);
}

const NODES = [
	{
		id: "root",
		children: [
			{
				id: "a",
				children: [{ id: "a1" }, { id: "a2", children: [{ id: "a2x" }] }],
			},
			{ id: "b" },
		],
	},
];

describe("pruneCollapsed", () => {
	it("returns the same object when nothing is collapsed", () => {
		const t = tree();
		expect(pruneCollapsed(t, new Set())).toBe(t);
	});

	it("returns the same object when only leaves are in the set", () => {
		const t = tree();
		expect(pruneCollapsed(t, new Set(["b", "gone"]))).toBe(t);
	});

	it("a collapsed parent keeps childCount/hasChildren and loses children", () => {
		const t = tree();
		const pruned = pruneCollapsed(t, new Set(["a"]));
		const a = pruned.children?.[0];
		expect(a?.children).toBeUndefined();
		expect(a && "children" in a).toBe(false);
		expect(a?.attributes).toEqual({
			id: "a",
			status: "not-started",
			childCount: 2,
			hasChildren: true,
		});
		// The untouched sibling is shared; the input is not mutated.
		expect(pruned.children?.[1]).toBe(t.children?.[1]);
		expect(t.children?.[0].children).toHaveLength(2);
	});

	it("prunes a nested collapsed node under an expanded one", () => {
		const pruned = pruneCollapsed(tree(), new Set(["a2"]));
		const a = pruned.children?.[0];
		expect(a?.children).toHaveLength(2);
		expect(a?.children?.[1].children).toBeUndefined();
		expect(a?.children?.[1].attributes?.childCount).toBe(1);
	});

	it("a collapsed ancestor hides a collapsed descendant entirely", () => {
		const pruned = pruneCollapsed(tree(), new Set(["a", "a2"]));
		expect(pruned.children?.[0].children).toBeUndefined();
		expect(pruned.children?.[0].attributes?.childCount).toBe(2);
	});
});

describe("idsAtDepth / parentIds", () => {
	it("lists the nodes with children at a depth (root is depth 0)", () => {
		expect(idsAtDepth(NODES, 0)).toEqual(["root"]);
		expect(idsAtDepth(NODES, 1)).toEqual(["a"]);
		expect(idsAtDepth(NODES, 2)).toEqual(["a2"]);
		expect(idsAtDepth(NODES, 3)).toEqual([]);
	});

	it("parentIds lists every node that has children", () => {
		expect(parentIds(NODES)).toEqual(["root", "a", "a2"]);
	});
});

describe("ancestorsToExpand", () => {
	it("keeps only the collapsed ids, top-down", () => {
		expect(
			ancestorsToExpand(["root", "a", "a2"], new Set(["a2", "root", "b"])),
		).toEqual(["root", "a2"]);
	});

	it("is empty when no ancestor is collapsed", () => {
		expect(ancestorsToExpand(["root", "a"], new Set(["b"]))).toEqual([]);
	});
});

describe("shownChildCount", () => {
	it("counts live children, or the ones a collapse hid", () => {
		const pruned = pruneCollapsed(tree(), new Set(["a"]));
		expect(shownChildCount(pruned)).toBe(2);
		expect(shownChildCount(pruned.children?.[0] as RawNodeDatum)).toBe(2);
		expect(shownChildCount(datum("leaf"))).toBe(0);
	});
});
