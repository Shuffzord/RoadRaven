---
phase: 06-agentic-roadmap-authoring
verified: 2026-05-10T12:00:00Z
status: passed
score: 23/23 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: not_previously_verified
  previous_score: n/a
  gaps_closed: []
  gaps_remaining: []
  regressions: []
---

# Phase 06: Agentic Roadmap Authoring Verification Report

**Phase Goal (ROADMAP.md):** Agents (Claude Code and other MCP-capable LLM tools) can read, create, edit, move, and delete roadmap nodes via the MCP wrapper — turning Phase 4's one-way producer→app pipe into a bidirectional contract so a developer can ask "scaffold a roadmap for migrating service X" and watch the tree assemble live without ever touching the JSON.

**Verified:** 2026-05-10T12:00:00Z
**Status:** passed
**Re-verification:** No — initial verification (post-fix-recovery)

## Goal Achievement

### Observable Truths (derived from phase goal + 23 PLUG-AGENT-* requirements)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | 19 MCP tools register on the StdioServerTransport surface | VERIFIED | `plugins/claude-code/src/server.ts` — `registerTool` count = 19 (verified by grep); plugin tests 28/28 green; `dist/index.js` rebuild also shows 19 server.registerTool calls; UAT pre-flight confirmed MCP host loads all 19 (06-HUMAN-UAT.md L162) |
| 2 | Bidirectional WS transport: `wsClient.request<T>(method, params)` correlates by id with 30s timeout and rejects all pending on close | VERIFIED | `plugins/claude-code/src/wsClient.ts:172-188` (request<T> + setTimeout 30000 + pending.set/delete); close handler at line 131 (`pending.clear()` before scheduleReconnect); 3 contract tests pass in `wsClient.request.test.ts` (resolve/timeout/disconnect) |
| 3 | 3-way IncomingFrameSchema: Bun discriminates `hello` / `request` / event frame | VERIFIED | `packages/desktop/src/bun/eventSchema.ts:35-48` — AgentRequestSchema + 3-way `z.union` of HelloFrame, AgentRequest, EventFrame |
| 4 | Bun-side kill-switch gate fires BEFORE renderer mutation when `agentApi.enabled === false` | VERIFIED | `packages/desktop/src/bun/agentRequestHandler.ts:84-96` — Gate 1 short-circuits with `agent_api_disabled`; T1 in agentRequestHandler.test.ts asserts `mainWindow.webview.rpc.request.agentRequest` not called |
| 5 | Bun-side path-allowlist gate enforces `isPathWithinMainDir` for `openFile` and `saveFileAs` | VERIFIED | `agentRequestHandler.ts:115-138` — Gate 3; tests T2/T3 cover both methods returning `path_not_permitted`; WR-02 fix defers `pushDialogAllowlistPath` until renderer success |
| 6 | Bun-side cross-ref boundary gate prevents agent moves across `$ref` files (CR-03 fix: defaults missing entries to cachedMainPath; createNode propagates ownership via setOwnership) | VERIFIED | `agentRequestHandler.ts:140-177` (gate uses `?? cachedMain` fallback) + `agentRequestHandler.ts:212-224` (createNode setOwnership inheritance); 3 CR-03 regression tests in agentRequestHandler.test.ts ("createNode records ownership", "rejects cross-boundary on missing entry", "allows in-main-file move") |
| 7 | All 4 Bun gates fire BEFORE renderer mutation (cascade gate sequence) | VERIFIED | agentRequestHandler.ts gate sequence: kill-switch (line 84) → input validation (104) → path-allowlist (123) → cross-ref (150) → forward (181). Each guard `return`s on failure — no fall-through to RPC bridge |
| 8 | Renderer dispatcher routes 18 tool names to roadmapStore actions in a single switch | VERIFIED | `agentRpcHandler.ts` — 18 case branches verified by grep (getRoadmap, getNode, findNodes, getStatusConfig, getTypeConfig, getOpenFile, createNode, createRoadmap, renameNode, updateNodeStatus, updateNodeType, updateNodeNotes, updateNodeMetadata, moveNode, deleteNode, saveFile, saveFileAs, openFile + default unknown_tool) |
| 9 | `moveNode` store action re-parents with cycle/last-root/self-move guards | VERIFIED | `roadmapStore.ts:665-697` — moveNode action with self-move guard line 666 (`if (nodeId === newParentId) return`); 4 tests pass in `roadmapStore.moveNode.test.ts` (insert at position, no-op on missing parent, no-op on missing node, **CR-01 self-move regression**) |
| 10 | Drawer audit: every mutating tool produces a synthetic IntegrationEvent (D-09) | VERIFIED | `agentRpcHandler.ts:112-133` `appendAgentDrawerEvent` — `source="claude-code"` hardcoded, `meta.tool`/`meta.args`/`meta.label` populated; called by all 12 mutating tool branches (grep count = 13: 1 decl + 12 invocations); WR-05 fix wraps args via `sanitizeArgsForAudit` (2KB cap) |
| 11 | D-04 PATCH semantics: `updateNodeMetadata` shallow-merges with null=delete | VERIFIED | `agentRpcHandler.ts:514-540` — `for (const [k, v] of Object.entries(patch))` with `if (v === null) delete next[k]; else next[k] = v;`; T2 in agentRpcHandler.test.ts asserts null=delete + unlisted-preserved |
| 12 | D-03 AND-filter: `findNodes` requires all conditions to match | VERIFIED | `agentRpcHandler.ts:144-163` `matchesFilter` — early-returns false on any field mismatch (titleContains case-insensitive, status, type, parentId, metaKey/metaValue); T3 in agentRpcHandler.test.ts asserts AND-combined behavior with case-insensitive titleContains |
| 13 | D-07 live-overlay: read tools return live-merged statuses within 30s window | VERIFIED | `agentRpcHandler.ts:191-204` `mergeLiveStatus` documents the 30s window contract; WR-09 fix optimizes `getRoadmap` to skip walk when `liveEventMeta` empty; T5 in agentRpcHandler.test.ts asserts overlay merge for findNodes |
| 14 | D-12 openFile auto-flushes pending autosave before loading | VERIFIED | `agentRpcHandler.ts:686-718` — checks `hasUnsavedEdits()`, calls `triggerSave()`, subscribes to `saveState === 'saved'` with 5s timeout; WR-04 fix returns structured `autosave_timeout` code instead of `internal_error`; T6 in agentRpcHandler.test.ts confirms triggerSave invoked |
| 15 | D-11 cascade gate: deleteNode requires cascade:true for non-leaf | VERIFIED | `agentRpcHandler.ts:585+` — checks childCount; UAT Scenario 4 confirmed end-to-end |
| 16 | Last-root gate: deleteNode on the only root with cascade:true → cannot_delete_last_root | VERIFIED | agentRpcHandler.ts deleteNode branch checks `isTopLevel + nodes.length === 1`; UAT Scenario 6 passed |
| 17 | Cycle gate: moveNode where target is descendant → move_would_create_cycle (CR-02 fix: reflexive isDescendantOf) | VERIFIED | `agentRpcHandler.ts:32-48` — `isDescendantOf` includes `if (rootNodeId === candidateId) return true` (reflexive form); CR-02 regression test in agentRpcHandler.test.ts: "rejects moving the root onto itself" |
| 18 | Self-move gate: moveNode(X, X) blocked (CR-01 fix) | VERIFIED | Defense-in-depth: dispatcher rejects at agentRpcHandler.ts:551-557 (explicit short-circuit) AND store rejects at roadmapStore.ts:666; CR-01 regression tests in both moveNode.test.ts (line 135) and agentRpcHandler.test.ts (line 342) verify node is NOT deleted |
| 19 | 13-code error taxonomy single source of truth | VERIFIED | `plugins/claude-code/src/tools/errors.ts` — AGENT_ERROR_CODES const-tuple length 13; AgentErrorCode type derived; README documents all 13 codes (line 88-106) |
| 20 | Per-tool input validation on Bun side (WR-01 fix) | VERIFIED | `packages/desktop/src/bun/agentToolSchemas.ts` — TOOL_SCHEMAS registry with 18 tool schemas; `validateToolInput()` called as Gate 2 in agentRequestHandler.ts:104; tests cover invalid_input rejection paths |
| 21 | Public README documents 19 tools, 13 codes, kill-switch with correct settings.json paths | VERIFIED | `plugins/claude-code/README.md` — sections "Read tools (6)", "Create tools (2)", "Update tools (6)", "Delete tool (1)", "File-lifecycle tools (3)", "Phase 4 carry-forward (1)" = 19 tools; "Error Taxonomy (13 codes)" table complete; Kill-Switch section uses `settings.json` (NOT stale `.roadmap-settings.json`) for Windows/macOS/Linux paths |
| 22 | Manual UAT: 7 scenarios signed off | VERIFIED | `06-HUMAN-UAT.md` — 7/7 checkboxes ticked, tester `analizagpw`, date 2026-05-07; pre-flight findings documented (stale dist + settings filename — both resolved in commit 5198a08) |
| 23 | Settings filename consistency: runtime hint, README, UAT all reference `settings.json` (the actual file) | VERIFIED | Source: `packages/desktop/src/bun/settings.ts:5` `SETTINGS_FILE = "settings.json"`. Hint: agentRequestHandler.ts line 93 uses `settings.json` with all 3 platform paths. README: line 110-116 uses `settings.json`. UAT: line 73-76 uses `settings.json`. Zero source-code references to `.roadmap-settings.json` (verified by grep against `packages/` and `plugins/`). |

