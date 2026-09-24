import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, type Page, test } from "@playwright/test";
import {
	CHEVRON_COLLAPSE_LABEL,
	CHEVRON_EXPAND_LABEL,
	CHEVRON_SELECTOR,
	COLLAPSE_ALL_LABEL,
	CUSTOM_LAYOUT_LABEL,
	collapseToDepthLabel,
	EXPAND_ALL_LABEL,
	KNOB_RESET_LABEL,
	KNOB_SIBLING_GAP_LABEL,
	LAYOUT_KNOBS_TRIGGER_LABEL,
	linkClassFor,
	NODE_CARD_ATTR,
	NODE_FOCUSED_ATTR,
	NODE_OFFSET_ATTR,
	NODE_PROGRESS_ATTR,
	NODE_RIBBON_ATTR,
	NODE_STATUS_ATTR,
	NODE_TYPE_CHIP_ATTR,
	RESET_POSITIONS_LABEL,
} from "../../src/mainview/lib/domContract";
import {
	CONTAINER,
	dragCard,
	emptyCanvasPoint,
} from "./helpers/canvasGestures";
import { seedSchema } from "./helpers/seed";

// v0.8.4 Phase 0 — evidence gate for RC1 (collapse state wiped by any
// structural edit) and RC2 (sibling reorder ignores layout orientation).
//
// Modelled on the "v0.8.1 Phase 0 evidence" block in canvas-focus.spec.ts:
// real-browser reproduction against the UNMODIFIED renderer under Vite dev
// (port 5173), via the __ROADRAVEN_TEST__.loadSchema seam (App.tsx, DEV-only).
//
// Cases that reproduce a bug call test.fail() AFTER their setup and sanity
// checks, so only the behavioural assertion is expected to fail: a broken
// seam or fixture still turns the suite red. Remove the test.fail() line when
// the named phase lands its fix.

const RICH_TREE_FIXTURE = join(__dirname, "../fixtures/rich-tree.json");

const PHASE_A = "e7f4a1b0-2222-4aaa-8bbb-ccccccccccc2";
const TASK_A1 = "e7f4a1b0-3333-4aaa-8bbb-ccccccccccc3";
const TASK_A2 = "e7f4a1b0-3333-4aaa-8bbb-ccccccccccc4";
const PHASE_B = "e7f4a1b0-2222-4aaa-8bbb-ccccccccccc5";

async function seedRichTree(page: Page): Promise<void> {
	const schema = JSON.parse(readFileSync(RICH_TREE_FIXTURE, "utf-8"));
	await seedSchema(page, schema);
	await page.waitForSelector(`[${NODE_CARD_ATTR}]`);
	await expect(page.locator(`[${NODE_CARD_ATTR}]`)).toHaveCount(6);
}

/**
 * Card ids in current DOM order, read the same blunt way a real reorder bug
 * would be noticed — a plain document query — so the assertion can't be
 * fooled by a component that computes the right order but renders it wrong.
 */
async function cardOrder(page: Page): Promise<string[]> {
	return page.evaluate(
		(attr) =>
			Array.from(document.querySelectorAll(`[${attr}]`)).map(
				(el) => el.getAttribute(attr) ?? "",
			),
		NODE_CARD_ATTR,
	);
}

