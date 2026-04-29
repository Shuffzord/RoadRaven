---
phase: 04
plan: 04
subsystem: desktop-renderer
tags: [event-log, drawer, virtualization, filter, keyboard-shortcut, stub-replace]
dependency_graph:
  requires: [04-01, 04-02, 04-03]
  provides: [eventLogStore, EventLogDrawer, EventLogRow, EventLogFilterBar, Ctrl+Shift+L, IntegrationZone-mini-history]
  affects: [TopBar, useKeyboardRouter, rpcHandlers, App]
tech_stack:
  added: ["@tanstack/react-virtual (useVirtualizer)", "useMemo for stable derived state"]
  patterns: ["EMPTY_STATUS_CONFIG stable ref (prevents Zustand selector infinite loop)", "useMemo over inline selector (same pattern)", "vi.mock(@tanstack/react-virtual) for jsdom test isolation"]
key_files:
  created:
    - packages/desktop/src/mainview/store/eventLogStore.ts
    - packages/desktop/src/mainview/components/EventLogDrawer.tsx
    - packages/desktop/src/mainview/components/EventLogRow.tsx
    - packages/desktop/src/mainview/components/EventLogFilterBar.tsx
    - packages/desktop/src/mainview/utils/formatRelative.ts
  modified:
    - packages/desktop/src/mainview/components/IntegrationZone.tsx
    - packages/desktop/src/mainview/components/TopBar.tsx
    - packages/desktop/src/mainview/hooks/useKeyboardRouter.ts
    - packages/desktop/src/mainview/rpcHandlers.ts
    - packages/desktop/src/mainview/App.tsx
    - packages/desktop/tests/unit/store/eventLogStore.test.ts
    - packages/desktop/tests/unit/ui/EventLogDrawer.test.tsx
    - packages/desktop/tests/unit/ui/EventLogFilterBar.test.tsx
    - packages/desktop/tests/unit/ui/IntegrationZone.test.tsx
    - packages/desktop/tests/unit/hooks/useKeyboardRouter.drawer.test.ts
    - packages/desktop/tests/integration/eventLog-selection.test.ts
decisions:
  - "useMemo over inline Zustand selector for derived array (prevents getSnapshot infinite loop — same root cause as EMPTY_STATUS_CONFIG pattern)"
  - "vi.mock(@tanstack/react-virtual) in jsdom to prevent ResizeObserver-driven measurement storm"
  - "section aria-label over aside role=region (biome a11y: aside already has landmark role)"
  - "li over div role=listitem (biome a11y: use semantic elements)"
  - "I-11 resolution: setSelectedNode triggers Canvas.tsx lines 141-143 auto-pan — no new camera action needed"
  - "T-04-04-04: selectedNodeOnly && selectedNodeId===null returns [] not all rows"
metrics:
  duration: "~90 minutes (across 2 sessions)"
  completed: "2026-04-28"
  tasks_completed: 4
  files_changed: 16
  tests_added: 38
---

# Phase 04 Plan 04: Event Log Drawer Summary

Bottom event-log drawer with virtualized rows, filter bar, Ctrl+Shift+L keyboard toggle, TopBar Events button, and IntegrationZone mini-history wiring — all backed by `eventLogStore` with a 1000-row sliding cap.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | eventLogStore + 18 unit tests | 8154499 | eventLogStore.ts, eventLogStore.test.ts |
| 2 | EventLogRow + EventLogDrawer + formatRelative + stub replacements | 5a6a07e | EventLogRow.tsx, EventLogDrawer.tsx, EventLogFilterBar.tsx, formatRelative.ts, rpcHandlers.ts, App.tsx, EventLogDrawer.test.tsx, eventLog-selection.test.ts |
| 3 | Ctrl+Shift+L shortcut + TopBar Events button + filter bar tests | 0ec7d58 | useKeyboardRouter.ts, TopBar.tsx, EventLogFilterBar.test.tsx, useKeyboardRouter.drawer.test.ts |
| 4 | IntegrationZone mini-history + Open full log wiring | 42c962a | IntegrationZone.tsx, IntegrationZone.test.tsx |

## Verification

- 51 test files, 438 tests — all pass
- Biome check: 0 errors on all plan source files
- No stubs remaining in this plan's scope

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Zustand selector infinite loop — inline array creation**
- **Found during:** Task 2 (EventLogFilterBar) and Task 4 (IntegrationZone)
- **Issue:** Selectors returning `?? []` or `.filter().slice().reverse()` created new array references on every snapshot check, triggering React's "getSnapshot should be cached" guard and causing "Maximum update depth exceeded"
- **Fix:** Task 2: extracted `const EMPTY_STATUS_CONFIG: StatusConfig[] = []` as stable module-level constant. Task 4: used `const allRows = useEventLogStore((s) => s.rows)` (stable ref) + `useMemo` to derive filtered slice
- **Files modified:** EventLogFilterBar.tsx, IntegrationZone.tsx
- **Commits:** 5a6a07e, 42c962a

**2. [Rule 1 - Bug] useVirtualizer jsdom infinite loop**
- **Found during:** Task 2 (EventLogDrawer.test.tsx)
- **Issue:** `@tanstack/react-virtual` triggers ResizeObserver measurement loop in jsdom with no real layout engine
- **Fix:** `vi.mock("@tanstack/react-virtual")` returning a synthetic virtualizer that limits items to min(count, 30) without ResizeObserver
- **Files modified:** EventLogDrawer.test.tsx
- **Commit:** 5a6a07e

**3. [Rule 2 - A11y] Biome accessibility errors on aside/div semantics**
- **Found during:** Task 2 (EventLogDrawer.tsx, EventLogRow.tsx)
- **Issue:** `<aside role="region">` (aside already has landmark), `<div role="listitem">` (use li), collapsed strip `onClick` on non-interactive div
- **Fix:** Changed to `<section aria-label="Event log">`, `<li style={{listStyle:"none"}}>`, `<button type="button">` inside section for collapsed strip
- **Files modified:** EventLogDrawer.tsx, EventLogRow.tsx
- **Commit:** 5a6a07e

**4. [Rule 1 - Bug] returnToParent optional chain biome warning**
- **Found during:** Task 3 (useKeyboardRouter.ts)
- **Issue:** `if (!found || !found.parent)` should use optional chain per biome `useOptionalChain`
- **Fix:** Changed to `if (!found?.parent)`
- **Files modified:** useKeyboardRouter.ts
- **Commit:** 0ec7d58

**5. [Rule 1 - Bug] r.t field reference (wrong shape)**
- **Found during:** Task 4 (IntegrationZone.tsx)
- **Issue:** Old stub used `r.t` but `IntegrationEvent` uses `r.timestamp`
- **Fix:** Changed to `r.timestamp`
- **Files modified:** IntegrationZone.tsx
- **Commit:** 42c962a

## Known Stubs

None — all Plan 04-04 stubs replaced. The `EventApiPill` drawer action was wired via `setOpen(true)` in the "Open full log" button.

## Self-Check: PASSED

All 5 key files exist on disk. All 4 task commits verified in git log (8154499, 5a6a07e, 0ec7d58, 42c962a). 438 tests passing across 51 test files.