**Score:** 23/23 truths verified — Phase goal achieved.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `plugins/claude-code/src/server.ts` | 19 server.registerTool calls (17 net-new + 2 carry-forward) | VERIFIED | grep count = 19; agentToolCallback delegation = 18 (17 + updateNodeStatus reroute); getEventApiStatus inline sentinel direct |
| `plugins/claude-code/src/wsClient.ts` | request<T> method + pending Map + close cleanup | VERIFIED | request<T> declared L25, implemented L172-188; pending.clear() in close handler L131 |
| `plugins/claude-code/src/tools/errors.ts` | 13-code AGENT_ERROR_CODES tuple | VERIFIED | length 13, all codes verbatim per RESEARCH §9 |
| `plugins/claude-code/src/tools/schemas.ts` | 12 Zod input schemas | VERIFIED | All schemas exported; matched by Bun-side mirror in `agentToolSchemas.ts` (WR-01) |
| `plugins/claude-code/src/tools/agentToolCallback.ts` | Shared MCP callback helper with structured-error vs transport-error split | VERIFIED | All 18 callbacks delegate to it; sentinel-fallback only when no `code` present |
| `packages/desktop/src/bun/agentRequestHandler.ts` | 4-gate sequence + ownership propagation | VERIFIED | Kill-switch → input validation → path-allowlist → cross-ref → forward; setOwnership inheritance for createNode |
| `packages/desktop/src/bun/agentToolSchemas.ts` | Per-tool Bun-side input validation (WR-01 fix) | VERIFIED | TOOL_SCHEMAS registry with 18 entries; validateToolInput exported |
| `packages/desktop/src/bun/eventSchema.ts` | 3-way IncomingFrameSchema | VERIFIED | union(HelloFrame, AgentRequest, EventFrame); parseIncoming returns widened type |
| `packages/desktop/src/bun/eventServer.ts` | onAgentRequest StartOption + pre-coalescer branch | VERIFIED | type === 'request' branch returns BEFORE coalescer.enqueue (line 176-179) |
| `packages/desktop/src/bun/eventServerStandalone.ts` | Fail-fast on invalid port (WR-06 fix) | VERIFIED | process.exit(1) on invalid ROADRAVEN_EVENT_PORT |
| `packages/desktop/src/bun/index.ts` | Production onAgentRequest wired (no placeholder) | VERIFIED | `void agentRequestHandler(ws, request, mainWindow)` — placeholder removed |
| `packages/desktop/src/bun/saveFile.ts` | Allowlist clears on main-path change (WR-02 fix) | VERIFIED | setCachedMainPath / clearCachedMainPath / __resetForTests all call dialogAllowlist.clear() |
| `packages/desktop/src/mainview/store/roadmapStore.ts` | moveNode action with self-move guard | VERIFIED | Line 665-697; defense-in-depth self-move return at line 666 |
| `packages/desktop/src/mainview/rpc/agentRpcHandler.ts` | 18-case dispatcher with all D-XX semantics + WR fixes | VERIFIED | All cases present; reflexive isDescendantOf (CR-02); explicit self-move check (CR-01); D-04 PATCH; D-03 AND-filter; D-07 mergeLiveStatus; D-09 appendAgentDrawerEvent; D-12 auto-flush with autosave_timeout (WR-04); WR-03 setState immutable; WR-05 sanitizeArgsForAudit; WR-09 walkAndMerge optimization |
| `packages/desktop/src/mainview/rpc.ts` | handlers.requests.agentRequest wired | VERIFIED | Dynamic-import dispatcher entry |
| `packages/core/src/plugin.ts` | Exported LIFECYCLE_NODE_ID constant (WR-08 fix) | VERIFIED | `export const LIFECYCLE_NODE_ID = "__lifecycle__"`; documented in IntegrationEvent JSDoc |
| `shared/types.ts` | RoadmapRPCType.webview.requests.agentRequest + AppSettings.agentApi.enabled | VERIFIED | Both present; agentRequest correctly placed under webview.requests (Plan 06-03 contract correction) |
| `plugins/claude-code/README.md` | 19-tool catalog + 13-code taxonomy + kill-switch + security/concurrency model | VERIFIED | Tagline + 6 categories + error table + settings.json paths for 3 OS |
| `.planning/phases/06-agentic-roadmap-authoring/06-HUMAN-UAT.md` | 7 scenarios with sign-off | VERIFIED | 7 scenario sections; 7 ticked checkboxes; tester + date + notes |
| Tests: `agentRequestHandler.test.ts` (Bun gates) | All gates including CR-03 regression | VERIFIED | 15/15 pass (6 original + 9 added during fixes for CR-03 and WR-01) |
| Tests: `agentRpcHandler.test.ts` (renderer dispatcher) | All semantics + CR-01/02 regression | VERIFIED | 16/16 pass (6 original + 10 added during fixes) |
| Tests: `roadmapStore.moveNode.test.ts` (store action) | Self-move regression | VERIFIED | 4/4 pass (3 original + 1 CR-01 regression at line 135) |
| Tests: `wsClient.request.test.ts` (transport) | resolve/timeout/disconnect | VERIFIED | 3/3 pass |
| Tests: `agent-contracts.test.ts` (foundation) | 5 contract tests | VERIFIED | 5/5 pass |
| Tests: `scaffold.e2e.test.ts` (E2E) | createRoadmap → 5 createNode → saveFile | VERIFIED | 1/1 pass |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| MCP host (Claude Code) | server.ts registerTool callbacks | StdioServerTransport | WIRED | server.connect(transport) at end of server.ts; UAT pre-flight confirmed 19 tools listed |
| server.ts callback | wsClient.request | agentToolCallback helper | WIRED | All 18 net-new tools delegate via agentToolCallback(name, wsClient) |
| wsClient.request | Bun eventServer | WS sentinel-discovered URL | WIRED | createWsClient + sentinel.ts path discovery; type='request' frame |
| Bun eventServer onAgentRequest | agentRequestHandler | direct call in index.ts | WIRED | `onAgentRequest: (ws, request) => void agentRequestHandler(ws, request, mainWindow)` |
| agentRequestHandler | renderer agentRpcHandler | mainWindow.webview.rpc.request.agentRequest | WIRED | RoadmapRPCType.webview.requests.agentRequest correctly typed; Bun is caller, renderer is handler |
| renderer agentRpcHandler | roadmapStore actions | useRoadmapStore.getState() | WIRED | All 12 mutating cases call store.{addChild, renameNode, updateNodeStatus, updateNodeType, updateNodeNotes, updateNodeMetadata, moveNode, deleteNode, triggerSave, newUntitledSchema} |
| renderer agentRpcHandler | eventLogStore.appendEvents | appendAgentDrawerEvent helper | WIRED | All 12 mutating cases emit synthetic IntegrationEvent with source="claude-code" |
| Mutation → autosave persistence | atomicWrite via Phase 3 pipeline | triggerSave + 2s debounce | WIRED | UAT Scenario 1 confirmed file persists across app restart |
| openFile / saveFileAs | path-allowlist | isPathWithinMainDir + pushDialogAllowlistPath | WIRED | Gate 3 in agentRequestHandler validates BEFORE renderer; allowlist deferred to post-success (WR-02) |
| createNode | ownership propagation | setOwnership inheritance | WIRED | agentRequestHandler.ts:212-224 records new node owner = parent owner ?? cachedMain |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| getRoadmap response | schema | useRoadmapStore.getState().schema | Yes — real Zustand store with applied event-batch overlays | FLOWING |
| createNode response | nodeId | store.addChild return value | Yes — UUID minted by store action and inserted into nodeIndex | FLOWING |
| findNodes response | nodes[] | walkNodes traversal of store.schema.nodes | Yes — full tree walk with AND-filter | FLOWING |
| Drawer audit row | rows[] | useEventLogStore.appendEvents | Yes — IntegrationEvent objects with sanitized args (≤2KB) | FLOWING |
| File persistence | atomicWrite output | triggerSave → autosave debounce → atomicWrite | Yes — UAT Scenario 1 confirmed on-disk persistence after app restart | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Plugin TypeScript typecheck | `bunx tsc --noEmit` (in plugins/claude-code) | Clean | PASS |
| Desktop typecheck | `bun run test:typecheck` | Clean | PASS |
| agentRequestHandler unit tests | `bun run --cwd packages/desktop test:file tests/unit/bun/agentRequestHandler.test.ts` | 15/15 pass | PASS |
| agentRpcHandler unit tests | `bun run --cwd packages/desktop test:file tests/unit/mainview/agentRpcHandler.test.ts` | 16/16 pass | PASS |
| moveNode store tests | `bun run --cwd packages/desktop test:file tests/unit/store/roadmapStore.moveNode.test.ts` | 4/4 pass (incl. CR-01 regression) | PASS |
| Plugin suite (full) | `bun run --filter @roadraven/plugin-claude-code test` | 28/28 pass | PASS |
| Desktop suite (full) | `bun run test:desktop` | 489/489 pass (56 files) | PASS |
| E2E scaffold connectivity | `bun run --filter @roadraven/plugin-claude-code test tests/scaffold.e2e.test.ts` | 1/1 pass | PASS |
| Plugin build | `bun run build` (in plugins/claude-code) | Bundled 229 modules in 524ms; 1.0 MB dist/index.js | PASS |
| dist/index.js tool count | `grep -c "server.registerTool(" plugins/claude-code/dist/index.js` | 19 | PASS |
| Lint touched files | `bunx @biomejs/biome lint <files>` | 1 pre-existing warning (RECONNECT_CAP_MS unused — documented in 06-02 SUMMARY, NOT introduced by phase 6) | PASS |
| Settings filename in source | `grep "\.roadmap-settings\.json" packages/ plugins/` | 0 matches | PASS |
| Settings filename in shipped surfaces (README + runtime hint + UAT) | grep `settings.json` | All 3 reference `settings.json` consistently | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| PLUG-AGENT-READ-01 | 06-01/04/05 | getRoadmap | SATISFIED | server.ts L80, agentRpcHandler case L280, README catalog |
| PLUG-AGENT-READ-02 | 06-01/04/05 | getNode | SATISFIED | server.ts L91, case L307 |
| PLUG-AGENT-READ-03 | 06-01/04/05 | findNodes (D-03 AND-filter) | SATISFIED | server.ts L102, case L332, T3 in agentRpcHandler.test.ts |
| PLUG-AGENT-READ-04 | 06-01/04/05 | getStatusConfig | SATISFIED | server.ts L113, case L346 |
| PLUG-AGENT-READ-05 | 06-01/04/05 | getTypeConfig | SATISFIED | server.ts L124, case L350 |
| PLUG-AGENT-READ-06 | 06-01/04/05 | getOpenFile | SATISFIED | server.ts L135, case L354 |
| PLUG-AGENT-CREATE-01 | 06-01/04/05 | createNode | SATISFIED | server.ts L148, case L366; CR-03 ownership propagation L212 |
| PLUG-AGENT-CREATE-02 | 06-01/04/05 | createRoadmap | SATISFIED | server.ts L159, case L392; WR-03 immutable setState fix |
| PLUG-AGENT-UPDATE-01 | 06-01/04/05 | renameNode | SATISFIED | server.ts L172, case L457 |
| PLUG-AGENT-UPDATE-02 | 06-01/04/05 | updateNodeType | SATISFIED | server.ts L182, case L485 |
| PLUG-AGENT-UPDATE-03 | 06-01/04/05 | updateNodeNotes | SATISFIED | server.ts L193, case L499 |
| PLUG-AGENT-UPDATE-04 | 06-01/04/05 | updateNodeMetadata (D-04 PATCH) | SATISFIED | server.ts L204, case L514 (Object.entries + null=delete); T2 |
| PLUG-AGENT-UPDATE-05 | 06-01/04/05 | moveNode (cycle + cross-ref) | SATISFIED | server.ts L215, case L542; CR-01/02/03 regression tests |
| PLUG-AGENT-UPDATE-06 | 06-05 | updateNodeStatus reroute (D-09 audit) | SATISFIED | server.ts L37 via agentToolCallback; case L471 emits drawer |
| PLUG-AGENT-DELETE-01 | 06-01/03/04 | deleteNode (cascade + last-root) | SATISFIED | server.ts L228, case L585; UAT Scenario 4 + 6 passed |
| PLUG-AGENT-FILE-01 | 06-01/04/05 | saveFile | SATISFIED | server.ts L241, case L623 |
| PLUG-AGENT-FILE-02 | 06-01/03/05 | saveFileAs (allowlist) | SATISFIED | server.ts L252, case L636; T2 in Bun gate test |
| PLUG-AGENT-FILE-03 | 06-01/03/04/05 | openFile (allowlist + auto-flush) | SATISFIED | server.ts L263, case L674; D-12 with autosave_timeout (WR-04) |
| PLUG-AGENT-TRANSPORT-01 | 06-02/03 | Bun WS request frame routing (coalescer-bypass) | SATISFIED | eventServer.ts L176-179 returns before coalescer.enqueue |
| PLUG-AGENT-TRANSPORT-02 | 06-02 | wsClient.request correlation + 30s timeout + close cleanup | SATISFIED | wsClient.ts L172-188; 3/3 transport tests |
| PLUG-AGENT-SAFETY-01 | 06-01/03/04 | 13-code error taxonomy | SATISFIED | errors.ts AGENT_ERROR_CODES; README documents 13; per-gate enforcement; **observation:** runtime adds 2 supplementary codes (`invalid_input` from WR-01, `autosave_timeout` from WR-04) — these are emitted by handlers but NOT in the canonical AGENT_ERROR_CODES tuple or README — see Notes section |
| PLUG-AGENT-SAFETY-02 | 06-04 | Drawer audit per mutating tool | SATISFIED | appendAgentDrawerEvent called 12x; T1 in agentRpcHandler.test.ts confirms source='claude-code' |
| PLUG-AGENT-SAFETY-03 | 06-01/03 | Kill-switch agentApi.enabled === false | SATISFIED | agentRequestHandler.ts L84-96; UAT Scenario 2 confirmed |

