---
phase: 04
plan: 01
subsystem: event-api
tags: [rpc-contract, types, test-scaffolding, wave-0, dependencies]
dependency_graph:
  requires: []
  provides:
    - "shared/types.ts — batched pushStatusUpdate union, setNodeAllowlist request, pushEventApiState/Error messages"
    - "packages/core/src/plugin.ts — IntegrationEvent._error classification field"
    - "All 23 Wave 0 test stubs (it.todo) for Plans 04-02..04-05"
    - "@tanstack/react-virtual@3.13.24 in packages/desktop"
    - "@modelcontextprotocol/sdk@1.29.0 + zod@4.3.6 + vitest@4.1.4 in plugins/claude-code"
    - "plugins/claude-code/vitest.config.ts"
  affects:
    - "packages/desktop/src/mainview/rpc.ts — widened union keeps no-op handler compiling (no callsite changes)"
    - "packages/desktop/tests/ — 20 new Phase 4 stub files added"
    - "plugins/claude-code/tests/ — 3 new stub files added"
tech_stack:
  added:
    - "@tanstack/react-virtual@3.13.24 (packages/desktop dep)"
    - "@modelcontextprotocol/sdk@1.29.0 (plugins/claude-code dep)"
    - "zod@4.3.6 (plugins/claude-code dep)"
    - "vitest@4.1.4 (plugins/claude-code devDep)"
    - "typescript@^5 (plugins/claude-code devDep)"
    - "@types/node@^22 (plugins/claude-code devDep)"
  patterns:
    - "it.todo() for Wave 0 stubs — surfaces in Vitest output as pending, not silent skips"
    - "Commented-out imports for not-yet-existing modules — keeps typecheck green"
    - "Real assertions (not todo) for PLUG-09 schema tests — schema already permissive"
key_files:
  created:
    - plugins/claude-code/vitest.config.ts
    - packages/desktop/tests/unit/bun/eventSchema.test.ts
    - packages/desktop/tests/unit/bun/eventCoalescer.test.ts
    - packages/desktop/tests/unit/bun/eventsLog.test.ts
    - packages/desktop/tests/unit/bun/sentinel.test.ts
    - packages/desktop/tests/unit/bun/eventServer.test.ts
    - packages/desktop/tests/unit/bun/eventServer.eaddrinuse.test.ts
    - packages/desktop/tests/integration/eventApi.test.ts
    - packages/desktop/tests/integration/eventApi-e2e.test.ts
    - packages/desktop/tests/integration/eventLog-selection.test.ts
    - packages/desktop/tests/unit/store/roadmapStore.applyEventBatch.test.ts
    - packages/desktop/tests/unit/store/roadmapStore.liveIndicator.test.ts
    - packages/desktop/tests/unit/store/eventApiStore.test.ts
    - packages/desktop/tests/unit/store/eventLogStore.test.ts
    - packages/desktop/tests/unit/ui/IntegrationZone.test.tsx
    - packages/desktop/tests/unit/ui/EventToast.test.tsx
    - packages/desktop/tests/unit/ui/EventLogDrawer.test.tsx
    - packages/desktop/tests/unit/ui/EventLogFilterBar.test.tsx
    - packages/desktop/tests/unit/ui/StatusBarEventPill.test.tsx
    - packages/desktop/tests/unit/hooks/useKeyboardRouter.drawer.test.ts
    - plugins/claude-code/tests/userData.test.ts
    - plugins/claude-code/tests/sentinel.test.ts
    - plugins/claude-code/tests/wsClient.test.ts
  modified:
    - shared/types.ts
    - packages/core/src/plugin.ts
    - packages/desktop/package.json
    - packages/desktop/tests/unit/schema.test.ts
    - plugins/claude-code/package.json
    - bun.lock
decisions:
  - "I-07 resolved by widening pushStatusUpdate to a union type — legacy single-node shape retained for Wave 0 build-green; Plan 04-03 Task 1 removes it after all senders migrate to the batched shape"
  - "it.todo() chosen over it.skip() — surfaces pending tests in Vitest output so Wave 1+ implementors see them"
  - "PLUG-09 schema tests use real assertions (not todo) since RoadmapNodeSchema already has z.unknown().optional() for plugin/subscribe"
  - "plugins/claude-code/package.json pinned versions match RESEARCH §6.6 verbatim — @modelcontextprotocol/sdk@1.29.0, zod@4.3.6, vitest@4.1.4"
metrics:
  duration: "~12 minutes"
  completed: "2026-04-23"
  tasks_completed: 2
  tasks_total: 2
  files_created: 24
  files_modified: 6
