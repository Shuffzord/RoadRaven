# RPC and IPC

> Last updated: 2026-04-14 | Phase: 01-visual-foundation-themes

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
| `loadFile` | `{ path: string }` | `RoadmapSchema` | Load a roadmap JSON file from disk |
| `saveFile` | `{ schema: RoadmapSchema }` | `void` | Write roadmap JSON to disk |
| `exportHtml` | `{ path: string }` | `void` | Export roadmap as HTML |
| `exportPng` | `{ path: string }` | `void` | Export roadmap as PNG |
| `openFilePicker` | `{}` | `string \| null` | Open native file dialog, return selected path |
| `resolveRef` | `{ refPath: string }` | `RoadmapNode[]` | Resolve `$ref` links in roadmap nodes |
| `saveSettings` | `{ settings: Partial<AppSettings> }` | `{ success: boolean }` | Persist app settings to disk |
| `loadSettings` | `{}` | `{ settings: AppSettings }` | Read app settings from disk |
| `logMessage` | `{ level, category, message, data? }` | `void` | Forward a webview log entry to Bun for file writing |

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
                                            |               ----> .roadmap-settings.json
                                            v
                                     return { success: true }
       |
       v (RPC response)
.catch(() => {})  // swallow if RPC unavailable (dev/test)
```

<!-- Structured flow (machine-readable) -->
<!-- FLOW: themeStore.setTheme -> rpc.saveSettings -> BunProcess.saveSettingsHandler -> loadSettings(existing) -> merge -> writeFileSync -> .roadmap-settings.json -->
<!-- RETURNS: .roadmap-settings.json -> { success: true } -> WebviewProcess -> .catch(swallow) -->

> **Why this flow matters:** Settings must survive app restarts, which requires disk persistence. The merge strategy (load existing, overlay changed fields, write back) prevents one setting change from wiping unrelated settings. The `.catch(() => {})` on the webview side is intentional -- in Vite dev mode or tests, the Bun process may not be running, and swallowing the error lets the UI remain functional without persistence. Without this flow, the user's theme preference, sidebar state, and other settings would reset on every app launch.

The settings file (`.roadmap-settings.json`) is stored in the current working directory. It uses a merge strategy: existing settings are preserved, and only the changed fields are updated.

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
