---
phase: 04-event-api
plan: 06
subsystem: ui
tags: [event-api, pulse-animation, css-pseudo-element, foreignobject, drawer-ux, keyboard-router, gap-closure]

# Dependency graph
requires:
  - phase: 04-event-api
    provides: "Event API server, EventApiPill, EventLogDrawer, IntegrationZone, useKeyboardRouter, eventLogStore (from plans 04-01..04-05)"
provides:
  - "Visible pulse ring on .node[data-live='true'] cards (UAT-1 fix) via .node::after pseudo-element painted inside the foreignObject clip rect"
  - "Per-theme --rv-pulse design token (8 themes) routing the animated border-color and reduced-motion fallback"
  - "Connected EventApiPill click opens the event log drawer (UAT-3 fix) via static useEventLogStore import"
  - "Discoverable [×] close button in every drawer render state (drive-by fix)"
  - "Escape-when-focus-inside-drawer closes the drawer; outside-focus Escape preserves Phase 3 deselect/cancel-rename semantics"
affects: [phase-04-reverify, phase-05-export, future-themes]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "CSS ::after pseudo-element with animated border-width as a foreignObject-safe alternative to outset box-shadow keyframes"
    - "Per-theme design token (--rv-pulse) for live-state visual feedback, decoupled from semantic status colors"
    - "Focus-containment Escape handler — branch on document.activeElement containment in a region selector before falling through to global handlers"
    - "Component-reuse pattern: single CloseButton declaration rendered in 4+ drawer branches via absolute-positioned anchor, no per-branch chrome restructuring"

key-files:
  created:
    - "packages/desktop/tests/unit/ui/RoadmapNodePulse.test.tsx (6 tests; 3 behavioral + 1 className + 2 CSS-contract regression guards)"
    - "packages/desktop/tests/unit/hooks/useKeyboardRouter.escape.test.tsx (2 behavioral focus-containment tests)"
  modified:
    - "packages/desktop/src/mainview/index.css (8 theme blocks + .node::after rule + reduced-motion fallback)"
    - "packages/desktop/src/mainview/components/EventApiPill.tsx (dynamic import → static import; connected-branch handler rewritten)"
    - "packages/desktop/src/mainview/components/EventLogDrawer.tsx (CloseButton component + 4 branch placements + collapsed-strip width adjustment)"
    - "packages/desktop/src/mainview/hooks/useKeyboardRouter.ts (new Escape branch with focus-containment check)"
    - "packages/desktop/tests/unit/ui/StatusBarEventPill.test.tsx (+1 connected-click test, 7 → 8)"
    - "packages/desktop/tests/unit/ui/EventLogDrawer.test.tsx (+4 close-path tests, 8 → 12)"

key-decisions:
  - "Repaint pulse via .node::after pseudo-element with animated border-width instead of outset box-shadow on the card — sidesteps Chromium/CEF foreignObject clipping bug"
  - "Introduce per-theme --rv-pulse design token rather than reusing --rv-status-completed-bg (which was 10% alpha green and visually invisible against both dark and light themes)"
  - "Router selector uses section[aria-label='Event log'] (implicit ARIA region role) instead of [role='region'][aria-label='Event log'] — biome flags the explicit role as redundant on <section>; semantically equivalent"
  - "Click-outside intentionally NOT added as a drawer-close mechanism — drawers are non-modal (mirrors VS Code panels); only [×] button + Escape-while-focused close the drawer"
  - "Inline boxShadow on RoadmapNode.tsx:120 preserved (was previously misdiagnosed as the bug) — provides static drop-shadow for all node cards; the animated ::after composes visually on top"

patterns-established:
  - "::after pseudo for live-state visual feedback — paintable inside foreignObject without clipping"
  - "Per-theme color tokens for state-indicator UI (live, alert, etc.) — decouples visual feedback from semantic status palette"
  - "Focus-containment branching in keyboard router — region-scoped Escape semantics that compose with global handlers via early-return"

requirements-completed: [PLUG-01, PLUG-04, PLUG-07]

# Metrics
duration: ~75min (Tasks 1+2 automated execution, manual smoke run, post-checkpoint pulse-color fix, closure)
completed: 2026-04-29
---

# Phase 04 Plan 06: Event API UAT Gap Closure Summary

