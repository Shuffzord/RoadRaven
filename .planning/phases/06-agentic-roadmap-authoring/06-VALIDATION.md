---
phase: 6
slug: agentic-roadmap-authoring
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-05-05
updated: 2026-05-05
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Filled in detail by the planner; this scaffold encodes the framework + sampling cadence so each PLAN.md task can be slotted into the verification map.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 3.x (existing — see `bun run test:desktop`, `plugins/claude-code/tests/*.test.ts`, `packages/desktop/tests/unit/bun/*.test.ts`) |
| **Config files** | `packages/desktop/vitest.config.ts`, `plugins/claude-code/vitest.config.ts` |
| **Quick run command** | `bun run test:file <changed-test>` (per-task) |
| **Full suite command** | `bun run test` (workspace-wide vitest) |
| **Estimated runtime** | quick: 2–5s per file · full: ~30–60s |

---

## Sampling Rate

- **After every task commit:** Run `bun run test:file <changed-test>` for the test files touched by the task.
- **After every plan wave:** Run `bun run test:desktop` (and `bun run test --filter @roadraven/plugin-claude-code` for plugin-only waves) — the per-package suite.
- **Before `/gsd-verify-work`:** Full suite must be green: `bun run verify` (test + typecheck + build + lint).
- **Max feedback latency:** 60 seconds (full suite); 5 seconds (single-file).

---

## Per-Task Verification Map

