import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { expect, type Page, test } from "@playwright/test";
import type { RoadmapNode } from "../../../core/src/schema";
import { NODE_PLUGIN_ATTR } from "../../src/mainview/lib/domContract";
import { getBuiltInTheme } from "../../src/mainview/themes";
import { captureCollage, type ThemeShot } from "./collage";
import {
	type BuiltFixture,
	buildFixture,
	type FixtureId,
} from "./fixtures/index";
import { pngDimensions, QUALITY_PROFILES } from "./quality";
import {
	CAPTURE_DIR,
	CAPTURE_QUALITY,
	capturePath,
	captureScene,
	cardGeometry,
	expectAttribution,
	loadScene,
	resolveNodeRef,
	SHOWCASE_DIR,
} from "./sceneLoader";
import { getScene, SCENE_IDS, type ScenePreset } from "./scenes";

const scenes = (process.env.ROADRAVEN_CAPTURE_SCENES ?? SCENE_IDS[0])
	.split(",")
	.map(getScene);
const themes = (process.env.ROADRAVEN_CAPTURE_THEMES ?? "dark").split(",");
const collage = process.env.ROADRAVEN_CAPTURE_COLLAGE === "1";

/** Open the app with the sidebar collapsed and motion reduced; returns the page-error log. */
async function bootApp(page: Page): Promise<string[]> {
	const pageErrors: string[] = [];
	page.on("pageerror", (error) => pageErrors.push(error.message));
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto("/");
	await page.waitForFunction(() => "__ROADRAVEN_TEST__" in window);
	await page
		.getByRole("button", { name: "Collapse sidebar", exact: true })
		.click();
	await expect(
		page.getByRole("button", { name: "Expand sidebar", exact: true }),
	).toBeVisible();
	// The sidebar's real width animation must finish before fitting the graph.
	await expect
		.poll(async () => {
			const box = await page
				.getByRole("navigation", { name: "Sidebar navigation" })
				.boundingBox();
			return box?.width;
		})
		.toBe(48);
	return pageErrors;
}

function findNode(
	nodes: readonly RoadmapNode[],
	id: string,
): RoadmapNode | undefined {
	for (const node of nodes) {
		if (node.id === id) return node;
		const found = findNode(node.children ?? [], id);
		if (found) return found;
	}
	return undefined;
}

/** The fixture as the scene shows it: re-rooted at `subtreeRoot` when set. */
function sceneFixture(
	preset: ScenePreset,
	fixture: BuiltFixture,
): BuiltFixture {
	const rootId = resolveNodeRef(preset.subtreeRoot, fixture);
	if (rootId === undefined) return fixture;
	const sub = findNode(fixture.schema.nodes, rootId);
	if (!sub) throw new Error(`Scene ${preset.id}: no node '${rootId}'`);
	const title = `${fixture.schema.nodes[0].title} — ${sub.title}`;
	return { ...fixture, schema: { ...fixture.schema, title, nodes: [sub] } };
}

async function buildFixtures(
	ids: readonly FixtureId[],
): Promise<Map<FixtureId, BuiltFixture>> {
	const built = new Map<FixtureId, BuiltFixture>();
	for (const id of new Set(ids)) built.set(id, await buildFixture(id));
	return built;
}

/** The CFA demo is portable: written next to the captures, never into samples/. */
async function writeCfaDemo(
	fixtures: Map<FixtureId, BuiltFixture>,
): Promise<void> {
	const cfa = fixtures.get("cfa");
	if (!cfa) return;
	await writeFile(
		resolve(CAPTURE_DIR, "cfa-l1-demo.json"),
		`${JSON.stringify(cfa.schema, null, 2)}\n`,
	);
}

function fixtureFor(
	fixtures: Map<FixtureId, BuiltFixture>,
	preset: ScenePreset,
): BuiltFixture {
	const fixture = fixtures.get(preset.fixture);
	if (!fixture) throw new Error(`Fixture ${preset.fixture} was not built`);
	return sceneFixture(preset, fixture);
}

function themeName(themeId: string): string {
	const theme = getBuiltInTheme(themeId);
	if (!theme) throw new Error(`Unknown built-in theme: ${themeId}`);
	return theme.meta.name;
}

