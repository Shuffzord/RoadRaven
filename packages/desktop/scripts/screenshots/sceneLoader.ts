import { resolve } from "node:path";
import { expect, type Page } from "@playwright/test";
import {
	NODE_CARD_ATTR,
	NODE_PLUGIN_ATTR,
	NODE_STATUS_ATTR,
} from "../../src/mainview/lib/domContract";
import type { BuiltFixture } from "./fixtures/index";
import { qualityFromEnv } from "./quality";
import type { ScenePreset } from "./scenes";

/** The requested quality, read once; also the output path's quality segment. */
export const CAPTURE_QUALITY = qualityFromEnv();
export const SHOWCASE_DIR = resolve(
	__dirname,
	"../../../../artifacts/showcase",
);
export const CAPTURE_DIR = resolve(SHOWCASE_DIR, "captures", CAPTURE_QUALITY);

export function capturePath(sceneId: string, themeId: string): string {
	return resolve(CAPTURE_DIR, sceneId, `${themeId}.png`);
}

/** A preset reference is an anchor name when the fixture has one, else a node id. */
export function resolveNodeRef(
	ref: string | undefined,
	fixture: BuiltFixture,
): string | undefined {
	return ref === undefined ? undefined : (fixture.anchors[ref] ?? ref);
}

/**
 * Load a scene with an explicit reset of everything a previous scene can leave
 * behind: per-file view state, document, layout, collapse set, selection, theme.
 */
export async function loadScene(
	page: Page,
	preset: ScenePreset,
	fixture: BuiltFixture,
	themeId: string,
): Promise<void> {
	await page.setViewportSize(preset.viewport);
	// These imports execute inside Chromium, where Vite serves the live UI modules.
	await page.evaluate(
		async ({ schema, fileName, layout, depth, selected, theme }) => {
			const storePath = "/store/roadmapStore.ts";
			const viewPath = "/store/fileViewStore.ts";
			const themePath = "/store/themeStore.ts";
			const { useRoadmapStore } = await import(storePath);
			const { useFileViewStore } = await import(viewPath);
			const { useThemeStore } = await import(themePath);
			const view = useFileViewStore.getState();
			const roadmap = useRoadmapStore.getState();
			view.resetForNewFile();
			roadmap.loadSchema(schema, fileName);
			roadmap.setLayout(layout);
			if (depth === null) view.expandAll();
			else view.collapseToDepth(depth, schema.nodes);
			roadmap.setSelectedNode(selected);
			useThemeStore.getState().setTheme(theme);
		},
		{
			schema: fixture.schema,
			fileName: `${preset.id}.json`,
			layout: preset.layout,
			depth: preset.collapseDepth ?? null,
			selected: resolveNodeRef(preset.selectedNode, fixture) ?? null,
			theme: themeId,
		},
	);
	await expect(page.locator("html")).toHaveAttribute("data-theme", themeId);
	await expect(page.locator(`[${NODE_CARD_ATTR}]`)).toHaveCount(
		preset.expectedCards,
	);
}

/** Every card's bounding box, serialised: the geometry the capture waits on. */
export function cardGeometry(page: Page): Promise<string> {
	return page.locator(`[${NODE_CARD_ATTR}]`).evaluateAll((cards) =>
		JSON.stringify(
			cards.map((card) => {
				const r = card.getBoundingClientRect();
				return [r.x, r.y, r.width, r.height];
			}),
		),
	);
}

/** The preset's attribution contract, checked against the rendered badges. */
export async function expectAttribution(
	page: Page,
	preset: ScenePreset,
): Promise<void> {
	if (preset.attribution === "none") {
		await expect(page.locator(`[${NODE_PLUGIN_ATTR}]`)).toHaveCount(0);
		return;
	}
	for (const pluginId of preset.attribution) {
		await expect(
			page.locator(`[${NODE_PLUGIN_ATTR}="${pluginId}"]`).first(),
		).toBeVisible();
	}
}

/** Fit the camera, wait for geometry to settle, then screenshot. */
export async function captureScene(page: Page, path: string): Promise<Buffer> {
	await page.evaluate(async () => {
		await document.fonts.ready;
		window.dispatchEvent(new CustomEvent("roadraven:fit-view"));
	});
	// Wait for actual rendered geometry to settle, rather than a fixed sleep.
	let previous = "";
	await expect
		.poll(async () => {
			const geometry = await cardGeometry(page);
			const settled = geometry === previous;
			previous = geometry;
			return settled;
		})
		.toBe(true);
	await expect(
		page.locator(`[${NODE_STATUS_ATTR}="completed"]`).first(),
	).toBeVisible();
	await expect(
		page.locator(`[${NODE_STATUS_ATTR}="in-progress"]`).first(),
	).toBeVisible();
	await page.mouse.move(0, 0);
	return page.screenshot({
		path,
		animations: "disabled",
		caret: "hide",
		scale: "device",
	});
}
