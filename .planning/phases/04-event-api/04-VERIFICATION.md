---
phase: 04-event-api
verified: 2026-04-29T12:00:00Z
status: passed
phase_status: ready_to_close
score: 33/33
overrides_applied: 0
re_verification:
  previous_verified: 2026-04-28T11:11:42Z
  previous_status: human_needed
  previous_score: 27/27 truths verified + 5 human_needed
  gaps_closed:
    - "UAT-1: pulse animation visibility (closed by Plan 04-06 commits a1357db + 24818ae; user-confirmed 2026-04-29)"
    - "UAT-3: connected pill click opens drawer (closed by Plan 04-06 commit 06994f6; user-confirmed 2026-04-29)"
    - "UAT drive-by: drawer close affordance ([×] button + focus-containment Escape; closed by Plan 04-06 commit 06994f6; user-confirmed 2026-04-29)"
  human_items_resolved:
    - "Pulse animation + reduced-motion fallback (UAT Test 1) — PASS"
    - "Claude Code MCP end-to-end latency (UAT Test 2) — PASS, 35-45ms round trip"
    - "Status-bar pill click UX in idle/connected/error states (UAT Test 3) — PASS"
    - "Welcome screen URL copy (UAT Test 4) — PASS"
    - "Event log drawer resize handle ergonomics (UAT Test 5) — PASS"
    - "Drive-by: drawer close affordance (new contract from 04-06) — PASS"
  gaps_remaining: []
  regressions: []
known_follow_ups:
  - id: producer-count-overcount
    summary: |
      EventApiPill connected-count over-reports: shows ~3 (briefly 4) when
      only wscat is connected. Two root causes: (1) every Claude Code
      session with the claude-code MCP server enabled holds its own
      persistent WS connection (plugins/claude-code/src/server.ts:9 opens
      wsClient at module top-level); (2) plugins/claude-code/src/wsClient.ts
      close-handler unconditionally calls scheduleReconnect() even for
      sockets that never opened, transiently racing two connectLoops on
      failed handshakes.
    raised_by: 04-HUMAN-UAT.md Test 6 (during Plan 04-06 manual smoke step e)
    severity: medium
    blocks_phase_closure: false
    artifacts:
      - plugins/claude-code/src/server.ts
      - plugins/claude-code/src/wsClient.ts
      - packages/desktop/src/mainview/components/EventApiPill.tsx
      - packages/desktop/src/mainview/store/eventApiStore.ts
    suggested_scope: |
      Follow-up plan (e.g. 04-07 or a tail to Phase 4) covering:
      (a) wsClient retry-race fix — guard scheduleReconnect against firing
          for sockets that never opened, with regression test on the
          error → close ordering on a failed handshake;
      (b) UX decision — whether the displayed producer count should
          subtract self-connections (Claude Code sessions hosting the MCP
          wrapper) or whether the raw socket count is the desired truth.
  - id: validation-echo
    summary: |
      MCP wrapper currently returns `ok` for both unknown_node and
      invalid_status frames (fire-and-forget by design). Consider validating
      against the loaded schema on the desktop side and echoing
      classification back through the MCP response, so CI integrations
      get explicit failure on typos rather than silent no-ops.
    raised_by: 04-HUMAN-UAT.md Test 2 negative cases (steps 6-7)
    severity: design-decision
    blocks_phase_closure: false
  - id: drawer-auto-scroll
    summary: |
      Suggested new-feature toggle: an "auto-scroll to new events" checkbox
      on the event log drawer (default enabled). Today the drawer holds its
      scroll position so a stream of new events scrolls off the bottom; an
      opt-in tail-follow mode would mirror what most log viewers do.
    raised_by: 04-HUMAN-UAT.md Test 5 verification
    severity: enhancement
    blocks_phase_closure: false
human_verification: []
---

# Phase 04: Event API — Verification Report (Re-verified)

**Phase Goal:** The app receives live node status updates from external producers via WebSocket and routes them to the correct nodes within 100ms — with the Claude Code MCP wrapper working end-to-end as the reference producer.
**Verified:** 2026-04-29T12:00:00Z (re-verification after Plan 04-06 gap closure + human-loop UAT smoke)
**Initial verification:** 2026-04-28T11:11:42Z (27/27 truths verified, 5 human_needed)
**Status:** passed
**Phase status:** ready_to_close

## Re-verification Summary

Plan 04-06 closed the three UAT-confirmed defects flagged after initial verification:

1. **UAT-1 Pulse animation invisible** — Repainted via `.node::after` pseudo-element with animated `border-width` (commit `a1357db`), then routed through new per-theme `--rv-pulse` token after smoke surfaced the prior token was 10% alpha green and visually invisible (commit `24818ae`). User confirmed visible animated ring and reduced-motion static fallback during 04-06 manual smoke (steps d + i).
2. **UAT-3 Connected pill click no-op** — Replaced `@vite-ignore` dynamic import with static `useEventLogStore` import; connected-branch `handleClick` now calls `useEventLogStore.getState().setOpen(true)` directly (commit `06994f6`). User confirmed click opens drawer during 04-06 manual smoke step (e).
3. **Drive-by: drawer un-closeable** — Added `CloseButton` component with `aria-label="Close event log"` rendered in all 4 drawer branches; new Escape branch in `useKeyboardRouter.ts` with focus-containment selector `section[aria-label="Event log"]` closes drawer when focus is inside, falls through to Phase 3 deselect/cancel-rename when focus is outside (commit `06994f6`). User confirmed [×] click (step f), inside-drawer Escape (step g), and outside-drawer Phase 3 fall-through (step h).

