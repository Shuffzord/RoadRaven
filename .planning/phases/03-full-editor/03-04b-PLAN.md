---
phase: 03-full-editor
plan: 04b
type: execute
wave: 2
depends_on: [03-01, 03-04a]
files_modified:
  - packages/desktop/src/mainview/hooks/useAutosave.ts
  - packages/desktop/src/mainview/components/SaveIndicator.tsx
  - packages/desktop/src/mainview/components/SaveFailureModal.tsx
  - packages/desktop/src/mainview/components/StatusBar.tsx
  - packages/desktop/src/mainview/store/roadmapStore.ts
  - packages/desktop/src/mainview/App.tsx
  - packages/desktop/src/renderer/components/_dev/AutosavePanel.tsx
  - packages/desktop/tests/unit/hooks/useAutosave.test.ts
  - packages/desktop/tests/unit/ui/SaveIndicator.test.tsx
  - packages/desktop/tests/unit/store/roadmapStore.mutations.test.ts
autonomous: false
requirements:
  - EDIT-13
  - EDIT-15
tags: [autosave, save-indicator, failure-escalation, save-state-machine]

must_haves:
  truths:
    - "After any structural mutation, a save is issued within 2s (debounced); after any in-place mutation (status/notes/metadata/type), a save is issued within 1s (EDIT-13)"
    - "A 30s periodic autosave fires even without mutations as long as schema is loaded"
    - "Status bar shows 'Saved', 'Saving…', 'Error saving — retrying…', or 'Error saving — click to retry' reflecting the save state machine (EDIT-15)"
    - "3 consecutive save failures open a SaveFailureModal with file path, error message, and Retry / Save As… / Dismiss buttons (D-15)"
    - "lastSavedDataKey and lastSavedStatusTick snapshots are updated atomically on every successful save (Warning 8 — replaces never-set pendingStructuralWrite/pendingNotesWrite flags)"
    - "Autosave is paused while externalEditPending is set (Plan 04c will wire the pause trigger)"
    - "An AutosavePanel exposes trigger autosave, force-failure-N-times, SaveIndicator state cycle for mid-plan UAT"
  artifacts:
    - path: "packages/desktop/src/mainview/hooks/useAutosave.ts"
      provides: "2s + 1s + 30s triple-timer debounce + saveState machine + failure escalation"
      contains: "STRUCTURAL_DEBOUNCE_MS=2000, NOTES_DEBOUNCE_MS=1000, PERIODIC_MS=30000, flushNow, handleFailure"
    - path: "packages/desktop/src/mainview/components/SaveIndicator.tsx"
      provides: "Status bar indicator with 4 visual states per D-15"
      contains: "saved/saving/error-retrying/error-manual states, retry button"
    - path: "packages/desktop/src/mainview/components/SaveFailureModal.tsx"
      provides: "Radix Dialog shown after 3 failures with Retry/Save As/Dismiss"
      contains: "Dialog.Root open={saveState === 'error-modal'}, retry/saveAs/dismiss handlers"
    - path: "packages/desktop/src/mainview/store/roadmapStore.ts"
      provides: "saveState fields + setSaveState/lastSavedDataKey/lastSavedStatusTick"
      contains: "saveState, failureCount, lastSavedDataKey, lastSavedStatusTick, externalEditPending, autosavePaused, triggerSave"
    - path: "packages/desktop/src/renderer/components/_dev/AutosavePanel.tsx"
      provides: "Autosave DevHarness panel for mid-plan UAT"
      contains: "trigger autosave, force failure N times, SaveIndicator state inspector"
  key_links:
    - from: "packages/desktop/src/mainview/hooks/useAutosave.ts"
      to: "packages/desktop/src/mainview/store/roadmapStore.ts"
      via: "store.subscribe() watches dataKey (structural) and statusTick (in-place)"
      pattern: "subscribe.*dataKey|subscribe.*statusTick"
    - from: "packages/desktop/src/mainview/hooks/useAutosave.ts"
      to: "packages/desktop/src/bun/index.ts saveFile"
      via: "electroview.rpc.request.saveFile({schema})"
      pattern: "saveFile\\("
    - from: "packages/desktop/src/mainview/components/StatusBar.tsx"
      to: "packages/desktop/src/mainview/components/SaveIndicator.tsx"
      via: "embedded SaveIndicator in the right section of status bar"
      pattern: "<SaveIndicator"
---

<objective>
Wire the webview autosave hook to Plan 04a's saveFile RPC and expose save state to the UI via SaveIndicator + SaveFailureModal. This plan runs in Wave 2 alongside Plans 02 and 03 — as UI features (context menu, side panel editor) land, they persist automatically. Human UAT can kill the process mid-save to verify the atomic guarantee from 04a.

Purpose: give the user durable writes as soon as possible after mutations land. By the end of Wave 2, every edit through any surface is saved to disk on the debounce timers, with visible save state and escalating failure handling.

