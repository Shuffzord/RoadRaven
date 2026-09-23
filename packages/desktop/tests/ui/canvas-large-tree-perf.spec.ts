import { expect, type Page, test } from "@playwright/test";
import type {
	NodeStatus,
	RoadmapNode,
	RoadmapSchema,
} from "../../../../packages/core/src/schema";
import { emptyCanvasPoint } from "./helpers/canvasGestures";
import { seedSchema } from "./helpers/seed";

/**
 * Large-tree interaction probe (v0.8.1 closing perf review).
 *
 * The owner reported "a slight stutter with a huge canvas with 1.4k nodes when
 * creating a new node". `canvas-drag-perf.spec.ts` covers gesture frames on a
 * 300-node tree; this file covers the keyboard/pointer interactions on a tree
 * 4.5x that size, where every Canvas render re-renders every mounted card.
 *
 * Everything is measured from inside the page with APIs the app does not know
 * about (rAF intervals, `PerformanceObserver` long tasks, the rd3t `<g>`
 * transform, `document.activeElement`), so the identical spec can be dropped
 * into an older checkout to produce a comparable A/B. No application source
 * hooks, no test-only props.
 *
 * Budgets carry dev-mode slack and are documented next to their constants; the
 * CI step that runs this file is non-blocking for the same reason
 * `context-menu-50ms.spec.ts` is.
 */

// ---------------------------------------------------------------- fixture

const TOTAL_NODES = 1400;

/**
 * Children per node at depth 0/1/2/3, filled BREADTH-first.
 *
 * `tests/bench/generateSchema.ts` fills depth-first under a hard depth cap, so
 * at 1400 nodes it degenerates: the root gets 2 children, one of which holds
 * 1365 nodes, and 1047 nodes pile onto a single leaf row. That is not the
 * shape a roadmap has. This fan-out is a milestones -> epics -> stories ->
 * tasks tree: 1 + 8 + 48 + 240 + 1103 = 1400 nodes over 5 levels, with only
 * the last level partially filled.
 */
const BRANCHING = [8, 6, 5, 5];

const STATUSES: NodeStatus[] = [
	"not-started",
	"in-progress",
	"completed",
	"blocked",
];

/**
 * A depth-3 node that the default camera already frames (verified: at the
 * post-load transform `translate(400,50) scale(0.8)` the only cards inside a
 * 1280x720 viewport are the root, `n173` and `n173`'s five children). Mid-tree
 * and on screen is what a user's create actually looks like, and starting from
 * a visible card keeps the probe independent of every camera behaviour the
 * branch changed.
 */
const TARGET_ID = "n173";

function makeNode(i: number): RoadmapNode {
	return {
		id: `n${i}`,
		title: `Node ${i}`,
		status: STATUSES[i % STATUSES.length],
		type: i === 0 ? "milestone" : "task",
		createdAt: "2026-01-01T00:00:00Z",
		updatedAt: "2026-01-01T00:00:00Z",
	};
}

function buildLargeSchema(): RoadmapSchema {
	const root = makeNode(0);
	const queue: { node: RoadmapNode; depth: number }[] = [
		{ node: root, depth: 0 },
	];
	let count = 1;
	while (count < TOTAL_NODES) {
		const head = queue.shift();
		if (!head) break;
		const fanout = BRANCHING[head.depth];
		if (!fanout) continue;
		const children: RoadmapNode[] = [];
		for (let i = 0; i < fanout && count < TOTAL_NODES; i++) {
			const child = makeNode(count);
			count += 1;
			children.push(child);
			queue.push({ node: child, depth: head.depth + 1 });
		}
		head.node.children = children;
	}
	return {
		version: "1.0",
		title: "Large tree perf fixture",
		statusConfig: [
			{ id: "not-started", label: "Not Started" },
			{ id: "in-progress", label: "In Progress" },
			{ id: "completed", label: "Completed" },
			{ id: "blocked", label: "Blocked" },
		],
		nodes: [root],
	};
}

// ------------------------------------------------------------ in-page probe

interface KeySample {
	key: string;
	latency: number;
}