test.describe("Canvas comfort — v0.8.4 Phase 0 evidence", () => {
	test.describe.configure({ mode: "default" });

	test("P0-1 (RC1): a structural edit elsewhere wipes an unrelated collapsed subtree", async ({
		page,
	}) => {
		await seedRichTree(page);

		const phaseACard = page.locator(`[${NODE_CARD_ATTR}="${PHASE_A}"]`);
		// CHEVRON_SELECTOR (not the label) so the SAME locator keeps resolving
		// to the chevron after its own click flips the aria-label it carries.
		const phaseAChevron = phaseACard.locator(CHEVRON_SELECTOR);
		await expect(phaseAChevron).toHaveAttribute(
			"aria-label",
			CHEVRON_COLLAPSE_LABEL,
		);
		await phaseAChevron.click();
		await expect(phaseAChevron).toHaveAttribute(
			"aria-label",
			CHEVRON_EXPAND_LABEL,
		);
		await expect(page.locator(`[${NODE_CARD_ATTR}="${TASK_A1}"]`)).toHaveCount(
			0,
		);
		await expect(page.locator(`[${NODE_CARD_ATTR}="${TASK_A2}"]`)).toHaveCount(
			0,
		);

		const phaseBCard = page.locator(`[${NODE_CARD_ATTR}="${PHASE_B}"]`);
		await phaseBCard.click();
		await expect(phaseBCard).toHaveAttribute(NODE_FOCUSED_ATTR, "true");

		await page.keyboard.press("Enter");
		await expect(page.locator('input[aria-label="Rename node"]')).toBeVisible();
		await page.keyboard.press("Escape");
		await expect(page.locator('input[aria-label="Rename node"]')).toHaveCount(
			0,
		);

		// RC1: react-d3-tree's assignInternalProperties rewrites
		// __rd3t.collapsed=false for EVERY node whenever dataKey changes, and
		// any structural edit (here: Phase B's new child) bumps dataKey — so
		// Phase A's unrelated collapse was wiped. Fixed in Phase 4: collapse
		// state lives in fileViewStore and the tree is handed a pruned copy.

		await expect(phaseAChevron).toHaveAttribute(
			"aria-label",
			CHEVRON_EXPAND_LABEL,
		);
		await expect(page.locator(`[${NODE_CARD_ATTR}="${TASK_A1}"]`)).toHaveCount(
			0,
		);
	});

	test("P0-2 (RC2): Ctrl+ArrowRight does not reorder siblings in TB layout", async ({
		page,
	}) => {
		await seedRichTree(page);
		const taskA1 = page.locator(`[${NODE_CARD_ATTR}="${TASK_A1}"]`);
		await taskA1.click();
		await expect(taskA1).toHaveAttribute(NODE_FOCUSED_ATTR, "true");

		await page.keyboard.press("Control+ArrowRight");

		// RC2: Ctrl+ArrowUp/Down used to be the only reorder pair, fixed to the
		// vertical axis, while sibling navigation followed layout orientation —
		// so in TB (the default) Ctrl+Right fell into the sibling-navigation
		// branch, not reorder. Fixed in Phase 5: useKeyboardRouter.ts derives an
		// orientation-aware `reorderKeys` pair (Ctrl+Left/Right in TB) next to
		// the legacy Ctrl+Up/Down pair, which still works in both layouts (D-8).

		const order = await cardOrder(page);
		expect(order.indexOf(TASK_A2)).toBeLessThan(order.indexOf(TASK_A1));
	});

	test("P0-3 (RC2 control): Ctrl+ArrowDown still reorders siblings (legacy pair, D-8)", async ({
		page,
	}) => {
		await seedRichTree(page);
		const taskA1 = page.locator(`[${NODE_CARD_ATTR}="${TASK_A1}"]`);
		await taskA1.click();
		await expect(taskA1).toHaveAttribute(NODE_FOCUSED_ATTR, "true");

		await page.keyboard.press("Control+ArrowDown");

		const order = await cardOrder(page);
		expect(order.indexOf(TASK_A2)).toBeLessThan(order.indexOf(TASK_A1));
	});
});

// v0.8.4 Phase 1 — card visuals in the real renderer: the ribbon paints the
// stripe's ink, in-progress cards are scaled by CSS, the progress line counts
// direct children, and scaled siblings keep clear of each other.
const ROOT = "e7f4a1b0-1111-4aaa-8bbb-ccccccccccc1";

const SIBLINGS_SCHEMA = {
	version: "1.0",
	title: "In-progress siblings",
	typeConfig: [{ id: "task", label: "Task" }],
	nodes: [
		{
			id: "p1-root",
			title: "Root",
			status: "not-started",
			children: [
				{
					id: "p1-left",
					title: "Left sibling with a long enough title to wrap",
					status: "in-progress",
					type: "task",
				},
				{
					id: "p1-right",
					title: "Right sibling with a long enough title to wrap",
					status: "in-progress",
					type: "unknown-kind",
				},
			],
		},
	],
};