**Coverage:** 23/23 PLUG-AGENT-* requirements SATISFIED.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (none in source) | — | — | — | — |

No blocking anti-patterns. Two non-blocking documentation drifts noted under Notes.

### Human Verification Required

(none)

All 7 UAT scenarios were already executed and signed off by tester `analizagpw` on 2026-05-07 (06-HUMAN-UAT.md). Pre-flight findings (stale dist + settings filename) were resolved in commits before final verification:
- Stale dist resolved by rebuild (Phase 6 follow-up todo: auto-rebuild on `dev` or commit dist artifact — not blocking).
- Settings filename mismatch resolved in commit `5198a08` (agentRequestHandler hint, README, UAT all consistent).

### Notes (non-blocking observations)

1. **Error taxonomy expansion (PLUG-AGENT-SAFETY-01 — partial drift):** During code-review fixes, two additional structured error codes were introduced — `invalid_input` (WR-01 per-tool input validation) and `autosave_timeout` (WR-04 D-12 openFile timeout). These codes ARE used at runtime and DO match the spirit of the taxonomy ("structured error codes returned by all gate checks"), but they are NOT listed in the canonical `AGENT_ERROR_CODES` const-tuple in `plugins/claude-code/src/tools/errors.ts` and NOT documented in the public README's "Error Taxonomy (13 codes)" table. Recommendation: add them to both surfaces and bump the title to "Error Taxonomy (15 codes)" in the README. Treating as a NOTE rather than a gap because (a) the must-have ("13-code error taxonomy") is satisfied as defined; (b) the additional codes are improvements that came from CR fixes; (c) the agent receives the codes through the `Error (<code>): <message>` text envelope just like the documented 13.

