import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { CONTRAST_PAIRS, THEME_IDS } from "../../../../shared/themeContract";
import {
	readSampleInPage,
	renderReport,
	SAMPLES,
	type SampleFinding,
	type SampleStage,
	scoreSample,
} from "./contrastSampler";

// Rendered contrast gate (v0.8.3 Phase 1).
//
// Pre-condition: `bun run --cwd packages/desktop build` has produced dist/;
// vite preview serves it on port 4173 (see playwright.config.ts).
//
// For every shipped theme this reads the computed colours of real elements
// on the Hello World sample (see SAMPLES in contrastSampler.ts) and scores
// them with the Phase 0 pair registry. Required-tier failures must be listed
// in known-failures.json — a snapshot of today's rendered debt that Phase 2
// burns down; a new failure fails, and a baseline row that starts passing
// fails too, so the list can only shrink. Every ratio, advisory rows
// included, goes to test-results/contrast-report.md.
//
// Selectors: the card is `[data-source-id]` and the canvas wrapper is
// `[role="application"]`, as in audit.spec.ts (RoadmapNode.tsx:238,
// Canvas.tsx:322). Theme switching sets `data-theme` on <html> directly, as
// ThemeProvider.tsx does — the Zustand path would call the saveSettings RPC,
// which does not exist under vite preview.

const DIST_DIR = join(process.cwd(), "dist");
test.skip(
	!existsSync(DIST_DIR),
	"packages/desktop/dist/ missing — run `bun run --cwd packages/desktop build` first",
);

// Playwright's outputDir, cleaned at the start of every run.
const RESULTS_DIR = join(process.cwd(), "test-results");
const REPORT_PATH = join(RESULTS_DIR, "contrast-report.md");
const BASELINE_PATH = join(__dirname, "known-failures.json");

type KnownFailure = { theme: string; sampleId: string };
const baseline: KnownFailure[] = existsSync(BASELINE_PATH)
	? JSON.parse(readFileSync(BASELINE_PATH, "utf8"))
	: [];
const baselineKeys = new Set(baseline.map((b) => `${b.theme}/${b.sampleId}`));

/**
 * Each theme's findings go to their own JSON file and the report is rebuilt
 * from every theme sampled so far. Playwright restarts the worker after a
 * failing test, so module state (and an afterAll hook) would only ever see
 * the last worker's themes.
 */
function persist(theme: string, mine: SampleFinding[]): void {
	const dir = join(RESULTS_DIR, "contrast");
	mkdirSync(dir, { recursive: true });
	writeFileSync(join(dir, `${theme}.json`), JSON.stringify(mine, null, 2));
	const all = THEME_IDS.flatMap((t) => {
		const file = join(dir, `${t}.json`);
		return existsSync(file)
			? (JSON.parse(readFileSync(file, "utf8")) as SampleFinding[])
			: [];
	});
	writeFileSync(REPORT_PATH, renderReport(all, baselineKeys));
}

async function loadHelloWorld(page: Page, theme: string): Promise<void> {
	await page.goto("/");
	await page.waitForLoadState("networkidle");
	await page.getByRole("button", { name: "Hello World" }).click();
	await page.waitForSelector('[role="application"]', { timeout: 5000 });
	await page.waitForSelector("[data-source-id]", { timeout: 5000 });
	// Cards transition background/colour over 150ms; a computed colour read
	// mid-transition is an interpolated one, so transitions are off.
	await page.addStyleTag({
		content:
			"*, *::before, *::after { transition: none !important; animation: none !important; }",
	});
	await page.evaluate((t) => {
		document.documentElement.setAttribute("data-theme", t);
	}, theme);
}

async function readStage(
	page: Page,
	theme: string,
	stage: SampleStage,
): Promise<SampleFinding[]> {
	const out: SampleFinding[] = [];
	for (const spec of SAMPLES.filter((s) => s.stage === stage)) {
		const reading = await page.evaluate(readSampleInPage, spec);
		out.push(scoreSample(theme, spec, reading));
	}
	return out;
}

/** Walks the three stages and returns one finding per sample. */
async function sampleTheme(
	page: Page,
	theme: string,
): Promise<SampleFinding[]> {
	await loadHelloWorld(page, theme);
	const mine = await readStage(page, theme, "page");

	// File menu (TopBar.tsx "File" trigger; items from FileMenu.tsx).
	await page
		.getByRole("toolbar")
		.getByRole("button", { name: "File", exact: true })
		.click();
	await page.waitForSelector('[role="menu"]', { timeout: 3000 });
	mine.push(...(await readStage(page, theme, "menu")));
	await page.keyboard.press("Escape");

	// Keyboard focus ring: select a card, then any key puts the app in
	// keyboard mode (useKeyboardRouter.ts KEYBOARD_NAV_CLASS), which is what
	// shows the ring on the focused card (index.css:786).
	await page.locator("[data-source-id]").first().click();
	await page.keyboard.press("Shift");
	await page.waitForSelector('[data-source-id][data-focused="true"]', {
		timeout: 3000,
	});
	mine.push(...(await readStage(page, theme, "focus")));
	return mine;
}

test.describe("Rendered contrast (production bundle, vite preview port 4173)", () => {
	test("known-failures.json names only shipped themes and registered samples", () => {
		const sampleIds = new Set(SAMPLES.map((s) => s.id));
		for (const row of baseline) {
			expect(THEME_IDS, `${row.theme}/${row.sampleId}`).toContain(row.theme);
			expect(sampleIds.has(row.sampleId), `${row.theme}/${row.sampleId}`).toBe(
				true,
			);
		}
	});

	test("every sample maps to a registered pair", () => {
		const pairIds = new Set(CONTRAST_PAIRS.map((p) => p.id));
		const unknown = SAMPLES.filter((s) => !pairIds.has(s.pairId)).map(
			(s) => `${s.id} -> ${s.pairId}`,
		);
		expect(unknown).toEqual([]);
	});

	for (const theme of THEME_IDS) {
		test(`theme '${theme}': every rendered required-tier failure is in known-failures.json`, async ({
			page,
		}) => {
			const mine = await sampleTheme(page, theme);
			persist(theme, mine);

			const unmeasured = mine
				.filter((f) => f.reason)
				.map((f) => `${f.sampleId}: ${f.reason}`);
			expect(
				unmeasured,
				"every sample must resolve to a painted element",
			).toEqual([]);

			const unexpected = mine
				.filter(
					(f) =>
						f.tier === "required" &&
						!f.pass &&
						!baselineKeys.has(`${theme}/${f.sampleId}`),
				)
				.map(
					(f) =>
						`${f.sampleId} (${f.pairId}) ${f.ink} on ${f.surface} ${f.ratio.toFixed(2)}:1 < ${f.min}`,
				);
			expect(unexpected).toEqual([]);

			const stale = baseline
				.filter((b) => b.theme === theme)
				.filter((b) => mine.find((f) => f.sampleId === b.sampleId)?.pass)
				.map((b) => `remove ${theme}/${b.sampleId} from known-failures.json`);
			expect(stale).toEqual([]);
		});
	}
});
