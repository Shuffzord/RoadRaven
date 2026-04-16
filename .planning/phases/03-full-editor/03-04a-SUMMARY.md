---
phase: 03-full-editor
plan: 04a
subsystem: persistence
tags: [atomic-write, ref-writeback, save-file, path-traversal, zod, dev-harness, electrobun, bun, node-fs]

requires:
  - phase: 02-read-only-viewer
    provides: loadFile RPC, Zod schema validation, fileWatcher
  - phase: 00-app-scaffold
    provides: Electrobun two-process model, RPC contract base
provides:
  - Atomic write-tmp-rename module with Windows 3-attempt 50ms retry (EDIT-14)
  - Ref ownership map + splitSchemaByOwnership with Warning-4 resurrection guard (EDIT-16)
  - saveFile RPC handler with session allowlist (T-03.04-01) + Zod pre-write (T-03.04-07)
  - loadFile ownership hydration (sourceTemplate + buildOwnershipMap + per-ref overrides)
  - flushPending stub (idempotent; invocation wires in Plan 04c)
  - pushOwnershipMap webview message
  - DevHarness auto-discovery scaffold + PersistencePanel
affects: [03-01, 03-02, 03-03, 03-04b, 03-04c]

tech-stack:
  added: []
  patterns:
    - "atomicWrite (.tmp + rename + Windows retry) for all roadmap writes"
    - "OwnershipMap + sourceTemplate for $ref write-back without silent resurrection"
    - "Session-scoped dialogAllowlist for saveFile path-traversal mitigation"
    - "Zod pre-write re-validation at trust boundary (webview → Bun filesystem)"
    - "DevHarness auto-discovery via import.meta.glob — no manual registry"
    - "renameSync wrapper module to work around ESM namespace spy limitation"

key-files:
  created:
    - packages/desktop/src/bun/atomicWrite.ts
    - packages/desktop/src/bun/refMap.ts
    - packages/desktop/src/bun/renameSync.ts
    - packages/desktop/src/bun/saveFile.ts
    - packages/desktop/src/renderer/components/_dev/DevHarness.tsx
    - packages/desktop/src/renderer/components/_dev/PersistencePanel.tsx
    - packages/desktop/tests/unit/bun/atomicWrite.test.ts
    - packages/desktop/tests/unit/bun/refMap.test.ts
    - packages/desktop/tests/unit/bun/saveFile.test.ts
    - packages/desktop/tests/fixtures/roadmap-with-refs.json
    - packages/desktop/tests/fixtures/referenced-part.json
  modified:
    - packages/desktop/src/bun/index.ts
    - shared/types.ts

key-decisions:
  - "Extracted saveFile/flushPending/loadFile core logic into saveFile.ts (SRP) rather than inlining in index.ts — index.ts imports + delegates"
  - "renameSync factored into its own module so vitest can spy on the call site (node:fs ESM namespace is not configurable for mocking)"
  - "writeFileSync replaces Bun.write in atomicWrite so the module works under both Bun (production) and Node (vitest)"
  - "buildOwnershipMap is seeded at the main-path scope before recursion; resolveRefs then overlays per-ref descendants via setOwnership (avoids repeated map rebuilds during recursion)"
  - "DevHarness auto-discovers sibling *Panel.tsx via import.meta.glob — zero friction for Plans 01/02/03/04b/04c to drop their own panels"

patterns-established:
  - "Trust-boundary mitigation pattern: validate at entry (Zod) + explicit allowlist for any filesystem target"
  - "Tree-split pattern: sourceTemplate + live schema + ownership map → per-file payloads with $ref placeholders restored"
  - "Warning-4 rule: templates are NOT authoritative for presence — live schema is. Deleted-in-live drops from output."

requirements-completed: [EDIT-14, EDIT-16, EDIT-17, EDIT-18]

duration: 21min
completed: 2026-04-16
---

# Phase 3 Plan 04a: Persistence Foundation Summary

**Atomic-write + ref ownership map + saveFile RPC with path-traversal allowlist and Zod pre-write — Wave 1 persistence proven end-to-end before autosave/UI land in Wave 2.**

