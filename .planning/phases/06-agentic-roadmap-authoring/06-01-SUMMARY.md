---
phase: 06-agentic-roadmap-authoring
plan: 01
subsystem: agent-api
tags:
  - mcp
  - zod
  - error-taxonomy
  - tdd
  - phase-6
dependency-graph:
  requires:
    - shared/types.ts (existing AppSettings + RoadmapRPCType)
    - packages/core/src/schema.ts (StatusConfigSchema, TypeConfigSchema)
    - plugins/claude-code/src/sentinel.ts (readSentinel for transport-failure branch)
  provides:
    - AGENT_ERROR_CODES tuple + AgentErrorCode type (single source of truth, 13 codes)
    - 12 Zod input schemas for agent tools (FindNodes, CreateNode, UpdateNodeMetadata, DeleteNode, MoveNode, etc.)
    - agentToolCallback shared MCP registerTool helper
    - RoadmapRPCType.bun.requests.agentRequest entry
    - AppSettings.agentApi.enabled kill-switch field
  affects:
    - downstream Plan 06-02 (wsClient.request shape — already consumed by agentToolCallback)
    - downstream Plan 06-03 (agentRequestHandler imports AGENT_ERROR_CODES + AgentErrorCode)
    - downstream Plan 06-04 (agentRpcHandler imports the schemas + error codes)
    - downstream Plan 06-05 (server.ts registers 17 net-new tools via agentToolCallback)
tech-stack:
  added: []
  patterns:
    - "Const-tuple-as-enum: `AGENT_ERROR_CODES = [...] as const` + `type AgentErrorCode = (typeof AGENT_ERROR_CODES)[number]` — gives both runtime tuple (for length-13 assertion) and compile-time string union"
    - "Zod v4 z.record(z.string(), z.unknown()) explicit-key pattern — Phase 2 D-26 lesson carried forward to UpdateNodeMetadataInputSchema with z.unknown().nullable() value"
    - "MCP-result discriminator: success → text/JSON content; error → text + isError:true (matches existing updateNodeStatus tool — Phase 4 carry-forward)"
    - "Structured-error vs transport-error split in agentToolCallback: code-bearing errors format directly; code-less errors fall back to sentinel for app-not-running detection"
key-files:
  created:
    - plugins/claude-code/src/tools/errors.ts
    - plugins/claude-code/src/tools/schemas.ts
    - plugins/claude-code/src/tools/agentToolCallback.ts
    - plugins/claude-code/tests/agent-contracts.test.ts
    - .planning/phases/06-agentic-roadmap-authoring/06-01-SUMMARY.md
  modified:
    - shared/types.ts (AppSettings.agentApi + RoadmapRPCType.bun.requests.agentRequest)
    - .planning/REQUIREMENTS.md (PLUG-AGENT-* requirement IDs marked complete for Plan 01 scope)
    - .planning/ROADMAP.md (06-01 checked, Phase 6 progress 1/6)
    - .planning/STATE.md (last_updated, last_activity, decisions, metric row)
decisions:
  - "AGENT_ERROR_CODES tuple is the canonical taxonomy (D-11/D-12/D-13 + RESEARCH §9). Bun + renderer handlers import it; redeclaring would drift the contract."
  - "WsClientLike in agentToolCallback is non-generic (Promise<unknown>) so test stubs and any production wsClient implementation satisfy it without per-call type narrowing — the helper serializes the result through JSON.stringify regardless."
  - "agentToolCallback distinguishes structured errors (have a `code` field, format per RESEARCH §9) from transport failures (no `code`, consult sentinel). This prevents spurious 'app not running' messages when the Bun handler returns a structured error."
  - "schemas.ts imports StatusConfigSchema/TypeConfigSchema via relative path (../../../../packages/core/src/schema) rather than @roadraven/core workspace alias — plugins/claude-code does not yet declare core as a dependency, and adding the dep here would expand scope beyond the contract-only plan."
  - "biome auto-fix during pre-commit hook reformatted whitespace and converted import { z } to import type { z } in the RED scaffold — accepted (no behaviour change)."
metrics:
  duration_minutes: 5
  completed: 2026-05-07
---

# Phase 6 Plan 01: Foundation Contracts Summary

Lock the entire Phase 6 contract surface — RPC type, error taxonomy, Zod input schemas, shared MCP callback helper — in one TDD plan with a frozen 5-test budget so Plans 06-02..06-06 build against fixed shapes instead of guessing them from prose.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | RED: 5 failing contract tests + 3 scaffold files | `3177bf1` | plugins/claude-code/tests/agent-contracts.test.ts; plugins/claude-code/src/tools/{errors,schemas,agentToolCallback}.ts |
| 2 | GREEN: implement contracts (RPC type, taxonomy, schemas, callback) | `e26043f` | shared/types.ts; plugins/claude-code/src/tools/{errors,schemas,agentToolCallback}.ts |