test.describe("Canvas comfort — Phase 1 card visuals", () => {
	test("P1-1: an in-progress parent says how many direct children are done", async ({
		page,
	}) => {
		await seedRichTree(page);
		const root = page.locator(`[${NODE_CARD_ATTR}="${ROOT}"]`);
		await expect(root.locator(`[${NODE_PROGRESS_ATTR}]`)).toHaveText(
			"1 / 2 done",
		);
		// Completed Phase A has children too, but only in-progress cards count.
		await expect(
			page.locator(`[${NODE_CARD_ATTR}="${PHASE_A}"] [${NODE_PROGRESS_ATTR}]`),
		).toHaveCount(0);
	});

	test("P1-2: the ribbon is painted with the stripe's ink on every card", async ({
		page,
	}) => {
		await seedRichTree(page);
		const pairs = await page.evaluate(
			({ card, ribbon }) =>
				Array.from(document.querySelectorAll(`[${card}]`)).map((el) => {
					const band = el.querySelector(`[${ribbon}]`);
					return {
						id: el.getAttribute(card),
						stripe: getComputedStyle(el, "::before").backgroundColor,
						ribbon: band ? getComputedStyle(band).backgroundColor : null,
					};
				}),
			{ card: NODE_CARD_ATTR, ribbon: NODE_RIBBON_ATTR },
		);
		expect(pairs).toHaveLength(6);
		for (const p of pairs) {
			expect(p.ribbon, `ribbon on ${p.id}`).toBe(p.stripe);
			expect(p.stripe).not.toBe("rgba(0, 0, 0, 0)");
		}
	});

	test("P1-3: in-progress cards are scaled by CSS, others are not", async ({
		page,
	}) => {
		await seedRichTree(page);
		const transformOf = (id: string) =>
			page
				.locator(`[${NODE_CARD_ATTR}="${id}"]`)
				.evaluate((el) => getComputedStyle(el).transform);
		await expect(page.locator(`[${NODE_CARD_ATTR}="${ROOT}"]`)).toHaveAttribute(
			NODE_STATUS_ATTR,
			"in-progress",
		);
		expect(await transformOf(ROOT)).toMatch(/^matrix\(1\.06, 0, 0, 1\.06, /);
		expect(await transformOf(PHASE_A)).toBe("none");
	});

	test("P1-4: two adjacent in-progress siblings never touch", async ({
		page,
	}) => {
		await seedSchema(page, SIBLINGS_SCHEMA);
		await expect(page.locator(`[${NODE_CARD_ATTR}]`)).toHaveCount(3);
		const left = page.locator(`[${NODE_CARD_ATTR}="p1-left"]`);
		const right = page.locator(`[${NODE_CARD_ATTR}="p1-right"]`);
		await expect(left.locator(`[${NODE_TYPE_CHIP_ATTR}]`)).toHaveText("Task");
		await expect(right.locator(`[${NODE_TYPE_CHIP_ATTR}]`)).toHaveText(
			"unknown-kind",
		);

		const a = await left.boundingBox();
		const b = await right.boundingBox();
		if (!a || !b) throw new Error("sibling cards have no box");
		const [first, second] = a.x < b.x ? [a, b] : [b, a];
		const intersects =
			first.x + first.width > second.x &&
			second.x + second.width > first.x &&
			first.y + first.height > second.y &&
			second.y + second.height > first.y;
		expect(intersects).toBe(false);
		// The live pulse ring paints 3px outside each card; with siblings at
		// 1.1 separation the scaled cards keep more than a tenth of a card
		// width clear (at 1.0 it was ~3%, ring to ring about 1px).
		const gap = second.x - (first.x + first.width);
		expect(gap / first.width).toBeGreaterThan(0.1);
	});
});

// v0.8.4 Phase 2 — layout knobs popover, applied live to the canvas.
// not-started siblings (no Phase 1 in-progress CSS scale) so the measured
// distance is purely a function of the tree layout, not card scaling.
const KNOBS_SIBLINGS_SCHEMA = {
	version: "1.0",
	title: "Layout knobs siblings",
	nodes: [
		{
			id: "p2-root",
			title: "Root",
			status: "not-started",
			children: [
				{ id: "p2-left", title: "Left", status: "not-started" },
				{ id: "p2-right", title: "Right", status: "not-started" },
			],
		},
	],
};

async function siblingCentreDistance(page: Page): Promise<number> {
	const left = await page
		.locator(`[${NODE_CARD_ATTR}="p2-left"]`)
		.boundingBox();
	const right = await page
		.locator(`[${NODE_CARD_ATTR}="p2-right"]`)
		.boundingBox();
	if (!left || !right) throw new Error("sibling cards have no box");
	const centreOf = (b: NonNullable<typeof left>) => b.x + b.width / 2;
	return Math.abs(centreOf(right) - centreOf(left));
}

test.describe("Canvas comfort — Phase 2 layout knobs", () => {
	test("P2-1: the sibling-gap slider grows the sibling distance live, Reset restores it, and an untitled reseed does not carry it over", async ({
		page,
	}) => {
		await seedSchema(page, KNOBS_SIBLINGS_SCHEMA);
		await expect(page.locator(`[${NODE_CARD_ATTR}]`)).toHaveCount(3);
		const defaultDistance = await siblingCentreDistance(page);

		await page
			.getByRole("button", { name: LAYOUT_KNOBS_TRIGGER_LABEL })
			.click();
		const slider = page.getByRole("slider", { name: KNOB_SIBLING_GAP_LABEL });
		await expect(slider).toBeVisible();
		await slider.fill("2");
		await slider.dispatchEvent("input");

		const grownDistance = await siblingCentreDistance(page);
		// Default siblingGap is 1.1 (Phase 1); nodeSize.x (the TB sibling axis)
		// is unaffected by depthGap, so the gap scales ~linearly with
		// separation.siblings for two leaf siblings under one root.
		const expectedFactor = 2.0 / 1.1;
		const actualFactor = grownDistance / defaultDistance;
		expect(actualFactor).toBeGreaterThan(expectedFactor * 0.7);
		expect(actualFactor).toBeLessThan(expectedFactor * 1.3);

		// Reset restores the default distance, in the same popover session.
		await page.getByRole("button", { name: KNOB_RESET_LABEL }).click();
		const resetDistance = await siblingCentreDistance(page);
		expect(resetDistance).toBeCloseTo(defaultDistance, 0);

		// Grow it again, then reseed (a fresh, untitled open — the
		// __ROADRAVEN_TEST__ seam always loads with filePath null): the knob
		// must not leak into the new session.
		await slider.fill("2");
		await slider.dispatchEvent("input");
		expect(await siblingCentreDistance(page)).toBeGreaterThan(defaultDistance);

		await seedSchema(page, KNOBS_SIBLINGS_SCHEMA);
		await expect(page.locator(`[${NODE_CARD_ATTR}]`)).toHaveCount(3);
		const reseededDistance = await siblingCentreDistance(page);
		expect(reseededDistance).toBeCloseTo(defaultDistance, 0);
	});
});

// v0.8.4 Phase 3 — custom layout: with the popover's checkbox ticked, a card
// can be dragged; the offset is view state only. Seeded untitled (the
// __ROADRAVEN_TEST__ seam), so nothing here persists — persistence is pinned
// by tests/unit/hooks/useFileViewSettings.test.ts.

type Box = { x: number; y: number; width: number; height: number };

async function cardBox(page: Page, id: string): Promise<Box> {
	const box = await page.locator(`[${NODE_CARD_ATTR}="${id}"]`).boundingBox();
	if (!box) throw new Error(`card ${id} has no box`);
	return box;
}

async function allCardBoxes(page: Page): Promise<Record<string, Box>> {
	return page.evaluate((attr) => {
		const out: Record<string, Box> = {};
		for (const el of document.querySelectorAll(`[${attr}]`)) {
			const r = el.getBoundingClientRect();
			out[el.getAttribute(attr) ?? ""] = {
				x: r.x,
				y: r.y,
				width: r.width,
				height: r.height,
			};
		}
		return out;
	}, NODE_CARD_ATTR);
}

async function canvasTransform(page: Page): Promise<string> {
	return page.evaluate(
		() => document.querySelector("g.rd3t-g")?.getAttribute("transform") ?? "",
	);
}

async function canvasScale(page: Page): Promise<number> {
	const m = /scale\(([^)]+)\)/.exec(await canvasTransform(page));
	return m ? Number(m[1]) : 1;
}

