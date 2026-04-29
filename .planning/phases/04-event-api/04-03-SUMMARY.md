---
phase: 04
plan: "03"
subsystem: renderer-ui + bun-process
tags: [event-api, zustand, websocket, rpc, ui-components, pulse-animation, toasts]
dependency_graph:
  requires: [04-01, 04-02]
  provides: [eventApiStore, toastStore, EventApiPill, IntegrationZone, EventToast, EventToastStack, applyEventBatch, liveEventMeta, useIsNodeLive, pushAllowlistFromStore, I-09-fix]
  affects: [App.tsx, StatusBar, SidePanel, RoadmapNode, WelcomeScreen, rpcHandlers, bun/index.ts]
tech_stack:
  added: []
  patterns:
    - "plain store.subscribe with manual prev-value tracking (no subscribeWithSelector — I-01)"
    - "applyEventBatch: single set() per batch, statusTick +1 once, no dataKey bump (PLUG-03 invariant)"
    - "useIsNodeLive: reads liveTick to force re-evaluation in 1Hz tick without dataKey touch"
    - "template-literal dynamic import with @vite-ignore to defeat Vite static analysis for future 04-04 store"
    - "JSON.parse(JSON.stringify()) deep-clone in tests to prevent in-place node mutation leaking between test cases"
key_files:
  created:
    - packages/desktop/src/mainview/store/eventApiStore.ts
    - packages/desktop/src/mainview/store/toastStore.ts
    - packages/desktop/src/mainview/components/EventApiPill.tsx
    - packages/desktop/src/mainview/components/IntegrationZone.tsx
    - packages/desktop/src/mainview/components/EventToast.tsx
    - packages/desktop/src/mainview/components/EventToastStack.tsx
    - packages/desktop/tests/unit/store/eventApiStore.test.ts
    - packages/desktop/tests/unit/store/toastStore.test.ts
    - packages/desktop/tests/unit/store/roadmapStore.applyEventBatch.test.ts
    - packages/desktop/tests/unit/store/roadmapStore.liveIndicator.test.ts
    - packages/desktop/tests/unit/ui/StatusBarEventPill.test.tsx
    - packages/desktop/tests/unit/ui/IntegrationZone.test.tsx
    - packages/desktop/tests/unit/ui/EventToast.test.tsx
  modified:
    - packages/desktop/src/mainview/store/roadmapStore.ts
    - packages/desktop/src/mainview/components/StatusBar.tsx
    - packages/desktop/src/mainview/components/WelcomeScreen.tsx
    - packages/desktop/src/mainview/components/SidePanel.tsx
    - packages/desktop/src/mainview/components/RoadmapNode.tsx
    - packages/desktop/src/mainview/index.css
    - packages/desktop/src/mainview/rpcHandlers.ts
    - packages/desktop/src/mainview/rpc.ts
    - packages/desktop/src/mainview/App.tsx
    - packages/desktop/src/bun/index.ts
    - packages/desktop/tests/integration/eventApi.test.ts
decisions:
  - "pushEventLog is a synchronous no-op stub (not async) — no dynamic imports needed, simpler than the other handlers (I-20 intentional wave-order compromise)"
  - "template-literal + @vite-ignore for eventLogStore dynamic import in EventApiPill to defeat Vite static analysis while keeping the import lazy"
  - "useIsNodeLive reads liveTick (not liveEventMeta directly) so it force-resubscribes every 1Hz tick without touching dataKey (PLUG-03 invariant)"
  - "loadFresh() deep-clone helper in applyEventBatch tests prevents in-place nodeIndex mutation leaking status changes between test cases"
  - "data-live={isLive ? 'true' : undefined} (not 'false') so CSS [data-live='true'] only matches live nodes"
  - "currentStatus/currentPort/currentErrorMessage tracking vars in bun/index.ts let onConnectionChange report correct server state alongside count (I-09 fix)"
  - "pushEventApiState initial push after mainWindow creation so EventApiPill reflects correct colour on first render"
metrics:
  duration: "~4 hours (across two sessions)"
  completed: "2026-04-28"
  tasks_completed: 6
  tasks_total: 6
  files_created: 13
  files_modified: 11
---

# Phase 04 Plan 03: Renderer UI Wiring + I-09 Fix Summary

Renderer-side stores, UI components, and full RPC pipeline for the Event API — eventApiStore/toastStore/applyEventBatch/liveEventMeta/useIsNodeLive, EventApiPill/IntegrationZone/EventToast/EventToastStack, pulse CSS, and I-09 fix upgrading Bun onError/onConnectionChange stubs to active rpc.send.pushEventApi* calls.

## Tasks Completed

| # | Name | Commit | Key Files |
|---|------|--------|-----------|
| 1 | eventApiStore + roadmapStore live slices | b986a1b | eventApiStore.ts, roadmapStore.ts (+applyEventBatch/liveEventMeta/useIsNodeLive) |
| 2 | EventApiPill + StatusBar + WelcomeScreen URL | 80b6956 | EventApiPill.tsx, StatusBar.tsx, WelcomeScreen.tsx |
| 3 | Pulse CSS + RoadmapNode data-live + 1Hz tick | 506ea5e | index.css, RoadmapNode.tsx, App.tsx |
| 4 | IntegrationZone + SidePanel insertion | f9eed23 | IntegrationZone.tsx, SidePanel.tsx |
| 5 | toastStore + EventToast + EventToastStack | c5a80b1 | toastStore.ts, EventToast.tsx, EventToastStack.tsx |
| 6 | RPC wiring + allowlist push + I-09 fix | 6da761d | rpc.ts, rpcHandlers.ts, App.tsx, bun/index.ts, eventApi.test.ts |

