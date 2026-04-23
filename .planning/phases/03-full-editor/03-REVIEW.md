---
phase: 03-full-editor
scope: wave-3 (plan 03-04c)
depth: standard
reviewed: 2026-04-22
diff_base: f8b36513b56d9631215cf20081273b39c05a3d5c
files_reviewed: 13
status: issues_found
findings:
  critical: 1
  warning: 5
  info: 4
  total: 10
---

# Phase 03 Code Review Report (Wave 3 — Plan 03-04c)

**Reviewed:** 2026-04-22
**Depth:** standard
**Files Reviewed:** 13
**Status:** issues_found
**Findings:** 1 Critical, 5 Warnings, 4 Info

## Summary

Wave 3 lands a coherent shell-features slice: before-quit + signal flush, newFile/saveFileAs RPCs, untitled schema state, external-edit toast, and CustomEvent bridges. The architecture is sound — single-source-of-truth via shared/types.ts, idempotent flushPending, ownership-aware writes. Code is well-commented with rationale tied to plan IDs.

The dual-path quit flush has a real **race condition** that can cause corrupt half-writes on Ctrl+C in the same shell that hosts Electrobun. The XSS surface in ExternalEditToast is clean (text node only). Path-traversal allowlist is correctly extended in saveFileAs. Listener cleanup in useFileActions is correct. One Warning around saveFileAs concurrency, one around silent error swallowing in `loadAndApply`, and a few smaller correctness/test-coverage gaps.

---

## Critical Issues

### CR-01: Race condition between before-quit and SIGINT both calling flushPending concurrently

**File:** `packages/desktop/src/bun/index.ts:98-113`
**Issue:** When the user presses Ctrl+C in the terminal that owns the Electrobun process, BOTH paths fire and BOTH call `flushPending()` without coordination:

1. `process.on("SIGINT", async () => { await flushPending(); process.exit(0); })`
2. `Electrobun.events.on("before-quit", () => { void flushPending(); })` (fired when Utils.quit runs as part of Electrobun's signal handling)

`flushPending` is described as "idempotent" in the comment, but reading `saveFile.ts:174-200` shows it is **not concurrency-safe**:

- Both invocations read the same `cachedSchema` / `cachedMainPath`.
- Both call `Promise.all([...perFile].map(([p, payload]) => atomicWrite(p, ...)))` in parallel.
- `atomicWrite` (rename-based) on the same path from two concurrent flushes can race: tempfile A is renamed to `target`, then tempfile B is renamed to `target` — last writer wins, but if the second write loses its tempfile to a partial filesystem flush, you can end up with a truncated or zero-byte file. On Windows the second `rename` may also fail with EBUSY/EACCES because the destination handle is held by the first.
- `process.exit(0)` in the SIGINT branch does **not** wait for the `void flushPending()` from the before-quit handler — it can sever an in-flight `atomicWrite` mid-rename.

The plan summary claims "flushPending is idempotent (Plan 04a) so it is safe even if both paths fire" — idempotent in the sequential sense (same inputs, same outputs) but not safe when invoked concurrently.

**Fix:** Serialize flushPending with an in-flight promise guard, and have signal handlers await any pending flush before exiting.

```typescript
// In saveFile.ts
let flushInFlight: Promise<void> | null = null;
export async function flushPending(): Promise<void> {
  if (flushInFlight) return flushInFlight;          // coalesce concurrent callers
  flushInFlight = (async () => {
    try { /* existing body */ }
    finally { flushInFlight = null; }
  })();
  return flushInFlight;
}

// In bun/index.ts — await before-quit too so SIGINT can't preempt it
Electrobun.events.on("before-quit", async () => {
  await flushPending();
});
process.on("SIGINT", async () => {
  await flushPending();   // returns the same promise the before-quit handler awaits
  process.exit(0);
});
```

---

## Warnings

### WR-01: saveFileAs on a still-pending autosave can re-enter and produce two parallel writes to the new path

**File:** `packages/desktop/src/mainview/hooks/useAutosave.ts:91-112` and `packages/desktop/src/mainview/hooks/useFileActions.ts:153-170`
**Issue:** `useAutosave.flushNow` does NOT set `saveState = "saving"` on the untitled / no-filePath branch (line 91-112) — it only sets `"saving"` on line 114 for the disk-backed path. As a result, the early-return guard `if (state.saveState === "saving") return;` (line 78) will not block a re-entrant flushNow while the native save dialog is open. If a structural mutation lands during the dialog (debounce fires after STRUCTURAL_DEBOUNCE_MS while user is still picking a filename), a second `saveFileAs` RPC is dispatched — two native dialogs stack, two atomic writes contend for the chosen path, and the resulting `setState({filePath, lastSavedDataKey: savingDataKey})` from the first-resolving call may snapshot a stale dataKey, leaving the doc spuriously marked clean.

The same hazard exists in `useFileActions.saveAsHandler` (line 153-170): no guard, no in-flight flag — a fast double-click on the SaveFailureModal "Save As…" button or a CustomEvent re-dispatch will fire two parallel `saveFileAs` RPCs.

**Fix:** Set `saveState = "saving"` (or a new `"saving-as"` substate) before the `await electroview.rpc.request.saveFileAs(...)` call on both code paths, and guard re-entry on it. Also dedupe with a module-level `inFlightSaveAs: Promise<...> | null` for the CustomEvent handler.

```typescript
// useAutosave.ts — untitled path
if (state.isUntitled || !state.filePath) {
  state.setSaveState("saving");
  try {
    const result = await electroview.rpc.request.saveFileAs({ schema: state.schema });
    // ...existing success/cancel handling
  } finally {
    if (useRoadmapStore.getState().saveState === "saving") {
      useRoadmapStore.getState().setSaveState("saved");
    }
  }
}
```

---

### WR-02: handleExternalFileChange dirty branch doesn't propagate failures from setExternalEdit / silently no-ops on missing rpc on the clean branch

**File:** `packages/desktop/src/mainview/hooks/useFileActions.ts:37-57`
**Issue:** On the clean-state branch, `if (!electroview?.rpc) return;` silently aborts the auto-reload without notifying the user that the displayed schema is now stale relative to disk. Worse, `setSchemaErrors` is not cleared, so a previous schema error remains visible while we silently failed to refresh. Also: the load call is unwrapped — any `loadFile` rejection (e.g., file unlinked between watcher fire and read) becomes an unhandled promise rejection at the RPC subscription site (rpcHandlers.ts:15). The `try/catch` exists in `loadAndApply` but NOT in `handleExternalFileChange`.

**Fix:** Wrap the rpc call in try/catch and either flag a schema error or invoke `setExternalEdit(payload.path)` to surface the conflict UI as a fallback.

```typescript
if (!electroview?.rpc) return;
try {
  const response = await electroview.rpc.request.loadFile({ path: payload.path });
  if (response?.data) {
    useRoadmapStore.getState().loadSchema(response.data, payload.path);
  }
  useRoadmapStore.getState().setSchemaErrors(response?.errors ?? []);
} catch (err) {
  useRoadmapStore.getState().setExternalEdit(payload.path);
}
```

---

### WR-03: newFile RPC handler builds ownership map with empty path string

**File:** `packages/desktop/src/bun/index.ts:361`
**Issue:** `buildOwnershipMap([], "")` is called with an empty-string root path after `clearCachedMainPath()`. If `buildOwnershipMap` later treats the path as a key in any Map/Set (e.g., for source-template lookup) it will record an entry under the empty string. A subsequent `setSourceTemplate(resolved, schema.nodes)` in `saveFileAs` (line 433) may correctly overwrite, but if anything in between (e.g., a stray RPC, the test harness) reads the map, it will see a `"" → []` ghost entry. The intent is "no $refs in a fresh tree" — better to express that as "no ownership map at all" until saveFileAs lands.

**Fix:** Either skip the call entirely until saveFileAs runs, or expose `clearOwnershipMap()` and call it instead of the `("", [])` placeholder:

```typescript
// in refMap.ts — add:
export function clearOwnershipMap(): void { ownershipMap.clear(); sourceTemplates.clear(); }

// in newFile handler:
clearCachedMainPath();
clearOwnershipMap();  // replaces buildOwnershipMap([], "")
```

---

### WR-04: External-edit toast Reload button discards unsaved edits silently — no confirm step

**File:** `packages/desktop/src/mainview/components/ExternalEditToast.tsx:59-74`
**Issue:** The Reload button (`onClick={() => resolve("reload")}`) immediately fires `roadraven:reload-file`, which calls `loadSchema(...)` — overwriting all unsaved local edits with **no confirmation dialog**. The `aria-label` even advertises this ("discarding your unsaved changes"). For accidental clicks (and the toast appears at the bottom-center where users frequently click), this is a data-loss vector. The `Keep mine` path is reversible; `Reload` is not.

This is a UX/data-integrity correctness issue, not a style preference — losing user work on a single misclick is the kind of bug PR review is meant to catch.

**Fix:** Add a one-step confirm before calling `resolve("reload")` — e.g., reuse `ConfirmationDialog`, or require a 2-second hold, or change the label to "Reload (discard local edits)" with a brief secondary confirm.

```typescript
const handleReload = () => {
  if (window.confirm("Reload from disk and discard your unsaved changes?")) {
    resolve("reload");
  }
};
```

---

### WR-05: Test suite for newUntitledSchema does not assert filePath transitions back to a path after subsequent saveFileAs / loadSchema

**File:** `packages/desktop/tests/unit/store/fileActions.test.ts`
**Issue:** Test #2 checks `isUntitled` becomes false after `loadSchema`, but does not assert `filePath` flips from null → `/tmp/loaded.json`. This is the exact field that `useAutosave` branches on (`if (state.isUntitled || !state.filePath)`) — a regression where `loadSchema` forgets to update `filePath` would silently degrade autosave back to the saveFileAs prompt path. Test #3 covers the null-after-newUntitled side but not the round-trip.

Additionally, no test exercises:
- `newUntitledSchema` clearing `pendingConfirmation`, `externalEditPending`, or `autosavePaused` (it currently delegates to `loadSchema` which does reset them — but a future refactor that breaks the delegation would not be caught).
- The `set({ isUntitled: true })` happening AFTER `loadSchema(schema, null)` — if loadSchema is changed to skip setting `isUntitled: false` in that order, the assertion order in the store would silently flip.

**Fix:** Add a 7th assertion to test #2: `expect(useRoadmapStore.getState().filePath).toBe("/tmp/loaded.json")`. Add a test that calls `newUntitledSchema()` after seeding `pendingConfirmation` / `autosavePaused` and verifies all are cleared.

---

## Info

### IN-01: Hardcoded path string `/tmp/fake-external-change.json` in dev panel will not exist on Windows

**File:** `packages/desktop/src/renderer/components/_dev/ShellPanel.tsx:35`
**Issue:** The fallback path `/tmp/fake-external-change.json` is meaningless on Windows (no `/tmp`). For a Windows-primary dev environment (this is the project's primary dev host), the displayed path in the toast will be confusing.
**Fix:** Use a platform-agnostic placeholder like `"(simulated external change)"` or detect platform.

---

### IN-02: Inline `style={{}}` blocks in ExternalEditToast duplicate identical button styles

**File:** `packages/desktop/src/mainview/components/ExternalEditToast.tsx:62-90`
**Issue:** Both buttons have identical 7-property style objects. Mild DRY violation — extract to a constant or use a Tailwind class (the rest of the codebase uses Tailwind, e.g., WelcomeScreen.tsx). Inline styles also bypass theme-token consistency checks.
**Fix:** Extract `const buttonStyle = { background: "var(--rv-bg-hover)", ... };` referenced by both, or migrate to className-based styling consistent with the rest of the codebase.

---

### IN-03: useFileActions registered twice (App.tsx + Canvas.tsx) — comment acknowledges but the cost is non-zero

**File:** `packages/desktop/src/mainview/App.tsx:34` and `packages/desktop/src/mainview/components/Canvas.tsx:220`
**Issue:** The plan-aware comment in App.tsx correctly notes this is intentional. However, both invocations register identical `roadraven:reload-file` and `roadraven:request-save-as` listeners. When the event fires once, BOTH handlers run — dispatching two `loadFile` RPCs and two `loadSchema` calls back-to-back. The second is harmless (idempotent re-load of the same data) but doubles I/O and momentarily flickers `setSchemaErrors`.
**Fix:** Either (a) only call `useFileActions()` at App scope and have Canvas read returned actions from a context, or (b) pass `{registerListeners: false}` from Canvas's call. At minimum add a dedupe inside the handler (e.g., skip if a load to the same path is already in-flight via a module-level `inFlightLoad: Set<string>`).

---

### IN-04: `crypto.randomUUID()` called in two places — Bun newFile handler and store newUntitledSchema — drifts ID generation

**File:** `packages/desktop/src/bun/index.ts:338` and `packages/desktop/src/mainview/store/roadmapStore.ts:403`
**Issue:** Both produce a fresh root with `crypto.randomUUID()`. The webview branch (when Electrobun is present and newFile RPC succeeds) uses the Bun-generated UUID via `loadSchema(result.data, null)`. The fallback branch (no electroview, or RPC fails — see useFileActions.ts:117-131) calls the store-only path which generates a SECOND UUID. Same logical operation, two ID-generation sites — risk of drift if the schema shape changes (e.g., adding new default fields to one but not the other). The existing tests only cover the store path.
**Fix:** Hoist the schema construction into a single helper (e.g., `core/src/schema.ts → makeUntitledSchema()`) and import it in both Bun and store layers. Test that helper once.

---

## Notes on items explicitly NOT flagged

- The `Utils.saveFileDialog` runtime probe with `openFileDialog` fallback in saveFileAs (intentional design for electrobun@1.16.0).
- App.tsx + Canvas.tsx duplicate `useFileActions()` registration is plan-acknowledged; flagged only at Info level for the dedupe gap, not as a bug.
- The `as unknown as { saveFileDialog?: ... }` cast at index.ts:386 is a documented runtime probe, not a stray `as any`.
- Dev-only `__ROADRAVEN_TEST__` window assignment (App.tsx:38-48) is correctly DEV-gated.
- ShellPanel and DevHarness are correctly behind `import.meta.env.DEV`.

## Files reviewed (all 13)

- `packages/desktop/src/mainview/components/ExternalEditToast.tsx`
- `packages/desktop/src/renderer/components/_dev/ShellPanel.tsx`
- `packages/desktop/tests/unit/store/fileActions.test.ts`
- `shared/types.ts`
- `packages/desktop/src/bun/index.ts`
- `packages/desktop/src/bun/saveFile.ts`
- `packages/desktop/src/mainview/store/roadmapStore.ts`
- `packages/desktop/src/mainview/hooks/useAutosave.ts`
- `packages/desktop/src/mainview/hooks/useFileActions.ts`
- `packages/desktop/src/mainview/rpcHandlers.ts`
- `packages/desktop/src/mainview/components/WelcomeScreen.tsx`
- `packages/desktop/src/mainview/components/Canvas.tsx`
- `packages/desktop/src/mainview/App.tsx`