## RED Phase: Why Each Test Failed

Verified via `bun run --filter @roadraven/plugin-claude-code test` after Task 1 commit — 5 tests failed, 19 pre-existing tests still passed.

1. **AgentErrorCode enum (test 1)** — `AGENT_ERROR_CODES.length` was 0 (scaffold was `[] as const`); the assertion `.toBe(13)` failed and the `Set` comparison rejected the empty source.
2. **FindNodesInputSchema (test 2)** — `import { FindNodesInputSchema }` returned `undefined` because schemas.ts only exported a placeholder `_ZodPlaceholder` type; calling `.safeParse(...)` on undefined raised `TypeError: Cannot read properties of undefined (reading 'safeParse')`.
3. **UpdateNodeMetadataInputSchema (test 3)** — same root cause as test 2: schema not yet exported.
4. **DeleteNodeInputSchema (test 4)** — same root cause as test 2: schema not yet exported.
5. **agentToolCallback (test 5)** — the scaffold threw `Error: agentToolCallback not implemented` when invoked; the test caught it as an uncaught throw inside `await okCb(...)`, never reaching the success-shape assertion.

This is the right RED reason in every case — failures are about the contract gap, not unrelated infrastructure noise.

## GREEN Phase: Implementation Summary

### `shared/types.ts` (modified)

- Added `agentApi?: { enabled?: boolean }` to `AppSettings` after the `eventApi` block. Mirrors the eventApi optional-object pattern (RESEARCH §13 kill-switch).
- Added `agentRequest` entry to `RoadmapRPCType.bun.requests` with the `{ ok: true, data: unknown } | { ok: false, error: string, code: string, hint?: string, data?: unknown }` discriminated response (D-15/D-16). Single dispatcher entry vs 17 per-tool entries keeps the type lean.

### `plugins/claude-code/src/tools/errors.ts`

- `AGENT_ERROR_CODES` const-tuple of the 13 RESEARCH §9 codes in the verbatim order from the Error Taxonomy table.
- `AgentErrorCode` derived as `(typeof AGENT_ERROR_CODES)[number]` — both runtime and compile-time enforcement.
- `AgentErrorPayload` convenience interface for structured returns from the Bun side (Plan 06-03 will import this).

### `plugins/claude-code/src/tools/schemas.ts`

- 12 Zod input schemas: `GetNodeInputSchema`, `FindNodesInputSchema`, `CreateNodeInputSchema`, `CreateRoadmapInputSchema`, `RenameNodeInputSchema`, `UpdateNodeTypeInputSchema`, `UpdateNodeNotesInputSchema`, `UpdateNodeMetadataInputSchema`, `MoveNodeInputSchema`, `DeleteNodeInputSchema`, `SaveFileAsInputSchema`, `OpenFileInputSchema`.
- `nodeId` fields use `z.string().uuid()` (matches RoadmapNodeSchema.id per RESEARCH §11).
- `status` and `type` fields use `z.string().min(1)` not a fixed enum — Phase 4 D-26 user-defined statuses must be accepted.
- `UpdateNodeMetadataInputSchema.patch` uses `z.record(z.string(), z.unknown().nullable())` — null value = delete that key (D-04 PATCH semantics).
- `DeleteNodeInputSchema.cascade` is optional boolean — D-11 cascade gate is enforced in the handler, not the schema.
- Imports `StatusConfigSchema` and `TypeConfigSchema` via relative path from `packages/core/src/schema` since plugins/claude-code lacks a workspace dep on @roadraven/core.

### `plugins/claude-code/src/tools/agentToolCallback.ts`

- `agentToolCallback(method, wsClient)` returns an async callback suitable for `server.registerTool`'s third positional argument.
- **Success path:** `JSON.stringify(result, null, 2)` wrapped in `{ content: [{ type: "text", text: ... }] }`.
- **Structured-error path** (error has a `code` string): formats per RESEARCH §9 as `Error (<code>): <msg> <hint?>` with `isError: true`.
- **Transport-failure path** (error has no `code`): consults `readSentinel()`. Sentinel missing → static "Roadmap Viewer is not running" message; sentinel present → falls through to `Error (internal_error): <msg>`.
- `WsClientLike` is intentionally non-generic so the callback compiles against any test stub or the real wsClient produced by Plan 06-02.

### `plugins/claude-code/tests/agent-contracts.test.ts`

- 5 tests in 5 describe blocks. **Hard cap**: do not extend in this plan.
- All 5 GREEN: `bun run --filter @roadraven/plugin-claude-code test` shows 4 test files passed (24 / 24 tests).

## Verification

