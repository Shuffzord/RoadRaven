import { describe, expect, it } from "vitest";
import {
	type RoadmapNode,
	RoadmapSchemaSchema,
} from "../../../../core/src/schema";
import { FIXTURE_IDS } from "../../../scripts/screenshots/fixtures/index";
import {
	loadProjectFixture,
	withAttribution,
} from "../../../scripts/screenshots/fixtures/project";
import { SCENE_IDS, SCENES } from "../../../scripts/screenshots/scenes";

function walk(nodes: readonly RoadmapNode[]): RoadmapNode[] {
	return nodes.flatMap((node) => [node, ...walk(node.children ?? [])]);
}

function pluginIdOf(node: RoadmapNode): string | undefined {
	const plugin = node.plugin as { id?: string } | undefined;
	return plugin?.id;
}

describe("SCENES", () => {
	it("ids are unique and SCENE_IDS mirrors the catalog", () => {
		expect(new Set(SCENE_IDS).size).toBe(SCENES.length);
		expect(SCENE_IDS).toEqual(SCENES.map((scene) => scene.id));
	});

	it.each(
		SCENES.map((scene) => [scene.id, scene] as const),
	)("%s is a well-formed preset", (_id, scene) => {
		expect(FIXTURE_IDS).toContain(scene.fixture);
		expect(["TB", "LR"]).toContain(scene.layout);
		expect(scene.expectedCards).toBeGreaterThanOrEqual(1);
		expect(scene.viewport.width).toBeGreaterThanOrEqual(800);
		expect(scene.viewport.height).toBeGreaterThanOrEqual(600);
	});

	it.each(
		SCENES.map((scene) => [scene.id, scene] as const),
	)("%s names a focal node for promo crops", (_id, scene) => {
		expect(scene.focal).toBeTruthy();
	});
});

describe("project fixtures", () => {
	it("the base project parses and carries no plugin attribution", async () => {
		const { schema } = await loadProjectFixture();
		expect(() => RoadmapSchemaSchema.parse(schema)).not.toThrow();
		expect(walk(schema.nodes).filter((node) => "plugin" in node)).toEqual([]);
	});

	it("withAttribution badges claude-code and github-actions work, leaves a leaf unbadged", async () => {
		const { schema } = await loadProjectFixture();
		const nodes = walk(withAttribution(schema).nodes);
		const ids = nodes.map(pluginIdOf);
		expect(ids).toContain("claude-code");
		expect(ids).toContain("github-actions");
		const unbadgedLeaves = nodes.filter(
			(node) => !node.children?.length && pluginIdOf(node) === undefined,
		);
		expect(unbadgedLeaves.length).toBeGreaterThanOrEqual(1);
	});

	it("withAttribution does not mutate its input", async () => {
		const { schema } = await loadProjectFixture();
		const before = structuredClone(schema);
		withAttribution(schema);
		expect(schema).toEqual(before);
	});
});
