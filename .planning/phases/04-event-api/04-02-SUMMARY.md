---
phase: 04
plan: 02
subsystem: event-api
tags: [bun, websocket, zod, coalescer, sidecar-log, sentinel, lifecycle]
one-liner: "Bun WebSocket event server with Zod boundary, 100ms coalescer, append-only sidecar log, sentinel file, and full lifecycle wiring in index.ts"

dependency-graph:
  requires: [04-01]
  provides: [04-03, 04-04]
  affects: [packages/desktop/src/bun/index.ts, shared/types.ts]

tech-stack:
  added:
    - "Bun.serve WebSocket server (hostname 127.0.0.1, EADDRINUSE sync+async fallback)"
    - "Zod v4 boundary schema (EventFrameSchema, HelloFrameSchema union)"
    - "100ms trailing-edge EventCoalescer (Design C: timer anchored at first event)"
    - "O_APPEND atomic sidecar writes via fs/promises.appendFile"
    - "atomicWrite sentinel file at <userData>/event-api.json"
    - "Headless Bun entry eventServerStandalone.ts for E2E testing"
  patterns:
    - "Port precedence: env > settings > default 47921"
    - "EADDRINUSE belt-and-braces: sync try/catch + async error() handler (I-04)"
    - "appendEventLine BEFORE coalescer.enqueue (RESEARCH §3.3)"
    - "coalescer.flushNow() before server.stop() (RESEARCH Pitfall 4)"
    - "ws.close(1001, 'Going Away') broadcast on shutdown (RESEARCH §1.2)"
    - "setSidecarPath(null) on newFile/closeFile, setSidecarPath(path) on loadFile/saveFileAs (I-10)"
    - "replayEventLog LWW overlay on file open (HYDRATE_EVENT_CAP=1000)"

key-files:
  created:
    - packages/desktop/src/bun/eventSchema.ts
    - packages/desktop/src/bun/eventCoalescer.ts
    - packages/desktop/src/bun/eventsLog.ts
    - packages/desktop/src/bun/sentinel.ts
    - packages/desktop/src/bun/eventServer.ts
    - packages/desktop/src/bun/eventServerStandalone.ts
  modified:
    - packages/desktop/src/bun/index.ts
    - packages/desktop/src/bun/logging.ts
    - packages/desktop/src/bun/settings.ts
    - shared/types.ts
    - packages/desktop/vitest.config.ts
    - packages/desktop/package.json
    - packages/desktop/tests/unit/bun/eventSchema.test.ts
    - packages/desktop/tests/unit/bun/eventCoalescer.test.ts
    - packages/desktop/tests/unit/bun/eventsLog.test.ts
    - packages/desktop/tests/unit/bun/sentinel.test.ts
    - packages/desktop/tests/unit/bun/eventServer.test.ts
    - packages/desktop/tests/unit/bun/eventServer.eaddrinuse.test.ts
    - packages/desktop/tests/integration/eventApi.test.ts
    - packages/desktop/tests/integration/eventApi-e2e.test.ts

decisions:
  - "Design C coalescer: timer anchored at first event, no clearTimeout/re-arm on subsequent events in window"
  - "nodeId: z.string().min(1) not z.string().uuid() — allows non-UUID node IDs from external producers"
  - "META_MAX_BYTES=8192 cap on meta payload to prevent runaway allocations"
  - "appendEventLine uses fs/promises.appendFile (O_APPEND) not atomicWrite — sidecar is append-only, atomic overwrite would destroy log"
  - "Bun-native tests split from vitest: vitest excludes Bun.serve-dependent tests; bun test script added to package.json"
  - "boundPort = server.port ?? port — Server.port is number|undefined in @types/bun; fallback to requested port"
  - "eventServerHandle declared before startEventServer() call — TypeScript needs declaration before all uses in module scope"
  - "onError/onConnectionChange noop in index.ts callbacks deferred to Plan 04-03 Task 6 (I-09 fix)"