---

# Phase 04 Plan 01: Wave 0 Scaffolding Summary

**One-liner:** RPC contract widened with batched pushStatusUpdate union + setNodeAllowlist + pushEventApiState/Error; IntegrationEvent extended with _error field; 23 Wave 0 test stubs created with it.todo() pattern; @tanstack/react-virtual and MCP SDK dependencies installed.

## What Was Built

Wave 0 scaffolding for Phase 4 Event API. No implementation code — only contracts, test stubs, and dependencies to unlock parallel execution of Waves 1, 2, and 3.

### Task 1: RPC Contract + Dependencies

**`shared/types.ts` changes:**
- `pushStatusUpdate` widened to a discriminated union (legacy single-node | batched `{ updates: Array<{...}> }`) — I-07 resolution
- `pushEventLog` changed from `{ event: IntegrationEvent }` to `{ events: IntegrationEvent[] }` (batch hydrate per RESEARCH §4.3)
- `setNodeAllowlist` request added to `bun.requests` block (RESEARCH §2.3 Proposal 2)
- `pushEventApiState` webview message added (I-09 prep for Plan 04-03 Task 6)
- `pushEventApiError` webview message added (I-09 prep for Plan 04-03 Task 6)

**`packages/core/src/plugin.ts` changes:**
- `IntegrationEvent._error` optional field added: `"malformed" | "unknown_node" | "invalid_status"` (D-09 classification)

**Dependencies installed:**
- `@tanstack/react-virtual@3.13.24` → `packages/desktop` (pinned, researched 2026-04-23)
- `@modelcontextprotocol/sdk@1.29.0` → `plugins/claude-code` (pinned per RESEARCH §6.1)
- `zod@4.3.6` → `plugins/claude-code`
- `vitest@4.1.4` + `typescript@^5` + `@types/node@^22` → `plugins/claude-code` devDeps

**`plugins/claude-code/package.json`** rewritten to RESEARCH §6.6 spec: added `type: "module"`, `bin`, `scripts`.

**`plugins/claude-code/vitest.config.ts`** created (Wave 0 requirement from 04-VALIDATION.md line 106).

### Task 2: 23 Wave 0 Test Stubs

All 23 files created with:
- File header comment citing phase, plan, and source-of-truth decisions
- `import { describe, it } from "vitest"` (no other live imports — keeps typecheck green)
- Commented-out imports of not-yet-existing production modules
- `it.todo("exact test name from 04-VALIDATION.md")` for every test case

**Special case — `schema.test.ts` (PLUG-09):** Three real assertions appended (not todo) to the existing file. All pass immediately because `RoadmapNodeSchema` already has `plugin: z.unknown().optional()` and `subscribe: z.unknown().optional()`.

## Verification Results

| Check | Result |
|-------|--------|
| `bun run test:typecheck` | PASS — no TS errors |
| `bun run test:desktop` | 35 files pass, 72 todos (includes 69 new Wave 0 stubs + 3 pre-existing todos) |
| `bun run --cwd plugins/claude-code test` | 3 files skipped, 10 todos |
| PLUG-09 schema assertions | 3/3 pass (real assertions, not todo) |
| `grep "updates: Array<{" shared/types.ts` | Line 132 |
| `grep "setNodeAllowlist:" shared/types.ts` | Line 102 |
| `grep "events: IntegrationEvent\[\]" shared/types.ts` | Line 140 |
| `grep "pushEventApiState:\|pushEventApiError:" shared/types.ts` | Lines 143, 149 |
| `grep "_error?" packages/core/src/plugin.ts` | Line 11 |
| `grep -cE pushStatusUpdate packages/desktop/src/mainview/rpc.ts` | 1 (unchanged) |
| `@tanstack/react-virtual` in packages/desktop/package.json | `3.13.24` |
| `@modelcontextprotocol/sdk` in plugins/claude-code/package.json | `^1.29.0` |
| plugins/claude-code/vitest.config.ts ≥5 lines | 7 lines |

## Deviations from Plan

None — plan executed exactly as written.

The only judgment call was in the `plugins/claude-code/package.json` rewrite: bun had installed the devDeps with exact versions (`vitest@4.1.4`, `@types/node@^25.6.0`); the final file uses the caret-range versions from RESEARCH §6.6 verbatim (`^4.1.4`, `^22`). This matches the spec exactly and is intentional.

## Self-Check: PASSED

All 25 created/modified files confirmed present on disk. Both task commits (`e92c535`, `c6a29ec`) verified in git log.