/** Every requested scene x theme; returns the first scene's shots for the collage. */
async function captureAll(
	page: Page,
	fixtures: Map<FixtureId, BuiltFixture>,
): Promise<ThemeShot[]> {
	const shots: ThemeShot[] = [];
	for (const preset of scenes) {
		for (const themeId of themes) {
			const name = themeName(themeId);
			await loadScene(page, preset, fixtureFor(fixtures, preset), themeId);
			await expectAttribution(page, preset);
			const path = capturePath(preset.id, themeId);
			await mkdir(dirname(path), { recursive: true });
			const image = await captureScene(page, path);
			const scale = QUALITY_PROFILES[CAPTURE_QUALITY];
			expect(pngDimensions(image)).toEqual({
				width: preset.viewport.width * scale,
				height: preset.viewport.height * scale,
			});
			if (preset !== scenes[0]) continue;
			shots.push({
				name,
				image: `data:image/png;base64,${image.toString("base64")}`,
			});
		}
	}
	return shots;
}

async function writeCollage(page: Page, shots: ThemeShot[]): Promise<void> {
	const lead = scenes[0];
	const path = resolve(
		SHOWCASE_DIR,
		"collage",
		CAPTURE_QUALITY,
		`${lead.id}.png`,
	);
	await mkdir(dirname(path), { recursive: true });
	await captureCollage(page, shots, path, {
		heading: "One roadmap. Different perspectives.",
		subheading: `${lead.title} · The same roadmap across built-in themes`,
		altPrefix: lead.title,
	});
}

/** The samples and fixture files a run reads stay byte-identical. */
async function expectSourcesUnchanged(
	fixtures: Map<FixtureId, BuiltFixture>,
): Promise<void> {
	for (const { sources } of fixtures.values()) {
		for (const [path, original] of sources) {
			expect(await readFile(path, "utf8"), `source changed: ${path}`).toBe(
				original,
			);
		}
	}
}

test("capture showcase scenes", async ({ page }) => {
	test.setTimeout(60_000 + 20_000 * scenes.length * themes.length);
	const fixtures = await buildFixtures(scenes.map((scene) => scene.fixture));
	await mkdir(CAPTURE_DIR, { recursive: true });
	await writeCfaDemo(fixtures);
	const pageErrors = await bootApp(page);
	const shots = await captureAll(page, fixtures);
	if (collage) await writeCollage(page, shots);
	expect(pageErrors).toEqual([]);
	await expectSourcesUnchanged(fixtures);
});

/** Load + capture a scene, then read back what a later scene could disturb. */
async function sceneSnapshot(
	page: Page,
	preset: ScenePreset,
	fixture: BuiltFixture,
	themeId: string,
): Promise<Record<string, unknown>> {
	const scene = sceneFixture(preset, fixture);
	await loadScene(page, preset, scene, themeId);
	const shot = `${preset.id}-${themeId}-${Date.now()}.png`;
	await captureScene(page, test.info().outputPath(shot));
	const state = await page.evaluate(async () => {
		const storePath = "/store/roadmapStore.ts";
		const viewPath = "/store/fileViewStore.ts";
		const { useRoadmapStore } = await import(storePath);
		const { useFileViewStore } = await import(viewPath);
		return {
			selectedNodeId: useRoadmapStore.getState().selectedNodeId,
			collapsed: useFileViewStore.getState().collapsedIds.size,
		};
	});
	return {
		geometry: await cardGeometry(page),
		theme: await page.locator("html").getAttribute("data-theme"),
		...state,
	};
}

test("scene reset: A → B → A", async ({ page }) => {
	const pageErrors = await bootApp(page);
	const cfa = await buildFixture("cfa");
	const overview = getScene("cfa-overview");
	const first = await sceneSnapshot(page, overview, cfa, "dark");
	await sceneSnapshot(page, getScene("cfa-detail"), cfa, "light");
	const again = await sceneSnapshot(page, overview, cfa, "dark");
	expect(again).toEqual(first);
	expect(pageErrors).toEqual([]);
});

test("attribution comes from the plugin slot, not live events", async ({
	page,
}) => {
	const pageErrors = await bootApp(page);
	const agents = await buildFixture("project-agents");
	await loadScene(page, getScene("agent-workflow"), agents, "dark");
	const badge = (id: string) => page.locator(`[${NODE_PLUGIN_ATTR}="${id}"]`);
	expect(await badge("claude-code").count()).toBeGreaterThan(0);
	expect(await badge("github-actions").count()).toBeGreaterThan(0);
	const project = await buildFixture("project");
	await loadScene(page, getScene("project-overview"), project, "dark");
	await expect(page.locator(`[${NODE_PLUGIN_ATTR}]`)).toHaveCount(0);
	expect(pageErrors).toEqual([]);
});
