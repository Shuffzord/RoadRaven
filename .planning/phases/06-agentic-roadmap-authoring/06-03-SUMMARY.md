---
phase: 06-agentic-roadmap-authoring
plan: 03
subsystem: agent-api
tags:
  - bun
  - rpc-bridge
  - safety-gates
  - tdd
  - phase-6
dependency-graph:
  requires:
    - packages/desktop/src/bun/saveFile.ts (isPathWithinMainDir, pushDialogAllowlistPath)
    - packages/desktop/src/bun/settings.ts (loadSettings → AppSettings)
    - packages/desktop/src/bun/refMap.ts (getOwnership)
    - packages/desktop/src/bun/eventSchema.ts (AgentRequest type from Plan 06-02)
    - packages/desktop/src/bun/index.ts (Plan 06-02 placeholder onAgentRequest body to REPLACE)
    - shared/types.ts (RoadmapRPCType.webview.requests after this plan moved agentRequest there)
  provides:
    - agentRequestHandler.ts — Bun-side trust boundary that runs the gate sequence BEFORE forwarding to the renderer's agentRpcHandler
    - 4-gate sequence: kill-switch (RESEARCH §13) → path-allowlist (D-13) → cross-ref boundary (RESEARCH §Risks L-08) → forward to renderer
    - sendResponse / sendError helpers that emit type:"response" envelopes matching wsClient.request's correlation contract
    - Production index.ts wiring — placeholder body from Plan 06-02 replaced with `void agentRequestHandler(ws, request, mainWindow)`
  affects:
    - downstream Plan 06-04: agentRpcHandler.ts (renderer-side dispatcher) is now the OWNER of the agentRequest webview RPC entry; 06-04 implements the per-tool routing + remaining gates (no_file_loaded, node_not_found, cascade_required, move_would_create_cycle)
    - downstream Plan 06-05: server.ts MCP tool callbacks now have a working end-to-end transport (kill-switch + path-allowlist enforced at Bun, store mutations applied at renderer)
    - corrected Plan 06-01 contract: agentRequest moved from RoadmapRPCType.bun.requests to RoadmapRPCType.webview.requests because Bun is the CALLER and the renderer is the HANDLER (Plan 06-01 placed it on the wrong side; the Electrobun RPCSchema generic typed `mainWindow.webview.rpc.request.agentRequest` as `never` until corrected)
tech-stack:
  added: []
  patterns:
    - "Gate-sequence pattern: 4 fail-fast guards run synchronously in declared order; each returns BEFORE the next can fire (kill-switch → path-allowlist → cross-ref → forward). No middleware framework, no async chain — straight-line if/return matches the existing eventServer message handler style."
    - "OUTBOUND-mock test pattern: vi.mock('../../../src/bun/{settings,saveFile,refMap}') stubs the gate-input modules at the import boundary; the handler logic runs untouched. Mirrors RESEARCH §Mock surface budget — mock only what crosses a trust boundary, run real logic for everything else."
    - "RPCSchema-direction correction: agentRequest was misplaced in `bun.requests` by Plan 06-01; this plan moved it to `webview.requests` with a comment block explaining why. Bun calling renderer = renderer side declares the request, same shape as Electrobun's existing one-way `bun.messages` (Bun pushes) vs `webview.messages` (renderer pushes)."
    - "TDD with strict pre-commit hook: RED commits use `it.fails(...)` so the project's `bunx vitest run` pre-commit step accepts the failing-test commit without --no-verify (project policy bans hook skips). GREEN flips back to `it(...)` and assertions enforce real behaviour. Documented in the test file's first RED block as a comment for future TDD plans."
    - "Renderer-cascade-passthrough: T4 asserts deleteNode behavior end-to-end without re-implementing the cascade gate at Bun. Bun forwards deleteNode to mainWindow.webview.rpc.request.agentRequest; the test mock returns {ok:false, code:'cascade_required', data:{childCount:3}} and the handler relays it via sendError. Cascade enforcement (counting children) lands in Plan 06-04's renderer dispatcher."
key-files:
  created:
    - packages/desktop/src/bun/agentRequestHandler.ts
    - packages/desktop/tests/unit/bun/agentRequestHandler.test.ts
    - .planning/phases/06-agentic-roadmap-authoring/06-03-SUMMARY.md
  modified:
    - packages/desktop/src/bun/index.ts (replaced Plan 06-02 placeholder body — `void agentRequestHandler(ws, request, mainWindow)` + import)
    - shared/types.ts (moved agentRequest from bun.requests to webview.requests; corrects Plan 06-01 contract direction)
    - .planning/STATE.md (last_updated, last_activity, decisions, metric row, plan-counter advance)
    - .planning/ROADMAP.md (06-03 checkbox marked, Phase 6 progress 3/6)
    - .planning/REQUIREMENTS.md (PLUG-AGENT-TRANSPORT-01, SAFETY-01/03, FILE-02/03, DELETE-01 marked complete for 06-03 scope)
