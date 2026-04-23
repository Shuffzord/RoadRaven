---
phase: 03-full-editor
fixed_at: 2026-04-22T09:57:35.868Z
review_path: .planning/phases/03-full-editor/03-REVIEW.md
iteration: 1
findings_in_scope: 6
fixed: 6
skipped: 0
status: all_fixed
---

# Phase 03: Code Review Fix Report (Wave 3 — Plan 03-04c)

**Fixed at:** 2026-04-22T09:57:35.868Z
**Source review:** `.planning/phases/03-full-editor/03-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope: 6 (1 Critical + 5 Warnings; 4 Info findings excluded by `fix_scope: critical_warning`)
- Fixed: 6
- Skipped: 0

**Verification (post-fix):**
- `bun run test:desktop` -> 333/333 pass
- `bun run test:typecheck` -> clean
- `bun run test:lint` -> 0 errors (6 pre-existing CSS warnings unrelated to fixes)
- `bun run --cwd packages/desktop build` -> success

## Fixed Issues

### CR-01: Race condition between before-quit and SIGINT both calling flushPending concurrently

**Files modified:** `packages/desktop/src/bun/saveFile.ts`, `packages/desktop/src/bun/index.ts`
**Commit:** 7e89e75
**Applied fix:** Added a module-level `flushInFlight` promise in `saveFile.ts` that coalesces concurrent callers — the first caller runs the body inside a `try { ... } finally { flushInFlight = null; }`; subsequent callers return the same promise and await its settlement. Updated `__resetSaveFileModuleForTests` to clear the in-flight handle so test isolation is preserved. Updated `bun/index.ts` so the Electrobun `before-quit` listener now `await`s `flushPending()` instead of fire-and-forget — this means a Ctrl+C in the owning shell (which fires SIGINT and triggers Utils.quit's `before-quit` emit in parallel) cannot tear an `atomicWrite` mid-rename, because the SIGINT handler's `process.exit(0)` waits for the same in-flight promise the before-quit handler is awaiting.

### WR-01: saveFileAs on a still-pending autosave can re-enter and produce two parallel writes to the new path

**Files modified:** `packages/desktop/src/mainview/hooks/useAutosave.ts`, `packages/desktop/src/mainview/hooks/useFileActions.ts`
**Commit:** 404c6ee
**Applied fix:** Two-pronged guard. (1) `useAutosave.flushNow` now calls `state.setSaveState("saving")` BEFORE opening the native save dialog on the untitled / no-filePath branch, so the existing early-return `if (state.saveState === "saving") return;` blocks a re-entrant `flushNow` while the picker is open. On dialog cancel (no `filePath` returned), the guard releases back to `"saved"` so the next mutation can re-prompt. (2) `useFileActions.ts` registers a module-level `inFlightSaveAs: Promise<{ filePath: string | null }> | null`; the `saveAsHandler` for the `roadraven:request-save-as` CustomEvent checks this flag and `await`s the existing promise instead of dispatching a second `saveFileAs` RPC — guards against fast double-clicks on `SaveFailureModal`'s "Save As..." button and against the App+Canvas dual `useFileActions()` registration both firing.

### WR-02: handleExternalFileChange dirty branch doesn't propagate failures from setExternalEdit / silently no-ops on missing rpc on the clean branch

**Files modified:** `packages/desktop/src/mainview/hooks/useFileActions.ts`
**Commit:** 4f664f0
**Applied fix:** On the clean-state branch, the `if (!electroview?.rpc) return;` silent abort now calls `setExternalEdit(payload.path)` instead — the user sees the conflict toast rather than staring at a stale schema with no signal. Wrapped the `loadFile` RPC in `try/catch`; a rejection (e.g. file unlinked between watcher fire and read) now flips to `setExternalEdit` instead of becoming an unhandled promise rejection at the rpcHandlers subscription site.

### WR-03: newFile RPC handler builds ownership map with empty path string

**Files modified:** `packages/desktop/src/bun/refMap.ts`, `packages/desktop/src/bun/index.ts`
**Commit:** 94eafb7
**Applied fix:** Added `clearOwnershipMap()` to `refMap.ts` (clears both `activeOwnership` and `sourceTemplate`). Replaced the `buildOwnershipMap([], "")` call in the `newFile` RPC handler with `clearOwnershipMap()` so we no longer record a `"" -> []` ghost entry. `saveFileAs` rebuilds the map with the chosen path on the first write, restoring the intended invariant.

### WR-04: External-edit toast Reload button discards unsaved edits silently — no confirm step

**Files modified:** `packages/desktop/src/mainview/components/ExternalEditToast.tsx`
**Commit:** 27349ac
**Applied fix:** Added a `handleReload` handler that wraps `resolve("reload")` in `window.confirm("Reload from disk and discard your unsaved changes?")`. The toast Reload button now requires explicit confirmation before destroying unsaved local edits — guards against the documented bottom-center misclick data-loss vector. `Keep mine` remains a single click since it is reversible (next save overwrites disk with local edits).

### WR-05: Test suite for newUntitledSchema does not assert filePath transitions back to a path after subsequent saveFileAs / loadSchema

**Files modified:** `packages/desktop/tests/unit/store/fileActions.test.ts`
**Commit:** 4e958ee
**Applied fix:** Added the missing `expect(useRoadmapStore.getState().filePath).toBe("/tmp/loaded.json")` assertion to test #2 — locks in the round-trip useAutosave depends on (it branches on `isUntitled || !filePath`). Added test #7 that seeds `pendingConfirmation`, `externalEditPending`, and `autosavePaused` then calls `newUntitledSchema()` and asserts all three reset to their cleared state — guards against a future refactor that breaks the current `loadSchema` delegation. All 7 tests in the file pass under `bun run test:file`.

## Skipped Issues

None — all 6 in-scope findings were applied.

## Out-of-scope (Info findings, not addressed in this iteration)

- IN-01: Hardcoded `/tmp/fake-external-change.json` in dev panel
- IN-02: Inline duplicate button styles in ExternalEditToast
- IN-03: useFileActions registered in both App.tsx and Canvas.tsx
- IN-04: `crypto.randomUUID()` called in two places (Bun newFile + store newUntitledSchema)

These remain documented in `03-REVIEW.md` for follow-up.

---

_Fixed: 2026-04-22T09:57:35.868Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
