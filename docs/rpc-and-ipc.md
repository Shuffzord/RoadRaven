---
title: RPC and IPC
nav_order: 4
layout: default
---

# RPC and IPC

> Last updated: 2026-04-22 | Phase: 03-full-editor (Waves 1 + 2)

## Overview

RoadRaven's two processes (Bun main process and webview renderer) communicate through Electrobun's typed RPC system. There is no shared memory, no direct `require()` across processes, and no IPC channels to manage manually. Electrobun handles serialization and transport.

## Why Typed RPC

> **Why typed RPC via `shared/types.ts`:** In a two-process architecture where Bun and webview run in separate runtimes, contract drift is the primary risk. Without a shared type definition, the Bun process could expect `{ path: string }` while the webview sends `{ filePath: string }` -- and the error would only surface at runtime. A single TypeScript file imported by both sides turns this class of bug into a compile-time error. *(Decision D-22; see 01-CONTEXT.md.)*

The RPC contract is defined once in `shared/types.ts` and imported by both sides. This gives you:

- **Compile-time safety.** If you add a parameter to a request, TypeScript will flag every call site that needs updating.
- **Single source of truth.** No drift between what the Bun process expects and what the webview sends.
- **Breaking change detection.** Both sides must be updated together before anything ships.

## How Electrobun RPC Works

### Bun Side (Main Process)

The Bun process defines RPC handlers using `BrowserView.defineRPC`:

```typescript
// From packages/desktop/src/bun/index.ts
import { BrowserView } from "electrobun/bun";
import type { RoadmapRPCType } from "../../../../shared/types.ts";

const rpc = BrowserView.defineRPC<RoadmapRPCType>({
  handlers: {
    requests: {
      logMessage: ({ level, category, message, data }) => { /* ... */ },
      saveSettings: ({ settings }) => { /* ... */ },
      loadSettings: () => { /* ... */ },
    },
    messages: {},
  },
});
```

The `rpc` object is passed to `BrowserWindow` when creating the app window.

### Webview Side (Renderer)

The webview creates an `Electroview` instance with its own handler definitions:

```typescript
// From packages/desktop/src/mainview/rpc.ts
import { Electroview } from "electrobun/view";
import type { RoadmapRPCType } from "../../../../shared/types";

const rpc = Electroview.defineRPC<RoadmapRPCType>({
  handlers: {
    requests: {},
    messages: {},
  },
});

export const electroview = new Electroview({ rpc });
```

The webview makes requests to the Bun process like this:

```typescript
const response = await electroview.rpc.request.saveSettings({ settings: { theme: "dark" } });
```

## The RoadmapRPCType Contract

The full contract is defined in `shared/types.ts`. Here is what each endpoint does:

### Bun-Side Requests (webview calls these)

| Request | Parameters | Response | Purpose |
|---------|-----------|----------|---------|
| `loadFile` | `{ path: string }` | `{ data: RoadmapSchema \| null, errors?: Array<{ path, message, code }> }` | Load + Zod-validate a roadmap JSON file, create .bak.json backup, resolve $ref nodes, start file watchers |
| `saveFile` | `{ schema: RoadmapSchema, filePath?: string }` | `{ ok: true } \| { ok: false, error: string }` | Atomically write roadmap JSON to disk. Splits the in-memory schema by `refMap` so each `$ref` subtree is written back to its source file. Path-traversal guard rejects any `filePath` not in the session allowlist. |
| `exportHtml` | `{ path: string }` | `undefined` | Export roadmap as HTML (future) |
| `exportPng` | `{ path: string }` | `undefined` | Export roadmap as PNG (future) |
| `openFilePicker` | `{}` | `string` | Open native file dialog, return selected path (empty string if cancelled) |
| `resolveRef` | `{ refPath: string }` | `RoadmapNode[]` | Resolve `$ref` links in roadmap nodes |
| `saveSettings` | `{ settings: Partial<AppSettings> }` | `{ success: boolean }` | Persist app settings to disk |
| `loadSettings` | `{}` | `{ settings: AppSettings }` | Read app settings from disk |
| `logMessage` | `{ level, category, message, data? }` | `undefined` | Forward a webview log entry to Bun for file writing |

