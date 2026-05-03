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
    - "Audit covers welcome screen + loaded-roadmap-with-sample + side-panel-open + context-menu-open + confirmation-dialog-open + all three themes"
    - "Pass criterion (D-20): zero axe violations with impact `critical` or `serious`"
    - "Manual checklist completed: keyboard-only navigation through tree edits, context menu, side panel, settings drawer, save flow, theme switcher (axe doesn't verify tab order)"
    - "Manual checklist verifies PACK-03 invariant: no `ApplicationMenu` import (file actions reachable via keyboard / toolbar)"
    - "Findings documented in 05-A11Y-AUDIT.md with severity classification and disposition (fix-in-phase / backlog / accepted)"
    - "Human checkpoint: user runs the manual checklist on the actual installed app post-Wave-2 build to catch CEF-only divergence (R-04 documented caveat)"
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

Output:
- Expanded `packages/desktop/tests/a11y/audit.spec.ts` (covers 6+ interaction surfaces)
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

<interfaces>
<!-- Wave-0 scaffold (Plan 05-01) for audit.spec.ts: -->
<!--   - Single test: "Welcome screen passes WCAG 2.1 AA (no critical/serious violations)" -->
<!--   - test.skip(!hasDist, ...) gate -->
<!--   - AxeBuilder().withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze() -->
<!--   - blockers = violations.filter(v => v.impact === "critical" || v.impact === "serious") -->
<!--   - tracked = moderate/minor (warned, not failed) -->

<!-- This plan EXPANDS audit.spec.ts to cover: -->
<!--   1. Welcome screen (existing) -->
<!--   2. Loaded sample roadmap (sample=hello-world) -->
<!--   3. Side panel opened on a node -->
<!--   4. Context menu opened on a node -->
<!--   5. Confirmation dialog (delete non-leaf) -->
<!--   6. Each of the three themes (dark, light, high-contrast) -->

<!-- Sample loading: WelcomeScreen has a "Sample roadmaps" link that navigates -->
<!-- to ?sample=hello-world. Verify by reading packages/desktop/src/mainview/components/WelcomeScreen.tsx -->
<!-- BEFORE writing the test — if the URL pattern differs, adjust accordingly. -->

