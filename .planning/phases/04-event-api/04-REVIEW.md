---
phase: 04-event-api
reviewed: 2026-04-28T12:00:00Z
depth: standard
files_reviewed: 71
files_reviewed_list:
  - .husky/pre-commit
  - packages/core/src/plugin.ts
  - packages/desktop/package.json
  - packages/desktop/src/bun/eventCoalescer.ts
  - packages/desktop/src/bun/eventSchema.ts
  - packages/desktop/src/bun/eventServer.ts
  - packages/desktop/src/bun/eventServerStandalone.ts
  - packages/desktop/src/bun/eventsLog.ts
  - packages/desktop/src/bun/index.ts
  - packages/desktop/src/bun/logging.ts
  - packages/desktop/src/bun/sentinel.ts
  - packages/desktop/src/bun/settings.ts
  - packages/desktop/src/mainview/App.tsx
  - packages/desktop/src/mainview/components/EventApiPill.tsx
  - packages/desktop/src/mainview/components/EventLogDrawer.tsx
  - packages/desktop/src/mainview/components/EventLogFilterBar.tsx
  - packages/desktop/src/mainview/components/EventLogRow.tsx
  - packages/desktop/src/mainview/components/EventToast.tsx
  - packages/desktop/src/mainview/components/EventToastStack.tsx
  - packages/desktop/src/mainview/components/IntegrationZone.tsx
  - packages/desktop/src/mainview/components/RoadmapNode.tsx
  - packages/desktop/src/mainview/components/SidePanel.tsx
  - packages/desktop/src/mainview/components/StatusBar.tsx
  - packages/desktop/src/mainview/components/TopBar.tsx
  - packages/desktop/src/mainview/components/WelcomeScreen.tsx
  - packages/desktop/src/mainview/hooks/useKeyboardRouter.ts
  - packages/desktop/src/mainview/index.css
  - packages/desktop/src/mainview/rpc.ts
  - packages/desktop/src/mainview/rpcHandlers.ts
  - packages/desktop/src/mainview/store/eventApiStore.ts
  - packages/desktop/src/mainview/store/eventLogStore.ts
  - packages/desktop/src/mainview/store/roadmapStore.ts
  - packages/desktop/src/mainview/store/toastStore.ts
  - packages/desktop/src/mainview/utils/formatRelative.ts
  - packages/desktop/tests/integration/eventApi-e2e.test.ts
  - packages/desktop/tests/integration/eventApi.test.ts
  - packages/desktop/tests/integration/eventLog-selection.test.ts
  - packages/desktop/tests/unit/bun/eventCoalescer.test.ts
  - packages/desktop/tests/unit/bun/eventSchema.test.ts
  - packages/desktop/tests/unit/bun/eventServer.eaddrinuse.test.ts
  - packages/desktop/tests/unit/bun/eventServer.test.ts
  - packages/desktop/tests/unit/bun/eventsLog.test.ts
  - packages/desktop/tests/unit/bun/sentinel.test.ts
  - packages/desktop/tests/unit/hooks/useKeyboardRouter.drawer.test.ts
  - packages/desktop/tests/unit/schema.test.ts
  - packages/desktop/tests/unit/store/eventApiStore.test.ts
  - packages/desktop/tests/unit/store/eventLogStore.test.ts
  - packages/desktop/tests/unit/store/roadmapStore.applyEventBatch.test.ts
  - packages/desktop/tests/unit/store/roadmapStore.liveIndicator.test.ts
  - packages/desktop/tests/unit/store/toastStore.test.ts
  - packages/desktop/tests/unit/ui/EventLogDrawer.test.tsx
  - packages/desktop/tests/unit/ui/EventLogFilterBar.test.tsx
  - packages/desktop/tests/unit/ui/EventToast.test.tsx
  - packages/desktop/tests/unit/ui/IntegrationZone.test.tsx
  - packages/desktop/tests/unit/ui/StatusBarEventPill.test.tsx
  - packages/desktop/vitest.config.ts
  - plugins/claude-code/README.md
  - plugins/claude-code/package.json
  - plugins/claude-code/src/index.ts
  - plugins/claude-code/src/sentinel.ts
  - plugins/claude-code/src/server.ts
  - plugins/claude-code/src/userData.ts
  - plugins/claude-code/src/wsClient.ts
  - plugins/claude-code/tests/sentinel.test.ts
  - plugins/claude-code/tests/userData.test.ts
  - plugins/claude-code/tests/wsClient.test.ts
  - plugins/claude-code/tsconfig.json
  - plugins/claude-code/vitest.config.ts
  - shared/types.ts
findings:
  critical: 0
  warning: 6
  info: 5
  total: 11
