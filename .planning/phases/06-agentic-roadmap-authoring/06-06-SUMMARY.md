---
phase: 06-agentic-roadmap-authoring
plan: 06
subsystem: agent-api
status: partial
tags:
  - e2e
  - documentation
  - uat
  - phase-6
dependency-graph:
  requires:
    - packages/desktop/src/mainview/rpc/agentRpcHandler.ts (Plan 06-04 — handleAgentRequest dispatcher)
    - packages/desktop/src/mainview/store/roadmapStore.ts (Plan 06-04 — newUntitledSchema, addChild, triggerSave)
    - packages/desktop/src/mainview/store/eventLogStore.ts (Plan 06-04 — appendEvents writes drawer audit rows)
    - plugins/claude-code/vitest.config.ts (vitest 4.x include glob accepts new tests/scaffold.e2e.test.ts)
  provides:
    - plugins/claude-code/tests/scaffold.e2e.test.ts — 1 thin connectivity-check E2E
    - plugins/claude-code/README.md — 19-tool catalog + 13-code taxonomy + kill-switch + security/concurrency
    - .planning/phases/06-agentic-roadmap-authoring/06-HUMAN-UAT.md — 7-scenario manual test script + sign-off block
  affects:
    - Phase 6 release readiness — UAT sign-off gates the lockstep version bump (Phase 5 D-04)
    - downstream verifier (`/gsd-verify-work 06`): UAT must be approved before phase is marked Complete
tech-stack:
  added: []
  patterns:
    - "Cross-workspace dynamic-import in vitest: `await import('../../../packages/desktop/src/mainview/...')` — both workspaces use vitest 4.x with shared bun runtime, so the relative-path import resolves without additional config (no resolve.alias / transformMode tweaks needed)"
    - "Connectivity-check E2E (vs. per-tool E2E): one test exercises createRoadmap → 5 createNode → saveFile and asserts both the tree shape AND the drawer audit row sequence. Plans 06-01..06-04 already cover per-layer correctness; this proves they wire together"
    - "triggerSave double-stub pattern: both `vi.spyOn(getState(), 'triggerSave')` AND `setState({ triggerSave: noop })` — vitest has no Bun process to receive the IPC saveFile call, so the renderer's `saveFile` branch must be safe to invoke without a real save. The double-stub handles both `getState()`-cached references and fresh getState calls after subsequent setState mutations"
    - "Public README structure: title → install → MCP config → prerequisites → 19-tool catalog (grouped by category) → 13-code error taxonomy → kill-switch → security model → concurrency model → tested-against → troubleshooting → license. Single document — no separate doc files (matches 04-event-api UAT layout)"
    - "Human UAT sign-off block as a markdown checklist: 7 unticked checkboxes + tester/date/notes fields. Tester ticks the boxes in-place; orchestrator detects ≥7 `[x]` markers as the resume signal"
key-files:
  created:
    - plugins/claude-code/tests/scaffold.e2e.test.ts
    - .planning/phases/06-agentic-roadmap-authoring/06-HUMAN-UAT.md
    - .planning/phases/06-agentic-roadmap-authoring/06-06-SUMMARY.md
  modified:
    - plugins/claude-code/README.md (replaced Phase 4 stub with full 19-tool documentation)
decisions:
  - "ONE thin E2E only — no per-tool coverage. The plan explicitly forbids per-tool E2E ('the contract tests already prove each layer; the E2E only proves they wire together'). The 1-test budget is enforced by the file existing at exactly 1 `it(...)` call"
  - "E2E placed in plugin workspace (`plugins/claude-code/tests/scaffold.e2e.test.ts`) rather than desktop fallback. Cross-workspace dynamic import works without config changes — verified by `bun run --filter @roadraven/plugin-claude-code test tests/scaffold.e2e.test.ts` passing 1/1. No fallback needed"
  - "Biome auto-fix flagged `() => {}` empty arrow body during pre-commit. Refactored to a named `noopTriggerSave` const with a JSDoc comment explaining why — preserves the `vi.spyOn` and double `triggerSave` references the plan's BLOCKER 3 fix requires, and satisfies `lint/suspicious/noEmptyBlockStatements`"
  - "README replaces the Phase 4 stub entirely (D-09 drawer audit + the 17 new tools fundamentally change the surface). Old install/troubleshooting content preserved at the bottom; new sections added in the order the plan's <interfaces> block specified"
  - "Status `partial` because Task 3 is a human-checkpoint awaiting tester sign-off. The functional implementation is done (467/467 desktop + 28/28 plugin pass); only the manual UAT remains. Orchestrator MUST resume on tester reply to record the sign-off commit and advance ROADMAP.md / STATE.md"
