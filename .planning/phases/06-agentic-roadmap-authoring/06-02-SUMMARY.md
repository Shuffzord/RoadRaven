---
phase: 06-agentic-roadmap-authoring
plan: 02
subsystem: agent-api
tags:
  - websocket
  - rpc
  - transport
  - tdd
  - phase-6
dependency-graph:
  requires:
    - plugins/claude-code/src/wsClient.ts (existing one-way WS client + reconnect logic)
    - plugins/claude-code/src/sentinel.ts (sentinel discovery)
    - packages/desktop/src/bun/eventSchema.ts (existing 2-way IncomingFrameSchema)
    - packages/desktop/src/bun/eventServer.ts (existing message handler with hello + event paths)
    - packages/desktop/src/bun/index.ts (existing startEventServer call site)
    - .planning/phases/06-agentic-roadmap-authoring/06-01-SUMMARY.md (RoadmapRPCType.bun.requests.agentRequest contract entry)
  provides:
    - WsClient.request<T>(method, params) — bidirectional request/response with id correlation, 30s timeout, close-cleanup
    - AgentRequestSchema (Zod) — `{type:'request', id, method, params}` envelope
    - 3-way IncomingFrameSchema discriminated union (HelloFrame | AgentRequest | EventFrame)
    - StartOptions.onAgentRequest callback — Bun-side route for inbound request frames
    - Coalescer-bypass branch in eventServer.ts message handler (RESEARCH §Debounce-Bypass)
    - index.ts placeholder onAgentRequest wiring (responds with internal_error until Plan 06-03 lands the real handler)
  affects:
    - downstream Plan 06-03: replaces the index.ts placeholder body with `void agentRequestHandler(ws, request, mainWindow)` and adds the real dispatcher module
    - downstream Plan 06-05: server.ts MCP tool callbacks invoke `wsClient.request()` (the method this plan adds) inside agentToolCallback
tech-stack:
  added: []
  patterns:
    - "Closure-scoped pending Map keyed by crypto.randomUUID — no module-global state, separate clients have isolated correlation tables"
    - "Persistent message listener attached inside connectOnce alongside open/error/close — reuses the same backoff/scheduleReconnect path"
    - "Pre-coalescer branch in eventServer message handler: agent traffic returns BEFORE coalescer.enqueue, never participating in the 100ms event-batching window (RESEARCH §Debounce-Bypass)"
    - "3-way Zod discriminated union via z.union — parseIncoming body unchanged because safeParse handles the wider union"
    - "Synchronous rejection-handler attachment in fake-timer test (vi.useFakeTimers) prevents PromiseRejectionHandledWarning from Node when await happens after rejection is queued"
    - "Placeholder onAgentRequest handler in index.ts — clean swap point for Plan 06-03 (responds with internal_error so transport is reachable end-to-end without the dispatcher)"
key-files:
  created:
    - plugins/claude-code/tests/wsClient.request.test.ts
    - .planning/phases/06-agentic-roadmap-authoring/06-02-SUMMARY.md
  modified:
    - plugins/claude-code/src/wsClient.ts (request method, pending Map, message listener, close cleanup)
    - packages/desktop/src/bun/eventSchema.ts (AgentRequestSchema, 3-way IncomingFrameSchema, parseIncoming return type)
    - packages/desktop/src/bun/eventServer.ts (AgentRequest import, StartOptions.onAgentRequest, type=='request' branch)
    - packages/desktop/src/bun/index.ts (onAgentRequest placeholder wiring through startEventServer)
    - packages/desktop/src/bun/eventServerStandalone.ts (no-op onAgentRequest for headless E2E runner)
    - packages/desktop/tests/unit/bun/eventServer.test.ts (NO_OP_OPTS gains onAgentRequest no-op)
    - packages/desktop/tests/unit/bun/eventServer.eaddrinuse.test.ts (StartOptions fixtures gain onAgentRequest no-op)
    - packages/desktop/tests/integration/eventApi.test.ts (NO_OP gains onAgentRequest no-op)
    - .planning/REQUIREMENTS.md (PLUG-AGENT-TRANSPORT-01..02 marked complete)
    - .planning/ROADMAP.md (06-02 checkbox marked, Phase 6 progress 2/6)
    - .planning/STATE.md (last_updated, last_activity, decisions, metric row)