/** The end point of the connector into `targetId`, in SVG units. */
async function linkEnd(
	page: Page,
	targetId: string,
): Promise<{ x: number; y: number }> {
	const d = await page.evaluate(
		(cls) => document.getElementsByClassName(cls)[0]?.getAttribute("d") ?? "",
		linkClassFor(targetId),
	);
	const n = (d.match(/-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi) ?? []).map(
		Number,
	);
	if (n.length !== 5) throw new Error(`unexpected connector d: ${d}`);
	// TB step path: M sx,sy V mid H tx V ty.
	return { x: n[3], y: n[4] };
}

/** Opens the layout popover, sets Custom layout, closes it again. */
async function setCustomLayout(page: Page, on: boolean): Promise<void> {
	await page.getByRole("button", { name: LAYOUT_KNOBS_TRIGGER_LABEL }).click();
	const box = page.getByRole("checkbox", { name: CUSTOM_LAYOUT_LABEL });
	await expect(box).toBeVisible();
	await box.setChecked(on);
	await page.keyboard.press("Escape");
	await expect(page.getByRole("menu")).toHaveCount(0);
}

function expectMovedBy(after: Box, before: Box, dx: number, dy: number): void {
	expect(Math.abs(after.x - before.x - dx)).toBeLessThanOrEqual(2);
	expect(Math.abs(after.y - before.y - dy)).toBeLessThanOrEqual(2);
}

function expectSameBox(after: Box, before: Box): void {
	expectMovedBy(after, before, 0, 0);
}

