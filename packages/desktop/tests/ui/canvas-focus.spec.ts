import { expect, type Page, type TestInfo, test } from "@playwright/test";
// The renderer's own constant, so the e2e ceiling and the clamp cannot drift.
import { SCALE_EXTENT } from "../../src/mainview/lib/viewportMath";
import {
	CONTAINER,
	dragCanvas,
	emptyCanvasPoint,
} from "./helpers/canvasGestures";
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
const C7 = CHILDREN[6];
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

// Phase 1 gesture-integrity guards (P1-* cases at the bottom of this file).
const P1_DRAG = { dx: -180, dy: 120 };
const DRAG_DELTA_TOLERANCE_PX = 1;
// Four deltaY=100 ticks from the default zoom 0.8 — d3-zoom's wheelDelta is
// -deltaY * 0.002, so k *= 2^-0.2 per tick: 0.8 * 2^-0.8 = 0.45946. Recorded
// on the unmodified renderer (commit c6a4566) before the Phase 1 change.
const WHEEL_TICKS = 4;
const WHEEL_K_BASELINE = 0.45946;
const WHEEL_K_TOLERANCE = 0.02;

// Phase 2: how far a `center` reveal may leave the card off the container
// centre. See the justification on the search case below.
const CENTRE_TOLERANCE_PX = 2;
/** Sub-pixel slack on a comfort-zone edge the pan lands exactly on. */
const ZONE_EPSILON_PX = 1;

