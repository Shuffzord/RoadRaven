---
phase: 3
slug: full-editor
status: draft
nyquist_compliant: false
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
| TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

See `.planning/phases/03-full-editor/03-RESEARCH.md` §Validation Architecture for the authoritative Wave 0 list. Expected entries:

- [ ] `packages/desktop/src/renderer/stores/__tests__/roadmapStore.mutations.test.ts` — store mutation action stubs covering EDIT-01..EDIT-08
- [ ] `packages/desktop/src/renderer/components/__tests__/ContextMenu.test.tsx` — context menu a11y + keyboard stubs (EDIT-09)
- [ ] `packages/desktop/src/renderer/components/__tests__/SidePanelEditor.test.tsx` — editor mode + metadata table stubs (EDIT-10..EDIT-12)
- [ ] `packages/desktop/src/bun/__tests__/atomicWrite.test.ts` — atomic write + Windows retry stubs (EDIT-13..EDIT-15)
- [ ] `packages/desktop/src/bun/__tests__/refWriteBack.test.ts` — `$ref` ownership + cross-boundary stubs (EDIT-17..EDIT-18)
- [ ] `tests/fixtures/roadmap-with-refs.json` — shared fixture schema exercising `$ref`

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
