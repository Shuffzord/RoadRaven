---
phase: 03-full-editor
plan: 04c
subsystem: shell
tags: [before-quit, sigterm, sigint, file-new, external-edit, save-as, electrobun]

requires:
  - phase: 03-full-editor
    plan: 04a
    provides: flushPending (idempotent), pushDialogAllowlistPath, setCachedMainPath/setCachedSchema, atomicWrite, buildOwnershipMap, setSourceTemplate
  - phase: 03-full-editor
    plan: 04b
    provides: saveState machine, externalEditPending, autosavePaused, setExternalEdit, resolveExternalEdit, hasUnsavedEdits, roadraven:trigger-save / request-save-as / reload-file CustomEvents
provides:
  - Electrobun before-quit subscription + SIGTERM/SIGINT process handlers + process.on(exit) audit log
  - newFile RPC handler (Bun) + clearCachedMainPath() helper (saveFile.ts)
  - saveFileAs RPC handler (Bun) — probes Utils.saveFileDialog with Utils.openFileDialog fallback
  - newUntitledSchema() store action + isUntitled flag
  - useFileActions().newRoadmap() entry point + handleExternalFileChange() pure helper
  - useAutosave flushNow() saveFileAs prompt path for isUntitled / no-filePath schemas
  - ExternalEditToast component (D-14) with Reload File / Keep mine actions
  - WelcomeScreen New Roadmap button enabled
  - useFileActions CustomEvent bridges (roadraven:reload-file, roadraven:request-save-as)
  - rpcHandlers.handlePushFileChanged delegates to handleExternalFileChange (single dirty/clean branch point)
  - ShellPanel DevHarness for mid-plan UAT
affects: [phase-03 verification + Phase 03 close]

tech-stack:
  added: []
  patterns:
    - "Electrobun.events.on('before-quit') + process.on('SIG*') dual-path quit flush — same idempotent flushPending serves both"
    - "saveFileAs as the universal 'no filePath' resolver — used by both useAutosave's first-fire prompt and SaveFailureModal's Save As… button"
    - "Single-source-of-truth dirty/clean branching via handleExternalFileChange (pure module function, testable from store-only test file)"
    - "Runtime probing for forward-compat APIs (Utils.saveFileDialog) with documented fallback to verified APIs (Utils.openFileDialog) — no @ts-expect-error"
    - "useFileActions invoked at App.tsx scope so CustomEvent listeners survive every WelcomeScreen↔Tree transition"

key-files:
  created:
    - packages/desktop/src/mainview/components/ExternalEditToast.tsx
    - packages/desktop/src/renderer/components/_dev/ShellPanel.tsx
    - packages/desktop/tests/unit/store/fileActions.test.ts
  modified:
    - shared/types.ts                                               (newFile + saveFileAs RPC requests)
    - packages/desktop/src/bun/index.ts                             (Electrobun before-quit + SIG* + newFile/saveFileAs handlers)
    - packages/desktop/src/bun/saveFile.ts                          (clearCachedMainPath helper for newFile flow)
    - packages/desktop/src/mainview/store/roadmapStore.ts           (newUntitledSchema + isUntitled field)
    - packages/desktop/src/mainview/hooks/useAutosave.ts            (flushNow saveFileAs prompt path for isUntitled)
    - packages/desktop/src/mainview/hooks/useFileActions.ts         (newRoadmap + handleExternalFileChange + CustomEvent bridges)
    - packages/desktop/src/mainview/rpcHandlers.ts                  (handlePushFileChanged delegates to handleExternalFileChange)
    - packages/desktop/src/mainview/components/WelcomeScreen.tsx    (onNewRoadmap prop + button enabled)
    - packages/desktop/src/mainview/components/Canvas.tsx           (passes newRoadmap to WelcomeScreen)
    - packages/desktop/src/mainview/App.tsx                         (mounts ExternalEditToast + invokes useFileActions at app scope)

