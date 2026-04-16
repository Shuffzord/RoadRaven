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
| 01-T0 | 01 | 1 | EDIT-01..EDIT-08 | T-03.01-01 | Magic envelope gate on paste | unit scaffold | bunx vitest run tests/unit/store/ tests/unit/hooks/ tests/unit/ui/ConfirmationDialog.test.tsx | Wave 0 creates | pending |
| 01-T1 | 01 | 1 | EDIT-02..EDIT-06, EDIT-08 | T-03.01-03 | dataKey discipline | unit | bunx vitest run tests/unit/store/roadmapStore.mutations.test.ts | Wave 0 | pending |
| 01-T2 | 01 | 1 | EDIT-05 | T-03.01-01, T-03.01-05 | Clipboard envelope + readText fallback | unit | bunx vitest run tests/unit/store/clipboard.test.ts | Wave 0 | pending |
| 01-T3 | 01 | 1 | EDIT-01, EDIT-07 | T-03.01-03 | F2/arrow-key focus, activeElement guards | unit+integration | bunx vitest run tests/unit/hooks/useKeyboardRouter.test.ts tests/unit/hooks/useInlineRename.test.ts && bunx vite build | Wave 0 | pending |
| 01-T4 | 01 | 1 | EDIT-03 | — | Non-leaf confirm via Radix Dialog | unit | bunx vitest run tests/unit/ui/ConfirmationDialog.test.tsx | Wave 0 | pending |
| 01-T5 | 01 | 1 | — | — | DevHarness MutationsPanel (dev-only; production strip verified) | integration | cd packages/desktop && bunx vite build && ! grep -rq MutationsPanel packages/desktop/build/ 2>/dev/null | _dev/MutationsPanel.tsx | pending |
| 01-T6 | 01 | 1 | — | — | Mid-plan UAT — click through MutationsPanel | MANUAL UAT | N/A (checkpoint) | existing | pending |
| 01-T7 | 01 | 1 | EDIT-01..EDIT-08 | — | Full-plan manual verification of running app | MANUAL UAT | N/A (checkpoint) | existing | pending |
| 02-T1 | 02 | 2 | EDIT-09 | T-03.02-01, T-03.02-02 | Radix ARIA + data-source-id validation + no-double-fire assertion | unit+integration | bunx vitest run tests/unit/ui/ContextMenu.test.tsx tests/unit/ui/ContextMenu.keyboard.test.tsx | Wave 0 | pending |
| 02-T2 | 02 | 2 | EDIT-09, EDIT-18 | T-03.02-01 | Canvas wiring + CustomEvent bridge | integration | bunx vitest run && bunx vite build && bunx @biomejs/biome lint packages/desktop/src/ shared/ | existing | pending |
| 02-T3 | 02 | 2 | EDIT-09 | — | 50ms render budget — AUTOMATED (Playwright median-of-5, small + 300-node trees) | Playwright ui | bunx playwright test --project=ui tests/ui/context-menu-50ms.spec.ts | Wave 0 (Plan 02 Task 3 creates; depends on Plan 01 Task 0 large-schema.json fixture) | pending |
| 02-T4 | 02 | 2 | — | — | DevHarness MenuPanel (dev-only; production strip verified) | integration | cd packages/desktop && bunx vite build && ! grep -rq MenuPanel packages/desktop/build/ 2>/dev/null | _dev/MenuPanel.tsx | pending |
| 02-T5 | 02 | 2 | — | — | Mid-plan UAT — click through MenuPanel | MANUAL UAT | N/A (checkpoint) | existing | pending |
| 02-T6 | 02 | 2 | EDIT-09, EDIT-18 | — | Visual polish + Linux fallback spot-check | MANUAL UAT | N/A (checkpoint) | existing | pending |
| 03-T1 | 03 | 2 | EDIT-10 | T-03.03-02 | CodeMirror extension whitelist | unit | bunx vitest run tests/unit/hooks/useCodeMirror.test.ts && bunx vite build | Wave 0 | pending |
| 03-T2 | 03 | 2 | EDIT-10 | T-03.03-01 | Preview via remark/rehype (Phase 2 sanitization) | unit | bunx vitest run tests/unit/ui/NotesEditor.test.tsx && bunx vite build | Wave 0 | pending |
| 03-T3 | 03 | 2 | EDIT-11 | T-03.03-03 | Metadata key/value edit | unit | bunx vitest run tests/unit/ui/MetadataEditor.test.tsx | Wave 0 | pending |
| 03-T4 | 03 | 2 | EDIT-12 | T-03.03-05 | Title/status/type edit; copy-ID preserved | unit+integration | bunx vitest run tests/unit/ui/SidePanel.edit-mode.test.tsx && bunx vitest run && bunx vite build && bunx @biomejs/biome lint packages/desktop/src/ shared/ | Wave 0 | pending |
| 03-T5 | 03 | 2 | — | — | DevHarness EditorPanel (dev-only; production strip verified) | integration | cd packages/desktop && bunx vite build && ! grep -rq EditorPanel packages/desktop/build/ 2>/dev/null | _dev/EditorPanel.tsx | pending |
| 03-T6 | 03 | 2 | — | — | Mid-plan UAT — click through EditorPanel | MANUAL UAT | N/A (checkpoint) | existing | pending |
| 03-T7 | 03 | 2 | EDIT-10..EDIT-12 | — | Full-plan manual verification + theme switching | MANUAL UAT | N/A (checkpoint) | existing | pending |
| 04a-T1 | 04a | 1 | EDIT-14, EDIT-16 | T-03.04-01, T-03.04-02 | Atomic write path-traversal + Windows retry + ref-ownership + deleted-template-node drop + saveFile RED scaffold | unit | bunx vitest run tests/unit/bun/atomicWrite.test.ts tests/unit/bun/refMap.test.ts (saveFile.test.ts RED scaffold committed) | Wave 0 + fixtures + saveFile.test.ts | pending |
| 04a-T2 | 04a | 1 | EDIT-17, EDIT-18 | T-03.04-01, T-03.04-07 | Path-traversal allowlist + Zod pre-write + idempotent flushPending + loadFile ownership hydration (GREEN for saveFile.test.ts 7 tests) | unit+integration | bunx vitest run tests/unit/bun/saveFile.test.ts tests/unit/bun/atomicWrite.test.ts tests/unit/bun/refMap.test.ts && bunx vitest run && bunx tsc --noEmit | saveFile.test.ts | pending |
| 04a-T3 | 04a | 1 | — | T-03.04-10 | DevHarness scaffold + PersistencePanel (dev-only; production strip verified) | integration | cd packages/desktop && bunx vite build && ! grep -rq DevHarness packages/desktop/build/ 2>/dev/null | _dev/DevHarness.tsx + _dev/PersistencePanel.tsx | pending |
| 04a-T4 | 04a | 1 | — | — | Mid-plan UAT — click through PersistencePanel | MANUAL UAT | N/A (checkpoint) | existing | pending |
| 04a-T5 | 04a | 1 | EDIT-14, EDIT-16, EDIT-17, EDIT-18 | — | Full-plan UAT: atomic write SIGKILL, ref split, path-traversal, Zod pre-write | MANUAL UAT | N/A (checkpoint) | existing | pending |
| 04b-T1 | 04b | 2 | EDIT-15 | — | Store saveState machine + Warning-8 lastSavedDataKey/lastSavedStatusTick snapshots | unit | bunx vitest run tests/unit/store/roadmapStore.mutations.test.ts | Wave 0 extension | pending |
| 04b-T2 | 04b | 2 | EDIT-13, EDIT-15 | T-03.04-05 | useAutosave triple-timer + SaveIndicator + SaveFailureModal + failure escalation bounded at 3 | unit+integration | bunx vitest run tests/unit/hooks/useAutosave.test.ts tests/unit/ui/SaveIndicator.test.tsx && bunx vite build | Wave 0 | pending |
| 04b-T3 | 04b | 2 | — | T-03.04-11 | DevHarness AutosavePanel (dev-only; production strip verified) | integration | cd packages/desktop && bunx vite build && ! grep -rq AutosavePanel packages/desktop/build/ 2>/dev/null | _dev/AutosavePanel.tsx | pending |
| 04b-T4 | 04b | 2 | — | — | Mid-plan UAT — click through AutosavePanel (trigger save + force failure N=1,2,3) | MANUAL UAT | N/A (checkpoint) | existing | pending |
| 04b-T5 | 04b | 2 | EDIT-13, EDIT-15 | — | Full-plan UAT: debounce timing + SIGKILL survival + failure escalation + derived-dirty | MANUAL UAT | N/A (checkpoint) | existing | pending |
| 04c-T1 | 04c | 3 | EDIT-13, EDIT-17, EDIT-18 | T-03.04-08 | Electrobun before-quit + SIGTERM/SIGINT handlers + newFile/saveFileAs RPC (tsc + no @ts-expect-error) | integration (tsc) | bunx tsc --noEmit && bunx vitest run && bunx vite build | existing | pending |
| 04c-T2 | 04c | 3 | EDIT-17, D-14 | — | newUntitledSchema + useFileActions.newRoadmap + pushFileChanged derived-dirty + reload/saveAs CustomEvent bridges + ExternalEditToast | unit+integration | bunx vitest run tests/unit/store/fileActions.test.ts && bunx vitest run && bunx vite build && bunx @biomejs/biome lint packages/desktop/src/ shared/ | Wave 0 | pending |
| 04c-T3 | 04c | 3 | — | — | DevHarness ShellPanel (dev-only; production strip verified) | integration | cd packages/desktop && bunx vite build && ! grep -rq ShellPanel packages/desktop/build/ 2>/dev/null | _dev/ShellPanel.tsx | pending |
| 04c-T4 | 04c | 3 | — | — | Mid-plan UAT — click through ShellPanel (File>New, simulate external change) | MANUAL UAT | N/A (checkpoint) | existing | pending |
| 04c-T5 | 04c | 3 | EDIT-13..EDIT-18, D-14, D-15 | — | Full Phase 3 UAT: File>New, Cmd+Q flush, SIGTERM flush, external edit toast, Linux Radix menu, integration regression | MANUAL UAT | N/A (checkpoint) | existing | pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

