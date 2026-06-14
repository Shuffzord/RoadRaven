---
title: Event API Plugin Authoring
nav_order: 7
layout: default
---

# Writing an Event Producer for RoadRaven

> **Scope:** This guide covers the current **Event API** — how external tools
> push live status updates into a running RoadRaven app. The full smart-adapter
> plugin system is planned for a future release; do not depend on the `plugin` /
> `subscribe` JSON fields today — they are parsed but not acted on.

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

> Install `@roadraven/core` to import the contract type: `bun add @roadraven/core`
> (not published yet — for now, build from source; see the repo's `plugins/claude-code/`).

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
| macOS (planned) | `~/Library/Application Support/RoadRaven` |

The file is removed on clean shutdown. If it's missing, the app is not running
(or crashed without cleanup — your producer should treat that as "app not
running" and surface a clear error).

> **Race condition:** if your producer starts before the app has bound the
> server, the file may not exist yet. Retry with backoff (the claude-code
> wrapper retries 6 times, 500ms apart, ~3s total).

## Worked example: walking through `plugins/claude-code/`

The Claude Code MCP wrapper is the reference Event Producer
([source on GitHub](https://github.com/Shuffzord/RoadRaven/tree/master/plugins/claude-code)).
Four pieces, in walking order:

**1. Sentinel file resolution (`src/sentinel.ts`).** Reads
`<userData>/event-api.json` with retries to handle the startup race. Returns
`{ ok: true, url, port, pid, startedAt }` or `{ ok: false, error }` if the file
is missing, unparseable, or the recorded PID is no longer alive. `<userData>`
resolution is platform-aware (`os.homedir()` + a per-OS subpath; see
`src/userData.ts`). The PID liveness probe uses `process.kill(pid, 0)` so an
orphaned sentinel from a crashed session is treated as "not running" rather than
"ready to connect."

**2. WebSocket client (`src/wsClient.ts`).** Opens the WebSocket to the sentinel
URL, handles disconnects with exponential backoff (capped at 30s, with jitter),
and sends a "hello" frame on connect so the app's connection pill shows the
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

The producer owns the connection lifecycle. The app is purely passive — it
accepts whatever frames you send and validates against the contract. Reconnect
on connection loss; do not queue events while disconnected.

**3. MCP server (`src/server.ts`).** Exposes two MCP tools to Claude Code (or any
MCP host): `updateNodeStatus({ nodeId, status, meta? })` pushes an event over the
WebSocket, and `getEventApiStatus()` introspects the sentinel file for
diagnostics. Tool calls map almost 1:1 to event frames; inputs are validated
with Zod (re-using `@roadraven/core` schemas) before pushing.

**4. Entry point (`src/index.ts`).** Wires the StdioServerTransport (Claude's
stdin/stdout protocol) to the MCP server. The published binary `roadraven-mcp`
is just `bun build`'s output of this file with a `#!/usr/bin/env node` shebang —
the entry file is two lines: a shebang and `import "./server"`.

### Fork as a template

1. Copy the `sentinel.ts` + `wsClient.ts` modules — they're general-purpose
2. Replace `src/server.ts` with whatever entry surface your producer needs
   (a CLI flag, an HTTP webhook handler, a polling loop, etc.)
3. Use `@roadraven/core` for `IntegrationEvent` typing and Zod validation
4. Set a unique `source` field so the user can filter your events in the log

## Errors

The app surfaces four error categories as non-blocking toasts. All errors also
land in `.events.jsonl` (a sidecar file next to the source roadmap) with an
`_error` field for the in-app event log.

| Condition | Toast | Log marker |
|-----------|-------|------------|
| Bad JSON / missing required field | `Invalid event from [source]. See event log.` | `_error: "malformed"` |
| `nodeId` not in the loaded roadmap | `Event for unknown node from [source].` | `_error: "unknown_node"` |
| `status` not in the loaded `statusConfig` | `Unknown status '[s]' from [source].` | `_error: "invalid_status"` |
| Producer disconnect (abnormal close) | `Producer [source] disconnected.` | (no log entry; connection-only) |

Toasts of the same type from the same `source` within 5s are merged into one
counted toast; the underlying events still land in `.events.jsonl` individually.
There is no "retry" button — producers own their own retry / reconnect logic.

## Reconnection strategy

Recommended pattern (matches `plugins/claude-code/src/wsClient.ts`):

- On connection loss, wait `min(initial * 2^attempts, cap)` ms before retrying
- Initial backoff: 500ms
- Cap: 30 seconds
- Reset attempts counter on successful connect
- Add a small jitter (~200ms) to avoid thundering-herd reconnects

Do NOT queue events while disconnected. If a status change happens during a
disconnect, push it as a fresh event on reconnect; lossy delivery is acceptable
(the source roadmap remains the authoritative state, events are progressive
overlays).

## Not yet implemented (planned)

- The schema fields `plugin` and `subscribe` on each node are **parsed but not
  acted on today**. Reserved for the smart-adapter plugin system. Do not depend
  on them.
- The full `RoadmapPlugin` interface (with `connect()`, `disconnect()`, `on()`,
  `off()` lifecycle hooks) is defined in
  [`packages/core/src/plugin.ts`](https://github.com/Shuffzord/RoadRaven/blob/master/packages/core/src/plugin.ts)
  for forward compatibility but is not yet wired. A future release will add the
  plugin host that calls these methods.
- Authentication / token-gated handshake — none today; the localhost-only
  WebSocket binding is the trust boundary. A future plugin-secrets story will
  introduce an auth model.
- Event queueing across disconnects — producer responsibility for now; a future
  plugin host may offer a coordinated buffer.

## Quick reference

- **Contract:** `IntegrationEvent` in `@roadraven/core`
- **Sentinel file:** `<userData>/event-api.json` (`<userData>` per OS — see above)
- **Default port:** 47921 (with auto-fallback `+1..+9`)
- **Reference producer:** `@roadraven/plugin-claude-code`
   — run `bunx @roadraven/plugin-claude-code` or fork from
   [`plugins/claude-code/`](https://github.com/Shuffzord/RoadRaven/tree/master/plugins/claude-code)
- **App-side architecture:** see [Architecture Overview](architecture-overview.md)
   and [RPC and IPC](rpc-and-ipc.md) for how events flow from WS → Bun
   process → webview store → React render
