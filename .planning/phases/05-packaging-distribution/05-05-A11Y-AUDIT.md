---
phase: 05-packaging-distribution
plan: 05
type: execute
wave: 3
depends_on: ["05-01", "05-02"]
files_modified:
  - .planning/phases/05-packaging-distribution/05-A11Y-AUDIT.md
  - packages/desktop/tests/a11y/audit.spec.ts
  - packages/desktop/package.json
autonomous: false
requirements: [PACK-06, PACK-03]
threats: []
tags: [packaging, accessibility, a11y, audit, wcag]

must_haves:
  truths:
    - "@axe-core/playwright audit suite runs against `vite preview` (port 4173, production-built renderer bundle per R-04)"
    - "Audit covers welcome screen + loaded-roadmap-via-Hello-World-button + side-panel-open + context-menu-open + confirmation-dialog-open + all three themes"
    - "Pass criterion (D-20): zero axe violations with impact `critical` or `serious`"
    - "Manual checklist completed: keyboard-only navigation through tree edits, context menu, side panel, settings drawer, save flow, theme switcher (axe doesn't verify tab order)"
    - "Manual checklist verifies PACK-03 invariant: no `ApplicationMenu` import (file actions reachable via keyboard / toolbar)"
    - "Findings documented in 05-A11Y-AUDIT.md with severity classification and disposition (fix-in-phase / backlog / accepted)"
    - "Human checkpoint: user runs the manual checklist on the actual installed app post-Wave-2 build to catch CEF-only divergence (R-04 documented caveat)"
    - "Selectors in audit.spec.ts are pre-verified against actual source files (per checker B-4/W-1/W-2): `[role=\"application\"]` on canvas wrapper, `[data-source-id]` + `[role=\"treeitem\"]` on node cards, button click for sample loading (NOT URL query param), `document.documentElement.setAttribute('data-theme', ...)` for theme switching (NOT localStorage)"
  artifacts:
    - path: "packages/desktop/tests/a11y/audit.spec.ts"
      provides: "Expanded axe suite covering all interaction surfaces (extends Wave 0 scaffold)"
      contains: "AxeBuilder"
    - path: ".planning/phases/05-packaging-distribution/05-A11Y-AUDIT.md"
      provides: "Audit write-up with automated baseline output + manual checklist results + findings classification"
      contains: "Pass criterion"
  key_links:
    - from: "packages/desktop/tests/a11y/audit.spec.ts"
      to: "packages/desktop/dist/ (Vite production bundle)"
      via: "vite preview --port 4173 --strictPort"
      pattern: "vite preview"
    - from: "05-A11Y-AUDIT.md"
      to: "audit.spec.ts output (test logs)"
      via: "manual transcription of severity-blocker findings + tracked moderate/minor"
      pattern: "results.violations"
    - from: "Manual checklist (05-A11Y-AUDIT.md)"
      to: "the installed app (.zip / .tar.gz from Wave 2 release artifacts)"
      via: "user keyboard walk-through"
      pattern: "Manual Checklist"
---

<objective>
Land the v1.0 accessibility audit pass (PACK-06) per R-04: automated baseline
via `@axe-core/playwright` against `vite preview` + manual checklist against
the real installed app. Pass criterion (D-20): zero axe violations of impact
`critical` or `serious`. Fix any blockers found IN THIS PLAN; file lower-severity
findings as backlog with explicit severity classification.

This plan depends on Plan 05-02 because the audit needs `packages/desktop/dist/`
(produced by `bun run --cwd packages/desktop build`). It does NOT depend on
Plan 05-03 (release workflow) or Plan 05-04 (docs site) — it can run in parallel
with both at Wave 3.

