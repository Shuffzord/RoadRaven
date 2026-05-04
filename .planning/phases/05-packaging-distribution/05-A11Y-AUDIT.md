# Phase 5 Accessibility Audit

**Phase:** 05-packaging-distribution
**Plan:** 05-05-A11Y-AUDIT
**Date:** 2026-05-04
**Scope:** PACK-06 + PACK-03 invariant
**Status:** Pass (automated) / Awaiting human checklist sign-off (manual)
**Pass criterion (D-20):** Zero `critical` or `serious` axe violations + zero
blocking issues in the manual checklist.

---

## Audit method (R-04)

| Property            | Value                                                                                                                                                         |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Automated tool      | `@axe-core/playwright@4.11.3`                                                                                                                                 |
| Tool target         | `vite preview` on port 4173 (production-built renderer bundle)                                                                                                |
| NOT tested against  | The CEF-bundled `RoadRaven-Setup.exe` / `.tar.gz` binary (no paved-path Playwright integration; manual checklist covers this gap)                              |
| WCAG level          | 2.1 AA (`["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]`)                                                                                                       |
| Manual checklist    | Yes — keyboard nav + theme switcher + ApplicationMenu absence (PACK-03)                                                                                       |
| Findings location   | This document; severity-blocker findings fixed in this phase, lower-severity filed below or as backlog                                                        |
| Audit-suite location | `packages/desktop/tests/a11y/audit.spec.ts` (8 audit invocations across 6 surfaces × 3 themes)                                                                |

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

Last run: 2026-05-04, 8 passed (0 failed), 11.3s wall time.

### Audit surfaces covered

| # | Test                                                              | Theme                  | Status |
| - | ----------------------------------------------------------------- | ---------------------- | ------ |
| 1 | Welcome screen                                                    | (default — dark)       | PASS   |
| 2 | Loaded sample roadmap (Hello World button click)                  | (default — dark)       | PASS   |
| 3 | Side panel open on a node                                         | (default — dark)       | PASS   |
| 4 | Context menu open on a node (Radix ARIA)                          | (default — dark)       | PASS   |
| 5 | Confirmation dialog (delete non-leaf) open                        | (default — dark)       | PASS   |
| 6 | Loaded roadmap, theme=`dark`                                      | dark                   | PASS   |
| 7 | Loaded roadmap, theme=`light`                                     | light                  | PASS   |
| 8 | Loaded roadmap, theme=`high-contrast`                             | high-contrast          | PASS   |

### Critical / Serious violations (BLOCKERS)

**Zero axe blockers found** — pass criterion (D-20) satisfied for the
automated suite. Manual checklist surfaced two additional WAI-ARIA / WCAG
2.1.1 issues in the installed CEF binary that axe could not detect; both
fixed in this plan (see "Manual checklist findings" below).

#### Blockers found and fixed in this plan (initial run on 2026-05-04 surfaced 9 distinct violations across 7/8 tests; all fixed in commit `db1934c`)

