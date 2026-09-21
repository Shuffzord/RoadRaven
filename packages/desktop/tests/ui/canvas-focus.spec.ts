import { expect, type Page, type TestInfo, test } from "@playwright/test";
import { seedSchema } from "./helpers/seed";

// v0.8.1 Phase 0 — evidence gate for .planning/v0.8.1-canvas-focus-PLAN.md.
//
// Real-browser reproduction of the suspected canvas focus / viewport root
// causes, run against the UNMODIFIED renderer under Vite dev (port 5173) via
// the __ROADRAVEN_TEST__.loadSchema seam (App.tsx, DEV-only). Like the other
// specs in this folder it does NOT exercise the CEF binary.
//
// Every case gathers its numbers first, attaches them to the report
// (testInfo.attach "observed"), and only then asserts — so the evidence is
// readable whether the case passes or fails.
//
// Cases that reproduce a bug call test.fail() AFTER their setup and sanity
// checks, so only the behavioural assertions are expected to fail: a broken
// seam, fixture or gesture still turns the suite red. Remove the test.fail()
// line when the named phase lands its fix.

interface Transform {
	x: number;
	y: number;
	k: number;
}

interface Box {
	left: number;
	top: number;
	right: number;
	bottom: number;
}

const uid = (n: number): string =>
	`00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

// Root -> C1..C10; C6 -> G1, G2. Ten siblings at nodeSize.x=240 and the
// default 0.8 zoom span ~1730px, wider than the 1280px test viewport, so
// sibling navigation needs a pan and an 11th child lands off-screen.
const ROOT = uid(1);
const CHILDREN = Array.from({ length: 10 }, (_, i) => uid(101 + i));
const C6 = CHILDREN[5];
const C8 = CHILDREN[7];
const C9 = CHILDREN[8];
const GRANDCHILDREN = [uid(201), uid(202)];
const NODE_COUNT = 1 + CHILDREN.length + GRANDCHILDREN.length;

const leaf = (id: string, title: string) => ({
	id,
	title,
	status: "not-started",
});

const FIXTURE = {
	version: "1.0",
	title: "Canvas focus fixture",
	nodes: [
		{
			...leaf(ROOT, "Root"),
			children: CHILDREN.map((id, i) =>
				id === C6
					? {
							...leaf(id, "C6"),
							children: [
								leaf(GRANDCHILDREN[0], "G1"),
								leaf(GRANDCHILDREN[1], "G2"),
							],
						}
					: leaf(id, `C${i + 1}`),
			),
		},
	],
};

// A transform counts as settled once it is unchanged for this many
// consecutive animation frames (pan animations run up to 900 ms and start one
// or two frames after the triggering event).
const STABLE_FRAMES = 10;
// Largest frame-to-frame translate step P0-1 accepts. The correct pan there is
// ~42px in total, so no legitimate step can exceed this however janky the
// frames are; the snap back to the pre-drag transform is ~219px in one step.
const SNAP_TOLERANCE_PX = 60;
const DRAG = { dx: -150, dy: 160 };

function parseTransform(raw: string): Transform {
	const m = raw.match(
		/translate\(\s*([-\d.e]+)[ ,]+([-\d.e]+)\s*\)\s*scale\(\s*([-\d.e]+)/,
	);
	if (!m) throw new Error(`unparseable rd3t transform: "${raw}"`);
	return { x: Number(m[1]), y: Number(m[2]), k: Number(m[3]) };
}

async function settle(page: Page): Promise<Transform> {
	const raw = await page.evaluate(
		(stableFrames) =>
			new Promise<string>((resolve) => {
				const read = (): string =>
					document.querySelector("g.rd3t-g")?.getAttribute("transform") ?? "";
				let last = read();
				let stable = 0;
				const tick = (): void => {
					const cur = read();
					stable = cur === last ? stable + 1 : 0;
					last = cur;
					if (stable >= stableFrames) resolve(cur);
					else requestAnimationFrame(tick);
				};
				requestAnimationFrame(tick);
			}),
		STABLE_FRAMES,
	);
	return parseTransform(raw);
}

async function seed(page: Page): Promise<void> {
	await seedSchema(page, FIXTURE);
	await expect(page.locator("[data-source-id]")).toHaveCount(NODE_COUNT);
	await settle(page);
}

async function boxOf(page: Page, selector: string): Promise<Box> {
	return page.evaluate((sel) => {
		const el = document.querySelector(sel);
		if (!el) throw new Error(`no element for ${sel}`);
		const r = el.getBoundingClientRect();
		return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
	}, selector);
}

const cardSelector = (id: string): string => `[data-source-id="${id}"]`;
const CONTAINER = '[role="application"]';

function isInside(inner: Box, outer: Box): boolean {
	return (
		inner.left >= outer.left &&
		inner.right <= outer.right &&
		inner.top >= outer.top &&
		inner.bottom <= outer.bottom
	);
}

function center(box: Box): { x: number; y: number } {
	return { x: (box.left + box.right) / 2, y: (box.top + box.bottom) / 2 };
}

// Middle 50% of the container — the comfort zone Canvas.tsx pans into.
function comfortZone(container: Box): Box {
	const w = container.right - container.left;
	const h = container.bottom - container.top;
	return {
		left: container.left + w * 0.25,
		right: container.left + w * 0.75,
		top: container.top + h * 0.25,
		bottom: container.top + h * 0.75,
	};
}

// Click via raw mouse coordinates: locator.click() would scrollIntoView a
// partially clipped card and contaminate the P0-6 scroll probe.
async function clickCard(page: Page, id: string): Promise<void> {
	const box = await boxOf(page, cardSelector(id));
	const container = await boxOf(page, CONTAINER);
	expect(isInside(box, container), `card ${id} must be on-screen`).toBe(true);
	const c = center(box);
	await page.mouse.click(c.x, c.y);
	await expect(page.locator(cardSelector(id))).toHaveAttribute(
		"data-focused",
		"true",
	);
	await settle(page);
}

// A point whose topmost element is the rd3t <svg> itself: d3-zoom's filter
// (hasInteractiveNodes) only accepts pan/zoom gestures that start there.
// (dx, dy) reserves room so a drag from the point ends inside the canvas.
async function emptyCanvasPoint(
	page: Page,
	dx = 0,
	dy = 0,
): Promise<{ x: number; y: number }> {
	return page.evaluate(
		([containerSel, offX, offY]) => {
			const container = document.querySelector(containerSel);
			if (!container) throw new Error("no canvas container");
			const r = container.getBoundingClientRect();
			for (let fy = 0.9; fy > 0.1; fy -= 0.1) {
				for (let fx = 0.1; fx < 0.9; fx += 0.1) {
					const x = r.left + r.width * fx;
					const y = r.top + r.height * fy;
					const endsInside =
						x + offX > r.left &&
						x + offX < r.right &&
						y + offY > r.top &&
						y + offY < r.bottom;
					if (
						endsInside &&
						document.elementFromPoint(x, y)?.classList.contains("rd3t-svg")
					) {
						return { x, y };
					}
				}
			}
			throw new Error("no empty canvas point found");
		},
		[CONTAINER, dx, dy] as const,
	);
}

async function dragCanvas(page: Page, dx: number, dy: number): Promise<void> {
	const p = await emptyCanvasPoint(page, dx, dy);
	await page.mouse.move(p.x, p.y);
	await page.mouse.down();
	await page.mouse.move(p.x + dx, p.y + dy, { steps: 12 });
	await page.mouse.up();
}

// Records every value written to the rd3t <g> transform attribute, so a
// one-frame snap cannot slip between two samples.
async function startRecording(page: Page): Promise<void> {
	await page.evaluate(() => {
		const g = document.querySelector("g.rd3t-g");
		if (!g) throw new Error("no rd3t <g>");
		const w = window as unknown as {
			__p0Frames: string[];
			__p0Observer: MutationObserver;
		};
		w.__p0Frames = [];
		w.__p0Observer = new MutationObserver(() => {
			w.__p0Frames.push(g.getAttribute("transform") ?? "");
		});
		w.__p0Observer.observe(g, {
			attributes: true,
			attributeFilter: ["transform"],
		});
	});
}

async function stopRecording(page: Page): Promise<Transform[]> {
	const raw = await page.evaluate(() => {
		const w = window as unknown as {
			__p0Frames: string[];
			__p0Observer: MutationObserver;
		};
		w.__p0Observer.disconnect();
		return w.__p0Frames;
	});
	return raw.map(parseTransform);
}

async function focusedIds(page: Page): Promise<string[]> {
	return page.evaluate(() =>
		Array.from(
			document.querySelectorAll<HTMLElement>('[data-focused="true"]'),
			(el) => el.dataset.sourceId ?? "",
		),
	);
}

async function containerScroll(
	page: Page,
): Promise<{ left: number; top: number }> {
	return page.evaluate((sel) => {
		const el = document.querySelector(sel);
		if (!el) throw new Error("no canvas container");
		return { left: el.scrollLeft, top: el.scrollTop };
	}, CONTAINER);
}

async function attachObserved(
	testInfo: TestInfo,
	data: unknown,
): Promise<void> {
	await testInfo.attach("observed", {
		body: JSON.stringify(data, null, 2),
		contentType: "application/json",
	});
}

// --- Scenarios ---------------------------------------------------------------
// Each scenario performs one interaction and returns what it observed. The
// P0-1..P0-5 cases assert on the behaviour; P0-6a replays the same scenarios
// and asserts only on the container scroll offsets.

async function dragThenArrow(page: Page) {
	await seed(page);
	await clickCard(page, C8);
	const beforeDrag = await settle(page);
	// Down-left: C8's row moves to the middle of the vertical comfort zone
	// (no y pan needed) and C9 stays ~42px right of the horizontal one, so the
	// correct response to ArrowRight is a ~42px pan in x from the DRAGGED view.
	await dragCanvas(page, DRAG.dx, DRAG.dy);
	const dragged = await settle(page);
	await startRecording(page);
	await page.keyboard.press("ArrowRight");
	await expect(page.locator(cardSelector(C9))).toHaveAttribute(
		"data-focused",
		"true",
	);
	const final = await settle(page);
	const frames = await stopRecording(page);
	const distance = (a: Transform, b: Transform): number =>
		Math.hypot(a.x - b.x, a.y - b.y);
	const steps = frames.map((f, i) =>
		distance(f, i === 0 ? dragged : frames[i - 1]),
	);
	const container = await boxOf(page, CONTAINER);
	return {
		beforeDrag,
		dragged,
		firstFrameAfterKey: frames[0] ?? null,
		firstFrameDistanceFromDragged: frames[0]
			? distance(frames[0], dragged)
			: null,
		firstFrameDistanceFromPreDrag: frames[0]
			? distance(frames[0], beforeDrag)
			: null,
		frameCount: frames.length,
		maxStepPx: Math.max(0, ...steps),
		final,
		container,
		comfortZone: comfortZone(container),
		focusedCardCenter: center(await boxOf(page, cardSelector(C9))),
		scroll: await containerScroll(page),
	};
}

async function zoomThenArrow(page: Page) {
	await seed(page);
	await clickCard(page, C6);
	const beforeZoom = await settle(page);
	const p = await emptyCanvasPoint(page);
	await page.mouse.move(p.x, p.y);
	for (let i = 0; i < 4; i++) await page.mouse.wheel(0, 100);
	await expect
		.poll(async () => (await settle(page)).k, {
			message: "wheel must zoom out below 0.6",
		})
		.toBeLessThan(0.6);
	const zoomed = await settle(page);
	// C7, C8, C9, C10 — far enough that a pan is needed along the way.
	const afterEachArrow: Transform[] = [];
	for (let i = 0; i < 4; i++) {
		await page.keyboard.press("ArrowRight");
		await expect(page.locator(cardSelector(CHILDREN[6 + i]))).toHaveAttribute(
			"data-focused",
			"true",
		);
		afterEachArrow.push(await settle(page));
	}
	return {
		beforeZoom,
		zoomed,
		afterEachArrow,
		scroll: await containerScroll(page),
	};
}

async function navigateLR(page: Page) {
	await seed(page);
	await page
		.getByRole("radiogroup", { name: "Tree layout direction" })
		.getByRole("button", { name: "LR" })
		.click();
	await settle(page);
	await clickCard(page, ROOT);
	// Right = first child (C1), then Down x3 = siblings C2..C4.
	const keys = ["ArrowRight", "ArrowDown", "ArrowDown", "ArrowDown"];
	const steps: {
		key: string;
		focused: string[];
		card: Box;
		container: Box;
		transform: Transform;
	}[] = [];
	for (const [i, key] of keys.entries()) {
		await page.keyboard.press(key);
		await expect(page.locator(cardSelector(CHILDREN[i]))).toHaveAttribute(
			"data-focused",
			"true",
		);
		const transform = await settle(page);
		steps.push({
			key,
			focused: await focusedIds(page),
			card: await boxOf(page, cardSelector(CHILDREN[i])),
			container: await boxOf(page, CONTAINER),
			transform,
		});
	}
	return { steps, scroll: await containerScroll(page) };
}

async function createOffscreenChild(page: Page) {
	await seed(page);
	await clickCard(page, ROOT);
	// Root already has ten children spanning more than the viewport; the
	// eleventh is appended at the far right, off-screen.
	await page.keyboard.press("Enter");
	const input = page.locator('input[aria-label="Rename node"]');
	await input.waitFor({ state: "attached" });
	const transform = await settle(page);
	const newNodeId = await input.evaluate(
		(el) =>
			el.closest<HTMLElement>("[data-source-id]")?.dataset.sourceId ?? null,
	);
	return {
		transform,
		newNodeId,
		focused: await focusedIds(page),
		renameInput: await boxOf(page, 'input[aria-label="Rename node"]'),
		container: await boxOf(page, CONTAINER),
		scroll: await containerScroll(page),
	};
}

async function collapseThenChildKey(page: Page) {
	await seed(page);
	await clickCard(page, C6);
	await page.keyboard.press("c");
	await expect(
		page.locator(`${cardSelector(C6)} button[aria-label="Expand subtree"]`),
	).toBeAttached();
	await expect(page.locator(cardSelector(GRANDCHILDREN[0]))).toHaveCount(0);
	await settle(page);
	const afterCollapse = await focusedIds(page);
	await page.keyboard.press("ArrowDown");
	await settle(page);
	const afterChildKey = await focusedIds(page);
	await page.keyboard.press("ArrowRight");
	await settle(page);
	const afterSiblingKey = await focusedIds(page);
	return {
		afterCollapse,
		afterChildKey,
		afterSiblingKey,
		scroll: await containerScroll(page),
	};
}

async function focusOffscreenProbe(page: Page) {
	await seed(page);
	// Selecting Root opens the SidePanel; the canvas narrows below the 800px
	// watermark, which gives the overflow-hidden container scrollable overflow
	// to the right — the side C10 is off-screen on.
	await clickCard(page, ROOT);
	const target = cardSelector(CHILDREN[9]);
	const card = await boxOf(page, target);
	const container = await boxOf(page, CONTAINER);
	const probe = await page.evaluate(
		([containerSel, cardSel]) => {
			const box = document.querySelector<HTMLElement>(containerSel);
			const el = document.querySelector<HTMLElement>(cardSel);
			if (!box || !el) throw new Error("probe targets missing");
			const reset = (): void => {
				box.scrollLeft = 0;
				box.scrollTop = 0;
			};
			// blur() first: focus() on the already-focused element is a no-op
			// and would hide the scroll.
			const scrollAfterFocus = (
				target: HTMLElement,
				options?: FocusOptions,
			) => {
				reset();
				target.blur();
				target.focus(options);
				return { left: box.scrollLeft, top: box.scrollTop };
			};
			const scrollableOverflow = {
				x: box.scrollWidth - box.clientWidth,
				y: box.scrollHeight - box.clientHeight,
			};
			const cardPreventScroll = scrollAfterFocus(el, { preventScroll: true });
			const cardPlain = scrollAfterFocus(el);
			// The app focuses the rename <input> inside the new card on create
			// (the P0-6a trigger); probe an input in that same DOM position.
			const input = document.createElement("input");
			el.appendChild(input);
			const inputPreventScroll = scrollAfterFocus(input, {
				preventScroll: true,
			});
			const inputPlain = scrollAfterFocus(input);
			input.remove();
			reset();
			return {
				scrollableOverflow,
				cardPreventScroll,
				cardPlain,
				inputPreventScroll,
				inputPlain,
			};
		},
		[CONTAINER, target] as const,
	);
	return { card, container, ...probe };
}

// --- Cases ---------------------------------------------------------------------

test.describe("Canvas focus & viewport — v0.8.1 Phase 0 evidence", () => {
	// One worker for this file instead of fullyParallel's one-per-test: seven
	// extra browsers pushed context-menu-50ms.spec.ts (a wall-clock render
	// budget in this same project) over its 75ms ceiling in 3 of 4 local runs.
	test.describe.configure({ mode: "default" });

	test("P0-1 (RC1): drag the canvas, arrow key — no snap, card in comfort zone", async ({
		page,
	}, testInfo) => {
		const o = await dragThenArrow(page);
		await attachObserved(testInfo, o);

		// Sanity: the drag really moved the view.
		expect(o.dragged.x - o.beforeDrag.x).toBeCloseTo(DRAG.dx, 0);
		expect(o.dragged.y - o.beforeDrag.y).toBeCloseTo(DRAG.dy, 0);

		test.fail(true, "RC1 reproduced in Phase 0 — remove when Phase 1 lands");
		expect(
			o.maxStepPx,
			"the pan must continue from the dragged transform, not snap back",
		).toBeLessThanOrEqual(SNAP_TOLERANCE_PX);
		expect(o.focusedCardCenter.x).toBeGreaterThanOrEqual(o.comfortZone.left);
		expect(o.focusedCardCenter.x).toBeLessThanOrEqual(o.comfortZone.right);
		expect(o.focusedCardCenter.y).toBeGreaterThanOrEqual(o.comfortZone.top);
		expect(o.focusedCardCenter.y).toBeLessThanOrEqual(o.comfortZone.bottom);
	});

	test("P0-2 (RC1): wheel-zoom, arrow keys — zoom factor unchanged", async ({
		page,
	}, testInfo) => {
		const o = await zoomThenArrow(page);
		await attachObserved(testInfo, o);

		test.fail(true, "RC1 reproduced in Phase 0 — remove when Phase 1 lands");
		for (const t of o.afterEachArrow) {
			expect(Math.abs(t.k - o.zoomed.k)).toBeLessThanOrEqual(0.001);
		}
	});

	test("P0-3 (RC2): LR navigation — focused card ends inside the viewport", async ({
		page,
	}, testInfo) => {
		const o = await navigateLR(page);
		await attachObserved(testInfo, o);

		test.fail(true, "RC2 reproduced in Phase 0 — remove when Phase 2 lands");
		for (const step of o.steps) {
			expect(
				isInside(step.card, step.container),
				`after ${step.key}: focused card must be fully inside the canvas`,
			).toBe(true);
		}
	});

	test("P0-4 (RC4): Enter creates an off-screen child — rename visible, new node focused", async ({
		page,
	}, testInfo) => {
		const o = await createOffscreenChild(page);
		await attachObserved(testInfo, o);

		expect(o.newNodeId).not.toBeNull();

		test.fail(true, "RC4 reproduced in Phase 0 — remove when Phase 4 lands");
		expect(o.focused, "the NEW node must hold canvas focus").toEqual([
			o.newNodeId,
		]);
		expect(
			isInside(o.renameInput, o.container),
			"rename input must be inside the canvas",
		).toBe(true);
	});

	test("P0-5 (RC6): child key on a collapsed node never focuses an unmounted node", async ({
		page,
	}, testInfo) => {
		const o = await collapseThenChildKey(page);
		await attachObserved(testInfo, o);

		expect(o.afterCollapse).toEqual([C6]);

		test.fail(true, "RC6 reproduced in Phase 0 — remove when Phase 4 lands");
		expect(
			o.afterChildKey,
			"exactly one mounted card must still show focus",
		).toHaveLength(1);
		expect(o.afterSiblingKey).toHaveLength(1);
		expect(
			o.afterSiblingKey[0],
			"sibling key must move visible focus",
		).not.toBe(o.afterChildKey[0]);
	});

	test("P0-6a (probe): the interactions above never scroll the canvas container", async ({
		page,
	}, testInfo) => {
		const scrolls = {
			"P0-1 drag + arrow": (await dragThenArrow(page)).scroll,
			"P0-2 zoom + arrows": (await zoomThenArrow(page)).scroll,
			"P0-3 LR navigation": (await navigateLR(page)).scroll,
			"P0-4 off-screen create": (await createOffscreenChild(page)).scroll,
			"P0-5 collapse + child key": (await collapseThenChildKey(page)).scroll,
		};
		await attachObserved(testInfo, scrolls);

		test.fail(
			true,
			"Scroll probe reproduced in Phase 0: the rename input's focus() (RoadmapNode.tsx, no preventScroll) scrolls the container on off-screen create — remove when Phase 3 lands",
		);
		for (const [label, scroll] of Object.entries(scrolls)) {
			expect(scroll, label).toEqual({ left: 0, top: 0 });
		}
	});

	test("P0-6b (probe): preventScroll is required — a plain focus() scrolls the canvas container", async ({
		page,
	}, testInfo) => {
		const o = await focusOffscreenProbe(page);
		await attachObserved(testInfo, o);

		// Sanity: the probe is only meaningful if the container CAN scroll
		// toward the card and the card really is off-screen on that side.
		// The overflow comes from the 800px watermark inside a container that
		// is narrower than that once the SidePanel is open — `overflow-hidden`
		// does not make an element unscrollable, only unscrollable by the user.
		expect(o.scrollableOverflow.x).toBeGreaterThan(0);
		expect(o.card.left).toBeGreaterThan(o.container.right);

		// The mitigation the plan prescribes — holds today, must keep holding.
		const zero = { left: 0, top: 0 };
		expect(o.cardPreventScroll, "card preventScroll").toEqual(zero);
		expect(o.inputPreventScroll, "input preventScroll").toEqual(zero);

		// The hazard itself, asserted positively rather than with test.fail():
		// this probe owns the focus() call, so no phase of the plan can flip
		// it — an app-side preventScroll leaves a probe-issued plain focus()
		// scrolling exactly as it does now. P0-6a is the case that tracks the
		// app's own focus() calls; this one proves preventScroll is the
		// difference and guards against the mitigation being dropped.
		expect(
			o.cardPlain.left,
			"a plain card.focus() scrolls the container",
		).toBeGreaterThan(0);
		expect(
			o.inputPlain.left,
			"a plain input.focus() scrolls the container",
		).toBeGreaterThan(0);
	});
});
