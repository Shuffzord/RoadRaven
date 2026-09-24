import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, type Page, test } from "@playwright/test";
import {
	CHEVRON_COLLAPSE_LABEL,
	CHEVRON_EXPAND_LABEL,
	NODE_CARD_ATTR,
	NODE_FOCUSED_ATTR,
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
