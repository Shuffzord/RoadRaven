/** @vitest-environment jsdom */
import { afterEach, describe, expect, it } from "vitest";
import {
	findNodeCard,
	listNodeCards,
} from "../../../src/mainview/lib/nodeCard";

// v0.8.1 Phase 2 (A3) — .planning/v0.8.1-canvas-focus-PLAN.md.
// The DOM is the node registry: a node is mounted exactly when its card is in
// the document. These two lookups replace Canvas's `nodePositionsRef`, which
// was never pruned and happily returned coordinates for deleted, collapsed and
// previously loaded nodes (RC5).

function mountCards(...ids: string[]): void {
	document.body.innerHTML = ids
		.map((id) => `<div data-source-id="${id}">card</div>`)
		.join("");
}

afterEach(() => {
	document.body.innerHTML = "";
});

describe("findNodeCard", () => {
	it("returns the card carrying the id", () => {
		mountCards("a", "b", "c");

		expect(findNodeCard("b")?.dataset.sourceId).toBe("b");
	});

	it("returns null for a node that is not mounted", () => {
		mountCards("a", "b");

		expect(findNodeCard("gone")).toBeNull();
	});

	it("matches ids that a CSS selector would need escaping for", () => {
		// Matching on `dataset.sourceId` rather than [data-source-id="..."] is
		// what lets arbitrary ids through — jsdom has no CSS.escape.
		const awkward = 'a"b.c #d:e';
		const card = document.createElement("div");
		card.dataset.sourceId = awkward;
		document.body.appendChild(card);

		expect(findNodeCard(awkward)).toBe(card);
	});

	it("searches only inside the given root", () => {
		mountCards("outside");
		const scope = document.createElement("section");
		const inner = document.createElement("div");
		inner.dataset.sourceId = "inside";
		scope.appendChild(inner);
		document.body.appendChild(scope);

		expect(findNodeCard("inside", scope)).toBe(inner);
		expect(findNodeCard("outside", scope)).toBeNull();
	});
});

describe("listNodeCards", () => {
	it("returns every mounted card in document order", () => {
		mountCards("a", "b", "c");

		expect(listNodeCards().map((el) => el.dataset.sourceId)).toEqual([
			"a",
			"b",
			"c",
		]);
	});

	it("returns an empty list when nothing is mounted", () => {
		expect(listNodeCards()).toEqual([]);
	});

	it("omits cards a collapsed subtree has unmounted (RC5)", () => {
		mountCards("root", "collapsed-parent", "child");
		findNodeCard("child")?.remove();

		expect(listNodeCards().map((el) => el.dataset.sourceId)).toEqual([
			"root",
			"collapsed-parent",
		]);
	});
});
