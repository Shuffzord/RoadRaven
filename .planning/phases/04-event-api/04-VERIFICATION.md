---
phase: 04-event-api
verified: 2026-04-28T11:11:42Z
status: human_needed
score: 27/27
overrides_applied: 0
human_verification:
  - test: "Open a node that has received a live event within the last 30 seconds. Confirm the animated pulse ring plays on the node card."
    expected: "Animated rv-node-pulse ring is visible. Toggle OS reduced-motion setting — ring should become a static 2px solid outline."
    why_human: "CSS animation timing and OS-level prefers-reduced-motion are not reliably assertable in JSDOM (PLUG-04 / D-15)"
  - test: "Register plugins/claude-code in Claude Code's MCP config. Start RoadRaven. Invoke updateNodeStatus({nodeId, status}) from a Claude Code conversation. Time the round trip."
    expected: "Node badge updates within perceived-instant (<100ms). Event drawer row appears. getEventApiStatus returns correct port+pid."
    why_human: "Requires external MCP host (Claude Code CLI) spawned outside Vitest. D-29 end-to-end latency test (PLUG-08)"
  - test: "With the app running and a producer connected, click the status-bar pill in each state: listening (0 producers), listening (>0 producers), error."
    expected: "Idle click copies ws://127.0.0.1:47921 to clipboard. Connected click opens event log drawer. Error state shows correct pill copy."
    why_human: "Clipboard API + user-perceived latency not reliably testable in automated suite (D-06)"
  - test: "On the welcome screen with Event API running, locate the URL line near the footer and click the copy button."
    expected: "The ws://127.0.0.1:47921 URL string is copied to clipboard."
    why_human: "Clipboard + layout visibility require real browser environment (D-07)"
  - test: "Open the event log drawer. Drag the top resize handle through the full range (24px strip to 70% viewport)."
    expected: "Drawer resizes smoothly. Snaps to 24px collapsed state. Does not exceed 70% viewport height."
    why_human: "Drag ergonomics and perceived smoothness require human judgment (D-18)"
---

# Phase 04: Event API — Verification Report

**Phase Goal:** The app receives live node status updates from external producers via WebSocket and routes them to the correct nodes within 100ms — with the Claude Code MCP wrapper working end-to-end as the reference producer.
**Verified:** 2026-04-28T11:11:42Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