| Gate | Command | Result |
|------|---------|--------|
| Plugin tests | `bun run --filter @roadraven/plugin-claude-code test` | 24/24 pass (5 new + 19 existing) |
| Desktop tsc | `bun run test:typecheck` | Clean |
| Plugin tsc | `bunx tsc --noEmit` (in plugins/claude-code) | Clean |
| Biome lint | `bunx @biomejs/biome lint plugins/claude-code/src/tools shared/types.ts plugins/claude-code/tests/agent-contracts.test.ts` | Clean |
| Sanity grep — REQUIREMENTS | `PLUG-AGENT-` count in REQUIREMENTS.md | 33 (>= 23 required; IDs appear in section + traceability) |
| Sanity grep — agentRequest | `agentRequest:` in shared/types.ts | 1 match (line 129, inside bun.requests) |
| Sanity grep — agentApi | `agentApi?:` in shared/types.ts | 1 match (line 37, inside AppSettings) |
| Sanity grep — codes export | `AGENT_ERROR_CODES` in errors.ts | 2 matches (export const + type alias) |

## TDD Gate Compliance

- **RED commit** (`3177bf1`): `test(06-01): add failing contract tests …` — 5 failing tests, scaffolds compile, no spurious passes.
- **GREEN commit** (`e26043f`): `feat(06-01): implement agent contracts …` — all 5 tests pass, tsc + biome clean.
- **REFACTOR commit:** Skipped — GREEN code is already minimal (per plan success_criteria 7).

Gate sequence verified in `git log --oneline -3`.

## Deviations from Plan

### Auto-fixed (Rule 1 / Rule 3) Issues

**1. [Rule 3 - Blocking] Plugin tsc rejected stub `wsClient` in test 5**
- **Found during:** Task 2 verification (`bunx tsc --noEmit`)
- **Issue:** `WsClientLike.request<T>(...)` was generic, but the test stub returned `Promise<unknown>`. Strict TypeScript rejected the assignment because `'T' could be instantiated with an arbitrary type which could be unrelated to 'unknown'`.
- **Fix:** Removed the generic from `WsClientLike` — the callback never narrows the result type (it serializes through `JSON.stringify`), so `Promise<unknown>` is the right level of abstraction. Documented the choice in the type's JSDoc.
- **Files modified:** plugins/claude-code/src/tools/agentToolCallback.ts
- **Commit:** absorbed into the GREEN commit (`e26043f`)

**2. [Rule 1 - Bug] Original error-distinguishing logic mis-routed structured errors**
- **Found during:** Task 2 — re-reading the test 5 expectations against the plan's recommended implementation.
- **Issue:** The plan's pseudocode called `readSentinel()` BEFORE distinguishing structured-error vs transport-error. In the test environment (no actual app running), `readSentinel` would return `{ ok: false }` and the callback would short-circuit to "Roadmap Viewer is not running" — masking the structured `node_not_found` error the test expects.
- **Fix:** Reordered the catch block to check for `e.code` FIRST. If a code is present, format the structured error directly (we know the Bun handler returned it intentionally). Only fall back to sentinel-check when no code is present (true transport failure).
- **Files modified:** plugins/claude-code/src/tools/agentToolCallback.ts
- **Commit:** part of the GREEN commit (`e26043f`)
- **Why this matters downstream:** Plan 06-02 will implement `wsClient.request` to attach `code`/`hint`/`message` from the structured error frame to the rejection's Error object. agentToolCallback then formats those automatically — exactly the path test 5 exercises.

### Auth Gates

None. Pure code surface, no external systems.

### CLAUDE.md-driven adjustments

- Used `bun run --filter @roadraven/plugin-claude-code test` (workspace runner) per CLAUDE.md "ALWAYS via `bun run`, never `bunx vitest` directly" rule. Standalone `bun run test:file` only routes to packages/desktop, so the workspace filter is the right escape hatch for plugin tests.

## Self-Check: PASSED

Verified via Read/Grep:

- `plugins/claude-code/src/tools/errors.ts` — FOUND
- `plugins/claude-code/src/tools/schemas.ts` — FOUND
- `plugins/claude-code/src/tools/agentToolCallback.ts` — FOUND
- `plugins/claude-code/tests/agent-contracts.test.ts` — FOUND
- Commit `3177bf1` (RED) — FOUND in `git log`
- Commit `e26043f` (GREEN) — FOUND in `git log`
- 5/5 contract tests passing
- tsc clean (desktop + plugin)
- Biome clean

## Threat Flags

No new threat surface introduced beyond the threat_model already declared in the plan. The Zod schemas in schemas.ts are themselves the mitigation for T-06-01-01 (tool-input tampering); the AGENT_ERROR_CODES single-export pattern is the mitigation for T-06-01-03 (taxonomy drift). Kill-switch enforcement (T-06-01-04) is correctly DEFERRED to Plan 06-03 — this plan only defined the type field, as the threat model anticipated.