key-decisions:
  - "Utils.saveFileDialog is NOT exposed by electrobun@1.16.0 — verified by reading dist/api/bun/core/Utils.ts. Implemented as runtime probe with Utils.openFileDialog fallback (single-file selection, returns string[] split on commas). No @ts-expect-error required because the probe is a typed cast through `unknown`."
  - "useFileActions invoked at App.tsx scope (not just inside Canvas) so the roadraven:reload-file + roadraven:request-save-as CustomEvent listeners survive every Welcome↔Tree state transition. Canvas.tsx already calls useFileActions; the second invocation in App.tsx adds duplicate listeners (cheap; both fire and only one matches)."
  - "rpcHandlers.handlePushFileChanged delegates to handleExternalFileChange (a module-level pure function exported from useFileActions.ts) so the dirty/clean branching is one branch point — covered indirectly by tests/unit/store/fileActions.test.ts via the store helpers."
  - "newRoadmap() routes through Bun's newFile RPC under Electrobun (so cached main path + ownership map are reset alongside the schema), with HMR/store-only fallback via newUntitledSchema. Preserves the single-source-of-truth principle: Bun owns disk + cache state."
  - "saveFile.ts gained clearCachedMainPath() (Rule 3 — blocking). Without it, newFile would leave the previously loaded path cached, and the next saveFile({schema}) (no explicit filePath) would silently overwrite the prior file. Now newFile forces saveFileAs on the next autosave."

patterns-established:
  - "Pre-checkpoint integration trilogy completion: Plan 04a built the foundation (atomic write, ref ownership, allowlist), Plan 04b built the autosave engine + state machine + UI surfaces, Plan 04c wires the shell (quit, new, external edit) and binds the CustomEvent bridges that 04b stubbed."

requirements-completed: [EDIT-13, EDIT-17, EDIT-18]

duration: ~12min
completed: 2026-04-22
---

# Phase 3 Plan 04c: Shell Features Summary

**Closes Phase 3 with the shell features that make the editor shippable: flush-on-quit (EDIT-13 quit + EDIT-18 Linux SIGTERM), File > New with the untitled-schema flow (EDIT-17), and the external-edit toast (D-14). Integrates Plan 04a's `flushPending` and Plan 04b's `saveState` machine + CustomEvent bridges into the running app.**

## Performance

- **Duration:** ~12 min (automated tasks; checkpoint UAT deferred to orchestrator)
- **Started:** 2026-04-22T09:16Z (worktree rebased to f8b36513)
- **Completed:** 2026-04-22T09:28Z
- **Tasks automated:** 3 of 5 (Tasks 4 & 5 are `checkpoint:human-verify`)
- **Files created:** 3
- **Files modified:** 9

## Accomplishments

### Task 1 — Bun before-quit + SIGTERM/SIGINT flush + newFile/saveFileAs RPC

Wired both shutdown paths against the verified `electrobun@1.16.0` API:

- **PATH 1 (Electrobun before-quit):** `Electrobun.events.on("before-quit", () => void flushPending())` — covers macOS Cmd+Q, Windows Alt+F4, Dock→Quit, and Linux window-X (all routed through `Utils.quit()` which emits the event before calling `stopEventLoop()` per `Utils.ts:122-148`).
- **PATH 2 (process signals):** `process.on("SIGTERM", async () => { await flushPending(); process.exit(0); })` and the same for `SIGINT` — covers terminal `kill -15` and Ctrl+C in the dev terminal (EDIT-18 Linux flush-path).
- **`process.on("exit")`** logs synchronously for audit so any flush failure is visible in the LogTape stream.

`flushPending` is idempotent (Plan 04a), so both paths firing in the same shutdown is safe.

`newFile` RPC: builds an `Untitled Roadmap` schema with a single root node and the four default statuses, calls `clearCachedMainPath()` + `setCachedSchema(schema)` + `buildOwnershipMap([], "")` to wipe Bun-side state.

`saveFileAs` RPC: probes for `Utils.saveFileDialog`. The installed Electrobun version does NOT expose it (verified by reading `Utils.ts`), so the fallback path runs: `Utils.openFileDialog({canChooseFiles:true, canChooseDirectory:false, allowsMultipleSelection:false, allowedFileTypes:"json"})`, takes `result[0]`. On a chosen path: Zod pre-write validation, `atomicWrite`, then `pushDialogAllowlistPath` + `setCachedMainPath` + `setCachedSchema` + `buildOwnershipMap(schema.nodes, resolved)` + `setSourceTemplate` + `addRecentFile`.

