---
phase: 06-agentic-roadmap-authoring
plan: 04
subsystem: agent-api
tags:
  - renderer
  - zustand
  - dispatch
  - audit
  - tdd
  - phase-6
dependency-graph:
  requires:
    - packages/desktop/src/mainview/store/roadmapStore.ts (existing addChild/renameNode/updateNodeMetadata/etc. mutation actions; findParentAndIndex helper; immutablyReplaceArray helper; bumpStructural helper; liveEventMeta state slice; hasUnsavedEdits helper)
    - packages/desktop/src/mainview/store/eventLogStore.ts (existing appendEvents — drawer audit surface)
    - packages/desktop/src/mainview/rpc.ts (existing Electroview.defineRPC<RoadmapRPCType> instance with empty handlers.requests block)
    - shared/types.ts (RoadmapRPCType.webview.requests.agentRequest entry — moved here by Plan 06-03)
    - packages/core/src/schema.ts (RoadmapNode shape)
    - packages/core/src/plugin.ts (IntegrationEvent shape)
  provides:
    - roadmapStore.moveNode(nodeId, newParentId, position?) action — re-parents a node, no-op when nodeId/newParentId not found
    - agentRpcHandler.ts handleAgentRequest dispatcher — 18-case switch routing every agent tool name to a roadmapStore action with drawer audit emission
    - mergeLiveStatus + walkAndMerge helpers — D-07 live-overlay contract for read tools
    - isDescendantOf cycle-detection helper — gate for moveNode
    - appendAgentDrawerEvent helper — D-09 synthetic IntegrationEvent emission with source="claude-code"
    - rpc.ts handlers.requests.agentRequest — bridges Bun's `mainWindow.webview.rpc.request.agentRequest({tool, args})` to handleAgentRequest
  affects:
    - Plan 06-05 (server.ts): the 18 dispatcher branches are the contract MCP tool registrations call into
    - Plan 06-06 (UAT): scaffold E2E test asserts the full agent-tool → wsClient.request → eventServer → agentRequestHandler → mainWindow.webview.rpc.request.agentRequest → handleAgentRequest → roadmapStore mutation chain works end-to-end
tech-stack:
  added: []
  patterns:
    - "18-case single switch dispatcher: uniform branch shape (look up node → call store action → emit drawer event) keeps the test budget tight (9 tests instead of 18) — TypeScript + roadmapStore.mutations test suite cover per-action correctness"
    - "D-04 PATCH semantics via Object.entries iteration — null=delete, unlisted=preserve. Own-enumerable iteration naturally excludes __proto__/constructor (T-06-04-04 prototype-pollution mitigation)"
    - "D-07 live-overlay merge: mergeLiveStatus + walkAndMerge helpers re-assert the contract at the read-tool boundary even though Phase 4's applyEventBatch already mutates node.status in place — explicit document over implicit invariant"
    - "D-09 drawer audit via appendAgentDrawerEvent helper — source='claude-code' hardcoded in renderer (agents cannot spoof via args); nodeId='__lifecycle__' for file-level ops (createRoadmap, saveFile, saveFileAs, openFile)"
    - "D-12 openFile auto-flush: subscribe-and-resolve pattern with 5s timeout + defensive synchronous re-check (handles test stub case where triggerSave is synchronous and saveState flips before subscribe attaches)"
    - "Cycle detection at dispatcher (not store) via isDescendantOf — keeps moveNode store action minimal; gate runs in agentRpcHandler before delegating"
    - "TDD with strict pre-commit hook: it.fails() in RED, it() in GREEN — Plan 06-03 standing pattern, used here for the 9 tests that live in packages/desktop"
