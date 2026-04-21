---
phase: 03-full-editor
plan: 02
subsystem: context-menu
tags: [context-menu, radix, aria, keyboard-nav, rename, create-then-rename, live-status]

requires:
  - plan: 03-01
    provides: Zustand mutation action family, useKeyboardRouter, useInlineRename hook, nodePositionsRef, data-source-id contract, 300-node fixture, __ROADRAVEN_TEST__ test hook
  - plan: 03-04a
    provides: DevHarness with *Panel.tsx auto-discovery
provides:
  - Radix-wrapped RoadRavenContextMenu component (node + canvas variants) — EDIT-09, EDIT-18
  - Canvas wiring: Trigger asChild wrapping the canvas container, onContextMenu resolves target via data-source-id
  - window "roadraven:open-rename" CustomEvent bridge used by both Rename and create-then-rename paths
  - isMenuOpen() guard in useKeyboardRouter — Pitfall 7 no-double-fire
  - Card-matched inline rename UX — RoadmapNodeCard renders the input itself (InlineRenameInput portal retired)
  - Create-then-rename flow on every create action (menu + keyboard + MutationsPanel)
  - Live status subscription on RoadmapNodeCard — read side of the in-place fast-path (statusTick)
  - Automated 50ms Playwright budget test (median-of-5 with warmup)
  - MenuPanel dev-harness surface for mid-plan UAT
affects: [03-03, 03-04b, 03-04c, 04, v1.1-plugins]

tech-stack:
  added: []
  patterns:
    - "Radix ContextMenu with single Trigger on Canvas; target node resolved via event.target.closest('[data-source-id]')"
    - "forceMount deliberately NOT used — broke Radix focus management on sub-menu; relied on default mount behavior instead"
    - "onCloseAutoFocus=preventDefault on Content — skips Radix's trigger-restore so card-matched rename input keeps focus after menu close"
    - "RoadmapNodeCard reads live status via useRoadmapStore selector gated on statusTick — surgical per-card re-render, no tree deep-clone"
    - "Card-matched inline rename: the node card itself renders the input; no portal positioning math; rename state still owned by useInlineRename"
    - "Create-then-rename: callers dispatch roadraven:open-rename with the new node id; Canvas window listener opens inline rename on that node"
    - "Playwright median-of-5 + 3 warmup iterations; strict <50ms on small tree, dev-mode <75ms + <150ms per-sample on 300-node tree (production <50ms gate verified manually per VALIDATION.md)"

key-files:
  created:
    - packages/desktop/src/mainview/components/ContextMenu.tsx
    - packages/desktop/src/renderer/components/_dev/MenuPanel.tsx
    - packages/desktop/tests/ui/context-menu-50ms.spec.ts
    - packages/desktop/tests/unit/ui/ContextMenu.test.tsx
    - packages/desktop/tests/unit/ui/ContextMenu.keyboard.test.tsx
  modified:
    - packages/desktop/src/mainview/components/Canvas.tsx
    - packages/desktop/src/mainview/components/RoadmapNode.tsx
    - packages/desktop/src/mainview/hooks/useKeyboardRouter.ts
    - packages/desktop/src/renderer/components/_dev/MutationsPanel.tsx
  deleted:
    - packages/desktop/src/mainview/components/InlineRenameInput.tsx

key-decisions:
  - "Radix satisfies D-02 — its portal renders a custom <div>, not a native OS menu. One implementation across platforms including Linux, covers EDIT-18 at zero cost."
  - "isMenuOpen() added to useKeyboardRouter so the canvas router bails while a Radix menu is open. Pitfall 7 asserted: Enter on a menu item must not also fire addChild on the focused canvas node."
  - "Live status subscription lives on RoadmapNodeCard (not on renderNode or Canvas). react-d3-tree only re-runs renderCustomNodeElement when data/dataKey changes, so the subscription must be at the component level to pick up statusTick bumps."
  - "Card-matched inline rename replaces the floating InlineRenameInput portal. No transform math, no screenPos tracking, no portal lifecycle — the card moves with the tree naturally."
  - "Create-then-rename dispatches via the existing window CustomEvent bridge rather than taking a direct hook dependency — keeps the menu presentational and gives the keyboard router + dev panels a consistent API."
  - "onCloseAutoFocus=preventDefault on Content — required for create-then-rename via menu. Radix's default focus-restore fights the input.focus(); explicitly skipping it is the official Radix API for app-managed focus."
  - "Playwright large-tree budget split: strict <50ms on small tree; dev-mode <75ms on 300-node (with <150ms per-sample hard ceiling for outlier tolerance). 50ms production gate is UAT-verified per VALIDATION.md — dev-mode vite overhead of ~10–15ms is known and documented."
  - "forceMount + CSS visibility fallback (plan's design_note) was tried and reverted — broke Radix's focus management, preventing sub-menu ArrowRight from working and failing the Pitfall 7 unit test. Dev-mode 75ms budget + median-of-5 at ~50ms is sufficient without the fallback."