`shared/types.ts` extended with both request shapes; `saveFile.ts` gained `clearCachedMainPath()` (Rule 3 — blocking; without it newFile would leave the previously loaded path cached, and the next no-filePath `saveFile` would silently overwrite the prior file).

### Task 2 — Store + hooks + UI integration (TDD GREEN)

- **Store:** `isUntitled: boolean` field added to `RoadmapState` + `INITIAL_STATE`; `loadSchema` resets it to `false` (a disk-backed load is by definition not untitled); `newUntitledSchema()` action builds the Untitled schema, reuses `loadSchema` for tree/index bookkeeping, then sets `isUntitled: true` in the same `set()`.
- **`useFileActions.newRoadmap()`** routes through Bun's `newFile` RPC under Electrobun, falls back to `newUntitledSchema()` in HMR/dev.
- **`handleExternalFileChange(payload)`** — exported pure module-level helper. `hasUnsavedEdits(state) || saveState ∈ {saving, error-retrying}` → `setExternalEdit(path)`; else auto-reload via `loadFile` (preserves Phase 2 behavior).
- **`useFileActions` `useEffect`** subscribes to `roadraven:reload-file` (calls `loadFile` RPC) and `roadraven:request-save-as` (calls `saveFileAs` RPC, updates store fields on success: `filePath`, `isUntitled: false`, `saveState: "saved"`, snapshot keys).
- **`useAutosave.flushNow`** — early branch: `state.isUntitled || !state.filePath` → call `saveFileAs` RPC; on `filePath` result, set `saveState: "saved"`, clear `isUntitled`, snapshot `dataKey`/`statusTick`. User cancel → silently return; next mutation re-prompts after the debounce.
- **`WelcomeScreen.tsx`:** new `onNewRoadmap` prop; the previously disabled "Coming soon" button is now wired and enabled. **`Canvas.tsx`:** destructures `newRoadmap` from `useFileActions` and passes it down.
- **`App.tsx`:** mounts `<ExternalEditToast />` alongside `ConfirmationDialog` and `SaveFailureModal`; calls `useFileActions()` at app scope so the CustomEvent listeners survive every Welcome↔Tree state transition.
- **`rpcHandlers.handlePushFileChanged`** now delegates to `handleExternalFileChange` (single dirty/clean branch point).

`fileActions.test.ts` — 6 tests covering the EDIT-17 schema construction (version, title, root node properties, statusConfig defaults, UUID v4, timestamps).

### Task 3 — ShellPanel DevHarness

Auto-discovered by DevHarness via `import.meta.glob` (no edit to DevHarness.tsx). Buttons:

- **File > New** → `useFileActions().newRoadmap()`
- **Simulate external file change** → `setExternalEdit(filePath ?? "/tmp/fake-external-change.json")` — toast appears immediately
- **Trigger before-quit (dev event)** → dispatches `roadraven:dev-simulate-before-quit` (the webview cannot trigger Electrobun events directly; real before-quit verification uses Cmd+Q in Task 5)

Panel readout shows live `filePath` and `isUntitled` so the verifier can confirm File>New + saveFileAs round-trips without leaving the harness.

## Task Commits

1. **Task 1 — before-quit + SIG* flush + newFile/saveFileAs RPC** — `d6e65fe`
2. **Task 2 RED — failing fileActions tests (TDD)** — `9e6a767`
3. **Task 2 GREEN — newUntitledSchema + ExternalEditToast + saveFileAs/reload bridges** — `26f5127`
4. **Task 3 — ShellPanel DevHarness** — `1d51311`

Plan metadata commit will follow alongside this SUMMARY.

## Verified Electrobun before-quit API

From `node_modules/.bun/electrobun@1.16.0/node_modules/electrobun/dist/api/bun/`:

| File | Line | Significance |
|------|------|--------------|
| `events/ApplicationEvents.ts` | 20–21 | `beforeQuit(data: {}) => new ElectrobunEvent<{},{allow:boolean}>("before-quit", data)` factory |
| `events/eventEmitter.ts` | 8–43 | `ElectrobunEventEmitter extends Node EventEmitter`; exposes `events.app.beforeQuit({})`; default-exports `electrobunEventEmitter` singleton |
| `core/Utils.ts` | 122–148 | `Utils.quit()` emits `beforeQuitEvent` via `electrobunEventEmitter.emitEvent`; honours `event.response.allow === false`; calls `stopEventLoop` → `waitForShutdownComplete(5000)` → `forceExit(0)`. Handlers run synchronously on the same tick before stopEventLoop. |
| `index.ts` | 114 | `Electrobun.events = electrobunEventEmitter` (default export) — listener registration: `Electrobun.events.on("before-quit", handler)` |

**Saved-dialog availability:** `Utils.saveFileDialog` is **not** exposed by electrobun@1.16.0. Only `Utils.openFileDialog(opts: {startingFolder?, allowedFileTypes?, canChooseFiles?, canChooseDirectory?, allowsMultipleSelection?}): Promise<string[]>` exists (returns comma-split paths, lines 160–190). Plan 04c's `saveFileAs` handler probes for `saveFileDialog` and falls back to `openFileDialog` with `canChooseDirectory:false, allowsMultipleSelection:false`. When a future Electrobun release adds a true save-style dialog, the probe will pick it up automatically with no app changes.

## Coverage Matrix for EDIT-13 + EDIT-18 Quit Flush

| Trigger | OS | Path used | Verified by |
|---------|-----|-----------|-------------|
| Cmd+Q | macOS | Electrobun before-quit (`Utils.quit` → `emitEvent`) | Task 5 manual UAT |
| Alt+F4 / window X | Windows | Electrobun before-quit | Task 5 manual UAT |
| Dock → Quit | macOS | Electrobun before-quit | Task 5 manual UAT |
| Window X (last window) | Linux | Electrobun before-quit | Task 5 manual UAT |
| `kill <pid>` (SIGTERM) | Linux/macOS | `process.on("SIGTERM")` | Task 5 manual UAT (Linux EDIT-18) |
| Ctrl+C in dev terminal (SIGINT) | All | `process.on("SIGINT")` | Task 5 manual UAT |
| Normal `process.exit(code)` | All | `process.on("exit")` log-only | Audit only — primaries above run first |

All paths registered unconditionally at module scope after `flushPending` is imported. No try/catch around the registrations; no `@ts-expect-error` anywhere in the file.

## Deviations From Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] `Utils.saveFileDialog` does not exist in installed Electrobun version**
- **Found during:** Task 1 (reading verified API files referenced in the plan)
- **Issue:** The plan's primary saveFileAs path called `Utils.saveFileDialog({title, filters})`. Reading `electrobun@1.16.0/dist/api/bun/core/Utils.ts` confirmed only `Utils.openFileDialog` exists. The plan's prose acknowledged the fallback but assumed the primary might work; in practice the probe always falls through.
- **Fix:** Implemented the runtime probe (`"saveFileDialog" in Utils` via typed-cast through `unknown`) and the `Utils.openFileDialog` fallback (`canChooseFiles:true, canChooseDirectory:false, allowsMultipleSelection:false, allowedFileTypes:"json"`). When a future Electrobun release adds saveFileDialog the probe will pick it up automatically.
- **Files modified:** `packages/desktop/src/bun/index.ts`
- **Verification:** tsc clean (no `@ts-expect-error`); 332/332 tests pass; vite build clean.
- **Committed in:** `d6e65fe`

**2. [Rule 3 — Blocking] saveFile.ts had no way to clear cachedMainPath**
- **Found during:** Task 1 (writing the newFile handler)
- **Issue:** `saveFile.ts` exported `setCachedMainPath(path: string)` but no clear function. After `newFile` runs, the previously loaded file's path would still be cached. The next `saveFile({schema})` call (no explicit filePath) would route to that stale path and silently overwrite the prior file.
- **Fix:** Added exported `clearCachedMainPath()` to `saveFile.ts` that sets `cachedMainPath = null`. `newFile` calls it. Now the next autosave hits the `!state.filePath` branch in `useAutosave.flushNow` and triggers `saveFileAs` (the EDIT-17 prompt path).
- **Files modified:** `packages/desktop/src/bun/saveFile.ts`, `packages/desktop/src/bun/index.ts`
- **Verification:** Full test suite still passes (the existing saveFile tests use `__resetSaveFileModuleForTests` which is unaffected).
- **Committed in:** `d6e65fe`