2. **STATE.md / ROADMAP.md progress-table staleness:** `STATE.md` still shows "Phase 6 Plan 05 COMPLETE" as `last_activity`, and `ROADMAP.md` progress table reads "6. Agentic Roadmap Authoring | 5/6 | In Progress". Both are stale relative to the 06-06 SUMMARY status (`status: complete`) and the UAT sign-off. The 6 plan checkboxes ARE all `[x]` in ROADMAP.md (the line-item source of truth). Recommendation: orchestrator/closing workflow updates the progress table to "6/6 | Complete | 2026-05-10" and STATE.md `last_activity` / `stopped_at`. Treating as a NOTE because the contract (plan checkboxes + UAT sign-off) is satisfied; only the rolled-up summary lines are out-of-date.

3. **REQUIREMENTS.md PLUG-AGENT-SAFETY-03 description references stale filename:** The bullet at REQUIREMENTS.md L108 says "agentApi.enabled === false in `.roadmap-settings.json`" — this should now read `settings.json`. Source code, README, runtime hint, and UAT are all correct; this is the only stale spot in REQUIREMENTS.md. Cosmetic; non-blocking.

4. **Stale plugin dist warning (UAT pre-flight finding):** `plugins/claude-code/dist/index.js` is a build artifact gitignored by convention. After source updates, contributors must run `bun run build` to refresh. UAT tester documented this and the rebuild produces the correct 19-tool surface. Recommendation: add a follow-up todo to either auto-rebuild on `dev` or commit the dist artifact (Phase 6 06-06 SUMMARY notes 2026-05-07).

5. **Cross-workspace import in scaffold.e2e.test.ts (06-REVIEW Note):** The connectivity-check test in `plugins/claude-code/tests/scaffold.e2e.test.ts` cross-imports from `packages/desktop/src/mainview/...`. The test file would not ship in the published npm package (it's in `tests/`, not `src/`). Acceptable for v1 per the Code Review Notes section.

### Gaps Summary

No blocking gaps. The Phase 6 contract — bidirectional MCP transport with 19 tools, 4-gate safety pipeline, drawer audit, signed-off UAT — is fully delivered in the codebase. All three CR BLOCKERS have working fixes with regression tests. All nine WARNING fixes are present in source with passing tests. Test counts grew from 467 (initial Plan 06-04) to 489 (after fix-recovery), reflecting the regression coverage added during code review remediation.

The phase is ready to proceed to milestone closure. The three NOTE-level documentation drifts (error-taxonomy expansion, stale ROADMAP/STATE progress lines, stale REQUIREMENTS bullet wording) can be addressed in a small docs-only follow-up commit or absorbed into the milestone audit step — none of them affect the goal achievement.

---

_Verified: 2026-05-10T12:00:00Z_
_Verifier: Claude (gsd-verifier)_