**Note on `loadFile`:** The response always includes `data` (which may be `null` on read failure) and optionally `errors` (Zod validation issues). When validation fails, the raw parsed data is still returned for partial rendering -- the errors are displayed separately in SchemaErrorPanel. On successful load, the handler also writes a `.bak.json` backup, resolves `$ref` nodes recursively, starts file watchers (500ms debounce), and tracks the file in recent files (capped at 10).

**Note on `openFilePicker`:** Returns an empty string (not `null`) when the user cancels, because Electrobun's `Utils.openFileDialog` returns an array. The `maxRequestTime` is set to 120 seconds on both sides because native file dialogs block until the user picks a file.

### Bun-Side Messages (Bun pushes these to webview)

| Message | Payload | Purpose |
|---------|---------|---------|
| `nodeStatusUpdate` | `{ nodeId, status, meta? }` | A node's status changed (from plugin/integration) |
| `integrationEvent` | `{ source, event }` | An integration plugin emitted an event |
| `fileChanged` | `{ path }` | The roadmap file was modified externally |

### Webview-Side Messages (Bun sends these)

| Message | Payload | Purpose |
|---------|---------|---------|
| `pushStatusUpdate` | `{ nodeId, status, meta? }` | Forward node status update to React UI |
| `pushEventLog` | `{ event }` | Forward integration event for display |
| `pushFileChanged` | `{ path }` | Notify UI that the file changed on disk |

Source: [`shared/types.ts`](../shared/types.ts)

## Data Flow: File Loading with Validation

When the user opens a file, this is the full pipeline from dialog to rendered tree:

```
Webview                              Bun Process                    Disk
-------                              -----------                    ----
handleOpenFile()
       |
       v
electroview.rpc.request.openFilePicker({})
       |
       v (RPC transport)
                                     Utils.openFileDialog({
                                       startingFolder: homedir(),
                                       allowedFileTypes: "json"
                                     })
                                            |               <---- Native file dialog
                                            v
                                     return paths[0] ?? ""
       |
       v (RPC response, path string)
if (!path) return              // User cancelled
       |
       v
electroview.rpc.request.loadFile({ path })
       |
       v (RPC transport)
                                     1. Bun.file(path).text()       <---- Read file
                                     2. Bun.write(bakPath, raw)     ----> .bak.json backup
                                     3. JSON.parse(raw)
                                     4. RoadmapSchemaSchema.safeParse(parsed)
                                     5. resolveRefs(nodes, path)    <---- Read $ref files
                                     6. stopAllWatchers()
                                     7. watchFile(path, callback)   ----> File watcher (500ms debounce)
                                     8. addRecentFile(path)         ----> settings.json
                                     9. return { data, errors }
       |
       v (RPC response)
roadmapStore.loadSchema(data, path)
  - toTreeDatum()       // Convert to react-d3-tree format
  - buildNodeIndex()    // Flat Map for O(1) lookups
  - dataKey++           // Trigger tree re-layout
setSchemaErrors(errors ?? [])
```

> **Why this flow matters:** The multi-step pipeline handles several failure modes gracefully. If the file cannot be read, a `file_read_error` is returned. If JSON parsing fails, a `json_parse_error` is returned. If Zod validation fails, the raw data is still returned for partial rendering alongside the validation errors. The `.bak.json` backup protects against data loss. File watchers enable live reload when the file changes externally. The `stopAllWatchers()` call before starting new watchers prevents leaked watchers from previous file opens.

## Data Flow: Autosave (Editor → Disk)

When the editor commits a change, `useAutosave` debounces and then calls `saveFile`. The Bun handler may write multiple files in one call when the loaded schema includes `$ref`-resolved subtrees:

```
Webview                              Bun Process                    Disk
-------                              -----------                    ----
User commits a field (panel/canvas)
       |
       v
roadmapStore.<mutation>()  -- bumps dataKey or statusTick
       |
       v
useAutosave subscriber sees the bump
       |
       v
setTimeout(flushNow, 1000ms or 2000ms)   -- per-trigger debounce
       |
       v (after debounce)
electroview.rpc.request.saveFile({ schema })
       |
       v (RPC transport)
                                     saveFile handler (saveFile.ts)
                                            |
                                            v
                                     allowlist check on filePath  (path-traversal guard)
                                            |
                                            v
                                     RoadmapSchemaSchema.safeParse  (last-line schema check)
                                            |
                                            v
                                     splitByRefMap(schema)
                                       -> Map<filePath, partialSchema>
                                            |
                                            v
                                     for each (path, partial):
                                       atomicWrite(path, JSON.stringify(partial))
                                         1. Bun.write(<dir>/.<basename>.<pid>.<ts>.tmp)
                                         2. renameSync(tmp, target)        ----> file
                                         3. on Win EPERM/EBUSY/EACCES:
                                            retry x3 with 50ms backoff
                                            |
                                            v
                                     return { ok: true } or { ok: false, error }
       |
       v (RPC response)
useAutosave updates store.saveState
  - ok       -> "saved", lastSavedDataKey/StatusTick snapshot
  - !ok      -> handleFailure() escalates: error-retrying / error-manual / error-modal
```

> **Why split by refMap rather than write a single big file:** When a `$ref` node was loaded, its subtree came from a separate JSON file. Writing the whole in-memory schema back to the main file would clobber the `$ref` link with the resolved subtree, silently denormalising the data. By tracking the source path of every node in `refMap` and re-splitting on save, edits to a `$ref`-loaded subtree get persisted to the file they came from. The main file's `$ref` pointer remains intact.

> **Why atomic temp + rename:** Writing in place can corrupt the file if the process is killed mid-write. The temp + rename pattern guarantees the target file is either the old contents or the new contents — never a half-written mix. On POSIX, `rename(2)` is atomic. On Windows, the rename can transiently fail with `EPERM` / `EBUSY` / `EACCES` while antivirus or the file indexer scans the new tmp file, so the helper retries up to three times with a short backoff before giving up.

## Data Flow: Settings Persistence

When the user changes a setting (like theme preference), this is the full round trip:

```
Webview                              Bun Process                    Disk
-------                              -----------                    ----
themeStore.setTheme("light")
       |
       v
electroview.rpc.request.saveSettings(
  { settings: { theme: "light" } }
)
       |
       v (RPC transport)
                                     saveSettings handler
                                            |
                                            v
                                     loadSettings() (read existing)
                                     merge with new settings
                                     writeFileSync()
                                            |               ----> settings.json
                                            v
                                     return { success: true }
       |
       v (RPC response)
.catch(() => {})  // swallow if RPC unavailable (dev/test)
```

<!-- Structured flow (machine-readable) -->
<!-- FLOW: themeStore.setTheme -> rpc.saveSettings -> BunProcess.saveSettingsHandler -> loadSettings(existing) -> merge -> writeFileSync -> settings.json -->
<!-- RETURNS: settings.json -> { success: true } -> WebviewProcess -> .catch(swallow) -->

> **Why this flow matters:** Settings must survive app restarts, which requires disk persistence. The merge strategy (load existing, overlay changed fields, write back) prevents one setting change from wiping unrelated settings. The `.catch(() => {})` on the webview side is intentional -- in Vite dev mode or tests, the Bun process may not be running, and swallowing the error lets the UI remain functional without persistence. Without this flow, the user's theme preference, sidebar state, and other settings would reset on every app launch.

The settings file (`settings.json`) is stored in a platform-specific directory:

