---
title: Event API Plugin Authoring
nav_order: 7
layout: default
---

# Writing an Event Producer for RoadRaven

> **Scope:** This guide covers RoadRaven v1.0's **Event API** — the way external
> tools push live status updates into a running RoadRaven app. The full plugin
> system (smart adapters that own their own connection lifecycle) is v1.1; do
> not depend on the `plugin` / `subscribe` JSON fields in v1.0 — they are
> parsed but not acted on.

## What you can build

Anything that can speak WebSocket and produce structured status events:

- A CI/CD pipeline wrapper that updates roadmap nodes as builds progress
- A test runner integration that marks nodes "blocked" on test failures
- A daemon that polls an external API (Linear, GitHub, etc.) and reflects state
  into the roadmap
- An LLM-driven agent that updates nodes as it makes progress on tasks
   — the [`@roadraven/plugin-claude-code`](https://www.npmjs.com/package/@roadraven/plugin-claude-code)
   MCP wrapper at [`plugins/claude-code/`](https://github.com/Shuffzord/RoadRaven/tree/master/plugins/claude-code)
   is the reference implementation

## The contract

Every event is a single WebSocket text frame containing JSON:

```json
{
  "nodeId": "8a7b...uuid",
  "status": "in-progress",
  "meta": { "branch": "main", "commit": "abc123" },
  "source": "my-tool"
}
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `nodeId` | string | yes | Must match a node in the loaded roadmap. Not necessarily a UUID — any non-empty string the producer agrees on with the roadmap author. |
| `status` | string | yes | Must match a `statusConfig` id in the loaded schema OR a built-in status (`not-started`, `in-progress`, `completed`, `blocked`). |
| `meta` | object | no | Arbitrary key-value metadata. Surfaces in the side-panel Integration zone and the event log. |
| `source` | string | no | Producer identifier; used for toast titles, event log filtering, and connection tracking. Strongly recommended. |

Full TypeScript contract:

```typescript
import type { IntegrationEvent } from "@roadraven/core";
// IntegrationEvent = { nodeId: string; status: string; meta?: Record<string, unknown>; source?: string }
```

> Install `@roadraven/core` to import the contract type into your producer:
> `npm install @roadraven/core`

## Discovering the URL

When RoadRaven boots, it writes a sentinel file at `<userData>/event-api.json`:

```json
{
  "port": 47921,
  "url": "ws://127.0.0.1:47921",
  "startedAt": "2026-05-03T18:00:00.000Z",
  "pid": 12345
}
```

Where `<userData>` is the Electrobun user-data directory:

| Platform | Path |
|----------|------|
| Linux | `~/.config/RoadRaven` |
| Windows | `%APPDATA%\RoadRaven` |
| macOS (post v1.1) | `~/Library/Application Support/RoadRaven` |

The file is removed on clean shutdown. If it's missing, the app is not running
(or crashed without cleanup — your producer should treat that as "app not
running" and surface a clear error).

> **Race condition:** if your producer starts before the app has bound the
> server, the file may not exist yet. Retry with backoff (the claude-code
> wrapper retries 6 times, 500ms apart, ~3s total).

## Worked example: walking through `plugins/claude-code/`

The Claude Code MCP wrapper is the reference Event Producer. Its source is
[on GitHub](https://github.com/Shuffzord/RoadRaven/tree/master/plugins/claude-code).
Here are the key pieces in walking order.

### 1. Sentinel file resolution (`src/sentinel.ts`)

Reads `<userData>/event-api.json` with retries to handle the race when the
app is starting up. Returns `{ ok: true, url, port, pid, startedAt }` or
`{ ok: false, error }` if the file is missing, unparseable, or the recorded
PID is no longer alive.

```typescript
const DEFAULT_RETRY_MS = 500;
const DEFAULT_MAX_ATTEMPTS = 6; // 3s total

for (let i = 0; i < maxAttempts; i++) {
  try {
    const raw = await readFile(getSentinelPath(), "utf-8");
    const parsed = JSON.parse(raw) as SentinelData;
    if (!isPidAlive(parsed.pid)) {
      return { ok: false, error: ERROR_NOT_RUNNING };
    }
    return { ok: true, ...parsed };
  } catch {
    if (i < maxAttempts - 1) await new Promise((r) => setTimeout(r, retryMs));
  }
}
```

Key idea: `<userData>` resolution is platform-aware (`os.homedir()` + a
per-OS subpath; see `src/userData.ts` in the wrapper). The PID liveness probe
uses `process.kill(pid, 0)` so an orphaned sentinel from a crashed previous
session is treated as "not running" rather than "ready to connect."

### 2. WebSocket client (`src/wsClient.ts`)

Opens the WebSocket to the URL from the sentinel, handles disconnects with
exponential backoff (capped at 30 seconds, with a small jitter). Sends a
"hello" frame on connect so the app's connection-tracking pill shows the
producer name + version.

```typescript
export const RECONNECT_DELAYS_MS = [500, 1000, 2000, 4000, 8000, 16000, 30000];

socket.addEventListener("open", () => {
  ws = socket;
  connected = true;
  attempt = 0;
  socket.send(
    `{"type":"hello","source":${JSON.stringify(opts.source)},"version":${JSON.stringify(opts.version)}}`,
  );
  resolve(true);
});
```

Key idea: the producer owns the connection lifecycle. The app is purely
passive — it accepts whatever frames you send and validates against the
contract. Reconnect on connection loss; do not queue events while
disconnected (per Phase 4 D-28 — queueing is a v1.1 plugin-system concern).

### 3. MCP server (`src/server.ts`)

Exposes two MCP tools to Claude Code (or any MCP host):

- `updateNodeStatus({ nodeId, status, meta? })` — push an event over the WebSocket
- `getEventApiStatus()` — introspect the sentinel file for diagnostics

Tool calls map almost 1:1 to event frames. The wrapper validates inputs with
Zod (re-using `@roadraven/core` schemas) before pushing:

```typescript
server.registerTool("updateNodeStatus", {
  inputSchema: z.object({
    nodeId: z.string().min(1),
    status: z.string().min(1),
    meta: z.record(z.string(), z.unknown()).optional(),
  }),
}, async ({ nodeId, status, meta }) => {
  await wsClient.send({ nodeId, status, meta });
  return { content: [{ type: "text", text: "ok" }] };
});
```

### 4. Entry point (`src/index.ts`)

Wires the StdioServerTransport (Claude's stdin/stdout protocol) to the MCP
server. The published binary `roadraven-mcp` is just `bun build`'s output of
this file with a `#!/usr/bin/env node` shebang. The whole entry file is two
lines:

```typescript
#!/usr/bin/env node
import "./server";
```

### Fork as a template

To build your own producer:

1. Copy the `sentinel.ts` + `wsClient.ts` modules
   — they're general-purpose
2. Replace `src/server.ts` with whatever entry surface your producer needs
   (a CLI flag, an HTTP webhook handler, a polling loop, etc.)
3. Use `@roadraven/core` for `IntegrationEvent` typing and Zod validation
4. Set a unique `source` field so the user can filter your events in the log

## Errors

The app surfaces four error categories as non-blocking toasts (per Phase 4
D-22, D-23). All errors also land in `.events.jsonl` (a sidecar file next to
the source roadmap) with an `_error` field for the in-app event log.

| Condition | Toast | Log marker |
|-----------|-------|------------|
| Bad JSON / missing required field | `Invalid event from [source]. See event log.` | `_error: "malformed"` |
| `nodeId` not in the loaded roadmap | `Event for unknown node from [source].` | `_error: "unknown_node"` |
| `status` not in the loaded `statusConfig` | `Unknown status '[s]' from [source].` | `_error: "invalid_status"` |
| Producer disconnect (abnormal close) | `Producer [source] disconnected.` | (no log entry; connection-only) |

Toasts of the same type from the same `source` within 5s are merged into one
counted toast. The underlying events all land in `.events.jsonl` individually.

No "retry" button — producers own their own retry / reconnect logic (per
D-22). Dismiss is the only user-side action.

## Reconnection strategy

Recommended pattern (matches `plugins/claude-code/src/wsClient.ts`):

- On connection loss, wait `min(initial * 2^attempts, cap)` ms before retrying
- Initial backoff: 500ms
- Cap: 30 seconds
- Reset attempts counter on successful connect
- Add a small jitter (~200ms) to avoid thundering-herd reconnects

Do NOT queue events while disconnected. If a status change happens during a
disconnect, push it as a fresh event on reconnect; lossy delivery is
acceptable for the v1.0 model (the source roadmap remains the authoritative
state, events are progressive overlays).

## What's NOT in v1

- The schema fields `plugin` and `subscribe` on each node are **parsed but not
  acted on** in v1.0. Reserved for v1.1's smart-adapter plugin system. Do not
  depend on them.
- The full `RoadmapPlugin` interface (with `connect()`, `disconnect()`,
  `on()`, `off()` lifecycle hooks) is defined in
  [`packages/core/src/plugin.ts`](https://github.com/Shuffzord/RoadRaven/blob/master/packages/core/src/plugin.ts)
  for forward compatibility but is not yet wired. v1.1 will add the plugin
  host that calls these methods.
- Authentication / token-gated handshake — none in v1.0; the localhost-only
  WebSocket binding is the trust boundary. v1.1 plugin secrets story
  will introduce an auth model.
- Event queueing across disconnects — producer responsibility for v1.0; v1.1
  plugin host may offer a coordinated buffer.

## Quick reference

- **Contract:** `IntegrationEvent` in `@roadraven/core`
- **Sentinel file:** `<userData>/event-api.json` (`<userData>` per OS — see above)
- **Default port:** 47921 (with auto-fallback `+1..+9`)
- **Reference producer:** `@roadraven/plugin-claude-code`
   — install `npx -y @roadraven/plugin-claude-code` or fork from
   [`plugins/claude-code/`](https://github.com/Shuffzord/RoadRaven/tree/master/plugins/claude-code)
- **App-side architecture:** see [Architecture Overview](architecture-overview.html)
   and [RPC and IPC](rpc-and-ipc.html) for how events flow from WS → Bun
   process → webview store → React render