status: issues_found
---

# Phase 04: Code Review Report

**Reviewed:** 2026-04-28T12:00:00Z
**Depth:** standard
**Files Reviewed:** 71
**Status:** issues_found

## Summary

Phase 04 delivers the Event API: a Bun WebSocket server, a Zod-validated event schema, a coalescing flush layer, a sentinel-based discovery mechanism, a Node.js MCP plugin wrapper (`plugins/claude-code/`), and the full renderer UI (event log drawer, filter bar, toast stack, live indicators). The architecture is clean and the runtime boundary (Bun vs Node) is well-respected throughout — Pitfall 8 from RESEARCH is correctly avoided in the plugin package.

The most significant concerns are concentrated in two areas:

1. **WsClient reconnect loop** (`plugins/claude-code/src/wsClient.ts`): the `connectLoop`/`scheduleReconnect` interaction can double-count `attempt` and fire two reconnect paths simultaneously when a connection is established then immediately dropped.
2. **Unhandled promise rejection surfaces** in both the MCP server and the renderer RPC dispatcher — errors from disconnected-during-send and dynamic imports are silently discarded.
3. **`EventServer.stop()` calls `boundServer.stop()` twice** — once in a `Promise.race` and then unconditionally — which may surface a Bun internal error on second call if the server is already stopped.

No security vulnerabilities were found. The `127.0.0.1` binding, path-traversal allowlist, and Zod schema validation are all correctly implemented. No hardcoded secrets or credentials are present.

---

## Warnings

### WR-01: Double `attempt` increment in `wsClient.ts` `connectLoop`

**File:** `plugins/claude-code/src/wsClient.ts:78-89`
**Issue:** When `connectOnce()` returns `false` (sentinel present, WebSocket created, but error fires before open), the `close` listener inside `connectOnce` calls `scheduleReconnect()`, which increments `attempt` and sets a retry timeout that calls `connectLoop()` again. Meanwhile the `connectLoop` `while` body also increments `attempt` and schedules its own `await new Promise(setTimeout)` before looping. This causes two concurrent reconnect paths with double-incremented backoff, which can result in two simultaneous `connectOnce()` invocations after the first failure — the second path creates a dangling `WebSocket` that is never stored in `ws`.

The close listener path (`scheduleReconnect`) is correct for the "connection was established and then lost" case. The `connectLoop` internal backoff is correct for the "sentinel found but no connection opened" case. The problem is that when `connectOnce` fails before `open` (error event fires, which also fires `close`), both paths trigger.

**Fix:** In `connectOnce`, the `close` listener should only call `scheduleReconnect()` when a connection *was* opened (`connected === true` at the moment of close), not on a pre-open error close. The `connectLoop` already handles the pre-open error case via its internal `await setTimeout`:

```typescript
socket.addEventListener("close", () => {
    connected = false;
    ws = null;
    // Only reschedule from 'close' when the socket was actually open.
    // Pre-open failures (error→close) are retried by connectLoop's own backoff.
    if (!stopped && ws !== null /* was previously ws — closed an open connection */) {
        scheduleReconnect();
    }
});
```

A cleaner approach is to track whether `open` fired in `connectOnce`:

```typescript
let wasOpen = false;
socket.addEventListener("open", () => { wasOpen = true; /* ... */ });
socket.addEventListener("close", () => {
    connected = false;
    ws = null;
    if (!stopped && wasOpen) scheduleReconnect();
});
```

---

### WR-02: `EventServer.stop()` calls `boundServer.stop()` twice

**File:** `packages/desktop/src/bun/eventServer.ts:259-265`
**Issue:** The shutdown sequence calls `boundServer.stop()` inside a `Promise.race` (graceful attempt), waits 500 ms, and then calls `boundServer.stop(true)` unconditionally. If the graceful stop resolves within 500 ms, the second `boundServer.stop(true)` is called on an already-stopped server. In current Bun versions (≥1.1) `Server.stop()` on an already-stopped server throws an uncaught promise rejection with `"Server is already stopped"` — this would be swallowed silently since `stop()` is `async` and there is no `await` on the second call in most Bun versions, but the behavior differs across Bun patch versions and could surface as an unhandled rejection in a future release.

```typescript
// Current (problematic):
const gracefulStop = boundServer.stop();
const timeout = new Promise<void>((resolve) => setTimeout(resolve, 500));
await Promise.race([gracefulStop, timeout]);
await boundServer.stop(true); // may throw if already stopped above
```

**Fix:** Track whether the graceful stop won the race:

```typescript
const gracefulStop = boundServer.stop();
const timeout = new Promise<void>((resolve) => setTimeout(resolve, 500));
const timedOut = await Promise.race([
    gracefulStop.then(() => false),
    timeout.then(() => true),
]);
if (timedOut) {
    await boundServer.stop(true);
}
```

---

### WR-03: Unhandled rejection in `server.ts` tool handler when `readSentinel` throws

**File:** `plugins/claude-code/src/server.ts:47-69`
**Issue:** The `updateNodeStatus` tool handler calls `await readSentinel()` inside a `catch` block. If `readSentinel` itself throws (e.g., `readFile` rejects with something other than ENOENT, or `JSON.parse` throws despite being wrapped), the exception escapes the `try/catch` and becomes an unhandled rejection from within the MCP tool handler. The MCP SDK may or may not surface this to Claude — behaviour depends on SDK version.

```typescript
// In the catch block:
const sentinel = await readSentinel(); // can throw — not wrapped
```

**Fix:**

```typescript
} catch {
    let sentinel: Awaited<ReturnType<typeof readSentinel>>;
    try {
        sentinel = await readSentinel();
    } catch {
        return {
            content: [{ type: "text", text: "Roadmap Viewer is not running. Start the app and retry." }],
            isError: true,
        };
    }
    if (!sentinel.ok) { /* ... */ }
    /* ... */
}
```

---

### WR-04: RPC `.then()` calls in `rpc.ts` discard errors silently

**File:** `packages/desktop/src/mainview/rpc.ts:11-50`
**Issue:** Every RPC message handler uses `.then(handler)` without a `.catch()`. If the dynamic `import("./rpcHandlers")` fails (e.g., bundler error, missing module during HMR), or if the imported handler throws, the rejection is silently swallowed. In particular, `handlePushStatusUpdate` and `handlePushEventLog` call store methods that can internally throw (e.g., if `useRoadmapStore` is in a bad state during a reload). This means live event updates could silently stop working with no console indication.

```typescript
// Current — no error handling:
pushStatusUpdate: (msg) => {
    if ("updates" in msg) {
        import("./rpcHandlers").then(({ handlePushStatusUpdate }) => {
            handlePushStatusUpdate(msg as /* ... */);
        });
    }
},
```

**Fix:** Append a `.catch` to each dynamic import chain, or use `void` with an async IIFE that surfaces errors through the logging RPC:

```typescript
pushStatusUpdate: (msg) => {
    if ("updates" in msg) {
        import("./rpcHandlers")
            .then(({ handlePushStatusUpdate }) => handlePushStatusUpdate(msg as /* ... */))
            .catch((err) => {
                // In Electrobun renderer, console.error is acceptable for unrecoverable RPC failures
                // or route through the existing logMessage RPC
            });
    }
},
```

---

### WR-05: `settings.ts` uses `console.warn` — violates project-level `no-console` rule

**File:** `packages/desktop/src/bun/settings.ts:40,63`
**Issue:** `loadSettings` (line 40) and `saveSettings` (line 63) use `console.warn` to report parse and write failures. The project CLAUDE.md states "Don't use console.logs unless specifically asked by the user." The logging module (`logging.ts`) exports `settingsLogger` for exactly this purpose. `console.warn` in the Bun process does not feed into LogTape and therefore misses the file sink — failures during settings load/save are effectively invisible in production logs.

```typescript
// Line 40:
console.warn("[settings] Failed to parse settings.json:", e);
// Line 63:
console.warn("[settings] Failed to save settings:", e);
```

**Fix:**

```typescript
import { settingsLogger } from "./logging";
// ...
settingsLogger.warn`Failed to parse settings.json: ${String(e)}`;
// ...
settingsLogger.warn`Failed to save settings: ${String(e)}`;
```

---

### WR-06: `EventLogRow` renders a `<li>` inside a `<div>` without a parent `<ul>` or `<ol>`

**File:** `packages/desktop/src/mainview/components/EventLogRow.tsx:124-252`
**Issue:** The outer wrapper of `EventLogRow` is a `<div>` (line 122), but the main row element inside is a `<li>` (line 124). A `<li>` element without a `<ul>` or `<ol>` ancestor is invalid HTML and creates an accessibility tree violation — screen readers announce it as a list item but there is no containing list. Additionally, the `<li>` is interactive (has `onClick`, `onKeyDown`) but is not a `<button>` or have `role="button"` and `tabIndex`, meaning it is not keyboard-reachable without the `tabIndex` attribute.

**Fix:** Change the wrapper to render a `<ul>` that wraps the `<li>`, or change the `<li>` to a `<div role="row">` consistent with the surrounding virtualizer usage:

```tsx
// Option A — fix the wrapper to be a proper list:
// In EventLogDrawer.tsx, wrap the entire virtualizer output in a <ul>
// and ensure EventLogRow renders only a <li>.

// Option B — remove the semantic mismatch in EventLogRow.tsx:
// Replace <li ...> with <div role="row" tabIndex={0} ...>
// This matches the virtualizer's non-list rendering pattern.
```

---

## Info

### IN-01: `formatRelative` is duplicated between `IntegrationZone.tsx` and `utils/formatRelative.ts`

**File:** `packages/desktop/src/mainview/components/IntegrationZone.tsx:17-23` and `packages/desktop/src/mainview/utils/formatRelative.ts:9-15`
**Issue:** `IntegrationZone.tsx` contains a local `formatRelative` function that is byte-for-byte identical to the exported `formatRelative` in `utils/formatRelative.ts`. The util file was likely created to consolidate this, but `IntegrationZone` was not updated to import from it.
**Fix:** Remove the local function from `IntegrationZone.tsx` and add `import { formatRelative } from "../utils/formatRelative";`.

---

### IN-02: `EventLogRow` locally re-implements `formatRelativeShort` instead of using the shared util

**File:** `packages/desktop/src/mainview/components/EventLogRow.tsx:14-22`
**Issue:** `EventLogRow` contains `formatRelativeShort` which is a near-duplicate of `formatRelative` in `utils/formatRelative.ts`. The only difference is the `< 1_000` → `"just now"` branch uses `< 60_000` in the shared util (seconds vs minutes threshold for "just now"). This is a subtle divergence — `EventLogRow` correctly shows "just now" for sub-second events while the shared util shows "just now" for sub-minute events. If these semantics are intentional, a comment explaining the difference would help; if accidental, they should be reconciled and the shared util used.
**Fix:** If the `< 1_000` threshold is intentional for the drawer row display, extract it as `formatRelativeDrawer` in the utils file and import from there. If the sub-minute "just now" threshold is acceptable everywhere, consolidate to the shared util.

---

### IN-03: `EventApiPill.tsx` uses a runtime-constructed module path to defeat Vite static analysis

**File:** `packages/desktop/src/mainview/components/EventApiPill.tsx:14-22`
**Issue:** The dynamic import guard that was needed during Wave 2 (when `eventLogStore` didn't exist yet) is still present in Wave 4 code where the store is fully defined. The comment says "The module does not exist until Plan 04-04 ships." — but Plan 04-04 has shipped. The guard is now unnecessary complexity and the `/* @vite-ignore */` comment suppresses a legitimate Vite analysis warning that would otherwise confirm the import is valid.
**Fix:** Replace the dynamic import guard with a regular static import of `useEventLogStore` from `../store/eventLogStore`.

---

### IN-04: `logging.ts` configures loggers for `["bun"]` and `["webview"]` categories but `serverLogger`, `routingLogger`, `eventsLogLogger`, `sentinelLogger` use category `["roadraven", "events", ...]`

**File:** `packages/desktop/src/bun/logging.ts:65-87`
**Issue:** `setupBunLogging()` configures two logger categories: `["bun"]` (lowestLevel: debug, sinks: console+file) and `["webview"]` (lowestLevel: debug, sinks: file). The four event-API loggers exported at lines 84–87 use categories `["roadraven", "events", "server"]`, `["roadraven", "events", "routing"]`, etc. These categories have no matching logger configuration in `configure()`, so LogTape routes them to its default sink (typically stderr with no formatting) or drops them depending on the LogTape version. Event-API server logs will not appear in `roadraven.log`.
**Fix:** Add a logger entry for the `["roadraven"]` category (or `["roadraven", "events"]`) in `configure()`:

```typescript
{
    category: ["roadraven"],
    lowestLevel: "debug",
    sinks: ["console", "file"],
},
```

---

### IN-05: `server.ts` (MCP plugin) creates `wsClient` at module load time — reconnect loop starts before MCP transport connects

**File:** `plugins/claude-code/src/server.ts:10-13`
**Issue:** `createWsClient()` is called at module level, which immediately kicks off `connectLoop()` in the background. This happens before `await server.connect(transport)` on line 97. In typical usage this is harmless (the connection attempt is async), but if the sentinel file doesn't exist yet (e.g., user invokes the MCP tool before launching RoadRaven), the client starts burning through its 3s retry window during MCP transport initialization. By the time the first tool call arrives, the client may already be in a long backoff period with `attempt > 0`. This is a minor timing issue, not a correctness bug, but worth noting.
**Fix (advisory):** Consider lazy-initializing `wsClient` on the first tool call, or document that the 3s sentinel probe window is consumed during MCP startup. No code change required if the current behaviour is acceptable.

---

_Reviewed: 2026-04-28T12:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