decisions:
  - "Pending Map is closure-scoped inside createWsClient (not module-level). Each client instance owns its own correlation table, so multiple clients in the same process — including the test mocks that reset MockWebSocket.instances — cannot leak ids across each other."
  - "Persistent message listener is added INSIDE connectOnce (alongside open/error/close), not at construction. This means a fresh listener is attached on every reconnect; the pending Map survives across reconnects but each socket gets its own listener, matching how the existing close handler is wired."
  - "close handler iterates pending BEFORE scheduleReconnect. A race where connectOnce fires while the previous socket's pending entries still exist would let stale rejections leak into the new connection's flow — clearing first eliminates that window."
  - "The test 2 (timeout) attaches `expect(promise).rejects.toThrow(...)` SYNCHRONOUSLY before advancing fake timers. Awaiting after timer-advance produced PromiseRejectionHandledWarning because Node sees the rejection queued before any handler attaches. Fix preserves the test's intent (rejection on timeout) while satisfying Node's microtask ordering."
  - "Bun-side branch placement: `frame.type === 'request'` returns IMMEDIATELY after the hello check, BEFORE the event-frame path that calls coalescer.enqueue. RESEARCH §Debounce-Bypass requires that agent traffic never join the 100ms event coalescer — confirmed by reading the plan's threat-model T-06-02-06 (timing-channel)."
  - "index.ts placeholder responds with `code:'internal_error'` rather than dropping the request silently. This makes the transport observable end-to-end during wave-1 — wsClient.request will reject (instead of timeout) when no real handler is wired, surfacing the gap clearly to anyone who runs an MCP tool before Plan 06-03 lands."
  - "Test fixtures (NO_OP_OPTS in unit + integration suites, eventServerStandalone) gain a no-op onAgentRequest. This is plumbing — not a new test — required by the StartOptions interface tightening. Per the plan's <action> notes, that is the non-test-budget plumbing fix and not subject to the 3-test budget."
metrics:
  duration_minutes: 5
  completed: 2026-05-07
---

# Phase 6 Plan 02: Bidirectional WebSocket Transport Summary

Build the request/response framing layer that every Phase 6 agent tool will sit on top of: extend the plugin-side `wsClient` with a `request<T>()` method that correlates by id and times out at 30s, expand the Bun-side `IncomingFrameSchema` to a 3-way discriminated union, route inbound `type:'request'` frames through a coalescer-bypassing branch, and wire `index.ts` with a clearly-marked placeholder so Plan 06-03 has a clean swap point for the real dispatcher.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | RED: 3 failing wsClient.request transport tests (resolve, timeout, disconnect) | `5a0c576` | plugins/claude-code/tests/wsClient.request.test.ts |
| 2 | GREEN: implement wsClient.request + AgentRequestSchema + onAgentRequest transport + index.ts placeholder | `e2a25c6` | plugins/claude-code/src/wsClient.ts; packages/desktop/src/bun/{eventSchema,eventServer,index,eventServerStandalone}.ts; 3 test fixture files |

## RED Phase: Why Each Test Failed

Verified via `bun run --filter @roadraven/plugin-claude-code test` after Task 1 commit — 3 new tests failed, 24 pre-existing tests still passed.

1. **Test 1 (resolve on matching response):** `client.request<{ ok: boolean }>("getRoadmap", {})` raised `TypeError: client.request is not a function` because `WsClient` only exposed `send`/`isConnected`/`close`.
2. **Test 2 (30s timeout rejection):** Same root cause as test 1 — the call site `client.request("getRoadmap", {})` could not even reach `vi.advanceTimersByTimeAsync(30_001)`.
3. **Test 3 (disconnect rejects pending):** Same root cause — both `p1 = client.request(...)` and `p2 = client.request(...)` threw at the assignment because the method did not exist.

Right RED reason in every case — failures pin the contract gap, not infrastructure noise.

## GREEN Phase: Implementation Summary

### `plugins/claude-code/src/wsClient.ts` (modified)