Output:
- `useAutosave` hook with 2s structural / 1s notes / 30s periodic timers + failure escalation
- Store fields for save state machine (Warning 8: `lastSavedDataKey`/`lastSavedStatusTick` snapshots)
- SaveIndicator component (4 visual states)
- SaveFailureModal (3rd-failure Radix dialog)
- AutosavePanel for mid-plan UAT
</objective>

<design_note>
**Dependencies:**
- Plan 01 (`03-01`) provides `dataKey`, `statusTick`, store mutations that drive autosave
- Plan 04a (`03-04a`) provides the `saveFile` RPC + `flushPending` (used only on demand via `triggerSave` in this plan; before-quit wiring is in Plan 04c)

**Save state machine (D-15):**
```
saved → (mutation) → debounce → saving → saved
                                      ↘ failure-1 → auto-retry 5s → saving → saved | failure-2
                                                                            failure-2 → manual-retry → saving → saved | failure-3
                                                                                                              failure-3 → modal → Retry | Save As | Dismiss
```
Store field `saveState: "saved" | "saving" | "error-retrying" | "error-manual" | "error-modal"` + counters.

**Warning 8 fix (derived dirty condition):** instead of never-set `pendingStructuralWrite`/`pendingNotesWrite` flags, track `lastSavedDataKey` and `lastSavedStatusTick` that advance atomically on successful save. Unsaved edits exist iff
`state.dataKey !== state.lastSavedDataKey || state.statusTick !== state.lastSavedStatusTick`.
This is the condition Plan 04c's external-edit toast reads.

**External edit PAUSE mechanism:** this plan adds the `autosavePaused` flag and the `setExternalEdit`/`resolveExternalEdit` actions. Plan 04c wires the actual `pushFileChanged` handler that flips the flag. In this plan, tests simulate pause manually.

**File > New deferred to Plan 04c:** this plan's `useAutosave` can already handle the "no filePath set" case by aborting the flush (returns early). Plan 04c wires the `saveFileAs` prompt path.
</design_note>

<execution_context>
@C:/Work/RoadRaven/.claude/get-shit-done/workflows/execute-plan.md
@C:/Work/RoadRaven/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/phases/03-full-editor/03-CONTEXT.md
@.planning/phases/03-full-editor/03-RESEARCH.md
@.planning/phases/03-full-editor/03-UI-SPEC.md
@.planning/phases/03-full-editor/03-VALIDATION.md
@.planning/phases/03-full-editor/03-01-PLAN.md
@.planning/phases/03-full-editor/03-04a-PLAN.md

@packages/desktop/src/mainview/store/roadmapStore.ts
@packages/desktop/src/mainview/components/StatusBar.tsx
@packages/desktop/src/mainview/App.tsx
@packages/desktop/src/renderer/components/_dev/DevHarness.tsx
@shared/types.ts

<interfaces>
From Plan 01 (store mutation discipline):
- `dataKey: string` bumps on structural mutations
- `statusTick: number` bumps on in-place updates (status/notes/metadata/type)
- `schema: RoadmapSchema | null`, `filePath: string | null`

From Plan 04a (RPC):
```typescript
saveFile: {
  params: { schema: RoadmapSchema; filePath?: string };
  response: { ok: true } | { ok: false; error: string };
};
```

Store shape extensions added by THIS plan:
```typescript
saveState: "saved" | "saving" | "error-retrying" | "error-manual" | "error-modal";
lastSaveError: { message: string; attemptedAt: number } | null;
failureCount: number;
lastSavedDataKey: string;       // Warning 8 snapshot
lastSavedStatusTick: number;    // Warning 8 snapshot
externalEditPending: { path: string } | null;
autosavePaused: boolean;
setSaveState: (state, errorMsg?) => void;
setExternalEdit: (path: string | null) => void;
resolveExternalEdit: (action: "reload" | "keep") => void;
triggerSave: () => void;
```