interface Recording {
	frames: number;
	frameMedian: number;
	frameP95: number;
	frameMax: number;
	framesOver50: number;
	longTasks: number;
	/** Total Blocking Time: sum of (long task - 50ms) inside the window. */
	blockedMs: number;
	longestTaskMs: number;
	/** ms from recording start to the last change of the rd3t <g> transform. */
	animationMs: number;
	/** Frames on which the <g> transform differed from the previous frame. */
	transformWrites: number;
	keys: KeySample[];
	inputFocusMs: number | null;
	menuMs: number | null;
}

interface Rec {
	t0: number;
	raf: number[];
	tr: string[];
	tasks: number[];
	keys: KeySample[];
	stop: boolean;
	inputFocusAt: number | null;
	menuAt: number | null;
}

interface RecWindow extends Window {
	__rrRec?: Rec;
}

const RENAME_INPUT = 'input[aria-label="Rename node"]';

/**
 * Start sampling. One rAF loop records both the frame clock and the camera
 * transform (an attribute read, far cheaper than a per-frame querySelector).
 * `keydown` is captured on `window`, which in the capture phase runs BEFORE
 * the router's own document-capture handler, and the next-paint stamp is
 * taken in a `setTimeout` chained off the following frame.
 */
async function startRecording(page: Page): Promise<void> {
	await page.evaluate(() => {
		const w = window as RecWindow;
		const rec: Rec = {
			t0: performance.now(),
			raf: [],
			tr: [],
			tasks: [],
			keys: [],
			stop: false,
			inputFocusAt: null,
			menuAt: null,
		};
		w.__rrRec = rec;
		let g = document.querySelector("g.rd3t-g");
		const tick = (t: number): void => {
			if (!g?.isConnected) g = document.querySelector("g.rd3t-g");
			rec.raf.push(t);
			rec.tr.push(g?.getAttribute("transform") ?? "");
			if (!rec.stop) requestAnimationFrame(tick);
		};
		requestAnimationFrame(tick);
		const observer = new PerformanceObserver((list) => {
			for (const entry of list.getEntries()) rec.tasks.push(entry.duration);
		});
		observer.observe({ entryTypes: ["longtask"] });
		window.addEventListener(
			"keydown",
			(e: KeyboardEvent) => {
				const start = performance.now();
				requestAnimationFrame(() => {
					setTimeout(() => {
						rec.keys.push({ key: e.key, latency: performance.now() - start });
					}, 0);
				});
			},
			true,
		);
	});
}

async function stopRecording(page: Page): Promise<Recording> {
	return page.evaluate(() => {
		const rec = (window as RecWindow).__rrRec;
		if (!rec) throw new Error("recorder was never started");
		rec.stop = true;
		const gaps = rec.raf.slice(1).map((t, i) => t - rec.raf[i]);
		const sorted = [...gaps].sort((a, b) => a - b);
		const quantile = (q: number): number =>
			sorted.length === 0
				? 0
				: sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))];
		let transformWrites = 0;
		let lastChange = 0;
		for (let i = 1; i < rec.tr.length; i++) {
			if (rec.tr[i] !== rec.tr[i - 1]) {
				transformWrites += 1;
				lastChange = rec.raf[i] - rec.t0;
			}
		}
		const round = (n: number): number => Math.round(n * 10) / 10;
		return {
			frames: gaps.length,
			frameMedian: round(quantile(0.5)),
			frameP95: round(quantile(0.95)),
			frameMax: round(sorted.length === 0 ? 0 : sorted[sorted.length - 1]),
			framesOver50: gaps.filter((gap) => gap > 50).length,
			longTasks: rec.tasks.length,
			blockedMs: round(
				rec.tasks.reduce((sum, d) => sum + Math.max(0, d - 50), 0),
			),
			longestTaskMs: round(rec.tasks.length === 0 ? 0 : Math.max(...rec.tasks)),
			animationMs: round(lastChange),
			transformWrites,
			keys: rec.keys.map((k) => ({ key: k.key, latency: round(k.latency) })),
			inputFocusMs:
				rec.inputFocusAt === null ? null : round(rec.inputFocusAt - rec.t0),
			menuMs: rec.menuAt === null ? null : round(rec.menuAt - rec.t0),
		};
	});
}

/** Wait for the camera to stop moving, using the recorder's own transform tape. */
async function waitForCameraSettled(
	page: Page,
	stableFrames = 10,
): Promise<void> {
	await page.waitForFunction(
		(n) => {
			const rec = (window as RecWindow).__rrRec;
			if (!rec || rec.tr.length < n + 5) return false;
			const tail = rec.tr.slice(-n);
			return tail.every((t) => t === tail[0]);
		},
		stableFrames,
		{ timeout: 30_000, polling: "raf" },
	);
}