metrics:
  duration: "~3 hours (cross-session)"
  completed: "2026-04-23"
  tasks: 6
  files_created: 6
  files_modified: 14
  tests_written: 16
  tests_passing: 368
---

# Phase 04 Plan 02: Bun-Side Event API Implementation Summary

Bun WebSocket event server with Zod boundary, 100ms coalescer, append-only sidecar log, sentinel file, and full lifecycle wiring in index.ts — delivering PLUG-01, PLUG-02, PLUG-03, PLUG-09 with no UI changes.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | EventSchema Zod boundary | aee39d3 | eventSchema.ts, eventSchema.test.ts |
| 2 | EventCoalescer 100ms timer | 09b2cfa | eventCoalescer.ts, eventCoalescer.test.ts |
| 3 | EventsLog sidecar append+replay | 9f4700c | eventsLog.ts, eventsLog.test.ts |
| 4 | Sentinel lifecycle + getUserDataDir | b31a905 | sentinel.ts, settings.ts, sentinel.test.ts |
| 5 | EventServer Bun.serve + EADDRINUSE | 8eb1207 | eventServer.ts, eventServer.test.ts, eventServer.eaddrinuse.test.ts, integration tests, vitest.config.ts |
| 6 | Lifecycle integration + standalone | bfe8b95 | index.ts, eventServerStandalone.ts, eventApi-e2e.test.ts, shared/types.ts |

## Verification

All success criteria met:

- Bun WebSocket server binds on 127.0.0.1:47921 (or fallback port +1..+9) at app boot
- Sentinel written at `<userData>/event-api.json` on bind, deleted on clean shutdown
- User-specified port in use → no fallback; server enters error state (attempted array returned)
- Events validated by Zod at boundary; malformed/unknown_node/invalid_status classified
- Events coalesced per nodeId in 100ms trailing-edge window anchored at first event
- Every received event appended to `<source>.events.jsonl` before coalescer enqueue
- On file open: sidecar replayed to LWW last-event-per-nodeId overlay, forwarded to renderer
- setSidecarPath(null) called on File > New (I-10 fix)
- Server stops cleanly (1001 Going Away broadcast + sentinel delete) on before-quit / SIGTERM / SIGINT
- EADDRINUSE handled via both sync try/catch and async error() handler (I-04)

Test results: 355 vitest pass + 12 bun unit/integration pass + 1 bun E2E pass = 368 total

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `boundPort = server.port ?? port` — port=0 returned 0 instead of OS-assigned port**
- Found during: Task 5
- Issue: `server.port` in @types/bun is `number | undefined`, not `number`. Code used `server.port` directly which could be undefined; when port=0 requested, `boundPort` got set to 0 instead of the actual OS-assigned port.
- Fix: `boundPort = server.port ?? port` — use actual bound port, fall back to requested port
- Files modified: eventServer.ts
- Commit: 8eb1207

**2. [Rule 3 - Blocking] Bun.serve generic parameter error**
- Found during: Task 5
- Issue: `Bun.serve<WsData, undefined>` raised TS error "Type 'undefined' does not satisfy the constraint 'string'"
- Fix: Changed to `Bun.serve<WsData>` (single generic only)
- Files modified: eventServer.ts
- Commit: 8eb1207

**3. [Rule 3 - Blocking] `Server` type requires generic argument**
- Found during: Task 5
- Issue: `let server: Server | null` raised "Generic type 'Server<WebSocketData>' requires 1 type argument"
- Fix: `let server: Server<WsData> | null` and `server: Server<WsData>` in interface
- Files modified: eventServer.ts
- Commit: 8eb1207 + bfe8b95

**4. [Rule 3 - Blocking] `raw as ArrayBuffer` cast error in message handler**
- Found during: Task 5
- Issue: `Buffer<ArrayBuffer>` does not overlap with `ArrayBuffer` — TypeScript rejects direct cast
- Fix: `raw as unknown as ArrayBuffer` — double cast via unknown
- Files modified: eventServer.ts
- Commit: 8eb1207