key-files:
  created:
    - packages/desktop/src/mainview/rpc/agentRpcHandler.ts
    - packages/desktop/tests/unit/store/roadmapStore.moveNode.test.ts
    - packages/desktop/tests/unit/mainview/agentRpcHandler.test.ts
    - .planning/phases/06-agentic-roadmap-authoring/06-04-SUMMARY.md
  modified:
    - packages/desktop/src/mainview/store/roadmapStore.ts (moveNode action + State interface entry)
    - packages/desktop/src/mainview/rpc.ts (handlers.requests.agentRequest entry)
    - .planning/REQUIREMENTS.md (PLUG-AGENT-SAFETY-02 marked complete)
    - .planning/ROADMAP.md (06-04 checkbox marked, Phase 6 progress 4/6)
    - .planning/STATE.md (last_updated, last_activity, decisions, metric row)
decisions:
  - "moveNode store action is intentionally minimal — no cycle detection in the action body. The gate runs upstream in agentRpcHandler.ts (isDescendantOf). Same separation Plan 06-03 used for cross-ref boundary (Bun gate, not renderer store)."
  - "Test budget held at 9 (3 store + 6 dispatcher) per the user's anti-sprawl directive. The 18 dispatch branches share a uniform shape (look up node → store action → drawer event); per-branch tests would balloon to 18 without raising the design assurance. SHAPED behaviors tested once each: dispatch routing, PATCH, AND-filter, unknown_tool, live-overlay merge, openFile auto-flush."
  - "mergeLiveStatus is currently a no-op on actual data because Phase 4 applyEventBatch already mutates node.status in place when an event lands. The function exists to document the D-07 contract at the read-tool boundary — if Phase 4's overlay model ever changes (e.g., separate overlay map vs. in-place mutation), the merge logic has a single home rather than scattered across read tools."
  - "openFile D-12 auto-flush uses a 5-second timeout — long enough for normal autosave debounce flush, short enough to prevent indefinite hang if the save fails. On timeout the Promise rejects with 'autosave timeout', which agentRpcHandler does NOT catch (propagates to the agent as a rejected Promise → wsClient.request reject → MCP error response). Phase 3's save-state machine handles persistent error states separately."
  - "rpc.ts handlers.requests.agentRequest dynamic-imports handleAgentRequest — same pattern Plan 06-02 established for the message handlers (avoids circular imports between rpc.ts and roadmapStore.ts via rpc/agentRpcHandler.ts)."
  - "Defensive `expect(...).toBeTypeOf('function')` lines in moveNode tests are RED-phase scaffolding to ensure it.fails() has at least one always-failing assertion in RED. They pass naturally in GREEN (moveNode IS a function) and act as a regression guard."
metrics:
  duration_minutes: 8
  completed: 2026-05-07
---

# Phase 6 Plan 04: Renderer Dispatcher + moveNode Summary

Build the renderer dispatcher (the brain of Phase 6) — single switch mapping every agent tool name to a roadmapStore action and emitting a synthetic IntegrationEvent into the audit drawer (D-09) for every mutating tool. Also adds the new `moveNode` store action (no existing equivalent — Phase 3 only had moveNodeUp/Down within siblings). End of this plan, calling `mainWindow.webview.rpc.request.agentRequest({tool, args})` from Bun (Plan 06-03) executes the right store action and writes a drawer event — Phase 6 is functionally complete pending the MCP tool registrations in Plan 06-05.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | RED: 9 failing tests (3 moveNode + 6 dispatcher) + agentRpcHandler stub | `3bef30b` | packages/desktop/tests/unit/store/roadmapStore.moveNode.test.ts; packages/desktop/tests/unit/mainview/agentRpcHandler.test.ts; packages/desktop/src/mainview/rpc/agentRpcHandler.ts |
| 2 | GREEN: implement moveNode + 18-case dispatcher + rpc.ts agentRequest handler | `f1315a8` | packages/desktop/src/mainview/store/roadmapStore.ts; packages/desktop/src/mainview/rpc/agentRpcHandler.ts; packages/desktop/src/mainview/rpc.ts; both test files (it.fails → it) |

## RED Phase: Why Each Test Failed

Verified via `bun run test:file` after Task 1 commit — all 9 tests in `it.fails()` mode (vitest treats expected-fail tests as passing during RED so the strict pre-commit `bunx vitest run` hook accepts the commit; same pattern as Plan 06-03).

