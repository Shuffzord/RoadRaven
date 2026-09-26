import { describe, expect, it } from "vitest";
import { visibleCardCount } from "../../../scripts/screenshots/visible";
import { idsAtDepth } from "../../../src/mainview/lib/collapseTree";

/** root -> a (a1, a2), b (b1): six nodes on three levels. */
const nodes = [
	{
		id: "root",
		children: [
			{ id: "a", children: [{ id: "a1" }, { id: "a2" }] },
			{ id: "b", children: [{ id: "b1" }] },
		],
	},
];

describe("visibleCardCount", () => {
	it("expand all shows every node", () => {
		expect(visibleCardCount(nodes, new Set())).toBe(6);
	});

	it("collapseDepth 1 shows the root and its children", () => {
		expect(visibleCardCount(nodes, new Set(idsAtDepth(nodes, 1)))).toBe(3);
	});

	it("an explicit collapsed id list gives the same count", () => {
		expect(visibleCardCount(nodes, new Set(["a", "b"]))).toBe(3);
	});

	it("collapsing one branch hides only its descendants", () => {
		expect(visibleCardCount(nodes, new Set(["a"]))).toBe(4);
	});
});