metrics:
  duration_minutes: 4
  completed: 2026-05-07
---

# Phase 6 Plan 06: Scaffold E2E + Public README + Human UAT Summary

Close out Phase 6 with the three artifacts that prove the contract holds end-to-end and document it for users: ONE thin connectivity-check E2E test (createRoadmap → 5 createNode → saveFile, drives the renderer dispatcher directly), the public `@roadraven/plugin-claude-code` README (19 tools, 13 error codes, kill-switch, security/concurrency), and a 7-scenario human UAT script with a blocking sign-off checkpoint.

**Status: partial — Task 3 (Manual UAT human checkpoint) is awaiting human tester sign-off.** The two autonomous tasks (E2E test + docs) are complete and committed. The orchestrator MUST surface `06-HUMAN-UAT.md` to the user and resume only after the tester replies "approved" with the filled-in sign-off block.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Scaffold E2E connectivity test (1 test, passes) | `226bd6e` | plugins/claude-code/tests/scaffold.e2e.test.ts (new) |
| 2 | 19-tool README + 7-scenario UAT script | `f3fc53a` | plugins/claude-code/README.md (rewrite); .planning/phases/06-agentic-roadmap-authoring/06-HUMAN-UAT.md (new) |
| 3 | **PENDING — Human UAT checkpoint** | (awaiting sign-off) | (no code changes; tester ticks checklist in 06-HUMAN-UAT.md, orchestrator commits with `docs(06-06): record Phase 6 UAT sign-off`) |

## Implementation Summary

### Task 1 — `plugins/claude-code/tests/scaffold.e2e.test.ts` (new, 117 lines)

ONE test (hard cap), one `describe` block. Drives the renderer dispatcher directly — skips the transport (already tested in Plan 06-02) and the Bun gate layer (already tested in Plan 06-03). Proves: schema bootstrap → multi-step tree assembly → drawer audit grew per call → triggerSave was invoked.

**`beforeEach`** — Stubs `triggerSave` with both `vi.spyOn(getState(), 'triggerSave').mockImplementation(noop)` AND `setState({ triggerSave: noop })`. Two-form override is the BLOCKER 3 fix from the plan: vitest has no Bun process to receive the IPC saveFile call, and the renderer's `saveFile` branch calls triggerSave directly. Either form alone is insufficient because subsequent `setState` calls in `handleAgentRequest` would replace the spied-on action.

**`afterEach`** — Resets `useRoadmapStore` (schema, filePath, nodeIndex) and `useEventLogStore` (rows) to baseline; calls `vi.restoreAllMocks()`.

**The test:**

1. `handleAgentRequest("createRoadmap", { title: "Service X migration" })` — goes through `SCHEMA_OPTIONAL` branch (no schema yet); creates the in-memory schema with an "Untitled" root.
2. Five `handleAgentRequest("createNode", { parentId: rootId, title })` calls for "Discovery", "Schema migration", "Smoke tests", "Deploy", "Cutover" — each appends a child to the root and emits a drawer-audit row.
3. `handleAgentRequest("saveFile", {})` — calls the (stubbed) triggerSave and emits a drawer-audit row with `nodeId: "__lifecycle__"`.

**Assertions:**

