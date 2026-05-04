import { existsSync } from "node:fs";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";

// Pre-condition: `bun run --cwd packages/desktop build` has produced
// packages/desktop/dist/. Vite preview serves dist/ on port 4173.
//
// Pass criterion (D-20): zero severity-blocker findings (`critical` or `serious`
// axe impacts). `moderate` and `minor` findings are tracked in 05-A11Y-AUDIT.md
// but do not fail the gate.
//
// Selectors verified against source 2026-05-03 per checker B-4/W-1/W-2:
//   - Canvas wrapper: [role="application"] (Canvas.tsx line 344)
//   - Node card: [data-source-id] (RoadmapNode.tsx line 113); [role="treeitem"] (line 126)
//   - Sample loading: getByRole('button', { name: 'Hello World' }) (WelcomeScreen.tsx line 131-137)
//   - Theme switching: document.documentElement.setAttribute("data-theme", t) directly
//     (ThemeProvider.tsx line 33 — there is NO localStorage theme key; RPC saveSettings
//     is Electrobun-only and unavailable under vite preview)

const DIST_DIR = join(process.cwd(), "dist");
const hasDist = existsSync(DIST_DIR);

test.skip(
	!hasDist,
	"packages/desktop/dist/ missing — run `bun run --cwd packages/desktop build` first",
);

/**
 * Helper: run AxeBuilder and assert zero severity-blocker violations.
 * Logs moderate/minor for audit-doc tracking.
 */
async function auditPage(
	page: Page,
	label: string,
	opts?: { exclude?: string[] },
): Promise<void> {
	const builder = new AxeBuilder({ page }).withTags([
		"wcag2a",
		"wcag2aa",
		"wcag21a",
		"wcag21aa",
	]);
	for (const sel of opts?.exclude ?? []) {
		builder.exclude(sel);
	}
	const results = await builder.analyze();

	const blockers = results.violations.filter(
		(v) => v.impact === "critical" || v.impact === "serious",
	);
	const tracked = results.violations.filter(
		(v) => v.impact === "moderate" || v.impact === "minor",
	);
	if (tracked.length > 0) {
		console.warn(
			`[${label}] ${tracked.length} moderate/minor findings (tracked, non-blocking):`,
			tracked.map((v) => `${v.id} (${v.impact})`).join(", "),
		);
	}
	expect(
		blockers,
		`[${label}] severity-blocker accessibility violations:\n${JSON.stringify(blockers, null, 2)}`,
	).toEqual([]);
}

/**
 * Helper: click the "Hello World" sample button on the welcome screen and wait
 * for the canvas to render (per WelcomeScreen.tsx + Canvas.tsx). Sample loading
 * is via button click, NOT URL query param (verified 2026-05-03).
 */
async function loadHelloWorldSample(page: Page): Promise<void> {
	await page.goto("/");
	await page.waitForLoadState("networkidle");
	await page.getByRole("button", { name: "Hello World" }).click();
	// Wait for tree canvas to render — role="application" on Canvas wrapper
	await page.waitForSelector('[role="application"]', { timeout: 5000 });
	// Wait for at least one node card to render
	await page.waitForSelector("[data-source-id]", { timeout: 5000 });
}

test.describe("Accessibility audit (production bundle, vite preview port 4173)", () => {
	test("1. Welcome screen passes WCAG 2.1 AA", async ({ page }) => {
		await page.goto("/");
		await page.waitForLoadState("networkidle");
		await auditPage(page, "welcome-screen");
	});

	test("2. Loaded sample roadmap passes WCAG 2.1 AA", async ({ page }) => {
		await loadHelloWorldSample(page);
		// Exclude react-d3-tree's SVG link paths (they have no semantic content
		// and axe occasionally flags missing labels on the <path> elements)
		await auditPage(page, "loaded-roadmap", {
			exclude: ["svg .rd3t-link"],
		});
	});

	test("3. Side panel open on a node passes WCAG 2.1 AA", async ({ page }) => {
		await loadHelloWorldSample(page);
		// Click the first node card to open the side panel.
		// Verified selector: [data-source-id] (RoadmapNode.tsx line 113)
		await page.locator("[data-source-id]").first().click();
		// Wait for side panel <aside role="complementary"> to render
		// (SidePanel.tsx line 233/243). Use a generous timeout for animation.
		await page.waitForSelector('aside[role="complementary"]', {
			timeout: 3000,
		});
		await auditPage(page, "side-panel-open", {
			exclude: ["svg .rd3t-link"],
		});
	});

	test("4. Context menu open on a node passes WCAG 2.1 AA (Radix ARIA)", async ({
		page,
	}) => {
		await loadHelloWorldSample(page);
		// Right-click on a node to open Radix ContextMenu.
		// Verified selector: [data-source-id] (RoadmapNode.tsx line 113)
		await page.locator("[data-source-id]").first().click({ button: "right" });
		// Wait for Radix-rendered menu — Radix ContextMenu renders [role="menu"]
		await page.waitForSelector('[role="menu"]', { timeout: 3000 });
		await auditPage(page, "context-menu-open", {
			exclude: ["svg .rd3t-link"],
		});
	});

	test("5. Confirmation dialog (delete non-leaf) passes WCAG 2.1 AA", async ({
		page,
	}) => {
		await loadHelloWorldSample(page);
		// Select the first node card (root). The Hello World sample's root is a
		// non-leaf (has children), so requestDelete triggers the confirmation
		// dialog (per useKeyboardRouter.ts requestDelete contract).
		await page.locator("[data-source-id]").first().click();
		// Focus the canvas (role="application" tabIndex=0 on Canvas wrapper) so
		// keyboard events route through useKeyboardRouter.
		await page.locator('[role="application"]').focus();
		await page.keyboard.press("Delete");
		// Wait for Radix Dialog (renders role="dialog")
		await page.waitForSelector('[role="dialog"], [role="alertdialog"]', {
			timeout: 3000,
		});
		await auditPage(page, "confirmation-dialog-open", {
			exclude: ["svg .rd3t-link"],
		});
	});

	// Themes — applied by setting the data-theme attribute on documentElement.
	// This matches what ThemeProvider.tsx does on every preference change.
	// We bypass the Zustand store (which would invoke RPC saveSettings — not
	// available under vite preview) and exercise the CSS directly. The CSS is
	// the same that ships in the installer.
	for (const theme of ["dark", "light", "high-contrast"] as const) {
		test(`6. Theme '${theme}' passes WCAG 2.1 AA`, async ({ page }) => {
			await loadHelloWorldSample(page);
			// Set the data-theme attribute directly (matches ThemeProvider.tsx
			// line 33 behavior). No reload needed — CSS responds to the
			// attribute change immediately because all theme tokens are scoped
			// under [data-theme="..."] selectors in the design system.
			await page.evaluate((t) => {
				document.documentElement.setAttribute("data-theme", t);
			}, theme);
			// Sanity check the theme actually applied.
			const actualTheme = await page.evaluate(() =>
				document.documentElement.getAttribute("data-theme"),
			);
			expect(
				actualTheme,
				`Theme should be '${theme}' but is '${actualTheme}'`,
			).toBe(theme);
			// Brief wait for any CSS transitions to settle before axe scan.
			await page.waitForTimeout(200);
			await auditPage(page, `theme-${theme}`, {
				exclude: ["svg .rd3t-link"],
			});
		});
	}
});