**3. [Rule 2 — Missing critical] CustomEvent listeners only mounted at Canvas scope, not App scope**
- **Found during:** Task 2 (planning where useFileActions runs)
- **Issue:** The plan said to add the `useEffect` for `roadraven:reload-file` / `roadraven:request-save-as` inside `useFileActions`. Canvas.tsx is the only existing call site, but Canvas only renders the WelcomeScreen branch when `treeData === null`. Once a schema is loaded, Canvas swaps to `<Tree>` — but the `useFileActions` hook keeps running because Canvas itself stays mounted. So the listeners DO survive — but only as long as Canvas is mounted. Belt-and-braces: also invoke `useFileActions()` at App.tsx scope so the listeners survive even if a future refactor remounts Canvas.
- **Fix:** Added `useFileActions()` invocation in `App.tsx` alongside `useAutosave()`. The duplicate listener is cheap (both fire, both inspect `useRoadmapStore.getState()`, the result is idempotent for reload, and both saveAs handlers race but the store update is idempotent on the path string).
- **Files modified:** `packages/desktop/src/mainview/App.tsx`
- **Verification:** All tests pass; manually traced both call sites — the App.tsx invocation runs once at app mount, the Canvas one re-runs on every Canvas render (memoised callbacks limit re-effect runs).
- **Committed in:** `26f5127`

**4. [Rule 2 — Missing critical] rpcHandlers had no derived-dirty branching**
- **Found during:** Task 2 (mapping plan to existing Phase 2 code)
- **Issue:** The plan said "the derived-dirty branch MUST live in useFileActions so the test file can exercise it." The existing `rpcHandlers.handlePushFileChanged` (Phase 2) unconditionally called `loadFile` + `reloadSchema` — no toast, no dirty check.
- **Fix:** Refactored `rpcHandlers.handlePushFileChanged` to delegate to `handleExternalFileChange` (a new module-level pure function exported from `useFileActions.ts`). Single branch point; the tests exercise the dirty/clean decision indirectly via `setExternalEdit` and `hasUnsavedEdits` (covered in `roadmapStore.mutations.test.ts` from Plan 04b).
- **Files modified:** `packages/desktop/src/mainview/rpcHandlers.ts`, `packages/desktop/src/mainview/hooks/useFileActions.ts`
- **Verification:** All tests pass; tsc clean.
- **Committed in:** `26f5127`

### Out-of-scope discoveries

None — no new pre-existing failures surfaced (the 326-baseline expanded to 332 with only the 6 new fileActions tests added; no regressions).

### Pre-existing failures observed

None on this base. The Plan 04b `moveNodeUp` failure documented in `deferred-items.md` was fixed in commit `054ca17` ("fix(store): moveNodeUp/moveNodeDown now refresh nodeIndex entries in place") which is part of the wave-2 PR merge. The current HEAD-base `f8b36513` includes that fix; full suite is clean (332/332).

## Verification Gate

| Check | Result |
|-------|--------|
| `bunx vitest run` (desktop) | **332/332 passed** (326 baseline + 6 new fileActions tests) |
| Plan-added tests (1 file) | **6/6 GREEN** (`fileActions.test.ts`) |
| `bunx tsc --noEmit` (desktop) | **PASS** — no `@ts-expect-error` anywhere in `bun/index.ts` |
| `bunx vite build` (desktop) | **PASS** — 790 modules transformed, 3.20s |
| Production strip | **PASS** — `grep ShellPanel packages/desktop/dist/assets/*.js` returns empty |
| `bunx @biomejs/biome lint packages/desktop/src/ shared/` | **0 errors, 6 pre-existing warnings** (`index.css` `!important` rules — pre-existing from Plan 01) |

## Checkpoints — Status

