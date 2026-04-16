---
phase: 03-full-editor
plan: 04c
type: execute
wave: 3
depends_on: [03-04a, 03-04b]
files_modified:
  - shared/types.ts
  - packages/desktop/src/bun/index.ts
  - packages/desktop/src/mainview/hooks/useAutosave.ts
  - packages/desktop/src/mainview/hooks/useFileActions.ts
  - packages/desktop/src/mainview/components/ExternalEditToast.tsx
  - packages/desktop/src/mainview/components/WelcomeScreen.tsx
  - packages/desktop/src/mainview/components/SaveFailureModal.tsx
  - packages/desktop/src/mainview/store/roadmapStore.ts
  - packages/desktop/src/mainview/App.tsx
  - packages/desktop/src/renderer/components/_dev/ShellPanel.tsx
  - packages/desktop/tests/unit/store/fileActions.test.ts
autonomous: false
requirements:
  - EDIT-13
  - EDIT-17
  - EDIT-18
tags: [file-new, before-quit, sigterm, external-edit, shell]

must_haves:
  truths:
    - "Quitting the app flushes any pending save. macOS Cmd+Q + Dock Quit + window-X → Electrobun `Electrobun.events.on(\"before-quit\", ...)` (Path 1). Terminal SIGTERM + Ctrl+C → `process.on(\"SIGTERM\")` / `process.on(\"SIGINT\")` (Path 2). Both paths call the same `flushPending()` which is Zod-validated and idempotent."
    - "File > New creates an in-memory schema with a single root node; the first autosave fire prompts for a save location via Utils.saveFileDialog (EDIT-17)"
    - "An external file change with unsaved in-memory edits (`dataKey !== lastSavedDataKey || statusTick !== lastSavedStatusTick` OR saveState in {saving, error-retrying}) triggers a non-blocking toast: 'File changed externally. [Reload File] [Keep mine]'; autosave pauses until resolved (D-14)"
    - "When there are NO unsaved edits, pushFileChanged auto-reloads the file (Phase 2 behavior preserved)"
    - "EDIT-18 Linux flush path: SIGTERM flush is registered and tested; Radix context menu (Plan 02) already satisfies the visual portion"
    - "A ShellPanel exposes File>New, simulate-external-file-change, trigger-before-quit for mid-plan UAT"
  artifacts:
    - path: "packages/desktop/src/bun/index.ts"
      provides: "Electrobun before-quit subscription + SIGTERM/SIGINT process handlers + newFile + saveFileAs handlers"
      contains: "Electrobun.events.on(\"before-quit\"...), process.on(\"SIGTERM\"...), newFile, saveFileAs"
    - path: "packages/desktop/src/mainview/hooks/useFileActions.ts"
      provides: "newRoadmap action + pushFileChanged handler with derived-dirty branch"
      contains: "newRoadmap, pushFileChanged handler, hasUnsavedEdits(state) check"
    - path: "packages/desktop/src/mainview/components/ExternalEditToast.tsx"
      provides: "Non-blocking toast for external file changes with Reload/Keep mine actions"
      contains: "Reload File button, Keep mine button, resolveExternalEdit('reload'|'keep')"
    - path: "packages/desktop/src/mainview/components/WelcomeScreen.tsx"
      provides: "New Roadmap button wired to useFileActions().newRoadmap()"
      contains: "onClick={() => newRoadmap()}"
    - path: "shared/types.ts"
      provides: "RPC contract additions: newFile, saveFileAs"
      contains: "newFile request, saveFileAs request"
    - path: "packages/desktop/src/renderer/components/_dev/ShellPanel.tsx"
      provides: "Shell DevHarness panel for mid-plan UAT"
      contains: "File>New, simulate-external-change, trigger-before-quit buttons"
  key_links:
    - from: "packages/desktop/src/bun/index.ts Electrobun.events.on(\"before-quit\")"
      to: "packages/desktop/src/bun/index.ts flushPending (from Plan 04a)"
      via: "synchronous handler calls void flushPending()"
      pattern: "before-quit.*flushPending|flushPending.*before-quit"
    - from: "packages/desktop/src/mainview/hooks/useFileActions.ts pushFileChanged handler"
      to: "packages/desktop/src/mainview/store/roadmapStore.ts hasUnsavedEdits"
      via: "derived-dirty check: if unsaved → setExternalEdit(path), else auto-reload"
      pattern: "hasUnsavedEdits|setExternalEdit"
    - from: "packages/desktop/src/mainview/components/WelcomeScreen.tsx"
      to: "packages/desktop/src/mainview/hooks/useFileActions.ts newRoadmap"
      via: "onClick handler on New Roadmap button"
      pattern: "newRoadmap"
---

<objective>
Close Phase 3 with shell features: flush-on-quit (EDIT-13 quit portion, EDIT-18 Linux SIGTERM), File > New with untitled-schema flow (EDIT-17), and the external-edit toast (D-14). Runs last so it can integrate the autosave state from 04b and the persistence RPC from 04a.