> Every task across the 6 plans has at least one `<automated>` verify command. Test file paths cited below match the plans verbatim.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 06-01-T1 (RED) | 06-01 | 0 | PLUG-AGENT-* (foundation) | T-06-01-01..03 | 5 contract tests fail before implementation | unit | `bun run test:file plugins/claude-code/tests/agent-contracts.test.ts` | scaffold (created in this task) | ⬜ pending |
| 06-01-T2 (GREEN) | 06-01 | 0 | PLUG-AGENT-SAFETY-01, SAFETY-03, READ/CREATE/UPDATE/DELETE/FILE-* foundations | T-06-01-01..05 | Error-taxonomy + Zod schemas + RPC type + MCP-result helper land green | unit | `bun run test:file plugins/claude-code/tests/agent-contracts.test.ts && bun run test:typecheck` | `plugins/claude-code/tests/agent-contracts.test.ts` | ⬜ pending |
| 06-02-T1 (RED) | 06-02 | 1 | PLUG-AGENT-TRANSPORT-02 | T-06-02-01..06 | 3 wsClient.request transport tests fail before implementation | unit | `bun run test:file plugins/claude-code/tests/wsClient.request.test.ts` | scaffold (created in this task) | ⬜ pending |
| 06-02-T2 (GREEN) | 06-02 | 1 | PLUG-AGENT-TRANSPORT-01, TRANSPORT-02 | T-06-02-01..06 | Bidirectional WS framing + correlation + timeout + close-cleanup land green | unit + regression | `bun run test:file plugins/claude-code/tests/wsClient.request.test.ts && bun run test:file plugins/claude-code/tests/wsClient.test.ts && bun run test:file packages/desktop/tests/unit/bun/eventSchema.test.ts && bun run test:file packages/desktop/tests/unit/bun/eventServer.test.ts && bun run test:typecheck` | `plugins/claude-code/tests/wsClient.request.test.ts` | ⬜ pending |
| 06-03-T1 (RED) | 06-03 | 1 | PLUG-AGENT-SAFETY-01, SAFETY-03, FILE-02, FILE-03, DELETE-01 | T-06-03-01..07 | 6 gate tests fail before agentRequestHandler is implemented | unit | `bun run test:file packages/desktop/tests/unit/bun/agentRequestHandler.test.ts` | scaffold (created in this task) | ⬜ pending |
| 06-03-T2 (GREEN) | 06-03 | 1 | PLUG-AGENT-TRANSPORT-01, SAFETY-01/03, FILE-02/03, DELETE-01 | T-06-03-01..07 | Bun gate sequence (kill-switch + path-allowlist + cross-ref + happy-path forward) lands green | unit + regression | `bun run test:file packages/desktop/tests/unit/bun/agentRequestHandler.test.ts && bun run test:file packages/desktop/tests/unit/bun/eventServer.test.ts && bun run test:typecheck` | `packages/desktop/tests/unit/bun/agentRequestHandler.test.ts` | ⬜ pending |
| 06-04-T1 (RED) | 06-04 | 2 | PLUG-AGENT-READ-01..06, CREATE-01/02, UPDATE-01..06, DELETE-01, FILE-01..03, SAFETY-02 | T-06-04-01..07 | 3 moveNode + 6 dispatcher tests fail before implementation (D-07 live-overlay + D-12 auto-flush + D-04 PATCH + D-03 AND-filter + dispatch routing + unknown_tool) | unit | `bun run test:file packages/desktop/tests/unit/store/roadmapStore.moveNode.test.ts` AND `bun run test:file packages/desktop/tests/unit/mainview/agentRpcHandler.test.ts` (split per plan-checker MEDIUM warning) | scaffolds (created in this task) | ⬜ pending |
| 06-04-T2 (GREEN) | 06-04 | 2 | (same as RED) + D-07 live overlay + D-12 openFile auto-flush | T-06-04-01..07 | Renderer dispatcher + moveNode action + rpc.ts handler land green; agentRpcHandler.ts has at least 18 case branches | unit + regression + grep gate | `bun run test:file packages/desktop/tests/unit/store/roadmapStore.moveNode.test.ts` AND `bun run test:file packages/desktop/tests/unit/mainview/agentRpcHandler.test.ts` AND `bun run test:file packages/desktop/tests/unit/store/roadmapStore.mutations.test.ts` AND `bun run test:typecheck` AND `bash -c "test $(grep -v '^//' packages/desktop/src/mainview/rpc/agentRpcHandler.ts \| grep -c 'case \"') -ge 18"` | `packages/desktop/tests/unit/mainview/agentRpcHandler.test.ts`, `packages/desktop/tests/unit/store/roadmapStore.moveNode.test.ts` | ⬜ pending |
| 06-05-T1 | 06-05 | 3 | PLUG-AGENT-READ-*, CREATE-*, UPDATE-*, DELETE-01, FILE-* | T-06-05-01..04 | 19 server.registerTool calls land; 18 of them route through agentToolCallback; tsc + biome clean | unit + regression | `bun run test --filter @roadraven/plugin-claude-code && bun run test:typecheck && bunx @biomejs/biome lint plugins/claude-code/src/` | (no new test file — coverage delegated to plans 06-01..06-04) | ⬜ pending |
| 06-06-T1 | 06-06 | 3 | PLUG-AGENT-CREATE-01, CREATE-02, FILE-01, SAFETY-02 | T-06-06-03 | 1 connectivity-check E2E test passes; triggerSave stubbed (BLOCKER 3 fix) | e2e | `bun run test:file plugins/claude-code/tests/scaffold.e2e.test.ts \|\| bun run test:file packages/desktop/tests/integration/agentScaffold.e2e.test.ts` | `plugins/claude-code/tests/scaffold.e2e.test.ts` (or fallback) | ⬜ pending |
| 06-06-T2 | 06-06 | 3 | docs only (PACK-05 carry-forward) | T-06-06-01 | README + UAT script files exist with the required sections | doc | `test -f plugins/claude-code/README.md && grep -c "agentApi.enabled" plugins/claude-code/README.md && test -f .planning/phases/06-agentic-roadmap-authoring/06-HUMAN-UAT.md && grep -c "Scenario" .planning/phases/06-agentic-roadmap-authoring/06-HUMAN-UAT.md` | `plugins/claude-code/README.md`, `.planning/phases/06-agentic-roadmap-authoring/06-HUMAN-UAT.md` | ⬜ pending |
| 06-06-T3 | 06-06 | 3 | end-to-end UAT | T-06-06-02 | Manual UAT human checkpoint signed off | manual | `grep -c "\[x\]" .planning/phases/06-agentic-roadmap-authoring/06-HUMAN-UAT.md` (>= 7 ticked scenarios) | `.planning/phases/06-agentic-roadmap-authoring/06-HUMAN-UAT.md` | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

