import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	buildOwnershipMap,
	getOwnership,
	resetRefMap,
	setOwnership,
	setSourceTemplate,
	splitSchemaByOwnership,
} from "../../../src/bun/refMap";
import type { RoadmapNode, RoadmapSchema } from "../../../../../shared/types";

const uuid = (seed: string): string =>
	`${seed.padEnd(8, "0").slice(0, 8)}-bbbb-4ccc-8ddd-000000000000`;

function makeNode(id: string, title: string, children?: RoadmapNode[]): RoadmapNode {
	return {
		id,
		title,
		status: "not-started",
		...(children ? { children } : {}),
	};
}

function makeSchema(nodes: RoadmapNode[]): RoadmapSchema {
	return { version: "1.0", title: "t", nodes };
}

describe("refMap (EDIT-16)", () => {
	beforeEach(() => {
		resetRefMap();
	});
	afterEach(() => {
		resetRefMap();
	});

	it("buildOwnershipMap on single-file schema tags every node to the main file", () => {
		const mainPath = "/fixtures/main.roadmap.json";
		const nodes: RoadmapNode[] = [
			makeNode(uuid("a1"), "Root", [
				makeNode(uuid("a2"), "Child A"),
				makeNode(uuid("a3"), "Child B", [makeNode(uuid("a4"), "Grand")]),
			]),
		];

		const map = buildOwnershipMap(nodes, mainPath);

		expect(map.size).toBe(4);
		for (const id of [uuid("a1"), uuid("a2"), uuid("a3"), uuid("a4")]) {
			expect(map.get(id)).toBe(mainPath);
		}
	});

	it("tags ref'd descendants to the referenced file when setOwnership overrides", () => {
		const mainPath = "/fixtures/main.roadmap.json";
		const refPath = "/fixtures/referenced-part.json";
		const refRoot = makeNode(uuid("b1"), "Ref Root", [makeNode(uuid("b2"), "Ref Child")]);
		const nodes: RoadmapNode[] = [
			makeNode(uuid("a1"), "Main Root", [makeNode(uuid("a2"), "Main Child"), refRoot]),
		];

		buildOwnershipMap(nodes, mainPath);
		// Simulate the loader tagging ref'd descendants
		setOwnership(uuid("b1"), refPath);
		setOwnership(uuid("b2"), refPath);

		const map = getOwnership();
		expect(map.get(uuid("a1"))).toBe(mainPath);
		expect(map.get(uuid("a2"))).toBe(mainPath);
		expect(map.get(uuid("b1"))).toBe(refPath);
		expect(map.get(uuid("b2"))).toBe(refPath);
	});

	it("splitSchemaByOwnership reconstructs per-file payloads with $ref placeholder in main", () => {
		const mainPath = "/fixtures/main.roadmap.json";
		const refPath = "/fixtures/referenced-part.json";

		// Template: what the main file looked like BEFORE $ref expansion
		const template: RoadmapNode[] = [
			makeNode(uuid("a1"), "Main Root", [
				makeNode(uuid("a2"), "Main Child"),
				{
					id: "ignored-placeholder-id",
					title: "ref",
					status: "not-started",
					$ref: "./referenced-part.json",
				},
			]),
		];
		setSourceTemplate(mainPath, template);

		// Live schema: $ref has been expanded into the real ref subtree
		const live: RoadmapNode[] = [
			makeNode(uuid("a1"), "Main Root", [
				makeNode(uuid("a2"), "Main Child"),
				makeNode(uuid("b1"), "Ref Root", [makeNode(uuid("b2"), "Ref Child")]),
			]),
		];

		buildOwnershipMap(live, mainPath);
		setOwnership(uuid("b1"), refPath);
		setOwnership(uuid("b2"), refPath);

		const split = splitSchemaByOwnership(makeSchema(live), mainPath, getOwnership());

		expect(split.size).toBe(2);
		const mainOut = split.get(mainPath);
		const refOut = split.get(refPath);
		expect(mainOut).toBeDefined();
		expect(refOut).toBeDefined();

		// Main file still has a $ref placeholder where the expansion occurred
		const mainChildren = mainOut!.nodes[0].children!;
		expect(mainChildren).toHaveLength(2);
		expect(mainChildren[0].id).toBe(uuid("a2"));
		expect(mainChildren[1].$ref).toBe("./referenced-part.json");

		// Ref file contains ONLY the ref-owned subtree
		expect(refOut!.nodes).toHaveLength(1);
		expect(refOut!.nodes[0].id).toBe(uuid("b1"));
		expect(refOut!.nodes[0].children![0].id).toBe(uuid("b2"));
	});

	it("preserves non-ref descendants in the main file", () => {
		const mainPath = "/m.json";
		const refPath = "/r.json";
		const template: RoadmapNode[] = [
			makeNode(uuid("a1"), "Root", [
				makeNode(uuid("a2"), "Main Child A"),
				makeNode(uuid("a3"), "Main Child B"),
				{ id: "x", title: "ref", status: "not-started", $ref: "./r.json" },
			]),
		];
		setSourceTemplate(mainPath, template);

		const live: RoadmapNode[] = [
			makeNode(uuid("a1"), "Root", [
				makeNode(uuid("a2"), "Main Child A"),
				makeNode(uuid("a3"), "Main Child B"),
				makeNode(uuid("b1"), "Ref Root"),
			]),
		];
		buildOwnershipMap(live, mainPath);
		setOwnership(uuid("b1"), refPath);

		const split = splitSchemaByOwnership(makeSchema(live), mainPath, getOwnership());
		const mainKids = split.get(mainPath)!.nodes[0].children!;

		expect(mainKids.map((n) => n.id).slice(0, 2)).toEqual([uuid("a2"), uuid("a3")]);
		// Last element is the $ref placeholder
		expect(mainKids[2].$ref).toBe("./r.json");
	});

	it("new node added under a ref-owned parent goes to the ref file (inherits parent owner)", () => {
		const mainPath = "/m.json";
		const refPath = "/r.json";
		const template: RoadmapNode[] = [
			makeNode(uuid("a1"), "Main Root", [
				{ id: "x", title: "ref", status: "not-started", $ref: "./r.json" },
			]),
		];
		setSourceTemplate(mainPath, template);

		const live: RoadmapNode[] = [
			makeNode(uuid("a1"), "Main Root", [
				makeNode(uuid("b1"), "Ref Root", [
					makeNode(uuid("b2"), "Existing Ref Child"),
					makeNode(uuid("c1"), "BRAND NEW"), // added after load; not in ownership map
				]),
			]),
		];
		buildOwnershipMap(live, mainPath);
		// Only the ORIGINAL ref'd descendants are tagged; the new node is not
		setOwnership(uuid("b1"), refPath);
		setOwnership(uuid("b2"), refPath);

		// Rebuild ownership from main, then overlay ref ownership (simulating the loader)
		// But keep the new node with no explicit ownership — it should inherit parent
		const ownership = getOwnership();
		// Explicitly simulate that the store did NOT tag the new node (the test target)
		ownership.delete(uuid("c1"));

		const split = splitSchemaByOwnership(makeSchema(live), mainPath, ownership);
		const refOut = split.get(refPath)!;
		const refRoot = refOut.nodes[0];
		expect(refRoot.id).toBe(uuid("b1"));
		const refKids = refRoot.children!.map((c) => c.id).sort();
		expect(refKids).toEqual([uuid("b2"), uuid("c1")].sort());
	});

	it("Warning 4: splitSchemaByOwnership OMITS a node deleted from live schema even when still in template", () => {
		const mainPath = "/m.json";
		const template: RoadmapNode[] = [
			makeNode(uuid("a1"), "Root", [
				makeNode(uuid("a2"), "Child 1"),
				makeNode(uuid("a3"), "Child 2"), // will be deleted in live
				makeNode(uuid("a4"), "Child 3"),
			]),
		];
		setSourceTemplate(mainPath, template);

		// Live schema: Child 2 has been deleted
		const live: RoadmapNode[] = [
			makeNode(uuid("a1"), "Root", [
				makeNode(uuid("a2"), "Child 1"),
				makeNode(uuid("a4"), "Child 3"),
			]),
		];
		buildOwnershipMap(live, mainPath);

		const split = splitSchemaByOwnership(makeSchema(live), mainPath, getOwnership());
		const mainOut = split.get(mainPath)!;
		const kids = mainOut.nodes[0].children!;

		expect(kids.map((n) => n.id)).toEqual([uuid("a2"), uuid("a4")]);
		expect(kids.find((n) => n.id === uuid("a3"))).toBeUndefined();
	});
});