**Closed three UAT-confirmed major defects (pulse invisible, connected-pill click no-op, drawer un-closeable) by repainting the pulse via a foreignObject-safe ::after pseudo-element with a new per-theme --rv-pulse token, statically importing the event log store in EventApiPill, and adding a discoverable [×] close button + focus-containment Escape handler.**

## Performance

- **Duration:** ~75 min (Tasks 1+2 automated, ~30 min manual smoke + post-smoke pulse-color fix)
- **Started:** 2026-04-28T18:30:00Z
- **Completed:** 2026-04-29T00:00:00Z
- **Tasks:** 3 of 3 (Task 1 auto, Task 2 auto, Task 3 human-verify gate)
- **Files modified:** 6 source/test files + 2 test files created

## Accomplishments
- UAT-1 (pulse animation invisible) — closed via .node::after with animated border-width + new --rv-pulse token
- UAT-3 (connected pill click does not open drawer) — closed via static import + setOpen(true) in connected branch
- UAT drive-by (drawer cannot be closed) — closed via [×] CloseButton in 4 drawer render branches + Escape-when-focus-inside handler
- Phase 3 keyboard contract (rename-cancel + deselect-node on Escape) preserved and verified by behavioral test
- Test count: 438 → 451 desktop tests (+13 net), 19/19 plugin tests, full build clean, biome 0 new warnings

## Task Commits

Each task committed atomically:

1. **Task 1: Pulse repaint via .node::after pseudo-element + 6 regression-guard tests** — `a1357db` (fix)
2. **Task 2: Static-import EventApiPill + CloseButton + Escape focus-containment + 7 new tests** — `06994f6` (fix)
3. **Task 3 post-checkpoint: --rv-pulse per-theme token (UAT-1 visibility fix after manual smoke)** — `24818ae` (fix)

_Note: Task 3 itself is a verification gate (no source modifications); the post-checkpoint --rv-pulse commit was applied by the orchestrator after the manual smoke surfaced that the original --rv-status-completed-bg token (10% alpha) made the now-correctly-painted ring invisible._

**Plan metadata commit (this SUMMARY + UAT update):** see closing commit below.

## Files Created/Modified

- `packages/desktop/src/mainview/index.css` — Replaced box-shadow keyframe with .node::after rule; added 8 per-theme --rv-pulse tokens; reduced-motion fallback rewired to ::after
- `packages/desktop/src/mainview/components/EventApiPill.tsx` — Removed @vite-ignore dynamic-import workaround; static import of useEventLogStore; connected-branch handleClick now calls useEventLogStore.getState().setOpen(true)
- `packages/desktop/src/mainview/components/EventLogDrawer.tsx` — Added CloseButton component (aria-label="Close event log"); rendered in EmptyDrawer / collapsed-strip / filtered-empty / full-list branches; collapsed-strip expand-button width set to calc(100% - 32px) + paddingRight: 32 to reserve space
- `packages/desktop/src/mainview/hooks/useKeyboardRouter.ts` — New Escape branch BEFORE rename-cancel/deselect; focus-containment check via `section[aria-label="Event log"]` selector; returns early when focus is inside an open drawer
- `packages/desktop/tests/unit/ui/RoadmapNodePulse.test.tsx` (NEW) — 6 tests (3 data-live behavioral, 1 className-positioning-context, 2 CSS-contract regression guards on index.css)
- `packages/desktop/tests/unit/hooks/useKeyboardRouter.escape.test.tsx` (NEW) — 2 behavioral focus-containment tests (inside-drawer Escape closes; outside-drawer Escape falls through to deselect)
- `packages/desktop/tests/unit/ui/StatusBarEventPill.test.tsx` — +1 connected-click-opens-drawer test (7 → 8 tests)
- `packages/desktop/tests/unit/ui/EventLogDrawer.test.tsx` — +4 close-path tests (8 → 12 tests)

## Decisions Made

