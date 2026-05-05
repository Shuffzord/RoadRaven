import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, type Page, test } from "@playwright/test";

// Phase 5 a11y manual-walkthrough findings — BUG-1 and BUG-2 from
// .planning/debug/05-05-a11y-keyboard-routing.md.
//
// BUG-1: chevron <button> on RoadmapNodeCard had no explicit tabIndex,
// putting it in the document tab cycle. Shift+Tab from a child treeitem
// landed on the parent's chevron instead of the parent treeitem, violating
// WAI-ARIA tree pattern.
// BUG-2: useKeyboardRouter's Tab branch fired on Shift+Tab as well (no
// !e.shiftKey guard), spuriously creating a sibling on backward-focus.
//
// These tests exercise the dev-server renderer (port 5173) via the
// __ROADRAVEN_TEST__.loadSchema seam (App.tsx — DEV-only). They do NOT
// exercise the CEF binary; production-bundle behavior is covered by the
// a11y axe suite (which catches the chevron-in-tab-cycle issue indirectly
// via aria-required-parent / treeitem semantics).

const SMALL_FIXTURE = join(__dirname, "../fixtures/basic-schema.json");

async function seedBasicSchema(page: Page): Promise<void> {
	const schema = JSON.parse(readFileSync(SMALL_FIXTURE, "utf-8"));
	await page.goto("/");
	await page.waitForFunction(() =>
		Boolean(
			(window as { __ROADRAVEN_TEST__?: { loadSchema?: unknown } })
				.__ROADRAVEN_TEST__?.loadSchema,
		),
	);
	await page.evaluate(
		(s) =>
			(
				window as {
					__ROADRAVEN_TEST__: { loadSchema: (schema: unknown) => void };
				}
			).__ROADRAVEN_TEST__.loadSchema(s),
		schema,
	);
	await page.waitForSelector("[data-source-id]");
	// Wait for all three cards (root + 2 children) to render.
	await expect(page.locator("[data-source-id]")).toHaveCount(3);
}

async function focusCardById(page: Page, id: string): Promise<void> {
	const card = page.locator(`[data-source-id="${id}"]`);
	await card.focus();
	// Sanity: confirm the card actually received focus (not its chevron).
	const focusedSourceId = await page.evaluate(
		() =>
			(document.activeElement as HTMLElement | null)?.getAttribute(
				"data-source-id",
			) ?? null,
	);
	expect(focusedSourceId).toBe(id);
}

test.describe("Keyboard routing — Phase 5 a11y manual findings", () => {
	const ROOT_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
	const CHILD_A_ID = "11111111-2222-4333-8444-555555555555";

	test("BUG-1: chevron is not in document tab order (tabIndex=-1)", async ({
		page,
	}) => {
		await seedBasicSchema(page);
		// Hello World root has 2 children → renders the chevron <button>.
		// Use a DOM query to assert the chevron's tabindex attribute directly,
		// rather than relying on programmatic Tab navigation (which is fragile
		// across react-d3-tree's foreignObject + zoom-pan layout).
		const chevronTabIndex = await page.evaluate((rootId) => {
			const card = document.querySelector(
				`[data-source-id="${rootId}"]`,
			) as HTMLElement | null;
			if (!card) return "no-card";
			const chevron = card.querySelector(
				'button[aria-label="Collapse subtree"], button[aria-label="Expand subtree"]',
			) as HTMLElement | null;
			if (!chevron) return "no-chevron";
			return chevron.getAttribute("tabindex");
		}, ROOT_ID);
		// Pre-fix value: null (no tabindex attribute → in tab order).
		// Post-fix value: "-1" (explicitly removed from tab order).
		expect(chevronTabIndex).toBe("-1");
	});

	test("BUG-2: Shift+Tab on a focused node does NOT create a sibling", async ({
		page,
	}) => {
		await seedBasicSchema(page);
		// Initial node count = 3 (root + 2 children).
		const initialCount = await page.locator("[data-source-id]").count();
		expect(initialCount).toBe(3);

		// Focus a child card so focusedNodeId is set in the store.
		await focusCardById(page, CHILD_A_ID);
		// Click sets focusedNodeId via RoadmapNodeCard.onClick → setFocusedNode.
		// Use a click instead of relying on focus() alone, since focusedNodeId
		// in the store is set by the click handler (not just DOM focus).
		await page.locator(`[data-source-id="${CHILD_A_ID}"]`).click();

		// Press Shift+Tab. Pre-fix behavior: addSiblingBelow fires (count=4).
		// Post-fix behavior: native focus-backward, no mutation.
		await page.keyboard.press("Shift+Tab");
		// Allow React to flush any (incorrect) state update + re-render.
		await page.waitForTimeout(150);

		const afterCount = await page.locator("[data-source-id]").count();
		expect(
			afterCount,
			"Shift+Tab must NOT add a sibling. Pre-fix bug: useKeyboardRouter's Tab branch had no !e.shiftKey guard.",
		).toBe(initialCount);
	});

	test("Plain Tab on a focused node still creates a sibling (regression guard)", async ({
		page,
	}) => {
		await seedBasicSchema(page);
		const initialCount = await page.locator("[data-source-id]").count();
		expect(initialCount).toBe(3);

		// Focus + select child A (click sets both focusedNodeId and selectedNodeId).
		await page.locator(`[data-source-id="${CHILD_A_ID}"]`).click();

		// Plain Tab (no shift) → addSiblingBelow (count=4).
		await page.keyboard.press("Tab");
		// addSiblingBelow opens the inline rename input automatically. The new
		// card mounts inside react-d3-tree with the new sibling node's id; we
		// only need to verify count, not navigate to the new card.
		await page.waitForTimeout(250);

		const afterCount = await page.locator("[data-source-id]").count();
		expect(
			afterCount,
			"Plain Tab (no shift) must still create a sibling.",
		).toBe(initialCount + 1);
	});
});
