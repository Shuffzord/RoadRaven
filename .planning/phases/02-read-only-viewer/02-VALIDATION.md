---
phase: 2
slug: read-only-viewer
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-15
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.4 |
| **Config file** | `packages/desktop/vitest.config.ts` |
| **Quick run command** | `cd packages/desktop && bunx vitest run tests/unit/` |
| **Full suite command** | `cd packages/desktop && bunx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd packages/desktop && bunx vitest run tests/unit/`
- **After every plan wave:** Run `cd packages/desktop && bunx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | VIEW-01 | — | N/A | unit | `bunx vitest run tests/unit/schema.test.ts -x` | ❌ W0 | ⬜ pending |
| 02-01-02 | 01 | 1 | VIEW-01 | — | N/A | unit | `bunx vitest run tests/unit/schema.test.ts -x` | ❌ W0 | ⬜ pending |
| 02-01-03 | 01 | 1 | VIEW-02 | — | N/A | unit | `bunx vitest run tests/unit/store/roadmapStore.test.ts -x` | ❌ W0 | ⬜ pending |
| 02-01-04 | 01 | 1 | VIEW-02 | — | N/A | unit | `bunx vitest run tests/unit/store/roadmapStore.test.ts -x` | ❌ W0 | ⬜ pending |
| 02-01-05 | 01 | 1 | VIEW-03 | — | N/A | unit | `bunx vitest run tests/unit/store/roadmapStore.test.ts` | ❌ W0 | ⬜ pending |
| 02-02-01 | 02 | 2 | VIEW-07 | — | N/A | unit | `bunx vitest run tests/unit/fileWatcher.test.ts -x` | ❌ W0 | ⬜ pending |
| 02-02-02 | 02 | 2 | VIEW-08 | — | N/A | unit | `bunx vitest run tests/unit/schema.test.ts` | ❌ W0 | ⬜ pending |
| 02-02-03 | 02 | 2 | VIEW-12 | — | N/A | unit | `bunx vitest run tests/unit/fileWatcher.test.ts` | ❌ W0 | ⬜ pending |
| 02-03-01 | 03 | 3 | VIEW-14 | — | N/A | unit | `bunx vitest run tests/unit/settings.test.ts -x` | ❌ W0 | ⬜ pending |
| 02-04-01 | 04 | 4 | VIEW-11 | — | N/A | bench | `bunx vitest bench tests/bench/perf.bench.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/desktop/tests/unit/schema.test.ts` — stubs for VIEW-01, VIEW-08
- [ ] `packages/desktop/tests/unit/store/roadmapStore.test.ts` — stubs for VIEW-02, VIEW-03
- [ ] `packages/desktop/tests/unit/fileWatcher.test.ts` — stubs for VIEW-07, VIEW-12
- [ ] `packages/desktop/tests/unit/settings.test.ts` — stubs for VIEW-14
- [ ] `packages/desktop/tests/bench/perf.bench.ts` — stubs for VIEW-11
- [ ] `packages/desktop/tests/bench/` directory — create

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Status badge rendering (4px stripe + pill) | VIEW-06 | Visual styling requires browser | Open tree with nodes of each status; verify colors match theme tokens |
| Side panel displays title, status, type, timestamps, notes | VIEW-09 | UI layout + markdown rendering | Click node; verify all fields render; check markdown renders GFM |
| Welcome screen shows on empty state | VIEW-13 | Visual layout verification | Launch app without opening a file; verify hero, buttons, sample links |
| Collapse/expand subtrees | VIEW-04 | Interactive behavior | Click collapse/expand controls; verify depth-3 default |
| Zoom/pan controls | VIEW-05 | Interactive behavior | Scroll wheel zoom, pinch zoom, drag pan; verify fit-to-view reset |
| Side panel resize + pin | VIEW-10 | Interactive behavior | Drag resize handle; check min 320px, max 50%; widen to 1400px for pin |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