**moveNode store tests (3):**
1. **Inserts at given position when moving to new parent** — `useRoadmapStore.getState().moveNode is not a function` (action did not exist on the State interface).
2. **No-op when newParentId does not exist** — same root cause; the second `expect(...).toBeTypeOf('function')` assertion is a defensive regression guard.
3. **No-op when nodeId does not exist** — same root cause as test 2.

**agentRpcHandler dispatcher tests (6):**
1. **createNode dispatches to addChild + emits drawer event** — `Error: handleAgentRequest not implemented (RED scaffold)` thrown by the stub before any branch logic ran.
2. **updateNodeMetadata PATCH semantics (D-04)** — same root cause: stub never reached the metadata-merge branch.
3. **findNodes AND-filter case-insensitive (D-03)** — same root cause: stub never reached the walk+filter branch.
4. **Unknown tool returns code='unknown_tool'** — same root cause: stub threw before reaching the default branch.
5. **D-07 live-overlay merge for findNodes** — same root cause: stub never reached the mergeLiveStatus call.
6. **D-12 openFile auto-flushes pending autosave** — same root cause: stub never reached the triggerSave + saveState waiter block.

This is the right RED reason in every case — failures pin the contract gap, not infrastructure noise.

## GREEN Phase: Implementation Summary

### `packages/desktop/src/mainview/store/roadmapStore.ts` (modified)

**State interface:** added `moveNode: (nodeId: string, newParentId: string, position?: number) => void;` after `moveNodeDown`.

**Action implementation** (placed after `moveNodeDown`, before `renameNode`):

```typescript
moveNode: (nodeId, newParentId, position) => {
    const schema = get().schema;
    if (!schema) return;
    const nodes = schema.nodes;
    const found = findParentAndIndex(nodes, nodeId);
    if (!found) return;
    if (!get().nodeIndex.get(newParentId)) return;
    const node = found.parentArray[found.index];
    const currentParentId = found.parent ? found.parent.id : null;
    const nodesAfterRemove = immutablyReplaceArray(nodes, currentParentId, (arr) => {
        const copy = [...arr];
        copy.splice(found.index, 1);
        return copy;
    });
    const nextNodes = immutablyReplaceArray(nodesAfterRemove, newParentId, (arr) => {
        const copy = [...arr];
        const pos = position !== undefined ? Math.min(position, copy.length) : copy.length;
        copy.splice(pos, 0, node);
        return copy;
    });
    bumpStructural(nextNodes);
},
```

Cycle detection and cross-$ref boundary check are deliberately NOT in this action — those gates run upstream in agentRpcHandler.ts (cycle) and agentRequestHandler.ts (cross-ref). The action is a pure structural mutation; same separation as moveNodeUp/Down but with arbitrary parent vs. sibling neighbors.

### `packages/desktop/src/mainview/rpc/agentRpcHandler.ts` (new, 478 lines)

The renderer dispatcher. Module exports:

- `handleAgentRequest(tool, args): Promise<AgentResult>` — async dispatcher with 18-case switch.
- `AgentResult` discriminated union — `{ ok: true; data: unknown } | { ok: false; error; code; hint?; data? }`.

**Internal helpers:**

