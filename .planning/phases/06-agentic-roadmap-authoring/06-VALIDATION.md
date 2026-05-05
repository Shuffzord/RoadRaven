---
phase: 6
slug: agentic-roadmap-authoring
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-05
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Filled in detail by the planner; this scaffold encodes the framework + sampling cadence so each PLAN.md task can be slotted into the verification map.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 3.x (existing — see `bun run test:desktop`, `plugins/claude-code/test/*.test.ts`, `packages/desktop/src/bun/__tests__/*.test.ts`) |
| **Config file** | `packages/desktop/vitest.config.ts`, `plugins/claude-code/vitest.config.ts` |
| **Quick run command** | `bun run test:file <changed-test>` (per-task) |
| **Full suite command** | `bun run test` (workspace-wide vitest) |
| **Estimated runtime** | ~quick: 2–5s per file · full: ~30–60s |

---

## Sampling Rate

- **After every task commit:** Run `bun run test:file <changed-test>` for the test files touched by the task.
- **After every plan wave:** Run `bun run test:desktop` (and `bun run test --filter @roadraven/plugin-claude-code` for plugin-only waves) — the per-package suite.
- **Before `/gsd-verify-work`:** Full suite must be green: `bun run verify` (test + typecheck + build + lint).
- **Max feedback latency:** 60 seconds (full suite); 5 seconds (single-file).

---

## Per-Task Verification Map

> Populated by the planner during PLAN.md creation. Every task with `<automated>` must appear here with the exact command. Manual-only behaviors move to the table below.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| _to be filled by planner_ | | | | | | | | | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

> Test scaffolding to install before any feature task runs. Planner expands; minimum baseline below.

- [ ] `plugins/claude-code/test/agent-tools.contract.test.ts` — Zod schema contract tests for the ~17 net-new tool inputs/outputs (one describe block per tool).
- [ ] `plugins/claude-code/test/wsClient.request.test.ts` — request/response correlation, timeout, reconnect-resilience.
- [ ] `packages/desktop/src/bun/__tests__/agent-request-handler.test.ts` — Bun-side request router (dispatch by tool, error taxonomy, ownership check for `moveNode` / `openFile` / `saveFileAs`).
- [ ] `packages/desktop/src/mainview/store/__tests__/agentMutate.bridge.test.ts` — RoadmapRPCType `agentRequest` round-trip into the renderer store, including `updateNodeMetadata` patch + null-delete and the new `moveNode` action.
- [ ] `plugins/claude-code/test/scaffold.e2e.test.ts` — the named "scaffold a roadmap for migrating service X" story: createRoadmap → ~30–50 createNode → autosave fire → file on disk has the assembled tree.
- [ ] Vitest coverage thresholds in `plugins/claude-code/vitest.config.ts` updated to include the new files (carry the existing project-level threshold; do not regress).

*If existing infrastructure covers a layer entirely, the planner notes "Existing infrastructure covers all phase requirements." in the relevant row.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Agent ops surface in EventLogDrawer with plain-English rendering ("Claude → renamed 'Auth' → 'Authentication service'") | PLUG-AGENT-AUDIT-* (planner derives) | UI rendering of `IntegrationEvent.meta` for `source = 'claude-code'` is visual / human-readable; assert the row content via component test where possible, but final visual check is human. | 1. Start app via `bun run dev:hmr`. 2. Run a Claude Code session that calls `createNode`, `renameNode`, `deleteNode`. 3. Open Ctrl+Shift+L. 4. Confirm rows show source + tool + plain-English description, click-row selects the affected node in canvas. |
| Bidirectional contract end-to-end demo | PLUG-AGENT-* (full) | Demonstrates the named user story; humans confirm the live-tree-assembly experience matches the spec. | 1. Start app. 2. From a Claude Code session: ask "scaffold a roadmap for migrating service X." 3. Watch the canvas assemble in real time. 4. Confirm autosave fires within ~2s of last call. 5. Stop the app, reopen the file, confirm the assembled tree persists. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags (vitest run only — never `vitest --watch`)
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