All truths derived from ROADMAP.md success criteria and PLAN must_haves across all five plans.

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
| 14 | Nodes within 30s of lastEventAt render the pulse animation (data-live='true'); prefers-reduced-motion substitutes static ring | VERIFIED | `index.css` lines 742/746: `.node[data-live="true"] { animation: rv-node-pulse 1600ms }` + `@media (prefers-reduced-motion: reduce)` static ring. `RoadmapNode.tsx`: `data-live={isLive ? "true" : undefined}` |
| 15 | 1Hz tick re-evaluates which nodes are live via bumpLiveTick in App.tsx | VERIFIED | `App.tsx` lines 43-45: `setInterval(() => useRoadmapStore.getState().bumpLiveTick(), 1000)` |
| 16 | Status-bar pill cycles through off/listening/connected/error with correct copy | VERIFIED | `EventApiPill.tsx` (134 lines) wired in `StatusBar.tsx`. `eventApiStore.ts` has `status: "off" \| "listening" \| "error"` + connectedCount. Tests in `StatusBarEventPill.test.tsx` |
| 17 | Welcome screen shows Event API URL line | VERIFIED | `WelcomeScreen.tsx` lines 149/165/172: `Event API: ws://127.0.0.1:{eventApiPort}` |
| 18 | SidePanel Integration zone renders header / source / meta-table / mini-history per D-16 | VERIFIED | `IntegrationZone.tsx` (270 lines): "● Live" / "○ Last event Xm ago" / "— No events received"; source row + copy button; meta key-value table; mini-history last 5 events from `eventLogStore.rows` filtered by nodeId; "Open full log →" calls `setOpen(true)` + `setFilterSelectedNodeOnly(true)` |
| 19 | Malformed/unknown/disconnect toasts use D-23 copy; D-24 throttle-merge within 5s | VERIFIED | `toastStore.ts` (80 lines) with toast types `"malformed"\|"unknown_node"\|"invalid_status"\|"disconnect"` and 5s merge window. `EventToast.tsx` (148 lines) + `EventToastStack.tsx` (55 lines) in `App.tsx` |
| 20 | Bun onError/onConnectionChange propagate to webview via pushEventApiError/pushEventApiState (I-09 fix) | VERIFIED | `index.ts` lines 102/109: real `rpc?.send.pushEventApiError(...)` + `rpc?.send.pushEventApiState(...)` calls. Initial state push at line 608 |
| 21 | Renderer pushes setNodeAllowlist to Bun on mount + dataKey bump | VERIFIED | `rpc.ts` lines 73/92: `pushAllowlistFromStore()` subscribes to dataKey changes and calls `electroview?.rpc?.request.setNodeAllowlist(...)` |
| 22 | Event log drawer opens/closes via Ctrl+Shift+L and TopBar Events button; defaults to 30% viewport | VERIFIED | `useKeyboardRouter.ts` lines 97-105: Ctrl+Shift+L → `toggleOpen()`. `TopBar.tsx` lines 124-151: Events button with `aria-label="Toggle event log drawer"`. `eventLogStore.ts`: `drawerHeightPx: defaultHeight()` = 30% viewport |
| 23 | Rows virtualized via @tanstack/react-virtual; 1000-row cap sliding window | VERIFIED | `EventLogDrawer.tsx`: `import { useVirtualizer }` + `virtualizer.measureElement` at line 304. `eventLogStore.ts`: `EVENT_LOG_ROW_CAP = 1000` + sliding drop-oldest logic |
| 24 | Filter bar: source dropdown, selected-node toggle, status filter, Clear button | VERIFIED | `EventLogFilterBar.tsx` (155 lines): "All sources" + distinct sources; "Selected node only" toggle with disabled state; status dropdown; Clear button conditional on active filter |
| 25 | pushEventLog handler appends to eventLogStore; row click calls setSelectedNode | VERIFIED | `rpcHandlers.ts`: `useEventLogStore.getState().appendEvents(msg.events)`. `EventLogDrawer.tsx` line 323: `useRoadmapStore.getState().setSelectedNode(row.nodeId)` (I-11 resolution — Canvas.tsx lines 141-143 auto-pan) |
| 26 | MCP wrapper at plugins/claude-code/ exposes updateNodeStatus + getEventApiStatus; sentinel auto-discovery; exponential backoff 500..30000ms; hello frame; fails fast when disconnected (D-28) | VERIFIED | `server.ts`: McpServer + StdioServerTransport + two `registerTool` calls; "Roadmap Viewer is not running" error copy verbatim. `wsClient.ts`: `RECONNECT_DELAYS_MS = [500,1000,2000,4000,8000,16000,30000]`; hello frame sent on open; `throw new Error("Not connected")` for D-28. `sentinel.ts`: 6 retries + 500ms backoff + PID liveness check. All node:* APIs only (zero Bun.* calls confirmed). `dist/index.js` shebang verified |
| 27 | `plugin`/`subscribe` fields accepted permissively (PLUG-09 / D-26) | VERIFIED | `schema.test.ts` PLUG-09 block (3 real passing assertions). `RoadmapNodeSchema` retains `z.unknown().optional()` for both fields |

