---
phase: 03-full-editor
type: human-uat-test-plan
created: 2026-04-22
linked_uat: 03-HUMAN-UAT.md
host_assumptions:
  primary: Windows 11 (dev box)
  defer_to_linux: [item-4, item-6]
  os_limitations:
    - "Windows: process.on('SIGTERM') is not reliably delivered by Node — taskkill without /F may not invoke the handler"
    - "Windows: openFileDialog fallback (used until Electrobun ships saveFileDialog) requires picking an EXISTING file"
---

# Phase 03 Human UAT — Test Plan

Concrete reproduction steps for the items remaining in `03-HUMAN-UAT.md` after items 1 and 2 have been re-tested.

## Setup (run once)

```powershell
# Terminal 1 — start the app with HMR
bun run dev:hmr

# Terminal 2 — capture the bun PID for kill tests
tasklist | findstr bun
# Note the PID for the "bun.exe" entry that started during dev:hmr
```

Have a scratch directory ready: `mkdir C:\temp\rr-uat 2>$null`

---

## Item 1 (re-test) — before-quit dirty flush

The first attempt got the no-op path. To exercise the dirty path:

1. `File > Open` → `samples/gsd-roadmap.json` (or any existing JSON roadmap)
2. Click any node; press `F2` or double-click → rename to `BEFORE-QUIT-TEST-<timestamp>`
3. Press Enter to commit the rename
4. **Within 2 seconds** (status bar still shows "Saving…" or hasn't yet flipped to "Saved"), press `Ctrl+Q` (or click the title-bar X)
5. Wait for the bun process to fully exit (terminal returns to prompt)
6. Restart: `bun run dev:hmr`
7. `File > Open` → re-open the same file
8. **PASS:** the renamed node title is still `BEFORE-QUIT-TEST-<timestamp>`
9. **PASS log line:** terminal 1 should show `flushPending: writing N partition(s)` (NOT `no-op`)

**Result fields:** `result: pass` (or `fail` with the observed final title)

---

## Item 2 (re-test, after fixes) — File > New round-trip

Two fixes just landed:
- `TopBar.tsx` "New" button is now wired to `useFileActions().newRoadmap()`
- `useFileActions.newRoadmap` now dispatches `roadraven:trigger-save` so the save dialog pops immediately (no longer needs an edit + 2s wait)

1. Restart `bun run dev:hmr` to pick up the changes
2. With the app on the Welcome screen OR with any file open, click **New** in the topbar (the button next to Open)
3. **PASS A:** an Untitled tree appears with a single "Untitled" node
4. **PASS B:** within ~1 second a Windows file dialog pops up (titled "Save Roadmap" or "Save Roadmap As…" if Electrobun has `saveFileDialog`; OR a generic Open dialog with JSON filter if it's the `openFileDialog` fallback)
5. Navigate to `C:\temp\rr-uat`. **If save dialog:** type `new-test.json` and Save. **If open dialog (fallback):** create an empty file `new-test.json` first via Notepad, then pick it (this is the v1 fallback per Plan 04c — Electrobun 1.16.0 lacks `saveFileDialog`)
6. **PASS C:** status bar transitions briefly to "Saving…" then "Saved"; topbar title (or whatever surface shows the filename) reflects `new-test.json`
7. Close the app entirely
8. Restart, `File > Open` → `C:\temp\rr-uat\new-test.json`
9. **PASS D:** the Untitled tree loads back; isUntitled is now false (verify via DevHarness Shell tab — `filePath: <path>`, `isUntitled: false`)

**Cancel-path sub-test:**
10. Click **New** again on the topbar
11. When the dialog appears, click Cancel
12. **PASS E:** no crash; status bar returns to "Saved"; nothing written to disk
13. Make an edit to the new untitled tree → wait 2s → dialog re-prompts (the cancel keeps you in untitled state)

**Result fields:** `result: pass | fail; saveFileDialog | openFileDialog (fallback); cancel-rprompt: pass | fail`

---

## Item 3 — External-edit toast (dirty + clean branches)

### 3a. Dirty path → toast

1. `File > Open` → any existing roadmap file (e.g. `C:\temp\rr-uat\new-test.json` from Item 2)
2. Rename a node (but **do not wait for autosave**)
3. Immediately Alt-Tab to Notepad / VS Code; open the SAME file
4. Add a single space anywhere in the JSON; save (Ctrl+S in the external editor)
5. Alt-Tab back to RoadRaven
6. **PASS A:** within ~1s a toast appears at the bottom-center: "File changed externally. [Reload File] [Keep mine]"
7. **PASS B:** check StatusBar — autosave indicator should reflect paused state (or hold at last-state)
8. Click **Reload File**
9. **PASS C:** a `window.confirm` modal asks "Reload from disk and discard your unsaved changes?" — click **OK**
10. **PASS D:** the toast disappears; the file content reloads (your in-app rename is gone, the disk version is showing)

### 3b. Clean path → silent auto-reload

1. Open the file again in RoadRaven (or click cancel on confirm and skip step 9 above; just close-reopen for cleanliness)
2. **Make ZERO edits** in RoadRaven
3. In Notepad, change the title in the JSON (e.g. add a suffix to the root node title), save
4. Switch back to RoadRaven
5. **PASS E:** NO toast; canvas updates within ~1s to show the new title (silent auto-reload — Phase 2 behavior)

### 3c. Reload confirm-cancel sub-test

1. Re-trigger the dirty path (steps 1-7 above)
2. Click Reload File → confirm dialog appears
3. Click **Cancel** in the confirm
4. **PASS F:** toast remains visible; in-app edits preserved; nothing reloaded

**Result fields:** `3a: pass|fail; 3b: pass|fail; 3c: pass|fail`

---

## Item 4 — SIGTERM (DEFER TO LINUX)

**Skip on Windows.** Node.js does not reliably deliver `SIGTERM` to JS handlers on Windows (`process.on("SIGTERM")` is documented as not supported). `taskkill /PID` without `/F` may simply not give the handler time to run.

This test must be run on Linux or macOS:

```bash
bun run dev:hmr &
BUN_PID=$!
# In RoadRaven: open a file, rename a node, do NOT wait for save
sleep 0.5
kill -15 $BUN_PID
# Reopen file → rename should be persisted
# Check log for "flushPending: writing N partition(s)" then "process.exit(0)"
```

**Result fields:** `result: deferred-to-linux`

---

## Item 5 — SIGINT (Ctrl+C in dev terminal)

Windows: `Ctrl+C` in a Bash/PowerShell terminal hosting bun typically delivers a CTRL_C_EVENT which Node maps to `SIGINT`. This SHOULD work on Windows for the JS handler.

1. Ensure `bun run dev:hmr` is running in a terminal you can directly interact with
2. In RoadRaven: open a file (`samples/gsd-roadmap.json`)
3. Rename a node (do NOT wait for save)
4. **Within 2 seconds** Alt-Tab to the dev:hmr terminal and press `Ctrl+C`
5. Wait for the process to exit (terminal returns to prompt; expect to see `flushPending: writing N partition(s)` then `process.exit(0)`)
6. Restart `bun run dev:hmr`
7. Re-open the file
8. **PASS A:** rename is on disk
9. **PASS B (CR-01 race fix):** terminal log shows `flushPending: writing N partition(s)` exactly ONCE for that quit (the in-flight promise coalescer prevents the duplicate before-quit + SIGINT from both writing)

If terminal shows TWO `flushPending: writing` lines for the same quit, the CR-01 race fix regressed — flag as fail.

**Result fields:** `result: pass|fail; coalesced: yes|no`

---

## Item 6 — Linux Radix context menu (DEFER TO LINUX)

Cannot be tested from Windows. On a Linux box:

1. `bun run dev:hmr` on Linux
2. Open any roadmap
3. Right-click any node
4. **PASS:** the same Radix-rendered `<div>` menu appears (with shadcn-styled items: Add Child, Add Sibling, Duplicate, Copy, Paste, Move Up/Down, Change Status, Delete) — NOT a native GTK/KDE menu, NOT silence

**Result fields:** `result: deferred-to-linux`

---

## Item 7 — SIGKILL atomic-write survival (Windows-compatible)

This tests that an immediate kill mid-write leaves the file in a valid state (either old content or new content, never partial JSON).

**Setup:** make a backup so you can compare:
```powershell
Copy-Item C:\temp\rr-uat\new-test.json C:\temp\rr-uat\new-test.backup.json
```

1. In RoadRaven, open `C:\temp\rr-uat\new-test.json`
2. Make 3-5 rapid edits in succession (rapid-fire renames, status changes via context menu, delete a leaf, etc.)
3. **The instant** you see "Saving…" flash in the status bar, switch to terminal 2 and run:
   ```powershell
   taskkill /F /PID <bun_pid>
   ```
4. Open `C:\temp\rr-uat\new-test.json` in Notepad
5. **PASS A (no corruption):** the file MUST contain valid JSON — copy it into https://jsonlint.com or run `bun -e "JSON.parse(require('fs').readFileSync('C:/temp/rr-uat/new-test.json','utf8'))"` — exits 0 (no parse error)
6. **PASS B (no orphan tempfiles):** check the directory — there should be NO `.<name>.<pid>.<ts>.tmp` files left over
   ```powershell
   dir C:\temp\rr-uat\.*.tmp
   ```
   This should report no matches.
7. **PASS C (binary state):** the file is EITHER your pre-edit version OR a post-edit version — never a mix. Compare against `new-test.backup.json`. If different, that's fine (a write landed before the kill); if identical, that's also fine (no write landed before the kill).

**Failure modes to flag:**
- Parse error → atomic-write guarantee broken
- Orphan `.tmp` file → cleanup-on-failure regressed
- File has only partial JSON content (truncated mid-key) → rename-then-fsync ordering issue

**Result fields:** `result: pass|fail; parse: ok|error; orphan_tmp: yes|no`

---

## Item 8 — Cross-boundary $ref move (deferred-acceptance check)

**Important:** Plan 04c notes the UI move-blocker hook (`setCrossBoundaryError` toast) is NOT wired in v1. The v1 acceptance criterion is "graceful no-op, no crash, no corruption." The persistence-layer guard (path-traversal allowlist + ownership map) is the actual protection.

1. `File > Open` → `packages/desktop/tests/fixtures/roadmap-with-refs.json`
2. The schema references `referenced-part.json` — once loaded, you should see ALL nodes from both files in one tree (the ref resolved)
3. In the canvas, identify a node owned by the referenced part (check side panel — the file-of-origin should appear, OR look for nodes whose IDs match those in `tests/fixtures/referenced-part.json`)
4. Try to move that ref-owned node into a main-owned subtree:
   - **Method A:** Right-click the node → Move Up / Move Down repeatedly until you'd cross the boundary
   - **Method B:** Select the node, press `Ctrl+↑` or `Ctrl+↓` repeatedly
5. **PASS A (graceful no-op acceptable for v1):** no crash, no console error in DevTools, no schema corruption
6. Wait 2s for autosave (or trigger save via the save bar)
7. Close the app, reopen the same file
8. **PASS B (no corruption):** both files still parse cleanly; the ref relationship still resolves; no orphaned nodes
9. **EXPECTED gap (deferred to v1.1):** no error toast appeared

**If a crash, console error, or schema corruption occurred → FAIL** (this is a real regression in the persistence-layer guard).

**Result fields:** `result: pass|fail; toast_shown: yes|no (expected no for v1); corruption: yes|no`

---

## Item 9 — 30s periodic autosave (wall-clock)

Verifies the `PERIODIC_MS = 30_000` interval timer fires even when the user is idle.

1. Open `C:\temp\rr-uat\new-test.json` (or any file) in RoadRaven
2. Note the file's current `LastWriteTime`:
   ```powershell
   (Get-Item C:\temp\rr-uat\new-test.json).LastWriteTime
   ```
3. **Make ZERO edits.** Sit idle for ~35 seconds (use a stopwatch — give it 5s buffer past the 30s tick)
4. Watch the StatusBar SaveIndicator carefully — it should briefly flicker "Saving…" then back to "Saved" at the 30s mark
5. After ~35s, re-check `LastWriteTime`:
   ```powershell
   (Get-Item C:\temp\rr-uat\new-test.json).LastWriteTime
   ```
6. **PASS A:** `LastWriteTime` advanced from the noted value (the periodic save fired a write, even with no changes)
7. **PASS B (visual):** SaveIndicator briefly showed "Saving…" — even if you missed it, mtime advance is the authoritative signal
8. Optional — wait another 30s and check again. mtime should advance a second time.

**If mtime never advances:** the periodic interval isn't firing — flag as fail. Possible causes: hook unmount-remount loop, periodicRef cleared but not reset, etc.

**Result fields:** `result: pass|fail; mtime_advance_observed: yes|no`

---

## Reporting back

When done, update `03-HUMAN-UAT.md` results:
- `pending` → `pass` / `fail` per item
- For failures, fill the `## Gaps` section with: item number, what happened, expected vs actual

Then ping me with the summary — I'll either route gaps to `/gsd:plan-phase 03 --gaps` or close out the phase.