test.describe("Canvas comfort — Phase 3 custom layout", () => {
	test("P3-1: dragging Task A1 moves only that card and the connector into it, by the pointer delta", async ({
		page,
	}) => {
		await seedRichTree(page);
		await setCustomLayout(page, true);
		const before = await allCardBoxes(page);
		const endBefore = await linkEnd(page, TASK_A1);
		const k = await canvasScale(page);

		await dragCard(page, TASK_A1, 120, 60);

		const after = await allCardBoxes(page);
		expectMovedBy(after[TASK_A1], before[TASK_A1], 120, 60);
		for (const id of Object.keys(before)) {
			if (id !== TASK_A1) expectSameBox(after[id], before[id]);
		}
		const endAfter = await linkEnd(page, TASK_A1);
		expect(Math.abs((endAfter.x - endBefore.x) * k - 120)).toBeLessThanOrEqual(
			2,
		);
		expect(Math.abs((endAfter.y - endBefore.y) * k - 60)).toBeLessThanOrEqual(
			2,
		);
		// The click that follows a real drag is swallowed: no selection.
		await expect(
			page.locator(`[${NODE_CARD_ATTR}="${TASK_A1}"]`),
		).not.toHaveAttribute("data-selected", "true");
	});

	test("P3-2: with Custom layout off (the default) the same drag moves nothing", async ({
		page,
	}) => {
		await seedRichTree(page);
		const before = await allCardBoxes(page);
		const transformBefore = await canvasTransform(page);

		await dragCard(page, TASK_A1, 120, 60);

		const after = await allCardBoxes(page);
		for (const id of Object.keys(before)) {
			expectSameBox(after[id], before[id]);
		}
		expect(await canvasTransform(page)).toBe(transformBefore);
		// The release lands off the card, so the browser's click targets a
		// common ancestor, not the card: the plain-click path selects nothing.
		await expect(
			page.locator(`[${NODE_CARD_ATTR}="${TASK_A1}"]`),
		).not.toHaveAttribute("data-selected", "true");
	});

	test("P3-2b: a press without movement is still a click that selects the card", async ({
		page,
	}) => {
		await seedRichTree(page);
		await setCustomLayout(page, true);
		const before = await cardBox(page, TASK_A1);

		await dragCard(page, TASK_A1, 2, 1);

		expectSameBox(await cardBox(page, TASK_A1), before);
		await expect(
			page.locator(`[${NODE_CARD_ATTR}="${TASK_A1}"]`),
		).toHaveAttribute("data-selected", "true");
	});

	test("P3-3: unticking Custom layout snaps the card back; ticking again restores the move", async ({
		page,
	}) => {
		await seedRichTree(page);
		await setCustomLayout(page, true);
		const auto = await cardBox(page, TASK_A1);
		await dragCard(page, TASK_A1, 120, 60);
		const moved = await cardBox(page, TASK_A1);
		expectMovedBy(moved, auto, 120, 60);

		await setCustomLayout(page, false);
		expectSameBox(await cardBox(page, TASK_A1), auto);

		await setCustomLayout(page, true);
		expectSameBox(await cardBox(page, TASK_A1), moved);
	});

	test("P3-4: Reset positions returns the card to auto and leaves Custom layout on", async ({
		page,
	}) => {
		await seedRichTree(page);
		await setCustomLayout(page, true);
		const auto = await cardBox(page, TASK_A1);
		await dragCard(page, TASK_A1, 120, 60);
		expectMovedBy(await cardBox(page, TASK_A1), auto, 120, 60);

		await page
			.getByRole("button", { name: LAYOUT_KNOBS_TRIGGER_LABEL })
			.click();
		await page.getByRole("button", { name: RESET_POSITIONS_LABEL }).click();
		await expect(
			page.getByRole("checkbox", { name: CUSTOM_LAYOUT_LABEL }),
		).toBeChecked();
		await page.keyboard.press("Escape");

		expectSameBox(await cardBox(page, TASK_A1), auto);
	});

	test("P3-5: a card drag does not pan the canvas", async ({ page }) => {
		await seedRichTree(page);
		await setCustomLayout(page, true);
		const before = await canvasTransform(page);

		await dragCard(page, TASK_A1, 120, 60);

		expect(await canvasTransform(page)).toBe(before);
	});

	test("P3-6: Fit to view frames a card moved out of the viewport", async ({
		page,
	}) => {
		await seedRichTree(page);
		await setCustomLayout(page, true);
		await dragCard(page, TASK_A1, 120, 60);

		// Push it past the container's right edge.
		const container = await page.locator(CONTAINER).boundingBox();
		if (!container) throw new Error("no canvas container");
		const box = await cardBox(page, TASK_A1);
		const grabX = box.x + box.width * 0.3;
		const viewport = page.viewportSize();
		if (!viewport) throw new Error("no viewport");
		await dragCard(page, TASK_A1, viewport.width - 2 - grabX, 0);
		const off = await cardBox(page, TASK_A1);
		expect(off.x + off.width).toBeGreaterThan(container.x + container.width);

		await page.evaluate(() =>
			window.dispatchEvent(new CustomEvent("roadraven:fit-view")),
		);
		await expect
			.poll(async () => {
				const b = await cardBox(page, TASK_A1);
				return (
					b.x >= container.x &&
					b.y >= container.y &&
					b.x + b.width <= container.x + container.width &&
					b.y + b.height <= container.y + container.height
				);
			})
			.toBe(true);
	});

	// Send-back guard (orchestrator A/B: an always-on wrapper <g> and function
	// pathFunc/pathClassFunc cost 1.12-1.58x on the 1400-node perf cases).
	// With custom layout off the tree must get exactly Phase 2's shape.
	test("P3-7: with Custom layout off the tree renders Phase 2's plain links and bare card placement", async ({
		page,
	}) => {
		const shape = () =>
			page.evaluate(
				(attr) => ({
					linkClasses: Array.from(
						document.querySelectorAll(".rd3t-link"),
						(p) => p.getAttribute("class"),
					),
					offsetTagged: document.querySelectorAll(`[${attr}]`).length,
					placements: Array.from(
						document.querySelectorAll(".rd3t-g foreignObject"),
						(fo) => `${fo.getAttribute("x")},${fo.getAttribute("y")}`,
					),
					// Cards whose foreignObject is not a direct child of
					// react-d3-tree's own node <g> (rd3t-node / rd3t-leaf-node).
					wrapperGroups: Array.from(
						document.querySelectorAll(".rd3t-g foreignObject"),
					).filter(
						(fo) =>
							!/rd3t-(leaf-)?node/.test(
								fo.parentElement?.getAttribute("class") ?? "",
							),
					).length,
				}),
				NODE_OFFSET_ATTR,
			);

		await seedRichTree(page);
		const off = await shape();
		expect(off.linkClasses).toHaveLength(5);
		expect(new Set(off.linkClasses)).toEqual(new Set(["rd3t-link"]));
		expect(off.offsetTagged).toBe(0);
		expect(off.wrapperGroups).toBe(0);
		expect(new Set(off.placements)).toEqual(new Set(["-120,-50"]));

		await setCustomLayout(page, true);
		const on = await shape();
		expect(on.offsetTagged).toBe(6);
		expect(on.linkClasses.some((c) => c?.includes(linkClassFor(TASK_A1)))).toBe(
			true,
		);

		await setCustomLayout(page, false);
		expect(await shape()).toEqual(off);
	});
});

