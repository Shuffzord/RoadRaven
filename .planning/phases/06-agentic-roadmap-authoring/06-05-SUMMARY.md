---
phase: 06-agentic-roadmap-authoring
plan: 05
subsystem: agent-api
tags:
  - mcp
  - server
  - tool-registration
  - phase-6
dependency-graph:
  requires:
    - plugins/claude-code/src/tools/agentToolCallback.ts (Plan 06-01 product)
    - plugins/claude-code/src/tools/schemas.ts (Plan 06-01 product — 12 Zod schemas)
    - plugins/claude-code/src/wsClient.ts (Plan 06-02 product — request/response framing)
    - packages/desktop/src/bun/agentRequestHandler.ts (Plan 06-03 product — gates)
    - packages/desktop/src/mainview/rpc/agentRpcHandler.ts (Plan 06-04 product — dispatcher + drawer audit)
  provides:
    - 19 MCP tool registrations on the StdioServerTransport — agent-facing surface for Claude Code
    - updateNodeStatus rerouted through agentToolCallback (D-09 — drawer audit now applies)
  affects:
    - downstream Plan 06-06 (UAT scaffold E2E test): the agent-facing surface is now complete; UAT can drive an MCP host through createRoadmap → 30-50 createNode calls → autosave → on-disk verification
tech-stack:
  added: []
  patterns:
    - "Pure-delegation pattern: 17 net-new tools = one server.registerTool call each, callback = agentToolCallback(name, wsClient). No per-tool try/catch boilerplate; the helper centralizes structured-error vs transport-error formatting (Plan 06-01)."
    - "updateNodeStatus migration: replaced 51 lines of inline try/catch/sentinel with one agentToolCallback call. Retains the same Zod input schema; drawer audit (D-09) now fires because traffic goes through the renderer dispatcher (Plan 06-04)."
    - "Tool-discovery hint pattern: descriptions reference companion tools agents should chain (e.g., updateNodeType description says 'Use getTypeConfig to discover valid types'); statusConfig/typeConfig descriptions invite use before createNode."
    - "z.object({}) inline for read-only no-input tools: avoids polluting schemas.ts with empty schemas; only non-trivial inputs imported from ./tools/schemas."
key-files:
  created:
    - .planning/phases/06-agentic-roadmap-authoring/06-05-SUMMARY.md
  modified:
    - plugins/claude-code/src/server.ts (rewrote: 97 lines → ~270 lines; 19 registerTool calls)
    - .planning/STATE.md (last_updated, last_activity, decisions, metric row, plan-counter advance)
    - .planning/ROADMAP.md (06-05 checkbox marked, Phase 6 progress 5/6)
    - .planning/REQUIREMENTS.md (PLUG-AGENT-READ-01..06, CREATE-01..02, UPDATE-01..06, DELETE-01, FILE-01..03 marked complete)
decisions:
  - "Pure delegation: 17 net-new tools share zero callback code; every callback is agentToolCallback(name, wsClient). Anti-sprawl — one helper tested once (Plan 06-01 test 5) covers all 17 tools."
  - "updateNodeStatus reroute is mandatory for D-09 (drawer audit). Old code took a direct one-way wsClient.send and returned 'ok' synchronously, bypassing the renderer dispatcher entirely. The reroute matches the Phase 6 contract that EVERY mutating tool produces a drawer event."
  - "getEventApiStatus stays inline (sentinel-only): it's a meta-status tool, not a roadmap operation. It must work even when the renderer dispatcher is unreachable (e.g., to diagnose 'why is the app not responding'). Routing it through the agent dispatcher would create a chicken-and-egg failure mode."
  - "Read-only tools (getRoadmap, getStatusConfig, getTypeConfig, getOpenFile) use z.object({}) inline rather than imported empty schemas — avoids 4 unused exports in schemas.ts and matches the existing getEventApiStatus pattern."
metrics:
  duration_minutes: 3
  completed: 2026-05-07
---

# Phase 6 Plan 05: MCP Tool Registration Summary