See `.planning/phases/03-full-editor/03-RESEARCH.md` §Validation Architecture for the authoritative Wave 0 list. Expected entries:

- [ ] `packages/desktop/tests/unit/store/roadmapStore.mutations.test.ts` — store mutation action stubs covering EDIT-01..EDIT-08 (created by Plan 01 Task 0)
- [ ] `packages/desktop/tests/unit/ui/ContextMenu.test.tsx` + `tests/unit/ui/ContextMenu.keyboard.test.tsx` — context menu a11y + keyboard stubs (created by Plan 02 Task 1)
- [ ] `packages/desktop/tests/unit/ui/SidePanel.edit-mode.test.tsx` + `NotesEditor.test.tsx` + `MetadataEditor.test.tsx` — panel editor (created by Plan 03 Tasks 2-4)
- [ ] `packages/desktop/tests/unit/bun/atomicWrite.test.ts` — atomic write + Windows retry (created by Plan 04a Task 1)
- [ ] `packages/desktop/tests/unit/bun/refMap.test.ts` — ownership + split-by-owner + deleted-template-node drop test (Warning 4; created by Plan 04a Task 1)
- [ ] `packages/desktop/tests/unit/bun/saveFile.test.ts` — path-traversal allowlist + Zod pre-write + flushPending idempotency + loadFile ownership hydration (Blocker 2; RED scaffold created by Plan 04a Task 1, GREEN in Plan 04a Task 2)
- [ ] `packages/desktop/tests/ui/context-menu-50ms.spec.ts` — Playwright median-of-5 50ms budget test (Warning 6; created by Plan 02 Task 3; depends on Plan 01 Task 0 large-schema.json fixture of ≥300 nodes)
- [ ] `packages/desktop/tests/fixtures/roadmap-with-refs.json` + `referenced-part.json` + `basic-schema.json` + `large-schema.json` (300-node tree) — shared fixtures (created by Plan 01 Task 0 and Plan 04a Task 1)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Context menu visual polish + Linux native fallback spot-check | EDIT-09, EDIT-18 | Visual verification of animation/colours + confirmation that Linux does not show native OS menu. 50ms budget is AUTOMATED in 02-T3 — this manual step is a spot-check of that gate on the local machine. | `bunx playwright test --project=ui tests/ui/context-menu-50ms.spec.ts` (automated), then manual visual confirm during Task 4 checkpoint |
| Atomic write survives process kill | EDIT-14 | Requires OS-level SIGKILL mid-write | Open a file, make edit, trigger save, kill process during `.tmp` write; verify original file unchanged and `.tmp` either committed or orphaned |
| Flush on `before-quit` | EDIT-13 | Requires quit triggers (Cmd+Q, Ctrl+C, dock quit) | Make unsaved edit; quit via each trigger path; re-open file and verify edit persisted |
| Windows 3-attempt retry under lock | EDIT-14 | Requires Windows antivirus/sync tool holding file handle | On Windows, open file in another process that briefly locks it; trigger save; verify retry succeeds within 3 attempts |
| Cross-boundary move error UX | EDIT-18 | Requires visual confirmation of error toast wording | Load schema with `$ref`; attempt to move a node from ref-file-A into subtree owned by ref-file-B; verify error toast appears with clear message |
| Dev-harness directory deletion | — | `_dev/` is dev-only tooling; must be deleted at phase close before verify-work | Before `/gsd-verify-work` passes Phase 3, confirm `packages/desktop/src/renderer/components/_dev/` directory is removed. Actual delete runs in `/gsd-verify-work`. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