| # | Rule                          | Impact   | Surface(s)                                                        | Root cause                                                           | Fix                                                                                                                                                                                       |
| - | ----------------------------- | -------- | ----------------------------------------------------------------- | -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 | `color-contrast`              | serious  | welcome-screen, loaded, theme-dark                                | `--rv-text-tertiary: #666666` on dark BGs → 2.66–3.17:1 vs req 4.5:1 | Bumped dark-theme `--rv-text-tertiary` to `#a8a8a8` (4.62:1 on `#131313`)                                                                                                                  |
| 2 | `color-contrast`              | serious  | welcome-screen, loaded, theme-light                               | `--rv-text-tertiary: #999999` on light BGs → 2.85:1 vs req 4.5:1     | Bumped light-theme `--rv-text-tertiary` to `#6b6b6b` (4.61:1 on `#f0f0f0/#f5f5f5/#ffffff`)                                                                                                 |
| 3 | `color-contrast`              | serious  | welcome-screen ("Open File" button), theme-dark/light             | `#ffffff` on `--rv-accent: #4a9eff` → 2.75:1 vs req 4.5:1            | Dark theme: `--rv-text-on-accent` → `#0a1a2c` (6.7:1). Light theme: darkened `--rv-accent` to `#155bb8` (5.10:1 with white)                                                                |
| 4 | `color-contrast`              | serious  | theme-high-contrast ("Open File" button)                          | `#ffffff` on `--rv-accent: #60b0ff` → 2.36:1 vs req 4.5:1            | High-contrast `--rv-text-on-accent` → `#000000` (8.9:1)                                                                                                                                   |
| 5 | `color-contrast`              | serious  | context-menu-open (Delete shortcut hint "Del")                    | `#ef4444` with `opacity: 0.6` → effective `#9e3838` on `#252527` = 2.24:1 | Removed `style={{color, opacity}}` override from `<span className={HINT_CLASS}>Del</span>`; hint now uses standard `--rv-text-tertiary` (4.6:1)                                            |
| 6 | `color-contrast`              | serious  | context-menu-open ("Delete" word)                                 | `#ef4444` on `#252527` = 4.06:1 vs req 4.5:1                         | Bumped dark-theme `--rv-status-blocked` to `#ff5252` (4.74:1)                                                                                                                              |
| 7 | `color-contrast`              | serious  | theme-light (TB/LR layout-direction radiogroup pressed state)     | `#1e6dd6` on `#dfe6ee` muted-accent = 3.96:1                         | Darkened light-theme `--rv-accent` further to `#155bb8` (4.51:1 on the muted-accent surface)                                                                                              |
| 8 | `aria-required-parent`        | critical | loaded-roadmap, side-panel-open, dialog-open, all themes          | `role="treeitem"` on RoadmapNode cards lacked `role="tree"` ancestor | Wrapped `<Tree>` in `<div role="tree" aria-label="Roadmap tree">` inside `Canvas.tsx` so ARIA hierarchy is `application > tree > treeitem`                                                 |
| 9 | `scrollable-region-focusable` + `focusable-content` + `focusable-element` | critical/serious | side-panel-open                                                | `<div className="flex-1 p-4 overflow-y-auto">` was scrollable but not focusable | Added `tabIndex={0}` to the SidePanel scrollable content div (WCAG 2.1.1 keyboard accessibility for scroll regions)                                                                       |

All fixes are in commit `db1934c`. Existing 452/452 desktop unit tests still
pass; tsc --noEmit clean. No DOM contracts changed (RoadmapNode still has
`data-source-id` + `role="treeitem"`; Canvas still has `role="application"`).

### Manual checklist findings (installed CEF binary, 2026-05-04)

The first pass of the manual checklist on the stable installer surfaced
three issues. Two were real WAI-ARIA / keyboard bugs invisible to axe (it
audits `vite preview`, not the CEF webview, and these are about tab order
and shortcut wiring rather than DOM ARIA shape). One was an
expectation-vs-design clarification.