| Platform | Path |
|----------|------|
| Windows | `%LOCALAPPDATA%\RoadRaven\settings.json` |
| macOS | `~/Library/Application Support/RoadRaven/settings.json` |
| Linux | `$XDG_CONFIG_HOME/RoadRaven/settings.json` (default: `~/.config/RoadRaven/`) |

The `AppSettings` interface tracks:

```typescript
interface AppSettings {
  theme?: ThemePreference;                          // "dark" | "light" | "high-contrast" | "system"
  recentFiles?: string[];                           // Up to 10 most recent file paths
  fileSettings?: Record<string, { layout?: "TB" | "LR" }>;  // Per-file layout preference
}
```

It uses a merge strategy: existing settings are preserved, and only the changed fields are updated. The `addRecentFile` function deduplicates entries, moves existing entries to the front, and caps at 10.

Source: [`packages/desktop/src/bun/settings.ts`](../packages/desktop/src/bun/settings.ts)

## Data Flow: Log Forwarding

Webview logs are forwarded to the Bun process for file writing, because the webview has no file system access:

```
Webview                              Bun Process
-------                              -----------
themeLogger.info("Theme changed")
       |
       v
LogTape rpc sink fires
       |
       v
electroview.rpc.request.logMessage({
  level: "info",
  category: ["webview", "theme"],
  message: "Theme changed"
})
       |
       v (RPC transport)
                                     logMessage handler
                                            |
                                            v
                                     getLogger(["webview", "theme"])
                                     logger.info("Theme changed")
                                            |
                                            v
                                     Written to log file via file sink
```

<!-- Structured flow (machine-readable) -->
<!-- FLOW: themeLogger.info -> LogTape rpcSink -> rpc.logMessage({ level, category, message }) -> BunProcess.logMessageHandler -> getLogger(category) -> logger[level](message) -> fileSink -> logFile -->
<!-- FALLBACK: rpcSink failure (count <= 3) -> buffer -> retry on next success -->
<!-- FALLBACK: rpcSink failure (count > 3) -> console.warn("[log-fwd-fail]") -->

> **Why this flow matters:** The webview runs in a sandboxed browser context with no filesystem access. Without RPC forwarding, webview logs would only appear in the browser console and be lost when the app closes. The buffer+retry mechanism prevents log loss during brief RPC unavailability (e.g., during app startup before the Bun process is fully initialized). The 3-failure cap prevents unbounded memory growth if the RPC connection is permanently broken. Failure modes handled: temporary RPC unavailability (buffered), permanent disconnection (console fallback), and Bun process restart (buffer flushed on reconnect).

If the RPC call fails (e.g., Bun process is slow or restarting), the webview buffers up to 3 failed messages and retries them on the next successful send. After 3 consecutive failures, messages are logged to the browser console as a fallback.

Source: [`packages/desktop/src/mainview/logging/logger.ts`](../packages/desktop/src/mainview/logging/logger.ts)

## How to Add a New RPC Endpoint

1. **Define the type** in `shared/types.ts`:

   ```typescript
   // Inside RoadmapRPCType.bun.requests:
   myNewEndpoint: {
     params: { someField: string };
     response: { result: boolean };
   };
   ```

2. **Add the handler** in `packages/desktop/src/bun/index.ts`:

   ```typescript
   // Inside BrowserView.defineRPC handlers.requests:
   myNewEndpoint: ({ someField }) => {
     // Implementation
     return { result: true };
   },
   ```

3. **Call it from the webview**:

   ```typescript
   const response = await electroview.rpc.request.myNewEndpoint({ someField: "value" });
   ```

TypeScript will enforce that all three locations agree on the parameter and response types.

## Related Documentation

- [Architecture Overview](./architecture-overview.md) -- process model context
- [Logging](./logging.md) -- detailed logging architecture (uses RPC for forwarding)
- [Development Guide](./development-guide.md) -- step-by-step for adding endpoints