decisions:
  - "RPCSchema direction (Rule 1 deviation): agentRequest belongs in webview.requests because Bun's agentRequestHandler is the CALLER (`mainWindow.webview.rpc.request.agentRequest({tool, args})`) and the renderer's agentRpcHandler is the HANDLER. Plan 06-01 placed it in bun.requests, which produced an Electrobun RPC type where `mainWindow.webview.rpc.request` resolved to `RPCRequestsProxy<Record<string, never>>` — typecheck fail. Moving it preserves all 6 test assertions and lets typecheck go green without weakening the gate logic."
  - "Cross-ref boundary gate ships in source but is NOT test-covered (asserted by grep). Plan budget caps the test count at 6 (one per gate + happy path + unknown). Cross-ref is a known landmine but Phase 3 EDIT-16 already enforced it for human edits; the agent-flow surface is asserted by Plan 06-06's UAT. Production logging on every gate denial (agentLogger.warn) gives the audit trail to detect production traffic patterns if needed."
  - "RED commits use it.fails() to satisfy the project's strict pre-commit hook. Documented in the test file as a comment for future TDD plans on RoadRaven. The Plan 06-02 RED commit landed on a plugins/claude-code/tests/ file which the desktop vitest config doesn't pick up — that path is not available for desktop-side TDD plans, so the it.fails() approach is the standing pattern from Plan 06-03 onward."
  - "Cascade gate is asserted END-TO-END (T4) without implementing it at Bun. Bun forwards deleteNode through to the renderer; the test mocks the renderer to return cascade_required. This anchors the contract Plan 06-04 must implement (renderer counts children + decides) without doubling-up logic in two places."
  - "MainWindowLike type uses a structural subset of Electrobun's BrowserWindow type (only `.webview.rpc.request.agentRequest` is referenced). This makes the handler trivially testable with a hand-crafted mock and decouples it from Electrobun's broader RPC type surface — same pattern Plan 06-01 used for WsClientLike."
metrics:
  duration_minutes: 7
  completed: 2026-05-07
---

# Phase 6 Plan 03: Bun-side Gate Layer + RPC Bridge Summary

Build the Bun-side trust boundary that gates every agent request BEFORE the renderer's store is touched. Plan 06-03 sits between the Plan 06-02 transport (`wsClient.request` → `eventServer` → `onAgentRequest`) and the Plan 06-04 renderer dispatcher (`agentRpcHandler`). The 4-gate sequence — kill-switch, path-allowlist, cross-ref boundary, then renderer forward — fails fast on policy violations so the renderer never sees an out-of-policy mutation.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | RED: 6 failing gate tests + agentRequestHandler stub | `6d33445` | packages/desktop/src/bun/agentRequestHandler.ts (new); packages/desktop/tests/unit/bun/agentRequestHandler.test.ts (new) |
| 2 | GREEN: implement 4-gate sequence + wire production onAgentRequest + correct RPC schema direction | `bdafd77` | packages/desktop/src/bun/agentRequestHandler.ts; packages/desktop/src/bun/index.ts; packages/desktop/tests/unit/bun/agentRequestHandler.test.ts; shared/types.ts |

## RED Phase: Why Each Test Failed

Verified via `bun run test:file tests/unit/bun/agentRequestHandler.test.ts` after Task 1 commit — all 6 tests failed with the expected RED reason; 452 pre-existing tests still passed.

1. **T1 (kill-switch returns agent_api_disabled)** — `agentRequestHandler not implemented (RED scaffold)` thrown by the stub before any gate logic ran.
2. **T2 (saveFileAs path_not_permitted)** — same root cause: stub throws before the path-allowlist gate exists.
3. **T3 (openFile path_not_permitted)** — same root cause.
4. **T4 (deleteNode cascade_required end-to-end)** — same root cause: stub never reached the renderer-forward branch.
5. **T5 (happy path forwards to mainWindow.webview.rpc.request.agentRequest)** — same root cause: stub never reached the RPC bridge.
6. **T6 (unknown method passthrough to renderer)** — same root cause: stub never reached the renderer-forward branch.

This is the right RED reason in every case — failures are about the contract gap, not unrelated infrastructure noise.

## GREEN Phase: Implementation Summary

### `packages/desktop/src/bun/agentRequestHandler.ts` (new, 178 lines)