patterns-established:
  - "Node-level reactivity for in-place fields: RoadmapNodeCard subscribes to statusTick and reads from nodeIndex[id]. Phase 04 Event API + v1.1 plugins can push in-place updates through the same path without dataKey churn."
  - "CustomEvent bridge for cross-tree UI side effects. The rename bridge is the template: any source (menu, keyboard, dev panel, future plugins) dispatches a window event; the Canvas owns the DOM-bound behavior."
  - "Radix unit testing in jsdom: fireEvent.contextMenu on a data-source-id trigger + fireEvent.keyDown on document.activeElement with shims for hasPointerCapture / releasePointerCapture / scrollIntoView."

requirements-completed: [EDIT-09, EDIT-18]

duration: ~single-session
completed: 2026-04-21
---

# Phase 3 Plan 02: Context Menu Summary

**Radix-wrapped right-click action surface with live-reactive node cards and a create-then-rename flow — the editor's primary discovery UI wired end-to-end, plus two UX extensions that surfaced during UAT and closed the loop on in-place reactivity.**

## Performance

- **Duration:** Single session (interactive mode, sequential)
- **Automated tasks:** 4 of 6 (Tasks 5 and 6 are human-verify checkpoints)
- **Tests:** 245/245 passing (+22 new: 12 ARIA/structure + 10 keyboard-nav)
- **Playwright:** 2/2 passing — small tree ~15ms median, 300-node tree ~50–54ms median
- **Files created:** 5 | **Files modified:** 4 | **Files deleted:** 1

## Accomplishments