## Performance

- **Duration:** ~21 min (automated tasks; checkpoint UAT pending)
- **Started:** 2026-04-16T19:07Z (approx, post-worktree rebase)
- **Completed:** 2026-04-16T19:28Z
- **Tasks automated:** 3 of 5 (Tasks 4 & 5 are checkpoint:human-verify)
- **Files created:** 11
- **Files modified:** 2

## Accomplishments

- **EDIT-14 Atomic write:** `atomicWrite.ts` writes to `.<name>.<pid>.<ts>.tmp` and renames, retrying up to 3× with 50ms delay on EPERM/EBUSY/EACCES/EEXIST when `process.platform === "win32"`; on failure, best-effort `unlinkSync` the tmp. 7 unit tests GREEN.
- **EDIT-16 Ref ownership map:** `refMap.ts` ships `buildOwnershipMap`, `setSourceTemplate`, and `splitSchemaByOwnership` with the Warning-4 fix — nodes deleted from the live schema are DROPPED from output even when they remain in the source template. 6 unit tests GREEN.
- **EDIT-17 saveFile RPC (T-03.04-01 + T-03.04-07):** `saveFile.ts` enforces a session-scoped `dialogAllowlist` + cached main path (path-traversal mitigation) and runs `RoadmapSchemaSchema.safeParse` BEFORE any disk I/O (malformed schemas reject with structured `{ok:false, error}`). 7 unit tests GREEN.
- **EDIT-18 cross-boundary persistence guarantee:** the allowlist blocks writes to any path not explicitly loaded or dialog-picked this session; the store-layer move-blocker lands in Plan 01.
- **loadFile ownership hydration:** `bun/index.ts`'s loadFile handler captures the pre-resolution nodes via `setSourceTemplate`, seeds ownership via `buildOwnershipMap`, and the refactored `resolveRefs` tags every descendant via `setOwnership` while entering $ref'd subtrees. Ownership is pushed to the webview via `pushOwnershipMap`.
- **flushPending idempotent stub:** no-ops when cache empty; writes every owner via atomicWrite when primed. Invocation wiring deferred to Plan 04c (before-quit hooks).
- **DevHarness scaffold:** auto-discovers sibling `*Panel.tsx` via `import.meta.glob`; zero edits required from later plans. **PersistencePanel** exposes saveToTmp / fetchBack / $ref fixture load / cross-boundary attempt buttons for mid-plan UAT.

## Task Commits

1. **Task 1: Atomic write + refMap + saveFile test scaffold (TDD RED)** — `de18987` (feat)
   - `atomicWrite.ts` + `refMap.ts` + `renameSync.ts` + 2 fixtures + 3 test files
   - 7 atomicWrite tests + 6 refMap tests GREEN; 7 saveFile tests RED (module not yet exported)
2. **Task 2: saveFile/loadFile ownership + flushPending (TDD GREEN)** — `345c412` (feat)
   - `saveFile.ts` created; `bun/index.ts` extended with ownership wiring + saveFile RPC; `shared/types.ts` extended
   - 7 saveFile tests flip RED → GREEN; full suite 163/163; tsc clean
3. **Task 3: DevHarness + PersistencePanel** — `22f3b25` (feat)
   - Dev-only panels under `src/renderer/components/_dev/`; vite build verifies production strip

**Plan metadata commit:** will be created with SUMMARY.md.

## Files Created/Modified

### Created

