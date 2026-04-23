---
phase: 4
slug: event-api
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-23
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Sourced from `04-RESEARCH.md` § Validation Architecture. Task IDs are assigned by the planner and populated during plan creation / verification.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.4 (already wired — `packages/desktop/vite.config.ts` vitest section) |
| **Config file** | `packages/desktop/vite.config.ts` (desktop) + new `plugins/claude-code/vitest.config.ts` (Wave 0) |
| **Quick run command** | `bun run test:desktop` |
| **Full suite command** | `bun run verify` (test + typecheck + build + lint) |
| **Estimated runtime** | ~6 s desktop quick; ~60 s full verify (per CLAUDE.md baselines) |

---

## Sampling Rate

- **After every task commit:** Run `bun run test:desktop`
- **After every plan wave:** Run `bun run verify`
- **Before `/gsd-verify-work`:** Full suite must be green + HUMAN-UAT scoreboard
- **Max feedback latency:** ~6 s (desktop tests), ~60 s (full verify)

---

## Per-Requirement Verification Map

Task IDs assigned during planning; rows keyed by requirement + decision anchor so the planner can map tasks back.

| Req / Decision | Behavior | Test Type | Automated Command | File Exists |
|---|---|---|---|---|
| PLUG-01 | WS server starts on configurable port with app | integration | `bun run test:desktop tests/integration/eventApi.test.ts` | ❌ W0 |
| PLUG-01 | Port collision fallback (default port, `+1..+9`) | unit | `bun run test:desktop tests/unit/bun/eventServer.test.ts` | ❌ W0 |
| PLUG-01 | User-specified port in use → error pill + toast, no fallback | unit | `bun run test:desktop tests/unit/bun/eventServer.test.ts` | ❌ W0 |
| PLUG-01 / D-04 | Sentinel file written atomically on bind, removed on clean shutdown | unit | `bun run test:desktop tests/unit/bun/sentinel.test.ts` | ❌ W0 |
| PLUG-02 | Event contract shape validated by Zod schema at boundary | unit | `bun run test:desktop tests/unit/bun/eventSchema.test.ts` | ❌ W0 |
| PLUG-02 | Status not in `statusConfig` → `_error: "invalid_status"` | unit | `bun run test:desktop tests/unit/bun/eventSchema.test.ts` | ❌ W0 |
| PLUG-03 | Events routed within 100 ms debounce window (end-to-end) | integration | `bun run test:desktop tests/integration/eventApi.test.ts -t "routes events within 100ms"` | ❌ W0 |
| PLUG-03 / D-25 | Per-node last-write-wins coalesce inside flush window | unit | `bun run test:desktop tests/unit/bun/eventCoalescer.test.ts` | ❌ W0 |
| PLUG-03 / D-25 | Single batched `pushStatusUpdate` per flush | unit | `bun run test:desktop tests/unit/bun/eventCoalescer.test.ts` | ❌ W0 |
| PLUG-04 / D-14 | `data-live="true"` set when `(now - lastEventAt) < 30s`, cleared on 1 Hz tick | unit | `bun run test:desktop tests/unit/store/roadmapStore.liveIndicator.test.ts` | ❌ W0 |
| PLUG-04 / D-15 | Pulse animation respects `prefers-reduced-motion` | manual | HUMAN-UAT §Pulse | manual |
| PLUG-05 / D-16 | Integration zone renders last meta + relative last-event time | unit | `bun run test:desktop tests/unit/ui/IntegrationZone.test.tsx` | ❌ W0 |
| PLUG-06 / D-23 | Malformed event → toast with correct copy | unit | `bun run test:desktop tests/unit/ui/EventToast.test.tsx` | ❌ W0 |
| PLUG-06 / D-24 | Same-type+same-source within 5 s merged, count updates in place | unit | `bun run test:desktop tests/unit/ui/EventToast.test.tsx` | ❌ W0 |
| PLUG-06 / D-23 | Producer disconnect → single info-style toast per disconnect | integration | `bun run test:desktop tests/integration/eventApi.test.ts -t "disconnect"` | ❌ W0 |
| PLUG-07 / D-18 | Drawer `Ctrl+Shift+L` toggle | unit | `bun run test:desktop tests/unit/hooks/useKeyboardRouter.drawer.test.ts` | ❌ W0 |
| PLUG-07 / D-19 | Drawer virtualized rows render correctly at 1000 rows | unit | `bun run test:desktop tests/unit/ui/EventLogDrawer.test.tsx` | ❌ W0 |
| PLUG-07 / D-21 | Row click selects node + camera-follows | integration | `bun run test:desktop tests/integration/eventLog-selection.test.ts` | ❌ W0 |
| PLUG-07 / D-20 | Filter bar: source dropdown, selected-node toggle, status filter | unit | `bun run test:desktop tests/unit/ui/EventLogFilterBar.test.tsx` | ❌ W0 |
| PLUG-08 / D-27 | MCP wrapper builds + `bin` is shebang-executable | unit | `bun run test --cwd plugins/claude-code` | ❌ W0 |
| PLUG-08 | Sentinel resolver returns correct path per platform | unit | `bun run test --cwd plugins/claude-code tests/userData.test.ts` | ❌ W0 |
| PLUG-08 / D-28 | Sentinel race: retries with backoff before failing fast | unit | `bun run test --cwd plugins/claude-code tests/sentinel.test.ts` | ❌ W0 |
| PLUG-08 | WS reconnect: exponential backoff capped at 30 s | unit | `bun run test --cwd plugins/claude-code tests/wsClient.test.ts` | ❌ W0 |
| PLUG-08 / D-29 | End-to-end: MCP tool invocation updates node in app within 100 ms | manual | HUMAN-UAT §MCP | manual |
| PLUG-09 / D-26 | Schema accepts `plugin` + `subscribe` as unknown without error | unit | existing `tests/unit/schema.test.ts` (extend) | ✅ (extend) |
| PLUG-09 / D-26 | Unknown `plugin.id` accepted silently (no warning) | unit | `tests/unit/schema.test.ts` | ✅ (extend) |
| D-25 | `applyEventBatch` action is in-place (no `dataKey` bump) | unit | `bun run test:desktop tests/unit/store/roadmapStore.applyEventBatch.test.ts` | ❌ W0 |
| D-09 | All error paths land in `.events.jsonl` with `_error` field | unit | `bun run test:desktop tests/unit/bun/eventsLog.test.ts` | ❌ W0 |
| D-10 | Replay on file open reduces to last-event-per-nodeId | unit | `bun run test:desktop tests/unit/bun/eventsLog.test.ts` | ❌ W0 |
| D-06 | Status-bar pill state machine (off / listening / connected / error) | unit | `bun run test:desktop tests/unit/ui/StatusBarEventPill.test.tsx` | ❌ W0 |
| D-04 / D-05 | `<userData>/event-api.json` shape + atomic write | unit | `bun run test:desktop tests/unit/bun/sentinel.test.ts` | ❌ W0 |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky — populated by executor as tasks land.*