- `nodeIndex.size >= 6` (root + 5 children).
- `root.children?.length === 5`.
- `useEventLogStore.getState().rows.length === 7`.
- Every row has `source === "claude-code"`.
- The `meta?.tool` sequence is `["createRoadmap", "createNode", "createNode", "createNode", "createNode", "createNode", "saveFile"]`.

**Cross-workspace import note:** the file lives in `plugins/claude-code/tests/` but imports from `packages/desktop/src/mainview/...`. Both workspaces use vitest 4.x with the project's pinned bun runtime, so the relative-path import resolves without `resolve.alias` / `transformMode` tweaks. No fallback to `packages/desktop/tests/integration/` was needed.

### Task 2 — `plugins/claude-code/README.md` (rewrite)

Replaced the Phase 4 stub (95 lines, 2-tool surface) with a 165-line public README structured per the plan's `<interfaces>` block:

- **Title + tagline** — references the 19 tools and "agent-authored project plans" framing.
- **Installation** — `npx -y` one-shot OR `npm install -g`. Binary name `roadraven-mcp` (Phase 5 D-21 lockstep).
- **Configuration in Claude Code** — JSON config block for the `mcpServers.roadraven` entry; both global-binary and local-build variants.
- **Prerequisites** — sentinel-discovery requirement; `app_not_running` error mentioned.
- **Tool Catalog (19 tools)** — grouped by category:
  - **Read tools (6):** getRoadmap, getNode, findNodes, getStatusConfig, getTypeConfig, getOpenFile.
  - **Create tools (2):** createNode, createRoadmap.
  - **Update tools (6):** renameNode, updateNodeStatus, updateNodeType, updateNodeNotes, updateNodeMetadata (D-04 PATCH), moveNode.
  - **Delete tool (1):** deleteNode (cascade gate).
  - **File-lifecycle tools (3):** saveFile, saveFileAs, openFile.
  - **Phase 4 carry-forward (1):** getEventApiStatus.
- **Error Taxonomy (13 codes)** — table mapping each code to its trigger condition. Verbatim from RESEARCH §9.
- **Kill-Switch** — app `settings.json` (Windows: `%LOCALAPPDATA%\RoadRaven\settings.json`; macOS: `~/Library/Application Support/RoadRaven/settings.json`; Linux: `~/.config/RoadRaven/settings.json`) with `agentApi.enabled: false`. Hot-loaded; no restart needed.
- **Security Model** — localhost-only, path-traversal allowlist, no disk-direct writes, `source: "claude-code"` audit log (hardcoded in renderer; agents cannot spoof).
- **Concurrency Model** — last-write-wins, eventual consistency on disk (Phase 3 autosave debounce), single-agent assumption.
- **Tested Against** — MCP SDK 1.29.0+, Claude Code latest, Roadmap Viewer 1.0+.
- **Troubleshooting** — preserved from old README (sentinel retry policy, log file location).
- **License** — MIT.

### Task 2 — `.planning/phases/06-agentic-roadmap-authoring/06-HUMAN-UAT.md` (new, 138 lines)

7 scenarios + sign-off block, structured per the plan's `<interfaces>` block:

1. **Scenario 1 — Named user story (CORE):** "Scaffold a roadmap for migrating service X from MySQL to Postgres." Asserts createRoadmap + createNode chain, canvas live-assembly, autosave fire, drawer rows, file persistence after restart.
2. **Scenario 2 — Kill-switch:** Set `agentApi.enabled: false`; expect `agent_api_disabled` error on any tool call.
3. **Scenario 3 — Path-allowlist denial:** `openFile` outside allowlist → `path_not_permitted`; `saveFileAs` within allowlist → succeeds.
4. **Scenario 4 — Cascade gate:** `deleteNode` on non-leaf without `cascade:true` → `cascade_required`; with `cascade:true` → succeeds.
5. **Scenario 5 — Cycle prevention:** `moveNode(X, Y)` where `Y` is descendant of `X` → `move_would_create_cycle`.
6. **Scenario 6 — Last-root protection:** `deleteNode` on the only root with `cascade:true` → `cannot_delete_last_root`.
7. **Scenario 7 — Drawer audit visibility:** Run Scenario 1, open Ctrl+Shift+L, verify `claude-code` rows + click-to-select navigation.