| # | Surface                  | Issue                                                                                                  | Severity | Disposition                                                                                                                                                    |
| - | ------------------------ | ------------------------------------------------------------------------------------------------------ | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 | Delete on a leaf vs non-leaf | Leaf delete is immediate (no dialog); non-leaf delete shows confirmation. User read this as a bug.     | n/a (design) | **Documented** — intentional per Phase 3 contract: leaves immediate-delete is the common tree-editor convention. The dialog is reserved for destructive-with-children operations. Manual checklist row A5 is meant to verify this exact behavior; B1 verifies the dialog path. |
| 2 | Shift+Tab on a card seemed to "collapse" the parent's subtree | Two compounding causes: (a) the chevron `<button>` was in the document tab cycle (no explicit tabIndex), violating WAI-ARIA tree pattern (only treeitem should be tabbable). (b) The router caught `Tab` without checking `e.shiftKey`, so Shift+Tab was running `addSiblingBelow` and the create-then-rename flow looked like a fold. | serious  | **Fixed in this plan** — `RoadmapNode.tsx` chevron `<button>` is `tabIndex={-1}`; expand/collapse remains mouse-clickable but is no longer a tab stop. `useKeyboardRouter.ts` Tab handler now requires `!e.shiftKey`; Shift+Tab falls through to native focus-backward.                                              |
| 3 | F2 rename "only worked on newly-created nodes"               | Action shortcuts (F2, Delete, Enter, Tab, Ctrl+D, Ctrl+↑/↓, Ctrl+C/V) all required `focusedNodeId`. Newly-created nodes go through `dispatchOpenRename` (sets focus). Loaded nodes only get focus from a card-body click; clicking the chevron stops propagation, leaving `focusedNodeId` null even though `selectedNodeId` was set. F2 then no-oped silently. | serious  | **Fixed in this plan** — router now uses `targetId = focusedId ?? selectedId` for action shortcuts. Arrow nav and Space stay focused-only (they're navigation primitives that need explicit keyboard focus). Awaits user retest on rebuilt installer.                                              |

All fixes verified locally: `bun run --cwd packages/desktop typecheck`
clean, `bun run --cwd packages/desktop test` 452/452 pass, no regressions.
Final pass/fail awaits the second-round manual walkthrough.

### Moderate / Minor findings (TRACKED, NON-BLOCKING)

No moderate/minor findings logged in the final audit run (the `auditPage`
helper logs them via `console.warn` when present; the 2026-05-04 run produced
no such warnings — the entire suite is clean of moderate/minor violations
on the 8 audited surfaces).

### Known false positives (excluded from the audit)

Documented exclusions in `packages/desktop/tests/a11y/audit.spec.ts`:

| Surface | Excluded selector | Reason |
| ------- | ------------------ | ------ |
| All loaded-roadmap tests | `svg .rd3t-link` | react-d3-tree's SVG link `<path>` elements have no semantic content; axe occasionally flags missing labels on them. They are pure visual connectors and exposing them as labelled would be wrong. |
| Test 4 (context-menu-open) | `#root[aria-hidden='true']` | When Radix ContextMenu opens, its Portal pattern marks the rest of the page (`#root`) as `aria-hidden=true`. Native focusable elements (TopBar buttons, search input, sidebar buttons, zoom controls, theme picker) remain in the DOM. **Focus IS trapped in the menu by Radix's `FocusScope`** — Tab cycles within the menu, Escape closes and restores focus to the trigger. The aria-hidden+focusable combo is a documented Radix v2 behavior pattern and a well-known false positive for `aria-hidden-focus`. The manual checklist (Task 3) verifies that Tab order is in fact correct when the menu is open. |

---

## Manual checklist (per R-04 — axe doesn't verify tab order)

**Test environment:** Run against the production-built app, not `vite preview`.
Build the installer locally OR use the artifact from a tagged release:

```bash
# Build locally (no tag needed)
bun run --cwd packages/desktop build:stable
# Find the installer in packages/desktop/artifacts/
# Windows: extract the .zip, run RoadRaven-Setup.exe (SmartScreen → More info → Run anyway)
# Linux:   tar -xzf the .tar.gz, cd RoadRavenSetup-stable, chmod +x ./RoadRavenSetup, ./RoadRavenSetup
```

Walk each item; mark each row with PASS / FAIL / N/A + brief note.

### Keyboard navigation

| Surface                    | Action                                                             | Expected                                                                                                                                                                                | Result        |
| -------------------------- | ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| Welcome screen             | Tab through "Open File", "New roadmap", sample links               | Visible focus on each, Enter activates                                                                                                                                                  | _PASS / FAIL_ |
| Tree canvas                | Tab into the canvas, arrow keys navigate per layout                | TB: ←/→ siblings, ↓ enter child, ↑ parent. LR: ↑/↓ siblings, → enter child, ← parent. (Verify against current behavior — Phase 3 user manually swapped TB arrows) | _PASS / FAIL_ |
| Tree canvas                | F2 on selected node                                                | Inline rename input opens, focus inside                                                                                                                                                 | _PASS / FAIL_ |
| Tree canvas                | Enter / Tab / Shift+Enter                                          | Add child / sibling                                                                                                                                                                     | _PASS / FAIL_ |
| Tree canvas                | Delete on leaf                                                     | Immediate delete, focus restores to next sibling or parent                                                                                                                              | _PASS / FAIL_ |
| Tree canvas                | Delete on non-leaf                                                 | Confirmation dialog opens, Esc cancels, Tab cycles within dialog                                                                                                                        | _PASS / FAIL_ |
| Tree canvas                | Ctrl+D (duplicate)                                                 | Duplicate node + subtree, focus on duplicate                                                                                                                                            | _PASS / FAIL_ |
| Tree canvas                | Ctrl+C, Ctrl+V                                                     | Copy/paste subtree                                                                                                                                                                      | _PASS / FAIL_ |
| Tree canvas                | Ctrl+↑/↓                                                           | Reorder siblings                                                                                                                                                                        | _PASS / FAIL_ |
| Context menu               | Right-click on node, arrow keys + Enter, Esc                       | Radix menu opens, keyboard navigates, Esc closes, focus restores                                                                                                                        | _PASS / FAIL_ |
| Side panel                 | Click pencil [E] / press 'e'                                       | Edit mode enters, focus in title or first editable                                                                                                                                      | _PASS / FAIL_ |
| Side panel                 | Tab into CodeMirror notes                                          | Focus enters editor; Esc returns to side-panel chrome                                                                                                                                   | _PASS / FAIL_ |
| Status bar                 | SaveIndicator click when in error state                            | SaveFailureModal opens, keyboard navigable                                                                                                                                              | _PASS / FAIL_ |
| Event log drawer (Phase 4) | Ctrl+Shift+L toggle, Esc to close                                  | Drawer opens/closes; focus management correct                                                                                                                                           | _PASS / FAIL_ |
| Theme switcher             | Switch through dark / light / high-contrast                        | All UI remains usable; focus rings visible in each                                                                                                                                      | _PASS / FAIL_ |

### Visual focus indicators (per theme)

| Theme         | All focusable elements have a visible focus ring? | Result        |
| ------------- | ------------------------------------------------- | ------------- |
| dark          | (test with Tab through every interactive element) | _PASS / FAIL_ |
| light         | (same)                                            | _PASS / FAIL_ |
| high-contrast | (same — extra scrutiny; THEME-02 spec)            | _PASS / FAIL_ |

### Color is not the sole status indicator

| Surface                                | Verification                                                                                                            | Result        |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------- |
| Status badges on nodes                 | Both border-stripe color AND text label present                                                                         | _PASS / FAIL_ |
| Save indicator (StatusBar)             | Both icon AND text ("Saved ✓" / "Saving…" / "Error saving")                                                              | _PASS / FAIL_ |
| Event API pill (StatusBar, Phase 4)    | Both dot color (●/○) AND text (`:47921` / `Event API off`)                                                              | _PASS / FAIL_ |
| Pulse indicator (Phase 4 PLUG-04)      | Both animation AND `data-live="true"` attribute (and respects `prefers-reduced-motion`)                                 | _PASS / FAIL_ |

### PACK-03 invariants

| Check                                                         | Expected                                                                                          | Result                                                                                          |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `grep -rn ApplicationMenu packages/desktop/src/`              | Zero matches (PACK-03 — no ApplicationMenu dependency)                                            | **PASS** — verified 2026-05-04, command output was empty                                         |
| All file actions reachable from keyboard / toolbar            | (Walk: Open file via keyboard, New file via keyboard, Save-as via keyboard)                       | _PASS / FAIL_                                                                                   |
| `bundleCEF: true` confirmed in `packages/desktop/electrobun.config.ts` | Present on `mac`, `linux`, `win`                                                            | **PASS** — `grep -c "bundleCEF" packages/desktop/electrobun.config.ts` → 4 (const + 3 platforms) |
| `process.on("SIGTERM", ...)` flushes pending writes           | Present in `packages/desktop/src/bun/index.ts`                                                    | **PASS** — `grep -c 'process.on("SIGTERM"' packages/desktop/src/bun/index.ts` → 1                |

---

## Findings disposition summary

| Severity              | Count (initial) | Count (final, post-fix) | Action                                                                          |
| --------------------- | --------------- | ----------------------- | ------------------------------------------------------------------------------- |
| Critical              | 2 distinct rules (20+ instances of `aria-required-parent`, 5 of `scrollable-region-focusable`) | **0**                | All fixed in this plan (commit `db1934c`)                                       |
| Serious               | 7 distinct rules (color-contrast variants + focusable-content + focusable-element + aria-hidden-focus)             | **0**                | All fixed in this plan (commit `db1934c`); aria-hidden-focus excluded as a documented Radix false positive |
| Moderate              | 0               | 0                       | None                                                                            |
| Minor                 | 0               | 0                       | None                                                                            |
| Manual-checklist FAIL | (TBD)           | (TBD)                   | Each must be fixed before phase completion or filed as known-issue with explicit user acceptance |

---

## Audit sign-off

- [x] Automated suite ran successfully (zero critical/serious — 8 passed, 0 failed)
- [ ] Manual checklist completed by: _{name / date}_
- [ ] All FAIL rows in the manual checklist either fixed or documented as accepted
- [x] PACK-03 invariants verified (ApplicationMenu absent, bundleCEF on 3 platforms, SIGTERM handler present)
- [x] All three themes audited (dark, light, high-contrast)

**Final disposition:** Pass (automated) — Awaiting human checklist sign-off.

---

*Last updated: 2026-05-04*
*Phase: 05-packaging-distribution*
*Plan: 05-05-A11Y-AUDIT*