Purpose: by the time this wave starts, autosave + persistence have been exercised through mid-phase UAT. This plan adds the polish that makes the editor shippable: quit safely, start a new roadmap, resolve external conflicts.

Output:
- Electrobun `before-quit` + process SIGTERM/SIGINT handlers in Bun
- `newFile` + `saveFileAs` RPC handlers
- `newUntitledSchema()` store action
- `WelcomeScreen` wired to File > New
- ExternalEditToast component + pushFileChanged router in useFileActions
- ShellPanel for mid-plan UAT
</objective>

<design_note>
**Shutdown-event handling (Option A — checker Blocker 3 resolution):**

Electrobun's `before-quit` API has been verified against the installed `electrobun@1.16.0` type definitions. macOS Cmd+Q + window-X + `Utils.quit()` ALL route through `before-quit`. Terminal SIGTERM/SIGINT are separate paths handled via `process.on(...)`.

**Verified Electrobun API (from `packages/desktop/node_modules/electrobun/dist/api/bun/`):**
- `electrobun/dist/api/bun/events/ApplicationEvents.ts` line 20-21: exports `beforeQuit` event factory that emits the `"before-quit"` event name (`ElectrobunEvent<{}, { allow: boolean }>`).
- `electrobun/dist/api/bun/events/eventEmitter.ts` line 43: `electrobunEventEmitter` extends Node `EventEmitter`, exposes `events.app.beforeQuit({})` factory and the inherited `on(eventName, handler)` method.
- `electrobun/dist/api/bun/core/Utils.ts` line 122-148: `Utils.quit()` emits the event via `electrobunEventEmitter.emitEvent(beforeQuitEvent)` and then calls `native.symbols.stopEventLoop()` — handlers run synchronously on the same tick.
- `electrobun/dist/api/bun/index.ts` line 114: `Electrobun.events` is the `electrobunEventEmitter` singleton. Listener registration: `Electrobun.events.on("before-quit", (event) => { ... })`.

**Coverage matrix for EDIT-13 "flush on quit":**

| Trigger | OS | Path used | Implementation |
|---------|-----|-----------|----------------|
| Cmd+Q (app quit) | macOS | Electrobun before-quit | `Electrobun.events.on("before-quit", () => void flushPending())` |
| Alt+F4 / title-bar X | Windows | Electrobun before-quit | same |
| Dock → Quit | macOS | Electrobun before-quit | same |
| Window X (last window) | Linux | Electrobun before-quit | same |
| `kill <pid>` (SIGTERM) | Linux/macOS | `process.on("SIGTERM")` | `process.on("SIGTERM", async () => { await flushPending(); process.exit(0); })` |
| Ctrl+C in terminal (SIGINT) | All | `process.on("SIGINT")` | same for SIGINT |
| Normal process exit | All | `process.on("exit")` | Synchronous-only; log-only. before-quit is the primary. |

Both paths are registered unconditionally — no try/catch, no `@ts-expect-error`, no silent fallback. `flushPending` itself is idempotent (from Plan 04a).

**File > New (EDIT-17):** `newUntitledSchema()` creates an in-memory schema with `filePath: null`, `isUntitled: true`. The autosave flushNow currently aborts when `!state.filePath` (Plan 04b). This plan extends flushNow: when isUntitled, call `saveFileAs` which pops Utils.saveFileDialog; if user picks a path, assign it as `filePath` + add to `dialogAllowlist` + continue with the save. User cancel → stay in-memory.

**External edit conflict (D-14 — Warning 7 design: "webview decides"):** Bun sends `pushFileChanged({path})` unconditionally (Phase 2 behavior preserved). The webview handler in `useFileActions` reads the store and picks:
- If `hasUnsavedEdits(state) || saveState in {saving, error-retrying}` → show the toast (call `setExternalEdit(path)`, which sets `autosavePaused: true`). User picks Reload / Keep mine.
- Else → auto-reload via `loadFile` RPC (Phase 2 behavior preserved).

No new Bun RPC, no `pushExternalConflict`, no `setPendingFlag`.