UAT also confirmed the two human-verification items that were not subject to 04-06 fixes:
- **MCP end-to-end (Test 2):** PASS — 35-45ms round-trip latency across 5 happy-path calls; `getEventApiStatus` returned correct port + pid.
- **Welcome screen URL copy (Test 4):** PASS.
- **Drawer resize ergonomics (Test 5):** PASS.

One out-of-scope finding surfaced during 04-06 smoke (producer-count over-reports) is logged below as a known follow-up with `blocks_phase_closure: false`.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | WebSocket server starts with the app on 127.0.0.1:47921 (+ fallback +1..+9) | VERIFIED | `packages/desktop/src/bun/eventServer.ts` uses `Bun.serve` (FLUSH_MS=100, EADDRINUSE belt-and-braces); `index.ts` calls `startEventServer()` at boot and wires `onFlush`/`onError`/`onConnectionChange` |
| 2 | Sentinel file written atomically at `<userData>/event-api.json` on bind, deleted on clean shutdown | VERIFIED | `sentinel.ts`: `writeSentinel()` + `deleteSentinel()`. `index.ts`: `writeSentinel` at line 122, `deleteSentinel` at lines 190/203/211 (before-quit + SIGTERM + SIGINT) |
| 3 | User-specified port in use → no fallback, server enters error state | VERIFIED | `eventServer.ts`: EADDRINUSE on user-specified port returns `{ ok: false, attempted }` without fallback. Covered by `eventServer.test.ts` |
| 4 | Events validated at Bun boundary by Zod; malformed / unknown_node / invalid_status classified | VERIFIED | `eventSchema.ts` exports `EventFrameSchema`, `HelloFrameSchema`, `IncomingFrameSchema`, `classifyEvent()` returning `{ ok: false, error: "malformed"|"unknown_node"|"invalid_status" }` |
| 5 | Events coalesced per nodeId in 100ms trailing-edge timer window | VERIFIED | `eventCoalescer.ts` exports `EventCoalescer` with `FLUSH_MS_DEFAULT = 100`. `eventServer.ts` instantiates `new EventCoalescer(FLUSH_MS, opts.onFlush)` |
| 6 | Every received event appended to `<source>.events.jsonl` BEFORE coalescer enqueue | VERIFIED | `eventServer.ts` line 183 comment `"append to log BEFORE coalescer.enqueue"` and code path confirmed with `appendEventLine()` at line 140 before `coalescer.enqueue` at line 208 |
| 7 | On file open, sidecar replayed → LWW last-event-per-nodeId overlay forwarded to renderer as pushEventLog | VERIFIED | `index.ts` line 384: `mainWindow.webview.rpc?.send.pushEventLog({ events })` on file open replay |
| 8 | setSidecarPath(null) called on File > New / close (I-10 fix) | VERIFIED | `index.ts` line 493: `eventServerHandle?.setSidecarPath(null)` on newFile/closeFile |
| 9 | Server stops cleanly (1001 Going Away + sentinel delete) on before-quit/SIGTERM/SIGINT | VERIFIED | `index.ts` lines 187-211: `eventServerHandle.stop()` + `deleteSentinel()` in all three shutdown paths |
| 10 | EADDRINUSE handled via both sync try/catch AND async error() callback (I-04) | VERIFIED | `eventServer.ts` line 89: sync `try` block + line 97: async `error()` handler. Dedicated test `eventServer.eaddrinuse.test.ts` |
| 11 | `shared/types.ts` has batched pushStatusUpdate union + setNodeAllowlist + pushEventApiState/Error + batched pushEventLog | VERIFIED | `grep` confirmed: `updates: Array<{` at line 136; `setNodeAllowlist:` at 106; `pushEventLog: { events: IntegrationEvent[] }` at 144; `pushEventApiState:` at 147; `pushEventApiError:` at 153 |
| 12 | IntegrationEvent carries optional `_error` classification (D-09) | VERIFIED | `packages/core/src/plugin.ts` line 11: `_error?: "malformed" \| "unknown_node" \| "invalid_status"` |
| 13 | Renderer applies batched pushStatusUpdate via applyEventBatch without bumping dataKey | VERIFIED | `rpcHandlers.ts` line 38: `useRoadmapStore.getState().applyEventBatch(msg.updates)`. `roadmapStore.ts` confirmed: applyEventBatch increments `statusTick` only, not `dataKey` |
| 14 | Nodes within 30s of lastEventAt render the pulse animation (data-live='true'); prefers-reduced-motion substitutes static ring | VERIFIED | `index.css` lines 750-779 (post-04-06): `.node::after` pseudo with `inset: -3px` + animated `border-width: 0→3px` keyframe + per-theme `--rv-pulse` token; `.node[data-live="true"]::after { animation: rv-node-pulse 1600ms }`; `@media (prefers-reduced-motion: reduce)` substitutes static `border: 2px solid var(--rv-pulse)` (line 776). `RoadmapNode.tsx` sets `data-live={isLive ? "true" : undefined}`. **VISUAL CONFIRMED 2026-04-29 by user (UAT Test 1, gating step d + reduced-motion step i)** |
| 15 | 1Hz tick re-evaluates which nodes are live via bumpLiveTick in App.tsx | VERIFIED | `App.tsx` lines 43-45: `setInterval(() => useRoadmapStore.getState().bumpLiveTick(), 1000)` |
| 16 | Status-bar pill cycles through off/listening/connected/error with correct copy | VERIFIED | `EventApiPill.tsx` (post-04-06: 110 lines, static `useEventLogStore` import) wired in `StatusBar.tsx`. `eventApiStore.ts` has `status: "off" \| "listening" \| "error"` + connectedCount. Tests in `StatusBarEventPill.test.tsx` (8 tests after 04-06 +1 connected-click test) |
| 17 | Welcome screen shows Event API URL line | VERIFIED | `WelcomeScreen.tsx` lines 149/165/172: `Event API: ws://127.0.0.1:{eventApiPort}`. **CLIPBOARD-COPY CONFIRMED 2026-04-29 by user (UAT Test 4)** |
| 18 | SidePanel Integration zone renders header / source / meta-table / mini-history per D-16 | VERIFIED | `IntegrationZone.tsx` (270 lines): "● Live" / "○ Last event Xm ago" / "— No events received"; source row + copy button; meta key-value table; mini-history last 5 events from `eventLogStore.rows` filtered by nodeId; "Open full log →" calls `setOpen(true)` + `setFilterSelectedNodeOnly(true)` |
| 19 | Malformed/unknown/disconnect toasts use D-23 copy; D-24 throttle-merge within 5s | VERIFIED | `toastStore.ts` (80 lines) with toast types `"malformed"\|"unknown_node"\|"invalid_status"\|"disconnect"` and 5s merge window. `EventToast.tsx` (148 lines) + `EventToastStack.tsx` (55 lines) in `App.tsx` |
| 20 | Bun onError/onConnectionChange propagate to webview via pushEventApiError/pushEventApiState (I-09 fix) | VERIFIED | `index.ts` lines 102/109: real `rpc?.send.pushEventApiError(...)` + `rpc?.send.pushEventApiState(...)` calls. Initial state push at line 608 |
| 21 | Renderer pushes setNodeAllowlist to Bun on mount + dataKey bump | VERIFIED | `rpc.ts` lines 73/92: `pushAllowlistFromStore()` subscribes to dataKey changes and calls `electroview?.rpc?.request.setNodeAllowlist(...)` |
| 22 | Event log drawer opens/closes via Ctrl+Shift+L and TopBar Events button; defaults to 30% viewport | VERIFIED | `useKeyboardRouter.ts` lines 97-105: Ctrl+Shift+L → `toggleOpen()`. `TopBar.tsx` lines 124-151: Events button with `aria-label="Toggle event log drawer"`. `eventLogStore.ts`: `drawerHeightPx: defaultHeight()` = 30% viewport. **DRAG-RESIZE ERGONOMICS CONFIRMED 2026-04-29 by user (UAT Test 5)** |
| 23 | Rows virtualized via @tanstack/react-virtual; 1000-row cap sliding window | VERIFIED | `EventLogDrawer.tsx`: `import { useVirtualizer }` + `virtualizer.measureElement` at line 304. `eventLogStore.ts`: `EVENT_LOG_ROW_CAP = 1000` + sliding drop-oldest logic |
| 24 | Filter bar: source dropdown, selected-node toggle, status filter, Clear button | VERIFIED | `EventLogFilterBar.tsx` (155 lines): "All sources" + distinct sources; "Selected node only" toggle with disabled state; status dropdown; Clear button conditional on active filter |
| 25 | pushEventLog handler appends to eventLogStore; row click calls setSelectedNode | VERIFIED | `rpcHandlers.ts`: `useEventLogStore.getState().appendEvents(msg.events)`. `EventLogDrawer.tsx` line 323: `useRoadmapStore.getState().setSelectedNode(row.nodeId)` (I-11 resolution — Canvas.tsx lines 141-143 auto-pan) |
| 26 | MCP wrapper at plugins/claude-code/ exposes updateNodeStatus + getEventApiStatus; sentinel auto-discovery; exponential backoff 500..30000ms; hello frame; fails fast when disconnected (D-28) | VERIFIED | `server.ts`: McpServer + StdioServerTransport + two `registerTool` calls; "Roadmap Viewer is not running" error copy verbatim. `wsClient.ts`: `RECONNECT_DELAYS_MS = [500,1000,2000,4000,8000,16000,30000]`; hello frame sent on open; `throw new Error("Not connected")` for D-28. `sentinel.ts`: 6 retries + 500ms backoff + PID liveness check. All node:* APIs only (zero Bun.* calls confirmed). `dist/index.js` shebang verified. **END-TO-END LATENCY CONFIRMED 2026-04-29 by user (UAT Test 2): 35-45ms round trip across 5 calls; getEventApiStatus returned correct port (47921) + pid (24400)** |
| 27 | `plugin`/`subscribe` fields accepted permissively (PLUG-09 / D-26) | VERIFIED | `schema.test.ts` PLUG-09 block (3 real passing assertions). `RoadmapNodeSchema` retains `z.unknown().optional()` for both fields |
| 28 | Connected EventApiPill click opens event log drawer (D-06; UAT-3 fix) | VERIFIED | `EventApiPill.tsx` line 3: static `import { useEventLogStore } from "../store/eventLogStore"`. Lines 45-49: `if (status === "listening" && connectedCount > 0) { useEventLogStore.getState().setOpen(true); return; }`. Test: `StatusBarEventPill.test.tsx` (8 tests, +1 connected-click test added 04-06). Closure commit `06994f6`. **CONFIRMED 2026-04-29 by user (UAT Test 3, smoke step e)** |
| 29 | Idle EventApiPill click copies ws URL with "Copied ✓" feedback (D-06) | VERIFIED | `EventApiPill.tsx` lines 51-61: `if (status === "listening" && port !== null) { ... navigator.clipboard.writeText(url) ... setCopied(true) ... }`. **CONFIRMED 2026-04-29 by user (UAT Test 3 idle state)** |
| 30 | EventLogDrawer renders a discoverable [×] close button in every render branch (drive-by drawer-close gap fix) | VERIFIED | `EventLogDrawer.tsx`: `CloseButton` component (lines 64-71) with `aria-label="Close event log"` and `onClick={() => useEventLogStore.getState().setOpen(false)}`; rendered in 4 branches at lines 38 (collapsed strip), 227 (empty drawer), 280 (filtered-empty), 330 (full list). Test: `EventLogDrawer.test.tsx` (12 tests, +4 close-path tests added 04-06). Closure commit `06994f6`. **CONFIRMED 2026-04-29 by user (smoke step f)** |
| 31 | Escape closes the drawer when focus is inside it; outside-drawer Escape preserves Phase 3 deselect/cancel-rename | VERIFIED | `useKeyboardRouter.ts` lines 247-275: new Escape branch checks `document.querySelector('section[aria-label="Event log"]')` containment of `document.activeElement`; if open + focus inside → `setOpen(false)` + `e.preventDefault()` + return; otherwise falls through to `inlineRename.cancel()` / `store.setSelectedNode(null)` (Phase 3 contract preserved). New test file `useKeyboardRouter.escape.test.tsx` (2 behavioral tests). Closure commit `06994f6`. **BOTH BRANCHES CONFIRMED 2026-04-29 by user (smoke step g inside-drawer; smoke step h outside-drawer fall-through)** |
| 32 | Per-theme `--rv-pulse` design token defined for all 8 themes | VERIFIED | `index.css` defines `--rv-pulse` in each theme block: line 125 (`#4ade80`), 190 (`#16a34a`), 255 (`#5aee90`), 323 (`#c2410c`), 401 (`#ffa83d`), 474 (`#ffe046`), 554 (`#e9b675`), 632 (`#d4a94e`). Token referenced by `.node::after` border-color (line 755) and reduced-motion static fallback (line 776). Closure commit `24818ae`. Replaces the originally-chosen `--rv-status-completed-bg` (10% alpha green) which made the ring visually invisible. |
| 33 | `bun run verify` (test + typecheck + build + lint) gates all PASS at HEAD | VERIFIED | Recorded in 04-06-SUMMARY.md "Test Counts" table: desktop suite 451 tests pass (was 438 pre-04-06; +13 from 04-06's new tests), plugin suite 19/19 pass, typecheck clean, vite build clean, biome 0 new warnings. Confirmed 2026-04-29 (Plan 04-06 closure). |

**Score:** 33/33 truths verified

### Deferred Items

None — all items accounted for within this phase.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/desktop/src/bun/eventServer.ts` | Bun.serve WebSocket lifecycle | VERIFIED | 277 lines; `Bun.serve`, `new EventCoalescer`, `appendEventLine`, `writeSentinel`, `deleteSentinel` |
| `packages/desktop/src/bun/eventCoalescer.ts` | EventCoalescer LWW + 100ms timer | VERIFIED | 44 lines; `EventCoalescer` class + `FLUSH_MS_DEFAULT = 100` |
| `packages/desktop/src/bun/eventsLog.ts` | Sidecar append + replay | VERIFIED | 117 lines; `appendEventLine` export confirmed |
| `packages/desktop/src/bun/sentinel.ts` | Sentinel write/delete | VERIFIED | 35 lines; `writeSentinel` + `deleteSentinel` |
| `packages/desktop/src/bun/eventSchema.ts` | Zod boundary schema | VERIFIED | 68 lines; `EventFrameSchema` + `HelloFrameSchema` + error classifier |
| `packages/desktop/src/bun/eventServerStandalone.ts` | Headless Bun E2E entry | VERIFIED | Exists per SUMMARY-02 key-files; used by `eventApi-e2e.test.ts` |
| `packages/desktop/src/mainview/store/eventApiStore.ts` | Event API state machine | VERIFIED | 17 lines (compact Zustand store — all required fields present: status/port/connectedCount/errorMessage/setState). Plan min_lines=40 was a sizing hint, not a functional gate |
| `packages/desktop/src/mainview/store/toastStore.ts` | Toast queue with 5s throttle-merge | VERIFIED | 80 lines; toast types + merge window confirmed |
| `packages/desktop/src/mainview/store/eventLogStore.ts` | Drawer state + row window + filter | VERIFIED | 115 lines; `EVENT_LOG_ROW_CAP=1000`, `getFilteredRows`, `getDistinctSources` |
| `packages/desktop/src/mainview/components/EventApiPill.tsx` | Status-bar pill | VERIFIED (updated by 04-06) | Now ~110 lines after dynamic→static import refactor; static `useEventLogStore` import on line 3; connected-branch `setOpen(true)` on line 48 |
| `packages/desktop/src/mainview/components/IntegrationZone.tsx` | SidePanel integration section | VERIFIED | 270 lines; full D-16 implementation including mini-history wired to eventLogStore |
| `packages/desktop/src/mainview/components/EventToast.tsx` | Error/info toast | VERIFIED | 148 lines |
| `packages/desktop/src/mainview/components/EventToastStack.tsx` | Toast stack renderer | VERIFIED | 55 lines; wired in App.tsx |
| `packages/desktop/src/mainview/components/EventLogDrawer.tsx` | Bottom drawer with virtualized list | VERIFIED (extended by 04-06) | Now includes `CloseButton` component (lines 64-71, aria-label="Close event log") rendered in 4 render branches; drawer accessible via `<section aria-label="Event log">` for router focus-containment |
| `packages/desktop/src/mainview/components/EventLogRow.tsx` | Memoized virtualized row | VERIFIED | 275 lines |
| `packages/desktop/src/mainview/components/EventLogFilterBar.tsx` | Filter controls | VERIFIED | 155 lines |
| `packages/desktop/src/mainview/hooks/useKeyboardRouter.ts` | Keyboard router | VERIFIED (extended by 04-06) | New Escape branch (lines 247-275) with focus-containment check on `section[aria-label="Event log"]`; preserves Phase 3 fall-through |
| `packages/desktop/src/mainview/index.css` | Pulse animation + theme tokens | VERIFIED (rewritten by 04-06) | `.node::after` rule (lines 750-758); `.node[data-live="true"]::after` animation (lines 759-761); `rv-node-pulse` keyframe (lines 762-772); reduced-motion static fallback (lines 773-779); 8 per-theme `--rv-pulse` tokens (lines 125/190/255/323/401/474/554/632) |
| `plugins/claude-code/src/index.ts` | Bin entry with shebang | VERIFIED | 2 lines; shebang on line 1 confirmed in dist/index.js |
| `plugins/claude-code/src/server.ts` | MCP server + two tools | VERIFIED | 97 lines; McpServer, StdioServerTransport, updateNodeStatus, getEventApiStatus |
| `plugins/claude-code/src/userData.ts` | Cross-platform sentinel path resolver | VERIFIED | 29 lines; mirrors settings.ts exactly (diff: no output) |
| `plugins/claude-code/src/sentinel.ts` | readSentinel + retry + PID liveness | VERIFIED | 63 lines; DEFAULT_MAX_ATTEMPTS=6, DEFAULT_RETRY_MS=500, process.kill(pid,0) |
| `plugins/claude-code/src/wsClient.ts` | WS client + backoff + hello frame | VERIFIED | 116 lines; RECONNECT_DELAYS_MS, hello frame template literal, D-28 throw. **NOTE:** known-follow-up `producer-count-overcount` flags an unconditional `scheduleReconnect()` race in this file (out of phase scope) |
| `plugins/claude-code/vitest.config.ts` | Vitest config for plugin workspace | VERIFIED | Exists; used by 19/19 passing plugin tests |
| `plugins/claude-code/dist/index.js` | Built Node-runnable binary | VERIFIED | `#!/usr/bin/env node` on line 1 |
| `.husky/pre-commit` | Restored tsc + vitest gates | VERIFIED | Lines 4-5: `cd packages/desktop && bunx tsc --noEmit` + `bunx vitest run --reporter=dot` un-commented; "Disabled for Phase 4" comment absent |
| `packages/desktop/tests/unit/ui/RoadmapNodePulse.test.tsx` | New 04-06 regression-guard tests | VERIFIED | 6 tests (3 data-live behavioral + 1 className positioning + 2 CSS-contract guards on index.css). Created in commit `a1357db`, updated in `24818ae` to expect `--rv-pulse` token |
| `packages/desktop/tests/unit/hooks/useKeyboardRouter.escape.test.tsx` | New 04-06 focus-containment tests | VERIFIED | 2 behavioral tests (inside-drawer Escape closes; outside-drawer Escape falls through to deselect). Created in commit `06994f6` |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `bun/index.ts` | `bun/eventServer.ts` | `startEventServer()` + `eventServerHandle.stop()` | VERIFIED | Lines 92/118/187 confirmed |
| `bun/eventServer.ts` | `bun/eventCoalescer.ts` | `new EventCoalescer(FLUSH_MS, onFlush)` | VERIFIED | Line 73 confirmed |
| `bun/eventServer.ts` | `bun/eventsLog.ts` | `appendEventLine()` before enqueue | VERIFIED | Lines 140/208 confirmed |
| `bun/eventServer.ts` | `bun/sentinel.ts` | `writeSentinel()` + `deleteSentinel()` | VERIFIED | Lines 122/190/203/211 |
| `bun/index.ts` | `bun/eventServer.ts` | `setSidecarPath(null)` on newFile | VERIFIED | Lines 493/369/572 |
| `rpcHandlers.ts` | `roadmapStore.ts` | `applyEventBatch(msg.updates)` | VERIFIED | Line 38 |
| `rpc.ts` | `bun/index.ts` | `setNodeAllowlist` request on mount + dataKey | VERIFIED | Lines 73/92 |
| `RoadmapNode.tsx` | `roadmapStore.ts` | `data-live` via `useIsNodeLive` selector | VERIFIED | Lines 100/108 |
| `bun/index.ts` | `rpcHandlers.ts` | `onError`/`onConnectionChange` → `pushEventApiError`/`pushEventApiState` | VERIFIED | Lines 102/109 |
| `rpcHandlers.ts` | `eventLogStore.ts` | `pushEventLog` → `appendEvents(events)` | VERIFIED | Line 77 |
| `useKeyboardRouter.ts` | `eventLogStore.ts` | Ctrl+Shift+L → `toggleOpen()` | VERIFIED | Lines 97-105 |
| `useKeyboardRouter.ts` | `eventLogStore.ts` | Escape (focus inside drawer) → `setOpen(false)` | VERIFIED (NEW 04-06) | Lines 247-275; selector `section[aria-label="Event log"]`; Phase 3 fall-through preserved |
| `EventApiPill.tsx` | `eventLogStore.ts` | Connected-pill click → `setOpen(true)` | VERIFIED (NEW 04-06) | Static import on line 3; `useEventLogStore.getState().setOpen(true)` on line 48 |
| `EventLogDrawer.tsx` | `eventLogStore.ts` | `[×]` button click → `setOpen(false)` | VERIFIED (NEW 04-06) | `CloseButton` lines 64-71; rendered in 4 branches (lines 38/227/280/330) |
| `EventLogDrawer.tsx` | `roadmapStore.ts` | Row click → `setSelectedNode(nodeId)` | VERIFIED | Line 323 (I-11 resolution) |
| `EventLogDrawer.tsx` | `eventApiStore.ts` | `apiStatus` + `apiPort` drive empty-state copy | VERIFIED | `useEventApiStore` imported and used |
| `IntegrationZone.tsx` | `eventLogStore.ts` | mini-history + "Open full log" → `setOpen(true)` + `setFilterSelectedNodeOnly(true)` | VERIFIED | Lines 42-52/270-272 |
| `plugins/claude-code/server.ts` | `plugins/claude-code/sentinel.ts` | `updateNodeStatus` tool calls `readSentinel()` | VERIFIED | Line 51 in server.ts |
| `plugins/claude-code/wsClient.ts` | `plugins/claude-code/sentinel.ts` | `connectLoop()` calls `readSentinel()` on each reconnect | VERIFIED | Line 38 in wsClient.ts |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `EventLogDrawer.tsx` | `rows` | `useEventLogStore(s => s.rows)` → `handlePushEventLog` → `appendEvents` ← Bun `pushEventLog` from real WS events | Yes — DB query equivalent is real WS events piped through Bun eventServer | FLOWING |
| `IntegrationZone.tsx` | `meta` | `useRoadmapStore(s => s.liveEventMeta[nodeId])` → `applyEventBatch` ← Bun `pushStatusUpdate` flush | Yes — real event pipeline | FLOWING |
| `EventApiPill.tsx` | `status`/`port`/`connectedCount` | `useEventApiStore` ← `handlePushEventApiState` ← `bun/index.ts onConnectionChange` | Yes — real Bun server lifecycle events | FLOWING (note: `connectedCount` over-reports — see follow-up `producer-count-overcount`; counted-value flow is real, the source-side count is what's wrong) |
| `RoadmapNode.tsx` | `isLive` | `useIsNodeLive` reads `liveEventMeta[nodeId].lastEventAt` vs `Date.now()` | Yes — populated by `applyEventBatch` from real events | FLOWING |
| `RoadmapNode::after` (CSS pseudo) | `data-live="true"` | Set on `RoadmapNode.tsx` from `useIsNodeLive` selector → triggers `.node[data-live="true"]::after` animation | Yes — animation visibility confirmed via UAT 2026-04-29 | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| TypeScript typecheck | `bun run test:typecheck` | Exit 0, no errors (per 04-06-SUMMARY) | PASS |
| Desktop test suite (post-04-06) | `bun run test:desktop` | 451 passed, 0 failed (was 438 pre-04-06; +13 from new pulse + escape + close-path + connected-click tests) | PASS |
| Plugin test suite | `bun run --cwd plugins/claude-code test` | 19 passed, 0 failed | PASS |
| Dist shebang | `head -n 1 plugins/claude-code/dist/index.js` | `#!/usr/bin/env node` | PASS |
| No Bun.* in plugins/claude-code/src | `grep -rE "Bun\." plugins/claude-code/src/` | Comments only, no API calls | PASS |
| Pre-commit gates restored | `grep -n "bunx tsc\|bunx vitest" .husky/pre-commit` | Lines 4-5 un-commented | PASS |
| Pulse CSS contract (post-04-06) | `grep -n "\.node::after\|--rv-pulse" packages/desktop/src/mainview/index.css` | `.node::after` at line 750; `--rv-pulse` defined in 8 theme blocks; referenced by border-color (755) + reduced-motion fallback (776) | PASS |
| Pill connected-click static import | `grep -n "useEventLogStore" packages/desktop/src/mainview/components/EventApiPill.tsx` | Line 3 (import) + line 48 (`setOpen(true)`) | PASS |
| Drawer close button presence | `grep -n "Close event log" packages/desktop/src/mainview/components/EventLogDrawer.tsx` | Line 68 `aria-label="Close event log"`; CloseButton called from 4 branches | PASS |
| Router Escape focus-containment | `grep -n 'section\[aria-label="Event log"\]' packages/desktop/src/mainview/hooks/useKeyboardRouter.ts` | Line 256, inside the new Escape branch (lines 247-275) | PASS |

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| PLUG-01 | 04-02, 04-06 | WS server always running; port configurable; default 47921 | VERIFIED | `eventServer.ts` + `index.ts` startup wiring confirmed |
| PLUG-02 | 04-01, 04-02 | Event contract `{nodeId, status, meta?, source?}`; Zod validation; unknown status dropped | VERIFIED | `eventSchema.ts` EventFrameSchema + classifier |
| PLUG-03 | 04-01, 04-02, 04-03 | Routed within 100ms; 100ms debounce buffer; applyEventBatch no dataKey bump | VERIFIED | `FLUSH_MS=100`; integration test confirms; `applyEventBatch` confirmed; UAT Test 2 measured 35-45ms end-to-end |
| PLUG-04 | 04-03, 04-06 | Animated pulse while producer active; prefers-reduced-motion fallback | VERIFIED | 30s-window proxy per D-14; CSS rewritten via `.node::after` + per-theme `--rv-pulse` token in 04-06; UAT Test 1 + reduced-motion step confirmed visually 2026-04-29 |
| PLUG-05 | 04-03, 04-04 | Integration zone: connection status, last event time, meta kv-table | VERIFIED | `IntegrationZone.tsx` 270 lines fully implements D-16 |
| PLUG-06 | 04-03 | Non-blocking toasts for connection drops + malformed events | VERIFIED | `toastStore` + `EventToast` + `EventToastStack` + I-09 fix wired |
| PLUG-07 | 04-04, 04-06 | Event log with all received events; nodeId, status, source, meta, timestamp; close affordance | VERIFIED | `EventLogDrawer` + `eventLogStore` + Ctrl+Shift+L + TopBar button + 04-06 [×] close button + Escape focus-containment |
| PLUG-08 | 04-05 | Claude Code MCP wrapper as reference producer | VERIFIED | All 5 src files verified; 19 plugin tests pass; UAT Test 2 confirmed 35-45ms round trip with correct `getEventApiStatus` reply 2026-04-29 |
| PLUG-09 | 04-01 | plugin/subscribe fields parsed, stored, not acted on; unknown plugin.id silent | VERIFIED | 3 real assertions in `schema.test.ts` PLUG-09 block all pass |

**Coverage note:** All requirements PLUG-01 through PLUG-09 verified. PLUG-04 originally split into automated/human verification — both halves now satisfied (automated: CSS contract guards in `RoadmapNodePulse.test.tsx`; human: UAT Test 1 step d animated + step i reduced-motion). PLUG-05's "connection status" remains implemented as D-16's "Live / Last event X ago" model (intentional design deviation documented in 04-CONTEXT.md). PLUG-04 and PLUG-05 REQUIREMENTS.md checkboxes remain unchecked to reflect the awareness that the literal wording differs from the implemented semantics — the implementations satisfy the intent.

### Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| `rpcHandlers.ts` comment | "no-op stub until Plan 04-04" (past-tense historical comment) | Info | Comment describes former state, not current. Implementation is live: `appendEvents(msg.events)` |
| `plugins/claude-code/src/wsClient.ts` (close handler) | `scheduleReconnect()` fires unconditionally on `close`, even for sockets that never opened — races two `connectLoop`s on failed handshake | Warning | Surfaced as `producer-count-overcount` follow-up; out of Phase 4 scope per SUMMARY's `blocks_phase_closure: false`. Does not regress any verified Phase 4 truth |
| `plugins/claude-code/src/server.ts:9` | `wsClient` opened at module top-level → every Claude Code session with this MCP server enabled holds a persistent WS connection | Warning | Surfaced as `producer-count-overcount` follow-up; out of Phase 4 scope. Architectural / UX-decision choice rather than a defect against Phase 4 contracts |

No blockers. Two warnings logged as `known_follow_ups` with `blocks_phase_closure: false`.

### Human Verification Required

None remaining. All 5 originally-flagged human verification items resolved by the human-loop UAT smoke captured in `04-HUMAN-UAT.md`:

| Original Test | UAT Result | Date | Notes |
|--------------|------------|------|-------|
| Test 1: Pulse animation + reduced-motion | PASS | 2026-04-29 | After 04-06 commits a1357db (pseudo-element) + 24818ae (per-theme token); user confirmed steps d (animated) + i (static fallback) |
| Test 2: Claude Code MCP end-to-end latency | PASS | 2026-04-29 | 35-45ms round-trip across 5 calls; getEventApiStatus returned port 47921, pid 24400 |
| Test 3: Status-bar pill click UX (idle / connected / error) | PASS | 2026-04-29 | Idle copies URL with feedback; connected opens drawer (after 04-06 commit 06994f6); error state shows correct copy |
| Test 4: Welcome screen URL copy | PASS | 2026-04-29 | URL string copied to clipboard from welcome footer |
| Test 5: Event log drawer resize handle ergonomics | PASS | 2026-04-29 | Smooth resize across full 24px-to-70%-viewport range |
| Drive-by: drawer close affordance | PASS | 2026-04-29 | New [×] button (commit 06994f6) clicked + inside-drawer Escape closed drawer; outside-drawer Escape preserved Phase 3 fall-through |

### Known Follow-Ups (Out of Scope for Phase 4 Closure)

| ID | Severity | Source | Blocks Closure | Summary |
|----|----------|--------|----------------|---------|
| `producer-count-overcount` | medium | UAT Test 6 (during 04-06 smoke step e) | NO | EventApiPill connected-count over-reports (showed `3`, briefly `4`, when only wscat connected). Two root causes in `plugins/claude-code/`: top-level wsClient opens per Claude Code session; `scheduleReconnect()` fires unconditionally on `close` even for sockets that never opened, racing two connectLoops on failed handshakes. The displayed count's data flow IS real and correct given its source — the source itself is over-counting. Requires a UX decision (subtract self-connections vs raw socket count) plus a wsClient retry-race fix. Suggested as a small follow-up (e.g. 04-07). |
| `validation-echo` | design-decision | UAT Test 2 negative cases (steps 6-7) | NO | MCP wrapper currently returns `ok` for unknown_node and invalid_status frames (fire-and-forget by design). Consider validating against the loaded schema on the desktop side and echoing classification back through the MCP response so CI integrations get explicit failure on typos rather than silent no-ops. |
| `drawer-auto-scroll` | enhancement | UAT Test 5 verification | NO | Suggested new-feature toggle: "auto-scroll to new events" checkbox on the event log drawer (default enabled). Mirrors most log viewers' tail-follow behavior. |

All three follow-ups are tracked in `04-HUMAN-UAT.md` as well; mirrored here so the verification record is self-contained for milestone audit.

### Gaps Summary

No gaps found. All 33 observable truths are verified against the codebase at HEAD `bf90dde`. The original initial-verification's 5 human verification items have been resolved by the human-loop UAT smoke documented in `04-HUMAN-UAT.md` (all PASS, 2026-04-29). The drive-by drawer-close gap discovered during UAT was addressed by Plan 04-06 and is captured here as truths #30 and #31. The producer-count over-reporting bug observed during 04-06 smoke is a separately-scoped follow-up with `blocks_phase_closure: false` per the SUMMARY annotation.

### Phase Status: ready_to_close

- All originally-defined success criteria met (truths #1-27).
- All 04-06 closure deliverables met (truths #28-32).
- `bun run verify` gate green at HEAD (truth #33).
- All 5 human verification items resolved by user manual smoke (2026-04-29).
- No blockers; 3 known follow-ups all flagged `blocks_phase_closure: false`.
- 0 truths failed, 0 artifacts missing, 0 key links broken, 0 blocker anti-patterns.

---

_Initial verification: 2026-04-28T11:11:42Z (27/27 verified, 5 human_needed)_
_Re-verified: 2026-04-29T12:00:00Z (33/33 verified, 0 human_needed) after Plan 04-06 gap closure + human-loop UAT smoke_
_Verifier: Claude (gsd-verifier)_
