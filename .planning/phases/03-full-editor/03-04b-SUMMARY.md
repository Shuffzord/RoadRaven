---
phase: 03-full-editor
plan: 04b
subsystem: autosave-ui
tags: [autosave, save-state-machine, debounce, save-indicator, failure-escalation, warning-8, zustand]

requires:
  - phase: 03-full-editor
    plan: 01
    provides: dataKey / statusTick mutation discipline, Zustand store base
  - phase: 03-full-editor
    plan: 04a
    provides: saveFile RPC, atomic-write guarantee, dialog allowlist
provides:
  - Store save-state machine fields + actions (saveState, failureCount, lastSaveError, lastSavedDataKey, lastSavedStatusTick, externalEditPending, autosavePaused)
  - setSaveState / setExternalEdit / resolveExternalEdit / triggerSave actions
  - Pure hasUnsavedEdits(state) helper — Warning 8 derived-dirty condition
  - useAutosave hook (2s structural / 1s notes / 30s periodic debounce + 5s auto-retry + 3-stage failure escalation)
  - SaveIndicator StatusBar widget (5 visual states; error-manual is clickable)
  - SaveFailureModal (Radix dialog with Retry / Save As… / Dismiss)
  - AutosavePanel DevHarness for mid-plan UAT
affects: [03-04c]

tech-stack:
  added: []
  patterns:
    - "Warning 8 snapshot pattern: capture dataKey/statusTick at flush-start, commit atomically on success"
    - "CustomEvent bridge between store actions and hook (roadraven:trigger-save, roadraven:request-save-as, roadraven:reload-file)"
    - "store.subscribe() with ref-tracked last-seen keys drives per-debounce-bucket timers"
    - "failureCount explicit-bump for error-manual/error-modal transitions (setSaveState by design only increments on error-retrying)"

key-files:
  created:
    - packages/desktop/src/mainview/hooks/useAutosave.ts
    - packages/desktop/src/mainview/components/SaveIndicator.tsx
    - packages/desktop/src/mainview/components/SaveFailureModal.tsx
    - packages/desktop/src/renderer/components/_dev/AutosavePanel.tsx
    - packages/desktop/tests/unit/hooks/useAutosave.test.ts
    - packages/desktop/tests/unit/ui/SaveIndicator.test.tsx
    - .planning/phases/03-full-editor/deferred-items.md
  modified:
    - packages/desktop/src/mainview/store/roadmapStore.ts (added save-state fields + actions + hasUnsavedEdits export)
    - packages/desktop/src/mainview/components/StatusBar.tsx (mounted SaveIndicator in right section)
    - packages/desktop/src/mainview/App.tsx (useAutosave(); <SaveFailureModal />)
    - packages/desktop/tests/unit/store/roadmapStore.mutations.test.ts (+6 save-state tests — this file was originally authored by Plan 01)

key-decisions:
  - "error-manual and error-modal transitions bypass setSaveState's failureCount logic: handleFailure writes both saveState and failureCount directly so the counter matches the actual escalation depth. setSaveState by design only bumps failureCount on error-retrying."
  - "CustomEvent bridge (roadraven:trigger-save / request-save-as / reload-file) keeps the store free of RPC imports — hook owns flushNow, store only dispatches."
  - "SaveFailureModal overlay uses Tailwind bg-black/60 (matches ConfirmationDialog) instead of inline rgba — token-compliance test scans for hardcoded colors."
  - "useAutosave seeds lastDataKey/lastStatusTick refs from the current store snapshot on mount so the first store.subscribe fire doesn't spuriously trigger a save when the hook is re-mounted after Plan 01 already loaded a schema."

patterns-established:
  - "Warning 8 snapshot capture: flushNow() records dataKey/statusTick at save-issue time and writes them on success — a mutation that lands mid-save correctly stays dirty."
  - "DevHarness panel sibling contract: drop a *Panel.tsx in src/renderer/components/_dev/ and DevHarness auto-discovers it via import.meta.glob — zero registry edits."

requirements-completed: [EDIT-13, EDIT-15]

duration: ~20min
completed: 2026-04-21
---

# Phase 3 Plan 04b: Autosave + Save Indicator Summary

