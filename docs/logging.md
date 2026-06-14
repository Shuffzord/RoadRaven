---
title: Logging
nav_order: 6
layout: default
---

# Logging Architecture

## Overview

RoadRaven uses [LogTape](https://github.com/dahlia/logtape) for structured logging across both processes. LogTape was chosen because it has zero dependencies, supports both Bun and browser environments natively, and weighs only 5.3 KB.

## Why LogTape

LogTape is the only logger that combines zero dependencies, native Bun *and* browser support, hierarchical categories, and structured output -- all in 5.3 KB. `console.log` lacks persistence, categories, and level filtering; winston and pino are Node-oriented and do not work cleanly in the sandboxed webview.

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

The Bun process is the single writer to the log file -- a single writer avoids the write contention that two processes sharing one file would cause. The webview is sandboxed and has no filesystem access, so it forwards its logs to Bun via the `logMessage` RPC endpoint. Forwarded webview logs go to the file sink only (not console), since they were already printed in the browser's dev console.

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

LogTape's `getStreamSink` uses the Web Streams API (`WritableStream`), not Node.js streams, so `fs.createWriteStream` is incompatible. Bun provides a native `WritableStream`, so wrapping `Bun.file().writer()` in a Web `WritableStream` bridges the gap without polyfills.

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

The webview's RPC sink buffers messages to survive forwarding failures -- the Bun process may not be ready immediately, or RPC transport may be briefly interrupted.

1. On successful send: reset failure counter and flush any buffered messages.
2. On failure (consecutive count <= 3): buffer the message for later retry.
3. On failure (consecutive count > 3): stop buffering, fall back to `console.warn` with a `[log-fwd-fail]` prefix.

This recovers from brief interruptions while preventing unbounded memory growth if the RPC connection is permanently broken.

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

The webview logging setup uses a lazy `import("../rpc")` instead of a static import, because `electrobun/view` only exists inside the Electrobun runtime -- during Vite HMR development and in Vitest/jsdom tests it is absent, and a static import would crash logging setup. The lazy import catches that failure and disables RPC forwarding, keeping console logging functional.

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
