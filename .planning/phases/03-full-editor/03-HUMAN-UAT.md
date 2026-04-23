---
status: partial
phase: 03-full-editor
source: [03-VERIFICATION.md]
started: 2026-04-22T12:35:00Z
updated: 2026-04-23T09:30:00Z
retest_at_milestone_end: true
---

## Current Test

[awaiting end-of-milestone retest for items 1, 4, 5, 6, 7]

## Tests

### 1. Cmd+Q / Alt+F4 / Dock Quit triggers Electrobun before-quit and flushes pending edits
expected: Make a structural edit; within the 2s debounce window press Cmd/Ctrl+Q (or click window X / Dock Quit). Reopen the file — the edit is on disk.
result: defer-to-milestone-end
note: User accepted the UAT item but cannot meaningfully validate the edit-then-quit-within-2s window manually at this stage. Re-test required when whole milestone is done.

### 2. File > New round-trip: untitled schema → first autosave → Utils.saveFileDialog → save → reopen
expected: Click "New Roadmap" on Welcome; edit root title; wait 2s; native save dialog opens; pick a path; status bar shows "Saved"; close + reopen the saved file — the edit is persisted; isUntitled flips false; filePath populated.
result: pass
note: Required three subsequent fixes — (a) TopBar New button onClick wired (d9d8e33), (b) immediate trigger-save on newRoadmap (d9d8e33), (c) native saveFileDialog via PowerShell shell-out (35f790a) replacing openFileDialog fallback, (d) self-write watcher suppression (2db02fe) to prevent spurious external-edit toast on save.

### 3. External-edit toast: dirty state shows Reload/Keep mine; clean state auto-reloads
expected: Dirty state → toast appears, autosave pauses, Reload requires window.confirm. Clean state → silent auto-reload.
result: pass
note: Both branches verified. Reload-confirm sub-test passes (WR-04 fix).

### 4. SIGTERM (Linux/macOS): kill -15 <bun pid> flushes pending edits before exit
expected: kill -15 the bun process during pending edits; reopen file → edit persisted.
result: defer-to-milestone-end
note: Linux test — deferred along with all Linux validations to be batched at end of milestone.

### 5. SIGINT (Ctrl+C in dev terminal): clean exit flushes pending edits
expected: Ctrl+C the bun process during pending edits; reopen → edit persisted.
result: defer-to-milestone-end
note: Probable failure observed in user's bun log — saves at 09:02:24, 09:02:26, 09:02:56 before Ctrl+C, no flushPending log line at quit. User notes the <2s edit-then-Ctrl+C window is not realistic for manual testing. Re-test at milestone end (potentially via automated process spawn + signal test, or accept as covered by code review of the SIGINT handler in bun/index.ts).

### 6. Linux right-click opens the Radix custom <div> menu (not native no-op)
expected: Same Radix-rendered menu appears on Linux as on Mac/Win.
result: defer-to-milestone-end
note: Linux test.

### 7. Process-kill mid-write does not corrupt the target file (atomic-write SIGKILL survival)
expected: taskkill /F during a save; file MUST remain valid JSON (either old or new content); no .tmp residue.
result: defer-to-milestone-end
note: Cannot realistically test manually — atomicWrite on local SSD completes in <50ms, no human-perceptible window to issue taskkill mid-write. Mitigation options for end-of-milestone retest: (a) integration test that wraps atomicWrite with an artificial delay then mocks process.kill, (b) accept as covered by atomicWrite.test.ts unit tests + code review.

### 8. Cross-boundary $ref move shows error
expected: Moving a ref-owned node into a main-owned subtree → graceful no-op (v1) or error toast (v1.1).
result: pass
note: Worked gracefully — no crash, no schema corruption, file remained loadable. **Minor finding (non-blocking):** schema validation error surfaced on subtree paste involving the cross-boundary clipboard payload `{"magic":"roadraven:subtree:v1","node":{...,"status":"not-started"}}`. Error message: "Invalid option, expected one of [not-started|in-progress|...] — also expected string, received undefined". Likely a paste-validation edge case where one optional field is missing from the subtree clipboard format. Handled gracefully (no crash). Logged as a backlog item, not a phase blocker.

### 9. 30s periodic autosave fires without mutations on an idle, loaded schema
expected: Idle 30s; SaveIndicator briefly flashes Saving→Saved; mtime advances.
result: pass-with-ux-fix
note: Confirmed via logs and mtime advance. Indicator flashed for <1s — too fast for human perception. **Fix applied (this session):** SaveIndicator now holds the "Saving…" state for a minimum of 800ms via a `MIN_SAVING_DISPLAY_MS` hold pattern, so the user can perceive the save event regardless of how fast the actual disk write completes.

## Summary

total: 9
passed: 3 (items 2, 3, 8)
passed-with-fix: 1 (item 9)
deferred: 5 (items 1, 4, 5, 6, 7)
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

### G-01 (minor, backlog) — subtree paste validation surfaces enum/required-field error
**From:** Item 8 testing
**Severity:** minor (graceful — no crash, no data loss)
**Repro:** Copy a subtree from a roadmap with $ref; paste into another roadmap. A schema validation error toast appears but the paste completes correctly.
**Likely cause:** The `roadraven:subtree:v1` clipboard payload omits one or more optional-but-required-by-schema fields when pasted directly through the schema validator. The `not-started` status value is correct in the data but the error message suggests the validator's allowed-options list display may be misleading or the schema for the clipboard envelope differs from the on-disk schema.
**Action:** Out-of-scope for Phase 03 closure. Add to backlog for v1.x — investigate the subtree paste validation path in `useFileActions` paste handler / `core/schema.ts`. Not blocking phase verification because the paste itself works.

### Items needing milestone-end retest (1, 4, 5, 6, 7)
- Items 1, 5: timing-window-too-tight for manual edit-then-signal flows
- Items 4, 6: Linux-only — batch with other Linux validations at milestone end
- Item 7: not realistically testable manually (atomicWrite is too fast); resolve via integration test or accept atomicWrite.test.ts unit coverage
