# Phase 4: Event API — Research

**Researched:** 2026-04-23
**Domain:** Bun WebSocket server + cross-process event routing + MCP wrapper
**Confidence:** HIGH (all critical claims verified via official docs + npm registry)

---

## User Constraints (from CONTEXT.md)

Phase 4 arrives with a heavily pre-decided design (`04-CONTEXT.md` D-01..D-29 and the UI-SPEC). The planner MUST treat these as locked; this research exists only to fill in the Claude's-discretion surface (WebSocket library call shape, virtualization lib, MCP SDK, debounce algorithm, test fixture strategy) and to surface pitfalls that could trip implementation. Nothing below re-litigates D-01..D-29.

### Locked Decisions (verbatim headings from CONTEXT.md)

- **D-01/D-02 — Port config:** default `47921`, `+1..+9` fallback for default only; env `ROADRAVEN_EVENT_PORT` > `.roadmap-settings.json → eventApi.port` > 47921; user-specified port in use → toast + leave server down.
- **D-03 — No auth in v1.** `127.0.0.1`-only binding is the boundary.
- **D-04/D-05 — Sentinel file** at `<userData>/event-api.json` with `{ port, url, startedAt, pid }`, atomic write, removed on clean shutdown.
- **D-06/D-07 — Status-bar pill + welcome-screen URL** states per UI-SPEC.
- **D-08..D-13 — Ephemeral-in-source, persistent-in-sidecar.** Single `.events.jsonl` per main file; source never mutated.
- **D-14/D-15 — 30s pulse window**, CSS `data-live="true"`, reduced-motion respected.
- **D-16/D-17 — SidePanel Integration zone** content; producer count in pill only.
- **D-18..D-21 — Bottom drawer**, `Ctrl+Shift+L`, virtualized rows, filter bar.
- **D-22..D-24 — Dismiss-only toasts** (no retry), 5 s same-type+same-source merge.
- **D-25 — Bun-side 100 ms debounce**, per-node last-write-wins, single batch `pushStatusUpdate`. RPC contract addition required.
- **D-26 — `plugin`/`subscribe`** stay `z.unknown().optional()`.
- **D-27..D-29 — MCP wrapper** at `plugins/claude-code/`, auto-discovers via sentinel, fails fast when app offline.

### Claude's Discretion (answered in this research)

- Exact `Bun.serve` WebSocket call shape → **Section 1**
- 100 ms debounce mechanism → **Section 3**
- Virtualization library for drawer → **Section 5**
- MCP SDK + tool naming + reconnect strategy → **Section 6**
- Test fixture strategy → **Section 7**
- Handshake "hello" frame value-add → **Section 1**
- Sentinel file resolver in MCP wrapper → **Section 6**

### Deferred Ideas (OUT OF SCOPE — from CONTEXT.md `<deferred>`)

- Log compaction / rotation for `.events.jsonl`
- Token-gated WS handshake (v1.1 plugin secrets)
- Schema-declared `liveStateRef` per node (v1.1)
- "Retry event" semantics / producer queueing when app offline
- Free-text meta search in drawer
- "Follow source" drawer auto-scroll
- Multi-file sidecar co-location across `$ref`
- Orphaned sentinel file cleanup on crash

---

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PLUG-01 | WS server starts with the app on configurable port, always available while app is running | §1 lifecycle, §2 validation, §4 sidecar |
| PLUG-02 | Event contract `{ nodeId, status, meta?, source? }` documented; status must match `statusConfig` or be dropped with warning in log | §2 validation (unknown status → `_error: "invalid_status"`) |
| PLUG-03 | Events routed within 100 ms with Bun-side debounce batching | §3 debounce design (per-node coalesce + trailing-edge 100 ms flush) |
| PLUG-04 | Pulse indicator on nodes receiving live events | §4 sidecar hydrate feeds `liveEventMeta` store; UI-SPEC owns the CSS |
| PLUG-05 | Side panel Integration zone: connection status + last event + meta key-value | §4 hydrate emits `liveEventMeta` keyed by nodeId (no custom injection per D-26) |
| PLUG-06 | Connection drops + malformed events surface as toasts (dismiss-only per D-22) | §2 error classification + §1 close-code semantics |
| PLUG-07 | In-app event log shows all received events with full detail | §4 sidecar = source of truth; `pushEventLog` for in-session rows |
| PLUG-08 | Claude Code MCP wrapper in `plugins/claude-code/`, WS client, pushes events | §6 MCP SDK, tool shape, sentinel resolver, reconnect |
| PLUG-09 | `plugin` / `subscribe` blocks parsed but not acted on; unknown `plugin.id` accepted silently | No new research — schema already permissive (`packages/core/src/schema.ts:44-45`) |

---

## Executive Summary

Phase 4 has one production technical decision: **use `Bun.serve`'s built-in WebSocket support, with a `fetch` that calls `server.upgrade(req)` and a `websocket` handler block.** Everything else is wiring around that: a sentinel file at `<userData>/event-api.json` written through `atomicWrite.ts`, a per-node last-write-wins debounce Map flushed on a trailing-edge 100 ms timer, an append-only `.events.jsonl` sidecar next to the source file written via `fs/promises.appendFile` (O_APPEND is atomic for sub-PIPE_BUF lines — safe for our ~400 B events), a Zod boundary schema that classifies malformed / unknown-node / unknown-status into the D-23 toast map while still landing every event in the log with an `_error` field, and a renderer-pushed allow-list of valid `nodeIds` + `statusConfig.id`s so the Bun process can validate without re-parsing the source file. For the UI, `@tanstack/react-virtual@3.13.24` over `react-window` — the drawer needs dynamic-height rows (meta preview expansion) which `react-window` v2 does not support cleanly. For the MCP wrapper, `@modelcontextprotocol/sdk@1.29.0` with `StdioServerTransport` and one tool `updateNodeStatus({ nodeId, status, meta? })` plus a read-only companion `getEventApiStatus()` for discovery diagnostics. Reconnect via exponential backoff capped at 30 s; sentinel file resolved from the OS-native user-data dir matching the existing `settings.ts` convention (Windows `LOCALAPPDATA/RoadRaven`, macOS `~/Library/Application Support/RoadRaven`, Linux `XDG_CONFIG_HOME/RoadRaven`). Test strategy: unit tests for schema/classifier, fake-timer tests for the debounce reducer, integration test with a WS loopback client + server in the same Vitest process, and an end-to-end smoke test that spawns the built Bun entry as a subprocess — no Electrobun window required.

---

## 1. WebSocket Lifecycle in Bun

### 1.1 Canonical `Bun.serve` shape