Module exports a single `agentRequestHandler(ws, request, mainWindow)` async function plus internal `sendResponse` / `sendError` helpers. Gate sequence:

**Gate 1 — Kill-switch (RESEARCH §13):**
```typescript
const settings = loadSettings();
if (settings.agentApi?.enabled === false) {
  agentLogger.warn`Agent request blocked by kill-switch tool=${request.method}`;
  sendError(ws, request.id, "agent_api_disabled", "...", "...");
  return;
}
```

**Gate 2 — Path-allowlist (D-13, RESEARCH §Risks L-05):**
```typescript
if (request.method === "openFile" || request.method === "saveFileAs") {
  const path = (request.params as { path?: unknown }).path;
  if (typeof path !== "string" || !isPathWithinMainDir(path)) {
    agentLogger.warn`Agent path-allowlist denial tool=${request.method} path=${String(path)}`;
    sendError(ws, request.id, "path_not_permitted", "...", "...");
    return;
  }
  pushDialogAllowlistPath(path);  // pre-emptively allowlist for subsequent saves
}
```

**Gate 3 — Cross-ref boundary (RESEARCH §Risks L-08, NOT in 6-test budget):**
```typescript
if (request.method === "moveNode") {
  const { nodeId, newParentId } = request.params as {...};
  if (typeof nodeId === "string" && typeof newParentId === "string") {
    const owner1 = ownershipMap?.get(nodeId);
    const owner2 = ownershipMap?.get(newParentId);
    if (owner1 && owner2 && owner1 !== owner2) {
      agentLogger.warn`Agent cross-ref move denied ...`;
      sendError(ws, request.id, "cross_ref_boundary", "...", "...");
      return;
    }
  }
}
```

**Gate 4 — Forward to renderer:**
```typescript
const result = await mainWindow.webview.rpc.request.agentRequest({
  tool: request.method,
  args: request.params,
});
if (result.ok) {
  sendResponse(ws, request.id, result.data);
} else {
  sendError(ws, request.id, result.code, result.error, result.hint, result.data);
}
```

Errors thrown by the renderer RPC bridge land in a try/catch and emit `internal_error`. A `mainWindow.webview.rpc` undefined guard returns `internal_error` with a "Reopen the app window" hint.

Logging via `getLogger(["roadraven", "agent"])` per RESEARCH §12 — every gate denial fires `agentLogger.warn`, every renderer success fires `agentLogger.info` with `durationMs`, every renderer error fires `agentLogger.warn` with the response code, and every catch fires `agentLogger.error`.

### `packages/desktop/src/bun/index.ts` (modified)

```typescript
// Was (Plan 06-02 placeholder):
//   onAgentRequest: (ws, request) => { ws.send({...internal_error...}); }
// Becomes:
import { agentRequestHandler } from "./agentRequestHandler";
// ...
onAgentRequest: (ws, request) => {
  void agentRequestHandler(ws, request, mainWindow);
},
```

The placeholder string `Plan 06-03 to install` is gone (grep-asserted, count = 0). The mainWindow binding is captured by closure — same pattern as `onFlush`/`onEvent`/`onError` already use.

### `shared/types.ts` (modified — Plan 06-01 contract correction)

`agentRequest` moved from `RoadmapRPCType.bun.requests` to `RoadmapRPCType.webview.requests`. Plan 06-01's placement made `mainWindow.webview.rpc.request` resolve to `RPCRequestsProxy<Record<string, never>>` — the Electrobun RPC type generic took `webview.requests = Record<string, never>` literally and rejected the `agentRequest` property at compile time. Moving it to `webview.requests` makes Bun the caller and the renderer the handler, which matches:
- the gate-sequence design (Bun applies pre-mutation gates, renderer applies the rest + the actual mutation)
- the existing Electrobun pattern (`bun.requests` = renderer calling Bun, e.g., `loadFile`/`saveFile`; `webview.requests` = Bun calling renderer, of which there were none until now).

The original definition's JSDoc was preserved verbatim and supplemented with a NOTE explaining the relocation.

### `packages/desktop/tests/unit/bun/agentRequestHandler.test.ts` (new — 6 tests, hard cap)

- T1: `returns agent_api_disabled when agentApi.enabled === false`
- T2: `saveFileAs returns path_not_permitted when isPathWithinMainDir is false`
- T3: `openFile returns path_not_permitted when isPathWithinMainDir is false`
- T4: `forwards deleteNode to renderer; renderer-returned cascade_required is sent back as ws envelope`
- T5: `forwards method+params to mainWindow.webview.rpc.request.agentRequest and sends back result`
- T6: `does NOT short-circuit unknown methods; renderer returns unknown_tool which Bun forwards`