---

## Wave 0 Requirements

New test files this phase (all scaffolded in a Wave 0 plan before implementation waves start):

- [ ] `packages/desktop/tests/unit/bun/eventSchema.test.ts`
- [ ] `packages/desktop/tests/unit/bun/eventCoalescer.test.ts`
- [ ] `packages/desktop/tests/unit/bun/eventsLog.test.ts`
- [ ] `packages/desktop/tests/unit/bun/sentinel.test.ts`
- [ ] `packages/desktop/tests/unit/bun/eventServer.test.ts`
- [ ] `packages/desktop/tests/unit/bun/eventServer.eaddrinuse.test.ts` (I-04 dedicated EADDRINUSE coverage; stub in Wave 0, body in 04-02 Task 5)
- [ ] `packages/desktop/tests/integration/eventApi.test.ts`
- [ ] `packages/desktop/tests/integration/eventApi-e2e.test.ts` (requires standalone Bun launcher — see RESEARCH §7.3)
- [ ] `packages/desktop/tests/integration/eventLog-selection.test.ts`
- [ ] `packages/desktop/tests/unit/store/roadmapStore.applyEventBatch.test.ts`
- [ ] `packages/desktop/tests/unit/store/roadmapStore.liveIndicator.test.ts`
- [ ] `packages/desktop/tests/unit/store/eventApiStore.test.ts`
- [ ] `packages/desktop/tests/unit/store/eventLogStore.test.ts`
- [ ] `packages/desktop/tests/unit/ui/IntegrationZone.test.tsx`
- [ ] `packages/desktop/tests/unit/ui/EventToast.test.tsx`
- [ ] `packages/desktop/tests/unit/ui/EventLogDrawer.test.tsx`
- [ ] `packages/desktop/tests/unit/ui/EventLogFilterBar.test.tsx`
- [ ] `packages/desktop/tests/unit/ui/StatusBarEventPill.test.tsx`
- [ ] `packages/desktop/tests/unit/hooks/useKeyboardRouter.drawer.test.ts`
- [ ] `plugins/claude-code/tests/userData.test.ts`
- [ ] `plugins/claude-code/tests/sentinel.test.ts`
- [ ] `plugins/claude-code/tests/wsClient.test.ts`
- [ ] `plugins/claude-code/vitest.config.ts` (new — plugins workspace doesn't have one today)

*Vitest 4.1.4 already installed; no new framework additions required.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Pulse animation visually plays / stops at 30 s boundary; respects OS reduced-motion toggle | PLUG-04 / D-15 | Animation timing + OS-level motion setting are not reliably assertable in JSDOM | HUMAN-UAT: open a node, push an event, confirm pulse animates; wait 30 s, confirm pulse stops; toggle OS reduced-motion, push again, confirm static highlight ring replaces animation |
| Claude Code MCP end-to-end round trip updates node badge ≤ 100 ms | PLUG-08 / D-29 | Requires an external MCP host (Claude Code CLI) process we don't spawn from Vitest | HUMAN-UAT: start app, launch Claude Code with the wrapper registered, invoke `updateNodeStatus` tool, observe badge change and drawer row |
| Status-bar pill click → copy URL / open drawer affordance feels right across all 4 states | D-06 | User-perceived latency + clipboard | HUMAN-UAT: verify pill click in `listening`, `listening+connected>0`, `error`, `off` states does the documented action |
| Welcome-screen URL line visible and copy button works | D-07 | Clipboard + layout | HUMAN-UAT: relaunch app, read URL from welcome screen footer |
| Drawer resize handle feels right within clamp (24 px – 70 % viewport) | D-18 | Perceived drag ergonomics | HUMAN-UAT: drag drawer edge through full range |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags in commands
- [ ] Feedback latency < 60 s
- [ ] `nyquist_compliant: true` set in frontmatter (flip after planner maps tasks and checker confirms)

**Approval:** pending