**Store-driven autosave with triple-timer debounce (2s structural / 1s notes / 30s periodic), 3-stage failure escalation (retrying → manual → modal), and the Warning-8 atomic lastSavedDataKey/lastSavedStatusTick snapshot pattern — every edit now persists to disk without manual intervention.**

## Performance

- **Duration:** ~20 min (automated tasks; checkpoint UAT deferred to orchestrator)
- **Started:** 2026-04-21T20:55Z (worktree rebased to d29fd41)
- **Completed:** 2026-04-21T21:04Z
- **Tasks automated:** 3 of 5 (Tasks 4 & 5 are `checkpoint:human-verify`)
- **Files created:** 7
- **Files modified:** 4

## Accomplishments

### Task 1 — Store saveState machine + Warning-8 snapshots + autosave-pause plumbing
Added `SaveState` union type (`saved | saving | error-retrying | error-manual | error-modal`), `failureCount`, `lastSaveError`, `lastSavedDataKey`, `lastSavedStatusTick`, `externalEditPending`, `autosavePaused` to the store. Exposed `setSaveState`, `setExternalEdit`, `resolveExternalEdit`, `triggerSave`. Exported pure `hasUnsavedEdits(state)` helper at module top-level — Warning 8's derived-dirty condition (`dataKey !== lastSavedDataKey || statusTick !== lastSavedStatusTick`). `loadSchema` and `reloadSchema` now reset all save-state fields and stamp `lastSavedDataKey`/`lastSavedStatusTick` to the fresh keys so a clean load starts with `hasUnsavedEdits === false`. 6 new save-state tests GREEN in `roadmapStore.mutations.test.ts`.

### Task 2 — useAutosave hook + SaveIndicator + SaveFailureModal
- **useAutosave:** 2s structural / 1s notes / 30s periodic debounce. `store.subscribe()` with two ref-tracked last-seen keys (`lastDataKey`, `lastStatusTick`) schedules the appropriate debounce bucket. `flushNow` short-circuits on `autosavePaused`, `schema === null`, `saveState === "saving"`, missing `filePath`, or missing `electroview`. Failure path escalates through `error-retrying` (5s auto-retry) → `error-manual` → `error-modal`; success resets `failureCount` to 0 and commits the captured snapshot keys.
- **SaveIndicator:** 5 states mirror the store. `saved` = green dot, `saving` = pulsing (respects `motion-safe:`), `error-retrying` = red ! static, `error-manual` = `<button>` that fires `roadraven:trigger-save`, `error-modal` = static text ("modal covers UI").
- **SaveFailureModal:** Radix Dialog with Retry Save (triggers save), Save As… (emits `roadraven:request-save-as` CustomEvent for Plan 04c; modal drops back to `error-manual`), Dismiss (same). Overlay uses `bg-black/60` matching ConfirmationDialog.
- **Wiring:** `SaveIndicator` mounted in `StatusBar` right section before node count. `<SaveFailureModal />` + `useAutosave()` added to `App.tsx`.
- **Tests:** 11 useAutosave (fake timers) + 6 SaveIndicator = 17 new tests GREEN.

### Task 3 — AutosavePanel DevHarness
Buttons: Trigger autosave now, Force failure (N counter climbs through all 3 escalation stages), Reset to "saved", Pause/Unpause autosave. Panel text displays `saveState`, `failureCount`, `dataKey` vs `lastSavedDataKey`, last error. Auto-discovered by DevHarness via `import.meta.glob`; stripped from production bundle (confirmed: `grep "AutosavePanel" dist/**/*.js` returns nothing after fresh build).

## Task Commits

1. **Task 1 — store save-state machine + Warning-8 snapshots + autosave-pause plumbing** — `894fcf8`
2. **Task 2 — useAutosave + SaveIndicator + SaveFailureModal + StatusBar/App wiring** — `515580e`
3. **Task 3 — AutosavePanel DevHarness** — `b428c1a`
4. **Fix — SaveFailureModal overlay token compliance + deferred-items.md** — `1dd34ba`

Plan metadata commit will be created alongside this SUMMARY.

## Debounce Semantics (verified by useAutosave.test.ts)

