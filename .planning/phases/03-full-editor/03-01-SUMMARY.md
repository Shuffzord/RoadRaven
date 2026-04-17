---
phase: 03-full-editor
plan: 01
subsystem: editor-foundation
tags: [store-mutations, clipboard, keyboard-router, inline-rename, confirmation-dialog, focus-ring, a11y]

requires:
  - phase: 02-read-only-viewer
    provides: Zustand roadmapStore base shape, RoadmapNode + Canvas, SidePanel read-only, Zod schema validation
  - phase: 00-app-scaffold
    provides: Electrobun two-process model, Vite + React scaffold
provides:
  - Zustand mutation action family (addChild, addSibling{Above,Below}, duplicateNode, requestDelete, moveNodeUp/Down, renameNode) — EDIT-02..EDIT-06, EDIT-08
  - Clipboard subtree serializer (copySubtreeToClipboard, pasteFromClipboard) — EDIT-05
  - Canvas-level keyboard router (useKeyboardRouter) — EDIT-01
  - Floating inline rename input + hook (useInlineRename + InlineRenameInput) — EDIT-07
  - Non-leaf delete confirmation dialog (ConfirmationDialog) — EDIT-03
  - Dashed focus ring that coexists with the solid selection ring
  - Large schema fixture (300 nodes) for Plan 02 / 04 perf tests
  - DevHarness stub (replaced by Plan 04a's full auto-discovery version)
  - MutationsPanel dev-harness panel (10 action buttons) for mid-plan UAT
affects: [03-02, 03-03, 03-04b, 03-04c]

tech-stack:
  added: []
  patterns:
    - "Structural mutations return new node IDs; in-place mutations return void"
    - "requestDelete distinguishes leaf vs non-leaf — leaf deletes immediately, non-leaf opens ConfirmationDialog with subtree count"
    - "Keyboard router at document level + Canvas-level onKeyDown for Escape deselect"
    - "Inline rename via floating input overlay positioned by getBoundingClientRect of the focused node"
    - "Clipboard serializer deep-clones via structuredClone, regenerates node IDs on paste to prevent collisions"
    - "Dashed focus ring (outline-dashed) layered over the solid selection ring so both states can coexist"

key-files:
  created:
    - packages/desktop/src/mainview/hooks/useKeyboardRouter.ts
    - packages/desktop/src/mainview/hooks/useInlineRename.ts
    - packages/desktop/src/mainview/components/InlineRenameInput.tsx
    - packages/desktop/src/mainview/components/ConfirmationDialog.tsx
    - packages/desktop/src/mainview/store/clipboard.ts
    - packages/desktop/src/renderer/components/_dev/MutationsPanel.tsx
    - packages/desktop/tests/fixtures/basic-schema.json
    - packages/desktop/tests/fixtures/large-schema.json
    - packages/desktop/tests/unit/hooks/useKeyboardRouter.test.ts
    - packages/desktop/tests/unit/hooks/useInlineRename.test.ts
    - packages/desktop/tests/unit/store/clipboard.test.ts
    - packages/desktop/tests/unit/store/roadmapStore.mutations.test.ts
    - packages/desktop/tests/unit/ui/ConfirmationDialog.test.tsx
  modified:
    - packages/desktop/src/mainview/store/roadmapStore.ts
    - packages/desktop/src/mainview/components/Canvas.tsx
    - packages/desktop/src/mainview/components/RoadmapNode.tsx
    - packages/desktop/src/mainview/App.tsx
    - packages/desktop/src/mainview/index.css

key-decisions:
  - "DevHarness.tsx landed as a minimal stub in Plan 01 to unblock vite build while Plan 04a ran in parallel; the full auto-discovery version from 04a replaces the stub on merge"
  - "Clipboard regenerates node IDs on paste via structuredClone + crypto.randomUUID to avoid collisions with the existing tree"
  - "requestDelete is the single public entry point — it internally decides whether to delete immediately (leaf) or open a confirmation modal (non-leaf). Components don't need to branch on node shape."
  - "Canvas gets tabIndex={0} because role=\"application\" requires the element to participate in tab order for onKeyDown to fire; biome-ignore documents this since the rule doesn't recognize role=application as interactive"

patterns-established:
  - "Structural mutations (add/move/duplicate/delete) always go through the store and never touch the tree in components"
  - "Floating-input overlay pattern: hook owns position + value, component is presentational — enables reuse for future metadata editors"
  - "Subtree serialization via structuredClone + ID regeneration — becomes the copy/paste primitive for Plan 03's metadata editor too"

requirements-completed: [EDIT-01, EDIT-02, EDIT-03, EDIT-04, EDIT-05, EDIT-06, EDIT-07, EDIT-08]

duration: ~recovery
completed: 2026-04-17
---

# Phase 3 Plan 01: Editor Foundation Summary

**Store mutation family, canvas keyboard router, inline rename overlay, non-leaf delete confirmation, clipboard subtree serializer, and the dashed focus ring — the editor primitives that every Wave 2 plan builds on.**

## Performance

- **Duration:** Recovered from prior worktree execution (agent-ac95cc2b, 4 automated commits) + one follow-up commit for Task 5 and the a11y fix.
- **Tasks automated:** 6 of 8 (Tasks 6 & 7 are checkpoint:human-verify)
- **Tests:** 217 passing across 25 test files after merge (from 147 pre-Phase-3 baseline; +70 new tests from this plan)
- **Files created:** 13 | **Files modified:** 5

## Accomplishments

### Task 0 — Wave-0 test scaffolding + fixtures (TDD RED)
Added failing tests for every action Plan 01 implements, plus `basic-schema.json` and a 300-node `large-schema.json` fixture for downstream perf tests (Plan 02 context-menu 50ms render budget, Plan 04 autosave debounce).

### Task 1 — Store mutation actions (EDIT-02..EDIT-06, EDIT-08)
Implemented addChild, addSiblingAbove/Below, duplicateNode, moveNodeUp/Down, renameNode, requestDelete on roadmapStore.

### Task 2 — Clipboard subtree serializer (EDIT-05)
`clipboard.ts` module + copySubtreeToClipboard / pasteFromClipboard store actions. Uses structuredClone and regenerates UUIDs on paste.

### Task 3 — Keyboard router + inline rename overlay (EDIT-01, EDIT-07)
useKeyboardRouter hook wires the canvas-level keydown handlers; useInlineRename + InlineRenameInput provide the floating edit-in-place UX. Added `__ROADRAVEN_TEST__` dev-only test hook in App.tsx for Plan 02's Playwright 50ms render-budget test.

### Task 4 — ConfirmationDialog for non-leaf delete (EDIT-03)
Presents "Delete node and N children?" when requestDelete targets a non-leaf; leaf deletes skip the dialog entirely.

### Task 5 — MutationsPanel dev-harness panel (recovery)
Exposes all 10 mutation actions as buttons. Auto-discovered by Plan 04a's DevHarness. Production bundle correctly strips the panel via the `import.meta.env.DEV` guard.

### A11y fix (recovery)
Added `biome-ignore` comment explaining why `tabIndex={0}` is required on the Canvas (role="application" is an interactive ARIA widget — tab-order participation is required for onKeyDown to fire).

## Deviations From Plan

- **DevHarness ownership swap with Plan 04a:** Plan 01 originally included a minimal DevHarness stub so `bunx vite build` would pass while Plan 04a ran in parallel in Wave 1. On merge, Plan 04a's full auto-discovery version replaced the stub as intended. Resolved the `add/add` merge conflict by taking the 04a version.
- **Recovery path:** The original 03-01 executor agent stopped after Task 4 (ConfirmationDialog). Tasks 5–7 were picked up after a clean worktree merge. Task 5 (MutationsPanel) was completed automatically; Tasks 6 and 7 are human-verify checkpoints awaited now.

## Remaining Work — Human Verification (Tasks 6, 7)

- **Task 6:** Mid-plan UAT — click through the MutationsPanel buttons in `bun run dev:hmr` and confirm every action mutates the tree as expected.
- **Task 7:** Full Plan 01 checkpoint — verify mutations + keyboard router + inline rename + confirmation dialog + clipboard all behave correctly end-to-end.

Both checkpoints are blocking before Wave 2 can begin.

## Self-Check

- [x] All automated tasks committed individually
- [x] `bun run test` — 217/217 passing
- [x] `bun x vite build` — production build clean
- [x] `bun x tsc --noEmit` — typecheck clean
- [x] biome lint — 0 errors (6 pre-existing warnings on index.css !important rules)
- [x] MutationsPanel stripped from production bundle
- [ ] Task 6 human UAT (awaiting user)
- [ ] Task 7 plan checkpoint (awaiting user)