function parseTransform(raw: string): Transform {
	const m = raw.match(
		/translate\(\s*([-\d.e]+)[ ,]+([-\d.e]+)\s*\)\s*scale\(\s*([-\d.e]+)/,
	);
	if (!m) throw new Error(`unparseable rd3t transform: "${raw}"`);
	return { x: Number(m[1]), y: Number(m[2]), k: Number(m[3]) };
}

// A reveal that waits for the SidePanel's 200ms width transition starts
// moving the camera later than STABLE_FRAMES, so the cases that select a node
// settle on a window wider than the transition.
const PANEL_STABLE_FRAMES = 30;

async function settle(
	page: Page,
	stableFrames = STABLE_FRAMES,
): Promise<Transform> {
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
		stableFrames,
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

// Records every value written to the rd3t <g> transform attribute, so a
// one-frame snap cannot slip between two samples. The canvas width is sampled
// with each frame: a pan that started before the SidePanel finished resizing
// the canvas is visible as a first frame taken at the OLD width (RC3).
async function startRecording(page: Page): Promise<void> {
	await page.evaluate((containerSel) => {
		const g = document.querySelector("g.rd3t-g");
		const container = document.querySelector(containerSel);
		if (!g || !container) throw new Error("no rd3t <g> / canvas container");
		const w = window as unknown as {
			__p0Frames: { raw: string; width: number }[];
			__p0Observer: MutationObserver;
		};
		w.__p0Frames = [];
		w.__p0Observer = new MutationObserver(() => {
			w.__p0Frames.push({
				raw: g.getAttribute("transform") ?? "",
				width: container.getBoundingClientRect().width,
			});
		});
		w.__p0Observer.observe(g, {
			attributes: true,
			attributeFilter: ["transform"],
		});
	}, CONTAINER);
}

interface Frame extends Transform {
	/** Canvas width at the moment this frame was written. */
	containerWidth: number;
}

async function stopRecordingFrames(page: Page): Promise<Frame[]> {
	const raw = await page.evaluate(() => {
		const w = window as unknown as {
			__p0Frames: { raw: string; width: number }[];
			__p0Observer: MutationObserver;
		};
		w.__p0Observer.disconnect();
		return w.__p0Frames;
	});
	return raw.map((f) => ({
		...parseTransform(f.raw),
		containerWidth: f.width,
	}));
}

async function stopRecording(page: Page): Promise<Transform[]> {
	return stopRecordingFrames(page);
}

async function focusedIds(page: Page): Promise<string[]> {
	return page.evaluate(() =>
		Array.from(
			document.querySelectorAll<HTMLElement>('[data-focused="true"]'),
			(el) => el.dataset.sourceId ?? "",
		),
	);
}

/** The node whose card holds real DOM focus, or null. */
async function activeCardId(page: Page): Promise<string | null> {
	return page.evaluate(
		() =>
			(document.activeElement as HTMLElement | null)?.dataset.sourceId ?? null,
	);
}

/** Enough of `document.activeElement` to name it in a failure message. */
async function activeElementInfo(
	page: Page,
): Promise<{ tag: string | null; label: string | null; card: string | null }> {
	return page.evaluate(() => {
		const el = document.activeElement as HTMLElement | null;
		return {
			tag: el?.tagName ?? null,
			label: el?.getAttribute("aria-label") ?? null,
			card: el?.dataset.sourceId ?? null,
		};
	});
}

/** Node ids of the cards that are in the document tab order. */
async function tabStopIds(page: Page): Promise<string[]> {
	return page.evaluate(() =>
		Array.from(
			document.querySelectorAll<HTMLElement>("[data-source-id]"),
			(el) => ({ id: el.dataset.sourceId ?? "", tab: el.tabIndex }),
		)
			.filter((c) => c.tab === 0)
			.map((c) => c.id),
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

/** Walk Root -> C1 -> C2 -> C3 -> C4 with the given keys, sampling each step. */
async function navigateSteps(page: Page, keys: string[]) {
	await clickCard(page, ROOT);
	const steps: {
		key: string;
		focused: string[];
		/** The card that holds real DOM focus after the key (RC8). */
		active: string | null;
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
			active: await activeCardId(page),
			card: await boxOf(page, cardSelector(CHILDREN[i])),
			container: await boxOf(page, CONTAINER),
			transform,
		});
	}
	return { steps, scroll: await containerScroll(page) };
}

async function navigateLR(page: Page) {
	await seed(page);
	await setLayout(page, "LR");
	// Right = first child (C1), then Down x3 = siblings C2..C4.
	return navigateSteps(page, [
		"ArrowRight",
		"ArrowDown",
		"ArrowDown",
		"ArrowDown",
	]);
}

async function navigateTB(page: Page) {
	await seed(page);
	// TB (the default): Down = first child (C1), then Right x3 = C2..C4.
	return navigateSteps(page, [
		"ArrowDown",
		"ArrowRight",
		"ArrowRight",
		"ArrowRight",
	]);
}

async function setLayout(page: Page, layout: "TB" | "LR"): Promise<void> {
	await page
		.getByRole("radiogroup", { name: "Tree layout direction" })
		.getByRole("button", { name: layout })
		.click();
	await settle(page);
}

const RENAME_INPUT = 'input[aria-label="Rename node"]';

/**
 * Focus `from`, press a create shortcut and wait for the new node's rename
 * input. Root already has ten children spanning more than the viewport, so
 * every node these cases create lands off-screen before the reveal moves the
 * camera — which is exactly what P0-4 recorded going wrong.
 */
async function createViaKey(page: Page, from: string, combo: string) {
	await seed(page);
	await clickCard(page, from);
	await page.keyboard.press(combo);
	const input = page.locator(RENAME_INPUT);
	await input.waitFor({ state: "attached" });
	const transform = await settle(page, PANEL_STABLE_FRAMES);
	const newNodeId = await input.evaluate(
		(el) =>
			el.closest<HTMLElement>("[data-source-id]")?.dataset.sourceId ?? null,
	);
	return {
		transform,
		newNodeId,
		focused: await focusedIds(page),
		active: await activeElementInfo(page),
		renameStillOpen: (await page.locator(RENAME_INPUT).count()) === 1,
		renameInput: await boxOf(page, RENAME_INPUT),
		container: await boxOf(page, CONTAINER),
		scroll: await containerScroll(page),
	};
}

async function createOffscreenChild(page: Page) {
	return createViaKey(page, ROOT, "Enter");
}

/** Type a title into the open rename input and commit it with Enter. */
async function commitRename(page: Page, title: string, nodeId: string) {
	await page.keyboard.type(title);
	await page.keyboard.press("Enter");
	await expect(page.locator(RENAME_INPUT)).toHaveCount(0);
	await settle(page, PANEL_STABLE_FRAMES);
	return {
		title: await page
			.locator(cardSelector(nodeId))
			.locator("span")
			.first()
			.textContent(),
		active: await activeCardId(page),
		focused: await focusedIds(page),
		card: await boxOf(page, cardSelector(nodeId)),
		container: await boxOf(page, CONTAINER),
		scroll: await containerScroll(page),
	};
}

/** Right-click a card and wait for its context menu. */
async function openNodeMenu(page: Page, nodeId: string) {
	const c = center(await boxOf(page, cardSelector(nodeId)));
	await page.mouse.click(c.x, c.y, { button: "right" });
	const menu = page.getByRole("menu", { name: "Node actions" });
	await menu.waitFor();
	return menu;
}

/** The REAL context menu: right-click a card, pick "Add Child". */
async function contextMenuAddChild(page: Page) {
	await seed(page);
	await clickCard(page, C8);
	// The click's own reveal outlasts clickCard's settle window (the SidePanel
	// animates its width for 200ms), so the card is still moving; right-click
	// where it was and the menu opens on empty canvas instead of the node.
	await settle(page, PANEL_STABLE_FRAMES);
	const focusedBefore = await focusedIds(page);
	const menu = await openNodeMenu(page, C8);
	await menu.getByRole("menuitem", { name: /^Add Child/ }).click();
	// The menu closes immediately; the input opens several frames later, once
	// the reveal has the new card. If Radix's focus trap had blur-committed it,
	// the input would be gone again by the time the camera settles.
	const input = page.locator(RENAME_INPUT);
	await input.waitFor({ state: "attached" });
	const menusWhileRenaming = await page.getByRole("menu").count();
	await settle(page, PANEL_STABLE_FRAMES);
	const newNodeId = await input.evaluate(
		(el) =>
			el.closest<HTMLElement>("[data-source-id]")?.dataset.sourceId ?? null,
	);
	const whileOpen = {
		focusedBefore,
		newNodeId,
		menusWhileRenaming,
		renameStillOpen: (await page.locator(RENAME_INPUT).count()) === 1,
		active: await activeElementInfo(page),
		renameInput: await boxOf(page, RENAME_INPUT),
		container: await boxOf(page, CONTAINER),
		focused: await focusedIds(page),
		scroll: await containerScroll(page),
	};
	const committed = await commitRename(page, "From the menu", newNodeId ?? "");
	return { whileOpen, committed };
}

/**
 * Focus a grandchild, then collapse its parent — by the chevron or through
 * the context menu. Both end in the same chevron click, which is the one
 * chokepoint the "focus always names a mounted card" invariant hangs on.
 */
async function collapseWithDescendantFocused(
	page: Page,
	how: "chevron" | "menu",
) {
	await seed(page);
	await clickCard(page, C6);
	await page.keyboard.press("ArrowDown");
	await expect(page.locator(cardSelector(GRANDCHILDREN[0]))).toHaveAttribute(
		"data-focused",
		"true",
	);
	await settle(page, PANEL_STABLE_FRAMES);
	const focusedBefore = await focusedIds(page);
	/** Logical focus once the menu is up — a right-click moves it (see below). */
	let focusedAfterOpen: string[] = focusedBefore;

	if (how === "chevron") {
		// Raw coordinates, like clickCard: locator.click() would
		// scrollIntoViewIfNeeded and contaminate the scroll assertions.
		const c = center(
			await boxOf(
				page,
				`${cardSelector(C6)} button[aria-label="Collapse subtree"]`,
			),
		);
		await page.mouse.click(c.x, c.y);
	} else {
		const menu = await openNodeMenu(page, C6);
		focusedAfterOpen = await focusedIds(page);
		await menu.getByRole("menuitem", { name: /^Collapse subtree/ }).click();
	}
	await expect(page.locator(cardSelector(GRANDCHILDREN[0]))).toHaveCount(0);
	const focusedAfterToggle = await focusedIds(page);
	// The invariant lands one frame after the toggle, so poll rather than sample.
	await expect(page.locator(cardSelector(C6))).toHaveAttribute(
		"data-focused",
		"true",
	);
	await settle(page, PANEL_STABLE_FRAMES);
	const afterCollapse = await focusedIds(page);
	const activeAfterCollapse = await activeCardId(page);
	// ...and the keyboard keeps working without a rescuing mouse click.
	await page.keyboard.press("ArrowRight");
	await settle(page);
	return {
		focusedBefore,
		focusedAfterOpen,
		focusedAfterToggle,
		afterCollapse,
		activeAfterCollapse,
		afterArrow: await focusedIds(page),
		activeAfterArrow: await activeCardId(page),
		card: await boxOf(page, cardSelector(C6)),
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
	// A6: the first child key expanded the subtree instead of entering it.
	const expandedByChildKey =
		(await page.locator(cardSelector(GRANDCHILDREN[0])).count()) === 1;
	await page.keyboard.press("ArrowRight");
	await settle(page);
	const afterSiblingKey = await focusedIds(page);
	return {
		afterCollapse,
		afterChildKey,
		expandedByChildKey,
		afterSiblingKey,
		scroll: await containerScroll(page),
	};
}

/** Collapse C6 while it holds focus, then press the child key twice (A6). */
async function collapseThenChildKeyTwice(page: Page) {
	await seed(page);
	await clickCard(page, C6);
	await page.keyboard.press("c");
	await expect(page.locator(cardSelector(GRANDCHILDREN[0]))).toHaveCount(0);
	await settle(page);
	await page.keyboard.press("ArrowDown");
	await expect(page.locator(cardSelector(GRANDCHILDREN[0]))).toHaveCount(1);
	await settle(page);
	const afterFirst = {
		focused: await focusedIds(page),
		active: await activeCardId(page),
	};
	await page.keyboard.press("ArrowDown");
	await expect(page.locator(cardSelector(GRANDCHILDREN[0]))).toHaveAttribute(
		"data-focused",
		"true",
	);
	await settle(page);
	return {
		afterFirst,
		afterSecond: {
			focused: await focusedIds(page),
			active: await activeCardId(page),
		},
		card: await boxOf(page, cardSelector(GRANDCHILDREN[0])),
		container: await boxOf(page, CONTAINER),
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
			const style = getComputedStyle(box);
			const overflow = { x: style.overflowX, y: style.overflowY };
			// Chrome still reports a scrollable overflow RECTANGLE for an
			// `overflow: clip` box (the 800px watermark is still bigger than
			// the canvas); what `clip` removes is the scrolling box, so
			// scrollLeft/scrollTop can never leave 0. Kept as evidence.
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
				overflow,
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

// --- Phase 2 scenarios --------------------------------------------------------

/** True when the mouse can reach the box's centre inside the container. */
function centreIsReachable(box: Box, container: Box): boolean {
	const c = center(box);
	return (
		c.x > container.left &&
		c.x < container.right &&
		c.y > container.top &&
		c.y < container.bottom
	);
}

/**
 * Right-most child card the mouse can still click: the further right it sits,
 * the more the SidePanel's shrink changes where the reveal has to land it.
 */
async function rightmostClickableCard(page: Page, container: Box) {
	let best: { id: string; box: Box } | null = null;
	for (const id of CHILDREN) {
		const box = await boxOf(page, cardSelector(id));
		if (!centreIsReachable(box, container)) continue;
		if (!best || box.left > best.box.left) best = { id, box };
	}
	if (!best) throw new Error("no on-screen card to click");
	return best;
}

/** Click the right-most reachable card while the SidePanel is closed. */
async function clickCardNearRightEdge(page: Page) {
	await seed(page);
	// Nothing is selected yet, so the SidePanel is closed and the canvas has
	// its full width — clicking opens the panel and shrinks it mid-reveal.
	const containerBefore = await boxOf(page, CONTAINER);
	const { id: targetId, box: targetBox } = await rightmostClickableCard(
		page,
		containerBefore,
	);
	await startRecording(page);
	const c = center(targetBox);
	await page.mouse.click(c.x, c.y);
	await expect(page.locator(cardSelector(targetId))).toHaveAttribute(
		"data-focused",
		"true",
	);
	const settled = await settle(page, PANEL_STABLE_FRAMES);
	const frames = await stopRecordingFrames(page);
	const containerAfter = await boxOf(page, CONTAINER);
	const card = await boxOf(page, cardSelector(targetId));
	return {
		targetId,
		containerBefore,
		containerAfter,
		frames,
		frameCount: frames.length,
		firstFrameWidth: frames[0]?.containerWidth ?? null,
		xReversals: directionReversals(frames.map((f) => f.x)),
		yReversals: directionReversals(frames.map((f) => f.y)),
		settled,
		card,
		cardCenter: center(card),
		comfortZone: comfortZone(containerAfter),
	};
}

/** Ctrl+F, type a title that only matches inside a collapsed subtree. */
async function searchIntoCollapsedSubtree(page: Page) {
	await seed(page);
	await clickCard(page, C6);
	await page.keyboard.press("c");
	await expect(
		page.locator(`${cardSelector(C6)} button[aria-label="Expand subtree"]`),
	).toBeAttached();
	await expect(page.locator(cardSelector(GRANDCHILDREN[0]))).toHaveCount(0);
	await settle(page);

	await page.keyboard.press("Control+f");
	await page
		.getByRole("textbox", { name: "Search nodes" })
		.pressSequentially("G1");
	// The controller expands C6 on the way to the match.
	await expect(page.locator(cardSelector(GRANDCHILDREN[0]))).toHaveCount(1);
	await expect(page.locator(cardSelector(GRANDCHILDREN[0]))).toHaveAttribute(
		"data-focused",
		"true",
	);
	const settled = await settle(page);
	const container = await boxOf(page, CONTAINER);
	const card = await boxOf(page, cardSelector(GRANDCHILDREN[0]));
	const cardCenter = center(card);
	const containerCenter = center(container);
	return {
		settled,
		container,
		card,
		offset: {
			x: cardCenter.x - containerCenter.x,
			y: cardCenter.y - containerCenter.y,
		},
		scroll: await containerScroll(page),
	};
}

/** Collapse C6's subtree, then fit the whole tree. */
async function collapseThenFit(page: Page) {
	await seed(page);
	await clickCard(page, C6);
	await page.keyboard.press("c");
	await expect(page.locator(cardSelector(GRANDCHILDREN[0]))).toHaveCount(0);
	await settle(page);
	await page.evaluate(() =>
		window.dispatchEvent(new CustomEvent("roadraven:fit-view")),
	);
	const settled = await settle(page);
	const container = await boxOf(page, CONTAINER);
	const cards = await page.evaluate(() =>
		Array.from(
			document.querySelectorAll<HTMLElement>("[data-source-id]"),
			(el) => {
				const r = el.getBoundingClientRect();
				return {
					id: el.dataset.sourceId ?? "",
					left: r.left,
					top: r.top,
					right: r.right,
					bottom: r.bottom,
				};
			},
		),
	);
	return { settled, container, cards };
}

/** Reorder the focused node, then flip the layout (A7 re-reveal twice). */
async function relayoutAroundFocus(page: Page) {
	await seed(page);
	await clickCard(page, C8);
	await page.keyboard.press("Control+ArrowUp");
	await settle(page);
	const afterMove = {
		card: await boxOf(page, cardSelector(C8)),
		container: await boxOf(page, CONTAINER),
	};
	await setLayout(page, "LR");
	const afterLayout = {
		card: await boxOf(page, cardSelector(C8)),
		container: await boxOf(page, CONTAINER),
	};
	return { afterMove, afterLayout, scroll: await containerScroll(page) };
}

// --- Phase 3 scenarios --------------------------------------------------------

/** F2 on C8, retype the title, then finish with `key` (Enter or Escape). */
async function renameThen(page: Page, key: "Enter" | "Escape") {
	await seed(page);
	await clickCard(page, C8);
	await page.keyboard.press("F2");
	const input = page.locator('input[aria-label="Rename node"]');
	await input.waitFor();
	await page.keyboard.type("C8 renamed");
	await page.keyboard.press(key);
	await expect(input).toHaveCount(0);
	await settle(page);
	return {
		active: await activeElementInfo(page),
		title: await page
			.locator(cardSelector(C8))
			.locator("span")
			.first()
			.textContent(),
		focused: await focusedIds(page),
		scroll: await containerScroll(page),
	};
}

/**
 * Commit a rename by clicking a SidePanel field (A8): a blur means the user
 * went somewhere else on purpose, so nothing may pull focus back.
 */
async function renameThenClickPanelField(page: Page) {
	await seed(page);
	await clickCard(page, ROOT);
	// Put the panel into edit mode so it owns a real text input to click.
	await page.getByRole("button", { name: "Edit node" }).click();
	const panelTitle = page.getByRole("textbox", { name: "Title" });
	await panelTitle.waitFor();

	await clickCard(page, ROOT);
	await page.keyboard.press("F2");
	const input = page.locator('input[aria-label="Rename node"]');
	await input.waitFor();
	await page.keyboard.type("Root renamed");
	await panelTitle.click();
	await expect(input).toHaveCount(0);
	await settle(page);
	return {
		active: await activeElementInfo(page),
		title: await page
			.locator(cardSelector(ROOT))
			.locator("span")
			.first()
			.textContent(),
		scroll: await containerScroll(page),
	};
}

/** Tab into the tree from the canvas container with nothing focused. */
async function tabIntoTree(page: Page) {
	await seed(page);
	const beforeFocus = await focusedIds(page);
	const stopsWhileUnfocused = await tabStopIds(page);
	await page.locator(CONTAINER).focus();
	await page.keyboard.press("Tab");
	const landedOn = await activeCardId(page);
	// Now give the tree a focused node and re-read the tab order.
	await clickCard(page, ROOT);
	await page.keyboard.press("ArrowDown");
	await expect(page.locator(cardSelector(CHILDREN[0]))).toHaveAttribute(
		"data-focused",
		"true",
	);
	await settle(page);
	return {
		beforeFocus,
		stopsWhileUnfocused,
		landedOn,
		stopsWhileFocused: await tabStopIds(page),
		focusedAfterArrow: await focusedIds(page),
		scroll: await containerScroll(page),
	};
}

/**
 * Pan the tab-stop card out of view, then Tab back into the tree from outside
 * the canvas. Shift+Tab is the direction that works from the SidePanel (the
 * router owns plain Tab while a node is focused — it creates a sibling), and
 * the only tabbable card is the focused one, so the previous tab stop before
 * the panel IS that card.
 */
async function tabBackToAnOffscreenCard(page: Page) {
	await seed(page);
	await clickCard(page, C8);
	// The click's own reveal waits for the SidePanel's 200ms width transition,
	// which outlasts clickCard's settle window — let it land before measuring,
	// or the card starts off screen for a reason that has nothing to do with
	// Tab (and that pending pan would bring it back on its own).
	await settle(page, PANEL_STABLE_FRAMES);
	// Drag until the tab stop is off screen. One gesture cannot cover more
	// than the container's width, and how far the card has to travel depends
	// on where the comfort zone parked it, so loop instead of guessing.
	const drags: Box[] = [];
	let before = {
		card: await boxOf(page, cardSelector(C8)),
		container: await boxOf(page, CONTAINER),
	};
	for (let i = 0; i < 5 && isInside(before.card, before.container); i++) {
		await dragCanvas(page, -300, 0);
		await settle(page);
		before = {
			card: await boxOf(page, cardSelector(C8)),
			container: await boxOf(page, CONTAINER),
		};
		drags.push(before.card);
	}
	// The SidePanel is open (the click selected the node), so Shift+Tab from
	// its Edit button walks backwards through the panel chrome and into the
	// canvas. Loop rather than hard-code the number of stops: the panel's own
	// controls are not this case's contract, and Shift+Tab is the one Tab the
	// router never intercepts.
	await page.getByRole("button", { name: "Edit node" }).focus();
	const stops: (string | null)[] = [];
	for (let i = 0; i < 5 && (await activeCardId(page)) === null; i++) {
		await page.keyboard.press("Shift+Tab");
		stops.push(await activeElementInfo(page).then((a) => a.label ?? a.tag));
	}
	await expect(page.locator(cardSelector(C8))).toBeFocused();
	await settle(page);
	return {
		before,
		drags,
		offscreenBefore: !isInside(before.card, before.container),
		stops,
		active: await activeCardId(page),
		card: await boxOf(page, cardSelector(C8)),
		container: await boxOf(page, CONTAINER),
		focused: await focusedIds(page),
		scroll: await containerScroll(page),
	};
}

/** Computed focus-ring styles for a keyboard-focused and a clicked card. */
async function focusRingStyles(page: Page) {
	await seed(page);
	await clickCard(page, C8);
	const mouse = await ringOf(page, C8);
	await page.keyboard.press("ArrowRight");
	await expect(page.locator(cardSelector(C9))).toHaveAttribute(
		"data-focused",
		"true",
	);
	await settle(page);
	const keyboard = await ringOf(page, C9);
	return { mouse, keyboard };
}

async function ringOf(page: Page, id: string) {
	return page.evaluate((sel) => {
		const el = document.querySelector<HTMLElement>(sel);
		if (!el) throw new Error(`no card ${sel}`);
		const s = getComputedStyle(el);
		return {
			isActiveElement: document.activeElement === el,
			focusVisible: el.matches(":focus-visible"),
			keyboardNav: document.body.classList.contains("keyboard-nav-active"),
			outlineStyle: s.outlineStyle,
			outlineWidth: s.outlineWidth,
			outlineOffset: s.outlineOffset,
			boxShadow: s.boxShadow,
		};
	}, cardSelector(id));
}

/** How often a sequence changes direction (0 = one continuous move). */
function directionReversals(values: number[]): number {
	let direction = 0;
	let count = 0;
	for (let i = 1; i < values.length; i++) {
		const step = Math.sign(values[i] - values[i - 1]);
		if (step === 0) continue;
		if (direction !== 0 && step !== direction) count++;
		direction = step;
	}
	return count;
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

		expect(
			o.maxStepPx,
			"the pan must continue from the dragged transform, not snap back",
		).toBeLessThanOrEqual(SNAP_TOLERANCE_PX);
		// A `nearest` pan clamps the card centre exactly ONTO the zone edge, so
		// the correct result has zero margin (observed 760.0 against a 760.0
		// edge); ZONE_EPSILON_PX absorbs sub-pixel rect rounding. The Phase 0
		// bug was 13px outside the zone after a 219px snap, so 1px of slack
		// does not weaken the evidence.
		expect(o.focusedCardCenter.x).toBeGreaterThanOrEqual(
			o.comfortZone.left - ZONE_EPSILON_PX,
		);
		expect(o.focusedCardCenter.x).toBeLessThanOrEqual(
			o.comfortZone.right + ZONE_EPSILON_PX,
		);
		expect(o.focusedCardCenter.y).toBeGreaterThanOrEqual(
			o.comfortZone.top - ZONE_EPSILON_PX,
		);
		expect(o.focusedCardCenter.y).toBeLessThanOrEqual(
			o.comfortZone.bottom + ZONE_EPSILON_PX,
		);
	});

	test("P0-2 (RC1): wheel-zoom, arrow keys — zoom factor unchanged", async ({
		page,
	}, testInfo) => {
		const o = await zoomThenArrow(page);
		await attachObserved(testInfo, o);

		for (const t of o.afterEachArrow) {
			expect(Math.abs(t.k - o.zoomed.k)).toBeLessThanOrEqual(0.001);
		}
	});

	test("P0-3 (RC2): LR navigation — focused card ends inside the viewport", async ({
		page,
	}, testInfo) => {
		const o = await navigateLR(page);
		await attachObserved(testInfo, o);

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

		expect(o.focused, "the NEW node must hold canvas focus").toEqual([
			o.newNodeId,
		]);
		expect(
			isInside(o.renameInput, o.container),
			"rename input must be inside the canvas",
		).toBe(true);
		// Phase 4: the input is also where the caret is, and it stays open —
		// the reveal waits for the card instead of racing it.
		expect(o.active.label, "the rename input holds DOM focus").toBe(
			"Rename node",
		);
		expect(o.renameStillOpen).toBe(true);
		expect(o.scroll).toEqual({ left: 0, top: 0 });
	});

	test("P0-5 (RC6): child key on a collapsed node never focuses an unmounted node", async ({
		page,
	}, testInfo) => {
		const o = await collapseThenChildKey(page);
		await attachObserved(testInfo, o);

		expect(o.afterCollapse).toEqual([C6]);

		expect(
			o.afterChildKey,
			"exactly one mounted card must still show focus",
		).toHaveLength(1);
		expect(o.afterSiblingKey).toHaveLength(1);
		expect(
			o.afterSiblingKey[0],
			"sibling key must move visible focus",
		).not.toBe(o.afterChildKey[0]);
		// A6, the reason it can no longer strand the user: the child key on a
		// collapsed node expands it and keeps focus rather than diving into a
		// subtree that is not rendered.
		expect(o.afterChildKey).toEqual([C6]);
		expect(o.expandedByChildKey).toBe(true);
		expect(o.scroll).toEqual({ left: 0, top: 0 });
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

		for (const [label, scroll] of Object.entries(scrolls)) {
			expect(scroll, label).toEqual({ left: 0, top: 0 });
		}
	});

	// --- Phase 1 gesture-integrity guards ------------------------------------
	// Feeding every gesture frame back into the store re-renders Tree, and
	// react-d3-tree's componentDidUpdate then calls bindZoomListener — which
	// rewrites d3's internal __zoom — in the middle of the gesture. d3's drag
	// translate is absolute (pointer vs. gesture-start point) so it should
	// survive; the wheel handler derives k from __zoom and could lose a tick.
	// Both cases were recorded on the unmodified renderer (commit c6a4566) and
	// must keep producing the same numbers afterwards.

	test("P1 (RC1): a scripted drag moves the transform by exactly the drag delta", async ({
		page,
	}, testInfo) => {
		await seed(page);
		const before = await settle(page);
		await dragCanvas(page, P1_DRAG.dx, P1_DRAG.dy);
		const after = await settle(page);
		const delta = {
			x: after.x - before.x,
			y: after.y - before.y,
			k: after.k - before.k,
		};
		await attachObserved(testInfo, { before, after, delta, want: P1_DRAG });

		expect(Math.abs(delta.x - P1_DRAG.dx)).toBeLessThanOrEqual(
			DRAG_DELTA_TOLERANCE_PX,
		);
		expect(Math.abs(delta.y - P1_DRAG.dy)).toBeLessThanOrEqual(
			DRAG_DELTA_TOLERANCE_PX,
		);
		expect(delta.k, "a drag must not change the zoom factor").toBe(0);
	});

	test("P1 (RC1): a rapid wheel sequence keeps every tick", async ({
		page,
	}, testInfo) => {
		await seed(page);
		const before = await settle(page);
		const p = await emptyCanvasPoint(page);
		await page.mouse.move(p.x, p.y);
		await startRecording(page);
		// Back-to-back, with no settle between ticks: that is the sequence a
		// mid-gesture rebind could drop a tick from.
		for (let i = 0; i < WHEEL_TICKS; i++) await page.mouse.wheel(0, 100);
		const after = await settle(page);
		const ks = (await stopRecording(page)).map((f) => f.k);
		await attachObserved(testInfo, {
			before,
			after,
			ks,
			expected: WHEEL_K_BASELINE,
		});

		expect(ks.length, "the wheel must move the transform").toBeGreaterThan(0);
		for (let i = 1; i < ks.length; i++) {
			expect(
				ks[i],
				`wheel frame ${i} must not zoom back in`,
			).toBeLessThanOrEqual(ks[i - 1]);
		}
		expect(after.k).toBeLessThan(before.k);
		expect(
			Math.abs(after.k - WHEEL_K_BASELINE) / WHEEL_K_BASELINE,
			"final zoom must stay within 2% of the pre-change value",
		).toBeLessThanOrEqual(WHEEL_K_TOLERANCE);
	});

	test("P0-6b (probe): the canvas container cannot be scrolled, even by a plain focus()", async ({
		page,
	}, testInfo) => {
		const o = await focusOffscreenProbe(page);
		await attachObserved(testInfo, o);

		// Sanity: the probe is only meaningful if the card really is off-screen
		// on the side the container used to scroll toward.
		expect(o.card.left).toBeGreaterThan(o.container.right);

		// Phase 0 recorded 40px of scrollable x overflow here (the 800px
		// watermark inside a container narrowed by the open SidePanel) and a
		// plain focus() consuming all of it: `overflow-hidden` leaves an
		// element scrollable programmatically, only not by the user. Phase 3
		// made the container `overflow: clip` (index.css .rv-canvas), which
		// takes the scrolling box away — the overflow RECTANGLE is still
		// there (Chrome keeps reporting scrollWidth > clientWidth, see the
		// attachment), but scrollLeft/scrollTop can no longer leave 0, so
		// NEITHER focus() moves the canvas. That is the layer native Tab
		// focus needs, because Tab cannot pass `preventScroll`; the app's own
		// preventScroll options are the second layer, kept as well.
		const zero = { left: 0, top: 0 };
		expect(o.overflow, "the container must not be a scroll container").toEqual({
			x: "clip",
			y: "clip",
		});
		expect(o.cardPreventScroll, "card preventScroll").toEqual(zero);
		expect(o.inputPreventScroll, "input preventScroll").toEqual(zero);
		expect(o.cardPlain, "plain card.focus()").toEqual(zero);
		expect(o.inputPlain, "plain input.focus()").toEqual(zero);
	});

	// --- Phase 2 guards -------------------------------------------------------
	// Permanent cases for the focus controller, DOM measurement and explicit
	// requests. P0-3 above is the LR half of the navigation guard.

	test("P2 (RC11): TB arrow navigation keeps the focused card inside the canvas", async ({
		page,
	}, testInfo) => {
		const o = await navigateTB(page);
		await attachObserved(testInfo, o);

		for (const step of o.steps) {
			expect(
				isInside(step.card, step.container),
				`after ${step.key}: focused card must be fully inside the canvas`,
			).toBe(true);
		}
	});

	test("P2 (RC3): clicking a card near the right edge pans once, after the SidePanel settles", async ({
		page,
	}, testInfo) => {
		const o = await clickCardNearRightEdge(page);
		await attachObserved(testInfo, o);

		// Sanity: selecting really did shrink the canvas, and a pan happened.
		const widthBefore = o.containerBefore.right - o.containerBefore.left;
		const widthAfter = o.containerAfter.right - o.containerAfter.left;
		expect(widthAfter, "the SidePanel must shrink the canvas").toBeLessThan(
			widthBefore,
		);
		expect(o.frameCount, "the click must move the camera").toBeGreaterThan(0);

		// One pan, not the old click-pan + resize-re-pan pair: the first frame
		// is already measured against the SHRUNK canvas...
		expect(o.firstFrameWidth).toBeCloseTo(widthAfter, 0);
		// ...and the camera never doubles back.
		expect(o.xReversals, "x must move in one direction").toBe(0);
		expect(o.yReversals, "y must move in one direction").toBe(0);

		// A `nearest` reveal clamps the card centre ONTO the zone edge, so the
		// expected result sits exactly on the boundary (observed: 760.0 against
		// a 760.0 edge). ZONE_EPSILON_PX keeps a sub-pixel rect rounding from
		// turning that into a failure without hiding a real mis-pan.
		expect(isInside(o.card, o.containerAfter)).toBe(true);
		expect(o.cardCenter.x).toBeGreaterThanOrEqual(
			o.comfortZone.left - ZONE_EPSILON_PX,
		);
		expect(o.cardCenter.x).toBeLessThanOrEqual(
			o.comfortZone.right + ZONE_EPSILON_PX,
		);
		expect(o.cardCenter.y).toBeGreaterThanOrEqual(
			o.comfortZone.top - ZONE_EPSILON_PX,
		);
		expect(o.cardCenter.y).toBeLessThanOrEqual(
			o.comfortZone.bottom + ZONE_EPSILON_PX,
		);
	});

	test("P2: header search reveals a match inside a collapsed subtree and centres it", async ({
		page,
	}, testInfo) => {
		const o = await searchIntoCollapsedSubtree(page);
		await attachObserved(testInfo, o);

		expect(isInside(o.card, o.container)).toBe(true);
		// CENTRE_TOLERANCE_PX: the pan lands the card centre exactly on the
		// container centre, so the only slack is sub-pixel — fractional
		// getBoundingClientRect values on both rects plus the settle detector
		// sampling the last animation frame. 2px covers that without hiding a
		// real mis-centring (the comfort zone alone is +/-180px wide here).
		expect(Math.abs(o.offset.x)).toBeLessThanOrEqual(CENTRE_TOLERANCE_PX);
		expect(Math.abs(o.offset.y)).toBeLessThanOrEqual(CENTRE_TOLERANCE_PX);
	});

	test("P2 (RC5): fit-to-view ignores the cards a collapsed subtree unmounted", async ({
		page,
	}, testInfo) => {
		const o = await collapseThenFit(page);
		await attachObserved(testInfo, o);

		// Sanity: the grandchildren really are gone from the DOM.
		expect(o.cards).toHaveLength(NODE_COUNT - GRANDCHILDREN.length);

		expect(o.settled.k).toBeGreaterThanOrEqual(SCALE_EXTENT.min);
		expect(o.settled.k).toBeLessThanOrEqual(SCALE_EXTENT.max);
		for (const card of o.cards) {
			expect(
				isInside(card, o.container),
				`${card.id} must be inside the canvas after a fit`,
			).toBe(true);
		}
	});

	test("P2 (A7): reordering and flipping the layout keep the focused card in view", async ({
		page,
	}, testInfo) => {
		const o = await relayoutAroundFocus(page);
		await attachObserved(testInfo, o);

		expect(
			isInside(o.afterMove.card, o.afterMove.container),
			"after Ctrl+ArrowUp",
		).toBe(true);
		expect(
			isInside(o.afterLayout.card, o.afterLayout.container),
			"after the layout flip",
		).toBe(true);
	});

	// --- Phase 3 guards (RC8 + the scroll hazard) -----------------------------
	// Logical focus and DOM focus are one thing now: the card the store calls
	// focused is the card `document.activeElement` points at, and the camera
	// can no longer be scrolled out from under either of them.

	test("P3 (RC8): arrow navigation moves DOM focus with logical focus", async ({
		page,
	}, testInfo) => {
		const o = await navigateTB(page);
		await attachObserved(testInfo, o);

		for (const [i, step] of o.steps.entries()) {
			expect(step.focused, `after ${step.key}: one logical focus`).toEqual([
				CHILDREN[i],
			]);
			expect(
				step.active,
				`after ${step.key}: document.activeElement is that card`,
			).toBe(CHILDREN[i]);
		}
		// The later steps need a pan; the transform must have moved at least once.
		const xs = new Set(o.steps.map((s) => s.transform.x));
		expect(xs.size, "at least one step must pan the camera").toBeGreaterThan(1);
		expect(o.scroll).toEqual({ left: 0, top: 0 });
	});

	test("P3 (A8): Enter on a rename leaves DOM focus on the renamed card", async ({
		page,
	}, testInfo) => {
		const o = await renameThen(page, "Enter");
		await attachObserved(testInfo, o);

		expect(o.title, "the commit must land").toBe("C8 renamed");
		expect(o.active.card, "the renamed card holds DOM focus").toBe(C8);
		expect(o.focused).toEqual([C8]);
		expect(o.scroll).toEqual({ left: 0, top: 0 });
	});

	test("P3 (A8): Escape on a rename leaves DOM focus on the card", async ({
		page,
	}, testInfo) => {
		const o = await renameThen(page, "Escape");
		await attachObserved(testInfo, o);

		expect(o.title, "the title must be unchanged").toBe("C8");
		expect(o.active.card, "the card holds DOM focus").toBe(C8);
		expect(o.focused).toEqual([C8]);
		expect(o.scroll).toEqual({ left: 0, top: 0 });
	});

	test("P3 (A8): a blur-commit leaves focus in the field the user clicked", async ({
		page,
	}, testInfo) => {
		const o = await renameThenClickPanelField(page);
		await attachObserved(testInfo, o);

		expect(o.title, "the blur must still commit").toBe("Root renamed");
		expect(o.active.label, "focus stays in the SidePanel title field").toBe(
			"Title",
		);
		expect(o.active.card).toBeNull();
		expect(o.scroll).toEqual({ left: 0, top: 0 });
	});

	test("P3 (RC8): the header search keeps focus while matches are revealed", async ({
		page,
	}, testInfo) => {
		const o = await searchIntoCollapsedSubtree(page);
		const active = await activeElementInfo(page);
		await attachObserved(testInfo, { ...o, active });

		// The match was expanded, focused and centred (the P2 case above) — but
		// the user is still typing, so nothing may take the caret off them.
		expect(isInside(o.card, o.container)).toBe(true);
		expect(active.label).toBe("Search nodes");
		expect(active.card).toBeNull();
	});

	test("P3 (RC8): exactly one card is in the tab order, and Tab enters the tree", async ({
		page,
	}, testInfo) => {
		const o = await tabIntoTree(page);
		await attachObserved(testInfo, o);

		// Nothing focused yet: the root is the way in.
		expect(o.beforeFocus).toEqual([]);
		expect(o.stopsWhileUnfocused).toEqual([ROOT]);
		expect(o.landedOn, "Tab from the canvas lands on the root card").toBe(ROOT);

		// Once the tree has a focused node, that node is the only tab stop.
		expect(o.focusedAfterArrow).toEqual([CHILDREN[0]]);
		expect(o.stopsWhileFocused).toEqual([CHILDREN[0]]);
		expect(o.scroll).toEqual({ left: 0, top: 0 });
	});

	test("P3 (RC8): tabbing back into the tree reveals an off-screen card", async ({
		page,
	}, testInfo) => {
		const o = await tabBackToAnOffscreenCard(page);
		await attachObserved(testInfo, o);

		// Sanity: the pan really did take the tab stop off screen, so Tab had
		// somewhere invisible to land.
		expect(o.offscreenBefore, "the card must start off screen").toBe(true);

		expect(o.active, "Tab lands on the tab-stop card").toBe(C8);
		expect(o.focused).toEqual([C8]);
		// ...and the camera brought it back: `overflow: clip` means the browser
		// cannot scroll it into view, so the reveal is the only thing that can.
		expect(isInside(o.card, o.container), "the card must be revealed").toBe(
			true,
		);
		expect(o.scroll).toEqual({ left: 0, top: 0 });
	});

	// --- Phase 4 guards (RC4 + RC6) -------------------------------------------
	// One create-and-rename path, and focus that always names a mounted card.

	test("P4 (RC4): Tab creates a sibling and renames it on screen", async ({
		page,
	}, testInfo) => {
		const o = await createViaKey(page, C8, "Tab");
		await attachObserved(testInfo, o);

		expect(o.newNodeId).not.toBeNull();
		expect(o.focused, "the NEW node holds canvas focus").toEqual([o.newNodeId]);
		expect(o.active.label, "its rename input holds DOM focus").toBe(
			"Rename node",
		);
		expect(
			isInside(o.renameInput, o.container),
			"the rename input must be inside the canvas",
		).toBe(true);
		expect(o.renameStillOpen).toBe(true);
		expect(o.scroll).toEqual({ left: 0, top: 0 });
	});

	test("P4 (RC4): Ctrl+D duplicates and renames the copy on screen", async ({
		page,
	}, testInfo) => {
		const o = await createViaKey(page, C8, "Control+d");
		await attachObserved(testInfo, o);

		expect(o.newNodeId).not.toBeNull();
		expect(o.newNodeId).not.toBe(C8);
		expect(o.focused).toEqual([o.newNodeId]);
		expect(o.active.label).toBe("Rename node");
		expect(isInside(o.renameInput, o.container)).toBe(true);
		expect(o.renameStillOpen).toBe(true);
		expect(o.scroll).toEqual({ left: 0, top: 0 });
	});

	// The Radix close-autofocus race, through the REAL menu. A menu item's
	// onSelect runs while the menu's FocusScope is still trapping, so an input
	// opened in that tick is pulled back out and blur-commits its placeholder.
	test("P4 (RC4): the context menu's Add Child opens a rename that survives the menu", async ({
		page,
	}, testInfo) => {
		const o = await contextMenuAddChild(page);
		await attachObserved(testInfo, o);

		expect(o.whileOpen.newNodeId).not.toBeNull();
		expect(o.whileOpen.menusWhileRenaming, "the menu is gone").toBe(0);
		expect(
			o.whileOpen.renameStillOpen,
			"the input must not have been blur-committed",
		).toBe(true);
		expect(o.whileOpen.active.label).toBe("Rename node");
		expect(
			isInside(o.whileOpen.renameInput, o.whileOpen.container),
			"the rename input must be inside the canvas",
		).toBe(true);
		expect(o.whileOpen.focused).toEqual([o.whileOpen.newNodeId]);

		// ...and typing into it names the new node, leaving DOM focus on its card.
		expect(o.committed.title).toBe("From the menu");
		expect(o.committed.active).toBe(o.whileOpen.newNodeId);
		expect(o.committed.focused).toEqual([o.whileOpen.newNodeId]);
		expect(isInside(o.committed.card, o.committed.container)).toBe(true);
		expect(o.whileOpen.scroll).toEqual({ left: 0, top: 0 });
		expect(o.committed.scroll).toEqual({ left: 0, top: 0 });
	});

	test("P4 (A6): the child key expands a collapsed node, then enters it", async ({
		page,
	}, testInfo) => {
		const o = await collapseThenChildKeyTwice(page);
		await attachObserved(testInfo, o);

		expect(o.afterFirst.focused, "the first press keeps focus").toEqual([C6]);
		expect(o.afterFirst.active).toBe(C6);
		expect(o.afterSecond.focused, "the second press enters G1").toEqual([
			GRANDCHILDREN[0],
		]);
		expect(o.afterSecond.active).toBe(GRANDCHILDREN[0]);
		expect(isInside(o.card, o.container)).toBe(true);
		expect(o.scroll).toEqual({ left: 0, top: 0 });
	});

	for (const how of ["chevron", "menu"] as const) {
		test(`P4 (RC6): collapsing an ancestor by ${how} moves focus onto it`, async ({
			page,
		}, testInfo) => {
			const o = await collapseWithDescendantFocused(page, how);
			await attachObserved(testInfo, o);

			expect(o.focusedBefore, "focus starts on the grandchild").toEqual([
				GRANDCHILDREN[0],
			]);

			expect(o.afterCollapse, "the collapsed node takes focus").toEqual([C6]);
			expect(isInside(o.card, o.container)).toBe(true);
			// Phase 0: the next sibling key resolved inside the hidden subtree and
			// the canvas showed no focus at all until a mouse click.
			expect(o.afterArrow, "the keyboard keeps working").toEqual([C7]);
			expect(o.activeAfterArrow, "and DOM focus goes with it").toBe(C7);
			expect(o.scroll).toEqual({ left: 0, top: 0 });

			if (how === "chevron") {
				// The chevron does not move logical focus (it is tabIndex=-1 and
				// the card ignores descendant focusin), so this is the path that
				// really exercises the invariant: focus is still on the hidden
				// grandchild when the subtree closes.
				expect(o.focusedAfterOpen).toEqual([GRANDCHILDREN[0]]);
				expect(o.activeAfterCollapse, "DOM focus follows onto it").toBe(C6);
			} else {
				// Chrome focuses a card on right-click, so the menu path has
				// already landed on C6 before "Collapse subtree" runs — the
				// invariant is a no-op here and the end state is right anyway.
				// DOM focus is `<body>` because the app prevents Radix's
				// close-autofocus (ContextMenu.tsx); the first arrow key above
				// recovers it.
				expect(o.focusedAfterOpen).toEqual([C6]);
				expect(o.activeAfterCollapse).toBeNull();
			}
		});
	}

	test("P3 (RC8): a focused card paints one ring, and a clicked one gains none", async ({
		page,
	}, testInfo) => {
		const o = await focusRingStyles(page);
		await attachObserved(testInfo, o);

		// Keyboard: :focus-visible matches AND .keyboard-nav-active does, but
		// the more specific keyboard-nav rule owns `outline`, so exactly one
		// ring paints — the dashed one the app has always drawn on the focused
		// card, not a second solid :focus-visible outline stacked on it.
		expect(o.keyboard.isActiveElement).toBe(true);
		expect(o.keyboard.focusVisible).toBe(true);
		expect(o.keyboard.keyboardNav).toBe(true);
		expect(o.keyboard.outlineStyle).toBe("dashed");
		expect(o.keyboard.outlineWidth).toBe("2px");
		expect(o.keyboard.outlineOffset).toBe("2px");

		// Mouse: the card holds DOM focus too, but :focus-visible does not
		// match a pointer-driven focus, so the card keeps exactly the solid
		// selection outline it had before Phase 3 (-1px inset, from Tailwind).
		expect(o.mouse.isActiveElement).toBe(true);
		expect(o.mouse.focusVisible).toBe(false);
		expect(o.mouse.keyboardNav).toBe(false);
		expect(o.mouse.outlineStyle).toBe("solid");
		expect(o.mouse.outlineOffset).toBe("-1px");
	});
});