Wire all 19 MCP tools into `plugins/claude-code/src/server.ts` — pure delegation through `agentToolCallback(name, wsClient)`. End of this plan, an MCP host (Claude Code) sees 19 tools; calling any tool flows through agentToolCallback → wsClient.request → Bun WS → agentRequestHandler (gates) → renderer agentRpcHandler (dispatch + audit) → roadmapStore mutation. Phase 6's user story is end-to-end functional.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Rewrite updateNodeStatus + add 17 net-new server.registerTool calls | `6ad3c15` | plugins/claude-code/src/server.ts |

## Implementation Summary

### `plugins/claude-code/src/server.ts` (rewritten)

**Tools by category (19 total):**

**Phase 4 carry-forward (2):**
1. `updateNodeStatus` — REROUTED through `agentToolCallback("updateNodeStatus", wsClient)`. Old inline try/catch/sentinel boilerplate (51 lines) removed. Retains the same Zod input schema (`{nodeId, status, meta?}`). D-09 drawer audit now applies.
2. `getEventApiStatus` — UNCHANGED. Reads sentinel directly via `readSentinel()`; does not route through the agent dispatcher (it's a meta-status tool that must work even when the dispatcher is unreachable).

**Read tools (6 net-new):**
3. `getRoadmap` — `z.object({})` inline; full schema with live-overlay merge.
4. `getNode` — `GetNodeInputSchema` (nodeId UUID); returns node + parentId + ancestorIds.
5. `findNodes` — `FindNodesInputSchema` (titleContains/status/type/metaKey/metaValue/parentId, all optional, AND-combined).
6. `getStatusConfig` — `z.object({})` inline; statusConfig array.
7. `getTypeConfig` — `z.object({})` inline; typeConfig array.
8. `getOpenFile` — `z.object({})` inline; filePath / isUntitled / title / nodeCount (works even with no file loaded).

**Create tools (2 net-new):**
9. `createNode` — `CreateNodeInputSchema` (parentId + title required; type/status/notes/metadata optional).
10. `createRoadmap` — `CreateRoadmapInputSchema` (title/statusConfig/typeConfig optional; mirrors File > New).

**Update tools (5 net-new):**
11. `renameNode` — `RenameNodeInputSchema`.
12. `updateNodeType` — `UpdateNodeTypeInputSchema`.
13. `updateNodeNotes` — `UpdateNodeNotesInputSchema`.
14. `updateNodeMetadata` — `UpdateNodeMetadataInputSchema` (D-04 PATCH semantics).
15. `moveNode` — `MoveNodeInputSchema` (cycle + cross-$ref gates enforced upstream).

**Delete tool (1 net-new):**
16. `deleteNode` — `DeleteNodeInputSchema` (cascade gate enforced in renderer dispatcher).

**File-lifecycle tools (3 net-new):**
17. `saveFile` — `z.object({})` inline.
18. `saveFileAs` — `SaveFileAsInputSchema` (path-allowlist enforced at Bun gate).
19. `openFile` — `OpenFileInputSchema` (path-allowlist + auto-flush via D-12).

**Imports (12 Zod schemas from `./tools/schemas`):**
CreateNodeInputSchema, CreateRoadmapInputSchema, DeleteNodeInputSchema, FindNodesInputSchema, GetNodeInputSchema, MoveNodeInputSchema, OpenFileInputSchema, RenameNodeInputSchema, SaveFileAsInputSchema, UpdateNodeMetadataInputSchema, UpdateNodeNotesInputSchema, UpdateNodeTypeInputSchema.

**Shutdown + transport:** unchanged from Phase 4 (`SIGTERM`/`SIGINT` → `wsClient.close()` → `process.exit(0)`; `StdioServerTransport` connect at the bottom).

## Verification

| Gate | Command | Result |
|------|---------|--------|
| Plugin suite (regression) | `bun run --filter @roadraven/plugin-claude-code test` | 27/27 pass (5 files) |
| Desktop suite (regression) | `bun run test:desktop` | 467/467 pass (56 files) |
| Desktop typecheck | `bun run test:typecheck` | Clean |
| Biome lint (touched file) | `bunx @biomejs/biome lint plugins/claude-code/src/` | Clean for server.ts; 1 pre-existing warning in wsClient.ts (`RECONNECT_CAP_MS` unused, documented in 06-02 SUMMARY — not introduced by this plan) |
| Sanity grep — registerTool count | `grep -v '^//' plugins/claude-code/src/server.ts \| grep -c "server.registerTool"` | 19 (= 19 required) |
| Sanity grep — agentToolCallback count | `grep -v '^//' plugins/claude-code/src/server.ts \| grep -c "agentToolCallback("` | 18 (= 18 required: 17 net-new + updateNodeStatus reroute) |

## Deviations from Plan

None. The plan was executed verbatim — pure delegation, no architectural changes, no Rule 1/2/3 fixes required.

### Auth Gates

None. Pure code surface, no external systems.

### CLAUDE.md-driven adjustments

- Used `bun run --filter @roadraven/plugin-claude-code test` and `bun run test` (workspace runners) per CLAUDE.md "ALWAYS via `bun run`, never `bunx vitest` directly" rule.
- Used Electrobun (not Electron) — no Electron imports introduced.
- Commit was a normal commit (no `--no-verify`); pre-commit hook passed.

## Self-Check: PASSED

Verified via Read/Grep/Bash:

- `plugins/claude-code/src/server.ts` — FOUND
- `server.registerTool` count: 19 (excluding comments)
- `agentToolCallback(` count: 18 (excluding comments — 17 net-new + updateNodeStatus reroute)
- `getEventApiStatus` callback is inline async (sentinel direct), not via agentToolCallback — confirmed by reading the file
- 12 schema imports present: `CreateNodeInputSchema, CreateRoadmapInputSchema, DeleteNodeInputSchema, FindNodesInputSchema, GetNodeInputSchema, MoveNodeInputSchema, OpenFileInputSchema, RenameNodeInputSchema, SaveFileAsInputSchema, UpdateNodeMetadataInputSchema, UpdateNodeNotesInputSchema, UpdateNodeTypeInputSchema`
- Commit `6ad3c15` (`feat(06-05): register 17 net-new MCP tools + reroute updateNodeStatus through agent dispatcher (19 tools total)`) — FOUND in `git log`
- 27/27 plugin suite passing
- 467/467 desktop suite passing
- tsc clean (desktop)
- Biome clean for the touched file (server.ts); 1 pre-existing warning unrelated to this plan

## Threat Flags

No new threat surface introduced. The threat model declared in the plan is correctly mitigated:

- **T-06-05-01 (tool-args bypass Zod validation)** — mitigated by MCP SDK validating `inputSchema` BEFORE invoking the registered callback. Tool registrations all reference Zod schemas (12 imported from Plan 06-01 + 4 inline `z.object({})` for empty inputs + 1 inline schema for the carry-forward `updateNodeStatus` + 1 for `getEventApiStatus`).
- **T-06-05-02 (description text leaks internal details)** — accepted; descriptions are public-by-design (visible to the LLM). They mention features (path allowlist, cascade flag, drawer audit) but not internal file structure.
- **T-06-05-03 (future tool registration bypasses agentToolCallback)** — mitigated by the grep gate documented in `<verification>`: `agentToolCallback(` count must equal `registerTool` count minus 1 (getEventApiStatus is the only documented exemption). Future PRs satisfying the same grep gate (or documenting why a tool is exempt) will not regress this property.
- **T-06-05-04 (MCP host repudiation)** — mitigated by Bun-side `agentLogger` (Plan 06-03) logging every tool entry/exit, plus renderer-side `appendAgentDrawerEvent` (Plan 06-04) writing a synthetic IntegrationEvent for every mutation. The drawer audit row is the persistent trail; agents cannot spoof `source` (hardcoded "claude-code" in renderer).