- `packages/desktop/src/bun/atomicWrite.ts` — atomic write module (writeFileSync → renameWithRetry → unlinkSync on failure)
- `packages/desktop/src/bun/refMap.ts` — ownership map + splitSchemaByOwnership (Warning-4 fix inline)
- `packages/desktop/src/bun/renameSync.ts` — thin renameSync wrapper module (enables vitest spy)
- `packages/desktop/src/bun/saveFile.ts` — saveFileHandler + flushPending + loadFileHandler (test hooks included)
- `packages/desktop/src/renderer/components/_dev/DevHarness.tsx` — auto-discovering panel host
- `packages/desktop/src/renderer/components/_dev/PersistencePanel.tsx` — mid-plan UAT buttons
- `packages/desktop/tests/unit/bun/atomicWrite.test.ts` — 7 tests (tmp lifecycle, Windows retry, EEXIST)
- `packages/desktop/tests/unit/bun/refMap.test.ts` — 6 tests (ownership + Warning-4)
- `packages/desktop/tests/unit/bun/saveFile.test.ts` — 7 tests (allowlist, Zod, flushPending, loadFile hydration)
- `packages/desktop/tests/fixtures/roadmap-with-refs.json`
- `packages/desktop/tests/fixtures/referenced-part.json`

### Modified

- `packages/desktop/src/bun/index.ts` — loadFile RPC now populates ownership; saveFile RPC handler added; atomicWrite + splitSchemaByOwnership re-exported for later plans
- `shared/types.ts` — saveFile response widened to `{ok:true} | {ok:false; error}`; `pushOwnershipMap` added to webview.messages

## Decisions Made

- **saveFile module extraction (deviation — ergonomics):** the plan's sample action inlines saveFile/flushPending in `bun/index.ts`. The actual implementation factors core logic into `packages/desktop/src/bun/saveFile.ts` because (a) unit tests need handlers usable without booting Electrobun, (b) SRP/testability — index.ts stays focused on RPC wiring. Public `setCachedMainPath` / `setCachedSchema` / `pushDialogAllowlistPath` exports exist for the RPC layer; underscore-prefixed `__resetSaveFileModuleForTests` / `__setCachedMainPathForTests` / `__pushDialogAllowlistPathForTests` exist for tests.
- **renameSync wrapper (Rule 3 — blocking):** `vi.spyOn(nodeFs, "renameSync")` fails under ESM because node namespace exports are not configurable. Created `packages/desktop/src/bun/renameSync.ts` exporting `renameWithRetry(from, to)` as a thin wrapper so tests can spy via `vi.spyOn(renameModule, "renameWithRetry")`. Zero runtime cost; clear test hook.
- **writeFileSync replaces Bun.write in atomicWrite (Rule 3 — blocking):** vitest runs under Node, where `Bun` is undefined. `writeFileSync("utf-8")` is functionally equivalent and cross-compatible (Bun implements node:fs; Node does not implement Bun).
- **buildOwnershipMap seeded once at main scope (Rule 1 — bug):** the plan sketch called buildOwnershipMap inside the recursive resolveRefs. Each recursion replaces the map, wiping prior tags. Fix: seed once at main scope; recursion only overlays via setOwnership.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] ESM namespace spy limitation**
- **Found during:** Task 1 (running atomicWrite.test.ts for the first time)
- **Issue:** `vi.spyOn(nodeFs, "renameSync")` throws `Cannot redefine property: renameSync` because node built-in module namespaces are not configurable in ESM.
- **Fix:** Extracted a thin wrapper into `packages/desktop/src/bun/renameSync.ts` (`renameWithRetry(from, to)`) that atomicWrite imports via `import * as renameModule`. Tests spy on the wrapper.
- **Files modified:** `packages/desktop/src/bun/renameSync.ts` (new), `packages/desktop/src/bun/atomicWrite.ts` (swap call site)
- **Verification:** `bunx vitest run tests/unit/bun/atomicWrite.test.ts` — 7/7 GREEN.
- **Committed in:** `de18987`

**2. [Rule 3 — Blocking] `Bun.write` undefined under vitest (Node runtime)**
- **Found during:** Task 1 (Windows retry test)
- **Issue:** atomicWrite originally called `Bun.write(tmpPath, content)` per research Pattern 7; Node has no `Bun` global.
- **Fix:** Swapped to `node:fs writeFileSync(tmpPath, content, "utf-8")`. Functionally equivalent; Bun implements node:fs.
- **Files modified:** `packages/desktop/src/bun/atomicWrite.ts`
- **Verification:** 7/7 atomicWrite tests GREEN; production still works because Bun implements node:fs.
- **Committed in:** `de18987`

