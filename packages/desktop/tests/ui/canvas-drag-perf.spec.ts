import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { emptyCanvasPoint } from "./helpers/canvasGestures";
import { seedSchema } from "./helpers/seed";

// v0.8.1 Phase 1 perf gate — .planning/v0.8.1-canvas-focus-PLAN.md.
//
// Syncing every d3 gesture frame into the Zustand store re-renders Canvas ->
// Tree -> every node card (react-d3-tree hands each Node a fresh
// `subscriptions` object per render, so memoisation does not help). This probe
// measures what that costs on the 300-node fixture: a paced 60-step drag on
// the empty svg background with a requestAnimationFrame recorder running in
// the page. A stretched rAF interval is main-thread blocking.
//
// Like context-menu-50ms.spec.ts this runs against `bunx vite` in dev mode, so
// the ceilings carry dev-mode slack and are documented, not guessed.

const LARGE_FIXTURE = join(__dirname, "../fixtures/large-schema.json");

const DRAG_STEPS = 60;
const DRAG = { dx: -240, dy: 180 };
// One move per display frame — models a real 60 Hz drag rather than a burst of
// CDP round-trips, and yields ~60 rAF samples to take a median/p95 from.
const STEP_INTERVAL_MS = 16;

/**
 * Phase 1 budget (plan, "Perf gate"): p95 frame interval <= 34 ms in dev (two
 * 60 Hz frames) and median no worse than +25% over the pre-change baseline.
 *
 * Baseline measured on the UNMODIFIED renderer before the viewport-sync change
 * (3 runs, commit c6a4566): median 16.7 / 16.7 / 16.7 ms, p95 16.8 / 16.7 /
 * 16.7 ms, max 16.8 ms in all three. The +25% median budget is therefore
 * 20.9 ms; MEDIAN_CEILING_MS below rounds it to 21.
 *
 * `max` is deliberately NOT asserted: one GC / scheduler spike is enough to
 * move it and it carries no information the p95 does not.
 */
const MEDIAN_CEILING_MS = 21;
const P95_CEILING_MS = 34;

interface FrameStats {
	frames: number;
	median: number;
	p95: number;
	max: number;
}

async function seedLarge(page: Page): Promise<void> {
	const schema = JSON.parse(readFileSync(LARGE_FIXTURE, "utf-8"));
	await seedSchema(page, schema);
	await page.waitForSelector("[data-source-id]");
}

async function startFrameRecorder(page: Page): Promise<void> {
	await page.evaluate(() => {
		const w = window as unknown as { __rafTimes: number[]; __rafStop: boolean };
		w.__rafTimes = [];
		w.__rafStop = false;
		const tick = (t: number): void => {
			w.__rafTimes.push(t);
			if (!w.__rafStop) requestAnimationFrame(tick);
		};
		requestAnimationFrame(tick);
	});
}

async function stopFrameRecorder(page: Page): Promise<FrameStats> {
	return page.evaluate(() => {
		const w = window as unknown as { __rafTimes: number[]; __rafStop: boolean };
		w.__rafStop = true;
		const times = w.__rafTimes;
		const gaps = times.slice(1).map((t, i) => t - times[i]);
		const sorted = [...gaps].sort((a, b) => a - b);
		const quantile = (q: number): number =>
			sorted.length === 0
				? 0
				: sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))];
		return {
			frames: gaps.length,
			median: quantile(0.5),
			p95: quantile(0.95),
			max: sorted.length === 0 ? 0 : sorted[sorted.length - 1],
		};
	});
}

async function pacedDrag(page: Page): Promise<FrameStats> {
	const p = await emptyCanvasPoint(page, DRAG.dx, DRAG.dy);
	await page.mouse.move(p.x, p.y);
	await page.mouse.down();
	await startFrameRecorder(page);
	for (let i = 1; i <= DRAG_STEPS; i++) {
		await page.mouse.move(
			p.x + (DRAG.dx * i) / DRAG_STEPS,
			p.y + (DRAG.dy * i) / DRAG_STEPS,
		);
		await page.waitForTimeout(STEP_INTERVAL_MS);
	}
	const stats = await stopFrameRecorder(page);
	await page.mouse.up();
	return stats;
}

test.describe("Canvas drag frame budget (v0.8.1 Phase 1)", () => {
	// Same reasoning as canvas-focus.spec.ts: this file owns a wall-clock
	// budget, so it must not compete with its own parallel siblings.
	test.describe.configure({ mode: "default" });

	test(`a 60-step drag on a 300-node tree stays under ${P95_CEILING_MS}ms p95 (dev)`, async ({
		page,
	}, testInfo) => {
		await seedLarge(page);
		// One warm-up drag absorbs first-gesture cost (d3 listener bind, first
		// React commit for the fixture) exactly as medianOfFive does in
		// context-menu-50ms.spec.ts.
		await pacedDrag(page);
		const stats = await pacedDrag(page);
		const observed = { nodes: 307, steps: DRAG_STEPS, ...stats };
		console.log(JSON.stringify(observed));
		await testInfo.attach("observed", {
			body: JSON.stringify(observed, null, 2),
			contentType: "application/json",
		});

		expect(stats.frames).toBeGreaterThan(30);
		expect(stats.median).toBeLessThanOrEqual(MEDIAN_CEILING_MS);
		expect(stats.p95).toBeLessThanOrEqual(P95_CEILING_MS);
	});
});