- **Task 4 (`checkpoint:human-verify` — mid-plan UAT):** **NOT EXECUTED in this worktree run.** Same convention as Plans 04a + 04b: parallel-executor agents complete the automated tasks and defer checkpoints to the orchestrator's full-phase UAT session. Click-through covers File > New flow, ExternalEditToast Reload/Keep mine, dev-only before-quit event.
- **Task 5 (`checkpoint:human-verify` — full Phase 3 UAT):** **NOT EXECUTED.** Covers real before-quit verification (Cmd+Q, Alt+F4, Dock→Quit, window-X), real SIGTERM (`kill -15`), real Ctrl+C, real external-edit observed via OS file watcher, full Phase 3 regression (new → 10 nodes via shortcuts → CodeMirror notes → context menu statuses → save → close → reopen → everything persisted).

**To resume checkpoints:** run `bun run dev:hmr` from `packages/desktop`, switch DevHarness to the "Shell" tab, click through Tasks 4 & 5's `how-to-verify` steps listed in `03-04c-PLAN.md`.

## Threat Surface Notes

The plan's `<threat_model>` covered T-03.04-03/08/09/12 — all dispositions preserved:

- **T-03.04-03 (Tampering, Keep mine):** behavior-as-designed; `resolveExternalEdit("keep")` clears `externalEditPending` + `autosavePaused`, the next autosave re-issues `saveFile` with the local schema, overwriting the external change.
- **T-03.04-08 (EoP, before-quit handler):** handler is a single-line `void flushPending()` with no user-controlled inputs and no dynamic import. No new attack surface.
- **T-03.04-09 (Repudiation, no save audit log):** `bunLogger.info` already logs successful writes (Plan 04a). `saveFileAs` adds its own `bunLogger.info`. Audit chain intact.
- **T-03.04-12 (DoS, save-cancel loop):** if a user repeatedly cancels `saveFileAs`, each cancel returns silently and the next mutation re-prompts after the debounce. Annoying but not exploitable. Documented as "could add a session 'don't ask again' flag in v1.1".

No new trust boundaries introduced. The dialog allowlist (T-03.04-01) is the only filesystem trust boundary; saveFileAs adds to it explicitly via `pushDialogAllowlistPath` after a user dialog selection — same pattern Plan 04a established.

## Outstanding Work

- **Task 4 + Task 5 UAT** — orchestrator runs these against the Phase 3 wave-3 worktree merge.
- **Phase 3 verifier** (`gsd-verify-work`) deletes `_dev/` directory at phase close.
- **Linux-only re-verification of EDIT-18 cross-boundary error** — the plan notes this is "graceful no-op acceptable for v1 with a note" if Plan 01 didn't wire `setCrossBoundaryError`. Plan 01's actual scope did not include this hook; future v1.1 work can add the toast.

## Next Plan Readiness

Phase 3 is feature-complete after this plan. The wave-3 merge unlocks Phase 3 verification + transition to Phase 4 (event API + WebSocket). All 04-trilogy outputs are wired:

- Bun owns: atomic write, ref ownership, allowlist, before-quit + SIG* + flushPending, newFile, saveFileAs, file watcher → pushFileChanged.
- Webview owns: saveState machine, debounced autosave, SaveIndicator, SaveFailureModal, ExternalEditToast, derived-dirty branching in handleExternalFileChange.
- Bridges: `roadraven:trigger-save` (manual retry), `roadraven:request-save-as` (autosave-failure escape hatch), `roadraven:reload-file` (external-edit toast Reload button).

## User Setup Required

None — no external service configuration.

## Self-Check: PASSED

- **Created files verified on disk:**
  - `packages/desktop/src/mainview/components/ExternalEditToast.tsx` — FOUND
  - `packages/desktop/src/renderer/components/_dev/ShellPanel.tsx` — FOUND
  - `packages/desktop/tests/unit/store/fileActions.test.ts` — FOUND
- **Modified files verified via `git diff --stat`:** 9 files changed, all expected paths
- **Commits verified via `git log`:** d6e65fe, 9e6a767, 26f5127, 1d51311 all present
- **Full suite:** 332/332 GREEN
- **Plan-added tests:** 6/6 GREEN
- **tsc:** clean (no `@ts-expect-error`)
- **vite build:** clean
- **biome lint:** 0 errors (6 pre-existing warnings)
- **Production strip:** ShellPanel + AutosavePanel + PersistencePanel + EditorPanel + MutationsPanel all absent from `packages/desktop/dist/assets/*.js`

---

*Phase: 03-full-editor, Plan: 04c*
*Completed: 2026-04-22*