/** Camera settle for the phases with no recorder running (seed, warm-up). */
async function settle(page: Page, stableFrames = 10): Promise<void> {
	await page.waitForFunction(
		(n) => {
			const w = window as Window & { __rrSettle?: { last: string; n: number } };
			const cur =
				document.querySelector("g.rd3t-g")?.getAttribute("transform") ?? "";
			const s = w.__rrSettle ?? { last: cur, n: 0 };
			s.n = s.last === cur ? s.n + 1 : 0;
			s.last = cur;
			w.__rrSettle = s;
			return s.n >= n;
		},
		stableFrames,
		{ timeout: 30_000, polling: "raf" },
	);
	await page.evaluate(() => {
		(window as Window & { __rrSettle?: unknown }).__rrSettle = undefined;
	});
}

async function seedLargeTree(page: Page): Promise<void> {
	await seedSchema(page, buildLargeSchema());
	await page.waitForSelector("[data-source-id]");
	await page.waitForFunction(
		(n) => document.querySelectorAll("[data-source-id]").length >= n,
		TOTAL_NODES,
		{ timeout: 60_000 },
	);
	await settle(page);
}

async function cardCentre(
	page: Page,
	nodeId: string,
): Promise<{ x: number; y: number }> {
	const box = await page.locator(`[data-source-id="${nodeId}"]`).boundingBox();
	if (!box) throw new Error(`card ${nodeId} has no box`);
	return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** Click a card and let its reveal plus the SidePanel transition finish. */
async function clickAndSettle(page: Page, nodeId: string): Promise<void> {
	const p = await cardCentre(page, nodeId);
	await page.mouse.click(p.x, p.y);
	await page.waitForTimeout(400);
	await settle(page);
}

/**
 * Press one key and wait until its own next-paint sample has landed.
 *
 * A fixed inter-key delay is useless here: one arrow press costs several
 * hundred ms on this tree, so CDP keeps dispatching while the main thread is
 * still busy and every early sample then measures the whole backlog instead
 * of its own key (observed: 924, 467, 3617, 3124, 2573... a queue draining,
 * not ten key costs). Pacing on the sample gives each press an idle start.
 */
async function pressPaced(
	page: Page,
	key: string,
	expectedSamples: number,
): Promise<void> {
	await page.keyboard.press(key);
	await page.waitForFunction(
		(n) => ((window as RecWindow).__rrRec?.keys.length ?? 0) >= n,
		expectedSamples,
		{ timeout: 30_000, polling: "raf" },
	);
}

function log(scenario: string, data: Record<string, unknown>): void {
	console.log(JSON.stringify({ scenario, nodes: TOTAL_NODES, ...data }));
}

function percentile(values: number[], q: number): number {
	if (values.length === 0) return 0;
	const sorted = [...values].sort((a, b) => a - b);
	return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))];
}

// ------------------------------------------------------------------ budgets

/**
 * Dev-mode ceilings: ~3x the worst sample measured over 6 interleaved runs of
 * this file on an unfixed tree (plan: "Large-tree performance" — worst
 * samples were 785 ms to input focus, 657 ms blocked, 283 ms keystroke p95,
 * 678 ms worst arrow, 274 ms menu open, 272 ms blocked on a click).
 *
 * 3x, not 2x: this runs on `bunx vite` in dev (React StrictMode renders every
 * component twice) and the CI step is a shared 2-vCPU runner. The budgets are
 * here to catch a doubling of interaction cost, not to police tens of ms, and
 * the CI step is non-blocking for the same reason `context-menu-50ms.spec.ts`
 * is. The gesture budget is the exception: frame intervals are pinned to the
 * display clock, so 34 ms (two 60 Hz frames) is the same real budget
 * `canvas-drag-perf.spec.ts` uses.
 */
const CREATE_INPUT_FOCUS_CEILING_MS = 2500;
const CREATE_BLOCKED_CEILING_MS = 2000;
const KEYSTROKE_P95_CEILING_MS = 900;
const ARROW_WORST_CEILING_MS = 2000;
const MENU_OPEN_CEILING_MS = 900;
const GESTURE_P95_CEILING_MS = 34;
const CLICK_BLOCKED_CEILING_MS = 1000;