// v0.8.4 Phase 4 — collapse state is owned by fileViewStore (RC1): it
// survives structural edits, and every entry point (chevron, `C`, the node
// menu, search, the canvas-empty menu) drives the same store.
const TASK_B1 = "e7f4a1b0-3333-4aaa-8bbb-ccccccccccc6";

test.describe("Canvas comfort — Phase 4 collapse", () => {
	const card = (page: Page, id: string) =>
		page.locator(`[${NODE_CARD_ATTR}="${id}"]`);
	const chevronOf = (page: Page, id: string) =>
		card(page, id).locator(CHEVRON_SELECTOR);
	const allCards = (page: Page) => page.locator(`[${NODE_CARD_ATTR}]`);

	async function expectPhaseACollapsed(page: Page): Promise<void> {
		await expect(chevronOf(page, PHASE_A)).toHaveAttribute(
			"aria-label",
			CHEVRON_EXPAND_LABEL,
		);
		await expect(card(page, TASK_A1)).toHaveCount(0);
	}

	async function collapsePhaseA(page: Page): Promise<void> {
		await chevronOf(page, PHASE_A).click();
		await expectPhaseACollapsed(page);
	}

	async function canvasMenuItem(page: Page, label: string): Promise<void> {
		const at = await emptyCanvasPoint(page);
		await page.mouse.click(at.x, at.y, { button: "right" });
		const menu = page.getByRole("menu", { name: "Canvas actions" });
		await menu.getByRole("menuitem", { name: label }).click();
	}

	test("P4-1: a collapsed subtree stays collapsed across a reorder, an add and a delete", async ({
		page,
	}) => {
		await seedRichTree(page);
		await collapsePhaseA(page);

		// Reorder (Phase B above Phase A) — a dataKey bump.
		await card(page, PHASE_B).click();
		await expect(card(page, PHASE_B)).toHaveAttribute(
			NODE_FOCUSED_ATTR,
			"true",
		);
		await page.keyboard.press("Control+ArrowUp");
		await expect
			.poll(async () => {
				const order = await cardOrder(page);
				return order.indexOf(PHASE_B) < order.indexOf(PHASE_A);
			})
			.toBe(true);
		await expectPhaseACollapsed(page);

		// Add a child under Task B1, then delete it.
		await card(page, TASK_B1).click();
		await expect(card(page, TASK_B1)).toHaveAttribute(
			NODE_FOCUSED_ATTR,
			"true",
		);
		await page.keyboard.press("Enter");
		await expect(page.locator('input[aria-label="Rename node"]')).toBeVisible();
		await page.keyboard.press("Escape");
		await expect(allCards(page)).toHaveCount(5);
		await expectPhaseACollapsed(page);

		const known = new Set([ROOT, PHASE_A, PHASE_B, TASK_B1]);
		const added = (await cardOrder(page)).find((id) => !known.has(id));
		if (!added) throw new Error("the new node has no card");
		await card(page, added).click();
		await expect(card(page, added)).toHaveAttribute(NODE_FOCUSED_ATTR, "true");
		await page.keyboard.press("Delete");
		await expect(allCards(page)).toHaveCount(4);
		await expectPhaseACollapsed(page);
	});

	test("P4-2: C collapses the focused parent and C again expands it", async ({
		page,
	}) => {
		await seedRichTree(page);
		await card(page, PHASE_A).click();
		await expect(card(page, PHASE_A)).toHaveAttribute(
			NODE_FOCUSED_ATTR,
			"true",
		);

		await page.keyboard.press("c");
		await expectPhaseACollapsed(page);

		await page.keyboard.press("c");
		await expect(chevronOf(page, PHASE_A)).toHaveAttribute(
			"aria-label",
			CHEVRON_COLLAPSE_LABEL,
		);
		await expect(card(page, TASK_A1)).toHaveCount(1);
	});

	test("P4-3: search reveals and focuses a match inside a collapsed subtree", async ({
		page,
	}) => {
		await seedRichTree(page);
		await collapsePhaseA(page);
		await card(page, PHASE_B).click();

		await page.keyboard.press("Control+f");
		await page
			.getByRole("textbox", { name: "Search nodes" })
			.pressSequentially("Task A1");

		await expect(card(page, TASK_A1)).toHaveCount(1);
		await expect(card(page, TASK_A1)).toHaveAttribute(
			NODE_FOCUSED_ATTR,
			"true",
		);
		await expect(chevronOf(page, PHASE_A)).toHaveAttribute(
			"aria-label",
			CHEVRON_COLLAPSE_LABEL,
		);
	});

	test("P4-4: collapsing the focused card's ancestor from the menu moves focus to it (RC6)", async ({
		page,
	}) => {
		await seedRichTree(page);
		await card(page, TASK_A1).click();
		await expect(card(page, TASK_A1)).toHaveAttribute(
			NODE_FOCUSED_ATTR,
			"true",
		);

		await card(page, PHASE_A).click({ button: "right" });
		await page
			.getByRole("menu", { name: "Node actions" })
			.getByRole("menuitem", { name: CHEVRON_COLLAPSE_LABEL })
			.click();

		await expectPhaseACollapsed(page);
		await expect(card(page, PHASE_A)).toHaveAttribute(
			NODE_FOCUSED_ATTR,
			"true",
		);
	});

	test("P4-5: the canvas menu collapses all, expands all and collapses to depth 1", async ({
		page,
	}) => {
		await seedRichTree(page);

		// Collapse all = every node WITH children, Root included.
		await canvasMenuItem(page, COLLAPSE_ALL_LABEL);
		await expect(allCards(page)).toHaveCount(1);
		await expect(card(page, ROOT)).toHaveCount(1);

		await canvasMenuItem(page, EXPAND_ALL_LABEL);
		await expect(allCards(page)).toHaveCount(6);

		await canvasMenuItem(page, collapseToDepthLabel(1));
		await expect(allCards(page)).toHaveCount(3);
		await expect(chevronOf(page, ROOT)).toHaveAttribute(
			"aria-label",
			CHEVRON_COLLAPSE_LABEL,
		);
		await expectPhaseACollapsed(page);
		await expect(chevronOf(page, PHASE_B)).toHaveAttribute(
			"aria-label",
			CHEVRON_EXPAND_LABEL,
		);
	});
});