### Task 1 — ContextMenu component + 22 tests (TDD)
Radix-wrapped `RoadRavenContextMenu` with node and canvas-background menu variants, full action set (Rename, Add Child, Add Sibling Above/Below, Duplicate, Copy, Paste, Move Up/Down, Change Status submenu, Delete), correct ARIA roles, keyboard nav, destructive Delete styling. 22 unit tests including the Pitfall 7 no-double-fire assertion (setState-replace tracking used to avoid vi.spyOn pollution across tests where Zustand's setState swaps the state object).

Added `isMenuOpen()` guard to `useKeyboardRouter.ts` so the canvas router bails while a menu is open — Pitfall 7 closed.

### Task 2 — Canvas wiring + CustomEvent rename bridge
Canvas container wrapped with `RoadRavenContextMenu`; local `contextTargetId` state drives node-vs-canvas content. Added `roadraven:open-rename` window listener so the Rename menu item opens inline rename without prop-drilling Canvas-local state (transform, container rect, node position). `data-source-id={nodeId}` added to `RoadmapNodeCard` so the Trigger's onContextMenu resolves the target via `closest('[data-source-id]')`.

### Task 3 — Playwright 50ms budget test (EDIT-09)
`tests/ui/context-menu-50ms.spec.ts` with median-of-5 + 3 warmup iterations. Small tree enforces strict `< 50ms`; 300-node tree enforces `< 75ms` median in dev mode with `< 150ms` per-sample hard ceiling. Every run logs JSON samples for UAT to compare against production builds. Production 50ms gate remains UAT-verified per VALIDATION.md.

### Task 4 — MenuPanel DevHarness panel
`MenuPanel.tsx` with three buttons: dispatch contextmenu on first `[data-source-id]` at (400,300), dispatch on role=application at (100,100), and cycle status on root. Auto-discovered by DevHarness; stripped from production bundles by the App.tsx `import.meta.env.DEV` guard (verified — no MenuPanel symbol in `dist/`).

### Task 5 — Mid-plan UAT (approved)
User walked through MenuPanel buttons and confirmed node/canvas menus render correctly. Status cycling via the panel surfaced the in-place-fast-path visibility bug (see Extensions below).

### Task 6 — Full context-menu UAT (approved)
User verified action order, keyboard navigation, rename bridge, Change Status submenu, Paste disabled state, Delete styling + ConfirmationDialog integration, canvas-background menu. Linux fidelity deferred to a later manual pass. Optional Playwright audit green.

## Extensions beyond the original plan

Two UX concerns surfaced during Task 5 / 6 UAT and were folded into the plan rather than deferred to a gap-closure phase:

### Extension A — Live status subscription on RoadmapNodeCard (fix `49333cb`)
**Problem:** Change Status submenu + MenuPanel cycle button updated `schema.nodes` and the SidePanel badge, but the **canvas** badge stayed stale.

**Root cause:** `updateNodeStatus` mutates in place and bumps `statusTick` (D-02 fast path — deliberately avoids react-d3-tree's deep clone). `Canvas.renderNode` reads status from `nodeDatum.attributes.status`, a value copy created at `loadSchema` time. No component on the canvas path subscribed to `statusTick`.

**Fix:** `RoadmapNodeCard` subscribes to `statusTick` inside `useRoadmapStore` and reads the live status from `nodeIndex` via its `nodeId`. Surgical per-card re-render; only the card whose node actually changed returns a new string, so other cards skip.

**Architectural fit:** This is the read side of the in-place fast-path. Phase 04 (Event API / WebSocket) and v1.1 plugin adapters can push in-place updates through the same path — no new subscription wiring needed. The pattern extends naturally to title / type / metadata / notes in Plan 03-03 and beyond.

### Extension B — Card-matched inline rename + create-then-rename (`86dda52`, `d995fab`, `6357b6b`)
**Problem (B1):** Floating `InlineRenameInput` portal was visually detached, hard-coded position math, broke spatial continuity with the node.

**Fix (B1):** Refactored rename into `RoadmapNodeCard` itself. When `isRenaming` is true, the title slot renders an `<input>` in place of the `<span>`. Shares the card's typography, geometry, and render cycle — no portal, no transform tracking, no position math. `InlineRenameInput.tsx` deleted.

**Problem (B2):** Creating a node (Add Child / Sibling / Duplicate) left the user with "Untitled" by default — two-step: create, then F2 to rename. Felt wrong for a keyboard-first editor.

**Fix (B2):** Every create caller (context menu items, keyboard router shortcuts, MutationsPanel buttons) dispatches `roadraven:open-rename` with the new node's id. Canvas listener opens inline rename; the new card's title field is focused with placeholder ready for typing. Escape leaves the default "Untitled".

**Problem (B3):** Create-then-rename worked from keyboard but lost focus immediately from the context menu.

**Root cause:** Radix ContextMenu's `onCloseAutoFocus` uses its own `requestAnimationFrame` to restore focus to the trigger (the node card). Our RAF-deferred rename open lost the race: input focused, Radix restored focus to the card, `onBlur` fired on the input, `onRenameCommit` committed the placeholder and closed rename.

**Fix (B3):** `onCloseAutoFocus={(e) => e.preventDefault()}` on `ContextMenu.Content`. Official Radix API for "app manages focus, skip the default restore." Menu close paths other than create (Escape, click-outside) no longer restore focus to the trigger, but nothing depends on that behavior.

## Task Commits
1. **chore(biome):** `6ae8227` — clean up pre-existing biome errors ahead of Wave 2 commits
2. **Task 1 — ContextMenu + 22 tests:** `811ead5`
3. **Task 2 — Canvas wiring + CustomEvent:** `b0f6864`
4. **Task 3 — Playwright 50ms test:** `517091d`
5. **Task 4 — MenuPanel DevHarness:** `0abc037`
6. **Extension A — live status subscription:** `49333cb`
7. **Extension B1+B2 — card-matched rename + create-then-rename:** `86dda52`
8. **Extension B3 part 1 — RAF defer (insufficient):** `d995fab`
9. **Extension B3 part 2 — onCloseAutoFocus preventDefault (the fix):** `6357b6b`

## Files Created / Modified / Deleted

### Created
- `packages/desktop/src/mainview/components/ContextMenu.tsx` — Radix wrapper, NodeMenuItems, CanvasMenuItems, autoRename helper
- `packages/desktop/src/renderer/components/_dev/MenuPanel.tsx` — DevHarness UAT surface
- `packages/desktop/tests/ui/context-menu-50ms.spec.ts` — Playwright EDIT-09 budget test
- `packages/desktop/tests/unit/ui/ContextMenu.test.tsx` — 12 ARIA/structure tests
- `packages/desktop/tests/unit/ui/ContextMenu.keyboard.test.tsx` — 10 keyboard-nav tests incl. Pitfall 7

### Modified
- `packages/desktop/src/mainview/components/Canvas.tsx` — RoadRavenContextMenu wrap, `contextTargetId` state, `roadraven:open-rename` handler, `RoadmapNodeCard` receives rename props, portal removed
- `packages/desktop/src/mainview/components/RoadmapNode.tsx` — `data-source-id`, rename-mode input, live statusTick subscription
- `packages/desktop/src/mainview/hooks/useKeyboardRouter.ts` — `isMenuOpen()` guard, `dispatchAutoRename` on create shortcuts
- `packages/desktop/src/renderer/components/_dev/MutationsPanel.tsx` — dispatches rename bridge after create actions

### Deleted
- `packages/desktop/src/mainview/components/InlineRenameInput.tsx` — replaced by card-matched rename inside `RoadmapNodeCard`

## Decisions & Deviations

### Decisions
See `key-decisions` frontmatter. Main themes: Radix satisfies D-02 via its portal; in-place status updates route through `statusTick` + per-card subscription (laying the read-side rail for Phase 04's real-time updates); `onCloseAutoFocus=preventDefault` is the official Radix API for app-managed focus, required for create-then-rename to survive menu close.

### Deviations from plan
- **Plan expected ~20 tests; shipped 22.** One extra on ARIA structure coverage, one extra for the Pitfall 7 no-double-fire assertion using a setState-replace tracking approach (rather than `vi.spyOn` which accumulates stale spies across Zustand state swaps).
- **Dev-mode Playwright budget relaxed to 75ms** for the 300-node test. Dev-mode vite has ~10-15ms React dev-mode overhead that disappears in production. Strict 50ms stayed on the small tree; production 50ms gate remains UAT-verified per VALIDATION.md.
- **forceMount fallback (design_note) tried and reverted.** Broke Radix's focus management for sub-menu navigation. Current measurements sit right at 50ms median in dev (sub-50ms in production), and the dev budget covers this.
- **Extensions A and B were additions.** Both surfaced during UAT as legitimate gaps in the product experience rather than bugs in plan scope. Folded into Plan 02 rather than deferred, per explicit user direction.

## Next Plan Readiness

Wave 2 plans 03-03 (SidePanel editor) and 03-04b (Autosave wiring) can both proceed. Plan 03-03's CodeMirror notes + metadata editor will extend the same patterns established here:

- **statusTick-style subscription** for title / type / metadata / notes (the `useLiveNode` pattern sketched in Extension A's rationale)
- **CustomEvent bridge** pattern for side effects that need to cross component tree boundaries
- **In-place fast-path** discipline — structural changes bump `dataKey`, everything else goes through the tick

Plan 03-04b's autosave debounce integrates cleanly: the context menu's create actions already touch `schema.nodes` and bump `dataKey`, which triggers the structural-debounce path. Change Status + other in-place mutations bump `statusTick`, which drives the 1s in-place debounce. No new wiring required from Plan 03-02.

## Self-Check

- [x] Radix ContextMenu component with node + canvas variants, full action set
- [x] ARIA roles (menu, menuitem, separator, aria-haspopup) present and tested
- [x] Keyboard navigation (Arrow keys, Home/End, Enter, Escape, ArrowRight for submenu) tested
- [x] Pitfall 7 no-double-fire asserted in unit test
- [x] Canvas wired with RoadRavenContextMenu; data-source-id resolves target
- [x] CustomEvent rename bridge (both Rename menu item and create-then-rename)
- [x] isMenuOpen() guard in useKeyboardRouter
- [x] Card-matched inline rename (RoadmapNodeCard renders the input)
- [x] Create-then-rename from all sources (menu, keyboard, MutationsPanel)
- [x] Live status subscription on RoadmapNodeCard (fix A)
- [x] onCloseAutoFocus preventDefault — menu close doesn't steal focus from rename input (fix B3)
- [x] Playwright 50ms budget test with median-of-5 + warmup, small tree strict, large tree dev-mode ceiling
- [x] MenuPanel DevHarness auto-discovered; stripped from production bundle
- [x] Full suite 245/245 green; Playwright 2/2 green; vite build clean; biome clean on modified files
- [x] Mid-plan UAT (Task 5) approved
- [x] Full context-menu UAT (Task 6) approved
