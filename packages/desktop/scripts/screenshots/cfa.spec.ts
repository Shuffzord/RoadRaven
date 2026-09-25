import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { expect, type Page, test } from "@playwright/test";
import {
	type NodeStatus,
	type RoadmapNode,
	type RoadmapSchema,
	RoadmapSchemaSchema,
} from "../../../core/src/schema";
import { resolveRefsWithOwnership } from "../../src/bun/resolveRefs";
import {
	NODE_CARD_ATTR,
	NODE_STATUS_ATTR,
} from "../../src/mainview/lib/domContract";
import { getBuiltInTheme } from "../../src/mainview/themes";
import { captureCollage, type ThemeShot } from "./collage";

const root = resolve(__dirname, "../../../..");
const source = resolve(root, "samples/cfa-l1-roadmap.json");
const output = resolve(root, "screenshots/cfa-l1");

function setBranchStatus(node: RoadmapNode, status: NodeStatus): void {
	node.status = status;
	for (const child of node.children ?? []) setBranchStatus(child, status);
}

// A deterministic study progression, applied only to the in-memory copy.
function startTopic(topic: RoadmapNode, completedModules: number): void {
	topic.status = "in-progress";
	const modules = topic.children ?? [];
	for (const module of modules.slice(0, completedModules)) {
		setBranchStatus(module, "completed");
	}
	const active = modules[completedModules];
	if (!active) return;
	active.status = "in-progress";
	for (const [i, child] of (active.children ?? []).entries()) {
		setBranchStatus(child, i < 2 ? "completed" : "not-started");
		if (i === 2) child.status = "in-progress";
	}
}

async function loadScene(
	page: Page,
	schema: RoadmapSchema,
	theme: string,
	selected = false,
): Promise<void> {
	// These imports execute inside Chromium, where Vite serves the live UI modules.
	await page.evaluate(
		async ({ demo, themeId, showDetails }) => {
			const storePath = "/store/roadmapStore.ts";
			const viewPath = "/store/fileViewStore.ts";
			const themePath = "/store/themeStore.ts";
			const { useRoadmapStore } = await import(storePath);
			const { useFileViewStore } = await import(viewPath);
			const { useThemeStore } = await import(themePath);
			useRoadmapStore.getState().loadSchema(demo, "cfa-l1-demo.json");
			useRoadmapStore.getState().setLayout("LR");
			useFileViewStore.getState().collapseToDepth(1, demo.nodes);
			useThemeStore.getState().setTheme(themeId);
			if (showDetails)
				useRoadmapStore.getState().setSelectedNode(demo.nodes[0].id);
		},
		{ demo: schema, themeId: theme, showDetails: selected },
	);
	await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
	await expect(page.locator(`[${NODE_CARD_ATTR}]`)).toHaveCount(
		1 + (schema.nodes[0].children?.length ?? 0),
	);
}

async function capture(page: Page, filename: string): Promise<Buffer> {
	await page.evaluate(async () => {
		await document.fonts.ready;
		window.dispatchEvent(new CustomEvent("roadraven:fit-view"));
	});
	// Wait for actual rendered geometry to settle, rather than a fixed sleep.
	let previous = "";
	await expect
		.poll(async () => {
			const geometry = await page
				.locator(`[${NODE_CARD_ATTR}]`)
				.evaluateAll((cards) =>
					JSON.stringify(
						cards.map((card) => {
							const r = card.getBoundingClientRect();
							return [r.x, r.y, r.width, r.height];
						}),
					),
				);
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
		path: resolve(output, filename),
		animations: "disabled",
		caret: "hide",
	});
}

async function captureThemes(
	page: Page,
	schema: RoadmapSchema,
	detail: RoadmapSchema,
): Promise<void> {
	const themes = (process.env.ROADRAVEN_CAPTURE_THEMES ?? "dark").split(",");
	const shots: ThemeShot[] = [];
	for (const [index, themeId] of themes.entries()) {
		const theme = getBuiltInTheme(themeId);
		if (!theme) throw new Error(`Unknown built-in theme: ${themeId}`);
		await loadScene(page, schema, themeId);
		const overview = await capture(page, `overview-${themeId}.png`);
		shots.push({
			name: theme.meta.name,
			image: `data:image/png;base64,${overview.toString("base64")}`,
		});
		await loadScene(page, detail, themeId, true);
		const details = await capture(page, `quant-details-${themeId}.png`);
		// Stable README paths always show the first theme requested in this run.
		if (index === 0) {
			await writeFile(resolve(output, "overview.png"), overview);
			await writeFile(resolve(output, "quant-details.png"), details);
		}
	}
	if (process.env.ROADRAVEN_CAPTURE_COLLAGE === "1") {
		await captureCollage(page, shots, resolve(output, "theme-collage.png"));
	}
}

test("generate CFA study-progress screenshots", async ({ page }) => {
	const pageErrors: string[] = [];
	page.on("pageerror", (error) => pageErrors.push(error.message));
	const originals = new Map<string, string>();
	const readSource = async (path: string) => {
		const text = await readFile(path, "utf8");
		originals.set(path, text);
		return text;
	};
	const schema = RoadmapSchemaSchema.parse(
		JSON.parse(await readSource(source)),
	);
	schema.nodes = await resolveRefsWithOwnership(schema.nodes, source, source, {
		readFile: readSource,
	});
	const assertResolved = (node: RoadmapNode): void => {
		expect(node.$ref, `unresolved reference on ${node.title}`).toBeUndefined();
		for (const child of node.children ?? []) assertResolved(child);
	};
	schema.nodes.forEach(assertResolved);
	const exam = schema.nodes[0];
	const topics = exam.children ?? [];
	expect(topics).toHaveLength(10);
	setBranchStatus(exam, "not-started");
	exam.status = "in-progress";
	setBranchStatus(topics[0], "completed");
	startTopic(topics[1], 3);
	startTopic(topics[2], 1);
	RoadmapSchemaSchema.parse(schema);
	await mkdir(output, { recursive: true });
	await writeFile(
		resolve(output, "cfa-l1-demo.json"),
		`${JSON.stringify(schema, null, 2)}\n`,
	);

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

	// A close-up of the active Quant module, keeping its original notes/tasks.
	const activeModule = topics[1].children?.[3];
	expect(activeModule).toBeDefined();
	if (!activeModule)
		throw new Error("Expected an active Quantitative Methods module");
	const detail = {
		...schema,
		title: `${exam.title} — Quantitative Methods`,
		nodes: [activeModule],
	};
	await captureThemes(page, schema, detail);
	expect(pageErrors).toEqual([]);

	// The full demo is portable; the source and its linked files stay byte-identical.
	for (const [path, original] of originals) {
		expect(await readFile(path, "utf8"), `source changed: ${path}`).toBe(
			original,
		);
	}
});