// v0.8.4 Phase 5 — orientation-aware reorder (RC2, pinned by P0-2/P0-3
// above — Control+ArrowRight on Task A1 reordering [Task A2, Task A1] IS
// P0-2 going green, so it is not duplicated here), indent/outdent and the
// 1-4 status hotkeys.
test.describe("Canvas comfort — Phase 5 structure keys", () => {
	const card = (page: Page, id: string) =>
		page.locator(`[${NODE_CARD_ATTR}="${id}"]`);
	const chevronOf = (page: Page, id: string) =>
		card(page, id).locator(CHEVRON_SELECTOR);

	test("P5-2: Alt+ArrowDown indents Task A2 under Task A1", async ({
		page,
	}) => {
		await seedRichTree(page);
		const taskA2 = card(page, TASK_A2);
		await taskA2.click();
		await expect(taskA2).toHaveAttribute(NODE_FOCUSED_ATTR, "true");

		await page.keyboard.press("Alt+ArrowDown");

		await expect(chevronOf(page, TASK_A1)).toHaveAttribute(
			"aria-label",
			CHEVRON_COLLAPSE_LABEL,
		);
		await expect(chevronOf(page, TASK_A1)).toContainText("1");
		await expect(taskA2).toHaveCount(1);
		await expect(taskA2).toHaveAttribute(NODE_FOCUSED_ATTR, "true");
	});

	test("P5-3: Alt+ArrowUp then outdents Task A2 back under Phase A, right after Task A1", async ({
		page,
	}) => {
		await seedRichTree(page);
		await card(page, TASK_A2).click();
		await page.keyboard.press("Alt+ArrowDown");
		await expect(chevronOf(page, TASK_A1)).toContainText("1");

		await page.keyboard.press("Alt+ArrowUp");

		await expect(card(page, TASK_A1).locator(CHEVRON_SELECTOR)).toHaveCount(0);
		const order = await cardOrder(page);
		expect(order.indexOf(TASK_A2)).toBe(order.indexOf(TASK_A1) + 1);
		await expect(card(page, TASK_A2)).toHaveAttribute(
			NODE_FOCUSED_ATTR,
			"true",
		);
	});

	test("P5-4: 1-4 set status on the focused node", async ({ page }) => {
		await seedRichTree(page);
		const taskB1 = card(page, TASK_B1);
		await taskB1.click();
		await expect(taskB1).toHaveAttribute(NODE_FOCUSED_ATTR, "true");

		await page.keyboard.press("3");
		await expect(taskB1).toContainText("Completed");

		await page.keyboard.press("1");
		await expect(taskB1).toContainText("Not Started");
	});

	// Same indent code path as P5-2 (indentFocused → fileViewStore.setCollapsed
	// before moveNode); exercised here against Phase A/Phase B, whose parent
	// (Root) already has a real collapsible previous sibling in the fixture,
	// rather than re-deriving one from Task A1's just-created subtree.
	test("P5-5: indenting into a collapsed previous sibling expands it and keeps the moved card mounted", async ({
		page,
	}) => {
		await seedRichTree(page);
		await chevronOf(page, PHASE_A).click();
		await expect(chevronOf(page, PHASE_A)).toHaveAttribute(
			"aria-label",
			CHEVRON_EXPAND_LABEL,
		);

		const phaseB = card(page, PHASE_B);
		await phaseB.click();
		await page.keyboard.press("Alt+ArrowDown");

		await expect(chevronOf(page, PHASE_A)).toHaveAttribute(
			"aria-label",
			CHEVRON_COLLAPSE_LABEL,
		);
		await expect(phaseB).toHaveCount(1);
		await expect(phaseB).toHaveAttribute(NODE_FOCUSED_ATTR, "true");
	});
});