**5. [Rule 3 - Blocking] `eventServerHandle` used before declaration**
- Found during: Task 6
- Issue: `let eventServerHandle` was declared later in the file but used in closure callbacks passed to `startEventServer()` earlier — TS "used before declaration" error
- Fix: Moved declaration to line before `startEventServer()` call; removed duplicate declaration
- Files modified: index.ts
- Commit: bfe8b95

**6. [Rule 3 - Blocking] vitest workers have no `Bun` global**
- Found during: Task 5
- Issue: `ReferenceError: Bun is not defined` when eventServer tests ran under vitest's Node worker pool
- Fix: Added `exclude` list to vitest.config.ts for 4 Bun-native test files; added `test:bun` script in package.json using `bun test` directly
- Files modified: vitest.config.ts, package.json
- Commit: 8eb1207

**7. [Rule 1 - Bug] `tmpdir` imported from wrong module in eventsLog.test.ts**
- Found during: Task 3
- Issue: `import { join, tmpdir } from "node:path"` — `tmpdir` is from `node:os` not `node:path`
- Fix: Separated imports: `import { tmpdir } from "node:os"` + `import { join } from "node:path"`
- Files modified: eventsLog.test.ts
- Commit: 9f4700c

**8. [Rule 2 - Missing functionality] `getUserDataDir` export needed from settings.ts**
- Found during: Task 4
- Issue: `getSettingsDirectory()` was private (not exported); sentinel.ts needs it to write to userData directory
- Fix: Renamed to `getUserDataDir()` and exported; updated internal callers in settings.ts
- Files modified: settings.ts
- Commit: b31a905

**9. [Rule 3 - Blocking] worktree `packages/core/node_modules` missing**
- Found during: Task 1
- Issue: `Cannot find module 'zod'` in eventSchema.ts because the git worktree's `packages/core/` had no `node_modules` directory
- Fix: Created Windows PowerShell junction from worktree's `packages/core/node_modules` to the main tree's corresponding directory
- Commit: aee39d3 (fix applied pre-commit, not in diff)

**10. [Rule 1 - Bug] Biome `noEmptyBlockStatements` in eventServerStandalone.ts**
- Found during: Task 6
- Issue: `onEvent: () => {}`, `onError: () => {}`, `onConnectionChange: () => {}` flagged by biome
- Fix: Added `/* no renderer */` comment inside each empty block
- Files modified: eventServerStandalone.ts
- Commit: bfe8b95

## Known Stubs

These stubs are intentional and documented; they do not prevent the plan's goals (no UI in this plan):

| Stub | File | Location | Reason |
|------|------|----------|--------|
| `onError: (_err) => { /* Plan 04-03 Task 6 */ }` | index.ts | line ~96 | I-09 fix deferred to 04-03 — onConnectionChange/onError need mainWindow created first |
| `onConnectionChange: (_count) => { /* Plan 04-03 Task 6 */ }` | index.ts | line ~99 | Same as above — will send pushEventApiState to renderer |

Both stubs are in Bun main process callbacks; the event server itself fully functional. Plan 04-03 wires the renderer-facing push messages.

## Threat Flags

None. All new network surface (WebSocket server) is:
- Bound to 127.0.0.1 only (D-03 localhost boundary)
- No authentication required in v1 (documented in plan — external producers are trusted local processes)
- Port range 47921-47930 (well-documented, no wildcard binding)

## Self-Check: PASSED

Files exist:
- packages/desktop/src/bun/eventSchema.ts: FOUND
- packages/desktop/src/bun/eventCoalescer.ts: FOUND
- packages/desktop/src/bun/eventsLog.ts: FOUND
- packages/desktop/src/bun/sentinel.ts: FOUND
- packages/desktop/src/bun/eventServer.ts: FOUND
- packages/desktop/src/bun/eventServerStandalone.ts: FOUND

Commits exist:
- aee39d3: FOUND
- 09b2cfa: FOUND
- 9f4700c: FOUND
- b31a905: FOUND
- 8eb1207: FOUND
- bfe8b95: FOUND