**Score:** 27/27 truths verified (5 require human testing for visual/UX/e2e aspects)

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
| `packages/desktop/src/mainview/components/EventApiPill.tsx` | Status-bar pill | VERIFIED | 134 lines; wired in StatusBar.tsx |
| `packages/desktop/src/mainview/components/IntegrationZone.tsx` | SidePanel integration section | VERIFIED | 270 lines; full D-16 implementation including mini-history wired to eventLogStore |
| `packages/desktop/src/mainview/components/EventToast.tsx` | Error/info toast | VERIFIED | 148 lines |
| `packages/desktop/src/mainview/components/EventToastStack.tsx` | Toast stack renderer | VERIFIED | 55 lines; wired in App.tsx |
| `packages/desktop/src/mainview/components/EventLogDrawer.tsx` | Bottom drawer with virtualized list | VERIFIED | 341 lines; useVirtualizer, measureElement, role=region, all empty states |
| `packages/desktop/src/mainview/components/EventLogRow.tsx` | Memoized virtualized row | VERIFIED | 275 lines |
| `packages/desktop/src/mainview/components/EventLogFilterBar.tsx` | Filter controls | VERIFIED | 155 lines |
| `plugins/claude-code/src/index.ts` | Bin entry with shebang | VERIFIED | 2 lines; shebang on line 1 confirmed in dist/index.js |
| `plugins/claude-code/src/server.ts` | MCP server + two tools | VERIFIED | 97 lines; McpServer, StdioServerTransport, updateNodeStatus, getEventApiStatus |
| `plugins/claude-code/src/userData.ts` | Cross-platform sentinel path resolver | VERIFIED | 29 lines; mirrors settings.ts exactly (diff: no output) |
| `plugins/claude-code/src/sentinel.ts` | readSentinel + retry + PID liveness | VERIFIED | 63 lines; DEFAULT_MAX_ATTEMPTS=6, DEFAULT_RETRY_MS=500, process.kill(pid,0) |
| `plugins/claude-code/src/wsClient.ts` | WS client + backoff + hello frame | VERIFIED | 116 lines; RECONNECT_DELAYS_MS, hello frame template literal, D-28 throw |
| `plugins/claude-code/vitest.config.ts` | Vitest config for plugin workspace | VERIFIED | Exists; used by 19/19 passing plugin tests |
| `plugins/claude-code/dist/index.js` | Built Node-runnable binary | VERIFIED | `#!/usr/bin/env node` on line 1 |
| `.husky/pre-commit` | Restored tsc + vitest gates | VERIFIED | Lines 4-5: `cd packages/desktop && bunx tsc --noEmit` + `bunx vitest run --reporter=dot` un-commented; "Disabled for Phase 4" comment absent |

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
| `rpcHandlers.ts` | `eventLogStore.ts` | `pushEventLog` → `appendEvents(events)` | VERIFIED | Line 77; not a stub (past tense comment) |
| `useKeyboardRouter.ts` | `eventLogStore.ts` | Ctrl+Shift+L → `toggleOpen()` | VERIFIED | Lines 97-105 |
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
| `EventApiPill.tsx` | `status`/`port`/`connectedCount` | `useEventApiStore` ← `handlePushEventApiState` ← `bun/index.ts onConnectionChange` | Yes — real Bun server lifecycle events | FLOWING |
| `RoadmapNode.tsx` | `isLive` | `useIsNodeLive` reads `liveEventMeta[nodeId].lastEventAt` vs `Date.now()` | Yes — populated by `applyEventBatch` from real events | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| TypeScript typecheck | `bun run test:typecheck` | Exit 0, no errors | PASS |
| Desktop test suite (438 tests, 51 files) | `bun run test:desktop` | 438 passed, 0 failed | PASS |
| Plugin test suite (19 tests, 3 files) | `bun run --cwd plugins/claude-code test` | 19 passed, 0 failed | PASS |
| Dist shebang | `head -n 1 plugins/claude-code/dist/index.js` | `#!/usr/bin/env node` | PASS |
| No Bun.* in plugins/claude-code/src | `grep -rE "Bun\." plugins/claude-code/src/` | Comments only, no API calls | PASS |
| Pre-commit gates restored | `grep -n "bunx tsc\|bunx vitest" .husky/pre-commit` | Lines 4-5 un-commented | PASS |

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| PLUG-01 | 04-02 | WS server always running; port configurable; default 47921 | VERIFIED | `eventServer.ts` + `index.ts` startup wiring confirmed |
| PLUG-02 | 04-01, 04-02 | Event contract `{nodeId, status, meta?, source?}`; Zod validation; unknown status dropped | VERIFIED | `eventSchema.ts` EventFrameSchema + classifier |
| PLUG-03 | 04-01, 04-02, 04-03 | Routed within 100ms; 100ms debounce buffer; applyEventBatch no dataKey bump | VERIFIED | `FLUSH_MS=100`; integration test confirms; `applyEventBatch` confirmed |
| PLUG-04 | 04-03 | Animated pulse while producer active; prefers-reduced-motion fallback | VERIFIED (automated) / HUMAN-NEEDED (visual) | 30s-window proxy per D-14; CSS confirmed; UAT item 1 for visual confirmation |
| PLUG-05 | 04-03, 04-04 | Integration zone: connection status, last event time, meta kv-table | VERIFIED (automated) / HUMAN-NEEDED (visual) | IntegrationZone.tsx 270 lines fully implements D-16 |
| PLUG-06 | 04-03 | Non-blocking toasts for connection drops + malformed events | VERIFIED | toastStore + EventToast + EventToastStack + I-09 fix wired |
| PLUG-07 | 04-04 | Event log with all received events; nodeId, status, source, meta, timestamp | VERIFIED | EventLogDrawer + eventLogStore + Ctrl+Shift+L + TopBar button |
| PLUG-08 | 04-05 | Claude Code MCP wrapper as reference producer | VERIFIED (automated) / HUMAN-NEEDED (e2e) | All 5 src files verified; 19 plugin tests pass; UAT item 2 for real e2e |
| PLUG-09 | 04-01 | plugin/subscribe fields parsed, stored, not acted on; unknown plugin.id silent | VERIFIED | 3 real assertions in schema.test.ts PLUG-09 block all pass |