**Pre-flight section** covers plugin build, app start, Claude Code config, test-roadmap setup. **Sign-off section** is a 7-checkbox markdown checklist + tester/date/notes fields. **HTML comment block** at the end documents the failure-handling protocol (gap-close in 06-07-PLAN vs accept-with-note in SUMMARY).

### Task 3 — Human UAT checkpoint (PENDING)

Per the plan's `type="checkpoint:human-verify" gate="blocking"` task, this plan does NOT modify code in Task 3. The orchestrator MUST surface `06-HUMAN-UAT.md` to the user, the user runs through the 7 scenarios manually, and replies either "approved" (with the filled-in sign-off block) or describes failures.

**On approval:** the orchestrator commits the signed-off `06-HUMAN-UAT.md` with `docs(06-06): record Phase 6 UAT sign-off` and proceeds to mark Phase 6 complete in STATE.md / ROADMAP.md.

**On failure:** open a `06-07-PLAN.md` gap-closure plan (or accept-with-note in this SUMMARY.md if the failure is environmental).

## Verification

| Gate | Command | Result |
|------|---------|--------|
| New E2E test | `bun run --filter @roadraven/plugin-claude-code test tests/scaffold.e2e.test.ts` | 1/1 pass |
| Plugin suite (regression) | `bun run --filter @roadraven/plugin-claude-code test` | 28/28 pass (6 files; 1 new + 27 existing) |
| Desktop suite (regression — pre-commit hook ran full suite) | `bunx vitest run` (via husky) | 467/467 pass (56 files) |
| Biome lint (touched files) | `bunx @biomejs/biome lint plugins/claude-code/` | Clean for new test file; 3 pre-existing warnings (unrelated to this plan, in wsClient.test.ts and userData.test.ts) |
| README has 19-tool catalog | `grep -c "19 tools" plugins/claude-code/README.md` | 1 (>= 1 required) |
| README has agentApi.enabled | `grep -c "agentApi.enabled" plugins/claude-code/README.md` | 1 (>= 1 required) |
| UAT has 7+ Scenario sections | `grep -c "^## Scenario" .planning/phases/06-agentic-roadmap-authoring/06-HUMAN-UAT.md` | 7 (= 7 required) |
| UAT references named story | `grep -c "scaffold" .planning/phases/06-agentic-roadmap-authoring/06-HUMAN-UAT.md` | 1 (>= 1 required) |
| Test has both stub forms | `grep -c "vi.spyOn" tests/scaffold.e2e.test.ts` AND `grep -c "triggerSave" tests/scaffold.e2e.test.ts` | 1 + 4 (BLOCKER 3 acceptance: spyOn>=1, triggerSave>=2) |

## TDD Gate Compliance

This plan is `type: execute`, not `type: tdd` — the existing TDD coverage in 06-01..06-04 already established correctness for each layer. The single E2E test added in this plan is a connectivity check, not a new behavior contract; no RED/GREEN/REFACTOR cycle applies.