> Test scaffolding to install before any feature task runs. Plan 06-01 IS Wave 0 — once it lands, set `wave_0_complete: true` in the frontmatter.

- [ ] `plugins/claude-code/tests/agent-contracts.test.ts` — 5 contract tests (Plan 06-01): AgentErrorCode 13-code enum, FindNodesInputSchema (D-03), UpdateNodeMetadataInputSchema (D-04), DeleteNodeInputSchema (D-11), agentToolCallback MCP-result shape.
- [ ] `plugins/claude-code/tests/wsClient.request.test.ts` — 3 transport tests (Plan 06-02): resolve, 30s timeout, close-cleanup.
- [ ] `packages/desktop/tests/unit/bun/agentRequestHandler.test.ts` — 6 gate tests (Plan 06-03): kill-switch (RESEARCH §13), path-allowlist on saveFileAs + openFile (D-13), cascade passthrough (D-11), happy-path forward, unknown-method passthrough.
- [ ] `packages/desktop/tests/unit/store/roadmapStore.moveNode.test.ts` — 3 store tests (Plan 06-04): ordering at given position, no-op when newParentId not found, no-op when nodeId not found.
- [ ] `packages/desktop/tests/unit/mainview/agentRpcHandler.test.ts` — 6 dispatcher tests (Plan 06-04): dispatch routing + drawer audit, D-04 PATCH semantics, D-03 AND-filter, unknown_tool, D-07 live-overlay merge, D-12 openFile auto-flush.
- [ ] `plugins/claude-code/tests/scaffold.e2e.test.ts` — 1 connectivity-check E2E (Plan 06-06): createRoadmap → 5 createNode → saveFile assembled tree + 7-row drawer audit.
- [ ] Vitest coverage thresholds in `plugins/claude-code/vitest.config.ts` updated to include the new files (carry the existing project-level threshold; do not regress).

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Agent ops surface in EventLogDrawer with plain-English rendering ("Claude → renamed 'Auth' → 'Authentication service'") | PLUG-AGENT-SAFETY-02 | UI rendering of `IntegrationEvent.meta` for `source = 'claude-code'` is visual / human-readable; Plan 06-04 unit-tests the row append, but the visual rendering is human-confirmed in 06-HUMAN-UAT.md Scenario 7. | 1. Start app via `bun run dev:hmr`. 2. Run a Claude Code session that calls `createNode`, `renameNode`, `deleteNode`. 3. Open Ctrl+Shift+L. 4. Confirm rows show source + tool + plain-English description, click-row selects the affected node in canvas. |
| Bidirectional contract end-to-end demo | PLUG-AGENT-* (full) | Demonstrates the named user story; humans confirm the live-tree-assembly experience matches the spec. The 06-06 E2E test proves the layers wire together; this manual UAT proves the end-user experience holds. | 1. Start app. 2. From a Claude Code session: ask "scaffold a roadmap for migrating service X." 3. Watch the canvas assemble in real time. 4. Confirm autosave fires within ~2s of last call. 5. Stop the app, reopen the file, confirm the assembled tree persists. |
| Cross-ref-boundary moveNode rejection (RESEARCH §Risks L-08) | PLUG-AGENT-UPDATE-05 | Bun gate is asserted by `grep -c "cross_ref_boundary" agentRequestHandler.ts >= 1` (Plan 06-03 source) but not unit-tested (test budget). UAT exercises this in a real `$ref`-linked roadmap. | 1. Open a roadmap with a `$ref` link to a sibling file. 2. Ask Claude to `moveNode` from one side of the boundary to the other. 3. Confirm `Error (cross_ref_boundary): Cannot move node across $ref file boundaries.` |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies (every task above has at least one automated command)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify (every task verifies its own work)
- [x] Wave 0 covers all MISSING references (Plan 06-01 creates the contract files; Plans 06-02..06-04 add their own test scaffolds in their RED tasks)
- [x] No watch-mode flags (vitest run only — never `vitest --watch`)
- [x] Feedback latency < 60s (per-file ~5s; full plugin suite ~30s)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending (frontmatter `wave_0_complete: false` until Plan 06-01 lands; flip to true on commit of `feat(06-01):` GREEN)