- **Repaint pulse via ::after pseudo-element** — Original outset box-shadow ring was clipped by Chromium/CEF foreignObject content-box despite `overflow="visible"` SVG attribute. Pseudo-element with `position: absolute; inset: -3px` + `border-width` keyframe paints inside the card's stacking context, well within the foreignObject's ≤10px horizontal / ≤22px vertical clearance for a ~220×55 card in a 240×100 frame.
- **Per-theme --rv-pulse token** — Reusing --rv-status-completed-bg (10% alpha green) made the ring visually invisible against both dark and light themes. New token is a hand-picked saturated color per theme (8 themes total), routed through both the animated keyframe border-color and the reduced-motion static fallback.
- **`section[aria-label="Event log"]` selector for the router** — biome lint flags an explicit `role="region"` on a `<section>` element as redundant; the `<section>` element carries the implicit ARIA region role natively. Selector is semantically equivalent and lint-clean.
- **Click-outside is NOT a drawer-close trigger** — drawers are non-modal; canvas clicks should not destroy drawer state. Mirrors VS Code panel UX. Only [×] button + Escape-while-focused close the drawer.
- **Inline `boxShadow: "var(--rv-shadow-node)"` on RoadmapNode.tsx:120 preserved** — Previous plan iteration misdiagnosed it as shadowing the keyframe; per CSS Animations spec an active animation outranks inline styles on the animated property. The static drop-shadow remains; the ::after ring composes on top.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Router selector contract mismatch**
- **Found during:** Task 2 (Sub-edit C — useKeyboardRouter Escape branch)
- **Issue:** Plan specified `[role="region"][aria-label="Event log"]` but the rendered DOM uses a `<section>` element without an explicit `role` attribute. biome lint also flags explicit `role="region"` on a `<section>` as redundant. The selector resolved to null at runtime, so the focus-containment check would never trigger inside-drawer Escape.
- **Fix:** Switched the router selector to `section[aria-label="Event log"]` — semantically equivalent (the section element carries the implicit ARIA region role natively), matches the actual DOM, and satisfies biome.
- **Files modified:** `packages/desktop/src/mainview/hooks/useKeyboardRouter.ts`
- **Verification:** Behavioral tests in `useKeyboardRouter.escape.test.tsx` (inside-drawer focus → drawer closes; outside-drawer focus → deselect fall-through fires) both pass.
- **Committed in:** 06994f6 (Task 2 commit)

**2. [Rule 1 - Bug] Pulse ring invisible due to wrong color token (post-checkpoint)**
- **Found during:** Task 3 (manual smoke step (d))
- **Issue:** The original UAT-1 root-cause theory — that Chromium/CEF foreignObject clips outset `box-shadow` from descendants — was the wrong diagnosis. Manual diagnosis with a temporary bright-red border on the `::after` pseudo confirmed the pseudo-element renders fine within the foreignObject; the actual bug was that `--rv-status-completed-bg` (the chosen token) is a 10% alpha green that is visually invisible against both dark and light themes. The "clipping" theory was a confounder — the ring was being painted, just in a near-transparent color.
- **Fix:** Introduced a per-theme `--rv-pulse` token across all 8 theme blocks (lines 125, 190, 255, 323, 401, 474, 554, 632 in index.css) with hand-picked saturated colors. Both the animated keyframe border-color and the reduced-motion static fallback now route through `--rv-pulse`. Pulse-test CSS-contract assertion updated to match the new token.
- **Files modified:** `packages/desktop/src/mainview/index.css`, `packages/desktop/tests/unit/ui/RoadmapNodePulse.test.tsx`
- **Verification:** Manual smoke step (d) PASS confirmed by user; reduced-motion fallback step (i) PASS; all 6 RoadmapNodePulse tests still green.
- **Committed in:** 24818ae (post-checkpoint orchestrator fix)

---

**Total deviations:** 2 auto-fixed (2 bug fixes — both Rule 1, both essential for the plan to actually close its UAT items)
**Impact on plan:** Both auto-fixes were essential. Without #1 the router-side close path would have been a dead branch; without #2 UAT-1 step (d) would have failed the gating manual smoke. No scope creep.

## Manual Smoke Checklist (Task 3, Human-Loop Gating)