**Coverage note:** PLUG-01/04/05 were not in PLAN frontmatter `requirements` fields but are fully covered: PLUG-01 by 04-02 (which lists it), PLUG-04 and PLUG-05 by 04-03 (which lists them). REQUIREMENTS.md checkboxes for PLUG-04 and PLUG-05 remain unchecked, reflecting the intentional design deviation: PLUG-04's "while their producer is connected" became a 30s-window proxy (D-14); PLUG-05's "connection status (connected/disconnected)" became "Live / Last event X ago" (D-16). Both deviations are documented in 04-CONTEXT.md and implemented as designed.

### Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| `rpcHandlers.ts` comment | "no-op stub until Plan 04-04" (past-tense historical comment) | Info | Comment describes former state, not current. Implementation is live: `appendEvents(msg.events)` |
| `EventApiPill.tsx` | `@vite-ignore` dynamic import for eventLogStore | Info | Intentional workaround for Vite static analysis; eventLogStore now exists post-04-04 but the lazy import pattern is harmless and deliberate |

No blockers or warnings found.

### Human Verification Required

#### 1. Pulse Animation (PLUG-04 / D-15)

**Test:** Open a node that has received a live event within the last 30 seconds. Observe the node card.
**Expected:** Animated `rv-node-pulse` ring plays on the node card. Toggle OS reduced-motion setting — ring should become a static 2px solid `--rv-status-completed` outline.
**Why human:** CSS animation timing and OS-level `prefers-reduced-motion` media query behavior are not reliably assertable in JSDOM.

#### 2. Claude Code MCP End-to-End (PLUG-08 / D-29)

**Test:** Register `plugins/claude-code/dist/index.js` in Claude Code's MCP config. Start RoadRaven. From a Claude Code conversation, invoke `updateNodeStatus({nodeId: "<valid-node-id>", status: "<valid-status>"})`. Observe the app.
**Expected:** Node badge updates within perceived-instant (<100ms). New row appears in the event log drawer. `getEventApiStatus()` returns `{ ok: true, port: 47921, url: "ws://...", pid: <number> }`.
**Why human:** Requires spawning an external MCP host (Claude Code CLI) outside Vitest's process scope.

#### 3. Status-Bar Pill Click UX (D-06)

**Test:** With the app running, click the EventApiPill in each state: (a) listening with 0 producers, (b) listening with at least 1 connected producer, (c) error state (use a conflicting port).
**Expected:** (a) Copies `ws://127.0.0.1:47921` to clipboard. (b) Opens event log drawer. (c) Shows error copy and port number.
**Why human:** Clipboard API and user-perceived affordance require real browser environment.

#### 4. Welcome Screen URL Copy (D-07)

**Test:** Relaunch the app to the welcome screen (no recent file). Locate the Event API URL line near the footer. Click the copy button next to it.
**Expected:** `ws://127.0.0.1:47921` is copied to clipboard. URL is hidden when server status is off/error.
**Why human:** Clipboard + layout visibility require real Electrobun CEF/WebKit environment.

#### 5. Drawer Resize Handle Ergonomics (D-18)

**Test:** Open the event log drawer. Grab the top drag-resize handle and drag through the full range.
**Expected:** Smooth resize from 24px collapsed state to 70% viewport maximum. Releasing at 24px collapses to strip. Height clamps correctly at both ends.
**Why human:** Drag ergonomics and perceived smoothness require human judgment.

### Gaps Summary

No gaps found. All 27 observable truths are verified against the codebase. The 5 human verification items are behavioral/visual checks that cannot be exercised in Vitest's JSDOM environment — they do not indicate missing implementation.

The REQUIREMENTS.md checkboxes for PLUG-04 and PLUG-05 remaining unchecked reflects the executor's awareness that the literal requirement wording ("while their producer is connected", "connection status (connected/disconnected)") differs from the implemented semantics (D-14's 30s window, D-16's "Live/Last event X ago"). The implementations satisfy the intent per the design decisions in 04-CONTEXT.md and are verified both by automated tests and code review.

---

_Verified: 2026-04-28T11:11:42Z_
_Verifier: Claude (gsd-verifier)_
