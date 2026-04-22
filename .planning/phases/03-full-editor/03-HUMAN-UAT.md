---
status: partial
phase: 03-full-editor
source: [03-VERIFICATION.md]
started: 2026-04-22T12:35:00Z
updated: 2026-04-22T12:35:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Cmd+Q / Alt+F4 / Dock Quit triggers Electrobun before-quit and flushes pending edits
expected: Make a structural edit; within the 2s debounce window press Cmd/Ctrl+Q (or click window X / Dock Quit). Reopen the file — the edit is on disk.
result: [pending]

### 2. File > New round-trip: untitled schema → first autosave → Utils.saveFileDialog → save → reopen
expected: Click "New Roadmap" on Welcome; edit root title; wait 2s; native save dialog opens; pick a path; status bar shows "Saved"; close + reopen the saved file — the edit is persisted; isUntitled flips false; filePath populated.
result: [pending]

### 3. External-edit toast: dirty state shows Reload/Keep mine; clean state auto-reloads
expected: (a) Make an edit, then externally modify the same file in another editor — ExternalEditToast appears with "File changed externally. [Reload File] [Keep mine]"; autosave pauses. Click Reload — confirm dialog appears (per WR-04 fix); confirm — file re-loads. (b) With no local edits, external modification triggers silent auto-reload (Phase 2 behaviour).
result: [pending]

### 4. SIGTERM (Linux/macOS): kill -15 <bun pid> flushes pending edits before exit
expected: Make an edit; within debounce window run `kill -15 <bun pid>`. Reopen file — edit is on disk.
result: [pending]

### 5. SIGINT (Ctrl+C in dev terminal): clean exit flushes pending edits
expected: Make an edit; within debounce window press Ctrl+C in the terminal hosting `bun run dev:hmr`. Reopen file — edit is on disk. Verify CR-01 race fix: no truncated file, no double-write.
result: [pending]

### 6. Linux right-click opens the Radix custom <div> menu (not native no-op)
expected: On Linux, right-click a node — the same Radix menu appears as on Mac/Win (not a native OS menu, not silence).
result: [pending]

### 7. Process-kill mid-write does not corrupt the target file (atomic-write SIGKILL survival)
expected: Make an edit; immediately `taskkill /F /PID <bun pid>` (Windows) or `kill -9 <bun pid>` (Unix). Reopen file — either original OR the edit is intact; no .tmp residue mid-target; no partial JSON.
result: [pending]

### 8. Cross-boundary $ref move shows error
expected: Load a schema with $ref (tests/fixtures/roadmap-with-refs.json). Attempt to move a ref-owned node into a main-owned subtree via Plan 01 mutations. Expect a clear error toast or graceful no-op (deferred to v1.1 — Plan 04c documents acceptance).
result: [pending]

### 9. 30s periodic autosave fires without mutations on an idle, loaded schema
expected: Load a file; do not edit. After 30s observe the SaveIndicator briefly show "Saving..." then "Saved" (or check file mtime advance) — the periodic interval is firing.
result: [pending]

## Summary

total: 9
passed: 0
issues: 0
pending: 9
skipped: 0
blocked: 0

## Gaps
