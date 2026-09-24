import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, type Page, test } from "@playwright/test";
import {
	CHEVRON_COLLAPSE_LABEL,
	CHEVRON_EXPAND_LABEL,
	KNOB_RESET_LABEL,
	KNOB_SIBLING_GAP_LABEL,
	LAYOUT_KNOBS_TRIGGER_LABEL,
	NODE_CARD_ATTR,
	NODE_FOCUSED_ATTR,
	NODE_PROGRESS_ATTR,
	NODE_RIBBON_ATTR,
	NODE_STATUS_ATTR,
	NODE_TYPE_CHIP_ATTR,
} from "../../src/mainview/lib/domContract";
import { CHEVRON_SELECTOR } from "../../src/mainview/lib/nodeCollapse";
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
		// Phase A's unrelated collapse is wiped. Fixed in Phase 4.
		test.fail();

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

		// RC2: Ctrl+ArrowUp/Down (useKeyboardRouter.ts:300-310) is the only
		// reorder pair, fixed to the vertical axis; sibling navigation instead
		// follows layout orientation (lines 371-378), so in TB (the default)
		// Ctrl+Right falls into the sibling-navigation branch, not reorder.
		// Fixed in Phase 5.
		test.fail();

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