- `isDescendantOf(rootNodeId, candidateId, nodeIndex)` — DFS walk for moveNode cycle gate.
- `matchesFilter(node, parentId, filter)` — D-03 AND-filter (titleContains case-insensitive, status, type, parentId, metaKey/metaValue).
- `walkNodes(nodes, parentId, visit)` — recursive tree walk for findNodes.
- `mergeLiveStatus(node, liveEventMeta)` — D-07 live-overlay merge contract (re-asserts that Phase 4's applyEventBatch in-place mutation is the merged value, with the 30s window enforced).
- `walkAndMerge(root, liveEventMeta)` — recursive variant for getRoadmap.
- `buildAncestorIds(schema, targetId)` — DFS walker producing parentId + ancestorIds for getNode.
- `appendAgentDrawerEvent(tool, nodeId, args, store, eventLogStore)` — D-09 synthetic IntegrationEvent emission. `source="claude-code"` hardcoded; `nodeId="__lifecycle__"` for file-level ops.

**Pre-switch gates:**

1. **no_file_loaded (D-06)** — fires when `schema === null` AND tool is not in `SCHEMA_OPTIONAL = {createRoadmap, getOpenFile}`.

**Switch cases (18 total):**

| Tool | Branch behavior |
|------|----------------|
| `getRoadmap` | walkAndMerge → returns `{ schema, filePath, isUntitled }` |
| `getNode` | nodeIndex check → node_not_found; mergeLiveStatus + buildAncestorIds → returns `{ node, parentId, ancestorIds }` |
| `findNodes` | walkNodes + matchesFilter (AND-combined, case-insensitive titleContains, mergeLiveStatus on each match) → returns `{ nodes }` |
| `getStatusConfig` | returns `{ statusConfig: schema.statusConfig ?? [] }` |
| `getTypeConfig` | returns `{ typeConfig: schema.typeConfig ?? [] }` |
| `getOpenFile` | returns `{ filePath, isUntitled, title, nodeCount }` (no schema gate) |
| `createNode` | store.addChild → null → node_not_found; optional in-place setters (status/type/notes/metadata); emit drawer event; returns `{ nodeId }` |
| `createRoadmap` | store.newUntitledSchema; optional title/configs override; emit drawer event with `__lifecycle__`; returns `{ schema, isUntitled: true }` |
| `renameNode` | nodeIndex check; store.renameNode; emit drawer event |
| `updateNodeStatus` | nodeIndex check; store.updateNodeStatus; emit drawer event |
| `updateNodeType` | nodeIndex check; store.updateNodeType; emit drawer event |
| `updateNodeNotes` | nodeIndex check; store.updateNodeNotes; emit drawer event |
| `updateNodeMetadata` | **D-04 PATCH:** read current metadata → for each (k,v) in Object.entries(patch): `null` → delete; else set. Call store.updateNodeMetadata(nodeId, next); emit drawer event; returns `{ metadata: next }` |
| `moveNode` | nodeIndex check on both nodes; isDescendantOf → move_would_create_cycle; store.moveNode; emit drawer event |
| `deleteNode` | nodeIndex check; isTopLevel + nodes.length===1 → cannot_delete_last_root; childCount > 0 + !cascade → cascade_required (returns `{ childCount }`); store.deleteNode; emit drawer event; returns `{ deletedCount }` |
| `saveFile` | store.triggerSave; emit drawer event with `__lifecycle__` |
| `saveFileAs` | electroview.rpc.request.saveFileAs({schema}); emit drawer event; user-cancel → save_error |
| `openFile` | **D-12 auto-flush:** if hasUnsavedEdits → triggerSave + subscribe-and-resolve on saveState===saved (5s timeout); then electroview.rpc.request.loadFile({path}); emit drawer event; null data → file_read_error |
| **default** | returns `{ ok: false, code: "unknown_tool", error: ..., hint: "Update the plugin to a version that matches the app." }` |

### `packages/desktop/src/mainview/rpc.ts` (modified)

Added `agentRequest` handler to `handlers.requests` (was empty `{}`):

```typescript
agentRequest: async ({ tool, args }) => {
    const { handleAgentRequest } = await import("./rpc/agentRpcHandler");
    return handleAgentRequest(tool, args);
},
```

Dynamic import matches the existing message-handler pattern (rpcHandlers.ts) and avoids circular dependencies between rpc.ts ↔ roadmapStore.ts via the rpc/agentRpcHandler.ts intermediary.

### `packages/desktop/tests/unit/store/roadmapStore.moveNode.test.ts` (new — 3 tests)

- T1: inserts at given position when moving to new parent (Child A1 from Root A → Root B at position 0)
- T2: no-op when newParentId does not exist (snapshot equality before/after)
- T3: no-op when nodeId does not exist (snapshot equality before/after)

### `packages/desktop/tests/unit/mainview/agentRpcHandler.test.ts` (new — 6 tests)

- T1: createNode dispatches to addChild AND emits drawer event with `source='claude-code'` and `meta.tool='createNode'`
- T2: updateNodeMetadata PATCH — `null` value deletes key; unlisted keys preserved (D-04)
- T3: findNodes AND-combines `titleContains` (case-insensitive — input "LOG") with `status="in-progress"` filters (D-03)
- T4: returns `code='unknown_tool'` for unrecognized method names
- T5: D-07 live-overlay merge — findNodes finds nodes whose live-overlay status is in-progress even when authored status differs (Logout cleanup overlaid via `target.status='in-progress'` + `liveEventMeta` recent timestamp)
- T6: D-12 openFile auto-flushes when `hasUnsavedEdits()` is true — `triggerSave` invoked, electroview RPC mocked, result returns ok

All 9 GREEN: `bun run test:file` shows 3/3 + 6/6 passed; full desktop suite 467/467 passed.

## Verification

| Gate | Command | Result |
|------|---------|--------|
| moveNode tests | `bun run test:file tests/unit/store/roadmapStore.moveNode.test.ts` | 3/3 pass |
| Dispatcher tests | `bun run test:file tests/unit/mainview/agentRpcHandler.test.ts` | 6/6 pass |
| Mutations regression | `bun run test:file tests/unit/store/roadmapStore.mutations.test.ts` | 34/34 pass |
| agentRequestHandler regression | `bun run test:file tests/unit/bun/agentRequestHandler.test.ts` | 6/6 pass (Plan 06-03 still green) |
| Full desktop suite | `bun run test:desktop` | 467/467 pass (56 test files) |
| Desktop typecheck | `bun run test:typecheck` | Clean |
| Sanity grep — moveNode: in store | `grep -c "moveNode:"` (excluding `^//`) | 2 (interface + action; >= 2 required) |
| Sanity grep — case branches in dispatcher | `grep -c '^\s+case "'` in agentRpcHandler.ts | 18 (>= 18 required) |
| Sanity grep — appendAgentDrawerEvent | `grep -c appendAgentDrawerEvent` in agentRpcHandler.ts | 13 (1 declaration + 12 mutating tool invocations) |
| Sanity grep — agentRequest: in rpc.ts | `grep -c "agentRequest:"` | 1 (>= 1 required) |

## TDD Gate Compliance

- **RED commit** (`3bef30b`): `test(06-04): add failing tests for roadmapStore.moveNode (3) + agentRpcHandler dispatcher (6)` — 9 tests in `it.fails()` mode (vitest expected-fail = passing); pre-commit hook accepted; scaffolds compile.
- **GREEN commit** (`f1315a8`): `feat(06-04): implement renderer dispatcher (handleAgentRequest) + moveNode store action + rpc agentRequest handler` — `it.fails` flipped to `it`; all 9 tests pass; full suite 467/467 green; tsc + biome clean.
- **REFACTOR commit:** Skipped — GREEN code is already minimal; further refactoring would dilute the 18-case clarity without behavior change.

Gate sequence verified in `git log --oneline`:
```
f1315a8 feat(06-04): implement renderer dispatcher (handleAgentRequest) + moveNode store action + rpc agentRequest handler
3bef30b test(06-04): add failing tests for roadmapStore.moveNode (3) + agentRpcHandler dispatcher (6)
```

## Deviations from Plan

### CLAUDE.md-driven adjustments

- Used `bun run test:file` (workspace runner) per CLAUDE.md "ALWAYS via `bun run`, never `bunx vitest` directly" rule.
- Used Electrobun (not Electron) imports (`Electroview` from `electrobun/view`).
- All commits were normal commits (no `--no-verify`); pre-commit biome auto-fix applied to the test files (cosmetic line-break reformatting only — multi-line `it.fails(...)` calls collapsed to single lines).

### Auto-fixed Issues

None during this plan — the 9-test budget was raised from 7 to 9 in the plan itself (D-07 + D-12 explicit coverage), and the implementation followed the plan verbatim.

### Auth Gates

None. Pure code surface, no external systems.

### Plan-vs-Implementation Notes (informational, not deviations)

- **Test count raised in PLAN already** (frontmatter line 50): `Test budget: 9 total (3 moveNode + 6 dispatcher) — raised from 7 to cover D-07 live-overlay and D-12 auto-flush, both locked decisions with functional behavior contracts.` So the 9 implemented tests match the PLAN's frontmatter, not its `<verify>` block (which still says "3 + 4 = 7"). The frontmatter is the contract.
- **Cycle case is grep-asserted, not behavior-tested** per the PLAN's success criteria (line 1264): "Cycle detection in source for moveNode (grep-asserted in 06-04 source; test would require a third moveNode case which exceeds budget)". The `case "moveNode"` branch in agentRpcHandler.ts contains `isDescendantOf(...)` → `move_would_create_cycle` — verified by grep in source.

## Self-Check: PASSED

Verified via Read/Grep/Bash:

- `packages/desktop/src/mainview/rpc/agentRpcHandler.ts` — FOUND
- `packages/desktop/tests/unit/store/roadmapStore.moveNode.test.ts` — FOUND
- `packages/desktop/tests/unit/mainview/agentRpcHandler.test.ts` — FOUND
- `packages/desktop/src/mainview/store/roadmapStore.ts` — `moveNode:` count: 2 (>= 2)
- `packages/desktop/src/mainview/rpc.ts` — `agentRequest:` count: 1 (>= 1)
- `packages/desktop/src/mainview/rpc/agentRpcHandler.ts` — `case "` count: 18 (= 18 expected)
- `packages/desktop/src/mainview/rpc/agentRpcHandler.ts` — `appendAgentDrawerEvent` count: 13 (1 decl + 12 mutating-tool calls)
- Commit `3bef30b` (RED) — FOUND in `git log`
- Commit `f1315a8` (GREEN) — FOUND in `git log`
- 3/3 moveNode tests passing
- 6/6 dispatcher tests passing
- 34/34 existing mutations tests passing
- 6/6 existing agentRequestHandler tests passing (Plan 06-03 not regressed)
- 467/467 full desktop suite passing
- tsc clean (desktop)

## Threat Flags

No new threat surface introduced beyond the threat_model already declared in the plan. All 7 threats documented in the plan's `<threat_model>` are correctly mitigated:

- **T-06-04-01 (Tool name `__proto__` / `constructor` routing)** — switch on string keys with explicit cases; default branch returns unknown_tool. T4 (unknown_tool test) covers the default branch.
- **T-06-04-02 (Drawer audit row source spoofing)** — accepted; `source` field is hardcoded "claude-code" in `appendAgentDrawerEvent`, agents cannot override (set in renderer, not from request args). T1 (createNode dispatch test) asserts `rows[0].source === "claude-code"`.
- **T-06-04-03 (moveNode cycle creating tree corruption)** — `isDescendantOf` check before `store.moveNode` returns `move_would_create_cycle`. Grep-asserted in source; test budget covers no-op cases instead.
- **T-06-04-04 (updateNodeMetadata prototype pollution)** — `next = { ...current }` creates fresh object; `for (const [k, v] of Object.entries(patch))` iterates own enumerable properties only — `__proto__`/`constructor` keys naturally not iterated. T2 (PATCH test) covers null=delete and unlisted-preserved.
- **T-06-04-05 (findNodes returns $ref-resolved subtree)** — accepted; Phase 3 D-13 already established that resolved $ref nodes are part of the loaded roadmap.
- **T-06-04-06 (Large schema → walk performance)** — accepted; Phase 2 D-03 perf gate validated 300+ nodes at 30fps; agent walks are one-shot, not animated.
- **T-06-04-07 (Agent claims mutation was user action)** — Drawer row `source="claude-code"` + `meta.tool` is the audit trail. `eventLogStore.appendEvents` append is non-bypassable from the dispatcher branch. T1 confirms.
