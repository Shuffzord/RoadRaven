---
phase: 3
slug: full-editor
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-04-16
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | `vitest.config.ts` (exists from Phase 2) |
| **Quick run command** | `bunx vitest run --changed` |
| **Full suite command** | `bunx vitest run` |
| **Estimated runtime** | ~15 seconds (Phase 2 baseline: 143 tests) |

---

## Sampling Rate

- **After every task commit:** Run `bunx vitest run --changed`
- **After every plan wave:** Run `bunx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green + `bunx vite build` + `bunx @biomejs/biome lint packages/desktop/src/ shared/`
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

*Populated by gsd-planner when plans are written. Each plan task must list its automated verification command here.*

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 01-T0 | 01 | 1 | EDIT-01..EDIT-08 | T-03.01-01 | Magic envelope gate on paste | unit scaffold | bunx vitest run tests/unit/store/ tests/unit/hooks/ tests/unit/ui/ConfirmationDialog.test.tsx | Wave 0 creates | ⬜ pending |
| 01-T1 | 01 | 1 | EDIT-02..EDIT-06, EDIT-08 | T-03.01-03 | dataKey discipline | unit | bunx vitest run tests/unit/store/roadmapStore.mutations.test.ts | Wave 0 | ⬜ pending |
| 01-T2 | 01 | 1 | EDIT-05 | T-03.01-01, T-03.01-05 | Clipboard envelope + readText fallback | unit | bunx vitest run tests/unit/store/clipboard.test.ts | Wave 0 | ⬜ pending |
| 01-T3 | 01 | 1 | EDIT-01, EDIT-07 | T-03.01-03 | F2/arrow-key focus, activeElement guards | unit+integration | bunx vitest run tests/unit/hooks/useKeyboardRouter.test.ts tests/unit/hooks/useInlineRename.test.ts && bunx vite build | Wave 0 | ⬜ pending |
| 01-T4 | 01 | 1 | EDIT-03 | — | Non-leaf confirm via Radix Dialog | unit | bunx vitest run tests/unit/ui/ConfirmationDialog.test.tsx | Wave 0 | ⬜ pending |
| 01-T5 | 01 | 1 | EDIT-01..EDIT-08 | — | Manual verification of running app | MANUAL UAT | N/A (checkpoint) | ✓ existing | ⬜ pending |
| 02-T1 | 02 | 2 | EDIT-09 | T-03.02-01, T-03.02-02 | Radix ARIA + data-source-id validation | unit+integration | bunx vitest run tests/unit/ui/ContextMenu.test.tsx tests/unit/ui/ContextMenu.keyboard.test.tsx | Wave 0 | ⬜ pending |
| 02-T2 | 02 | 2 | EDIT-09, EDIT-18 | T-03.02-01 | Canvas wiring + CustomEvent bridge | integration | bunx vitest run && bunx vite build && bunx @biomejs/biome lint packages/desktop/src/ shared/ | existing | ⬜ pending |
| 02-T3 | 02 | 2 | EDIT-09, EDIT-18 | — | 50ms render budget (DevTools timing) | MANUAL UAT | DevTools performance trace | ✓ existing | ⬜ pending |
| 03-T1 | 03 | 2 | EDIT-10 | T-03.03-02 | CodeMirror extension whitelist | unit | bunx vitest run tests/unit/hooks/useCodeMirror.test.ts && bunx vite build | Wave 0 | ⬜ pending |
| 03-T2 | 03 | 2 | EDIT-10 | T-03.03-01 | Preview via remark/rehype (Phase 2 sanitization) | unit | bunx vitest run tests/unit/ui/NotesEditor.test.tsx && bunx vite build | Wave 0 | ⬜ pending |
| 03-T3 | 03 | 2 | EDIT-11 | T-03.03-03 | Metadata key/value edit | unit | bunx vitest run tests/unit/ui/MetadataEditor.test.tsx | Wave 0 | ⬜ pending |
| 03-T4 | 03 | 2 | EDIT-12 | T-03.03-05 | Title/status/type edit; copy-ID preserved | unit+integration | bunx vitest run tests/unit/ui/SidePanel.edit-mode.test.tsx && bunx vitest run && bunx vite build && bunx @biomejs/biome lint packages/desktop/src/ shared/ | Wave 0 | ⬜ pending |
| 03-T5 | 03 | 2 | EDIT-10..EDIT-12 | — | Manual verification + theme switching | MANUAL UAT | N/A (checkpoint) | ✓ existing | ⬜ pending |
| 04-T1 | 04 | 3 | EDIT-14, EDIT-16 | T-03.04-01, T-03.04-02 | Atomic write path-traversal + Windows retry +  ownership | unit | bunx vitest run tests/unit/bun/atomicWrite.test.ts tests/unit/bun/refMap.test.ts | Wave 0 + fixtures | ⬜ pending |
| 04-T2 | 04 | 3 | EDIT-13, EDIT-14, EDIT-16, EDIT-17, EDIT-18 | T-03.04-01, T-03.04-07, T-03.04-08 | Zod pre-write validation + before-quit flush | integration (tsc + tests) | bunx vitest run && bunx tsc --noEmit | existing | ⬜ pending |
| 04-T3 | 04 | 3 | EDIT-13, EDIT-15 | T-03.04-05 | Failure escalation bounded at 3; no tight loop | unit | bunx vitest run tests/unit/hooks/useAutosave.test.ts tests/unit/ui/SaveIndicator.test.tsx tests/unit/store/roadmapStore.mutations.test.ts && bunx vite build | Wave 0 | ⬜ pending |
| 04-T4 | 04 | 3 | EDIT-17, D-14 | — | File > New in-memory; external conflict toast | unit+integration | bunx vitest run tests/unit/store/fileActions.test.ts && bunx vitest run && bunx vite build && bunx @biomejs/biome lint packages/desktop/src/ shared/ | Wave 0 | ⬜ pending |
| 04-T5 | 04 | 3 | EDIT-13..EDIT-18, D-14, D-15 | — | 15-subtest manual UAT including SIGKILL survival | MANUAL UAT | N/A (checkpoint) | ✓ existing | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

See `.planning/phases/03-full-editor/03-RESEARCH.md` §Validation Architecture for the authoritative Wave 0 list. Expected entries:

- [ ] `packages/desktop/tests/unit/store/roadmapStore.mutations.test.ts` — store mutation action stubs covering EDIT-01..EDIT-08 (created by Plan 01 Task 0)
- [ ] `packages/desktop/tests/unit/ui/ContextMenu.test.tsx` + `tests/unit/ui/ContextMenu.keyboard.test.tsx` — context menu a11y + keyboard stubs (created by Plan 02 Task 1)
- [ ] `packages/desktop/tests/unit/ui/SidePanel.edit-mode.test.tsx` + `NotesEditor.test.tsx` + `MetadataEditor.test.tsx` — panel editor (created by Plan 03 Tasks 2-4)
- [ ] `packages/desktop/tests/unit/bun/atomicWrite.test.ts` — atomic write + Windows retry (created by Plan 04 Task 1)
- [ ] `packages/desktop/tests/unit/bun/refMap.test.ts` —  ownership + split-by-owner (created by Plan 04 Task 1)
- [ ] `packages/desktop/tests/fixtures/roadmap-with-refs.json` + `referenced-part.json` + `basic-schema.json` + `large-schema.json` — shared fixtures (created by Plan 01 Task 0 and Plan 04 Task 1)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Context menu appears within 50ms | EDIT-09 | Timing budget must be measured in real render, not unit test | Right-click a node; use DevTools performance trace or `performance.mark()` around open/close; assert first paint < 50ms from contextmenu event |
| Atomic write survives process kill | EDIT-14 | Requires OS-level SIGKILL mid-write | Open a file, make edit, trigger save, kill process during `.tmp` write; verify original file unchanged and `.tmp` either committed or orphaned |
| Flush on `before-quit` | EDIT-13 | Requires quit triggers (Cmd+Q, Ctrl+C, dock quit) | Make unsaved edit; quit via each trigger path; re-open file and verify edit persisted |
| Windows 3-attempt retry under lock | EDIT-14 | Requires Windows antivirus/sync tool holding file handle | On Windows, open file in another process that briefly locks it; trigger save; verify retry succeeds within 3 attempts |
| Cross-boundary move error UX | EDIT-18 | Requires visual confirmation of error toast wording | Load schema with `$ref`; attempt to move a node from ref-file-A into subtree owned by ref-file-B; verify error toast appears with clear message |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
