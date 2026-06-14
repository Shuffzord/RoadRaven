// Node search (header search box) — store logic.
// Covers collectSearchMatches (title + notes, case-insensitive, DFS order),
// getAncestorPath, and the setSearchQuery / stepSearchMatch / clearSearch
// action cycle including wraparound.

import { afterEach, describe, expect, it } from "vitest";
import type { RoadmapSchema } from "../../../../../packages/core/src/schema";
import {
	collectSearchMatches,
	getAncestorPath,
	useRoadmapStore,
} from "../../../src/mainview/store/roadmapStore";
import { resetStore } from "../../helpers/resetStore";

const TEST_SCHEMA: RoadmapSchema = {
	version: "1.0",
	title: "Search Test",
	statusConfig: [{ id: "not-started", label: "Not Started" }],
	nodes: [
		{
			id: "root",
			title: "Root Project",
			status: "not-started",
			notes: "overview",
			children: [
				{
					id: "a",
					title: "Alpha task",
					status: "not-started",
					children: [
						{
							id: "a1",
							title: "deep child",
							status: "not-started",
							notes: "find me here",
						},
					],
				},
				{ id: "b", title: "Beta task", status: "not-started" },
			],
		},
	],
};

afterEach(() => {
	resetStore();
});

// Common arrange for the action + invalidation suites: load the fixture and
// run a query in one step. `st()` returns a FRESH store snapshot — never reuse
// a snapshot across a mutation (zustand replaces the state object on set()).
function searchFor(query: string): void {
	useRoadmapStore.getState().loadSchema(TEST_SCHEMA, "/test.json");
	useRoadmapStore.getState().setSearchQuery(query);
}
const st = () => useRoadmapStore.getState();

describe("collectSearchMatches", () => {
	it("matches node titles (pre-order DFS, case-insensitive)", () => {
		expect(collectSearchMatches(TEST_SCHEMA.nodes, "task")).toEqual(["a", "b"]);
		expect(collectSearchMatches(TEST_SCHEMA.nodes, "ALPHA")).toEqual(["a"]);
	});

	it("matches node notes, not just titles", () => {
		expect(collectSearchMatches(TEST_SCHEMA.nodes, "find me")).toEqual(["a1"]);
	});

	it("returns [] for a blank or whitespace-only query", () => {
		expect(collectSearchMatches(TEST_SCHEMA.nodes, "")).toEqual([]);
		expect(collectSearchMatches(TEST_SCHEMA.nodes, "   ")).toEqual([]);
	});
});

describe("getAncestorPath", () => {
	it("returns the top-down ancestor chain excluding the node itself", () => {
		expect(getAncestorPath(TEST_SCHEMA.nodes, "a1")).toEqual(["root", "a"]);
	});

	it("returns [] for a root-level node", () => {
		expect(getAncestorPath(TEST_SCHEMA.nodes, "root")).toEqual([]);
	});

	it("returns [] for an unknown node", () => {
		expect(getAncestorPath(TEST_SCHEMA.nodes, "nope")).toEqual([]);
	});
});

describe("search actions", () => {
	it("setSearchQuery computes matches and parks the index on the first", () => {
		searchFor("task");
		expect(st().searchMatchIds).toEqual(["a", "b"]);
		expect(st().searchCurrentIndex).toBe(0);
		expect(st().getCurrentSearchMatchId()).toBe("a");
	});

	it("stepSearchMatch advances and wraps around in both directions", () => {
		searchFor("task");
		st().stepSearchMatch(1);
		expect(st().getCurrentSearchMatchId()).toBe("b");
		st().stepSearchMatch(1); // wrap forward
		expect(st().getCurrentSearchMatchId()).toBe("a");
		st().stepSearchMatch(-1); // wrap backward
		expect(st().getCurrentSearchMatchId()).toBe("b");
	});

	it("setSearchQuery with no matches yields index -1 and null current id", () => {
		searchFor("zzz-nomatch");
		expect(st().searchMatchIds).toEqual([]);
		expect(st().searchCurrentIndex).toBe(-1);
		expect(st().getCurrentSearchMatchId()).toBeNull();
	});

	it("stepSearchMatch is a no-op when there are no matches", () => {
		searchFor("zzz-nomatch");
		st().stepSearchMatch(1);
		expect(st().searchCurrentIndex).toBe(-1);
	});

	it("clearSearch resets query, matches and index", () => {
		searchFor("task");
		st().clearSearch();
		expect(st().searchQuery).toBe("");
		expect(st().searchMatchIds).toEqual([]);
		expect(st().searchCurrentIndex).toBe(-1);
		expect(st().getCurrentSearchMatchId()).toBeNull();
	});
});

// Regression coverage for the HIGH-1 review finding: an active search must not
// keep stale ids after the tree mutates, or the camera/selection follow could
// target a deleted node. bumpStructural recomputes matches on every structural
// mutation, preserving the current match when it survives.
describe("search invalidation on tree mutation", () => {
	it("drops a deleted node from matches but keeps the current match when it survives", () => {
		searchFor("task"); // ["a", "b"], current "a"
		st().stepSearchMatch(1); // current "b"
		st().deleteNode("a"); // sibling of the current match
		expect(st().searchMatchIds).toEqual(["b"]);
		expect(st().getCurrentSearchMatchId()).toBe("b"); // survived, still current
	});

	it("never leaves the deleted current match id as current (clamps to a live id)", () => {
		searchFor("task"); // current "a"
		st().deleteNode("a"); // delete the CURRENT match
		expect(st().searchMatchIds).toEqual(["b"]);
		expect(st().getCurrentSearchMatchId()).toBe("b");
		expect(st().getCurrentSearchMatchId()).not.toBe("a");
	});

	it("empties matches and nulls the current id when the last match is deleted", () => {
		searchFor("alpha"); // ["a"]
		st().deleteNode("a");
		expect(st().searchMatchIds).toEqual([]);
		expect(st().searchCurrentIndex).toBe(-1);
		expect(st().getCurrentSearchMatchId()).toBeNull();
	});

	it("recomputes matches after a rename changes what matches", () => {
		searchFor("beta"); // ["b"]
		st().renameNode("b", "Gamma deliverable");
		expect(st().searchMatchIds).toEqual([]);
	});

	it("includes a newly-added matching node in the live result set", () => {
		searchFor("task"); // ["a", "b"]
		const newId = st().addChild("root", "Gamma task");
		expect(newId).not.toBeNull();
		expect(st().searchMatchIds).toContain(newId);
	});
});