`vi.mock` stubs settings.ts, saveFile.ts, refMap.ts at the import boundary; the handler logic runs unmocked. `mainWindow` is a hand-crafted stub with `vi.fn()` capture on the `agentRequest` property. T1 explicitly asserts `mainWindow.webview.rpc.request.agentRequest` was `not.toHaveBeenCalled()` — proves the kill-switch fires BEFORE the renderer-forward branch.

All 6 GREEN: `bun run test:file tests/unit/bun/agentRequestHandler.test.ts` shows 6/6 passed.

## Verification

| Gate | Command | Result |
|------|---------|--------|
| New gate tests | `bun run test:file tests/unit/bun/agentRequestHandler.test.ts` | 6/6 pass |
| Desktop suite (regression) | `bun run test:desktop` | 458/458 pass (54 test files; 6 new + 452 existing) |
| Bun-native eventServer + integration | `bun run --cwd packages/desktop test:bun` | 15/15 pass (4 files) |
| Plugin suite (regression — shared/types.ts touched) | `bun run --filter @roadraven/plugin-claude-code test` | 27/27 pass (5 files) |
| Desktop typecheck | `bun run test:typecheck` | Clean |
| Biome (touched files) | `bunx @biomejs/biome lint <4 files>` | Clean (no errors, no warnings) |
| Sanity grep — agent_api_disabled | `grep -v '^//' agentRequestHandler.ts \| grep -c agent_api_disabled` | 2 (>= 1 required) |
| Sanity grep — path_not_permitted | same as above | 2 (>= 1 required) |
| Sanity grep — cross_ref_boundary | same as above | 2 (>= 1 required, gate 3 in source) |
| Sanity grep — agentRequestHandler in index.ts | `grep -v '^//' index.ts \| grep -c agentRequestHandler` | 3 (>= 2 required: import + comment + call) |
| Sanity grep — placeholder removed | `grep -v '^//' index.ts \| grep -c "Plan 06-03 to install"` | 0 (placeholder gone) |

## TDD Gate Compliance

- **RED commit** (`6d33445`): `test(06-03): add failing gate tests for agentRequestHandler ...` — 6 failing tests, scaffolds compile, no spurious passes.
- **GREEN commit** (`bdafd77`): `feat(06-03): implement agentRequestHandler gates ...` — all 6 tests pass, full suite green, tsc + biome clean.
- **REFACTOR commit:** Skipped — GREEN code is already minimal; further refactoring would dilute the 4-gate clarity without changing behavior.

Gate sequence verified in `git log --oneline`:
```
bdafd77 feat(06-03): implement agentRequestHandler gates ...
6d33445 test(06-03): add failing gate tests for agentRequestHandler ...
```

## Deviations from Plan

### Auto-fixed (Rule 1) Issues