File > New / newUntitledSchema / isUntitled are added in Plan 04c (not this plan).
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Store saveState machine + Warning-8 snapshots + autosave-pause plumbing</name>
  <files>
    packages/desktop/src/mainview/store/roadmapStore.ts,
    packages/desktop/tests/unit/store/roadmapStore.mutations.test.ts
  </files>
  <read_first>
    packages/desktop/src/mainview/store/roadmapStore.ts,
    packages/desktop/tests/unit/store/roadmapStore.mutations.test.ts,
    .planning/phases/03-full-editor/03-04a-PLAN.md
  </read_first>
  <behavior>
    Add to `roadmapStore.mutations.test.ts` — 5 new tests for the save-state fields:
    1. `setSaveState('saving')` sets saveState, does NOT clear lastSaveError (that's the responsibility of transition-to-saved)
    2. `setSaveState('error-retrying', 'msg')` sets saveState + lastSaveError + attemptedAt + increments failureCount
    3. Multiple `setSaveState('error-retrying', ...)` calls keep incrementing failureCount
    4. `setSaveState('saved')` resets failureCount to 0
    5. `resolveExternalEdit("keep")` sets autosavePaused=false and externalEditPending=null (but does NOT flip saveState)

    Also add 1 test for the derived-dirty helper:
    6. **Warning 8 derived-dirty condition:** export a helper `hasUnsavedEdits(state) === (state.dataKey !== state.lastSavedDataKey || state.statusTick !== state.lastSavedStatusTick)`; assert: fresh store after `loadSchema` has `hasUnsavedEdits=false`; after a structural mutation it becomes true; after a successful save (simulated by setting `lastSavedDataKey` to the current dataKey) it becomes false again.
  </behavior>
  <action>
    Add to INITIAL_STATE:
    ```typescript
    saveState: "saved" as "saved" | "saving" | "error-retrying" | "error-manual" | "error-modal",
    lastSaveError: null as { message: string; attemptedAt: number } | null,
    failureCount: 0,
    lastSavedDataKey: "0",
    lastSavedStatusTick: 0,
    externalEditPending: null as { path: string } | null,
    autosavePaused: false,
    ```

    Add to `RoadmapState` interface + implementations:
    ```typescript
    setSaveState: (state, errorMsg?) => set((prev) => ({
      saveState: state,
      lastSaveError: errorMsg ? { message: errorMsg, attemptedAt: Date.now() } : prev.lastSaveError,
      failureCount: state === "saved"
        ? 0
        : state === "error-retrying"
        ? prev.failureCount + 1
        : prev.failureCount,
    })),
    setExternalEdit: (path) => set({
      externalEditPending: path ? { path } : null,
      autosavePaused: path !== null,
    }),
    resolveExternalEdit: (action) => {
      const cur = get().externalEditPending;
      if (!cur) return;
      set({ externalEditPending: null, autosavePaused: false });
      // Reload wiring lives in Plan 04c (uses electroview.rpc). "keep" resumes autosave only.
      if (action === "reload") {
        // Plan 04c will replace this stub with an actual loadFile call.
        // For now, emit a CustomEvent that Plan 04c's useFileActions wiring can subscribe to.
        window.dispatchEvent(new CustomEvent("roadraven:reload-file", { detail: { path: cur.path } }));
      }
    },
    triggerSave: () => {
      // Manual retry entry — used by SaveIndicator and SaveFailureModal.
      // Emits a CustomEvent that useAutosave subscribes to (hook owns the flushNow logic).
      window.dispatchEvent(new CustomEvent("roadraven:trigger-save"));
    },
    ```

    Export a pure helper at module top-level (NOT on the store — helpers taking a state snapshot):
    ```typescript
    export function hasUnsavedEdits(state: {
      dataKey: string;
      lastSavedDataKey: string;
      statusTick: number;
      lastSavedStatusTick: number;
    }): boolean {
      return state.dataKey !== state.lastSavedDataKey
        || state.statusTick !== state.lastSavedStatusTick;
    }
    ```

    Update `loadSchema` + `reloadSchema` to reset these fields:
    ```typescript
    saveState: "saved",
    failureCount: 0,
    externalEditPending: null,
    autosavePaused: false,
    lastSavedDataKey: /* current dataKey after load */,
    lastSavedStatusTick: /* current statusTick after load */,
    ```

    Explicit regression: do NOT introduce `pendingStructuralWrite` or `pendingNotesWrite` fields (Warning 8 rejected this design).
  </action>
  <verify>
    <automated>cd packages/desktop; bunx vitest run tests/unit/store/roadmapStore.mutations.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "setSaveState:" packages/desktop/src/mainview/store/roadmapStore.ts`
    - `grep -q "setExternalEdit:" packages/desktop/src/mainview/store/roadmapStore.ts`
    - `grep -q "resolveExternalEdit:" packages/desktop/src/mainview/store/roadmapStore.ts`
    - `grep -q "triggerSave:" packages/desktop/src/mainview/store/roadmapStore.ts`
    - `grep -q "lastSavedDataKey" packages/desktop/src/mainview/store/roadmapStore.ts` (Warning 8)
    - `grep -q "lastSavedStatusTick" packages/desktop/src/mainview/store/roadmapStore.ts` (Warning 8)
    - `grep -q "export function hasUnsavedEdits" packages/desktop/src/mainview/store/roadmapStore.ts`
    - `! grep -q "pendingStructuralWrite" packages/desktop/src/mainview/store/roadmapStore.ts`
    - `! grep -q "pendingNotesWrite" packages/desktop/src/mainview/store/roadmapStore.ts`
    - `bunx vitest run tests/unit/store/roadmapStore.mutations.test.ts` exits 0 with at least 6 new save-state tests GREEN
    - `bunx tsc --noEmit` exits 0
  </acceptance_criteria>
  <done>Store extended with saveState machine + Warning-8 snapshots + autosavePaused; 6+ new tests GREEN; hasUnsavedEdits helper exported.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: useAutosave hook + SaveIndicator + SaveFailureModal</name>
  <files>
    packages/desktop/src/mainview/hooks/useAutosave.ts,
    packages/desktop/src/mainview/components/SaveIndicator.tsx,
    packages/desktop/src/mainview/components/SaveFailureModal.tsx,
    packages/desktop/src/mainview/components/StatusBar.tsx,
    packages/desktop/src/mainview/App.tsx,
    packages/desktop/tests/unit/hooks/useAutosave.test.ts,
    packages/desktop/tests/unit/ui/SaveIndicator.test.tsx
  </files>
  <read_first>
    packages/desktop/src/mainview/store/roadmapStore.ts,
    packages/desktop/src/mainview/components/StatusBar.tsx,
    packages/desktop/src/mainview/App.tsx,
    shared/types.ts,
    .planning/phases/03-full-editor/03-RESEARCH.md#Pattern 6,
    .planning/phases/03-full-editor/03-UI-SPEC.md#SaveIndicator
  </read_first>
  <behavior>
    `useAutosave.test.ts` — 11 tests with `vi.useFakeTimers()`:
    1. Mutation that bumps `dataKey` → `saveFile` is called exactly 2000ms later, not earlier
    2. Two rapid dataKey bumps within 2s → exactly ONE saveFile call at 2000ms after the LAST mutation
    3. statusTick bump → saveFile called 1000ms later (notes debounce)
    4. 30s periodic fires even without mutations; calls saveFile once every 30s
    5. When saveFile resolves `{ok:true}`, store.saveState transitions to "saved" AND lastSavedDataKey/lastSavedStatusTick are updated to the dataKey/statusTick values at the time the save was initiated
    6. When saveFile rejects OR returns `{ok:false}`, store.saveState transitions to "error-retrying" + failureCount = 1 + 5s auto-retry timer scheduled; lastSavedDataKey is NOT advanced
    7. After 2 consecutive failures, saveState = "error-manual"; no auto-retry timer
    8. After 3 consecutive failures, saveState = "error-modal"
    9. On success after a failure, failureCount resets to 0
    10. autosavePaused flag (set via setExternalEdit) suppresses saveFile calls
    11. Warning 8 derived-dirty condition: after a save success `hasUnsavedEdits(state)` is FALSE; after a subsequent mutation it becomes TRUE.

    `SaveIndicator.test.tsx` — 6 tests:
    1. "saved" state: renders green dot + "Saved" label
    2. "saving" state: renders spinner + "Saving…"
    3. "error-retrying" state: renders red ! icon + "Error saving — retrying…" (not clickable)
    4. "error-manual" state: renders red ! icon + "Error saving — click to retry" (button with cursor:pointer)
    5. Clicking "error-manual" state calls `store.triggerSave`
    6. Icons have aria-hidden; text has visible label

    SaveFailureModal does not need dedicated tests in this task — it is a thin wrapper mirroring ConfirmationDialog; its behavior is covered by the mid-plan UAT and the existing ConfirmationDialog Radix patterns from Plan 01 Task 4.
  </behavior>
  <action>
    **Step A — Create `packages/desktop/src/mainview/hooks/useAutosave.ts`:**

    ```typescript
    import { useEffect, useRef } from "react";
    import { useRoadmapStore } from "../store/roadmapStore";
    import { electroview } from "../rpc";

    const STRUCTURAL_DEBOUNCE_MS = 2000;
    const NOTES_DEBOUNCE_MS = 1000;
    const PERIODIC_MS = 30_000;
    const RETRY_DELAY_MS = 5000;

    export function useAutosave() {
      const structRef = useRef<ReturnType<typeof setTimeout> | null>(null);
      const notesRef = useRef<ReturnType<typeof setTimeout> | null>(null);
      const periodicRef = useRef<ReturnType<typeof setInterval> | null>(null);
      const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
      const lastDataKey = useRef<string>("0");
      const lastStatusTick = useRef<number>(0);

      useEffect(() => {
        // 30s periodic
        periodicRef.current = setInterval(() => { void flushNow(); }, PERIODIC_MS);

        // Manual trigger from SaveIndicator / SaveFailureModal
        const triggerHandler = () => { void flushNow(); };
        window.addEventListener("roadraven:trigger-save", triggerHandler);

        return () => {
          if (periodicRef.current) clearInterval(periodicRef.current);
          window.removeEventListener("roadraven:trigger-save", triggerHandler);
        };
      }, []);

      useEffect(() => {
        const unsub = useRoadmapStore.subscribe((state) => {
          if (state.autosavePaused) return;
          if (state.dataKey !== lastDataKey.current) {
            lastDataKey.current = state.dataKey;
            if (structRef.current) clearTimeout(structRef.current);
            structRef.current = setTimeout(() => void flushNow(), STRUCTURAL_DEBOUNCE_MS);
          } else if (state.statusTick !== lastStatusTick.current) {
            lastStatusTick.current = state.statusTick;
            if (notesRef.current) clearTimeout(notesRef.current);
            notesRef.current = setTimeout(() => void flushNow(), NOTES_DEBOUNCE_MS);
          }
        });
        return unsub;
      }, []);
    }

    async function flushNow(): Promise<void> {
      const state = useRoadmapStore.getState();
      if (state.autosavePaused) return;
      if (!state.schema) return;
      if (state.saveState === "saving") return;
      if (!state.filePath) return;  // File > New prompt path is Plan 04c

      // Warning 8: snapshot the keys we are about to save — record on success
      const savingDataKey = state.dataKey;
      const savingStatusTick = state.statusTick;

      state.setSaveState("saving");
      try {
        const result = await electroview.rpc.request.saveFile({ schema: state.schema });
        if ("ok" in result && result.ok) {
          useRoadmapStore.setState({
            saveState: "saved",
            failureCount: 0,
            lastSavedDataKey: savingDataKey,
            lastSavedStatusTick: savingStatusTick,
          });
        } else {
          const msg = "error" in result ? result.error : "Unknown save error";
          handleFailure(msg);
        }
      } catch (err) {
        handleFailure(String(err));
      }
    }

    function handleFailure(msg: string): void {
      const state = useRoadmapStore.getState();
      // failureCount will be incremented by setSaveState("error-retrying", ...)
      const nextFailures = state.failureCount + 1;
      if (nextFailures === 1) {
        state.setSaveState("error-retrying", msg);
        setTimeout(() => void flushNow(), RETRY_DELAY_MS);
      } else if (nextFailures === 2) {
        // Subsequent failure after auto-retry → manual
        state.setSaveState("error-manual", msg);
      } else {
        state.setSaveState("error-modal", msg);
      }
    }
    ```

    Wire into `App.tsx`: `useAutosave();` near other top-level hooks.

    **Step B — Create `packages/desktop/src/mainview/components/SaveIndicator.tsx`:**

    ```tsx
    import { useRoadmapStore } from "../store/roadmapStore";

    export function SaveIndicator() {
      const saveState = useRoadmapStore(s => s.saveState);
      const triggerSave = useRoadmapStore(s => s.triggerSave);

      if (saveState === "saved") {
        return (
          <div className="flex items-center gap-1.5 text-[11px] text-rv-text-tertiary">
            <span aria-hidden="true" className="w-[7px] h-[7px] rounded-full bg-rv-status-completed" />
            <span>Saved</span>
          </div>
        );
      }
      if (saveState === "saving") {
        return (
          <div className="flex items-center gap-1.5 text-[11px] text-rv-text-secondary">
            <span aria-hidden="true" className="w-[7px] h-[7px] rounded-full bg-rv-text-secondary animate-pulse" />
            <span>Saving…</span>
          </div>
        );
      }
      if (saveState === "error-retrying") {
        return (
          <div className="flex items-center gap-1.5 text-[11px] text-rv-status-blocked">
            <ErrorIcon />
            <span>Error saving — retrying…</span>
          </div>
        );
      }
      if (saveState === "error-manual") {
        return (
          <button
            type="button"
            onClick={() => triggerSave()}
            aria-label="Save failed. Click to retry saving."
            className="flex items-center gap-1.5 text-[11px] text-rv-status-blocked hover:underline cursor-pointer"
          >
            <ErrorIcon />
            <span>Error saving — click to retry</span>
          </button>
        );
      }
      // error-modal — indicator shows "Error saving" while modal covers the UI
      return (
        <div className="flex items-center gap-1.5 text-[11px] text-rv-status-blocked">
          <ErrorIcon />
          <span>Error saving</span>
        </div>
      );
    }

    function ErrorIcon() {
      return (
        <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
          <line x1="12" y1="9" x2="12" y2="13" /><circle cx="12" cy="17" r="0.5" fill="currentColor" />
        </svg>
      );
    }
    ```

    **Step C — Create `packages/desktop/src/mainview/components/SaveFailureModal.tsx`:**

    ```tsx
    import * as Dialog from "@radix-ui/react-dialog";
    import { useRoadmapStore } from "../store/roadmapStore";
    import { electroview } from "../rpc";

    export function SaveFailureModal() {
      const saveState = useRoadmapStore(s => s.saveState);
      const lastSaveError = useRoadmapStore(s => s.lastSaveError);
      const filePath = useRoadmapStore(s => s.filePath);
      const open = saveState === "error-modal";

      const retry = () => useRoadmapStore.getState().triggerSave();
      const saveAs = async () => {
        // Plan 04c wires the actual saveFileAs RPC. In this plan, just dismiss + log.
        // TODO(Plan 04c): call electroview.rpc.request.saveFileAs({ schema }) and update filePath.
        window.dispatchEvent(new CustomEvent("roadraven:request-save-as"));
      };
      const dismiss = () => useRoadmapStore.getState().setSaveState("error-manual");

      return (
        <Dialog.Root open={open} onOpenChange={(v) => { if (!v) dismiss(); }}>
          <Dialog.Portal>
            <Dialog.Overlay style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 9999 }} />
            <Dialog.Content style={{
              position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
              width: 440, maxWidth: "calc(100vw - 48px)",
              background: "var(--rv-bg-elevated)", border: "1px solid var(--rv-border)",
              borderRadius: 12, boxShadow: "var(--rv-shadow-config)", padding: 24, zIndex: 10000,
            }}>
              <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="var(--rv-status-blocked)" strokeWidth={2} aria-hidden="true">
                <circle cx={12} cy={12} r={10} /><line x1={15} y1={9} x2={9} y2={15} /><line x1={9} y1={9} x2={15} y2={15} />
              </svg>
              <Dialog.Title style={{ fontSize: 14, fontWeight: 600, color: "var(--rv-text-primary)", marginTop: 12 }}>Unable to save</Dialog.Title>
              <div style={{ fontFamily: "monospace", fontSize: 11, color: "var(--rv-text-secondary)", direction: "rtl", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginTop: 8 }}>
                {filePath ?? "(untitled)"}
              </div>
              <Dialog.Description style={{ fontSize: 13, color: "var(--rv-text-secondary)", lineHeight: 1.5, marginTop: 8 }}>
                {lastSaveError?.message ?? "RoadRaven could not write changes to disk. The file may be locked, moved, or the disk is full."}
              </Dialog.Description>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 20 }}>
                <button type="button" onClick={dismiss} style={{ background: "transparent", border: "none", padding: "8px 8px", color: "var(--rv-text-tertiary)", fontSize: 13 }}>Dismiss</button>
                <button type="button" onClick={() => void saveAs()} style={{ background: "var(--rv-bg-hover)", border: "1px solid var(--rv-border)", borderRadius: 6, padding: "8px 16px", fontSize: 13 }}>Save As…</button>
                <button type="button" onClick={retry} style={{ background: "var(--rv-accent)", border: "none", borderRadius: 6, padding: "8px 16px", fontSize: 13, fontWeight: 600, color: "var(--rv-text-on-accent,#fff)" }}>Retry Save</button>
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      );
    }
    ```

    **Step D — Wire SaveIndicator into `StatusBar.tsx`:**
    ```tsx
    import { SaveIndicator } from "./SaveIndicator";
    // ...
    <div className="flex items-center gap-2.5">
      <SaveIndicator />
      <span>{nodeCount} nodes</span>
      {/* existing logo SVG */}
    </div>
    ```

    Mount `<SaveFailureModal />` in `App.tsx` alongside ConfirmationDialog.
  </action>
  <verify>
    <automated>cd packages/desktop; bunx vitest run tests/unit/hooks/useAutosave.test.ts tests/unit/ui/SaveIndicator.test.tsx && bunx vite build</automated>
  </verify>
  <acceptance_criteria>
    - `ls packages/desktop/src/mainview/hooks/useAutosave.ts` exits 0
    - `ls packages/desktop/src/mainview/components/SaveIndicator.tsx` exits 0
    - `ls packages/desktop/src/mainview/components/SaveFailureModal.tsx` exits 0
    - `grep -q "STRUCTURAL_DEBOUNCE_MS = 2000" packages/desktop/src/mainview/hooks/useAutosave.ts`
    - `grep -q "NOTES_DEBOUNCE_MS = 1000" packages/desktop/src/mainview/hooks/useAutosave.ts`
    - `grep -q "PERIODIC_MS = 30" packages/desktop/src/mainview/hooks/useAutosave.ts`
    - `grep -q "useAutosave" packages/desktop/src/mainview/App.tsx`
    - `grep -q "SaveIndicator" packages/desktop/src/mainview/components/StatusBar.tsx`
    - `grep -q "Saved" packages/desktop/src/mainview/components/SaveIndicator.tsx`
    - `grep -q "Saving" packages/desktop/src/mainview/components/SaveIndicator.tsx`
    - `grep -q "Error saving — retrying" packages/desktop/src/mainview/components/SaveIndicator.tsx`
    - `grep -q "Error saving — click to retry" packages/desktop/src/mainview/components/SaveIndicator.tsx`
    - `grep -q "Unable to save" packages/desktop/src/mainview/components/SaveFailureModal.tsx`
    - `grep -q "SaveFailureModal" packages/desktop/src/mainview/App.tsx`
    - `bunx vitest run tests/unit/hooks/useAutosave.test.ts` exits 0 with 11 tests passing
    - `bunx vitest run tests/unit/ui/SaveIndicator.test.tsx` exits 0 with 6 tests passing
    - `bunx vite build` exits 0
  </acceptance_criteria>
  <done>useAutosave triple-timer debounce works; failure escalates through 3 states; SaveIndicator reflects state; SaveFailureModal shows after 3rd failure; 17 tests GREEN.</done>
</task>

<task type="auto" tdd="false">
  <name>Task 3: Build dev-harness demo panel for autosave</name>
  <files>
    packages/desktop/src/renderer/components/_dev/AutosavePanel.tsx
  </files>
  <read_first>
    packages/desktop/src/renderer/components/_dev/DevHarness.tsx,
    packages/desktop/src/renderer/components/_dev/PersistencePanel.tsx,
    packages/desktop/src/mainview/store/roadmapStore.ts,
    packages/desktop/src/mainview/hooks/useAutosave.ts
  </read_first>
  <action>
    Create `packages/desktop/src/renderer/components/_dev/AutosavePanel.tsx`:

    ```tsx
    import { useState } from "react";
    import { useRoadmapStore } from "../../../mainview/store/roadmapStore";

    export function AutosavePanel() {
      const saveState = useRoadmapStore(s => s.saveState);
      const failureCount = useRoadmapStore(s => s.failureCount);
      const lastSaveError = useRoadmapStore(s => s.lastSaveError);
      const lastSavedDataKey = useRoadmapStore(s => s.lastSavedDataKey);
      const dataKey = useRoadmapStore(s => s.dataKey);
      const triggerSave = useRoadmapStore(s => s.triggerSave);
      const setSaveState = useRoadmapStore(s => s.setSaveState);
      const setExternalEdit = useRoadmapStore(s => s.setExternalEdit);
      const autosavePaused = useRoadmapStore(s => s.autosavePaused);
      const [forceFailureCount, setForceFailureCount] = useState(0);

      const forceFailure = () => {
        // Simulate a save failure by directly invoking setSaveState.
        // In a real test harness, the useAutosave hook would observe this and escalate.
        const next = forceFailureCount + 1;
        setForceFailureCount(next);
        if (next === 1) setSaveState("error-retrying", "Forced failure #1 (DevHarness)");
        else if (next === 2) setSaveState("error-manual", "Forced failure #2 (DevHarness)");
        else setSaveState("error-modal", "Forced failure #3 (DevHarness)");
      };

      const resetState = () => {
        setSaveState("saved");
        setForceFailureCount(0);
      };

      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <strong>Plan 04b — Autosave</strong>
          <div style={{ fontSize: 10, opacity: 0.8 }}>
            saveState: <code>{saveState}</code>{autosavePaused ? " (paused)" : ""}<br />
            failureCount: {failureCount}<br />
            dataKey: {dataKey} / lastSaved: {lastSavedDataKey}<br />
            lastSaveError: {lastSaveError?.message ?? "(none)"}
          </div>
          <button type="button" onClick={() => triggerSave()}>Trigger autosave now</button>
          <button type="button" onClick={forceFailure}>Force failure (N={forceFailureCount + 1})</button>
          <button type="button" onClick={resetState}>Reset to "saved"</button>
          <button type="button" onClick={() => setExternalEdit(autosavePaused ? null : "/tmp/external.json")}>
            {autosavePaused ? "Unpause" : "Pause autosave"}
          </button>
        </div>
      );
    }
    ```

    No DevHarness.tsx edit required — auto-discovery via `import.meta.glob` picks up the new `AutosavePanel.tsx` sibling file automatically (contract established by Plan 04a Task 3).
  </action>
  <verify>
    <automated>cd packages/desktop; bunx vite build && bunx tsc --noEmit</automated>
  </verify>
  <acceptance_criteria>
    - `ls packages/desktop/src/renderer/components/_dev/AutosavePanel.tsx` exits 0
    - `grep -q "Force failure" packages/desktop/src/renderer/components/_dev/AutosavePanel.tsx`
    - `grep -q "Trigger autosave" packages/desktop/src/renderer/components/_dev/AutosavePanel.tsx`
    - `bunx vite build` exits 0
    - Production build strip check: `! find packages/desktop/build -name "*.js" -exec grep -l "AutosavePanel" {} \; | grep -q .`
    - `bunx tsc --noEmit` exits 0
  </acceptance_criteria>
  <done>AutosavePanel wired into DevHarness registry; exposes trigger save, force-failure escalation, pause/unpause.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 4: Mid-plan UAT — click through Plan 04b's DevHarness panel</name>
  <action>Fast-feedback manual check. 60-second scale.</action>
  <what-built>Autosave triple-timer debounce + save state machine + SaveIndicator + SaveFailureModal scaffolded with force-failure simulator.</what-built>
  <how-to-verify>
    Open the app in dev mode. Switch DevHarness to the "Autosave" tab. Then:
    - Load `tests/fixtures/basic-schema.json`. Status bar "Saved" (green dot).
    - Click "Trigger autosave now" → status bar briefly shows "Saving…" then "Saved".
    - Click "Force failure" three times (N=1,2,3):
      - After N=1: status bar shows "Error saving — retrying…" (red !).
      - After N=2: status bar shows "Error saving — click to retry" (button).
      - After N=3: SaveFailureModal opens with error message "Forced failure #3 (DevHarness)".
    - Click "Retry Save" in modal → modal closes, status bar "Saving…".
    - Click "Reset to saved" → back to green.
    - Click "Pause autosave" → indicator label shows "(paused)" in the panel; make a mutation via Plan 01 shortcuts — saveState does NOT transition.
    - Click "Unpause" → next mutation triggers save.
  </how-to-verify>
  <resume-signal>Type "continue" to proceed to the plan's full UAT checkpoint.</resume-signal>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 5: Checkpoint — verify autosave + failure escalation + SIGKILL survival</name>
  <action>Full-scope UAT for Plan 04b autosave behaviors that the unit tests + mid-plan UAT cannot cover on their own.</action>
  <what-built>Autosave (EDIT-13 — partial, no before-quit wiring yet — that's 04c), save state machine + SaveIndicator + SaveFailureModal (EDIT-15 and D-15), Warning-8 lastSavedDataKey/lastSavedStatusTick snapshots.</what-built>
  <how-to-verify>
    Run `bun run dev:hmr`. Then:

    **Debounce timing (EDIT-13):**
    1. Load `tests/fixtures/basic-schema.json`. Edit a node title (via Plan 03 panel or Plan 01 F2 rename). Watch status bar → "Saving…" appears ~2s after the edit, then "Saved".
    2. Open the JSON file in a text editor — new title is present.
    3. Edit notes (add text in CodeMirror). Wait ~1s. Status bar "Saving…" → "Saved". File contains notes.
    4. Make an edit, do NOT touch anything for 30s — periodic save fires (verify via file mtime or DevHarness output).
    5. Make 3 rapid mutations within 2s — exactly ONE save fires at 2s after the LAST mutation (check DevTools network or file mtime).

    **SIGKILL survival (EDIT-14, integration with 04a):**
    6. Make an edit. Within the 2s debounce window, `kill -9 <bun pid>`. Reopen file — either original OR the edit is intact; no corruption.

    **Save failure escalation (D-15):**
    7. On Windows: `attrib +r <schema.json>`. Make an edit. Status bar → "Error saving — retrying…" within 2s. After 5s auto-retry fires. After 2 retries, "Error saving — click to retry".
    8. After 3 failures, SaveFailureModal opens. Click "Save As…" — emits `roadraven:request-save-as` CustomEvent (Plan 04c will wire the actual Utils.saveFileDialog). For now, dismiss and `attrib -r` to unlock.

    **Derived-dirty (Warning 8):**
    9. Via DevHarness Autosave panel: observe `dataKey === lastSavedDataKey` after a fresh save. Make a mutation via Plan 01 shortcuts — values diverge. After next save, they converge again.

    Not in this plan (deferred to Plan 04c): File > New, before-quit flush, external-edit toast with actual file watcher trigger.
  </how-to-verify>
  <resume-signal>Type "approved" or describe issues.</resume-signal>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| useAutosave → Bun saveFile | Hook invokes saveFile on debounce — payload is the in-memory schema |
| Mutations → useAutosave | Arbitrary mutation sequences drive the debounce timers |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-03.04-05 | DoS | runaway autosave + failure escalation | mitigate | Failure escalation stops at count=3 (modal). No infinite retry. 5s between auto-retries prevents tight loop. 30s periodic is bounded. |
| T-03.04-06 | DoS | CodeMirror 100kB doc + 1s debounce | accept | Each updateNodeNotes call is O(doc size) for serialization. Acceptable for notes up to ~MB range. |
| T-03.04-11 | Tampering | DevHarness force-failure | accept | DevHarness is dev-only (import.meta.env.DEV gate + Vite strip). Cannot be invoked in production. |
</threat_model>

<verification>
- `bunx vitest run tests/unit/hooks/useAutosave.test.ts` — 11 tests GREEN
- `bunx vitest run tests/unit/ui/SaveIndicator.test.tsx` — 6 tests GREEN
- `bunx vitest run tests/unit/store/roadmapStore.mutations.test.ts` — new save-state tests GREEN (6 added in Task 1)
- `bunx vite build` exits 0; production strips AutosavePanel
- `bunx @biomejs/biome lint packages/desktop/src/ shared/` exits 0
- `bunx tsc --noEmit` exits 0
- Mid-plan + full UAT checkpoints pass
</verification>

<success_criteria>
- EDIT-13 (autosave debounce portion): 2s structural / 1s notes / 30s periodic timers
- EDIT-15: SaveIndicator 4 states + failure escalation through 3 stages + modal
- Warning 8: lastSavedDataKey/lastSavedStatusTick replace pendingStructuralWrite/pendingNotesWrite; hasUnsavedEdits helper exported
- autosavePaused flag + setExternalEdit/resolveExternalEdit actions available (wiring in 04c)
- 23 tests GREEN (11 useAutosave + 6 SaveIndicator + 6 store save-state)
</success_criteria>

<output>
After completion, create `.planning/phases/03-full-editor/03-04b-SUMMARY.md` with:
- Confirmed debounce semantics (fake-timer test output)
- Measured save latency after mutation in the running app (expect ~2s debounce)
- Any deviations from the save state machine diagram
- Outstanding work deferred to 04c: File > New, before-quit flush, external-edit toast, reload-file wiring
</output>
</content>
</invoke>