(The plan's frontmatter does NOT set `type: tdd`. Verified by reading line 4 of `06-06-PLAN.md`: `type: execute`.)

## Deviations from Plan

### Auto-fixed (Rule 1 / Rule 3) Issues

**1. [Rule 3 - Blocking] Biome `lint/suspicious/noEmptyBlockStatements` blocked the initial RED commit**

- **Found during:** Task 1 commit attempt (pre-commit hook).
- **Issue:** The plan's recommended test code used `vi.spyOn(...).mockImplementation(() => {})` AND `setState({ triggerSave: () => {} })` — biome rejected the empty arrow bodies under `lint/suspicious/noEmptyBlockStatements`.
- **Fix:** Hoisted the no-op into a named `const noopTriggerSave = (): void => { /* JSDoc */ };`. Both call sites now reference the named const. Behavior unchanged; biome accepts the named function with its JSDoc body.
- **Files modified:** `plugins/claude-code/tests/scaffold.e2e.test.ts` (pre-commit revision).
- **Commit:** absorbed into the Task 1 commit (`226bd6e`).
- **Acceptance preserved:** `grep -c "vi.spyOn"` = 1 (>= 1 required); `grep -c "triggerSave"` = 4 (>= 2 required). The plan's BLOCKER 3 fix criterion is satisfied.

### Auth Gates

None. Pure documentation + 1 test file; no external systems, no credentials.

### CLAUDE.md-driven adjustments

- Used `bun run --filter @roadraven/plugin-claude-code test tests/scaffold.e2e.test.ts` per CLAUDE.md "ALWAYS via `bun run`, never `bunx vitest` directly" rule. The plan's `<verify><automated>` block suggested `bun run test:file`, but that script routes only to `packages/desktop`; the workspace filter is the right escape hatch for plugin tests (matching the convention established in 06-01 and 06-02 SUMMARY files).
- All commits were normal commits (no `--no-verify`); pre-commit ran biome → tsc → vitest → fallow audit and all gates passed.
- Used Electrobun (not Electron) — no new imports added; the test file imports only from existing renderer paths that already use `electrobun/view`.

## Self-Check: PASSED

Verified via Read/Grep/Bash:

- `plugins/claude-code/tests/scaffold.e2e.test.ts` — FOUND, 117 lines, 1 `it(...)` call (hard cap held).
- `plugins/claude-code/README.md` — FOUND, includes "19 tools", "agentApi.enabled", 13-code error taxonomy, kill-switch, security model, concurrency model.
- `.planning/phases/06-agentic-roadmap-authoring/06-HUMAN-UAT.md` — FOUND, 7 `## Scenario` headings, sign-off checklist with 7 unticked boxes.
- Commit `226bd6e` (Task 1: scaffold E2E) — FOUND in `git log --oneline -3`.
- Commit `f3fc53a` (Task 2: README + UAT) — FOUND in `git log --oneline -3`.
- 1/1 scaffold E2E test passing.
- 28/28 plugin suite passing (no regression).
- 467/467 desktop suite passing (no regression).
- tsc clean (verified via pre-commit hook running on Task 1 + Task 2).
- Biome clean for new files (3 pre-existing warnings in wsClient.test.ts and userData.test.ts unrelated to this plan).

## Threat Flags

No new threat surface introduced beyond the threat_model already declared in the plan:

- **T-06-06-01 (README leaks user paths or secrets in examples)** — accepted; all examples use placeholder paths (`/tmp/test/roadmap.json`, `C:/Work/RoadRaven/...`, `/etc/passwd` for the negative case in UAT) and no real secrets.
- **T-06-06-02 (UAT script not signed → ambiguous release readiness)** — mitigated; sign-off block has tester name + date + notes + 7-checkbox checklist. The orchestrator's checkpoint resume signal requires "approved" reply quoting the sign-off.
- **T-06-06-03 (E2E test mocks the wire and could mask a real wire-up bug)** — mitigated; the test drives the renderer dispatcher (the brain) directly; transport + Bun gate are tested in 06-02/06-03 with their own contract tests. The combination + the manual UAT (7 scenarios end-to-end through a real Claude Code session) covers the full wire end-to-end.

## Awaiting

**Human tester sign-off on 06-HUMAN-UAT.md.** When the tester replies "approved" with the filled-in sign-off block (or describes failures), the orchestrator will:

1. Commit the signed-off `06-HUMAN-UAT.md` with `docs(06-06): record Phase 6 UAT sign-off`.
2. Update this SUMMARY's `status` from `partial` to `complete` and re-record the sign-off in the Tasks Completed table.
3. Advance STATE.md / ROADMAP.md to mark Phase 6 complete.
4. Mark `PLUG-AGENT-SAFETY-02`, `PLUG-AGENT-CREATE-01`, `PLUG-AGENT-CREATE-02`, `PLUG-AGENT-FILE-01` complete in REQUIREMENTS.md.
5. Hand off to `/gsd-verify-work 06`.