| Trigger | Debounce | Verified by test |
|---------|----------|------------------|
| Structural mutation (dataKey bump) | 2000ms | #1 (`expect saveFile 1999ms→not called, 2000ms→called`) |
| Rapid structural bumps (2 within 2s) | 2000ms after LAST | #2 (`exactly 1 call after 2000ms`) |
| In-place mutation (statusTick bump) | 1000ms | #3 |
| Periodic (no mutations) | 30_000ms | #4 |
| After save success | `saved`, lastSavedDataKey/StatusTick advanced atomically | #5 |
| 1st failure | `error-retrying`, failureCount=1, 5s auto-retry scheduled | #6 |
| 2nd failure | `error-manual`, failureCount=2, no further auto-retry | #7 |
| 3rd failure | `error-modal`, failureCount=3 | #8 |
| Success after failure | failureCount resets to 0 | #9 |
| `autosavePaused` | suppresses saveFile | #10 |
| Warning 8 derived-dirty | `hasUnsavedEdits === false` after save, `=== true` after next mutation | #11 |

## Deviations From Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] failureCount not incrementing on error-manual / error-modal transitions**
- **Found during:** Task 2 (running useAutosave.test.ts tests 7 & 8)
- **Issue:** The plan's sample `setSaveState` only bumps `failureCount` when transitioning to `"error-retrying"` — by design (rule: "only one increment point"). But `handleFailure`'s 2nd-failure branch called `state.setSaveState("error-manual", msg)` which kept `failureCount` at 1; similarly for 3rd failure.
- **Fix:** `handleFailure` now writes `saveState` + `failureCount` + `lastSaveError` explicitly via `useRoadmapStore.setState({...})` when transitioning to error-manual or error-modal, instead of routing through `setSaveState`. setSaveState's single-increment-point contract is preserved.
- **Files modified:** `packages/desktop/src/mainview/hooks/useAutosave.ts`
- **Verification:** Tests 7 & 8 flipped RED → GREEN; all 11 useAutosave tests pass.
- **Committed in:** `515580e` (fix landed as part of the Task 2 implementation commit)
- **Tracked in:** AutosavePanel's `forceFailure()` applies the same pattern.