Verified from the Bun docs (<https://bun.com/docs/runtime/http/websockets>, pulled 2026-04-23):

```ts
import type { Server, ServerWebSocket } from "bun";

type WsData = {
  source?: string;      // from hello frame, populated on "hello" message
  version?: string;
  connectedAt: number;  // epoch ms, set at upgrade time
  id: string;           // crypto.randomUUID — used for close-log correlation
};

let server: Server | null = null;

function start(port: number): Server {
  return Bun.serve<WsData, undefined>({
    hostname: "127.0.0.1",
    port,
    fetch(req, server) {
      // Reject non-WS HTTP: the Event API exposes WS only. A GET to the
      // root returns a small JSON discovery blob so curl can smoke-test.
      if (new URL(req.url).pathname === "/" && req.method === "GET" &&
          req.headers.get("upgrade") !== "websocket") {
        return Response.json({ service: "roadraven-event-api", ok: true });
      }
      const ok = server.upgrade(req, {
        data: { connectedAt: Date.now(), id: crypto.randomUUID() },
      });
      if (ok) return; // upgrade consumed the response
      return new Response("Upgrade required", { status: 426 });
    },
    websocket: {
      open(ws) { /* roadraven.events.server: connection opened, ws.data.id */ },
      message(ws, raw) { /* parse + classify + buffer — §2, §3 */ },
      close(ws, code, reason) { /* emit producer-disconnected toast once */ },
      drain(_ws) { /* backpressure — noop for v1 */ },
    },
  });
}
```

**`[VERIFIED: bun.com/docs/runtime/http/websockets]`** — upgrade pattern, websocket handler block, `server.upgrade(req, { data })` contextual data, generic types.

### 1.2 Graceful close sequence

- `server.stop()` — stops accepting new connections, lets in-flight finish. Returns a Promise that resolves when the socket is closed. **`[VERIFIED: bun.com/docs/runtime/http/server]`**
- `server.stop(true)` — force stop, closes active connections immediately.

**Recommended sequence in `before-quit` and SIGTERM/SIGINT handlers**:

1. Log intent (`roadraven.events.server`: "shutdown initiated").
2. Broadcast a soft-shutdown frame to all clients so MCP wrappers see a clean `1001 Going Away` code and don't reconnect. Bun supports `ServerWebSocket.close(code, reason)` per connection; iterate via a local `Set<ServerWebSocket>` the `open`/`close` handlers maintain. Close code `1001` is the standard "Going Away" signal. **`[VERIFIED: oneuptime.com/blog/.../websocket-graceful-shutdown]`**
3. `await server.stop()` (graceful) with a 500 ms timeout; if the promise hasn't resolved, `await server.stop(true)` to force-close.
4. Delete the sentinel file (best-effort — if SIGKILL hit us we never get here; see §1.4).
5. Return control to the existing `flushPending()` chain in `bun/index.ts`.

**Integration with existing hooks** (`packages/desktop/src/bun/index.ts:108-124`): the before-quit and SIG* paths already `await flushPending()`. Add a second `await eventServer.stop()` call sequenced **before** flushPending — WS shutdown should not interfere with schema save, and the WS teardown is typically sub-100 ms. Using the same "await in both handlers" discipline established in CR-01 keeps SIGINT safe.

### 1.3 Port selection & collision handling

Bun surfaces `EADDRINUSE` as a thrown error from `Bun.serve` when the port is taken. Pattern:

```ts
async function bindWithFallback(requested: number, isUserSpecified: boolean): Promise<{ server: Server; port: number } | { error: "in_use" }> {
  const candidates = isUserSpecified ? [requested] : Array.from({ length: 10 }, (_, i) => requested + i);
  for (const port of candidates) {
    try {
      const server = Bun.serve<WsData, undefined>({ ...config, port });
      return { server, port };
    } catch (err) {
      if ((err as NodeJS.ErrnoException)?.code === "EADDRINUSE") continue;
      throw err;
    }
  }
  return { error: "in_use" };
}
```

- **D-01 fallback:** scan `47921..47930`, accept the first that binds.
- **D-02 user-specified port:** single attempt, no fallback; on `EADDRINUSE` return `{ error: "in_use" }`, push `eventApiStore.status = "error"`, emit the `Port :XXXX in use` pill (UI-SPEC color state) and surface a non-blocking toast `"Port XXXX is in use. Change ROADRAVEN_EVENT_PORT or eventApi.port in settings."`. No auto-fallback.

**`[ASSUMED]`** — Bun throws a synchronous `EADDRINUSE` from `Bun.serve`. The docs don't explicitly document the error shape; this matches Node's `net`/`http` behaviour and is the pattern in community examples. Planner should add a defensive `try`/`catch` around `Bun.serve` and log whatever gets thrown in the `in_use` path so we catch any divergence in vitest integration tests.

### 1.4 Sentinel file lifecycle

Three exit paths to handle:

| Exit path | Sentinel cleanup possible? | Strategy |
|-----------|---------------------------|----------|
| `before-quit` (normal) | Yes — synchronous `unlinkSync` in handler | Best case; delete before `process.exit(0)`. |
| SIGTERM / SIGINT | Yes — same as above, handlers are registered (`bun/index.ts:117-124`) | Delete in same awaited path as `server.stop()`. |
| SIGKILL / crash / power loss | **No** — OS kills us immediately | Orphaned sentinel remains. CONTEXT `<deferred>` accepts this; MCP wrapper mitigates by checking `pid` liveness (see §6.5). |

**Atomic write** for initial sentinel creation: reuse `atomicWrite.ts` (`packages/desktop/src/bun/atomicWrite.ts`) — writes via `.tmp` then rename. On Windows this also covers the antivirus EPERM race the atomicWrite module already handles.

**Path resolution for `<userData>`:** the codebase already has `getSettingsDirectory()` in `packages/desktop/src/bun/settings.ts:7-22` returning platform-correct dirs. Phase 4 should **reuse this function verbatim** (or export it as `getUserDataDir()`). Electrobun ≤1.16.0 does not expose a `userData` API directly; the manual platform-switch is the established project pattern.

### 1.5 Hello frame — recommendation: **required**

CONTEXT.md calls the hello frame "recommended but not contract-mandated." Upgrade this to **required for producer identity**:

```json
// First frame a client must send after connect:
{ "type": "hello", "source": "claude-code", "version": "0.1.0" }
```

**Rationale:**
- The `source` field on subsequent events becomes optional if the server has a per-connection default from `hello` (nicer DX for the MCP wrapper — it doesn't have to stamp `source` on every call). The event-level `source` still wins if present.
- The disconnect toast D-23 needs a `source` to name the producer; the hello frame guarantees we have one.
- If no hello frame arrives within 2 s (grace), the server still accepts event frames but stamps `source: "unknown"` in the log.

Frame is a plain JSON message with `type` as the discriminant; **event frames should omit `type`** (or use `type: "event"`) to keep the primary contract `{ nodeId, status, meta?, source? }` unchanged. Planner decides final shape; recommend discriminated union `{ type: "hello", ... } | { nodeId, status, ... }`.

---

## 2. Event Contract Validation Strategy

### 2.1 Zod schema at the Bun boundary

```ts
// packages/desktop/src/bun/eventSchema.ts — new file, Phase 4
import { z } from "zod";

export const HelloFrameSchema = z.object({
  type: z.literal("hello"),
  source: z.string().min(1).max(64),
  version: z.string().optional(),
});

export const EventFrameSchema = z.object({
  nodeId: z.string().min(1),           // keep permissive: NOT .uuid() —
                                       // producers may use short IDs in dev
  status: z.string().min(1).max(64),
  meta: z.record(z.string(), z.unknown()).optional(),
  source: z.string().max(64).optional(),
});

export const IncomingFrameSchema = z.union([HelloFrameSchema, EventFrameSchema]);
```

**Rationale for `nodeId: z.string().min(1)` (NOT `.uuid()`):** our source schema requires UUIDs (`RoadmapNodeSchema.id: z.string().uuid()`), but at the event boundary we classify mismatches as **`unknown_node`** rather than **malformed** — that's a better UX signal ("your ID doesn't match a node" vs "your payload is structurally broken"). Strict UUID validation at the boundary would collapse the two error types.

### 2.2 Error classification — the three D-23 failure paths

| Failure | Trigger | `_error` field in `.events.jsonl` | Toast copy |
|---------|---------|-----------------------------------|------------|
| Malformed | `JSON.parse` throws OR Zod `safeParse` fails | `"malformed"` | `Invalid event from {source}.` |
| Unknown nodeId | Zod passes but `nodeId` not in `nodeIndex` allow-list | `"unknown_node"` | `Event for unknown node from {source}.` |
| Invalid status | Zod passes, nodeId valid, but `status` not in `statusConfig.id` allow-list | `"invalid_status"` | `Unknown status '{s}' from {source}.` |

**All three still write to `.events.jsonl`** (D-09): the log is a complete audit trail. Toasts throttle per D-24; log entries never throttle.

### 2.3 How does the Bun process know which nodeIds/statuses are valid?

This is the research gap. Two candidate designs:

**Option A (recommended): renderer pushes an allow-list on load / change.**
- On schema load/reload, renderer sends `setNodeAllowlist({ nodeIds: string[], statusIds: string[] })` via RPC.
- Same payload re-sent on structural mutations (add/delete — hooked into `bumpStructural()` in `roadmapStore.ts:318`).
- Bun process holds a `Set<string>` for O(1) lookup.
- Pro: single source of truth (renderer already parses the schema). Cheap — the set rebuilds are O(n) and rare.
- Con: a fresh event received between Bun boot and first renderer load would be classified `unknown_node`. Mitigation: hold events in a brief startup queue OR accept this gap (ethically fine — no file loaded = no valid nodeIds).

**Option B: Bun re-parses the source file.**
- Bun already reads the source in `loadFile` (`bun/index.ts:143-280`); extract the `nodeIndex` there.
- Pro: no new RPC message.
- Con: duplicates schema-walking logic already in the renderer; diverges on every structural mutation unless Bun re-reads after each webview save; racy during autosave.

**Recommendation: Option A.** Add `setNodeAllowlist` to the Bun-side `messages` block (or as a request; either works — messages are simpler). Implementation location: extend `useRoadmapStore.subscribe` in `packages/desktop/src/mainview/rpc.ts` to push a fresh allow-list whenever `dataKey` changes (structural) OR `statusConfig` changes (handled by Phase 3 statusConfig editor, if any — otherwise static for the file's lifetime).

**RPC addition needed** in `shared/types.ts` (new bun-side message from webview, OR a webview→bun request — planner picks):

```ts
// Proposal 1: bun-side message from webview (matches existing pattern)
bun.messages.setNodeAllowlist: { nodeIds: string[]; statusIds: string[] }

// Proposal 2: bun-side request (cleaner lifecycle if we want a response)
bun.requests.setNodeAllowlist: {
  params: { nodeIds: string[]; statusIds: string[] };
  response: { ok: true };
}
```

The existing contract has no webview→bun messages (only requests), so Proposal 2 is more consistent. Planner decides.

### 2.4 The batch `pushStatusUpdate` shape (D-25)

Current shape (`shared/types.ts:116-120`):
```ts
pushStatusUpdate: { nodeId: string; status: string; meta?: Record<string, unknown> };
```

D-25 requires expanding to a batch:
```ts
pushStatusUpdate: {
  updates: Array<{
    nodeId: string;
    status: string;
    meta?: Record<string, unknown>;
    source?: string;
    lastEventAt: number;   // epoch ms, for the 30s pulse window
  }>;
}
```

**Migration path:** this is a breaking change to an interface currently implemented by stubs only (`rpc.ts:14-16` is a no-op). Safe to change without deprecation; no existing callers.

---

## 3. 100 ms Debounce Design

### 3.1 Candidate algorithms

| Design | Description | Trade-off |
|--------|-------------|-----------|
| **A. Fixed interval** | `setInterval(flush, 100)` — drain pending Map, always-on. | Simple. Adds 0..100 ms jitter on first event (worst case). Wastes CPU on idle. |
| **B. Trailing-edge re-armed** | On each event, insert into Map + `clearTimeout` + `setTimeout(flush, 100)` — flush when events stop arriving for 100 ms. | Zero CPU when idle. **BUT** under sustained traffic (>10 ev/s) never flushes — unacceptable for 100 ms routing budget. |
| **C. Fixed-interval timer started on first event, cleared on flush** | On first event: start `setTimeout(flush, 100)`. Every subsequent event within the window: coalesce into Map, don't touch the timer. Flush fires at fixed 100 ms after the **first** event in the batch, clears timer, waits for next event. | Bounded latency (≤100 ms from first event in a batch to flush). Zero CPU when idle. No pathological under-sustained-load behaviour. |

**Recommended: Design C (trailing-edge timer anchored at first event).**

### 3.2 Implementation sketch

```ts
// packages/desktop/src/bun/eventCoalescer.ts — new file
type Update = {
  nodeId: string;
  status: string;
  meta?: Record<string, unknown>;
  source?: string;
  lastEventAt: number;
};

export class EventCoalescer {
  private pending = new Map<string, Update>();  // keyed by nodeId — last write wins
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly flushMs: number,
    private readonly onFlush: (updates: Update[]) => void,
  ) {}

  enqueue(update: Update): void {
    this.pending.set(update.nodeId, update);     // coalesce — newest wins
    if (this.timer === null) {
      this.timer = setTimeout(() => this.flush(), this.flushMs);
    }
  }

  private flush(): void {
    this.timer = null;
    if (this.pending.size === 0) return;
    const updates = Array.from(this.pending.values());
    this.pending.clear();
    this.onFlush(updates);
  }

  /** Called from graceful shutdown; drains synchronously. */
  flushNow(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.flush();
  }
}
```

**Latency budget analysis (100 ms target, end-to-end):**
- Producer → Bun WS receive: typically <5 ms on localhost (no network, kernel loopback). `[ASSUMED]`
- Parse + validate: <1 ms for our payload size. `[ASSUMED]`
- Enqueue to pending Map: ~μs.
- Timer fires: 0–100 ms (timer anchored at first event).
- Flush → batched RPC send: <5 ms (Electrobun IPC on the same machine). `[ASSUMED]`
- React re-render: <10 ms for status-only update (Zustand shallow selector + no `dataKey` bump; confirmed by Phase 2 perf gate at 300 nodes).

**Worst case:** ~115 ms for an event that arrives just after a flush has cleared the timer — still within the PLUG-03 spec given that the 100 ms budget is **debounce**, not end-to-end. Planner should document the interpretation: the 100 ms is "from event receipt at server to next flush boundary," not "producer-to-paint."

### 3.3 Interaction with `.events.jsonl` append

**Critical:** the sidecar append must happen **on every event**, not on flush. If the app crashes mid-flush, we lose the batch's coalesced in-memory view but still have every raw event on disk for reconstruction on next load. Write first, then enqueue.

---

## 4. Sidecar Write Strategy

### 4.1 Append semantics — safety of `fs.appendFile`

**`[VERIFIED: bun.com/docs/guides/write-file/append + news.ycombinator.com/item?id=12220489]`**

- Bun implements `node:fs/promises.appendFile`, which uses the OS `O_APPEND` flag.
- POSIX guarantees writes ≤ `PIPE_BUF` (4 KB on Linux, 512 B on macOS — conservative: assume 512 B minimum) are atomic under `O_APPEND`.
- Windows: `FILE_APPEND_DATA` with `O_APPEND`-equivalent behaviour — writes are atomic at the OS level for the duration of the single write call.
- **Our event lines are ~200–400 B typical** (JSON with ISO timestamp, nodeId UUID, status slug, small meta). Far under 512 B. **Safe.**
- Concurrency within a single Bun process is serialised by the JS event loop; concurrency across processes is not a concern (only this app writes to this sidecar).

**Recommendation:** use `fs/promises.appendFile(path, line + "\n", "utf-8")` directly. Do NOT wrap in `atomicWrite.ts` — atomic-rename semantics are unnecessary for append-only and would destroy the log on rename failure.

**Edge case:** writes larger than 512 B. If a producer emits a 10 KB `meta` blob, POSIX atomicity guarantees no longer hold. Mitigation: cap `meta` serialized size at 8 KB at the boundary validation step; reject larger with `_error: "malformed"` + toast. Add to the Zod schema via `z.record(...).refine((v) => JSON.stringify(v).length < 8192)` or equivalent.

### 4.2 Line schema (exactly matches D-09)

```ts
interface EventLogLine {
  t: string;                             // ISO 8601 timestamp, e.g. "2026-04-23T14:30:00.123Z"
  nodeId: string;
  status: string;                        // raw status as received (even if unknown)
  source?: string;                       // from per-connection hello frame OR event-level override
  meta?: Record<string, unknown>;
  _error?: "malformed" | "unknown_node" | "invalid_status";
}
```

**Malformed case:** when JSON.parse fails, we can't extract `nodeId` — log a synthesised line `{ t, nodeId: "__malformed__", status: "__malformed__", source, _error: "malformed", meta: { raw: firstN_chars } }`. Keep the raw-payload excerpt capped at 200 chars to prevent log blow-up.

### 4.3 Replay / hydrate on file open

On `loadFile` completion in the Bun process, queue a hydrate step:

1. Read `.events.jsonl` next to the main file (existsSync check; absent file = no events).
2. Stream the file (`Bun.file(path).stream()` or line-by-line `readline`) — avoid loading 10 MB+ into memory on pathological growth.
3. Reduce to `Map<nodeId, { status, meta?, source?, lastEventAt }>` — last line per nodeId wins, errored entries (`_error` present) skipped for the overlay but counted for the drawer.
4. Send one `pushStatusUpdate` with the full batch (reuses the D-25 batched shape — no new RPC needed).
5. Separately send `pushEventLog` with the last N events (N = 1000, see §4.4) for the drawer's in-memory rows.

**Recommendation: no new RPC channel.** Reuse `pushStatusUpdate` for the overlay + `pushEventLog` (already defined in `shared/types.ts:121`) — the existing channel ships a single `IntegrationEvent`; extend to `pushEventLog: { events: IntegrationEvent[] }` so hydration is one message not N.

**Latency:** 10,000-line replay on localhost takes <100 ms in Bun's readline. `[ASSUMED — needs benchmark in integration test]` At 100 events/s sustained, 10 k lines = 100 s of agent work, a reasonable upper bound for single-session volumes.

### 4.4 Compaction threshold — for the planner to record (not implement in v1)

CONTEXT `<deferred>` defers compaction. For **when to revisit**:
- Rule of thumb: `.events.jsonl` > **1 MB** → expect replay latency > 50 ms.
- Rule of thumb: `.events.jsonl` > **10 MB** → expect replay latency > 500 ms, user-visible.
- Trigger in v1.1: on load, if file size > 10 MB, write a compaction candidate note to the log and show a one-shot toast ("Event log is {N} MB — consider archiving."). Do not auto-compact; it's a v1.1 feature.

Record the thresholds in the phase SUMMARY for milestone-end handoff.

### 4.5 In-memory drawer store bound (`eventLogStore.rows`)

Per UI-SPEC (`eventLogStore: rows: EventLogRow[] (capped sliding window, 1000 in-memory max)`): this is separate from the on-disk log. Drop-oldest when exceeded — do NOT clip the sidecar. Drawer shows what's in memory (post-load hydrate + live events); clicking a row jumps the tree. If the user wants historical events beyond the in-memory window, they open the `.events.jsonl` file in their editor (intentional — drawer is an attention layer, not a log viewer).

---

## 5. Virtualization Library for the Drawer

**Recommendation: `@tanstack/react-virtual@3.13.24`.**

### 5.1 Candidate evaluation

| Library | Current version | Bundle (min+gz) | Dynamic row height | Keyboard a11y support |
|---------|-----------------|-----------------|--------------------|-----------------------|
| `react-window` v2 | `2.2.7` `[VERIFIED: bun pm view 2026-04-23]` | ~2 KB | **No** — v2 removed `VariableSizeList`; v2 is fixed-size only in the stable API. `[CITED: github.com/bvaughn/react-window]` | Manual; consumer owns focus management |
| `@tanstack/react-virtual` v3 | `3.13.24` `[VERIFIED: bun pm view 2026-04-23]` | ~5 KB | **Yes** — built-in `measureElement` API for dynamic measurements | Headless (consumer owns DOM); works with `aria-rowcount` pattern |
| Bespoke (roll-thin) | n/a | ~500 B | Yes (our code) | Fully custom |

### 5.2 Why `@tanstack/react-virtual`

The UI-SPEC defines rows as 32 px fixed-height **plus** an expandable inline JSON block on row click (UI-SPEC §"Row layout"). That's dynamic-height — `react-window` v2 can't do it cleanly without manual height accounting. TanStack's `measureElement` handles it automatically.

Size delta: ~3 KB gzipped vs react-window. Negligible against our existing `react-d3-tree` + CodeMirror bundle.

DX wins:
- Headless API — no style collisions with our `--rv-*` token system.
- Works with Radix Dialog / plain `<aside>` — it doesn't own the scroll container, we do.
- TypeScript first-class; matches our `react-d3-tree` integration pattern.

### 5.3 Integration with Radix vs `<aside>`

UI-SPEC recommends `<aside role="region">` over Radix Dialog for the drawer (drawer is persistent chrome, not modal). `@tanstack/react-virtual` is agnostic — it attaches to any scroll container. Use a plain `<aside>`; avoid Dialog's focus trap which would grab Tab keys from the canvas.

**Install:**
```bash
bun add @tanstack/react-virtual
```

---

## 6. MCP Wrapper (`plugins/claude-code/`)

### 6.1 MCP SDK — package + version

- Package: **`@modelcontextprotocol/sdk`**
- Current version: **`1.29.0`** `[VERIFIED: bun pm view @modelcontextprotocol/sdk version, 2026-04-23]`
- License: MIT `[VERIFIED: github.com/modelcontextprotocol/typescript-sdk]`
- Peer dep: `zod` ≥ 3.25 (we use `zod@4.3.6` in `packages/desktop`; compatible). `[VERIFIED: npmjs.com/package/@modelcontextprotocol/sdk]`

### 6.2 Stdio server shape (canonical, verified)

```ts
// plugins/claude-code/src/server.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { connectToEventApi } from "./wsClient";

const server = new McpServer({
  name: "roadraven-claude-code",
  version: "0.1.0",
});

server.registerTool(
  "updateNodeStatus",
  {
    title: "Update RoadRaven node status",
    description:
      "Push a status update to a RoadRaven node. Requires the RoadRaven desktop app to be running.",
    inputSchema: z.object({
      nodeId: z.string().min(1).describe("The node UUID from the roadmap"),
      status: z
        .string()
        .min(1)
        .describe("Status id — must match one in the loaded schema's statusConfig"),
      meta: z
        .record(z.string(), z.unknown())
        .optional()
        .describe("Arbitrary key-value metadata, e.g. { branch, commit, ci_run_id }"),
    }),
  },
  async ({ nodeId, status, meta }) => {
    const result = await connectToEventApi();
    if (!result.ok) {
      return { content: [{ type: "text", text: result.error }], isError: true };
    }
    await result.client.send({ nodeId, status, meta, source: "claude-code" });
    return { content: [{ type: "text", text: "ok" }] };
  },
);

server.registerTool(
  "getEventApiStatus",
  {
    title: "Check RoadRaven Event API",
    description: "Returns the current Event API URL, PID, and startedAt — or an error if the app is not running.",
    inputSchema: z.object({}),
  },
  async () => {
    const result = await readSentinel();
    return { content: [{ type: "text", text: JSON.stringify(result) }] };
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
```

**`[VERIFIED: github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/server.md]`** — the `McpServer`, `registerTool`, `StdioServerTransport` APIs and the content-array return shape.

### 6.3 Tool naming recommendation

**Two tools:**

1. **`updateNodeStatus({ nodeId, status, meta? })`** — the only write. Intentionally narrow — one responsibility. Matches the event contract exactly. Claude invokes this to signal task state changes.
2. **`getEventApiStatus()`** — read-only diagnostic. Claude calls this when the first write fails to surface a clear error to the user (e.g., "The app isn't running; start it and retry").

**Intentionally NOT exposed:** `listNodes`, `getNode`, `readFile`. The MCP wrapper is write-only by design; reading the schema belongs in a v1.1 plugin that has proper auth + scope. Keep the surface tiny.

### 6.4 Sentinel-file resolver (cross-platform)

Follow the `settings.ts:7-22` pattern verbatim:

```ts
// plugins/claude-code/src/userData.ts
import { join } from "node:path";

export function getUserDataDir(): string {
  const home = process.env.HOME || process.env.USERPROFILE || "";
  if (process.platform === "win32") {
    return join(
      process.env.LOCALAPPDATA || join(home, "AppData", "Local"),
      "RoadRaven",
    );
  }
  if (process.platform === "darwin") {
    return join(home, "Library", "Application Support", "RoadRaven");
  }
  return join(
    process.env.XDG_CONFIG_HOME || join(home, ".config"),
    "RoadRaven",
  );
}

export function getSentinelPath(): string {
  return join(getUserDataDir(), "event-api.json");
}
```

**Race on fresh app start:** the MCP host (Claude Code) may spawn the wrapper before the user has the app open. Strategy:

```ts
async function readSentinel(opts?: { retryMs?: number; maxAttempts?: number }) {
  const retryMs = opts?.retryMs ?? 500;
  const maxAttempts = opts?.maxAttempts ?? 6;   // 3s total
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const raw = await Bun.file(getSentinelPath()).text();  // Bun runtime, OR fs/promises.readFile for Node
      const parsed = JSON.parse(raw) as { port: number; url: string; pid: number; startedAt: string };
      return { ok: true, ...parsed } as const;
    } catch {
      await new Promise((r) => setTimeout(r, retryMs));
    }
  }
  return { ok: false, error: "Roadmap Viewer is not running. Start the app and retry." } as const;
}
```

**`pid` liveness check (mitigates orphaned sentinels on crash):**
```ts
function isPidAlive(pid: number): boolean {
  try { process.kill(pid, 0); return true; }    // signal 0 = liveness probe, POSIX + Windows
  catch { return false; }
}
```
If the sentinel exists but `pid` is dead → treat as "not running," surface the same error.

### 6.5 WebSocket client + reconnect strategy

The MCP server process is long-lived (spawned once per Claude Code session). It should maintain a persistent WS connection and reconnect on drop.

**Exponential backoff with jitter, capped at 30 s:**

```ts
const delays = [500, 1000, 2000, 4000, 8000, 16000, 30000]; // ms
let attempt = 0;

async function connectLoop() {
  while (true) {
    try {
      const { url } = await readSentinel();
      const ws = new WebSocket(url);
      await new Promise<void>((resolve, reject) => {
        ws.addEventListener("open", () => resolve());
        ws.addEventListener("error", (e) => reject(e));
      });
      ws.send(JSON.stringify({ type: "hello", source: "claude-code", version: "0.1.0" }));
      attempt = 0;
      // ... handle close → reconnect
    } catch {
      const d = delays[Math.min(attempt++, delays.length - 1)];
      await new Promise((r) => setTimeout(r, d + Math.random() * 200));
    }
  }
}
```

**Important — D-28 constraint:** "MCP wrapper does not queue events when the app is offline." This means: if a tool call comes in while disconnected, fail the tool call immediately with the error message — don't buffer. The reconnect loop runs in parallel but doesn't replay failed tool calls.

### 6.6 Package shape

```json
// plugins/claude-code/package.json (fills the empty scaffold)
{
  "name": "@roadraven/plugin-claude-code",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "bin": {
    "roadraven-mcp": "./dist/index.js"
  },
  "scripts": {
    "build": "bun build src/index.ts --outdir dist --target node",
    "test": "vitest run"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.29.0",
    "zod": "^4.3.6"
  },
  "devDependencies": {
    "@types/bun": "latest",
    "typescript": "^6.0.2",
    "vitest": "^4.1.4"
  }
}
```

**Runtime target:** Node.js (not Bun) — Claude Code spawns MCP servers as child processes and expects a `bin` entry callable by `node` or by an executable binary. Bun's `bun build --target node` produces a bundled, Node-compatible JS file with a shebang, which is compatible with MCP hosts.

**`type: "module"` + `bin`:** ESM works with Claude Code's MCP launcher as long as the file has a shebang (`#!/usr/bin/env node` — `bun build` adds this).

**Reference spec URL:** <https://modelcontextprotocol.io/specification> (current as of 2026-04-23; link from the SDK README).

### 6.7 MCP wrapper error copy (from UI-SPEC)

Reuse the exact strings from UI-SPEC §"MCP wrapper error copy":
- Sentinel missing → `Roadmap Viewer is not running. Start the app and retry.`
- Sentinel present, WS connect fails → `Roadmap Viewer is running but the Event API is unreachable at {url}. Check the logs for startup errors.`
- Successful push → tool returns `ok` silently.

---

## 7. Testing Strategy

The two-process boundary makes a layered test pyramid cheap:

### 7.1 Unit tests (`packages/desktop/tests/unit/bun/`)

**New files the planner should create:**

| File | Covers | Technique |
|------|--------|-----------|
| `eventSchema.test.ts` | Zod boundary schema + error classification | Plain parse tests, no mocking |
| `eventCoalescer.test.ts` | Debounce Map + timer logic | `vi.useFakeTimers()` + `vi.advanceTimersByTime(100)`; pattern already used elsewhere in the repo per grep hit in `useAutosave.test.ts` |
| `eventsLog.test.ts` | Sidecar append + replay reducer | `tmpdir()` per test, real `fs.appendFile`, assert on file contents + reduced Map |
| `sentinel.test.ts` | Sentinel file write + delete + PID embed | `tmpdir()` + `atomicWrite` |
| `eventServer.test.ts` | Port-collision fallback, hello-frame grace window | Start real `Bun.serve` on port 0 (OS-picks), assert |

### 7.2 Integration test — in-process WS loopback (`tests/integration/`)

Launch a real `Bun.serve` in the Vitest process, connect via `new WebSocket(url)` from the same test, drive events, assert that the coalescer batches and flushes and that the RPC pusher receives the batch. No Electrobun window, no renderer — the renderer side is tested separately via store-action unit tests (`applyEventBatch`).

**Pattern:**
```ts
it("routes events within 100ms", async () => {
  const flushes: Update[][] = [];
  const server = await startEventServer({ port: 0, onFlush: (batch) => flushes.push(batch) });
  const ws = new WebSocket(`ws://127.0.0.1:${server.port}`);
  await waitForOpen(ws);
  ws.send(JSON.stringify({ type: "hello", source: "test", version: "1" }));
  ws.send(JSON.stringify({ nodeId: "n1", status: "in-progress" }));
  ws.send(JSON.stringify({ nodeId: "n1", status: "completed" }));  // coalesced
  await new Promise((r) => setTimeout(r, 150));
  expect(flushes).toHaveLength(1);
  expect(flushes[0]).toHaveLength(1);
  expect(flushes[0][0].status).toBe("completed");   // last-write-wins
  await server.stop();
});
```

### 7.3 E2E smoke — Bun subprocess + WS client (`tests/integration/eventApi-e2e.test.ts`)

```ts
it("10 events end up as 10 sidecar lines + N distinct nodeIds in the reducer", async () => {
  const sub = Bun.spawn(["bun", "run", "packages/desktop/src/bun/index.ts"], { env: { ROADRAVEN_EVENT_PORT: "0" } });
  // ... read the sentinel, connect, push 10 events, read the sidecar, assert
  sub.kill();
});
```

**Caveat:** this spawns Electrobun-adjacent code; the entry file boots a BrowserWindow. Use a trimmed-down entry `src/bun/eventServerStandalone.ts` for the E2E test that launches **only** the Event API server without a window. Add that standalone launcher as part of Plan 4-02 (WS server plan).

### 7.4 Renderer store tests (`packages/desktop/tests/unit/store/`)

- `roadmapStore.applyEventBatch.test.ts` — feed a batch of 5 updates, assert that all 5 nodes' statuses updated in-place, `dataKey` did NOT bump, `statusTick` incremented once (one set() call).
- `eventApiStore.test.ts` — transition machine (`off` → `listening` → `error` pill states).
- `eventLogStore.test.ts` — row window cap at 1000, filter-bar predicates.

### 7.5 HUMAN-UAT (manual)

Per the phase done-when criteria — documented for 04-HUMAN-UAT.md, not automated:
1. Start app → status-bar pill shows `● :47921` in UI-SPEC color state.
2. Copy URL via pill click → pasteboard contains `ws://127.0.0.1:47921`.
3. Open `plugins/claude-code/` in a Claude Code session → `updateNodeStatus` tool invokable; target node updates within perceived-instant.
4. `Ctrl+Shift+L` opens the drawer; events listed with correct columns.
5. Push a malformed event (ad-hoc `websocat` or `wscat` from terminal) → toast appears with correct copy, red-stripe row appears in drawer.
6. Kill the MCP client → producer-disconnect toast within ~1 s; pill reverts to `● :47921` (count back to 0).
7. Reopen the file → Integration zone shows last meta + "Last event 2m ago."

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.4 `[VERIFIED: package.json:devDependencies]` |
| Config file | `packages/desktop/vite.config.ts` (vitest config section) + root `package.json` scripts |
| Quick run command | `bun run test:desktop` |
| Full suite command | `bun run verify` (test + typecheck + build + lint) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| PLUG-01 | WS server starts on configurable port with app | integration | `bun run test:desktop tests/integration/eventApi.test.ts` | Wave 0 |
| PLUG-01 | Port collision fallback (default, `+1..+9`) | unit | `bun run test:desktop tests/unit/bun/eventServer.test.ts` | Wave 0 |
| PLUG-01 | User-specified port in use → error pill + toast | unit | same | Wave 0 |
| PLUG-01 | Sentinel file `<userData>/event-api.json` written atomically on bind, removed on clean shutdown | unit | `bun run test:desktop tests/unit/bun/sentinel.test.ts` | Wave 0 |
| PLUG-02 | Event contract shape validated by Zod schema at boundary | unit | `bun run test:desktop tests/unit/bun/eventSchema.test.ts` | Wave 0 |
| PLUG-02 | Status not in `statusConfig` dropped with `_error: "invalid_status"` log line | unit | same | Wave 0 |
| PLUG-03 | Events routed within 100 ms debounce window | integration | `bun run test:desktop tests/integration/eventApi.test.ts -t "routes events within 100ms"` | Wave 0 |
| PLUG-03 | Per-node last-write-wins coalesce | unit | `bun run test:desktop tests/unit/bun/eventCoalescer.test.ts` | Wave 0 |
| PLUG-03 | Single batched `pushStatusUpdate` per flush | unit | same | Wave 0 |
| PLUG-04 | `data-live="true"` set when `(now - lastEventAt) < 30s`, cleared on 1 Hz tick | unit | `bun run test:desktop tests/unit/store/roadmapStore.liveIndicator.test.ts` | Wave 0 |
| PLUG-04 | Pulse animation respects `prefers-reduced-motion` | manual | HUMAN-UAT §5 | HUMAN-UAT |
| PLUG-05 | Integration zone renders last meta + relative last-event time | unit | `bun run test:desktop tests/unit/ui/IntegrationZone.test.tsx` | Wave 0 |
| PLUG-06 | Malformed event → toast with correct copy (D-23 map) | unit | `bun run test:desktop tests/unit/ui/EventToast.test.tsx` | Wave 0 |
| PLUG-06 | Same-type+same-source within 5 s merged, count updates in place | unit | same | Wave 0 |
| PLUG-06 | Producer disconnect → info-style toast | integration | `bun run test:desktop tests/integration/eventApi.test.ts -t "disconnect"` | Wave 0 |
| PLUG-07 | Drawer `Ctrl+Shift+L` toggle | unit | `bun run test:desktop tests/unit/hooks/useKeyboardRouter.drawer.test.ts` | Wave 0 |
| PLUG-07 | Drawer virtualized rows render correctly at 1000 rows | unit | `bun run test:desktop tests/unit/ui/EventLogDrawer.test.tsx` | Wave 0 |
| PLUG-07 | Row click selects node + camera-follows | integration | `bun run test:desktop tests/integration/eventLog-selection.test.ts` | Wave 0 |
| PLUG-07 | Filter bar: source dropdown, selected-node toggle, status filter | unit | `bun run test:desktop tests/unit/ui/EventLogFilterBar.test.tsx` | Wave 0 |
| PLUG-08 | MCP wrapper builds + `bin` is shebang-executable | unit | `bun run test --cwd plugins/claude-code` | Wave 0 |
| PLUG-08 | Sentinel resolver returns correct path per platform | unit | `bun run test --cwd plugins/claude-code tests/userData.test.ts` | Wave 0 |
| PLUG-08 | Sentinel race: retries 6x over 3 s before error | unit | `bun run test --cwd plugins/claude-code tests/sentinel.test.ts` | Wave 0 |
| PLUG-08 | WS reconnect: exponential backoff capped at 30 s | unit | `bun run test --cwd plugins/claude-code tests/wsClient.test.ts` | Wave 0 |
| PLUG-08 | End-to-end: tool invocation updates node in app | manual | HUMAN-UAT §3 | HUMAN-UAT |
| PLUG-09 | Schema accepts `plugin` + `subscribe` as unknown without error | unit | existing `tests/unit/schema.test.ts` (extend) | Wave 0 |
| PLUG-09 | Unknown `plugin.id` accepted silently (no warning) | unit | same | Wave 0 |
| D-25 | `pushStatusUpdate` batched shape; `applyEventBatch` action is in-place (no `dataKey` bump) | unit | `bun run test:desktop tests/unit/store/roadmapStore.applyEventBatch.test.ts` | Wave 0 |
| D-24 | 5 s throttle merge in toast | unit | `tests/unit/ui/EventToast.test.tsx` (covered above) | Wave 0 |
| D-09 | All error paths land in `.events.jsonl` with `_error` field | unit | `bun run test:desktop tests/unit/bun/eventsLog.test.ts` | Wave 0 |
| D-10 | Replay on file open reduces to last-event-per-nodeId | unit | same | Wave 0 |

### Sampling Rate

- **Per task commit:** `bun run test:desktop` (desktop unit + integration — fast, ~5 s today)
- **Per wave merge:** `bun run verify` (full suite + typecheck + build + lint — already the project gate per CLAUDE.md)
- **Phase gate:** `bun run verify` green + HUMAN-UAT scoreboard passing

### Wave 0 Gaps

All Phase 4 test files are new. No framework changes required (Vitest already wired). Wave 0 scaffolding tasks:

- [ ] `packages/desktop/tests/unit/bun/eventSchema.test.ts`
- [ ] `packages/desktop/tests/unit/bun/eventCoalescer.test.ts`
- [ ] `packages/desktop/tests/unit/bun/eventsLog.test.ts`
- [ ] `packages/desktop/tests/unit/bun/sentinel.test.ts`
- [ ] `packages/desktop/tests/unit/bun/eventServer.test.ts`
- [ ] `packages/desktop/tests/integration/eventApi.test.ts`
- [ ] `packages/desktop/tests/integration/eventApi-e2e.test.ts` (needs standalone launcher — see §7.3)
- [ ] `packages/desktop/tests/unit/store/roadmapStore.applyEventBatch.test.ts`
- [ ] `packages/desktop/tests/unit/store/roadmapStore.liveIndicator.test.ts`
- [ ] `packages/desktop/tests/unit/store/eventApiStore.test.ts`
- [ ] `packages/desktop/tests/unit/store/eventLogStore.test.ts`
- [ ] `packages/desktop/tests/unit/ui/IntegrationZone.test.tsx`
- [ ] `packages/desktop/tests/unit/ui/EventToast.test.tsx`
- [ ] `packages/desktop/tests/unit/ui/EventLogDrawer.test.tsx`
- [ ] `packages/desktop/tests/unit/ui/EventLogFilterBar.test.tsx`
- [ ] `packages/desktop/tests/unit/hooks/useKeyboardRouter.drawer.test.ts`
- [ ] `packages/desktop/tests/integration/eventLog-selection.test.ts`
- [ ] `plugins/claude-code/tests/userData.test.ts`
- [ ] `plugins/claude-code/tests/sentinel.test.ts`
- [ ] `plugins/claude-code/tests/wsClient.test.ts`
- [ ] `plugins/claude-code/vitest.config.ts` (new — plugins workspace doesn't have one)

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| WebSocket server | `ws` package or custom framing | `Bun.serve` native WebSocket | Native, zero deps, 7× faster than Node+ws, and `server.upgrade` is idiomatic |
| MCP server scaffold | Hand-rolled JSON-RPC over stdio | `@modelcontextprotocol/sdk@^1.29.0` | Spec compliance is not free; stdio transport + tool registration is boilerplate |
| Virtualization | Manual `transform: translateY` + manual scrollspy | `@tanstack/react-virtual` | Dynamic row height, keyboard a11y, ~5 KB — you'd rebuild half of it poorly |
| Sentinel atomic write | Direct `writeFile` + manual rename | Existing `atomicWrite.ts` | Windows EPERM retry loop already battle-tested in Phase 3 |
| Platform user-data dir | New resolver | Export `getSettingsDirectory()` from `settings.ts` as `getUserDataDir()` | Already platform-correct; duplication risks divergence |
| Debounce | `lodash.debounce` | The `EventCoalescer` sketch in §3.2 | lodash.debounce doesn't coalesce per-key — we need a Map, not a single pending call |
| JSONL append | Custom flock file | `fs/promises.appendFile` with `O_APPEND` | POSIX O_APPEND is atomic for ≤PIPE_BUF writes — our lines are well under |
| Reconnect logic | New backoff lib | Inline the 6-step exponential sketch in §6.5 | ~20 lines; new dep not worth it |

---

## Common Pitfalls

### Pitfall 1: `Bun.serve` throws synchronously on `EADDRINUSE`
**What goes wrong:** the planner wraps `Bun.serve` in an async IIFE expecting a rejected promise; instead the synchronous throw bypasses the catch.
**How to avoid:** `try { Bun.serve(...) } catch (err) { ... }` — synchronous try/catch around the call site.
**Warning signs:** uncaught exception on app start with no log line before the crash.

### Pitfall 2: Sentinel file orphaned on crash
**What goes wrong:** SIGKILL / power loss leaves `event-api.json` pointing at a dead port; MCP wrapper connects and hangs or gets `ECONNREFUSED`.
**How to avoid:** MCP wrapper MUST `process.kill(pid, 0)` before trusting the sentinel; on dead PID, treat as "not running." Documented in §6.4.
**Warning signs:** MCP wrapper reports "app running" but tool calls hang.

### Pitfall 3: Bun-side lookup tables go stale after renderer structural mutation
**What goes wrong:** user adds a node in the editor (Phase 3); a concurrent event arrives; Bun's allow-list doesn't know about the new node → `_error: "unknown_node"`.
**How to avoid:** push `setNodeAllowlist` from renderer on every `dataKey` bump. Test: add a node in integration test, immediately push event, assert no error.
**Warning signs:** first event after a mutation lands in the error log.

### Pitfall 4: Debounce timer leaks on shutdown
**What goes wrong:** `setTimeout` is active when server stops; process hangs waiting for the timer or the callback fires after the store is torn down.
**How to avoid:** `EventCoalescer.flushNow()` MUST be called in the graceful-shutdown sequence BEFORE `server.stop()`. Clear the timer in the same call.
**Warning signs:** test teardown warnings about open handles; production: small ghost log write after "shutdown complete."

### Pitfall 5: `.events.jsonl` grows unbounded
**What goes wrong:** agent hammering 10 ev/s for a week → ~6 million lines. Replay takes 60 s. User thinks app is frozen.
**How to avoid:** on load, check file size; if > 10 MB, show info toast ("Event log is {N} MB — consider archiving.") and log a warning. Compaction itself is v1.1.
**Warning signs:** slow app startup on a file that used to load instantly.

### Pitfall 6: React re-render storm on burst events
**What goes wrong:** 100 events/s → 100 `statusTick` increments → 100 re-renders → frame drops.
**How to avoid:** batched `applyEventBatch` does ONE set() call per flush. Single statusTick bump per batch. Validate with a burst test feeding 100 events in 50 ms, assert only ≤1 statusTick bump.
**Warning signs:** dev tools profiler shows 100 React renders where 1 was expected.

### Pitfall 7: Focus trap in Radix Dialog eats Tab for the drawer
**What goes wrong:** if the drawer is a Radix Dialog, its focus trap steals Tab away from the canvas keyboard router; `Ctrl+Shift+L` opens the drawer, but now arrow keys don't navigate the tree anymore.
**How to avoid:** use a plain `<aside role="region">` per UI-SPEC recommendation; do NOT wrap in `Dialog.Root`. Drawer is persistent chrome, not modal.
**Warning signs:** user reports "keyboard stops working after I open events."

### Pitfall 8: MCP wrapper runs under `node` but imports Bun-specific APIs
**What goes wrong:** `Bun.file()` used in `readSentinel` → MCP wrapper crashes when Claude Code spawns it with `node`.
**How to avoid:** MCP wrapper MUST use `node:fs/promises` and `node:path` exclusively. Verify by grepping `Bun\.` in `plugins/claude-code/src/` — must yield zero hits.
**Warning signs:** wrapper works in local `bun run` tests but fails when Claude Code spawns it.

### Pitfall 9: `@tanstack/react-virtual` measurement recalculates on every parent re-render
**What goes wrong:** drawer's parent re-renders 60× when live events stream in → TanStack recalculates all row measurements → scroll jitter.
**How to avoid:** memoize the `getScrollElement` callback, stable ref for parent. Pattern documented in TanStack docs.
**Warning signs:** visible row-height jitter when new events arrive.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `ws` package in Node | `Bun.serve` native WebSocket | Bun 0.5+, stable since 1.0 | Our stack — no new dep |
| `react-window` VariableSizeList | `@tanstack/react-virtual` measureElement | `react-window` v2 removed variable size | TanStack is the default for dynamic rows |
| Hand-rolled MCP JSON-RPC | `@modelcontextprotocol/sdk` | Official SDK released 2024, v1.0 mid-2025 | We use the SDK — no hand-rolled |
| `fs.watch` on `.events.jsonl` for live feed | Direct push from Bun to webview via existing RPC | Native to our architecture | `fs.watch` would be double bookkeeping |

**Deprecated/outdated:**
- **`react-window@1.x`** — v2 is out but has a different API and removed `VariableSizeList`. For our use case (dynamic rows), skip straight to `@tanstack/react-virtual` rather than adopting v2 and working around the fixed-size constraint.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `Bun.serve` throws synchronously on `EADDRINUSE` (not a rejected promise) | §1.3 | Planner writes async error handling that never catches; first-run crash with no log. Mitigation: defensive try/catch both sync and async paths in Plan 4-02. |
| A2 | Loopback WS latency + Electrobun IPC together < 20 ms on a dev laptop | §3.2 | 100 ms budget is tight if true latency is higher. Mitigation: the integration test in §7.2 measures it — if fails, loosen debounce to 80 ms so worst-case total stays under 100 ms. |
| A3 | JSONL replay of 10 k lines < 100 ms via `readline` on a mid-range machine | §4.3 | Slow startup on a heavy user's file. Mitigation: §4.4 file-size threshold + info toast. Benchmark in Wave 0. |
| A4 | MCP hosts spawn wrappers via `node`, not Bun | §6.6 | Wrapper crashes on spawn if we use Bun APIs. Mitigation: grep-guard in CI (no `Bun.` in `plugins/claude-code/src/`). |
| A5 | `ws.data.source` per connection (set via hello frame) is adequate for D-23 toast copy even without event-level `source` | §1.5 | User sees `"from undefined"` in toast. Mitigation: the 2 s hello grace window is well within first-event UX; worst case, stamp `"unknown"`. |
| A6 | `@tanstack/react-virtual@3.13.24` measure-element works with a plain `<aside>` scroll container (non-Dialog) | §5.3 | Drawer scrolls jump. Low risk — TanStack is explicitly container-agnostic. |
| A7 | `process.kill(pid, 0)` works as a cross-platform liveness probe (POSIX + Windows via Node's implementation) | §6.4 | MCP wrapper trusts stale sentinel. `[CITED: nodejs.org/api/process.html#processkillpid-signal]` — Node docs confirm Windows emulates signal 0. Low risk. |

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Bun | WS server, build, tests | ✓ | Bun 1.x (project-pinned via electrobun 1.16.0) | — |
| Node.js | MCP wrapper runtime | ✓ | Must be on users' systems (Claude Code requires it) | — |
| `@modelcontextprotocol/sdk` | MCP wrapper | ✗ | `1.29.0` target | `bun add --cwd plugins/claude-code @modelcontextprotocol/sdk` in Plan 4 |
| `@tanstack/react-virtual` | Drawer | ✗ | `3.13.24` target | `bun add --cwd packages/desktop @tanstack/react-virtual` in Plan 4 |
| `zod` (peer dep of MCP SDK) | MCP wrapper | ✓ | `4.3.6` in desktop; need to add in plugins/claude-code | — |
| Vitest | Tests | ✓ | `4.1.4` | — |
| `wscat` / `websocat` | Manual UAT smoke testing | optional | — | HUMAN-UAT only; user may skip |

**Missing dependencies with fallback:** none — all installable from npm.
**Missing dependencies with no fallback:** none.

---

## Project Constraints (from CLAUDE.md)

Actionable directives the planner must honor verbatim:

- **Electrobun, NOT Electron.** No Electron APIs, patterns, or documentation citations.
- **Package manager:** `bun` and `bunx` only. Never `npm`, `npx`, `yarn`, `pnpm`.
- **Test invocation:** `bun run test`, `bun run test:desktop`, `bun run test:file <path>`. Never `bunx vitest` from workspace root (version-drift trap).
- **Lint:** `bunx @biomejs/biome lint packages/desktop/src/ shared/` (matches CI).
- **Verification gate:** `bun run verify` must be green before PR. That's `test + typecheck + build + lint`.
- **`dataKey` invariant:** status-only updates (Phase 4 event overlay) MUST NOT increment `dataKey`. Reuse the in-place mutation pattern from `updateNodeStatus` — bump `statusTick` only.
- **Logging:** all Phase 4 code uses LogTape under `roadraven.events.*` categories. Desktop webview: `uiLogger`/`storeLogger` or get a new one via `getLogger(["webview", "events", ...])`. Bun: new `getLogger(["bun", "events", ...])`.
- **No hardcoded colours.** All UI reads `--rv-*` tokens (THEME-05).
- **No `console.log` unless user explicitly requests.** Use LogTape.
- **Self-write suppression:** the existing file watcher excludes its own writes; `.events.jsonl` is written by the app but is NOT in the watcher scope — the watcher watches the `.json` source + `$ref` files only. Plan must confirm the sidecar is not accidentally watched.
- **CEF renderer:** the drawer / virtualization lib must work in CEF (Chromium). `@tanstack/react-virtual` supports all modern engines; no polyfills needed.

---

## Canonical References

**The planner MUST re-read these before writing plans:**

### Phase-local (authoritative)
- `.planning/phases/04-event-api/04-CONTEXT.md` — D-01..D-29, locked.
- `.planning/phases/04-event-api/04-UI-SPEC.md` — visual/interaction contract for pill, drawer, toasts, Integration zone, pulse.
- `.planning/REQUIREMENTS.md` §Event API (PLUG-01..PLUG-09) with scope note.
- `.planning/ROADMAP.md` §Phase 4 (goal, plans, done-when).
- `.planning/PROJECT.md` §Context + §Key Decisions (integration model v1 vs v1.1).

### In-repo files to re-read
- `shared/types.ts` — RPC contract; `pushStatusUpdate` expansion point at line 116.
- `packages/core/src/plugin.ts` — `IntegrationEvent` interface (event contract matches exactly).
- `packages/core/src/schema.ts` — `plugin`/`subscribe` `z.unknown()` (keep permissive).
- `packages/desktop/src/bun/index.ts` — before-quit + SIG* hooks at lines 108–124 where Event API server lifecycle plugs in.
- `packages/desktop/src/bun/atomicWrite.ts` — reuse for sentinel file.
- `packages/desktop/src/bun/settings.ts` — export `getSettingsDirectory` (rename/alias as `getUserDataDir`) for sentinel path.
- `packages/desktop/src/bun/logging.ts` / `packages/desktop/src/mainview/logging/logger.ts` — LogTape categories.
- `packages/desktop/src/mainview/store/roadmapStore.ts` — `updateNodeStatus` pattern at line 632; add `applyEventBatch`.
- `packages/desktop/src/mainview/rpc.ts` — current stubs for `pushStatusUpdate` and `pushEventLog` (lines 14–19); wire here.
- `packages/desktop/src/mainview/components/StatusBar.tsx` — replace static pill.
- `packages/desktop/src/mainview/components/SidePanel.tsx` — add Integration zone.
- `packages/desktop/src/mainview/components/TopBar.tsx` — add Events toggle button.
- `packages/desktop/src/mainview/hooks/useKeyboardRouter.ts` — add `Ctrl+Shift+L`.
- `packages/desktop/src/mainview/components/ExternalEditToast.tsx` — template for EventToast.
- `plugins/claude-code/package.json` — empty scaffold; fill in Plan 4-04.

### Phase 3 prior art (resilience + shutdown patterns)
- `.planning/phases/03-full-editor/03-04c-PLAN.md` — before-quit + SIGTERM flush pattern Phase 4 extends.

### External docs
- Bun WebSocket: <https://bun.com/docs/runtime/http/websockets> — upgrade handshake, handler block, contextual data.
- Bun Server: <https://bun.com/docs/runtime/http/server> — `server.stop()` graceful/force behaviour.
- Bun append: <https://bun.com/docs/guides/write-file/append> — `node:fs/promises.appendFile`.
- MCP TS SDK: <https://github.com/modelcontextprotocol/typescript-sdk> — package at `@modelcontextprotocol/sdk`.
- MCP server docs: <https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/server.md> — McpServer, registerTool, StdioServerTransport.
- MCP spec: <https://modelcontextprotocol.io/specification>.
- TanStack Virtual: <https://tanstack.com/virtual/latest> — headless virtualization, measureElement.
- Electrobun source + issues: <https://github.com/blackboardsh/electrobun> — lifecycle events, userData convention.
- Close code 1001: RFC 6455 §7.4.1 — "Going Away" semantics for graceful shutdown.

---

## Open Questions

Few — the phase is heavily pre-decided. These are the only items the planner should surface to the user during planning:

1. **RPC shape: `setNodeAllowlist` — message or request?** (§2.3)
   - Message is simpler, matches the existing no-response pattern.
   - Request is cleaner for lifecycle (webview knows when Bun has ingested the allow-list).
   - Default recommendation: **request** (Proposal 2 in §2.3) — matches the established `loadFile` / `saveFile` pattern in `shared/types.ts`.
   - Low risk; planner can decide at Plan 4-02 without user input.

2. **Standalone Bun launcher for E2E test.** (§7.3)
   - E2E needs a Bun subprocess that starts the WS server WITHOUT spawning Electrobun's BrowserWindow.
   - Options: (a) new `src/bun/eventServerStandalone.ts` entry file; (b) env var gate in the existing entry that skips BrowserWindow creation.
   - Recommend (a) — single-purpose file is cleaner and keeps the test's invocation simple.
   - Decide at Plan 4-02; no user input needed.

3. **Hello frame: is it worth making it required vs optional?** (§1.5)
   - Research recommends required (cleaner DX, better toast UX).
   - CONTEXT.md says "recommended but not contract-mandated."
   - If the planner agrees with required, document in Plan 4-02 and update UI-SPEC's MCP wrapper copy accordingly. If optional, plan for "source may be undefined in the toast" copy variants.
   - **Flag for user confirmation** if the planner wants to elevate it to required — it affects producer contract docs.

---

## Sources

### Primary (HIGH confidence)
- Bun docs — WebSockets: <https://bun.com/docs/runtime/http/websockets> (2026-04-23)
- Bun docs — HTTP Server (stop, lifecycle): <https://bun.com/docs/runtime/http/server>
- Bun docs — Append to file: <https://bun.com/docs/guides/write-file/append>
- npm: `@modelcontextprotocol/sdk@1.29.0` — verified via `bun pm view` (2026-04-23)
- npm: `@tanstack/react-virtual@3.13.24` — verified via `bun pm view` (2026-04-23)
- npm: `react-window@2.2.7` — verified via `bun pm view` (2026-04-23)
- MCP TypeScript SDK server.md: <https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/server.md>
- In-repo: all file references in §"Canonical References" were read during this research session

### Secondary (MEDIUM confidence)
- POSIX O_APPEND atomicity: <https://news.ycombinator.com/item?id=12220489> — community-verified against POSIX.1-2001 standard
- Close code 1001 semantics: <https://oneuptime.com/blog/post/2026-02-02-websocket-graceful-shutdown/view> — matches RFC 6455 §7.4.1
- TanStack vs react-window comparison: <https://npm-compare.com/@tanstack/react-virtual,react-window>

### Tertiary (LOW confidence — flagged for validation)
- Exact end-to-end latency numbers (§3.2 analysis): based on reasonable extrapolation, not measured. Verify with Plan 4-02 integration test.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every library version verified via `bun pm view` today.
- Architecture (WS lifecycle, sidecar, debounce): HIGH — all critical APIs verified via official docs; debounce algorithm is a well-understood pattern.
- MCP wrapper: HIGH — SDK version + API shape confirmed from official docs.
- Latency budgets: MEDIUM — analytical, not measured; A2 assumption documented.
- Pitfalls: HIGH for items 1, 3, 4, 6, 7, 8 (codebase-specific); MEDIUM for 2, 5, 9 (general).

**Research date:** 2026-04-23
**Valid until:** 2026-05-23 for library versions (30 days — npm moves fast); indefinite for Bun WS API (stable) and MCP spec (stable); re-verify sentinel PID liveness pattern if platform targets change.

---

## RESEARCH COMPLETE
