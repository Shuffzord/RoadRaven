import { describe, expect, it } from "vitest";
import {
	type RoadmapNode,
	RoadmapSchemaSchema,
} from "../../../../core/src/schema";
import {
	buildFixture,
	FIXTURE_IDS,
} from "../../../scripts/screenshots/fixtures/index";
import { resolveNodeRef } from "../../../scripts/screenshots/sceneLoader";
import { SCENE_IDS, SCENES } from "../../../scripts/screenshots/scenes";
import {
	clampKnobs,
	KNOB_DEFAULTS,
} from "../../../src/mainview/lib/layoutKnobs";
import {
	isLogoFxVariant,
	LOGO_FX_VARIANT,
} from "../../../src/mainview/lib/logoFx/constants";

function walk(nodes: readonly RoadmapNode[]): RoadmapNode[] {
	return nodes.flatMap((node) => [node, ...walk(node.children ?? [])]);
}

function pluginIdOf(node: RoadmapNode): string | undefined {
	const plugin = node.plugin as { id?: string } | undefined;
	return plugin?.id;
}

const byId = SCENES.map((scene) => [scene.id, scene] as const);

describe("SCENES", () => {
	it("ids are unique and SCENE_IDS mirrors the catalog", () => {
		expect(new Set(SCENE_IDS).size).toBe(SCENES.length);
		expect(SCENE_IDS).toEqual(SCENES.map((scene) => scene.id));
	});

	it("is the RoadRaven timeline, its detail, the CFA overview, then the logo-effect scenes", () => {
		expect(SCENE_IDS).toEqual([
			"rr-timeline",
			"rr-detail",
			"cfa-overview",
			"rr-fx-circuit",
			"rr-fx-aurora",
		]);
	});

	it("the default capture (SCENE_IDS[0]) is still rr-timeline and has no logoFx", () => {
		expect(SCENE_IDS[0]).toBe("rr-timeline");
		expect(SCENES[0]).not.toHaveProperty("logoFx");
	});

	it("only the two rr-fx scenes carry logoFx, with the circuit and aurora variants", () => {
		const withFx = SCENES.filter((scene) => scene.logoFx);
		expect(withFx.map((scene) => scene.id)).toEqual([
			"rr-fx-circuit",
			"rr-fx-aurora",
		]);
		expect(withFx.map((scene) => scene.logoFx?.variant)).toEqual([
			LOGO_FX_VARIANT.CIRCUIT_PULSE,
			LOGO_FX_VARIANT.STATUS_AURORA,
		]);
	});

	// effects.ts keeps its durations private; the shortest effect (shimmer) is
	// 1900 ms, so that is the plain upper bound every freeze point must beat.
	it.each(
		byId.filter(([, scene]) => scene.logoFx),
	)("%s: logoFx names a real variant and a freeze point mid-flight", (_id, scene) => {
		const fx = scene.logoFx;
		expect(isLogoFxVariant(fx?.variant)).toBe(true);
		expect(fx?.atMs).toBeGreaterThan(0);
		expect(fx?.atMs).toBeLessThan(1900);
	});

	it.each(byId)("%s is a well-formed preset", (_id, scene) => {
		expect(FIXTURE_IDS).toContain(scene.fixture);
		expect(["TB", "LR"]).toContain(scene.layout);
		expect(scene.viewport.width).toBeGreaterThanOrEqual(800);
		expect(scene.viewport.height).toBeGreaterThanOrEqual(600);
		expect(scene).not.toHaveProperty("expectedCards");
	});

	it.each(byId)("%s sets at most one collapse policy", (_id, scene) => {
		expect(
			scene.collapsed !== undefined && scene.collapseDepth !== undefined,
		).toBe(false);
	});

	it.each(byId)("%s: every knob is inside its clamp range", (_id, scene) => {
		const knobs = { ...KNOB_DEFAULTS, ...scene.knobs };
		expect(clampKnobs(knobs)).toEqual(knobs);
	});

	it.each(byId)("%s names a focal node for promo crops", (_id, scene) => {
		expect(scene.focal).toBeTruthy();
	});

	it.each(
		byId,
	)("%s: every collapsed and node ref resolves in its fixture", async (_id, scene) => {
		const fixture = await buildFixture(scene.fixture);
		const ids = new Set(walk(fixture.schema.nodes).map((node) => node.id));
		const refs = [
			...(scene.collapsed ?? []),
			scene.subtreeRoot,
			scene.selectedNode,
			scene.focal,
		].filter((ref): ref is string => ref !== undefined);
		for (const ref of refs) {
			expect(ids, ref).toContain(resolveNodeRef(ref, fixture));
		}
	});
});

describe("roadraven fixture", () => {
	it("parses and badges claude-code and github-actions work, leaving some unbadged", async () => {
		const { schema } = await buildFixture("roadraven");
		expect(() => RoadmapSchemaSchema.parse(schema)).not.toThrow();
		const ids = walk(schema.nodes).map(pluginIdOf);
		expect(ids).toContain("claude-code");
		expect(ids).toContain("github-actions");
		expect(ids).toContain(undefined);
	});

	it("anchors name the current version and its active phase", async () => {
		const { schema, anchors } = await buildFixture("roadraven");
		const nodes = walk(schema.nodes);
		const current = nodes.find(({ id }) => id === anchors.current);
		const phase = nodes.find(({ id }) => id === anchors.currentPhase);
		expect(current?.status).toBe("in-progress");
		expect(phase?.status).toBe("in-progress");
		expect(current?.children).toContain(phase);
	});
});