// v0.8.4 Phase 6 — Ctrl+Z / Ctrl+Y over the user's own edits, focus following
// the undone node. The agent-path case (an agent edit is not undoable) has no
// browser seam and is covered by the unit tests only.
test.describe("Canvas comfort — Phase 6 undo/redo", () => {
	const RENAME_INPUT = 'input[aria-label="Rename node"]';
	const card = (page: Page, id: string) =>
		page.locator(`[${NODE_CARD_ATTR}="${id}"]`);
	const cards = (page: Page) => page.locator(`[${NODE_CARD_ATTR}]`);

	test("P6-1: Enter creates a child of Task A1; Control+z removes it and focuses Task A1; Control+y brings it back", async ({
		page,
	}) => {
		await seedRichTree(page);
		const taskA1 = card(page, TASK_A1);
		await taskA1.click();
		await expect(taskA1).toHaveAttribute(NODE_FOCUSED_ATTR, "true");

		await page.keyboard.press("Enter");
		await expect(page.locator(RENAME_INPUT)).toBeVisible();
		// Committing the default title records no rename.
		await page.keyboard.press("Enter");
		await expect(page.locator(RENAME_INPUT)).toHaveCount(0);
		await expect(cards(page)).toHaveCount(7);

		await page.keyboard.press("Control+z");
		await expect(cards(page)).toHaveCount(6);
		await expect(taskA1).toHaveAttribute(NODE_FOCUSED_ATTR, "true");

		await page.keyboard.press("Control+y");
		await expect(cards(page)).toHaveCount(7);
	});

	test("P6-2: status key 3 on Task B1, then Control+z restores Not Started", async ({
		page,
	}) => {
		await seedRichTree(page);
		const taskB1 = card(page, TASK_B1);
		await taskB1.click();
		await expect(taskB1).toHaveAttribute(NODE_FOCUSED_ATTR, "true");

		await page.keyboard.press("3");
		await expect(taskB1).toContainText("Completed");

		await page.keyboard.press("Control+z");
		await expect(taskB1).toContainText("Not Started");
		await expect(taskB1).toHaveAttribute(NODE_FOCUSED_ATTR, "true");
	});

	test("P6-3: a rename committed with F2 + Enter is undone by Control+z", async ({
		page,
	}) => {
		await seedRichTree(page);
		const taskB1 = card(page, TASK_B1);
		await taskB1.click();
		await page.keyboard.press("F2");
		const input = page.locator(RENAME_INPUT);
		await input.fill("Renamed B1");
		await page.keyboard.press("Enter");
		await expect(input).toHaveCount(0);
		await expect(taskB1).toContainText("Renamed B1");

		await page.keyboard.press("Control+z");
		await expect(taskB1).toContainText("Task B1");
		await expect(taskB1).not.toContainText("Renamed B1");
	});

	test("P6-4: a deleted leaf comes back at the same position with Control+z", async ({
		page,
	}) => {
		await seedRichTree(page);
		const before = await cardOrder(page);
		await card(page, TASK_A2).click();
		await page.keyboard.press("Delete");
		await expect(card(page, TASK_A2)).toHaveCount(0);

		await page.keyboard.press("Control+z");
		await expect(card(page, TASK_A2)).toHaveCount(1);
		expect(await cardOrder(page)).toEqual(before);
		await expect(card(page, TASK_A2)).toHaveAttribute(
			NODE_FOCUSED_ATTR,
			"true",
		);
	});
});
