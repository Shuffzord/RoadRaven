import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { type Browser, expect, type Page, test } from "@playwright/test";
import type { RoadmapNode } from "../../../core/src/schema";
import pkg from "../../package.json" with { type: "json" };
import { NODE_PLUGIN_ATTR } from "../../src/mainview/lib/domContract";
import { getBuiltInTheme } from "../../src/mainview/themes";
import { captureCollage, type ThemeShot } from "./collage";
import { PROMO_COPY, type PromoCopy } from "./copy";
import {
	type BuiltFixture,
	buildFixture,
	type FixtureId,
} from "./fixtures/index";
import type { RunInfo } from "./gallery";
import {
	LOGO_PATH,
	PROMO_CLASS,
	PROMO_FORMATS,
	type PromoFormat,
	releaseVersion,
	renderPromo,
} from "./promo";
import { pngDimensions, QUALITY_PROFILES } from "./quality";
import {
	CAPTURE_DIR,
	CAPTURE_QUALITY,
	capturePath,
	captureScene,
	cardGeometry,
	expectAttribution,
	focalPoint,
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
const requestedFormats = (process.env.ROADRAVEN_CAPTURE_FORMATS ?? "").split(
	",",
);
const formats = PROMO_FORMATS.filter((f) => requestedFormats.includes(f.id));
const logoSvg = readFileSync(LOGO_PATH, "utf8");

type Focal = { x: number; y: number } | null;

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

/** The preset's focal card, read off the current page. */
async function sceneFocal(
	page: Page,
	preset: ScenePreset,
	fixture: BuiltFixture,
): Promise<Focal> {
	const nodeId = resolveNodeRef(preset.focal, fixture);
	return nodeId === undefined ? null : focalPoint(page, nodeId);
}

/** P3: no copy element overflows its box, and the capture decoded. */
async function expectNoClipping(page: Page): Promise<void> {
	const { copy, headline, subline, highlight, capture } = PROMO_CLASS;
	const selector = ["body", copy, headline, subline, highlight]
		.map((name) => (name === "body" ? name : `.${name}`))
		.join(",");
	const clipped = await page
		.locator(selector)
		.evaluateAll((elements) =>
			elements
				.filter(
					(el) =>
						el.scrollWidth > el.clientWidth ||
						el.scrollHeight > el.clientHeight,
				)
				.map(
					(el) =>
						`${el.tagName}.${el.className} scroll ${el.scrollWidth}x${el.scrollHeight} > client ${el.clientWidth}x${el.clientHeight}`,
				),
		);
	expect(clipped).toEqual([]);
	const natural = await page
		.locator(`.${capture}`)
		.evaluate((img: HTMLImageElement) => img.naturalWidth);
	expect(natural).toBeGreaterThan(0);
}

/** P2: the focal point, projected through the `<img>`'s cover layout, lies inside it. */
function focalInImage(page: Page, focal: { x: number; y: number }) {
	return page.locator(`.${PROMO_CLASS.capture}`).evaluate((node, f) => {
		const img = node as HTMLImageElement;
		const box = img.getBoundingClientRect();
		const [nw, nh] = [img.naturalWidth, img.naturalHeight];
		const scale = Math.max(box.width / nw, box.height / nh);
		const [px, py] = getComputedStyle(img)
			.objectPosition.split(" ")
			.map(parseFloat);
		const x =
			box.left +
			((box.width - nw * scale) * px) / 100 +
			(f.x / 100) * nw * scale;
		const y =
			box.top +
			((box.height - nh * scale) * py) / 100 +
			(f.y / 100) * nh * scale;
		return x >= box.left && x <= box.right && y >= box.top && y <= box.bottom;
	}, focal);
}

/** Render one format with `copy`, then check P1-P4 on it. */
async function renderChecked(
	browser: Browser,
	format: PromoFormat,
	copy: PromoCopy,
	source: { image: Buffer; focal: Focal },
	out: { delivery: string; master: string },
): Promise<void> {
	const input = { ...source, format, copy, version: releaseVersion(), logoSvg };
	await renderPromo(browser, input, out, async (page) => {
		await expectNoClipping(page);
		if (source.focal) expect(await focalInImage(page, source.focal)).toBe(true);
		const version = page.locator(`.${PROMO_CLASS.version}`);
		if (copy.showVersion) await expect(version).toHaveText(`v${pkg.version}`);
		else await expect(version).toHaveCount(0);
	});
	const { width, height } = format;
	expect(pngDimensions(await readFile(out.delivery))).toEqual({
		width,
		height,
	});
	expect(pngDimensions(await readFile(out.master))).toEqual({
		width: width * 2,
		height: height * 2,
	});
}

/** `promo/<format>/<scene>-<theme>.png` and its `@2x` master, per requested format. */
async function writePromos(
	browser: Browser,
	name: string,
	source: { image: Buffer; focal: Focal },
): Promise<void> {
	for (const format of formats) {
		const dir = resolve(SHOWCASE_DIR, "promo", format.id);
		const { options, picked } = PROMO_COPY[format.id];
		await renderChecked(browser, format, options[picked], source, {
			delivery: resolve(dir, `${name}.png`),
			master: resolve(dir, `${name}@2x.png`),
		});
	}
}

/** Every requested scene x theme; returns the first scene's shots for the collage. */
async function captureAll(
	page: Page,
	browser: Browser,
	fixtures: Map<FixtureId, BuiltFixture>,
): Promise<ThemeShot[]> {
	const shots: ThemeShot[] = [];
	for (const preset of scenes) {
		for (const themeId of themes) {
			const name = themeName(themeId);
			const fixture = fixtureFor(fixtures, preset);
			await loadScene(page, preset, fixture, themeId);
			await expectAttribution(page, preset);
			const path = capturePath(preset.id, themeId);
			await mkdir(dirname(path), { recursive: true });
			const image = await captureScene(page, path);
			const focal = await sceneFocal(page, preset, fixture);
			await writePromos(browser, `${preset.id}-${themeId}`, { image, focal });
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

/** `captures/<quality>/run.json`: the sha, browser and scenes/themes just captured. */
async function writeRunInfo(page: Page): Promise<void> {
	const sha = execFileSync("git", ["rev-parse", "--short", "HEAD"], {
		encoding: "utf8",
	}).trim();
	const browser = (await page.context().browser()?.version()) ?? "unknown";
	const info: RunInfo = {
		sha,
		browser,
		capturedAt: new Date().toISOString(),
		scenes: scenes.map((scene) => scene.id),
		themes,
	};
	await writeFile(
		resolve(CAPTURE_DIR, "run.json"),
		`${JSON.stringify(info, null, 2)}\n`,
	);
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

test("capture showcase scenes", async ({ page, browser }) => {
	const perShot = 20_000 + 10_000 * formats.length;
	test.setTimeout(60_000 + perShot * scenes.length * themes.length);
	const fixtures = await buildFixtures(scenes.map((scene) => scene.fixture));
	await mkdir(CAPTURE_DIR, { recursive: true });
	await writeCfaDemo(fixtures);
	const pageErrors = await bootApp(page);
	const shots = await captureAll(page, browser, fixtures);
	await writeRunInfo(page);
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
): Promise<{ geometry: number[] } & Record<string, unknown>> {
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
		geometry: (JSON.parse(await cardGeometry(page)) as number[][]).flat(),
		theme: await page.locator("html").getAttribute("data-theme"),
		...state,
	};
}

test("scene reset: A → B → A", async ({ page }) => {
	const pageErrors = await bootApp(page);
	const roadraven = await buildFixture("roadraven");
	const timeline = getScene("rr-timeline");
	const first = await sceneSnapshot(page, timeline, roadraven, "dark");
	await sceneSnapshot(page, getScene("rr-detail"), roadraven, "light");
	const again = await sceneSnapshot(page, timeline, roadraven, "dark");
	// Fit-view's zoom differs in the ~7th digit between loads of the SAME scene
	// (a card moves ~1e-4 px), so geometry is compared to 0.005 px.
	const geometry = first.geometry.map((value) => expect.closeTo(value, 2));
	expect(again).toEqual({ ...first, geometry });
	expect(pageErrors).toEqual([]);
});

test("attribution comes from the plugin slot, not live events", async ({
	page,
}) => {
	const pageErrors = await bootApp(page);
	const roadraven = await buildFixture("roadraven");
	await loadScene(page, getScene("rr-timeline"), roadraven, "dark");
	const badge = (id: string) => page.locator(`[${NODE_PLUGIN_ATTR}="${id}"]`);
	expect(await badge("claude-code").count()).toBeGreaterThan(0);
	expect(await badge("github-actions").count()).toBeGreaterThan(0);
	const cfa = await buildFixture("cfa");
	await loadScene(page, getScene("cfa-overview"), cfa, "dark");
	await expect(page.locator(`[${NODE_PLUGIN_ATTR}]`)).toHaveCount(0);
	expect(pageErrors).toEqual([]);
});

test("promo formats", async ({ page, browser }) => {
	test.setTimeout(180_000);
	const pageErrors = await bootApp(page);
	const preset = getScene("rr-timeline");
	const fixture = await buildFixture(preset.fixture);
	await loadScene(page, preset, fixture, "dark");
	const image = await captureScene(page, test.info().outputPath("source.png"));
	const focal = await sceneFocal(page, preset, fixture);
	expect(focal).not.toBeNull();
	// Every drafted option renders unclipped; social-card covers both version rules.
	const versions = new Set<boolean>();
	for (const format of PROMO_FORMATS) {
		for (const [i, copy] of PROMO_COPY[format.id].options.entries()) {
			versions.add(copy.showVersion === true);
			await renderChecked(
				browser,
				format,
				copy,
				{ image, focal },
				{
					delivery: test.info().outputPath(`${format.id}-${i}.png`),
					master: test.info().outputPath(`${format.id}-${i}@2x.png`),
				},
			);
		}
	}
	expect([...versions].sort()).toEqual([false, true]);
	expect(pageErrors).toEqual([]);
});