Per R-04, the automated suite audits `vite preview` (the production renderer
bundle that ships in the installer's webview), NOT the CEF-bundled binary
(no paved-path Playwright integration exists for that). The manual-checklist
checkpoint at the end is where the user spot-checks the installed app for any
CEF-only divergence in `--rv-*` token rendering, Radix ARIA, and focus rings.

**Per checker B-4 + W-1 + W-2 reconciliation:** All selectors and interaction
mechanisms in this plan are pre-verified against actual source files
(2026-05-03). Specifically:

- Component file: `packages/desktop/src/mainview/components/RoadmapNode.tsx`
  (which exports a function named `RoadmapNodeCard`). The previously planned
  reference to a separate `RoadmapNodeCard.tsx` file was incorrect.
- Sample loading: The Hello World sample is loaded by clicking a button rendered
  by `WelcomeScreen.tsx` (line 131-137: `onClick={() => onOpenSample("hello-world")}`),
  NOT via a URL query parameter. The previously planned `?sample=hello-world`
  pattern does not exist in the source.
- Node card DOM contract: `data-source-id={nodeId}` and `role="treeitem"` (NOT
  `data-node-id` and `role="button"`). Verified at `RoadmapNode.tsx` lines
  113, 126.
- Canvas wrapper: `role="application"` exists at `Canvas.tsx` line 344 — this
  selector is real and usable.
- Theme switching: Theme is stored in Zustand (`useThemeStore` in
  `themeStore.ts`) and persisted via `electroview.rpc.request.saveSettings`
  RPC (which is unavailable in `vite preview` — RPC is Electrobun-only). The
  CSS source of truth is `document.documentElement.setAttribute("data-theme",
  resolvedTheme)` (set by `ThemeProvider.tsx` line 33). The audit therefore
  switches themes by directly setting the `data-theme` attribute on
  `documentElement` — bypassing the store entirely. This exercises the same
  CSS that ships in the installer. There is NO localStorage theme key.

The audit can now be written without branching "if X then Y else Z" logic —
every selector and mechanism is concrete.

Output:
- Expanded `packages/desktop/tests/a11y/audit.spec.ts` (covers 8+ audit invocations)
- New `.planning/phases/05-packaging-distribution/05-A11Y-AUDIT.md` (write-up)
- Modified `packages/desktop/package.json` (a11y suite added to existing test scripts as opt-in)
- Human checkpoint: user runs manual checklist on installed app, signs off in 05-A11Y-AUDIT.md
</objective>

<execution_context>
@C:\Work\RoadRaven\.claude\get-shit-done\workflows\execute-plan.md
@C:\Work\RoadRaven\.claude\get-shit-done\templates\summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/REQUIREMENTS.md
@.planning/phases/05-packaging-distribution/05-CONTEXT.md
@.planning/phases/05-packaging-distribution/05-RESEARCH.md
@.planning/phases/05-packaging-distribution/05-VALIDATION.md
@packages/desktop/tests/a11y/audit.spec.ts
@packages/desktop/tests/a11y/playwright.config.ts
@packages/desktop/src/mainview/components/WelcomeScreen.tsx
@packages/desktop/src/mainview/components/RoadmapNode.tsx
@packages/desktop/src/mainview/components/Canvas.tsx
@packages/desktop/src/mainview/components/ThemeProvider.tsx
@packages/desktop/src/mainview/store/themeStore.ts

<interfaces>
<!-- Wave-0 scaffold (Plan 05-01) for audit.spec.ts: -->
<!--   - Single test: "Welcome screen passes WCAG 2.1 AA (no critical/serious violations)" -->
<!--   - test.skip(!hasDist, ...) gate -->
<!--   - AxeBuilder().withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze() -->
<!--   - blockers = violations.filter(v => v.impact === "critical" || v.impact === "serious") -->
<!--   - tracked = moderate/minor (warned, not failed) -->

<!-- This plan EXPANDS audit.spec.ts to cover: -->
<!--   1. Welcome screen (existing) -->
<!--   2. Loaded sample roadmap (Hello World button click) -->
<!--   3. Side panel opened on a node -->
<!--   4. Context menu opened on a node -->
<!--   5. Confirmation dialog (delete non-leaf) -->
<!--   6. Each of the three themes (dark, light, high-contrast) -->

<!-- VERIFIED SOURCE FACTS (2026-05-03): -->
<!--   - WelcomeScreen.tsx renders <button onClick={() => onOpenSample("hello-world")}>Hello World</button> -->
<!--     at lines 131-137. The test loads the sample by clicking this button via -->
<!--     `page.getByRole('button', { name: 'Hello World' }).click()`. -->
<!--   - Canvas.tsx wraps the tree in <div role="application" tabIndex={0}> at line 344. -->
<!--     Use `[role="application"]` to wait for tree render. -->
<!--   - RoadmapNode.tsx renders nodes with `data-source-id={nodeId}` (line 113) and -->
<!--     `role="treeitem"` (line 126), NOT `data-node-id` / `role="button"`. -->
<!--     Use `[data-source-id][role="treeitem"]` (or just `[data-source-id]`) to target nodes. -->
<!--   - ThemeProvider.tsx (line 33) sets `document.documentElement.setAttribute("data-theme", resolvedTheme)`. -->
<!--     There is NO localStorage key for theme; theme is persisted via RPC `saveSettings` -->
<!--     (only available under Electrobun, NOT under vite preview). -->
<!--     The audit switches themes via `page.evaluate((t) => document.documentElement.setAttribute("data-theme", t), theme)` -->
<!--     and verifies via `document.documentElement.getAttribute("data-theme")`. -->
<!--     This exercises the CSS that ships in the installer without depending on RPC. -->
<!--   - ThemePreference enum (shared/types.ts) includes "dark", "light", "high-contrast", "system". -->
<!--     The audit tests "dark", "light", "high-contrast" (the three resolved themes). -->
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Expand audit.spec.ts to cover 6+ interaction surfaces and all three themes (with pre-verified selectors)</name>

  <behavior>
    - audit.spec.ts has at minimum these test cases:
      1. Welcome screen / WCAG 2.1 AA (existing — kept)
      2. Loaded sample roadmap (Hello World button click) / WCAG 2.1 AA
      3. Side panel open on a node / WCAG 2.1 AA
      4. Context menu open on a node / WCAG 2.1 AA (Radix-rendered)
      5. Confirmation dialog (delete non-leaf) / WCAG 2.1 AA
      6. Theme: dark / WCAG 2.1 AA (default)
      7. Theme: light / WCAG 2.1 AA
      8. Theme: high-contrast / WCAG 2.1 AA
    - Each test independently asserts `blockers).toEqual([])` for `critical` + `serious` impact
    - All tests log moderate/minor findings via console.warn (do not fail)
    - Tests SKIP if `packages/desktop/dist/` is missing (existing scaffold guard preserved)
    - Test file uses ONLY pre-verified selectors (per checker B-4/W-1/W-2) — no branching, no "if X else Y" logic
  </behavior>

  <read_first>
    - packages/desktop/tests/a11y/audit.spec.ts (Wave 0 scaffold — extend it, don't replace it)
    - packages/desktop/tests/a11y/playwright.config.ts (Wave 0 — vite preview port 4173)
    - packages/desktop/src/mainview/components/WelcomeScreen.tsx (verified: Hello World button at lines 131-137)
    - packages/desktop/src/mainview/components/Canvas.tsx (verified: role="application" at line 344)
    - packages/desktop/src/mainview/components/RoadmapNode.tsx (verified: data-source-id + role="treeitem" at lines 113, 126)
    - packages/desktop/src/mainview/components/ThemeProvider.tsx (verified: documentElement.setAttribute("data-theme", ...) at line 33)
    - packages/desktop/src/mainview/store/themeStore.ts (verified: persistence via RPC saveSettings, NOT localStorage)
    - packages/desktop/src/mainview/components/SidePanel.tsx (for selectors when testing side-panel-open state)
    - packages/desktop/src/mainview/components/ConfirmationDialog.tsx (delete-non-leaf flow — to know how to trigger it from a test)
    - .planning/phases/05-packaging-distribution/05-RESEARCH.md `## Architecture Patterns > Pattern 6` (lines 664-727) — pattern for the audit tests
  </read_first>

  <files>
    packages/desktop/tests/a11y/audit.spec.ts
    packages/desktop/package.json
  </files>

  <action>
    **A. Expand `packages/desktop/tests/a11y/audit.spec.ts`** to cover all listed surfaces. Selectors and mechanisms are pre-pinned (per checker B-4/W-1/W-2 — no branching). The PRESERVED guard at the top (`test.skip(!hasDist, ...)`) stays.

    Concrete test file (selectors pinned to verified source facts):

    ```typescript
    import { test, expect, type Page } from "@playwright/test";
    import AxeBuilder from "@axe-core/playwright";
    import { existsSync } from "node:fs";
    import { join } from "node:path";

    // Pre-condition: `bun run --cwd packages/desktop build` has produced
    // packages/desktop/dist/. Vite preview serves dist/ on port 4173.
    //
    // Pass criterion (D-20): zero axe violations of impact `critical` or `serious`.
    // `moderate` and `minor` findings are logged for the audit doc but do NOT fail.
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

    test.skip(!hasDist, "packages/desktop/dist/ missing — run `bun run --cwd packages/desktop build` first");

    /**
     * Helper: run AxeBuilder and assert zero severity-blocker violations.
     * Logs moderate/minor for audit-doc tracking.
     */
    async function auditPage(page: Page, label: string, opts?: { exclude?: string[] }): Promise<void> {
    	const builder = new AxeBuilder({ page })
    		.withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]);
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
    	await page.waitForSelector('[data-source-id]', { timeout: 5000 });
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
    		await page.locator('[data-source-id]').first().click();
    		// Wait for side panel to render. The side panel is rendered when a node
    		// is selected; it appears as an aside element. Use a generous timeout
    		// since the side panel may animate in.
    		await page.waitForTimeout(500);
    		await auditPage(page, "side-panel-open", { exclude: ["svg .rd3t-link"] });
    	});

    	test("4. Context menu open on a node passes WCAG 2.1 AA (Radix ARIA)", async ({ page }) => {
    		await loadHelloWorldSample(page);
    		// Right-click on a node to open Radix ContextMenu.
    		// Verified selector: [data-source-id] (RoadmapNode.tsx line 113)
    		await page.locator('[data-source-id]').first().click({ button: "right" });
    		// Wait for Radix-rendered menu — Radix ContextMenu renders [role="menu"]
    		await page.waitForSelector('[role="menu"]', { timeout: 3000 });
    		await auditPage(page, "context-menu-open", { exclude: ["svg .rd3t-link"] });
    	});

    	test("5. Confirmation dialog (delete non-leaf) passes WCAG 2.1 AA", async ({ page }) => {
    		await loadHelloWorldSample(page);
    		// Select the first node card. The Hello World sample's root is a
    		// non-leaf (has children), so pressing Delete triggers the confirmation
    		// dialog (per the keyboard router contract).
    		await page.locator('[data-source-id]').first().click();
    		// Focus the canvas (role="application" on Canvas wrapper) so keyboard
    		// events route correctly. The wrapper has tabIndex={0}.
    		await page.locator('[role="application"]').focus();
    		await page.keyboard.press("Delete");
    		// Wait for Radix Dialog (role="dialog" or role="alertdialog")
    		await page.waitForSelector('[role="dialog"], [role="alertdialog"]', { timeout: 3000 });
    		await auditPage(page, "confirmation-dialog-open", { exclude: ["svg .rd3t-link"] });
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
    			expect(actualTheme, `Theme should be '${theme}' but is '${actualTheme}'`).toBe(theme);
    			// Brief wait for any CSS transitions to settle before axe scan.
    			await page.waitForTimeout(200);
    			await auditPage(page, `theme-${theme}`, { exclude: ["svg .rd3t-link"] });
    		});
    	}
    });
    ```

    **Selector risk notes (per checker B-4/W-1/W-2):**

    - `[role="application"]`, `[data-source-id]`, `[role="treeitem"]` — pre-verified to exist in source as of 2026-05-03. If a future refactor removes any of these attributes, the executor MUST flag it as a Wave-1 blocker AND restore the attribute (these are public DOM contracts the audit relies on; treat them like API surface).
    - `getByRole('button', { name: 'Hello World' })` — depends on the WelcomeScreen rendering a button with text "Hello World" (verified at WelcomeScreen.tsx line 136). If the welcome screen sample list changes, update the test's button name OR add a `data-testid="sample-hello-world"` to the button and use `page.getByTestId(...)` instead.
    - `[role="menu"]` for Radix ContextMenu — Radix's standard role; if Radix ContextMenu is replaced with a different library, update accordingly.
    - `[role="dialog"], [role="alertdialog"]` — Radix Dialog standard roles; same caveat.
    - The Delete-key + non-leaf-root assumption: the Hello World sample MUST have a root node with children (the test relies on this to trigger the confirmation dialog). If the sample changes shape, add a different non-leaf navigation step before the Delete press OR mark the test `test.skip()` until the sample is restored.

    **B. Add a test runner script to `packages/desktop/package.json`** (already done in Wave 0 — verify it exists). The Wave-0 script was:

    ```json
    "test:a11y": "playwright test --config=tests/a11y/playwright.config.ts"
    ```

    No new script needed if Wave 0 already added it. If missing, add now.

    **C. Run the suite locally to confirm it works:**

    ```bash
    bun run --cwd packages/desktop build       # produce dist/
    bun run --cwd packages/desktop test:a11y   # run axe suite
    ```

    Document any selector adjustments needed (the pre-verification was done at planning time on 2026-05-03; if the codebase has evolved between planning and execution, transcribe adjustments into `05-A11Y-AUDIT.md` Task 2). These adjustments belong in the audit doc.

    **D. If any test FAILS with a `critical`/`serious` blocker:** fix the underlying app issue in this plan (or file as a Wave-3-blocker that must be fixed before the next wave). The pass criterion (D-20) is zero blockers — you cannot ship Phase 5 with red blockers. Lower-severity findings are tracked in `05-A11Y-AUDIT.md` but do not block.
  </action>

  <verify>
    <automated>test -f packages/desktop/tests/a11y/audit.spec.ts && echo OK</automated>
    <automated>grep -c 'test\.describe' packages/desktop/tests/a11y/audit.spec.ts  # MUST be >= 1</automated>
    <automated>grep -c 'auditPage(page,' packages/desktop/tests/a11y/audit.spec.ts  # MUST be >= 8 (welcome + loaded + side-panel + context-menu + dialog + 3 themes = 8 audits)</automated>
    <automated>grep -c '\.exclude(' packages/desktop/tests/a11y/audit.spec.ts  # MUST be >= 1 (rd3t-link exclusion)</automated>
    <automated>grep -cE 'high-contrast|highContrast' packages/desktop/tests/a11y/audit.spec.ts  # MUST be >= 1 (THEME-02 third theme)</automated>
    <automated>grep -c "data-source-id" packages/desktop/tests/a11y/audit.spec.ts  # MUST be >= 1 (verified node selector per B-4)</automated>
    <automated>grep -c 'getByRole.*Hello World' packages/desktop/tests/a11y/audit.spec.ts  # MUST be >= 1 (verified sample-load mechanism per W-1)</automated>
    <automated>grep -c 'documentElement.setAttribute..data-theme' packages/desktop/tests/a11y/audit.spec.ts  # MUST be >= 1 (verified theme mechanism per W-2)</automated>
    <automated>grep -c 'localStorage' packages/desktop/tests/a11y/audit.spec.ts  # MUST be 0 (W-2 — there is NO localStorage theme key)</automated>
    <automated>grep -c "?sample=" packages/desktop/tests/a11y/audit.spec.ts  # MUST be 0 (W-1 — sample loading is button click, not query param)</automated>
    <automated>grep -c "data-node-id" packages/desktop/tests/a11y/audit.spec.ts  # MUST be 0 (B-4 — node attribute is data-source-id)</automated>
    <automated>cat packages/desktop/package.json | grep -c '"test:a11y":'  # MUST be 1</automated>
    <automated>bun run --cwd packages/desktop build  # MUST exit 0 (produces dist/)</automated>
    <automated>bun run --cwd packages/desktop test:a11y  # MUST exit 0 — zero critical/serious blockers (D-20)</automated>
  </verify>

  <acceptance_criteria>
    - `packages/desktop/tests/a11y/audit.spec.ts` contains AT LEAST 8 audit invocations (`auditPage(page, ...)` calls), one each for: welcome screen, loaded roadmap, side panel open, context menu open, confirmation dialog open, theme dark, theme light, theme high-contrast
    - The `auditPage` helper enforces `expect(blockers).toEqual([])` where `blockers` filters `v.impact === "critical" || v.impact === "serious"`
    - The `auditPage` helper logs moderate/minor findings via `console.warn` (audit-doc material) without failing
    - Test file preserves the Wave-0 `test.skip(!hasDist, ...)` guard
    - Test file uses ONLY the pre-verified selectors documented in `<read_first>` and `<interfaces>`:
      - `[role="application"]` for canvas wrapper (verified at Canvas.tsx line 344)
      - `[data-source-id]` for node cards (verified at RoadmapNode.tsx line 113)
      - `getByRole('button', { name: 'Hello World' })` for sample loading (verified at WelcomeScreen.tsx line 131-137)
      - `document.documentElement.setAttribute("data-theme", t)` for theme switching (verified at ThemeProvider.tsx line 33)
    - Test file does NOT contain the literal string `?sample=` (W-1 — sample loading is via button click only)
    - Test file does NOT contain the literal string `data-node-id` (B-4 — actual attribute is `data-source-id`)
    - Test file does NOT contain the literal string `localStorage` (W-2 — there is NO localStorage theme key; theme persistence is via Electrobun RPC `saveSettings` which is unavailable under vite preview)
    - Test file does NOT use branching "if X then Y else Z" logic for selectors or mechanisms (per checker B-4/W-1/W-2 — selectors are pinned)
    - Selector-risk notes in the action specify what to do if a future refactor breaks a selector (add `data-testid` and use `page.getByTestId(...)` as the documented escape hatch — this is a Wave-1 blocker if any selector breaks, NOT a silent test skip)
    - `packages/desktop/package.json` has `test:a11y` script (added in Wave 0; preserved)
    - `bun run --cwd packages/desktop build` exits 0 (produces dist/ for the audit)
    - `bun run --cwd packages/desktop test:a11y` exits 0 — every test passes (zero blockers per D-20). If any blocker found, the test FAILS LOUD with the blocker JSON, and the executor fixes the underlying app code before considering the task done.
  </acceptance_criteria>

  <done>
    Automated audit passes against the production-built renderer bundle for every interaction surface and every theme. Zero critical/serious axe violations. Moderate/minor findings logged to console (Task 2 transcribes them into 05-A11Y-AUDIT.md).
  </done>
</task>

<task type="auto">
  <name>Task 2: Write 05-A11Y-AUDIT.md (audit write-up + manual checklist instructions)</name>

  <read_first>
    - .planning/phases/05-packaging-distribution/05-CONTEXT.md D-19, D-20 (audit scope + pass criterion)
    - .planning/phases/05-packaging-distribution/05-CONTEXT.md `<reconciliation>` R-04 (vite preview, NOT CEF binary; manual checklist required for tab order)
    - .planning/phases/05-packaging-distribution/05-RESEARCH.md `## Architecture Patterns > Pattern 6 > Manual checklist` (lines ~720-727)
    - .planning/phases/05-packaging-distribution/05-VALIDATION.md `## Manual-Only Verifications` (PACK-06 row)
    - packages/desktop/tests/a11y/audit.spec.ts (Task 1 output — to transcribe console.warn moderate/minor findings)
    - .planning/REQUIREMENTS.md PACK-03 (no ApplicationMenu dependency; reachable via keyboard / toolbar)
  </read_first>

  <files>
    .planning/phases/05-packaging-distribution/05-A11Y-AUDIT.md
  </files>

  <action>
    Create `.planning/phases/05-packaging-distribution/05-A11Y-AUDIT.md`. Run the audit suite first to capture findings, THEN transcribe results into the doc. Template:

    ```markdown
    # Phase 5 Accessibility Audit

    **Phase:** 05-packaging-distribution
    **Date:** {YYYY-MM-DD when audit was run}
    **Scope:** PACK-06 + PACK-03 invariant
    **Status:** Pass / Pass-with-caveats / Fail
    **Pass criterion (D-20):** Zero `critical` or `serious` axe violations + zero blocking issues in the manual checklist

    ---

    ## Audit method (R-04)

    | Property | Value |
    |----------|-------|
    | Automated tool | `@axe-core/playwright@^4.11.3` |
    | Tool target | `vite preview` on port 4173 (production-built renderer bundle) |
    | NOT tested against | The CEF-bundled `RoadRaven-Setup.exe` / `.tar.gz` binary (no paved-path Playwright integration; manual checklist covers this gap) |
    | WCAG level | 2.1 AA (`["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]`) |
    | Manual checklist | Yes — keyboard nav + theme switcher + ApplicationMenu absence (PACK-03) |
    | Findings location | This document; severity-blocker findings fixed in this phase, lower-severity filed below or as backlog |

    > **Caveat (R-04 documented):** The automated suite audits the production
    > Vite bundle (the same HTML/CSS/JS that ships in the installer's CEF
    > webview), but does NOT exercise the actual CEF binary. CEF-specific
    > rendering bugs in `--rv-*` token resolution, Radix ARIA injection, or
    > focus rings would not be caught by axe. The manual checklist below
    > spot-checks the installed app to fill that gap.

    ---

    ## Automated audit results

    Run command:

    ```bash
    bun run --cwd packages/desktop build      # produce dist/
    bun run --cwd packages/desktop test:a11y  # run audit suite
    ```

    ### Critical / Serious violations (BLOCKERS)

    {ONE OF:
      - "Zero blockers found." (preferred outcome — pass criterion satisfied)
      - A table listing each blocker, the surface where it appeared, and how it was fixed in this plan / file ID of the fix commit
    }

    ### Moderate / Minor findings (TRACKED, NON-BLOCKING)

    Transcribed from `console.warn` output of the audit run.

    | Surface | Rule ID | Impact | Description | Disposition |
    |---------|---------|--------|-------------|-------------|
    | {welcome-screen, loaded-roadmap, side-panel-open, context-menu-open, confirmation-dialog-open, theme-dark, theme-light, theme-high-contrast} | {axe rule id, e.g. `color-contrast-enhanced`} | moderate / minor | {brief axe description} | {fix-in-phase / backlog item / accepted with rationale} |
    | ... | ... | ... | ... | ... |

    {If no moderate/minor findings: "No moderate/minor findings logged in the audit run."}

    ---

    ## Manual checklist (per R-04 — axe doesn't verify tab order)

    **Test environment:** Run against the production-built app, not `vite preview`.
    Build the installer locally OR use the artifact from a tagged release:

    ```bash
    # Build locally (no tag needed)
    bun run --cwd packages/desktop build:stable
    # Find the installer in packages/desktop/artifacts/
    # Windows: extract the .zip, run RoadRaven-Setup.exe
    # Linux: tar -xzf the .tar.gz, cd RoadRavenSetup-stable, chmod +x ./RoadRavenSetup, ./RoadRavenSetup
    ```

    Walk each item; mark each row with PASS / FAIL / N/A + brief note.

    ### Keyboard navigation

    | Surface | Action | Expected | Result |
    |---------|--------|----------|--------|
    | Welcome screen | Tab through "Open file", "New roadmap", sample links | Visible focus on each, Enter activates | {PASS/FAIL} |
    | Tree canvas | Tab into the canvas, arrow keys navigate per layout | TB: ←/→ siblings, ↓ enter child, ↑ parent. LR: ↑/↓ siblings, → enter child, ← parent. (Note: Phase 3 user manually swapped TB arrows — verify against current behavior) | {PASS/FAIL} |
    | Tree canvas | F2 on selected node | Inline rename input opens, focus inside | {PASS/FAIL} |
    | Tree canvas | Enter / Tab / Shift+Enter | Add child / sibling | {PASS/FAIL} |
    | Tree canvas | Delete on leaf | Immediate delete, focus restores to next sibling or parent | {PASS/FAIL} |
    | Tree canvas | Delete on non-leaf | Confirmation dialog opens, Esc cancels, Tab cycles within dialog | {PASS/FAIL} |
    | Tree canvas | Ctrl+D (duplicate) | Duplicate node + subtree, focus on duplicate | {PASS/FAIL} |
    | Tree canvas | Ctrl+C, Ctrl+V | Copy/paste subtree | {PASS/FAIL} |
    | Tree canvas | Ctrl+↑/↓ | Reorder siblings | {PASS/FAIL} |
    | Context menu | Right-click on node, arrow keys + Enter, Esc | Radix menu opens, keyboard navigates, Esc closes, focus restores | {PASS/FAIL} |
    | Side panel | Click pencil [E] / press 'e' | Edit mode enters, focus in title or first editable | {PASS/FAIL} |
    | Side panel | Tab into CodeMirror notes | Focus enters editor; Esc returns to side-panel chrome | {PASS/FAIL} |
    | Status bar | SaveIndicator click when in error state | SaveFailureModal opens, keyboard navigable | {PASS/FAIL} |
    | Event log drawer (Phase 4) | Ctrl+Shift+L toggle, Esc to close | Drawer opens/closes; focus management correct | {PASS/FAIL} |
    | Theme switcher | Switch through dark / light / high-contrast | All UI remains usable; focus rings visible in each | {PASS/FAIL} |

    ### Visual focus indicators (per theme)

    | Theme | All focusable elements have a visible focus ring? | Result |
    |-------|---------------------------------------------------|--------|
    | dark | (test with Tab through every interactive element) | {PASS/FAIL} |
    | light | (same) | {PASS/FAIL} |
    | high-contrast | (same — extra scrutiny; THEME-02 spec) | {PASS/FAIL} |

    ### Color is not the sole status indicator

    | Surface | Verification | Result |
    |---------|--------------|--------|
    | Status badges on nodes | Both border-stripe color AND text label present | {PASS/FAIL} |
    | Save indicator (StatusBar) | Both icon AND text ("Saved ✓" / "Saving…" / "Error saving") | {PASS/FAIL} |
    | Event API pill (StatusBar, Phase 4) | Both dot color (●/○) AND text (`:47921` / `Event API off`) | {PASS/FAIL} |
    | Pulse indicator (Phase 4 PLUG-04) | Both animation AND `data-live="true"` attribute (and respects `prefers-reduced-motion`) | {PASS/FAIL} |

    ### PACK-03 invariants

    | Check | Expected | Result |
    |-------|----------|--------|
    | `grep -rn ApplicationMenu packages/desktop/src/` | Zero matches (PACK-03 — no ApplicationMenu dependency) | {PASS/FAIL — paste grep output} |
    | All file actions reachable from keyboard / toolbar | (Walk: Open file via keyboard, New file via keyboard, Save-as via keyboard) | {PASS/FAIL} |
    | `bundleCEF: true` confirmed in `packages/desktop/electrobun.config.ts` | Present on `mac`, `linux`, `win` | {PASS/FAIL — paste grep output} |
    | `process.on('SIGTERM', ...)` flushes pending writes | Present in `packages/desktop/src/bun/index.ts` | {PASS/FAIL — paste grep output} |

    ---

    ## Findings disposition summary

    | Severity | Count | Action |
    |----------|-------|--------|
    | Critical | {N} | Must be 0 to pass |
    | Serious | {N} | Must be 0 to pass |
    | Moderate | {N} | Tracked above; backlog candidates |
    | Minor | {N} | Tracked above; lowest priority backlog |
    | Manual-checklist FAIL | {N} | Each must be fixed before phase completion or filed as known-issue with explicit user acceptance |

    ---

    ## Audit sign-off

    - [ ] Automated suite ran successfully (zero critical/serious)
    - [ ] Manual checklist completed by: {name / date}
    - [ ] All FAIL rows in the manual checklist either fixed or documented as accepted
    - [ ] PACK-03 invariants verified
    - [ ] All three themes audited (dark, light, high-contrast)

    **Final disposition:** {Pass / Pass-with-caveats / Fail}

    ---

    *Last updated: {ISO date}*
    *Phase: 05-packaging-distribution*
    *Plan: 05-05-A11Y-AUDIT*
    ```

    Then RUN the audit suite and TRANSCRIBE the results into the placeholders. The "Critical / Serious violations" section either says "Zero blockers found" or lists them with fix references. The "Moderate / Minor findings" table is populated from the `console.warn` output. The manual checklist results are filled in by the human (Task 3 — checkpoint).
  </action>

  <verify>
    <automated>test -f .planning/phases/05-packaging-distribution/05-A11Y-AUDIT.md && echo OK</automated>
    <automated>grep -c "Pass criterion (D-20)" .planning/phases/05-packaging-distribution/05-A11Y-AUDIT.md  # MUST be >= 1</automated>
    <automated>grep -c "vite preview" .planning/phases/05-packaging-distribution/05-A11Y-AUDIT.md  # MUST be >= 1 (R-04)</automated>
    <automated>grep -c "Manual checklist" .planning/phases/05-packaging-distribution/05-A11Y-AUDIT.md  # MUST be >= 1</automated>
    <automated>grep -c "high-contrast" .planning/phases/05-packaging-distribution/05-A11Y-AUDIT.md  # MUST be >= 2 (theme rows)</automated>
    <automated>grep -c "ApplicationMenu" .planning/phases/05-packaging-distribution/05-A11Y-AUDIT.md  # MUST be >= 1 (PACK-03 invariant)</automated>
    <automated>grep -c "bundleCEF" .planning/phases/05-packaging-distribution/05-A11Y-AUDIT.md  # MUST be >= 1 (PACK-03 invariant)</automated>
    <automated>grep -c "Audit sign-off" .planning/phases/05-packaging-distribution/05-A11Y-AUDIT.md  # MUST be >= 1</automated>
  </verify>

  <acceptance_criteria>
    - File `.planning/phases/05-packaging-distribution/05-A11Y-AUDIT.md` exists
    - File contains the literal `Pass criterion (D-20)` AND its definition (zero critical/serious axe violations)
    - File contains the R-04 caveat (axe runs against `vite preview`, NOT the CEF-bundled binary; manual checklist fills the gap)
    - File contains a "Manual checklist" section with at least 14 row items covering: keyboard nav (welcome, tree canvas, F2, Enter/Tab/Shift+Enter, Delete leaf, Delete non-leaf with confirmation, Ctrl+D, Ctrl+C+V, Ctrl+↑↓, context menu, side panel, CodeMirror, save indicator, event log drawer, theme switcher)
    - File contains a "Visual focus indicators" section with rows for dark, light, AND high-contrast themes
    - File contains a "Color is not the sole status indicator" section with rows for status badges, save indicator, Event API pill, pulse indicator
    - File contains a "PACK-03 invariants" section with checks for ApplicationMenu absence, bundleCEF, SIGTERM handler
    - File contains an "Audit sign-off" section with checkboxes
    - File transcribes the actual `bun run --cwd packages/desktop test:a11y` output:
      - "Critical / Serious violations" section shows EITHER "Zero blockers found" OR a table of fixed blockers
      - "Moderate / Minor findings" section shows EITHER "No moderate/minor findings logged" OR a table populated from the audit's console.warn output
    - File `Findings disposition summary` table has counts filled in (no `{N}` placeholders left in the final committed version)
  </acceptance_criteria>

  <done>
    Audit doc exists with all sections populated from real audit output. Manual-checklist rows have placeholder PASS/FAIL state ready for the human to walk and fill in (Task 3 checkpoint).
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 3: Human checkpoint — walk the manual checklist on the installed app</name>

  <what-built>
    - Plan 05-02: `@roadraven/core` + `@roadraven/plugin-claude-code` build configs
    - Plan 05-03: release.yml workflow (all 6 jobs including deploy-docs) + CI invariants
    - Plan 05-04 (parallel): docs site + CONTRIBUTING.md + README polish
    - Plan 05-05 Task 1: expanded a11y suite (8+ audits, all themes — automated baseline GREEN)
    - Plan 05-05 Task 2: 05-A11Y-AUDIT.md scaffold with manual-checklist rows ready to fill in
  </what-built>

  <how-to-verify>
    **Pre-step:** Build the installer locally so you can audit the actual CEF-bundled
    binary (not just `vite preview`). This catches CEF-only divergence in `--rv-*`
    token rendering, Radix ARIA injection, focus rings (R-04 documented gap).

    ```bash
    # 1. Build the production renderer bundle
    bun run --cwd packages/desktop build

    # 2. Build the platform-native installer (stable channel)
    #    Note: this downloads the Electrobun CLI binary on first run (~30s)
    bun run --cwd packages/desktop build:stable
    ```

    Output appears in `packages/desktop/artifacts/`:
    - Windows: `stable-win-x64-RoadRaven-Setup-stable.zip` containing `RoadRaven-Setup.exe`
    - Linux: `stable-linux-x64-RoadRavenSetup-stable.tar.gz`

    **Install the relevant artifact** for your OS:

    - **Windows:** Extract the `.zip`, double-click `RoadRaven-Setup.exe`,
      click through SmartScreen (More info → Run anyway).
    - **Linux:** `tar -xzf stable-linux-x64-RoadRavenSetup-stable.tar.gz && cd RoadRavenSetup-stable && chmod +x ./RoadRavenSetup && ./RoadRavenSetup`

    **Walk the manual checklist** in `.planning/phases/05-packaging-distribution/05-A11Y-AUDIT.md`:

    1. Open the installed app (NOT `bun run dev:hmr` — must be the actual installed binary)
    2. Walk every row in the "Manual checklist" section — mark PASS / FAIL / N/A
    3. Walk every row in "Visual focus indicators (per theme)" — switch through all three themes
    4. Walk every row in "Color is not the sole status indicator"
    5. Run the grep commands listed in "PACK-03 invariants" — paste outputs
    6. Update the "Audit sign-off" section: check the boxes you've completed; sign with your name + date
    7. Update "Final disposition": Pass / Pass-with-caveats / Fail
    8. If any FAIL rows: file an issue, fix in this plan if blocking, OR add a row to "Findings disposition summary" justifying the acceptance

    **Then commit the updated 05-A11Y-AUDIT.md.**

    Pass criterion: zero blocker findings in the manual checklist (matches the
    automated D-20 criterion).
  </how-to-verify>

  <resume-signal>
    Reply with: `approved` (audit passed, doc committed) — OR — `fail: <details>` with the failing rows + your proposed remediation plan.

    If `fail: ...`, add a follow-up task to this plan (or escalate as a Wave-3 blocker) to fix the issue before the phase ships.
  </resume-signal>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| `vite preview` audit ≠ CEF binary audit | The automated suite catches DOM / CSS / ARIA issues but NOT CEF-rendering-engine bugs. The manual checklist (Task 3) is the boundary — without a human walking the installed app, CEF-only regressions slip through. |
| WCAG 2.1 AA ≠ subjective UX accessibility | axe verifies machine-checkable rules (color contrast, ARIA roles, label associations). It does NOT verify tab order matches visual reading order, focus management on dynamic content, screen-reader announcement of state changes. The manual checklist's keyboard-navigation rows fill that gap. |
| Audit selector contract → app DOM stability | The audit relies on a stable contract: `[role="application"]` on the canvas wrapper, `[data-source-id]` + `[role="treeitem"]` on node cards, the Hello World button label. If a future refactor removes any of these without restoring them (or adding a `data-testid` equivalent), the audit silently breaks. Per checker B-4/W-1/W-2, the audit treats these as public DOM contracts and the executor must restore them as a Wave-1 blocker if broken. |

## STRIDE Threat Register

> Phase 5 has no new code-execution surface in this plan (audit-only). The
> threat model is empty — accessibility findings are quality issues, not
> security issues. The PACK-03 invariant check (no ApplicationMenu) is a
> functional regression check, not a security check.

(No threats applicable — empty register by design.)
</threat_model>

<verification>
After all three tasks land:

```bash
# Build the production bundle
bun run --cwd packages/desktop build

# Run the audit suite — MUST exit 0 (zero critical/serious blockers)
bun run --cwd packages/desktop test:a11y

# Audit doc exists and is complete
test -f .planning/phases/05-packaging-distribution/05-A11Y-AUDIT.md
grep -q "Pass criterion (D-20)" .planning/phases/05-packaging-distribution/05-A11Y-AUDIT.md
grep -q "Audit sign-off" .planning/phases/05-packaging-distribution/05-A11Y-AUDIT.md

# Build the installer for the human checkpoint
# (this is what Task 3 needs)
bun run --cwd packages/desktop build:stable
ls packages/desktop/artifacts/

# Verify PACK-03 invariants directly (test of the manual-checklist rows)
grep -rn "ApplicationMenu" packages/desktop/src/ || echo "PACK-03 OK: no ApplicationMenu found"
grep -c "bundleCEF" packages/desktop/electrobun.config.ts                  # MUST be >= 1
grep -c 'process.on("SIGTERM"' packages/desktop/src/bun/index.ts            # MUST be >= 1
```

**Manual verification (Task 3 checkpoint — explicit human gate):** Audit the installed app per the manual checklist. Cannot be automated.
</verification>

<success_criteria>
- Automated audit suite covers welcome + loaded-roadmap + side-panel + context-menu + confirmation-dialog + 3 themes
- Audit suite passes with zero `critical` / `serious` violations (D-20 met)
- Moderate / minor findings transcribed into `05-A11Y-AUDIT.md` for tracking
- Manual checklist completed by human (Task 3 checkpoint), all rows PASS or accepted with rationale
- PACK-03 invariants re-verified (no ApplicationMenu, bundleCEF, SIGTERM handler)
- `05-A11Y-AUDIT.md` final disposition: Pass (or Pass-with-caveats with explicit acceptance)
- No new app code regressions (existing `bun run verify` still passes)
- All selectors in audit.spec.ts are pre-verified against actual source files (per checker B-4/W-1/W-2 — no branching, no uncertainty)
</success_criteria>

<output>
After completion, create `.planning/phases/05-packaging-distribution/05-05-SUMMARY.md` describing:
- The expanded audit suite scope (which surfaces, which themes)
- Audit run results: count of critical / serious / moderate / minor findings; what was fixed in this plan vs filed as backlog
- Manual checklist outcome: PASS rows, FAIL rows + their disposition
- PACK-03 invariant verification (paste grep outputs)
- Final audit disposition (Pass / Pass-with-caveats / Fail)
- Any selectors in audit.spec.ts that needed adjustment from the planned skeleton between planning (2026-05-03) and execution (so future audit runs do not re-trip on the same selector mismatch). The plan pre-verified selectors against source as of 2026-05-03; record any drift here.
</output>
</content>
</invoke>