## Verification Results

- Tests: 399 passed, 0 failed (46 test files, 5 skipped)
- Typecheck: clean (tsc --noEmit, 0 errors)
- Lint: 0 errors on all plan-modified files (6 pre-existing warnings in !important CSS rules, not from this plan)
- Build: succeeds (vite build, 798 modules transformed)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed worktree base branch mismatch**
- Found during: Task 1 setup
- Issue: Worktree was based on master instead of the phase-04 feature branch (53565fd); in-progress changes were staged on wrong base
- Fix: `git reset --soft 53565fd` + stash/pop to rebase onto the correct phase-04 HEAD
- Files modified: N/A (git history fix)
- Commit: N/A

**2. [Rule 1 - Bug] Fixed Vite static import analysis crash for eventLogStore**
- Found during: Task 2 (EventApiPill)
- Issue: `import("../store/eventLogStore").catch(() => null)` caused Vite build error because Vite resolves dynamic imports statically and the module doesn't exist yet in Plan 04-03
- Fix: Used template-literal form with `/* @vite-ignore */` comment: `` import(`${storeDir}${moduleName}`) ``
- Files modified: EventApiPill.tsx
- Commit: 80b6956

**3. [Rule 1 - Bug] Fixed test isolation in applyEventBatch tests**
- Found during: Task 1 tests
- Issue: `applyEventBatch` mutates nodes in-place via `nodeIndex.get(u.nodeId).status = u.status`, so the const `TEST_SCHEMA` object's node statuses leaked between test cases
- Fix: Created `loadFresh()` helper using `JSON.parse(JSON.stringify(TEST_SCHEMA))` to deep-clone before each `loadSchema` call
- Files modified: roadmapStore.applyEventBatch.test.ts
- Commit: b986a1b

**4. [Rule 2 - Missing critical functionality] Added `@testing-library/jest-dom` import to UI tests**
- Found during: Tasks 2, 4, 5 (UI tests)
- Issue: Project has no global vitest setup file that imports jest-dom matchers; `toBeInTheDocument()` was undefined without the explicit import
- Fix: Added `import "@testing-library/jest-dom"` at top of each UI test file
- Files modified: StatusBarEventPill.test.tsx, IntegrationZone.test.tsx, EventToast.test.tsx
- Commit: 80b6956, f9eed23, c5a80b1

**5. [Rule 1 - Bug] Fixed biome lint errors in IntegrationZone.tsx**
- Found during: Task 4 verify
- Issue: `meta.source!` non-null assertion; `<a onClick>` without href; unused biome-ignore suppression
- Fix: Null-guard `if (meta.source) navigator.clipboard.writeText(meta.source)`; changed `<a>` to `<button type="button">`; removed unused suppression
- Files modified: IntegrationZone.tsx
- Commit: f9eed23

**6. [Rule 1 - Bug] Fixed biome lint errors in EventApiPill.tsx**
- Found during: Task 2 verify
- Issue: `div[role="button"]` interactive role on non-interactive element; unused biome-ignore suppressions
- Fix: Changed to `<button type="button">`; removed unused suppressions
- Files modified: EventApiPill.tsx
- Commit: 80b6956

**7. [Rule 1 - Bug] Fixed TypeScript TS18048 in rpc.ts**
- Found during: Task 6 typecheck
- Issue: `schema.statusConfig` typed as possibly `undefined` by tsc; `.map()` call failed type check
- Fix: `(schema.statusConfig ?? []).map((s) => s.id)`
- Files modified: rpc.ts
- Commit: 6da761d

**8. [Rule 2 - Missing critical functionality] Added initial pushEventApiState after mainWindow creation**
- Found during: Task 6 (I-09 fix review)
- Issue: Even with onConnectionChange upgraded, the renderer would only receive state on the first producer connect/disconnect; the initial server state (listening/error) was never sent to the renderer on startup
- Fix: Added `mainWindow.webview.rpc?.send.pushEventApiState(...)` immediately after `mainWindow` creation
- Files modified: bun/index.ts
- Commit: 6da761d

## Known Stubs

| Stub | File | Line | Reason |
|------|------|------|--------|
| `handlePushEventLog` no-op | rpcHandlers.ts | 73 | Plan 04-04 wires eventLogStore.appendEvents; intentional wave-order compromise (I-20) |
| Mini-history disclosure in IntegrationZone | IntegrationZone.tsx | ~140 | Plan 04-04 fills history list from eventLogStore; renders empty disclosure toggle |
| `getEventLogStore` dynamic import in EventApiPill | EventApiPill.tsx | ~20 | eventLogStore doesn't exist yet; import silently returns null; drawer open action is no-op until 04-04 |

## Self-Check: PASSED

All created/modified files verified:

- `packages/desktop/src/mainview/store/eventApiStore.ts` — FOUND
- `packages/desktop/src/mainview/store/toastStore.ts` — FOUND
- `packages/desktop/src/mainview/components/EventApiPill.tsx` — FOUND
- `packages/desktop/src/mainview/components/IntegrationZone.tsx` — FOUND
- `packages/desktop/src/mainview/components/EventToast.tsx` — FOUND
- `packages/desktop/src/mainview/components/EventToastStack.tsx` — FOUND
- Commits b986a1b, 80b6956, 506ea5e, f9eed23, c5a80b1, 6da761d — all present in git log