**saveAs wire (from Plan 04b's SaveFailureModal `roadraven:request-save-as` event):** useFileActions subscribes to this CustomEvent and calls `electroview.rpc.request.saveFileAs({schema})`. Result path becomes the new `filePath`; saveState resets to "saved".

**reload-file wire (from Plan 04b's resolveExternalEdit('reload') CustomEvent):** useFileActions subscribes to `roadraven:reload-file` and calls `loadFile`.
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
@.planning/phases/03-full-editor/03-04a-PLAN.md
@.planning/phases/03-full-editor/03-04b-PLAN.md

@packages/desktop/src/bun/index.ts
@packages/desktop/src/mainview/hooks/useFileActions.ts
@packages/desktop/src/mainview/components/WelcomeScreen.tsx
@shared/types.ts
@packages/core/src/schema.ts

<interfaces>
From Electrobun (verified paths — see design_note):
```typescript
import Electrobun from "electrobun/bun";
// Electrobun.events.on("before-quit", (event) => void) — singleton listener
// Utils.saveFileDialog({title, filters}) returns Promise<string|null>
// Utils.openFileDialog({...}) — fallback if saveFileDialog is unavailable
```

From node's process:
```typescript
process.on("SIGTERM", async () => { ... })
process.on("SIGINT", async () => { ... })
process.on("exit", (code) => { ... })  // sync only
```

From Plan 04a:
```typescript
export async function flushPending(): Promise<void>;  // idempotent
const dialogAllowlist: Set<string>;
let cachedMainPath: string | null;
```

From Plan 04b:
- Store fields: `saveState`, `autosavePaused`, `externalEditPending`
- Actions: `setSaveState`, `setExternalEdit`, `resolveExternalEdit`, `triggerSave`
- CustomEvents emitted: `roadraven:reload-file`, `roadraven:request-save-as`, `roadraven:trigger-save`
- Helper: `hasUnsavedEdits(state)`

Store fields this plan ADDS:
```typescript
isUntitled: boolean;
newUntitledSchema: () => void;
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Bun before-quit + SIGTERM/SIGINT flush + newFile/saveFileAs RPC handlers</name>
  <files>
    shared/types.ts,
    packages/desktop/src/bun/index.ts
  </files>
  <read_first>
    shared/types.ts,
    packages/desktop/src/bun/index.ts,
    .planning/phases/03-full-editor/03-04a-PLAN.md,
    packages/desktop/node_modules/electrobun/dist/api/bun/events/ApplicationEvents.ts,
    packages/desktop/node_modules/electrobun/dist/api/bun/events/eventEmitter.ts,
    packages/desktop/node_modules/electrobun/dist/api/bun/core/Utils.ts,
    packages/desktop/node_modules/electrobun/dist/api/bun/index.ts
  </read_first>
  <behavior>
    No new unit tests for handler registration (tested end-to-end via UAT SIGKILL). Ship with the same test suite as 04a + 04b + any tsc-level verification.
  </behavior>
  <action>
    **Step A — Extend `shared/types.ts`** with the two new RPC requests:

    ```typescript
    newFile: {
      params: Record<string, never>;
      response: { data: RoadmapSchema; filePath: null };
    };
    saveFileAs: {
      params: { schema: RoadmapSchema };
      response: { filePath: string | null };  // null if user cancelled
    };
    ```

    **Step B — Extend `packages/desktop/src/bun/index.ts`:**

    1. Import Electrobun: `import Electrobun from "electrobun/bun";`
    2. Import Utils for save dialog: `import { Utils } from "electrobun/bun";`
    3. Register the before-quit handler and signal handlers at module scope, AFTER `flushPending` is declared (Plan 04a):

       ```typescript
       // PATH 1 — Electrobun before-quit: covers macOS Cmd+Q, Windows Alt+F4, Dock→Quit,
       // Linux window-X (all routed through Utils.quit which emits before-quit).
       // Verified API: electrobun/dist/api/bun/events/ApplicationEvents.ts:20
       Electrobun.events.on("before-quit", () => {
         void flushPending();
       });

       // PATH 2 — process signals: covers terminal kill (SIGTERM), Ctrl+C in terminal (SIGINT).
       process.on("SIGTERM", async () => { await flushPending(); process.exit(0); });
       process.on("SIGINT", async () => { await flushPending(); process.exit(0); });

       // Synchronous-only hook; log for audit.
       process.on("exit", (code) => { bunLogger.info`process.exit(${code}) — flush must have run via before-quit or SIG* path`; });
       ```

    4. Implement `newFile` handler:

       ```typescript
       newFile: async () => {
         const rootId = crypto.randomUUID();
         const now = new Date().toISOString();
         const schema: RoadmapSchema = {
           version: "1.0",
           title: "Untitled Roadmap",
           statusConfig: [
             { id: "not-started", label: "Not Started" },
             { id: "in-progress", label: "In Progress" },
             { id: "completed", label: "Completed" },
             { id: "blocked", label: "Blocked" },
           ],
           nodes: [{ id: rootId, title: "Untitled", status: "not-started", createdAt: now, updatedAt: now }],
         };
         // Reset Bun-side cache — NO cachedMainPath until saveFileAs picks a path
         cachedSchema = schema;
         cachedMainPath = null;
         // Clear ownership map (fresh schema, no $refs yet)
         buildOwnershipMap([], "");
         return { data: schema, filePath: null };
       }
       ```

    5. Implement `saveFileAs` handler:

       ```typescript
       saveFileAs: async ({ schema }) => {
         // Verify Utils.saveFileDialog exists on the installed Electrobun version.
         // If it does: call it. Otherwise fallback to Utils.openFileDialog with a helpful note.
         let chosenPath: string | null = null;
         try {
           if (typeof (Utils as unknown as { saveFileDialog?: Function }).saveFileDialog === "function") {
             chosenPath = await (Utils as unknown as { saveFileDialog: (opts: unknown) => Promise<string | null> }).saveFileDialog({
               title: "Save Roadmap",
               filters: [{ name: "JSON", extensions: ["json"] }],
             });
           } else {
             // Fallback — Utils.openFileDialog was the Phase 2 pattern. Docs mention saveFileDialog,
             // but if absent on this Electrobun version we use a save-style openFileDialog invocation.
             bunLogger.warn`Utils.saveFileDialog not available on this Electrobun version; falling back to openFileDialog`;
             const result = await Utils.openFileDialog({ title: "Save Roadmap As…" });
             chosenPath = Array.isArray(result) ? (result[0] ?? null) : (result ?? null);
           }
         } catch (err) {
           bunLogger.error`saveFileAs dialog failed: ${String(err)}`;
           return { filePath: null };
         }
         if (!chosenPath) return { filePath: null };  // user cancelled

         const resolved = resolve(chosenPath);
         dialogAllowlist.add(resolved);  // session-scoped allowlist addition

         // Initial write — single file, no refs yet
         const parsed = RoadmapSchemaSchema.safeParse(schema);
         if (!parsed.success) {
           const issue = parsed.error.issues[0];
           bunLogger.warn`saveFileAs: schema validation failed: ${issue.path.join(".")}: ${issue.message}`;
           return { filePath: null };
         }
         try {
           await atomicWrite(resolved, JSON.stringify(schema, null, 2));
           cachedSchema = schema;
           cachedMainPath = resolved;
           buildOwnershipMap(schema.nodes, resolved);  // all nodes owned by the new file
           return { filePath: resolved };
         } catch (err) {
           bunLogger.error`saveFileAs write failed: ${String(err)}`;
           return { filePath: null };
         }
       }
       ```

    Explicit coverage assertion:
    - macOS Cmd+Q is served by PATH 1 (Electrobun before-quit routed through Utils.quit).
    - Terminal SIGTERM / SIGINT is served by PATH 2.
    - There is NO reliance on `BrowserWindow.on("close")` because app-level quit (not window-level) is what EDIT-13 tests.
  </action>
  <verify>
    <automated>cd packages/desktop; bunx tsc --noEmit && bunx vitest run && bunx vite build</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "newFile:" shared/types.ts`
    - `grep -q "saveFileAs:" shared/types.ts`
    - `grep -q "Electrobun.events.on(\"before-quit\"" packages/desktop/src/bun/index.ts`
    - `! grep -q "@ts-expect-error" packages/desktop/src/bun/index.ts`
    - `grep -q "process.on(\"SIGTERM\"" packages/desktop/src/bun/index.ts`
    - `grep -q "process.on(\"SIGINT\"" packages/desktop/src/bun/index.ts`
    - `grep -q "newFile:" packages/desktop/src/bun/index.ts`
    - `grep -q "saveFileAs:" packages/desktop/src/bun/index.ts`
    - `grep -q "Utils.saveFileDialog\|openFileDialog" packages/desktop/src/bun/index.ts`
    - `bunx tsc --noEmit` exits 0 (Electrobun import has no @ts-expect-error)
    - Full test suite passes (no regressions)
    - `bunx vite build` exits 0
  </acceptance_criteria>
  <done>Electrobun before-quit + SIGTERM/SIGINT registered unconditionally; newFile + saveFileAs handlers implemented; RPC contract extended; no regressions.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: newUntitledSchema store action + useFileActions.newRoadmap + WelcomeScreen wiring + external-edit handler + saveAs/reload CustomEvent bridges</name>
  <files>
    packages/desktop/src/mainview/store/roadmapStore.ts,
    packages/desktop/src/mainview/hooks/useFileActions.ts,
    packages/desktop/src/mainview/hooks/useAutosave.ts,
    packages/desktop/src/mainview/components/WelcomeScreen.tsx,
    packages/desktop/src/mainview/components/ExternalEditToast.tsx,
    packages/desktop/src/mainview/App.tsx,
    packages/desktop/tests/unit/store/fileActions.test.ts
  </files>
  <read_first>
    packages/desktop/src/mainview/store/roadmapStore.ts,
    packages/desktop/src/mainview/hooks/useAutosave.ts,
    packages/desktop/src/mainview/hooks/useFileActions.ts,
    packages/desktop/src/mainview/components/WelcomeScreen.tsx,
    .planning/phases/03-full-editor/03-UI-SPEC.md#ExternalEditToast
  </read_first>
  <behavior>
    `fileActions.test.ts` — 6 tests covering EDIT-17:
    1. `newUntitledSchema()` populates store with version 1.0, title "Untitled Roadmap", 1 root node with "not-started" status
    2. `isUntitled` is true after newUntitledSchema, false after loadSchema
    3. filePath is null after newUntitledSchema
    4. schema.statusConfig populated with 4 defaults
    5. Root node has valid UUID (matches UUID v4 regex)
    6. createdAt/updatedAt present and equal on the root

    Optional 7th test (derived-dirty handler): mock `pushFileChanged` arriving with the derived condition true → setExternalEdit called; arriving with derived condition false → loadFile called.
  </behavior>
  <action>
    **Step A — Add `newUntitledSchema` + `isUntitled` to `roadmapStore.ts`:**

    Add to INITIAL_STATE: `isUntitled: false`.

    Add to RoadmapState interface:
    ```typescript
    isUntitled: boolean;
    newUntitledSchema: () => void;
    ```

    Implementation:
    ```typescript
    newUntitledSchema: () => {
      const rootId = crypto.randomUUID();
      const now = new Date().toISOString();
      const schema: RoadmapSchema = {
        version: "1.0",
        title: "Untitled Roadmap",
        statusConfig: [
          { id: "not-started", label: "Not Started" },
          { id: "in-progress", label: "In Progress" },
          { id: "completed", label: "Completed" },
          { id: "blocked", label: "Blocked" },
        ],
        nodes: [{ id: rootId, title: "Untitled", status: "not-started", createdAt: now, updatedAt: now }],
      };
      get().loadSchema(schema, "");
      set({ isUntitled: true, filePath: null });
    },
    ```

    Update `loadSchema` to set `isUntitled: false` on normal load.

    **Step B — Extend `useFileActions.ts`:**

    Add the `newRoadmap` action:
    ```typescript
    const newRoadmap = useCallback(() => {
      useRoadmapStore.getState().newUntitledSchema();
    }, []);
    ```

    Add the external-edit handler (subscribes to existing `pushFileChanged` message — Phase 2 shipped the handler; this plan intercepts to decide):

    ```typescript
    import { hasUnsavedEdits } from "../store/roadmapStore";

    // Inside the existing onPushFileChanged subscription (or add one):
    const handlePushFileChanged = useCallback((payload: { path: string }) => {
      const state = useRoadmapStore.getState();
      const dirty = hasUnsavedEdits(state);
      const active = state.saveState === "saving" || state.saveState === "error-retrying";
      if (dirty || active) {
        state.setExternalEdit(payload.path);
      } else {
        void electroview.rpc.request.loadFile({ path: payload.path }).then((r) => {
          if (r.data) useRoadmapStore.getState().loadSchema(r.data, payload.path);
        });
      }
    }, []);
    ```

    Wire into the Phase 2 rpc subscription pattern (Phase 2 used a similar registration). If `useFileActions` doesn't currently register a pushFileChanged handler (Phase 2 did it elsewhere), add the subscription in `App.tsx` or a dedicated rpc-handlers module — wherever Phase 2 plumbing lives. Either way, the derived-dirty branch MUST live in useFileActions so the test file can exercise it.

    Also add subscriptions for the two CustomEvents that Plan 04b emits:

    ```typescript
    useEffect(() => {
      const reloadHandler = (e: Event) => {
        const detail = (e as CustomEvent<{ path: string }>).detail;
        if (detail?.path) {
          void electroview.rpc.request.loadFile({ path: detail.path }).then((r) => {
            if (r.data) useRoadmapStore.getState().loadSchema(r.data, detail.path);
          });
        }
      };
      const saveAsHandler = async () => {
        const schema = useRoadmapStore.getState().schema;
        if (!schema) return;
        const result = await electroview.rpc.request.saveFileAs({ schema });
        if (result.filePath) {
          useRoadmapStore.setState({
            filePath: result.filePath,
            isUntitled: false,
            saveState: "saved",
            failureCount: 0,
            lastSavedDataKey: useRoadmapStore.getState().dataKey,
            lastSavedStatusTick: useRoadmapStore.getState().statusTick,
          });
        }
      };
      window.addEventListener("roadraven:reload-file", reloadHandler);
      window.addEventListener("roadraven:request-save-as", saveAsHandler);
      return () => {
        window.removeEventListener("roadraven:reload-file", reloadHandler);
        window.removeEventListener("roadraven:request-save-as", saveAsHandler);
      };
    }, []);
    ```

    Export `newRoadmap` from the hook return value.

    **Step C — Extend `useAutosave.ts`** (update the flushNow helper from Plan 04b to handle `isUntitled`):

    ```typescript
    async function flushNow(): Promise<void> {
      const state = useRoadmapStore.getState();
      if (state.autosavePaused) return;
      if (!state.schema) return;
      if (state.saveState === "saving") return;

      const savingDataKey = state.dataKey;
      const savingStatusTick = state.statusTick;

      // File > New — prompt on first autosave fire
      if (state.isUntitled || !state.filePath) {
        try {
          const result = await electroview.rpc.request.saveFileAs({ schema: state.schema });
          if (result.filePath) {
            useRoadmapStore.setState({
              filePath: result.filePath,
              isUntitled: false,
              saveState: "saved",
              failureCount: 0,
              lastSavedDataKey: savingDataKey,
              lastSavedStatusTick: savingStatusTick,
            });
          }
          // User cancelled — stay "saved" in-memory; next mutation will re-prompt after debounce.
          return;
        } catch (err) {
          useRoadmapStore.getState().setSaveState("error-retrying", String(err));
          return;
        }
      }

      // (rest of flushNow unchanged from Plan 04b)
      // ...
    }
    ```

    **Step D — Update `WelcomeScreen.tsx`** — wire the "New Roadmap" button:
    ```tsx
    const { openFile, openRecent, openSample, newRoadmap } = useFileActions();
    // <button onClick={newRoadmap}>New Roadmap</button>
    ```

    **Step E — Create `packages/desktop/src/mainview/components/ExternalEditToast.tsx`:**

    ```tsx
    import { useRoadmapStore } from "../store/roadmapStore";

    export function ExternalEditToast() {
      const pending = useRoadmapStore(s => s.externalEditPending);
      const resolve = useRoadmapStore(s => s.resolveExternalEdit);
      if (!pending) return null;
      return (
        <div
          role="alert"
          aria-live="assertive"
          style={{
            position: "fixed", bottom: 48, left: "50%", transform: "translateX(-50%)",
            background: "var(--rv-bg-elevated)", border: "1px solid var(--rv-border)",
            borderRadius: 8, boxShadow: "var(--rv-shadow-config)",
            padding: "12px 16px", display: "flex", alignItems: "center", gap: 12,
            zIndex: 9000,
          }}
        >
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="var(--rv-text-secondary)" strokeWidth={2} aria-hidden="true">
            <circle cx={12} cy={12} r={10} /><line x1={12} y1={16} x2={12} y2={12} /><line x1={12} y1={8} x2={12.01} y2={8} />
          </svg>
          <span style={{ fontSize: 13, color: "var(--rv-text-primary)" }}>File changed externally.</span>
          <button
            type="button"
            onClick={() => resolve("reload")}
            aria-label="Reload file, discarding your unsaved changes"
            style={{ background: "var(--rv-bg-hover)", border: "1px solid var(--rv-border)", borderRadius: 6, padding: "4px 8px", fontSize: 11, fontWeight: 600 }}
          >Reload File</button>
          <button
            type="button"
            onClick={() => resolve("keep")}
            aria-label="Keep my changes, overwrite external edit on next save"
            style={{ background: "var(--rv-bg-hover)", border: "1px solid var(--rv-border)", borderRadius: 6, padding: "4px 8px", fontSize: 11, fontWeight: 600 }}
          >Keep mine</button>
        </div>
      );
    }
    ```

    Mount in `App.tsx`: `<ExternalEditToast />` alongside ConfirmationDialog and SaveFailureModal.
  </action>
  <verify>
    <automated>cd packages/desktop; bunx vitest run tests/unit/store/fileActions.test.ts && bunx vitest run && bunx vite build && bunx @biomejs/biome lint packages/desktop/src/ shared/</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "newUntitledSchema:" packages/desktop/src/mainview/store/roadmapStore.ts`
    - `grep -q "isUntitled:" packages/desktop/src/mainview/store/roadmapStore.ts`
    - `grep -q "newRoadmap" packages/desktop/src/mainview/hooks/useFileActions.ts`
    - `grep -q "hasUnsavedEdits" packages/desktop/src/mainview/hooks/useFileActions.ts`
    - `grep -q "setExternalEdit" packages/desktop/src/mainview/hooks/useFileActions.ts`
    - `grep -q "roadraven:reload-file" packages/desktop/src/mainview/hooks/useFileActions.ts`
    - `grep -q "roadraven:request-save-as" packages/desktop/src/mainview/hooks/useFileActions.ts`
    - `grep -q "newRoadmap" packages/desktop/src/mainview/components/WelcomeScreen.tsx`
    - `ls packages/desktop/src/mainview/components/ExternalEditToast.tsx` exits 0
    - `grep -q "File changed externally" packages/desktop/src/mainview/components/ExternalEditToast.tsx`
    - `grep -q "Reload File" packages/desktop/src/mainview/components/ExternalEditToast.tsx`
    - `grep -q "Keep mine" packages/desktop/src/mainview/components/ExternalEditToast.tsx`
    - `grep -q "ExternalEditToast" packages/desktop/src/mainview/App.tsx`
    - `grep -q "isUntitled" packages/desktop/src/mainview/hooks/useAutosave.ts`
    - `grep -q "saveFileAs" packages/desktop/src/mainview/hooks/useAutosave.ts`
    - `bunx vitest run tests/unit/store/fileActions.test.ts` exits 0 with 6 tests passing
    - Full suite passes
    - `bunx vite build` exits 0
    - `bunx @biomejs/biome lint packages/desktop/src/ shared/` exits 0
  </acceptance_criteria>
  <done>File > New wired to welcome screen; external-edit toast displays on conflict with Reload/Keep mine; saveAs + reload CustomEvent bridges live; useAutosave handles untitled-schema prompt path; 6 fileActions tests GREEN.</done>
</task>

<task type="auto" tdd="false">
  <name>Task 3: Build dev-harness demo panel for shell features</name>
  <files>
    packages/desktop/src/renderer/components/_dev/ShellPanel.tsx
  </files>
  <read_first>
    packages/desktop/src/renderer/components/_dev/DevHarness.tsx,
    packages/desktop/src/renderer/components/_dev/AutosavePanel.tsx,
    packages/desktop/src/mainview/hooks/useFileActions.ts
  </read_first>
  <action>
    Create `packages/desktop/src/renderer/components/_dev/ShellPanel.tsx`:

    ```tsx
    import { useState } from "react";
    import { useRoadmapStore } from "../../../mainview/store/roadmapStore";
    import { useFileActions } from "../../../mainview/hooks/useFileActions";

    export function ShellPanel() {
      const { newRoadmap } = useFileActions();
      const setExternalEdit = useRoadmapStore(s => s.setExternalEdit);
      const filePath = useRoadmapStore(s => s.filePath);
      const isUntitled = useRoadmapStore(s => s.isUntitled);
      const [log, setLog] = useState<string>("(no action yet)");

      const doNew = () => {
        newRoadmap();
        setLog("newUntitledSchema called; isUntitled=true now");
      };

      const simulateExternalChange = () => {
        // Fire the same code path as pushFileChanged arriving from Bun with dirty state
        setExternalEdit(filePath ?? "/tmp/fake-external-change.json");
        setLog("setExternalEdit dispatched; toast should appear");
      };

      const triggerBeforeQuit = () => {
        // We can't trigger Electrobun.events directly from the webview, but we CAN
        // trigger the CustomEvent that mirrors the intent, for dev diagnostics.
        // Real before-quit verification happens in the full UAT (Task 5) via Cmd+Q.
        window.dispatchEvent(new CustomEvent("roadraven:dev-simulate-before-quit"));
        setLog("Dispatched roadraven:dev-simulate-before-quit (dev-only; real UAT uses Cmd+Q)");
      };

      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <strong>Plan 04c — Shell</strong>
          <div style={{ fontSize: 10, opacity: 0.8 }}>
            filePath: {filePath ?? "(null)"}<br />
            isUntitled: {String(isUntitled)}
          </div>
          <button type="button" onClick={doNew}>File &gt; New</button>
          <button type="button" onClick={simulateExternalChange}>Simulate external file change</button>
          <button type="button" onClick={triggerBeforeQuit}>Trigger before-quit (dev event)</button>
          <pre style={{ background: "rgba(0,0,0,0.3)", padding: 6, borderRadius: 4, fontSize: 10, whiteSpace: "pre-wrap" }}>{log}</pre>
        </div>
      );
    }
    ```

    No DevHarness.tsx edit required — auto-discovery via `import.meta.glob` picks up the new `ShellPanel.tsx` sibling file automatically (contract established by Plan 04a Task 3).

    Final panel list after all plans land: PersistencePanel, AutosavePanel, MutationsPanel, MenuPanel, EditorPanel, ShellPanel. Display order is determined by `import.meta.glob`'s alphabetical sort unless DevHarness.tsx provides a custom ordering fn.
  </action>
  <verify>
    <automated>cd packages/desktop; bunx vite build && bunx tsc --noEmit</automated>
  </verify>
  <acceptance_criteria>
    - `ls packages/desktop/src/renderer/components/_dev/ShellPanel.tsx` exits 0
    - `grep -q "newRoadmap" packages/desktop/src/renderer/components/_dev/ShellPanel.tsx`
    - `grep -q "setExternalEdit" packages/desktop/src/renderer/components/_dev/ShellPanel.tsx`
    - `bunx vite build` exits 0
    - Production build strip: `! find packages/desktop/build -name "*.js" -exec grep -l "ShellPanel" {} \; | grep -q .`
    - `bunx tsc --noEmit` exits 0
  </acceptance_criteria>
  <done>ShellPanel wired into DevHarness; exposes File>New, simulate-external-change, dev-event before-quit for mid-plan UAT.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 4: Mid-plan UAT — click through Plan 04c's DevHarness panel</name>
  <action>Fast-feedback manual check before the full UAT.</action>
  <what-built>File > New, external-edit toast trigger, simulated before-quit event.</what-built>
  <how-to-verify>
    Open the app in dev mode. Switch DevHarness to the "Shell" tab. Then:
    - Click "File > New" → Welcome screen disappears; a single "Untitled" root node appears on canvas. Panel state shows `filePath: (null), isUntitled: true`.
    - Edit the title via Plan 03 panel. Wait 2s. Utils.saveFileDialog opens asking for a location (real OS dialog). Pick a path. Status bar "Saved". Panel state shows `filePath` now set, `isUntitled: false`.
    - Click "Simulate external file change" → ExternalEditToast appears at the bottom with "File changed externally. [Reload File] [Keep mine]". Status bar pause indicator (from Plan 04b, autosave panel would show paused=true).
    - Click "Keep mine" → toast dismisses, autosave resumes.
    - Click "Simulate external file change" again → toast appears. Click "Reload File" → file re-loads from disk (use a known-good file at the current path).
    - Click "Trigger before-quit (dev event)" → log shows the CustomEvent fired. (Real before-quit UAT happens in Task 5 via Cmd+Q.)
  </how-to-verify>
  <resume-signal>Type "continue" to proceed to the plan's full UAT checkpoint.</resume-signal>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 5: Checkpoint — full Phase 3 UAT (autosave + atomic + ref + File>New + flush-on-quit + external-edit + Linux)</name>
  <action>End-of-phase UAT for Plan 04c + full Phase 3 integration. Verifies behaviors needing real OS-level interaction.</action>
  <what-built>Flush on quit (EDIT-13 quit + EDIT-18 Linux SIGTERM), File > New (EDIT-17), external-edit toast (D-14) — completing the Plan 04 persistence trilogy.</what-built>
  <how-to-verify>
    Run `bun run dev:hmr`. Then:

    **File > New (EDIT-17):**
    1. Click "New Roadmap" from the Welcome screen. Untitled tree appears with one root node.
    2. Edit the root title. Wait 2s. Save dialog opens asking for a location. Pick one. Status bar "Saved". Reopen from file system — file exists with edits.
    3. Click "New Roadmap" again, edit, then CANCEL the save dialog. Status bar returns to "Saved" (in-memory only). Edit again after 2s → dialog re-opens.

    **Flush on quit (EDIT-13, EDIT-18):**
    4. Make an edit. Within 2s (before autosave fires), press Cmd/Ctrl+Q or close the window. Reopen → edit is persisted (before-quit flushed).
    5. (Linux/macOS) `kill -15 <bun pid>` (SIGTERM) — file contains the pending edit when reopened. (Linux EDIT-18 flush path confirmed.)
    6. (All OSes) Ctrl+C in terminal where `bun run dev:hmr` is running — clean exit, flush runs.

    **External edit (D-14):**
    7. Open a file. Make an edit (don't wait for save). In another editor, edit the file and save externally. Toast appears: "File changed externally. [Reload File] [Keep mine]". Autosave pauses.
    8. Click "Keep mine" → on next save, in-memory edit overwrites external change.
    9. Repeat: edit, external-edit, click "Reload File" → disk version loads; local edits discarded.
    10. When NO local edits exist (everything saved), external edit auto-reloads without toast (Phase 2 behavior preserved).

    **Cross-boundary move error (EDIT-18):**
    11. Load schema with $ref (use tests/fixtures/roadmap-with-refs.json). Attempt to move a ref-owned node into the main-owned subtree via Plan 01 mutations. Expect a toast/error (implementation may use `setCrossBoundaryError` — verify Plan 01 has this hook; if not, graceful no-op is acceptable for v1 with a note).

    **Linux Radix context menu (EDIT-18 visual):**
    12. (Linux if available) Right-click a node. Same Radix-rendered menu appears. No native OS menu, no no-op.

    **Integration regression — whole phase:**
    13. Full Phase 3 regression: create new → add 10 nodes via shortcuts → edit notes in CodeMirror → change statuses via context menu → save → close → reopen → everything persisted. No console errors throughout.
  </how-to-verify>
  <resume-signal>Type "approved" or describe issues. If Electrobun before-quit API behaves unexpectedly on any OS, update the documented API reference in the summary.</resume-signal>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Electrobun before-quit → flushPending | Handler runs synchronously with stopEventLoop; Bun.write is fast but not guaranteed to complete |
| External process → file watcher → pushFileChanged | Third-party process modifies schema file |
| Utils.saveFileDialog → filePath | Returned path is added to dialogAllowlist for session |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-03.04-03 | Tampering | External edit toast "Keep mine" | accept | User explicit choice to overwrite external edits is intended UX per D-14. |
| T-03.04-08 | Elevation of Privilege | Electrobun before-quit arbitrary code | mitigate | Handler is local to our code; no user input executed. No dynamic import. |
| T-03.04-09 | Repudiation | No audit log of saves | accept | LogTape already logs successful writes via bunLogger.info. |
| T-03.04-12 | DoS | File > New loop with cancel | accept | If user cancels saveFileDialog on every mutation, autosave re-prompts on each debounce fire. Annoying but not exploitable. Could add a session-level "don't ask again" flag in v1.1. |
</threat_model>

<verification>
- `bunx vitest run` — full Phase 3 suite GREEN
- `bunx vite build` exits 0; production strips ShellPanel
- `bunx @biomejs/biome lint packages/desktop/src/ shared/` exits 0
- `bunx tsc --noEmit` exits 0 (Electrobun import has no @ts-expect-error)
- Mid-plan + full UAT checkpoints pass
- Electrobun before-quit API documented with file:line reference
</verification>

<success_criteria>
- EDIT-13 quit portion: flush on before-quit + SIGTERM + SIGINT (with idempotent flushPending from 04a)
- EDIT-17: File > New creates in-memory schema; first autosave prompts Utils.saveFileDialog; save path persists
- EDIT-18 Linux SIGTERM flush path + cross-boundary move error (if Plan 01 wired the hook)
- D-14: External edit toast with Reload File / Keep mine; autosave pauses until resolved; auto-reload when no dirty state
- Electrobun before-quit API verified + documented
- 6 fileActions tests GREEN
</success_criteria>

<output>
After completion, create `.planning/phases/03-full-editor/03-04c-SUMMARY.md` with:
- Verified Electrobun before-quit API (file:line reference)
- Whether SIGTERM flush observed writing pending data on Linux
- Confirmed cross-boundary block error copy (or note if deferred)
- Test counts + integration regression pass
- Phase-level cleanup note: `_dev/` directory deletion happens in `/gsd-verify-work` at phase close
</output>
</content>
</invoke>