- **WsClient interface:** added `request<T = unknown>(method: string, params: Record<string, unknown>): Promise<T>` alongside the existing methods.
- **PendingRequest type + closure-scoped Map:** declared `interface PendingRequest { resolve, reject, timer }` at module top (so the GREEN code reads as a contract, not a one-off), and added `const pending = new Map<string, PendingRequest>()` inside `createWsClient`. Per-instance scoping prevents id collisions across clients.
- **Persistent `message` listener inside `connectOnce`:** alongside the existing `open`/`error`/`close` listeners. JSON.parse the `data`, ignore non-JSON / non-response messages, and on a `{type:'response', id, result|error}` envelope decorate an Error with `code/hint/data` from `msg.error` then resolve/reject the pending entry, clearing the timeout in both paths.
- **`close` handler — pending cleanup before `scheduleReconnect`:** iterate `pending`, clearTimeout each, reject with `new Error("WebSocket disconnected during request")`, then `pending.clear()`. Only after that runs does the existing `scheduleReconnect()` branch fire.
- **`request` method on the returned object:** guards `!connected || ws === null` (rejects synchronously with the existing "Not connected" message — same as `send`'s guard), generates `crypto.randomUUID()`, schedules a 30s timeout that deletes the pending entry and rejects with `Agent request timed out: ${method}`, stores the entry, and sends `{type:'request', id, method, params}` over the socket.

### `packages/desktop/src/bun/eventSchema.ts` (modified)

- **New `AgentRequestSchema`:** added between `EventFrameSchema` and `IncomingFrameSchema`. Shape: `z.object({ type: z.literal("request"), id: z.string().min(1), method: z.string().min(1), params: z.record(z.string(), z.unknown()) })`. The Zod v4 explicit-key `z.record(z.string(), z.unknown())` matches Phase 2 D-26 + RESEARCH §11.
- **New `AgentRequest` type alias:** exported via `z.infer`.
- **`IncomingFrameSchema` widened to a 3-way `z.union`:** `[HelloFrameSchema, AgentRequestSchema, EventFrameSchema]`. `parseIncoming` body unchanged — `safeParse` handles the wider union automatically.
- **`parseIncoming` return type updated** to `frame: HelloFrame | AgentRequest | EventFrame`.

### `packages/desktop/src/bun/eventServer.ts` (modified)

- **Import:** added `type AgentRequest` to the existing eventSchema import.
- **`StartOptions.onAgentRequest`:** new required callback `(ws: ServerWebSocket<WsData>, request: AgentRequest) => void`. JSDoc explicitly cites D-15 / PLUG-AGENT-TRANSPORT-01 / RESEARCH §Debounce-Bypass and notes that Plan 06-03 lands the real handler.
- **New branch in the `message` handler:** placed between the `hello` return (line 172) and the event-frame path. Pattern:
  ```typescript
  if ("type" in frame && frame.type === "request") {
    opts.onAgentRequest(ws, frame as AgentRequest);
    return;  // does NOT enter coalescer.enqueue
  }
  ```
  The `return` is the Debounce-Bypass enforcement: agent traffic NEVER reaches `coalescer.enqueue` below.

### `packages/desktop/src/bun/index.ts` (modified — Plan 06-03 swap point)

Added a `onAgentRequest` callback inside the existing `startEventServer({ ... })` call. The callback body is:

```typescript
ws.send(JSON.stringify({
  type: "response",
  id: request.id,
  error: {
    code: "internal_error",
    message: "agentRequestHandler not yet wired (Plan 06-03)",
    hint: "Run wave 1 plan 06-03 to install the dispatcher",
  },
}));
```

A comment block immediately above marks this as the placeholder Plan 06-03 will replace with `void agentRequestHandler(ws, request, mainWindow)`. This is intentional: the transport ships end-to-end in this plan even though the dispatcher does not — wsClient.request reaches the Bun side and gets a structured rejection, which is more informative than a 30s timeout for anyone who runs an MCP tool before 06-03 lands.

### `packages/desktop/src/bun/eventServerStandalone.ts` (modified — non-test-budget plumbing)

The headless E2E entry-point also calls `startEventServer`. Added `onAgentRequest: () => { /* no renderer */ }` to keep TypeScript happy after the StartOptions tightening. The standalone runner does not exercise agent traffic — Plan 06-03's tests cover that path.

### Test fixture updates (non-test-budget plumbing)

Three test files construct `StartOptions` shapes:

- `packages/desktop/tests/unit/bun/eventServer.test.ts` — NO_OP_OPTS gains `onAgentRequest: () => { /* noop */ }`.
- `packages/desktop/tests/unit/bun/eventServer.eaddrinuse.test.ts` — both inline fixtures gain `onAgentRequest: () => {}`.
- `packages/desktop/tests/integration/eventApi.test.ts` — NO_OP gains the same no-op.

These are pure plumbing fixes required by the interface tightening and do not extend the 3-test budget.

### `plugins/claude-code/tests/wsClient.request.test.ts` (new — 3 tests, hard cap)

- Test 1: `resolves when a matching {type:'response', id, result} message arrives`
- Test 2: `rejects with a timeout error after 30s of no response` (uses `vi.useFakeTimers` + `vi.advanceTimersByTimeAsync`)
- Test 3: `rejects all pending requests with 'WebSocket disconnected during request' on close`

All 3 GREEN: `bun run --filter @roadraven/plugin-claude-code test` shows 5 test files passed, 27/27 tests.

## Verification

| Gate | Command | Result |
|------|---------|--------|
| New transport tests | `bun run --filter @roadraven/plugin-claude-code test tests/wsClient.request.test.ts` | 3/3 pass |
| Plugin suite (regression) | `bun run --filter @roadraven/plugin-claude-code test` | 27/27 pass (3 new + 24 existing) |
| Desktop typecheck | `bun run test:typecheck` | Clean |
| Desktop vitest suite | `bun run test:desktop` | 452/452 pass (53 test files) |
| Bun-native eventServer tests | `bun test tests/unit/bun/eventServer.test.ts tests/unit/bun/eventServer.eaddrinuse.test.ts` | 9/9 pass |
| Integration eventApi tests | `bun test tests/integration/eventApi.test.ts` | 5/5 pass |
| Biome (touched files) | `bunx @biomejs/biome lint <9 files>` | Clean (no errors; 1 pre-existing unused-const warning in wsClient.ts) |
| Sanity grep — wsClient.request | `grep -c "request<T" plugins/claude-code/src/wsClient.ts` | 2 (>= 1 required) |
| Sanity grep — AgentRequestSchema | `grep -c AgentRequestSchema` (excluding `^//`) in eventSchema.ts | 3 (>= 2 required) |
| Sanity grep — onAgentRequest field | `grep -c onAgentRequest` (excluding `^//`) in eventServer.ts | 2 (>= 2 required) |
| Sanity grep — onAgentRequest: wiring | `grep -c "onAgentRequest:"` (excluding `^//`) in index.ts | 1 (>= 1 required) |

## TDD Gate Compliance

- **RED commit** (`5a0c576`): `test(06-02): add failing wsClient.request transport tests …` — 3 failing tests, scaffolds compile, no spurious passes (24 pre-existing tests remained green).
- **GREEN commit** (`e2a25c6`): `feat(06-02): add wsClient.request + 3-way IncomingFrameSchema + onAgentRequest transport` — all 3 tests pass, full suite green, tsc + biome clean.
- **REFACTOR commit:** Skipped — GREEN code is already minimal; further refactoring would dilute the contract surface without behaviour change.

Gate sequence verified in `git log --oneline`:
```
e2a25c6 feat(06-02): add wsClient.request + 3-way IncomingFrameSchema + onAgentRequest transport
5a0c576 test(06-02): add failing wsClient.request transport tests (resolve, timeout, disconnect)
```

## Deviations from Plan

### Auto-fixed (Rule 1 / Rule 3) Issues

**1. [Rule 1 - Bug] PromiseRejectionHandledWarning under fake timers in test 2**
- **Found during:** Task 2 verification — `bun run --filter @roadraven/plugin-claude-code test` reported `27 passed` but emitted an unhandled-rejection warning that exited the runner with code 1.
- **Issue:** The plan's recommended test code awaited `vi.advanceTimersByTimeAsync(30_001)` BEFORE attaching the `expect(...).rejects.toThrow` handler. With fake timers + microtask ordering, the rejection was queued before any handler had been attached, so Node logged `PromiseRejectionHandledWarning: Promise rejection was handled asynchronously`. Vitest treated that as an unhandled error and failed the suite.
- **Fix:** Attach the assertion synchronously before advancing the timer:
  ```typescript
  const promise = client.request("getRoadmap", {});
  const assertion = expect(promise).rejects.toThrow(/timed out/i);
  await vi.advanceTimersByTimeAsync(30_001);
  await assertion;
  ```
  Behaviour unchanged; the test still asserts the same timeout-rejection contract.
- **Files modified:** plugins/claude-code/tests/wsClient.request.test.ts
- **Commit:** absorbed into the GREEN commit (`e2a25c6`)

**2. [Rule 3 - Blocking] StartOptions tightening broke existing test fixtures + standalone entry**
- **Found during:** Task 2 verification — `bun run test:typecheck` would have failed in eventServer.test.ts, eventServer.eaddrinuse.test.ts, integration/eventApi.test.ts, and eventServerStandalone.ts because each constructs StartOptions without onAgentRequest.
- **Issue:** Adding `onAgentRequest` as a non-optional StartOptions field broke 4 existing call sites. The plan's <action> note in Task 2 explicitly anticipated this and called it out as the non-test-budget plumbing fix.
- **Fix:** Added a no-op `onAgentRequest: () => { /* noop */ }` to all 4 fixtures with comments explaining that Plan 06-03 owns the path that exercises onAgentRequest. No new tests added — these are pure plumbing changes.
- **Files modified:** packages/desktop/tests/unit/bun/eventServer.test.ts; packages/desktop/tests/unit/bun/eventServer.eaddrinuse.test.ts; packages/desktop/tests/integration/eventApi.test.ts; packages/desktop/src/bun/eventServerStandalone.ts
- **Commit:** part of the GREEN commit (`e2a25c6`)

**3. [Rule 3 - Blocking] biome lint blocked initial RED commit**
- **Found during:** Task 1 commit (pre-commit hook).
- **Issue:** The plan's recommended test scaffold used `(this.listeners[event] ??= []).push(handler)` — biome's `lint/suspicious/noAssignInExpressions` rule rejects assignments-in-expressions. The pre-commit hook reverted the staged file.
- **Fix:** Refactored to `if (!this.listeners[event]) this.listeners[event] = []; this.listeners[event].push(handler);` — same behaviour, no assignment-in-expression. Re-ran the test to confirm RED state still held (3 failed, 24 passed).
- **Files modified:** plugins/claude-code/tests/wsClient.request.test.ts
- **Commit:** part of the RED commit (`5a0c576`)

### Auth Gates

None. Pure code surface, no external systems.

### CLAUDE.md-driven adjustments

- Used `bun run --filter @roadraven/plugin-claude-code test` (workspace runner) per CLAUDE.md "ALWAYS via `bun run`, never `bunx vitest` directly" rule. Standalone `bun run test:file` only routes to packages/desktop.
- Used Electrobun (not Electron) imports — `ServerWebSocket` from `bun`, not from any Electron-style module.
- All commits were normal commits (no `--no-verify`); pre-commit biome auto-fix applied to the GREEN diff (the multi-line `onAgentRequest` declaration was reformatted to a single line — cosmetic only).

## Self-Check: PASSED

Verified via Read/Grep/Bash:

- `plugins/claude-code/tests/wsClient.request.test.ts` — FOUND
- `plugins/claude-code/src/wsClient.ts` — `request<T` count: 2 (>= 1)
- `packages/desktop/src/bun/eventSchema.ts` — `AgentRequestSchema` count (excluding comments): 3 (>= 2)
- `packages/desktop/src/bun/eventServer.ts` — `onAgentRequest` count (excluding comments): 2 (>= 2)
- `packages/desktop/src/bun/index.ts` — `onAgentRequest:` count (excluding comments): 1 (>= 1)
- Commit `5a0c576` (RED) — FOUND in `git log`
- Commit `e2a25c6` (GREEN) — FOUND in `git log`
- 3/3 transport tests passing
- 27/27 plugin suite passing
- 452/452 desktop vitest suite passing
- 9/9 Bun-native eventServer tests passing
- 5/5 integration eventApi tests passing
- tsc clean across both workspaces

## Threat Flags

No new threat surface introduced beyond the threat_model already declared in the plan.

- T-06-02-01 (Tampering of inbound `request` frame) — mitigated by `AgentRequestSchema` enforcing literal `type:'request'`, `id:string.min(1)`, `method:string.min(1)`, `params:z.record(z.string(), z.unknown())`. parseIncoming returns `ok:false` on any deviation; downstream branch never sees malformed input.
- T-06-02-02 (DoS via infinitely-pending Promises) — mitigated by the 30s setTimeout in `request()` that deletes the entry and rejects with "timed out". Memory bounded to in-flight count × 30s.
- T-06-02-03 (DoS via pending-Map leaks across reconnects) — mitigated by the close handler iterating `pending` and rejecting every entry BEFORE `scheduleReconnect`. Test 3 enforces this.
- T-06-02-04 (request before hello) — accepted, per Phase 4 D-01 localhost-only / no-auth. The hello handshake remains informational; Plan 06-03's kill-switch + path-allowlist gates are the actual enforcement.
- T-06-02-05 (Spoofing via id collision) — mitigated by `crypto.randomUUID()` (122-bit unique). Each client owns a closure-scoped pending Map; cross-client collisions cannot resolve.
- T-06-02-06 (Information disclosure via coalescer batching) — mitigated by the `return` in the request branch. Agent traffic NEVER enters `coalescer.enqueue`; Plan 06-03's tests will assert this when the dispatcher is wired.
