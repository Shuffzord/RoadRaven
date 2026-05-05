---
title: Logging
nav_order: 6
layout: default
---

# Logging Architecture

> Last updated: 2026-04-15 | Phase: 02-read-only-viewer

## Overview

RoadRaven uses [LogTape](https://github.com/dahlia/logtape) for structured logging across both processes. LogTape was chosen because it has zero dependencies, supports both Bun and browser environments natively, and weighs only 5.3 KB.

## Why LogTape

> **Why LogTape over `console.log` or winston:** `console.log` provides no structured output, no file persistence, no categories, and no level filtering -- it is adequate for debugging but not for a production desktop app that needs persistent, searchable logs. Winston is Node.js-only and carries 5+ dependencies -- it would not work in the browser webview at all. Pino requires a `thread_worker` shim for browser use, adding complexity. LogTape is the only option with zero dependencies, native support for both Bun and browser environments, hierarchical categories, and structured logging -- all in 5.3 KB. *(Decision D-21; see 01-RESEARCH.md -- Alternatives Considered.)*

| Requirement | LogTape | Alternatives |
|-------------|---------|-------------|
| Zero dependencies | Yes | pino requires thread_worker; winston has 5+ deps |
| Works in Bun | Yes, native | Most loggers target Node.js |
| Works in browser | Yes | pino/winston are Node-only |
| Structured logging | Built-in | Varies |
| Hierarchical categories | Yes | Most use flat string names |
| Size | 5.3 KB | pino ~70 KB, winston ~200 KB |

## Two-Process Logging Model

Because Electrobun enforces process isolation, logging is split across two processes with different responsibilities:

```
+-----------------------------------+          +-----------------------------------+
|        Webview Process            |          |        Bun Main Process           |
|                                   |          |                                   |
|  LogTape configured with:         |          |  LogTape configured with:         |
|    - console sink (dev output)    |          |    - console sink (dev output)    |
|    - rpc sink (forwards to Bun)   |   RPC    |    - file sink (persistent logs)  |
|                                   | -------> |                                   |
|  Categories: ["webview", ...]     |          |  Categories: ["bun", ...]         |
|                                   |          |  + receives ["webview", ...] logs  |
+-----------------------------------+          +-----------------------------------+
                                                          |
                                                          v
                                                  Log file on disk
```

<!-- Structured flow (machine-readable) -->
<!-- COMPONENTS: WebviewProcess [consoleSink, rpcSink, categories: webview.*] -->
<!-- COMPONENTS: BunProcess [consoleSink, fileSink, categories: bun.* + webview.* (forwarded)] -->
<!-- FLOW: WebviewProcess.rpcSink -> RPC.logMessage -> BunProcess.logMessageHandler -> fileSink -> logFile -->
<!-- FLOW: BunProcess.logger -> consoleSink + fileSink -> logFile -->
<!-- CONSTRAINT: WebviewProcess has NO filesystem access (Electrobun sandbox) -->

> **Why this flow matters:** The webview is sandboxed -- Electrobun prohibits direct filesystem access from the renderer process. Without log forwarding, all webview diagnostic information would be lost when the app closes. Having a single writer (the Bun process) to the log file also prevents write contention that would occur if both processes tried to write to the same file simultaneously. Forwarded webview logs go to the file sink only (not console), because they were already printed in the browser's dev console.

The Bun process is the single writer to the log file. The webview forwards its logs via the `logMessage` RPC endpoint. This avoids file system access from the webview (which Electrobun prohibits) and prevents write contention.

## Category Hierarchy

LogTape uses array-based hierarchical categories. A logger for `["bun", "settings"]` inherits configuration from `["bun"]`. This is the current category structure:

### Bun Process Categories

| Category | Logger Export | Used For |
|----------|-------------|----------|
| `["bun"]` | `bunLogger` | General Bun process events |
| `["bun", "theme"]` | `themeLogger` | Theme-related Bun operations |
| `["bun", "settings"]` | `settingsLogger` | Settings file read/write |

Source: [`packages/desktop/src/bun/logging.ts`](../packages/desktop/src/bun/logging.ts)

### Webview Process Categories

| Category | Logger Export | Used For |
|----------|-------------|----------|
| `["webview"]` | (base) | General webview events |
| `["webview", "theme"]` | `themeLogger` | Theme switching, provider lifecycle |
| `["webview", "store"]` | `storeLogger` | Zustand store actions |
| `["webview", "ui"]` | `uiLogger` | UI component events |

Source: [`packages/desktop/src/mainview/logging/logger.ts`](../packages/desktop/src/mainview/logging/logger.ts)

## Sink Configuration

### Bun Process Sinks

> **Why Web WritableStream for the file sink:** LogTape's `getStreamSink` uses the Web Streams API (`WritableStream`), not Node.js streams. Node.js `fs.createWriteStream` is incompatible. Bun provides a native `WritableStream` implementation, so wrapping `Bun.file().writer()` in a Web `WritableStream` bridges the gap without any polyfills or adapters. *(Runtime fix documented in commit 5873a4d.)*

```typescript
// From packages/desktop/src/bun/logging.ts
await configure({
  sinks: {
    console: getConsoleSink(),
    file: getStreamSink(fileWritable),   // Web WritableStream wrapping Bun.file().writer()
  },
  loggers: [
    { category: ["bun"],     lowestLevel: "debug", sinks: ["console", "file"] },
    { category: ["webview"], lowestLevel: "debug", sinks: ["file"] },  // forwarded logs, file only
  ],
});
```

Note that forwarded webview logs go to the file sink only (not console), because they were already printed to the browser's dev console in the webview process.

### Webview Process Sinks

```typescript
// From packages/desktop/src/mainview/logging/logger.ts
await configure({
  sinks: {
    console: getConsoleSink(),
    rpc: (record) => {
      // Forward to Bun via electroview.rpc.request.logMessage(...)
    },
  },
  loggers: [
    { category: ["webview"], lowestLevel: "debug", sinks: ["console", "rpc"] },
  ],
});
```

## Log File Location

Log files are written to platform-specific directories:

| Platform | Path |
|----------|------|
| Windows | `%LOCALAPPDATA%\RoadRaven\logs\roadraven.log` |
| macOS | `~/Library/Logs/RoadRaven/roadraven.log` |
| Linux | `$XDG_DATA_HOME/RoadRaven/logs/roadraven.log` (default: `~/.local/share/RoadRaven/logs/`) |

The directory is created automatically if it does not exist.

Source: [`packages/desktop/src/bun/logging.ts` -- `getLogDirectory()`](../packages/desktop/src/bun/logging.ts)

## Buffer and Retry Mechanism

The webview's RPC sink includes a buffer for handling forwarding failures. This matters because the Bun process may not be ready immediately, or RPC transport may be temporarily interrupted.

The behavior:

1. On successful send: reset failure counter and flush any buffered messages.
2. On failure (consecutive count <= 3): buffer the message for later retry.
3. On failure (consecutive count > 3): stop buffering, fall back to `console.warn` with a `[log-fwd-fail]` prefix.

This prevents unbounded memory growth if the RPC connection is permanently broken, while still recovering from brief interruptions.

```typescript
// Simplified from packages/desktop/src/mainview/logging/logger.ts
rpcSend(payload)
  .then(() => {
    consecutiveFailures = 0;
    // Flush buffered logs
    while (failedLogs.length) {
      rpcSend(failedLogs.shift()!).catch(() => {});
    }
  })
  .catch(() => {
    consecutiveFailures++;
    if (consecutiveFailures <= 3) {
      failedLogs.push(payload);
    } else {
      console.warn("[log-fwd-fail]", payload);
    }
  });
```

## Lazy Import for Dev Compatibility

> **Why lazy import for `electrobun/view` in logger:** The `electrobun/view` module only exists inside the Electrobun runtime. During Vite HMR development (`bun run dev:hmr`) and in test environments (Vitest with jsdom), this module is not available. A static `import` at the top of the file would crash the entire logging setup. The lazy `import("../rpc")` wrapped in try/catch lets the module fail gracefully -- RPC forwarding is disabled, but console logging remains fully functional. *(Runtime fix documented in commit 5873a4d.)*

The webview logging setup uses a lazy `import("../rpc")` instead of a static import. This is because `electrobun/view` is only available inside the Electrobun runtime. When running the Vite dev server standalone (for HMR development), the import would crash. The lazy import catches this failure and disables RPC forwarding, keeping console logging functional.

```typescript
// From packages/desktop/src/mainview/logging/logger.ts
let rpcSend = null;
try {
  const { electroview } = await import("../rpc");
  rpcSend = (payload) => electroview.rpc.request.logMessage(payload);
} catch {
  // electrobun/view not available -- RPC forwarding disabled, console-only
}
```

## How to Add a New Logger Category

1. **Create the logger** with `getLogger()` using an array category:

   ```typescript
   // In the appropriate process's logging file
   export const myFeatureLogger = getLogger(["webview", "my-feature"]);
   ```

2. **Use it** in your code:

   ```typescript
   import { myFeatureLogger } from "../logging/logger";

   myFeatureLogger.info("Something happened");
   myFeatureLogger.debug`Detailed info: ${someValue}`;
   myFeatureLogger.error("Something failed", { errorCode: 42 });
   ```

3. No additional configuration needed. The logger inherits sink configuration from its parent category (`["webview"]` or `["bun"]`).

4. If you need a different log level or different sinks for the new category, add a specific entry to the `loggers` array in the `configure()` call.

## Related Documentation

- [RPC and IPC](./rpc-and-ipc.md) -- how log forwarding uses the `logMessage` RPC endpoint
- [Architecture Overview](./architecture-overview.md) -- process model context
- [Development Guide](./development-guide.md) -- practical workflow