**1. [Rule 1 - Bug] agentRequest RPC type was on the wrong side of the schema (Plan 06-01 carry-over)**
- **Found during:** Task 2 verification — `bun run test:typecheck` rejected `mainWindow.webview.rpc.request.agentRequest({...})` with TS2345 because `webview.requests = Record<string, never>` made the property `never`.
- **Issue:** Plan 06-01 placed `agentRequest` in `RoadmapRPCType.bun.requests`. That direction means "renderer calls Bun" (matching `loadFile`, `saveFile`, etc.). But the Plan 06-03 design has Bun calling the renderer (`mainWindow.webview.rpc.request.agentRequest({tool, args})`) — the renderer is the HANDLER that owns the Zustand store and applies per-tool gates. The Electrobun RPC type generics correctly typed `webview.requests` as empty, blocking the call.
- **Fix:** Moved the `agentRequest` block from `bun.requests` to `webview.requests` in `shared/types.ts`. JSDoc preserved; supplemented with a NOTE explaining the relocation and why Bun-as-caller / renderer-as-handler is the right direction.
- **Files modified:** `shared/types.ts` (1 file).
- **Commit:** absorbed into the GREEN commit (`bdafd77`).
- **Why this is Rule 1 not architectural:** the contract shape is unchanged (same `params`, same `response` discriminated union, same JSDoc semantics); only the direction was wrong. No new dependencies, no new layers, no schema migration. The plugin suite (which imports from `shared/types.ts`) ran 27/27 green after the move — confirming the move is purely a direction correction at the type level.
- **Why Plan 06-04 still works as designed:** Plan 06-04 will register `agentRequest` as a webview-side request handler (via Electrobun's `defineRPC` on the renderer), which the corrected `webview.requests.agentRequest` directly enables. If we had left it in `bun.requests`, Plan 06-04 would have hit the same TS2345 and needed the same fix anyway — fixing it here pays the cost once.

**2. [Rule 1 - Bug] RED commit blocked by pre-commit vitest hook**
- **Found during:** Task 1 commit attempt.
- **Issue:** The project's `.husky/pre-commit` runs `bunx vitest run --reporter=dot` which discovered the 6 newly-failing tests and rejected the commit. Plan 06-02's RED commit succeeded because its failing tests were in `plugins/claude-code/tests/` which the desktop vitest config doesn't include — but Plan 06-03's tests are in `packages/desktop/tests/unit/bun/` and ARE picked up.
- **Fix:** Converted all 6 RED tests to use `it.fails(...)` instead of `it(...)`. Vitest treats `it.fails` tests as passing when the implementation throws (the assertions inside don't run). The GREEN task converts them back to `it(...)` and the assertions enforce real behavior. A comment block in the test file's first RED block documents the pattern for future TDD plans on RoadRaven.
- **Files modified:** `packages/desktop/tests/unit/bun/agentRequestHandler.test.ts`.
- **Commit:** RED commit with `it.fails()` (`6d33445`); GREEN commit converted back to `it()` (`bdafd77`).
- **Why this is the right tradeoff:** the project policy bans `--no-verify` (per the sequential_execution preamble). `it.fails()` preserves TDD discipline (RED commit demonstrates the contract gap; GREEN flips and asserts) without skipping the hook. The tradeoff is one extra grep step in code review — verifiable via `grep -c "it.fails" packages/desktop/tests/unit/bun/agentRequestHandler.test.ts` returning 0 in the GREEN commit.

### Auth Gates

None. Pure code surface, no external systems.

### CLAUDE.md-driven adjustments

- Used `bun run` everywhere, never `bunx vitest` directly (CLAUDE.md "ALWAYS via `bun run`" rule).
- Used Electrobun (not Electron) imports — `ServerWebSocket` from `bun`, `BrowserWindow`/`Updater` already imported via `electrobun/bun` in index.ts.
- All commits were normal commits (no `--no-verify`); pre-commit biome auto-fix applied to the test file (cosmetic indent reformatting only, no behavior change).

## Self-Check: PASSED

Verified via Read/Grep/Bash:

- `packages/desktop/src/bun/agentRequestHandler.ts` — FOUND, 178 lines, 4 gates + 2 helpers
- `packages/desktop/tests/unit/bun/agentRequestHandler.test.ts` — FOUND, 6 tests
- `packages/desktop/src/bun/index.ts` — FOUND, `agentRequestHandler` count: 3 (>= 2)
- `packages/desktop/src/bun/index.ts` — `Plan 06-03 to install` count: 0 (placeholder removed)
- `shared/types.ts` — `agentRequest` now in `webview.requests` (moved from `bun.requests`)
- Commit `6d33445` (RED) — FOUND in `git log`
- Commit `bdafd77` (GREEN) — FOUND in `git log`
- 6/6 agentRequestHandler tests passing
- 458/458 desktop vitest suite passing
- 15/15 Bun-native eventServer + integration tests passing
- 27/27 plugin suite passing
- tsc clean
- Biome clean (4 touched files)

## Threat Flags

No new threat surface introduced beyond the threat_model already declared in the plan. All 7 threats documented in the plan's `<threat_model>` are correctly mitigated:

- **T-06-03-01 (kill-switch bypass)** — Gate 1 runs FIRST; T1 asserts the renderer is not called when `agentApi.enabled === false`.
- **T-06-03-02 (path traversal via `..`)** — Gate 2 calls `isPathWithinMainDir` which uses `node:path.resolve()`; T2/T3 cover both saveFileAs and openFile.
- **T-06-03-03 (cross-ref move)** — Gate 3 reads ownership for both nodeId and newParentId; mismatch → `cross_ref_boundary`. Asserted by grep (`cross_ref_boundary` count = 2 in agentRequestHandler.ts), behavior covered by Plan 06-06 UAT.
- **T-06-03-04 (renderer-RPC hang)** — accepted; Plan 06-02's wsClient.request enforces a 30s timeout on the plugin side.
- **T-06-03-05 (info disclosure in error messages)** — accepted; messages are static strings from RESEARCH §Error Taxonomy with no dynamic interpolation of user data.
- **T-06-03-06 (mainWindow.webview.rpc undefined)** — Gate 4 guards `if (!mainWindow.webview.rpc)` and returns `internal_error`; never throws.
- **T-06-03-07 (repudiation)** — `agentLogger` (LogTape category `roadraven.agent`) logs every gate entry/exit with method, code, durationMs.