| Step | Description | Result | Notes |
|------|-------------|--------|-------|
| a | `bun run dev:hmr` launches the app | PASS | App started cleanly |
| b | Open `samples/gsd-roadmap.json` | PASS | Sample roadmap loaded |
| c | Send happy-path event via wscat | PASS | Hello + event frame accepted; node updated |
| **d (GATING)** | Animated pulse ring visible on node card (UAT-1) | **PASS** | Ring visible after 24818ae --rv-pulse fix; user confirmed |
| e | Click connected pill (`● :47921 · 1`) opens drawer (UAT-3) | PASS | Drawer opens correctly. (See "New Finding" below — separate display-count bug observed; UAT-3 contract itself passes.) |
| f | [×] close button visible in top-right + click closes (drive-by) | PASS | Close affordance discoverable + functional |
| g | Re-open drawer, click inside, Escape → drawer closes (drive-by part 2) | PASS | Inside-drawer Escape closes |
| h | Re-open drawer, click on canvas, Escape → drawer stays open + node deselects (Phase 3 contract preserved) | PASS | Outside-drawer Escape preserves Phase 3 fall-through |
| **i (GATING)** | Reduced-motion ON → pulse becomes static 2px solid green border (no animation) | **PASS** | Reduced-motion fallback intact via --rv-pulse |

**Both gating steps (d) and (i) PASS. Plan 04-06 manual smoke approved by user 2026-04-29.**

## Issues Encountered

- **Original root-cause theory for UAT-1 was wrong** — The plan blamed Chromium/CEF foreignObject clipping of outset `box-shadow` (originally), then the inline `boxShadow` style on RoadmapNode.tsx (in an earlier iteration). Both theories were red herrings: the inline-shadow theory contradicts the CSS Animations spec (active animations outrank inline styles on the animated property), and the clipping theory was disproven by a diagnostic bright-red border experiment that confirmed the ::after pseudo paints fine inside the foreignObject. The actual root cause was a near-transparent color token (10% alpha green). Lesson: when a "visible" CSS effect doesn't appear, verify the painted color contrast before re-architecting the paint mechanism.

## Test Counts

| Suite | Before | After | Delta |
|-------|--------|-------|-------|
| Desktop (vitest) | 438 | 451 | +13 |
| Plugin (claude-code) | 19 | 19 | unchanged |
| Typecheck | clean | clean | — |
| Build (vite) | clean | clean | — |
| Biome lint | 5 pre-existing warnings | 5 (no new) | — |

## New Finding (Out of Scope — Logged for Follow-up)

During manual smoke step (e), the user observed an unexpected secondary bug separate from the UAT-3 contract under test:

> Producer count in the EventApiPill shows `3` (sometimes briefly jumps to `4`) when only `wscat` should be the sole connected producer.

The UAT-3 contract under test in step (e) — clicking the connected pill opens the drawer — passes correctly. This count display bug is a NEW finding, not a regression of UAT-3.

**Diagnosis (per orchestrator analysis, NOT fixed in this plan):**
- **Baseline overhead (steady state of 3):** `plugins/claude-code/src/server.ts:9` opens a `wsClient` at module top-level. Every Claude Code session that has the claude-code MCP server enabled holds its own persistent WS connection. Observed count = wscat (1) + each running Claude Code session (1+ each).
- **Brief overshoot to 4 (transient):** `plugins/claude-code/src/wsClient.ts:55-65` — the `close` event handler unconditionally fires `scheduleReconnect()`, including for sockets that never opened. When a failed handshake fires `error` then `close`, the `error` resolves the `connectOnce` promise → `connectLoop`'s while iteration retries; meanwhile the `close` handler schedules ANOTHER `connectLoop` via setTimeout. Two parallel `connectLoop`s race, transiently creating multiple sockets before settling.

This finding has been logged in `04-HUMAN-UAT.md` as a separate `issue` entry. Suggested follow-up scope (NOT for this plan):
1. wsClient retry race fix — guard `scheduleReconnect` against firing for sockets that never opened, with a regression test.
2. UX decision — whether the displayed producer count should subtract self-connections (Claude Code sessions hosting the MCP wrapper) so the user sees only "external" producers.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Three target UAT defects (pulse, connected-pill click, drawer close) are CLOSED and verified by user manual smoke 2026-04-29.
- `bun run verify` gates all PASS.
- Phase 4 ready for `/gsd-verify-phase 4 --reverify` to update `04-VERIFICATION.md` from `27/27 verified, 5 human_needed` to `30/30 verified, 2 human_needed` (remaining human-needed items: MCP end-to-end + welcome-screen URL copy, both already PASS in original UAT).
- New finding (producer count display bug) is logged in 04-HUMAN-UAT.md but does NOT block this plan or phase closure — it is a separately-scoped follow-up affecting the wsClient and the count-display UX.

---
*Phase: 04-event-api*
*Completed: 2026-04-29*