test.describe(`Large-tree interaction budget (${TOTAL_NODES} nodes)`, () => {
	// Wall-clock budgets: never share the CPU with a sibling worker.
	test.describe.configure({ mode: "default" });
	test.setTimeout(180_000);

	test("(a) Enter creates a node, opens its rename input and settles the camera", async ({
		page,
	}) => {
		await seedLargeTree(page);
		await clickAndSettle(page, TARGET_ID);

		await startRecording(page);
		await page.keyboard.press("Enter");
		await page.waitForFunction(
			(selector) => {
				const rec = (window as RecWindow).__rrRec;
				const input = document.querySelector(selector);
				if (!rec || !input || document.activeElement !== input) return false;
				rec.inputFocusAt ??= performance.now();
				return true;
			},
			RENAME_INPUT,
			{ timeout: 30_000, polling: "raf" },
		);
		await waitForCameraSettled(page);
		const r = await stopRecording(page);

		log("create-enter", {
			inputFocusMs: r.inputFocusMs,
			animationMs: r.animationMs,
			transformWrites: r.transformWrites,
			blockedMs: r.blockedMs,
			longestTaskMs: r.longestTaskMs,
			longTasks: r.longTasks,
			framesOver50: r.framesOver50,
			frameMax: r.frameMax,
			frameP95: r.frameP95,
			frames: r.frames,
		});

		expect(r.inputFocusMs).not.toBeNull();
		expect(r.inputFocusMs ?? Number.POSITIVE_INFINITY).toBeLessThan(
			CREATE_INPUT_FOCUS_CEILING_MS,
		);
		expect(r.blockedMs).toBeLessThan(CREATE_BLOCKED_CEILING_MS);
	});

	test("(b) typing 12 characters into the rename input", async ({ page }) => {
		await seedLargeTree(page);
		await clickAndSettle(page, TARGET_ID);
		await page.keyboard.press("Enter");
		await page.waitForSelector(RENAME_INPUT);
		await settle(page);

		await startRecording(page);
		const chars = "PerfProbeAbcd".slice(0, 12).split("");
		for (let i = 0; i < chars.length; i++) {
			await pressPaced(page, chars[i], i + 1);
		}
		await pressPaced(page, "Enter", chars.length + 1);
		await page.waitForTimeout(200);
		await waitForCameraSettled(page);
		const r = await stopRecording(page);

		const typed = r.keys.filter((k) => k.key !== "Enter").map((k) => k.latency);
		log("rename-typing", {
			keystrokes: typed.length,
			p50: percentile(typed, 0.5),
			p95: percentile(typed, 0.95),
			worst: typed.length === 0 ? 0 : Math.max(...typed),
			commitMs: r.keys.find((k) => k.key === "Enter")?.latency ?? null,
			blockedMs: r.blockedMs,
			framesOver50: r.framesOver50,
			frameMax: r.frameMax,
			latencies: typed,
		});

		expect(typed.length).toBe(12);
		expect(percentile(typed, 0.95)).toBeLessThan(KEYSTROKE_P95_CEILING_MS);
	});

	test("(c) ten arrow-key moves, some of which pan", async ({ page }) => {
		await seedLargeTree(page);
		await clickAndSettle(page, TARGET_ID);

		// n173 is the 2nd of 5 siblings and has 5 children, so every one of
		// these presses is a real move: three to the end of the sibling row,
		// down into the subtree, across its five children, back up, and one
		// sideways. Several cross the comfort zone and pan.
		const keys = [
			"ArrowRight",
			"ArrowRight",
			"ArrowRight",
			"ArrowDown",
			"ArrowRight",
			"ArrowRight",
			"ArrowRight",
			"ArrowRight",
			"ArrowUp",
			"ArrowLeft",
		];
		await startRecording(page);
		for (let i = 0; i < keys.length; i++) {
			await pressPaced(page, keys[i], i + 1);
		}
		await waitForCameraSettled(page);
		const r = await stopRecording(page);

		const latencies = r.keys.map((k) => k.latency);
		log("arrow-nav", {
			presses: latencies.length,
			p50: percentile(latencies, 0.5),
			p95: percentile(latencies, 0.95),
			worst: latencies.length === 0 ? 0 : Math.max(...latencies),
			transformWrites: r.transformWrites,
			blockedMs: r.blockedMs,
			framesOver50: r.framesOver50,
			frameMax: r.frameMax,
			latencies,
		});

		expect(latencies.length).toBe(keys.length);
		expect(Math.max(...latencies)).toBeLessThan(ARROW_WORST_CEILING_MS);
	});

	test("(d) right-click opens the context menu, Escape closes it", async ({
		page,
	}) => {
		await seedLargeTree(page);

		await startRecording(page);
		// Dispatched in-page for the same reason context-menu-50ms.spec.ts does
		// it: a CDP round-trip would otherwise sit inside the measured window.
		await page.evaluate((nodeId) => {
			const rec = (window as RecWindow).__rrRec;
			const card = document.querySelector(`[data-source-id="${nodeId}"]`);
			if (!rec || !card) throw new Error("no card to right-click");
			const rect = card.getBoundingClientRect();
			rec.t0 = performance.now();
			card.dispatchEvent(
				new MouseEvent("contextmenu", {
					bubbles: true,
					cancelable: true,
					clientX: rect.left + rect.width / 2,
					clientY: rect.top + rect.height / 2,
					button: 2,
				}),
			);
		}, TARGET_ID);
		await page.waitForFunction(
			() => {
				const rec = (window as RecWindow).__rrRec;
				if (!rec || !document.querySelector('[role="menu"]')) return false;
				rec.menuAt ??= performance.now();
				return true;
			},
			undefined,
			{ timeout: 30_000, polling: "raf" },
		);
		await page.keyboard.press("Escape");
		await page.waitForFunction(() => !document.querySelector('[role="menu"]'));
		const r = await stopRecording(page);

		log("context-menu", {
			openMs: r.menuMs,
			escapeMs: r.keys.find((k) => k.key === "Escape")?.latency ?? null,
			blockedMs: r.blockedMs,
			longestTaskMs: r.longestTaskMs,
			framesOver50: r.framesOver50,
			frameMax: r.frameMax,
		});

		expect(r.menuMs).not.toBeNull();
		expect(r.menuMs ?? Number.POSITIVE_INFINITY).toBeLessThan(
			MENU_OPEN_CEILING_MS,
		);
	});

	test("(e) wheel-zoom then a paced drag stay at gesture baseline", async ({
		page,
	}) => {
		await seedLargeTree(page);
		const start = await emptyCanvasPoint(page, -240, 180);

		await startRecording(page);
		await page.mouse.move(start.x, start.y);
		for (let i = 0; i < 4; i++) {
			await page.mouse.wheel(0, -120);
			await page.waitForTimeout(60);
		}
		await page.mouse.down();
		for (let i = 1; i <= 40; i++) {
			await page.mouse.move(
				start.x + (-240 * i) / 40,
				start.y + (180 * i) / 40,
			);
			await page.waitForTimeout(16);
		}
		await page.mouse.up();
		await page.waitForTimeout(250);
		const r = await stopRecording(page);

		log("wheel-drag", {
			frames: r.frames,
			p50: r.frameMedian,
			p95: r.frameP95,
			max: r.frameMax,
			framesOver50: r.framesOver50,
			blockedMs: r.blockedMs,
			transformWrites: r.transformWrites,
		});

		expect(r.frames).toBeGreaterThan(30);
		expect(r.frameP95).toBeLessThanOrEqual(GESTURE_P95_CEILING_MS);
	});

	test("(f) clicking a card with the SidePanel closed", async ({ page }) => {
		await seedLargeTree(page);
		const p = await cardCentre(page, TARGET_ID);

		await startRecording(page);
		await page.mouse.click(p.x, p.y);
		await page.waitForSelector(
			`[data-source-id="${TARGET_ID}"][data-selected="true"]`,
		);
		await page.waitForTimeout(400);
		await waitForCameraSettled(page);
		const r = await stopRecording(page);

		log("card-click", {
			blockedMs: r.blockedMs,
			longestTaskMs: r.longestTaskMs,
			longTasks: r.longTasks,
			framesOver50: r.framesOver50,
			frameMax: r.frameMax,
			animationMs: r.animationMs,
			transformWrites: r.transformWrites,
		});

		expect(r.blockedMs).toBeLessThan(CLICK_BLOCKED_CEILING_MS);
	});
});