**3. [Rule 1 — Bug] buildOwnershipMap wiping tags on recursion**
- **Found during:** Task 2 (saveFile.test.ts test #7 loadFile hydration)
- **Issue:** The initial resolveRefsWithOwnership called `buildOwnershipMap(nodes.filter(!$ref), mainPath)` inside every recursion step when `currentOwner === mainPath`. Each call replaced `activeOwnership` with a fresh map, wiping parent nodes tagged in the outer scope.
- **Fix:** Call `buildOwnershipMap` once at the top-level in the loadFile handler BEFORE recursion. `resolveRefsWithOwnership` now only overlays per-node via `setOwnership`.
- **Files modified:** `packages/desktop/src/bun/saveFile.ts`
- **Verification:** saveFile test #7 passes; ownership map contains entries for every descendant (main + ref).
- **Committed in:** `345c412`

**4. [Rule 2 — Missing Critical] Null-safe electroview in PersistencePanel**
- **Found during:** Task 3 (tsc run)
- **Issue:** The plan's sample accesses `electroview.rpc.request.saveFile(...)` without null-checks; `electroview` is `null` in the HMR browser fallback path (rpc.ts catches the constructor throw). tsc flagged 4 `possibly 'undefined'` errors.
- **Fix:** Guard every handler with `if (!electroview?.rpc) { setLastOutput("not available"); return; }`.
- **Files modified:** `packages/desktop/src/renderer/components/_dev/PersistencePanel.tsx`
- **Verification:** `bunx tsc --noEmit` exits clean.
- **Committed in:** `22f3b25`

**5. [Rule 2 — Missing Critical] saveFile module extraction for testability**
- **Found during:** Task 2 (saveFile.test.ts imports `src/bun/saveFile`)
- **Issue:** The test imports saveFileHandler/flushPending/loadFileHandler + test hooks from `src/bun/saveFile`, which the plan didn't explicitly scaffold. Inlining in index.ts would prevent unit testing without booting Electrobun.
- **Fix:** Extracted pure logic into `packages/desktop/src/bun/saveFile.ts`. `bun/index.ts` imports and wires it into the RPC layer.
- **Files modified:** `packages/desktop/src/bun/saveFile.ts` (new), `packages/desktop/src/bun/index.ts` (delegates)
- **Verification:** 7 saveFile tests GREEN; full suite 163/163; tsc clean.
- **Committed in:** `345c412`

---

**Total deviations:** 5 auto-fixed (2 blocking, 2 missing-critical, 1 bug)
**Impact on plan:** All deviations preserved the plan's intent and acceptance criteria. No scope drift; the refactors make the module more testable without changing external behavior.

## Sample Call + Response Log (verified via saveFile.test.ts)

```
// Path-traversal attempt (test #1)
saveFileHandler({ schema: validSchema, filePath: "/tmp/../etc/passwd" })
→ { ok: false, error: "saveFile: filePath not in session allowlist (path-traversal mitigation)" }

// Happy path with cached main (test #2)
setCachedMainPath("/tmp/xxx/main.roadmap.json")
saveFileHandler({ schema: validSchema })
→ { ok: true }  // atomicWrite called once

// Zod pre-write rejection (test #4)
saveFileHandler({ schema: { title: "no-version", nodes: [] } /* invalid */ })
→ { ok: false, error: "saveFile: schema validation failed: version: Required" }
// atomicWrite NOT called
```

## Windows Retry Observed During Testing

- Tests simulated EPERM and EEXIST via `vi.spyOn(renameModule, "renameWithRetry")`. With `process.platform` overridden to `"win32"`:
  - Single EPERM → 1 retry, succeeds on attempt #2 (total mock invocations: 2)
  - Persistent EPERM → 3 attempts, throws EPERM, tmp unlinked (0 leftover files)
  - EEXIST treated as retriable — same behavior as EPERM
- No real-world Windows filesystem retry was exercised in this plan (fast unit-tests only); full UAT will verify actual EPERM-from-Defender scenarios during Task 5.

## Production Bundle Strip Confirmation

```bash
$ bunx vite build
✓ 690 modules transformed.
✓ built in 1.85s

$ grep -r "DevHarness" packages/desktop/dist/
# (no matches — DevHarness tree-shaken because nothing imports it yet)
```

Plan 01 Task 3 will add the conditional `import.meta.env.DEV` mount in App.tsx. Even after that, the production build should continue to strip the `_dev/` directory because the mount is gated on the DEV flag.

## Test Counts

| File | Tests | Status |
|------|-------|--------|
| atomicWrite.test.ts | 7 | GREEN |
| refMap.test.ts | 6 | GREEN |
| saveFile.test.ts | 7 | GREEN |
| **Plan total** | **20** | **GREEN** |
| Full desktop suite | 163 | GREEN |

## Issues Encountered

None beyond the auto-fixed deviations listed above. Biome lint: pre-existing warnings in unrelated files (out of scope per deviation rules); new files are clean.

## Checkpoints — Status

- **Task 4 (checkpoint:human-verify — mid-plan UAT):** NOT EXECUTED in this run. Requires a running dev server + manual button clicks in the DevHarness. Per parallel-executor conventions, checkpoints are deferred to the orchestrator's full-phase UAT session.
- **Task 5 (checkpoint:human-verify — full UAT):** NOT EXECUTED. Covers taskkill resilience on Windows, $ref write-back on disk, traversal rejection confirmation, and Zod pre-write rejection with malformed schema injection.

**To resume checkpoints:** run `bun run dev:hmr` from the desktop package, open the DevHarness panel (once Plan 01 mounts it in App.tsx), and click through the Persistence buttons per Task 4/5 steps.

## Outstanding Work Deferred

- **Plan 04b** — `useAutosave` hook + debounced save wiring to invoke `saveFile` on store mutations.
- **Plan 04c** — Electrobun `before-quit` + SIGTERM wiring that calls `flushPending()`; File > New + saveFileAs flows that populate `dialogAllowlist` via `Utils.saveFileDialog`.
- **Plan 01 Task 3** — `import.meta.env.DEV`-gated `<DevHarness />` mount in `App.tsx`.

## User Setup Required

None — no external service configuration.

## Next Plan Readiness

- `saveFile` RPC is live. Plan 04b can debounce-wrap it without further Bun changes.
- `flushPending` is a safe no-op callable anytime; Plan 04c wires it to shutdown.
- `pushOwnershipMap` reaches the webview on every loadFile; Plan 01's store can mirror it for cross-boundary move detection.
- DevHarness auto-discovery means any plan drops a `<NamePanel />.tsx` sibling and it appears in the UAT UI automatically.

## Self-Check: PASSED

- **Created files verified on disk:** 11/11 present
  - `packages/desktop/src/bun/atomicWrite.ts`
  - `packages/desktop/src/bun/refMap.ts`
  - `packages/desktop/src/bun/renameSync.ts`
  - `packages/desktop/src/bun/saveFile.ts`
  - `packages/desktop/src/renderer/components/_dev/DevHarness.tsx`
  - `packages/desktop/src/renderer/components/_dev/PersistencePanel.tsx`
  - `packages/desktop/tests/unit/bun/atomicWrite.test.ts`
  - `packages/desktop/tests/unit/bun/refMap.test.ts`
  - `packages/desktop/tests/unit/bun/saveFile.test.ts`
  - `packages/desktop/tests/fixtures/roadmap-with-refs.json`
  - `packages/desktop/tests/fixtures/referenced-part.json`
- **Commits verified via `git log`:** de18987, 345c412, 22f3b25 all present
- **Tests:** 163/163 pass (`bunx vitest run`)
- **tsc:** clean (`bunx tsc --noEmit`)
- **Production build:** succeeds; DevHarness absent from `dist/assets/*.js`

---
*Phase: 03-full-editor, Plan: 04a*
*Completed: 2026-04-16*