**2. [Rule 1 — Bug] SaveFailureModal overlay used inline rgba (token-compliance regression)**
- **Found during:** Full-suite vitest run after Task 3
- **Issue:** `SaveFailureModal.tsx` used `style={{ background: "rgba(0,0,0,0.6)" }}` (plan's sample). This tripped `tests/unit/ui/components.test.tsx`'s hardcoded-color scanner, which forbids inline `rgba(`, `rgb(`, `hsl(`, or `#hex` values in `src/mainview/components/`.
- **Fix:** Swapped to `className="fixed inset-0 z-[9999] bg-black/60"` — matches ConfirmationDialog's overlay exactly and uses Tailwind's token-backed opacity utility.
- **Files modified:** `packages/desktop/src/mainview/components/SaveFailureModal.tsx`
- **Verification:** `components.test.tsx` GREEN.
- **Committed in:** `1dd34ba`

### Out-of-scope discoveries (logged in deferred-items.md)

**Pre-existing failing test: `moveNodeUp swaps target with previous sibling…`**
- Fails on base commit `d29fd41` before any Plan 03-04b changes (verified via `git stash` round-trip).
- Not caused by this plan. Logged in `.planning/phases/03-full-editor/deferred-items.md`.

## Sample Failure-Escalation Trace (verified by tests 6–8)

```
t=0ms      addChild()            → dataKey bump
t=0ms      structural timer scheduled for t=2000ms
t=2000ms   flushNow() fires      → saveState="saving", await saveFile({ok:false})
t=2000ms   handleFailure("err")  → saveState="error-retrying", failureCount=1
t=2000ms   5s retry scheduled
t=7000ms   retry fires           → saveState="saving", await saveFile({ok:false})
t=7000ms   handleFailure("err")  → saveState="error-manual", failureCount=2
           (no further auto-retry; waits for triggerSave)
user clicks SaveIndicator button
           → window.dispatchEvent('roadraven:trigger-save')
           → useAutosave's triggerHandler fires flushNow()
           → await saveFile({ok:false})
           → handleFailure("err") → saveState="error-modal", failureCount=3
           → SaveFailureModal opens
```

## Verification Gate

| Check | Result |
|-------|--------|
| `bunx vitest run` | **283/284 passed** — 1 pre-existing failure (`moveNodeUp`, documented in deferred-items.md) |
| Plan-added tests (3 files) | **23/23 GREEN** (6 store save-state + 11 useAutosave + 6 SaveIndicator) |
| `bunx vite build` | **PASS** — 766 modules transformed, 2.15s |
| Production bundle strip | **PASS** — `grep AutosavePanel packages/desktop/dist/**/*.js` returns empty |
| `bunx tsc --noEmit` | **PASS** — clean |
| `bunx @biomejs/biome lint packages/desktop/src/ shared/` | **0 errors, 6 pre-existing warnings** (index.css `!important` rules — Plan 01 pre-existing) |

## Checkpoints — Status

- **Task 4 (checkpoint:human-verify — mid-plan UAT):** NOT EXECUTED in this worktree run. This is a parallel agent; checkpoints are deferred to the orchestrator's full-phase UAT session (same pattern as Plan 04a SUMMARY).
- **Task 5 (checkpoint:human-verify — full plan UAT):** NOT EXECUTED. Covers SIGKILL mid-save survival, real filesystem failure escalation (attrib +r), derived-dirty observation through DevHarness.

**To resume checkpoints:** run `bun run dev:hmr`, switch DevHarness to the "Autosave" tab, click through Tasks 4 & 5's `how-to-verify` steps listed in `03-04b-PLAN.md`.

## Outstanding Work Deferred to Plan 04c

- **File > New:** `flushNow` already aborts when `filePath === null`. Plan 04c wires `saveFileAs` prompt so `File > New` produces a file path and triggers an initial save.
- **Before-quit flush:** Plan 04c wires Electrobun `before-quit` / SIGTERM to call `flushPending()` from Plan 04a.
- **External-edit toast:** This plan ships the `externalEditPending` / `autosavePaused` fields and `setExternalEdit` / `resolveExternalEdit` actions. Plan 04c wires the actual file-watcher → `setExternalEdit` call and the toast UI.
- **Reload-file wiring:** `resolveExternalEdit("reload")` currently dispatches `roadraven:reload-file` CustomEvent; Plan 04c subscribes to this and calls `loadFile` via RPC.
- **Save As… RPC:** `SaveFailureModal`'s Save As… button currently dispatches `roadraven:request-save-as` + drops state back to `error-manual`. Plan 04c wires `Utils.saveFileDialog` + `dialogAllowlist` priming.

## Next Plan Readiness (Plan 04c)

- Save-state fields (`externalEditPending`, `autosavePaused`) and actions (`setExternalEdit`, `resolveExternalEdit`) are already on the store — Plan 04c only wires external triggers.
- `useAutosave` subscribes to `roadraven:trigger-save` and `roadraven:reload-file` CustomEvents; no hook changes needed for Save As… or Reload.
- `hasUnsavedEdits(state)` is exported and ready for the external-edit toast to gate its visibility.
- DevHarness AutosavePanel already exposes `Pause / Unpause autosave`, exercising the external-edit path end-to-end.

## User Setup Required

None — no external service configuration.

## Self-Check: PASSED

- **Created files verified on disk:**
  - `packages/desktop/src/mainview/hooks/useAutosave.ts` — FOUND
  - `packages/desktop/src/mainview/components/SaveIndicator.tsx` — FOUND
  - `packages/desktop/src/mainview/components/SaveFailureModal.tsx` — FOUND
  - `packages/desktop/src/renderer/components/_dev/AutosavePanel.tsx` — FOUND
  - `packages/desktop/tests/unit/hooks/useAutosave.test.ts` — FOUND
  - `packages/desktop/tests/unit/ui/SaveIndicator.test.tsx` — FOUND
  - `.planning/phases/03-full-editor/deferred-items.md` — FOUND
- **Commits verified via `git log`:** 894fcf8, 515580e, b428c1a, 1dd34ba all present.
- **Full suite:** 283/284 (1 pre-existing failure documented).
- **Plan-added tests:** 23/23 GREEN.
- **Build + tsc + lint:** all pass (lint warnings pre-existing).

---

*Phase: 03-full-editor, Plan: 04b*
*Completed: 2026-04-21*