<!-- Theme switching: ThemeProvider exposes data-theme attribute on root. -->
<!-- Read packages/desktop/src/mainview/state/themeStore.ts (or similar) to confirm -->
<!-- the API for programmatically setting a theme from a Playwright test. -->
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Expand audit.spec.ts to cover 6+ interaction surfaces and all three themes</name>

  <behavior>
    - audit.spec.ts has at minimum these test cases:
      1. Welcome screen / WCAG 2.1 AA (existing — kept)
      2. Loaded sample roadmap / WCAG 2.1 AA
      3. Side panel open on a node / WCAG 2.1 AA
      4. Context menu open on a node / WCAG 2.1 AA (Radix-rendered)
      5. Confirmation dialog (delete non-leaf) / WCAG 2.1 AA
      6. Theme: dark / WCAG 2.1 AA (default)
      7. Theme: light / WCAG 2.1 AA
      8. Theme: high-contrast / WCAG 2.1 AA
    - Each test independently asserts `blockers).toEqual([])` for `critical` + `serious` impact
    - All tests log moderate/minor findings via console.warn (do not fail)
    - Tests SKIP if `packages/desktop/dist/` is missing (existing scaffold guard preserved)
    - Test file uses appropriate Playwright selectors that match the actual rendered DOM (read source files BEFORE writing selectors)
  </behavior>

  <read_first>
    - packages/desktop/tests/a11y/audit.spec.ts (Wave 0 scaffold — extend it, don't replace it)
    - packages/desktop/tests/a11y/playwright.config.ts (Wave 0 — vite preview port 4173)
    - packages/desktop/src/mainview/components/WelcomeScreen.tsx (sample-load mechanism — find the actual selector / URL pattern)
    - packages/desktop/src/mainview/components/Canvas.tsx (or wherever the tree renders — for the role/aria selectors used in the loaded-roadmap test)
    - packages/desktop/src/mainview/components/SidePanel.tsx (for selectors when testing side-panel-open state)
    - packages/desktop/src/mainview/state/themeStore.ts (or themeProvider — for programmatic theme switching from Playwright)
    - packages/desktop/src/mainview/components/ConfirmationDialog.tsx (delete-non-leaf flow — to know how to trigger it from a test)
    - .planning/phases/05-packaging-distribution/05-RESEARCH.md `## Architecture Patterns > Pattern 6` (lines 664-727) — pattern for the audit tests
  </read_first>

  <files>
    packages/desktop/tests/a11y/audit.spec.ts
    packages/desktop/package.json
  </files>

  <action>
    **A. Expand `packages/desktop/tests/a11y/audit.spec.ts`** to cover all listed surfaces. Read the existing scaffold + the source files first to know what selectors / URL params / interactions to use. The PRESERVED guard at the top (`test.skip(!hasDist, ...)`) stays.

    Skeleton (verify selectors against actual source files; adjust as needed — DO NOT use placeholder selectors that don't exist):

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

    test.describe("Accessibility audit (production bundle, vite preview port 4173)", () => {
    	test("1. Welcome screen passes WCAG 2.1 AA", async ({ page }) => {
    		await page.goto("/");
    		await page.waitForLoadState("networkidle");
    		await auditPage(page, "welcome-screen");
    	});

    	test("2. Loaded sample roadmap passes WCAG 2.1 AA", async ({ page }) => {
    		// VERIFY URL PATTERN against WelcomeScreen.tsx — if sample loading uses
    		// a different mechanism (e.g., click-to-load), adapt to use page.click(...)
    		// instead of a query param.
    		await page.goto("/?sample=hello-world");
    		// Wait for tree to render — selector verified against Canvas.tsx
    		await page.waitForSelector('[role="application"]', { timeout: 5000 });
    		// Exclude react-d3-tree's SVG link paths (they have no semantic content
    		// and axe occasionally flags missing labels on the <path> elements)
    		await auditPage(page, "loaded-roadmap", {
    			exclude: ["svg .rd3t-link"],
    		});
    	});

    	test("3. Side panel open on a node passes WCAG 2.1 AA", async ({ page }) => {
    		await page.goto("/?sample=hello-world");
    		await page.waitForSelector('[role="application"]', { timeout: 5000 });
    		// Click the first node card to open the side panel
    		// VERIFY selector against RoadmapNodeCard.tsx — adjust if [role="button"]
    		// is on a different element
    		await page.click('[role="button"][data-node-id]', { timeout: 5000 });
    		// Wait for side panel to render — VERIFY selector
    		await page.waitForSelector('[data-side-panel-open="true"], aside[aria-label*="ide panel"]', {
    			timeout: 3000,
    		});
    		await auditPage(page, "side-panel-open", { exclude: ["svg .rd3t-link"] });
    	});

    	test("4. Context menu open on a node passes WCAG 2.1 AA (Radix ARIA)", async ({ page }) => {
    		await page.goto("/?sample=hello-world");
    		await page.waitForSelector('[role="application"]', { timeout: 5000 });
    		// Right-click on a node to open Radix ContextMenu
    		await page.click('[role="button"][data-node-id]', { button: "right", timeout: 5000 });
    		// Wait for Radix-rendered menu — VERIFY selector against the Radix output
    		// (Radix typically renders [role="menu"] or data-radix-menu-content)
    		await page.waitForSelector('[role="menu"]', { timeout: 3000 });
    		await auditPage(page, "context-menu-open", { exclude: ["svg .rd3t-link"] });
    	});

    	test("5. Confirmation dialog (delete non-leaf) passes WCAG 2.1 AA", async ({ page }) => {
    		await page.goto("/?sample=hello-world");
    		await page.waitForSelector('[role="application"]', { timeout: 5000 });
    		// Trigger the delete confirmation dialog. The exact path depends on the
    		// keyboard shortcut and which node is focused. VERIFY against
    		// useKeyboardRouter.ts — if the test environment can't easily deliver
    		// the keyboard event, fall back to clicking through the context menu.
    		await page.click('[role="button"][data-node-id]', { timeout: 5000 });
    		await page.keyboard.press("Delete");
    		// Wait for Radix Dialog
    		await page.waitForSelector('[role="dialog"], [role="alertdialog"]', { timeout: 3000 });
    		await auditPage(page, "confirmation-dialog-open", { exclude: ["svg .rd3t-link"] });
    	});

    	// Themes — applied via CSS data-attribute on root. VERIFY mechanism against
    	// the actual ThemeProvider implementation; if it uses a different approach
    	// (e.g., setAttribute on documentElement), adjust the page.evaluate call.
    	for (const theme of ["dark", "light", "high-contrast"] as const) {
    		test(`6. Theme '${theme}' passes WCAG 2.1 AA`, async ({ page }) => {
    			await page.goto("/?sample=hello-world");
    			await page.waitForSelector('[role="application"]', { timeout: 5000 });
    			// Apply theme via the theme store. VERIFY exposed window API or
    			// localStorage key. If the app exposes window.__roadraven_setTheme,
    			// use that; otherwise inspect themeStore.ts for the persistence key
    			// and set via localStorage + reload.
    			await page.evaluate((t) => {
    				// First option: localStorage-based persistence
    				localStorage.setItem("rv.theme", t);
    			}, theme);
    			await page.reload();
    			await page.waitForSelector('[role="application"]', { timeout: 5000 });
    			// Sanity check the theme actually applied — VERIFY data-theme attribute
    			// or :root CSS custom property reflects the theme
    			const actualTheme = await page.evaluate(() =>
    				document.documentElement.getAttribute("data-theme"),
    			);
    			expect(actualTheme, `Theme should be '${theme}' but is '${actualTheme}'`).toBe(theme);

    			await auditPage(page, `theme-${theme}`, { exclude: ["svg .rd3t-link"] });
    		});
    	}
    });
    ```

    **CRITICAL:** Before committing the test, verify each selector + URL pattern + theme-switching mechanism by reading the actual source files (listed in `<read_first>`). If the WelcomeScreen does not support `?sample=hello-world`, find the actual mechanism (e.g., a button click) and use it. If `data-node-id` is not the actual node-card selector, find the right one. If `localStorage.setItem("rv.theme", ...)` is not how the theme is persisted, find the actual key name. Test failures from stale selectors are wasted CI time.

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

    Document any selector adjustments needed (e.g., "WelcomeScreen uses click-to-load not query param; adapted test 2 to click the 'hello-world' link"). These adjustments belong in `05-A11Y-AUDIT.md` (Task 2).

    **D. If any test FAILS with a `critical`/`serious` blocker:** fix the underlying app issue in this plan (or file as a Wave-3-blocker that must be fixed before the next wave). The pass criterion (D-20) is zero blockers — you cannot ship Phase 5 with red blockers. Lower-severity findings are tracked in `05-A11Y-AUDIT.md` but do not block.
  </action>

  <verify>
    <automated>test -f packages/desktop/tests/a11y/audit.spec.ts && echo OK</automated>
    <automated>grep -c 'test\.describe' packages/desktop/tests/a11y/audit.spec.ts  # MUST be >= 1</automated>
    <automated>grep -c 'auditPage(page,' packages/desktop/tests/a11y/audit.spec.ts  # MUST be >= 8 (welcome + loaded + side-panel + context-menu + dialog + 3 themes = 8 audits)</automated>
    <automated>grep -c '\.exclude(' packages/desktop/tests/a11y/audit.spec.ts  # MUST be >= 1 (rd3t-link exclusion)</automated>
    <automated>grep -cE 'high-contrast|highContrast' packages/desktop/tests/a11y/audit.spec.ts  # MUST be >= 1 (THEME-02 third theme)</automated>
    <automated>cat packages/desktop/package.json | grep -c '"test:a11y":'  # MUST be 1</automated>
    <automated>bun run --cwd packages/desktop build  # MUST exit 0 (produces dist/)</automated>
    <automated>bun run --cwd packages/desktop test:a11y  # MUST exit 0 — zero critical/serious blockers (D-20)</automated>
  </verify>

  <acceptance_criteria>
    - `packages/desktop/tests/a11y/audit.spec.ts` contains AT LEAST 8 audit invocations (`auditPage(page, ...)` calls), one each for: welcome screen, loaded roadmap, side panel open, context menu open, confirmation dialog open, theme dark, theme light, theme high-contrast
    - The `auditPage` helper enforces `expect(blockers).toEqual([])` where `blockers` filters `v.impact === "critical" || v.impact === "serious"`
    - The `auditPage` helper logs moderate/minor findings via `console.warn` (audit-doc material) without failing
    - Test file preserves the Wave-0 `test.skip(!hasDist, ...)` guard
    - Test file uses selectors that EXIST in the actual source — verified by reading packages/desktop/src/mainview/components/{WelcomeScreen,Canvas,SidePanel,RoadmapNodeCard}.tsx before writing
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
    # Linux: tar -xzf the .tar.gz, run ./RoadRavenSetup
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
    - Plan 05-03: release.yml workflow + CI invariants
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
    - **Linux:** `tar -xzf stable-linux-x64-RoadRavenSetup-stable.tar.gz && cd <extracted> && ./RoadRavenSetup`

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
</success_criteria>

<output>
After completion, create `.planning/phases/05-packaging-distribution/05-05-SUMMARY.md` describing:
- The expanded audit suite scope (which surfaces, which themes)
- Audit run results: count of critical / serious / moderate / minor findings; what was fixed in this plan vs filed as backlog
- Manual checklist outcome: PASS rows, FAIL rows + their disposition
- PACK-03 invariant verification (paste grep outputs)
- Final audit disposition (Pass / Pass-with-caveats / Fail)
- Any selectors / theme-switching mechanisms in audit.spec.ts that needed adjustment from the planned skeleton (so future audit runs do not re-trip on the same selector mismatch)
</output>
