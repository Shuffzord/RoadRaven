# Phase 6: Agentic Roadmap Authoring — Research

**Researched:** 2026-05-05
**Domain:** MCP tool authoring, WebSocket request/response framing, Bun↔renderer RPC extension
**Confidence:** HIGH (codebase verified), MEDIUM (MCP SDK via installed package inspection), LOW (external WS-RPC comparison via training knowledge)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions (D-01 through D-18)

- **D-01:** Ship full tool set in v1 — read (6), create (2), update (5+existing), delete (1), file-lifecycle (3), carry-forward (2). ~17 net-new.
- **D-02:** No `importSubtree` in v1. createNode one at a time.
- **D-03:** `findNodes` uses structured filter `{titleContains?, status?, type?, metaKey?, metaValue?, parentId?}`, AND-combined.
- **D-04:** `updateNodeMetadata` is shallow PATCH semantics; `null` value = delete key.
- **D-05:** App-required for every tool. No disk-direct fallback. No auto-launch.
- **D-06:** No-file-loaded returns `{ error: 'no_file_loaded', hint: '...' }` distinct from app-not-running.
- **D-07:** Read tools return merged state — live overlay (liveEventMeta) wins over authored value within 30s window.
- **D-08:** Last-write-wins concurrency. No locks, no modals.
- **D-09:** Agent activity surfaces in Phase 4 drawer via synthetic IntegrationEvent. `source = 'claude-code'`, `meta.tool` = tool name.
- **D-10:** Tools return `ok` after store mutation lands; durability follows existing autosave pipeline.
- **D-11:** `deleteNode` requires `cascade: true` for non-leaf; last-root delete blocked with `cannot_delete_last_root` error.
- **D-12:** `openFile` auto-flushes pending autosave before opening.
- **D-13:** Path-traversal allowlist applies to agent `openFile`/`saveFileAs` calls; same `isPathWithinMainDir` + `pushDialogAllowlistPath` plumbing.
- **D-14:** Reuse existing `plugins/claude-code/` MCP server (`server.ts`). Single `McpServer` instance.
- **D-15:** Existing one-way WS needs request/response framing added; same sentinel-discovered URL; no second transport.
- **D-16:** Mutations route through renderer store via RoadmapRPCType (not direct Bun disk writes).
- **D-17:** Lockstep version bump with all packages at release.
- **D-18:** Schema unchanged (`RoadmapNode`, `RoadmapSchema`).

### Claude's Discretion

Items 1–14 listed in CONTEXT.md. All resolved below in Decision Resolutions section.

### Deferred Ideas (OUT OF SCOPE)

- `importSubtree` bulk tool
- Pulse animation on agent-mutated nodes
- Conflict UI / lock / queue for concurrent edits
- Synchronous flush-per-tool-call for stronger durability
- Auto-launching the desktop app
- Disk-direct read fallback when app is off
- Per-tool settings toggles beyond kill-switch
- System-picker prompt per agent path
- Multi-agent / agent identity
- Plugin host activation (PLUG-V2-01..V2-09)
</user_constraints>

<phase_requirements>
## Phase Requirements

Proposed ID scheme (planner finalizes numbering):

| ID | Category | Description |
|----|----------|-------------|
| PLUG-AGENT-READ-01 | Read | `getRoadmap` — return full schema tree with live-merged statuses |
| PLUG-AGENT-READ-02 | Read | `getNode` — return single node with ancestry path and merged status |
| PLUG-AGENT-READ-03 | Read | `findNodes` — filter by structured predicate, return matching nodes |
| PLUG-AGENT-READ-04 | Read | `getStatusConfig` — return statusConfig array |
| PLUG-AGENT-READ-05 | Read | `getTypeConfig` — return typeConfig array |
| PLUG-AGENT-READ-06 | Read | `getOpenFile` — return current filePath and schema metadata |
| PLUG-AGENT-CREATE-01 | Create | `createNode` — add a child node under a parent; return new UUID |
| PLUG-AGENT-CREATE-02 | Create | `createRoadmap` — initialize in-memory untitled schema (mirrors File > New) |
| PLUG-AGENT-UPDATE-01 | Update | `renameNode` — change a node's title |
| PLUG-AGENT-UPDATE-02 | Update | `updateNodeType` — change a node's type string |
| PLUG-AGENT-UPDATE-03 | Update | `updateNodeNotes` — replace a node's notes string |
| PLUG-AGENT-UPDATE-04 | Update | `updateNodeMetadata` — shallow-PATCH node metadata; null=delete key |
| PLUG-AGENT-UPDATE-05 | Update | `moveNode` — re-parent a node (to newParentId at optional position) |
| PLUG-AGENT-UPDATE-06 | Update | `updateNodeStatus` — keep Phase 4 compat; now also writes drawer event |
| PLUG-AGENT-DELETE-01 | Delete | `deleteNode` — delete leaf or subtree (cascade:true required for non-leaf) |
| PLUG-AGENT-FILE-01 | File | `saveFile` — flush pending autosave debounce immediately |
| PLUG-AGENT-FILE-02 | File | `saveFileAs` — write to a new path (path-traversal allowlist applied) |
| PLUG-AGENT-FILE-03 | File | `openFile` — flush then load a file by path (allowlist applied) |
| PLUG-AGENT-TRANSPORT-01 | Transport | WS request/response framing on Bun side (inbound message router) |
| PLUG-AGENT-TRANSPORT-02 | Transport | `wsClient.ts` extension — `request(method, params): Promise<result>` |
| PLUG-AGENT-SAFETY-01 | Safety | Error taxonomy — structured codes returned by all gate checks |
| PLUG-AGENT-SAFETY-02 | Safety | Drawer audit log — synthetic IntegrationEvent per mutating tool call |
| PLUG-AGENT-SAFETY-03 | Safety (optional) | Kill-switch setting `agentApi.enabled: false` |
</phase_requirements>

---

## Summary

Phase 6 adds ~17 MCP tools to the existing `plugins/claude-code/` wrapper, turning it from a one-way event pusher into a full bidirectional CRUD API. The heavy lifting is already done: every store mutation Phase 6 needs exists in `roadmapStore.ts`; every path-guard exists in `saveFile.ts`; the drawer event log accepts `IntegrationEvent` rows today. The only genuinely new infrastructure is (1) a request/response framing layer on the WebSocket channel, and (2) the Bun-side request router that maps inbound agent requests to existing RPC calls into the renderer.

The central open question — WebSocket framing — is resolved below using a JSON-RPC 2.0-shaped envelope with a custom `type` discriminator on the inbound channel. This integrates cleanly with the existing `parseIncoming` / `classifyEventFrame` logic in `eventServer.ts`, which already discriminates on `type: 'hello'` vs event frames. Adding `type: 'request'` and `type: 'response'` fits the pattern without restructuring the server.

The Bun↔renderer RPC extension uses a generic `agentRequest` dispatcher (one new RPC method, not 17) to minimize the contract surface while remaining fully type-safe. The renderer receives the tool name and args, dispatches to the correct store action, and returns a structured result. This keeps the `RoadmapRPCType` contract lean and future-proof.

**Primary recommendation:** Implement the JSON-RPC 2.0-shaped WS envelope, a single `agentRequest` Bun→renderer RPC method, and use flat camelCase tool names (e.g., `getRoadmap`, `createNode`) without a namespace prefix — Claude Code's MCP host UI renders the server name separately.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| MCP tool registration & input validation | MCP Server process (`plugins/claude-code/src/server.ts`) | — | MCP SDK `registerTool` pattern; Zod at trust boundary |
| WS request framing (send + receive correlation) | MCP Client (`wsClient.ts`) | Bun WS server (`eventServer.ts`) | Client owns the request; server owns the response dispatch |
| Request routing → store action | Bun main process (`index.ts` / new `agentRequestHandler.ts`) | — | Bun owns the RPC bridge to renderer |
| Renderer store mutations | Renderer process (`roadmapStore.ts`) | — | Single source of truth per D-16 |
| Autosave / file persistence | Bun (`saveFile.ts`, `atomicWrite.ts`) | Renderer trigger (via `triggerSave` event) | Phase 3 pipeline unchanged |
| Path-traversal enforcement | Bun (`saveFile.ts: isPathWithinMainDir, pushDialogAllowlistPath`) | — | Same allowlist as user actions per D-13 |
| Audit log (drawer) | Renderer (`eventLogStore.appendEvents`) | Bun forwards via `integrationEvent` RPC message | D-09 pattern already established |
| Error response generation | Bun request handler | MCP server tool callback (re-wraps) | Errors originate in Bun; MCP wrapper converts to `isError: true` response |

---

## Decision Resolutions

### 1. MCP Tool Naming Convention

**Options:**
- `roadraven_getRoadmap` — underscore namespace prefix (common in multi-server MCP hosts to disambiguate)
- `getRoadmap`, `createNode`, etc. — flat camelCase, no prefix
- `roadmap_get`, `node_create` — snake_case with resource prefix (LSP-style)

**Recommendation: flat camelCase, no prefix.**

Rationale: The MCP host renders the server name (`roadraven-claude-code`) in its UI alongside each tool name. Adding a namespace prefix doubles the cognitive load ("roadraven_getRoadmap" in a server already called "roadraven-claude-code") and makes the tool names verbose when written in agent prompts. The two existing tools (`updateNodeStatus`, `getEventApiStatus`) already use flat camelCase — preserving consistency costs nothing.

Full tool name list: `getRoadmap`, `getNode`, `findNodes`, `getStatusConfig`, `getTypeConfig`, `getOpenFile`, `createNode`, `createRoadmap`, `renameNode`, `updateNodeStatus` (unchanged), `updateNodeType`, `updateNodeNotes`, `updateNodeMetadata`, `moveNode`, `deleteNode`, `saveFile`, `saveFileAs`, `openFile`. (Plus existing `getEventApiStatus`.)

[VERIFIED: `plugins/claude-code/src/server.ts` — existing tools use flat camelCase]

### 2. WebSocket Request/Response Framing

**Options evaluated:**

| Option | Shape | Pros | Cons |
|--------|-------|------|------|
| A. Correlation IDs, custom envelope | `{type:"request", id, method, params}` / `{type:"response", id, result/error}` | Minimal; fits existing `type` discriminator | Non-standard; must specify the whole contract |
| B. JSON-RPC 2.0 | `{jsonrpc:"2.0", id, method, params}` / `{jsonrpc:"2.0", id, result/error}` | Well-specified; error object shape defined in spec | Slightly verbose; the `jsonrpc:"2.0"` field is a no-op here |
| C. Second WS channel | Separate URL for requests | Clean separation | Violates D-15 (no second transport) — **rejected** |
| D. HTTP fallback | POST to Bun HTTP endpoint | Standard request/response semantics | Violates D-15 (no HTTP fallback) — **rejected** |

**Recommendation: Option A — custom envelope with `type` discriminator.**

Use a shape that closely resembles JSON-RPC 2.0 semantics but without the `jsonrpc` boilerplate field:

```typescript
// Request (wrapper → Bun)
interface AgentRequest {
  type: "request";
  id: string;           // nanoid or crypto.randomUUID() — scoped to this WS connection
  method: string;       // e.g., "getRoadmap", "createNode"
  params: unknown;      // tool-specific params object
}

// Response (Bun → wrapper)
interface AgentResponse {
  type: "response";
  id: string;           // echoes request id
  result?: unknown;     // on success
  error?: {             // on failure
    code: string;       // from error taxonomy
    message: string;
    hint?: string;
    data?: unknown;     // extra context (e.g., childCount for cascade_required)
  };
}
```

This fits the existing `eventServer.ts` `type` discriminator pattern (already handles `hello` vs event frames). The Bun `message` handler becomes a three-way switch: `hello` | `request` | event frame.

**Correlation ID strategy:** `wsClient.ts` maintains a `Map<string, {resolve, reject, timer}>` keyed by request `id`. Each `request()` call stores a pending entry, sends the message, and starts a timeout timer (default 10s for mutations, 30s for reads with large trees). The `onmessage` handler checks for `type === 'response'` first; if found, it looks up the pending map and resolves/rejects.

**Debounce bypass for reads:** Phase 4 D-25 has a 100ms coalescer on the event path. Agent read requests do NOT go through the `EventCoalescer` — they bypass it entirely. The request handler resolves synchronously from the renderer store state (via the existing `agentRequest` RPC) and sends the response immediately. Only the event producer → status update path uses the coalescer.

[VERIFIED: `packages/desktop/src/bun/eventServer.ts` — `type: 'hello'` discriminator already in use; three-way extension is natural]
[ASSUMED: 10s timeout for mutations and 30s for reads — these values are not set yet and need planner review]

**Reference WS-RPC patterns:**
- Language Server Protocol uses a JSON-RPC 2.0 envelope over stdin/stdout (same request/response correlation pattern) [CITED: microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/]
- Phoenix Channels (Elixir) uses `[join_ref, ref, topic, event, payload]` tuple framing over WebSocket — the `ref` field is the correlation ID [ASSUMED: training knowledge]
- The chosen shape aligns with JSON-RPC 2.0 error semantics (`code`, `message`, `data`) which is the most widely documented pattern for WS-RPC [CITED: www.jsonrpc.org/specification]

### 3. Bun→Renderer RPC Shape

**Options:**

| Option | Shape | Type-safety | Boundary complexity |
|--------|-------|-------------|---------------------|
| A. One method per tool (~17) | `agentGetRoadmap`, `agentCreateNode`, etc. | HIGH — each typed separately | High — 17 new entries in `RoadmapRPCType` |
| B. Single generic dispatcher | `agentRequest({ tool: string, args: unknown })` | MEDIUM — discriminated union or `unknown` result | Low — one entry in `RoadmapRPCType` |
| C. Generic dispatcher with typed discriminated union | `agentRequest({ tool: AgentTool, args: ArgsFor<T> })` + conditional return type | HIGH — full TypeScript coverage | Medium — one entry, but complex conditional types |

**Recommendation: Option B — single generic `agentRequest` dispatcher.**

Rationale: The boundary already carries Zod-validated inputs (all validation happens on the MCP wrapper side before the WS request is sent). The renderer dispatcher simply maps `tool` to a store action and returns a result; TypeScript type narrowing inside the handler is sufficient. Adding 17 new typed RPC entries to `RoadmapRPCType` creates maintenance overhead for every new tool, while the single dispatcher remains stable across tool additions.

```typescript
// shared/types.ts addition (inside bun.requests):
agentRequest: {
  params: {
    tool: string;
    args: Record<string, unknown>;
  };
  response:
    | { ok: true; data: unknown }
    | { ok: false; error: string; code: string; hint?: string; data?: unknown };
};
```

The renderer handler switches on `tool` string, calls the appropriate store action, and returns the typed result wrapped in `{ ok: true, data: ... }` or `{ ok: false, error: ..., code: ... }`.

[VERIFIED: `shared/types.ts` — existing RPC pattern; adding one entry here is minimal]

### 4. `getRoadmap` Pagination

**Recommendation: Always return full tree in v1.**

Token estimate for a typical roadmap: 50 nodes × ~200 chars/node = ~10K chars = ~2.5K tokens. Even a large roadmap (300 nodes) sits at ~15K tokens — well within Claude's context window. The agent needs the full picture to reason about where to attach new nodes. Pagination would require round-trips and cursor management, adding complexity for a problem that doesn't exist at typical roadmap sizes.

Trigger for adding pagination: if a real roadmap exceeds 500 nodes and the response causes context-window issues in agent sessions. Document a `maxNodes: 500` soft cap in v1.1 planning.

[VERIFIED: `roadmapStore.ts` — `schema.nodes` is a tree, `nodeIndex` is a flat Map; returning the full tree is a single serialization pass]

### 5. `getNode` Ancestry Shape

**Options:**
- Array of parent IDs only (`ancestorIds: string[]`)
- Full ancestor `RoadmapNode[]` array
- `parentId: string | null` + separate `getAncestors(nodeId)` tool

**Recommendation: `parentId: string | null` + `ancestorIds: string[]` in the same response.**

Return shape:
```typescript
{
  node: RoadmapNode;          // the node itself with merged status
  parentId: string | null;    // immediate parent for quick re-parenting
  ancestorIds: string[];      // root-to-parent path for context
}
```

Rationale: `parentId` is the most common use case (move, sibling creation). `ancestorIds` lets the agent reconstruct the breadcrumb without a second call. Full ancestor `RoadmapNode[]` is verbose and rarely needed; the agent can call `getNode` on any ancestor ID if it needs the full data.

`ancestorIds` is computed via `findParentAndIndex` walking up the tree — O(depth) per call, which is fine.

[VERIFIED: `roadmapStore.ts: findParentAndIndex` — returns parent, can be called iteratively for ancestry chain]

### 6. Subtree Depth in Responses

**Recommendation: Always full subtree, no depth limit in v1.**

`getNode` returns the node and its full descendant subtree. `getRoadmap` returns the full schema. Same token-count reasoning as pagination: typical roadmap subtrees are small. Depth limiting adds implementation complexity (truncation markers, continuation tokens) for a problem not yet observed in practice.

### 7. Synthetic IntegrationEvent Shape for Drawer (D-09)

The existing `IntegrationEvent` shape (`packages/core/src/plugin.ts`):
```typescript
interface IntegrationEvent {
  nodeId: string;
  status: string;
  meta?: Record<string, unknown>;
  source?: string;
  timestamp?: string;
  _error?: "malformed" | "unknown_node" | "invalid_status";
}
```

Agent events do NOT need a new `_error` classification (they either succeed or return structured errors to the agent, never to the drawer). The drawer row is populated as:

```typescript
// Written by the Bun request handler for every mutating tool call:
const agentDrawerEvent: IntegrationEvent = {
  nodeId: targetNodeId,              // primary node affected (e.g., for createNode: the new node ID)
  status: node.status ?? "unknown",  // current status after mutation
  source: "claude-code",             // source = MCP wrapper's source name (D-09)
  timestamp: new Date().toISOString(),
  meta: {
    tool: "createNode",              // tool name for audit
    args: { parentId, title },       // tool args (strip sensitive/large fields)
    // optional: label for human-readable row
    label: `Claude → createNode "${title}"`,
  },
};
```

**Drawer row rendering:** The existing `EventLogRow` renders `source`, `nodeId` prefix, `status`, and `meta` preview (first 2 keys). With `meta.tool` and `meta.label`, the row reads:
- Source: `claude-code`
- Status: (current node status)
- Meta preview: `tool: createNode` | `label: Claude → createNode "API Gateway"`

No new UI components needed. The `label` field in `meta` is a convention the drawer row can optionally display if a future UI pass surfaces it.

For tools without a primary `nodeId` (e.g., `getRoadmap`, `createRoadmap`, `saveFile`):
- `nodeId`: use `"__schema__"` as a sentinel (filtered in `getFilteredRows` unless "show all" is active)
- Or: skip drawer write entirely for read-only tools (reads are not mutations — no audit value)

**Decision: Only mutating tools write drawer events.** Read tools (`getRoadmap`, `getNode`, `findNodes`, `getStatusConfig`, `getTypeConfig`, `getOpenFile`) do NOT write drawer events. File-lifecycle tools (`saveFile`, `saveFileAs`, `openFile`) write with `nodeId: "__lifecycle__"`.

[VERIFIED: `eventLogStore.ts: appendEvents` — accepts `IntegrationEvent[]`, no schema changes needed]
[VERIFIED: `plugin.ts` — `IntegrationEvent.meta` is `Record<string, unknown>`, accepts any keys]

### 8. Error Response Taxonomy

Full enum — see dedicated Error Taxonomy section below.

### 9. Idempotency Keys for Create Operations

**Recommendation: Skip in v1.**

Cost of adding later: minimal — would add an optional `idempotencyKey?: string` field to `createNode`/`createRoadmap` input schemas and a short-lived in-memory Map on the Bun side (TTL ~5 minutes). The agent retry problem on partial scaffolds is manageable: `findNodes({ titleContains: "Gateway" })` before `createNode` gives the agent enough to detect duplicates manually.

If added later: the idempotency map goes in the Bun request handler, keyed by `idempotencyKey`, storing `{ nodeId, createdAt }`. Reuse `cachedMainPath` as a scope discriminator (keys are per-file, not global).

### 10. `createRoadmap` Shape

**Recommendation: Mirror File > New via `newUntitledSchema` store action.**

Do NOT require an explicit `path` arg. The agent calls `createRoadmap({ title?, statusConfig?, typeConfig? })` which:
1. Calls the existing `newFile` Bun RPC → invokes `newUntitledSchema()` in the renderer store
2. Returns the schema + `isUntitled: true` state
3. Agent then calls `saveFileAs({ path })` to commit it to disk

This is exactly the File > New path already tested in Phase 3. The agent must call `saveFileAs` before mutations persist to disk (same constraint as a user who created a new file but hasn't saved yet). The `openFile` auto-flush D-12 rule still applies if the agent later calls `openFile` — it will flush the untitled schema or return an error if it hasn't been saved.

[VERIFIED: `roadmapStore.ts: newUntitledSchema` and `packages/desktop/src/bun/index.ts: newFile` handler — full pipeline already exists]

### 11. Tool-Input Validation Strategy

**Reuse existing Zod schemas from `@roadraven/core` where possible:**

| Tool | Zod reuse | New schema needed |
|------|-----------|-------------------|
| `createNode` | `RoadmapNodeSchema.pick({title, status, type, notes, metadata})` (partial) | Input wrapper with `parentId: z.string().uuid()` |
| `createRoadmap` | `RoadmapSchemaSchema.pick({title, statusConfig, typeConfig})` (partial) | Input wrapper |
| `updateNodeMetadata` | `z.record(z.string(), z.unknown().nullable())` | Patch schema (null = delete key) |
| `findNodes` | — | New filter object schema |
| `moveNode` | — | `nodeId, newParentId, position?` |
| `deleteNode` | — | `nodeId, cascade?: z.boolean()` |
| All others | `z.string().uuid()` for nodeId, `z.string()` for text fields | Wrappers only |

All tool input schemas live in `plugins/claude-code/src/tools/` (new directory). They import `RoadmapNodeSchema` etc. from `@roadraven/core` package.

Key: `nodeId` fields use `z.string().uuid()` (matching `RoadmapNodeSchema.id`). Status fields use `z.string().min(1)` not the fixed enum (to support user-defined statuses per Phase 4 D-26).

[VERIFIED: `packages/core/src/schema.ts` — `RoadmapNodeSchema`, `StatusConfigSchema`, `TypeConfigSchema` all available]

### 12. Logging on Bun Side

**Category: `roadraven.agent`** — matches the Phase 1 D-21 LogTape hierarchy (`roadraven.*`).

Required structured fields per log entry:
```typescript
agentLogger.info`Agent tool call`, {
  tool: "createNode",
  args: { parentId, title },      // log args at INFO level
  result: "ok" | errorCode,
  durationMs: elapsed,
};
```

Use `bunLogger` from `packages/desktop/src/bun/logging.ts` with a `getLogger(["roadraven", "agent"])` sub-logger. Error cases log at WARN (structured errors returned to agent) or ERROR (internal failures).

[VERIFIED: `packages/desktop/src/bun/index.ts` — `bunLogger` pattern; `logging.ts` provides `getLogger`]

### 13. Kill-Switch Setting

**Recommendation: Add `agentApi.enabled: false` kill-switch.**

Cost: ~10 lines. The Bun request handler checks `loadSettings().agentApi?.enabled !== false` before processing any `type: 'request'` message. Returns `{ error: 'agent_api_disabled', message: 'Agent API is disabled in settings.' }` if false.

Why: In a shared/screen-share context, users may want to disable agent mutations while keeping the event-push API alive. The check is a single guard at the top of the request dispatch path. `AppSettings` interface in `shared/types.ts` gains `agentApi?: { enabled?: boolean }`.

[VERIFIED: `shared/types.ts: AppSettings` — already has `eventApi?: { port?: number }` pattern to follow]

### 14. Validation Architecture

See dedicated Validation Architecture section below.

---

## Tool Catalog

### Read Tools (PLUG-AGENT-READ-01..06)

**`getRoadmap`** — PLUG-AGENT-READ-01
```typescript
// Input
z.object({})  // no args

// Output
{
  schema: RoadmapSchema;      // full tree with live-merged statuses
  filePath: string | null;
  isUntitled: boolean;
}

// Errors: app_not_running, no_file_loaded
```

**`getNode`** — PLUG-AGENT-READ-02
```typescript
// Input
z.object({
  nodeId: z.string().uuid()
})

// Output
{
  node: RoadmapNode;           // with live-merged status
  parentId: string | null;
  ancestorIds: string[];       // root-to-node path, root first
}

// Errors: app_not_running, no_file_loaded, node_not_found
```

**`findNodes`** — PLUG-AGENT-READ-03
```typescript
// Input
z.object({
  titleContains: z.string().optional(),
  status: z.string().optional(),
  type: z.string().optional(),
  metaKey: z.string().optional(),
  metaValue: z.unknown().optional(),
  parentId: z.string().uuid().optional(),
})

// Output
{ nodes: Array<{ node: RoadmapNode; parentId: string | null }> }

// Errors: app_not_running, no_file_loaded
```

**`getStatusConfig`** — PLUG-AGENT-READ-04
```typescript
// Input: z.object({})
// Output: { statusConfig: StatusConfig[] }
// Errors: app_not_running, no_file_loaded
```

**`getTypeConfig`** — PLUG-AGENT-READ-05
```typescript
// Input: z.object({})
// Output: { typeConfig: TypeConfig[] }
// Errors: app_not_running, no_file_loaded
```

**`getOpenFile`** — PLUG-AGENT-READ-06
```typescript
// Input: z.object({})
// Output: { filePath: string | null; isUntitled: boolean; title: string | null; nodeCount: number }
// Errors: app_not_running
```

### Create Tools (PLUG-AGENT-CREATE-01..02)

**`createNode`** — PLUG-AGENT-CREATE-01
```typescript
// Input
z.object({
  parentId: z.string().uuid(),
  title: z.string().min(1).max(200),
  type: z.string().optional(),
  status: z.string().optional(),   // defaults to first statusConfig entry
  notes: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

// Output: { nodeId: string }   // new UUID
// Errors: app_not_running, no_file_loaded, node_not_found (parent missing)
// Drawer: yes (source="claude-code", meta.tool="createNode")
```

**`createRoadmap`** — PLUG-AGENT-CREATE-02
```typescript
// Input
z.object({
  title: z.string().min(1).optional(),
  statusConfig: z.array(StatusConfigSchema).optional(),
  typeConfig: z.array(TypeConfigSchema).optional(),
})

// Output: { schema: RoadmapSchema; isUntitled: true }
// Errors: app_not_running
// Drawer: yes (meta.tool="createRoadmap")
```

### Update Tools (PLUG-AGENT-UPDATE-01..06)

**`renameNode`** — PLUG-AGENT-UPDATE-01
```typescript
z.object({ nodeId: z.string().uuid(), title: z.string().min(1).max(200) })
// Output: { ok: true }
// Errors: app_not_running, no_file_loaded, node_not_found
// Drawer: yes
```

**`updateNodeType`** — PLUG-AGENT-UPDATE-02
```typescript
z.object({ nodeId: z.string().uuid(), type: z.string() })
// Output: { ok: true }
// Errors: app_not_running, no_file_loaded, node_not_found
// Drawer: yes
```

**`updateNodeNotes`** — PLUG-AGENT-UPDATE-03
```typescript
z.object({ nodeId: z.string().uuid(), notes: z.string() })
// Output: { ok: true }
// Errors: app_not_running, no_file_loaded, node_not_found
// Drawer: yes
```

**`updateNodeMetadata`** — PLUG-AGENT-UPDATE-04
```typescript
z.object({
  nodeId: z.string().uuid(),
  patch: z.record(z.string(), z.unknown().nullable())
  // null value = delete that key from metadata
})
// Output: { ok: true; metadata: Record<string, unknown> }  // final state
// Errors: app_not_running, no_file_loaded, node_not_found
// Drawer: yes
```

**`moveNode`** — PLUG-AGENT-UPDATE-05
```typescript
z.object({
  nodeId: z.string().uuid(),
  newParentId: z.string().uuid(),
  position: z.number().int().min(0).optional()
  // position: 0 = first child, omit = last child
})
// Output: { ok: true }
// Errors: app_not_running, no_file_loaded, node_not_found,
//         move_would_create_cycle (moving node into its own descendant),
//         cross_ref_boundary (target parent is in a different $ref file)
// Drawer: yes
// NOTE: cross-boundary moves are BLOCKED matching Phase 3 EDIT-16 behavior
```

**`updateNodeStatus`** — PLUG-AGENT-UPDATE-06 (Phase 4 carry-forward, enhanced)
- Existing tool; now also writes a synthetic IntegrationEvent to the drawer (D-09)
- Input/output/error behavior unchanged from Phase 4

### Delete Tool (PLUG-AGENT-DELETE-01)

**`deleteNode`** — PLUG-AGENT-DELETE-01
```typescript
z.object({
  nodeId: z.string().uuid(),
  cascade: z.boolean().optional()
})
// Output: { ok: true; deletedCount: number }
// Errors: app_not_running, no_file_loaded, node_not_found,
//         cascade_required (non-leaf, cascade missing or false),
//         cannot_delete_last_root
// Drawer: yes
```

### File-Lifecycle Tools (PLUG-AGENT-FILE-01..03)

**`saveFile`** — PLUG-AGENT-FILE-01
```typescript
z.object({})  // no args — flush current state
// Output: { ok: true } | { ok: false; error: string }
// Errors: app_not_running, no_file_loaded (untitled with no path yet → prompt agent to call saveFileAs first)
// Drawer: yes (nodeId: "__lifecycle__")
```

**`saveFileAs`** — PLUG-AGENT-FILE-02
```typescript
z.object({
  path: z.string().min(1)   // absolute path; allowlist-checked
})
// Output: { ok: true; filePath: string } | error
// Errors: app_not_running, no_file_loaded, path_not_permitted
// Drawer: yes (nodeId: "__lifecycle__")
```

**`openFile`** — PLUG-AGENT-FILE-03
```typescript
z.object({
  path: z.string().min(1)   // absolute path; allowlist-checked
})
// Output: { ok: true; schema: RoadmapSchema; filePath: string }
// Errors: app_not_running, path_not_permitted, file_read_error
// Side effects: auto-flush if hasUnsavedEdits() (D-12)
// Drawer: yes (nodeId: "__lifecycle__")
```

---

## Transport Design

### Message Flow

```
MCP Host (Claude Code)
  → MCP tool call
  → server.ts registerTool callback
  → wsClient.request(method, params)       ← new method
  → WebSocket send: { type:"request", id, method, params }
  → Bun eventServer.ts message handler
  → type === "request" branch
  → agentRequestHandler(ws, request)
  → mainWindow.webview.rpc.request.agentRequest({ tool, args })
  → renderer agentRequest handler (new)
  → roadmapStore action dispatch
  → { ok: true, data } | { ok: false, error, code }
  → back to Bun
  → WebSocket send: { type:"response", id, result/error }
  → wsClient pending map lookup → resolve/reject
  → MCP tool callback returns content[]
```

### Envelope Shapes

```typescript
// Request (plugin → Bun):
interface AgentWsRequest {
  type: "request";
  id: string;           // crypto.randomUUID()
  method: string;       // e.g., "getRoadmap"
  params: Record<string, unknown>;
}

// Success response (Bun → plugin):
interface AgentWsResponseOk {
  type: "response";
  id: string;
  result: unknown;
}

// Error response (Bun → plugin):
interface AgentWsResponseError {
  type: "response";
  id: string;
  error: {
    code: string;       // from error taxonomy
    message: string;
    hint?: string;
    data?: unknown;     // e.g., { childCount: 3 } for cascade_required
  };
}
```

### Message-Type Discriminator on Inbound Channel

Current `eventServer.ts` message handler uses this logic:
1. `parseIncoming(text)` — validates JSON shape
2. If `frame.type === 'hello'` → handle hello
3. Otherwise → treat as event frame (validate nodeId, status, etc.)

Phase 6 adds a step between 2 and 3:
1. `parseIncoming(text)` — validates JSON shape (updated to accept `type: 'request'`)
2. If `frame.type === 'hello'` → handle hello (unchanged)
3. **NEW:** If `frame.type === 'request'` → route to `agentRequestHandler`
4. Otherwise → treat as event frame (unchanged)

`parseIncoming` in `eventSchema.ts` must be updated to accept the `AgentWsRequest` shape (no Zod error on `type: 'request'` input). The `AgentWsRequest` is validated more thoroughly inside `agentRequestHandler`.

The `agentRequestHandler` is a new module (`packages/desktop/src/bun/agentRequestHandler.ts`) that:
- Validates the request shape
- Checks kill-switch
- Routes to the correct action via `mainWindow.webview.rpc.request.agentRequest`
- Sends the response back via `ws.send()`
- Logs to `roadraven.agent` logger

### Debounce Bypass

Phase 4 D-25: `EventCoalescer` batches events with 100ms trailing-edge flush before forwarding to renderer. Agent reads/writes do NOT enter the coalescer.

- **Agent reads:** The `agentRequest` RPC call goes directly to the renderer's store `get()` — it reads current state synchronously and returns.
- **Agent mutations:** Store actions run synchronously in the renderer's Zustand store. The autosave debounce fires afterward (2s delay per Phase 3 D-13) — the mutation itself is synchronous.
- **Coalescer bypass:** The `agentRequestHandler` never calls `coalescer.enqueue()`. It calls the RPC bridge directly.

### WS Client Extension

`wsClient.ts` gains a `request(method, params)` method:

```typescript
export interface WsClient {
  send(event: OutgoingEvent): Promise<void>;
  request<T = unknown>(method: string, params: Record<string, unknown>): Promise<T>;
  isConnected(): boolean;
  close(): Promise<void>;
}
```

Implementation:
```typescript
request<T = unknown>(method, params): Promise<T> {
  return new Promise((resolve, reject) => {
    if (!connected || ws === null) {
      reject(new Error("Not connected to Roadmap Viewer Event API."));
      return;
    }
    const id = crypto.randomUUID();
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`Agent request timed out: ${method}`));
    }, 30_000);
    pending.set(id, { resolve, reject, timer });
    ws.send(JSON.stringify({ type: "request", id, method, params }));
  });
}
```

The `message` event listener on the socket checks for `type === 'response'`:
```typescript
socket.addEventListener("message", (evt) => {
  try {
    const msg = JSON.parse(evt.data);
    if (msg.type === "response" && pending.has(msg.id)) {
      const { resolve, reject, timer } = pending.get(msg.id)!;
      clearTimeout(timer);
      pending.delete(msg.id);
      if (msg.error) reject(Object.assign(new Error(msg.error.message), { code: msg.error.code, hint: msg.error.hint, data: msg.error.data }));
      else resolve(msg.result as T);
    }
  } catch { /* ignore non-JSON or non-response messages */ }
});
```

[VERIFIED: `plugins/claude-code/src/wsClient.ts` — current structure; `pending` Map is a new addition]

---

## RPC Bridge Design

### `RoadmapRPCType` Extension

One new entry in `bun.requests`:

```typescript
// shared/types.ts — add to bun.requests:
agentRequest: {
  params: {
    tool: string;
    args: Record<string, unknown>;
  };
  response:
    | { ok: true; data: unknown }
    | { ok: false; error: string; code: string; hint?: string; data?: unknown };
};
```

### Renderer Handler (new file: `agentRpcHandler.ts` in mainview)

```typescript
// packages/desktop/src/mainview/rpc/agentRpcHandler.ts
import { useRoadmapStore } from "../store/roadmapStore";
import { useEventLogStore } from "../store/eventLogStore";

export async function handleAgentRequest(
  tool: string,
  args: Record<string, unknown>
): Promise<{ ok: true; data: unknown } | { ok: false; error: string; code: string; hint?: string; data?: unknown }> {
  const store = useRoadmapStore.getState();
  const schema = store.schema;

  // Gate checks first
  if (!schema) return { ok: false, error: "No file loaded.", code: "no_file_loaded", hint: "Open a roadmap or call openFile(path)" };

  switch (tool) {
    case "getRoadmap": return { ok: true, data: { schema, filePath: store.filePath, isUntitled: store.isUntitled } };
    case "getNode": {
      const node = store.nodeIndex.get(args.nodeId as string);
      if (!node) return { ok: false, error: "Node not found.", code: "node_not_found" };
      // merge live status
      const merged = mergeNodeStatus(node, store.liveEventMeta);
      const ancestry = buildAncestry(schema.nodes, args.nodeId as string);
      return { ok: true, data: { node: merged, parentId: ancestry.parentId, ancestorIds: ancestry.ancestorIds } };
    }
    case "createNode": {
      const newId = store.addChild(args.parentId as string, args.title as string);
      if (!newId) return { ok: false, error: "Parent node not found.", code: "node_not_found" };
      // apply optional fields
      if (args.status) store.updateNodeStatus(newId, args.status as string);
      if (args.type) store.updateNodeType(newId, args.type as string);
      if (args.notes) store.updateNodeNotes(newId, args.notes as string);
      if (args.metadata) store.updateNodeMetadata(newId, args.metadata as Record<string, unknown>);
      appendAgentDrawerEvent("createNode", newId, args, store);
      return { ok: true, data: { nodeId: newId } };
    }
    case "deleteNode": {
      const nodeToDelete = store.nodeIndex.get(args.nodeId as string);
      if (!nodeToDelete) return { ok: false, error: "Node not found.", code: "node_not_found" };
      const childCount = nodeToDelete.children?.length ?? 0;
      const isLastRoot = !findParentAndIndex(schema.nodes, args.nodeId as string)?.parent && schema.nodes.length === 1;
      if (isLastRoot) return { ok: false, error: "Cannot delete the last root node.", code: "cannot_delete_last_root" };
      if (childCount > 0 && !args.cascade) return { ok: false, error: `Node has ${childCount} children. Pass cascade:true to delete subtree.`, code: "cascade_required", data: { childCount } };
      const result = store.deleteNode(args.nodeId as string);
      appendAgentDrawerEvent("deleteNode", args.nodeId as string, args, store);
      return { ok: true, data: { deletedCount: result.deletedCount } };
    }
    // ... remaining cases
    default:
      return { ok: false, error: `Unknown tool: ${tool}`, code: "unknown_tool" };
  }
}
```

### Round-Trip Latency

Expected round-trip for a mutation (MCP call → store action → `ok` response):
- MCP wrapper → WS send: ~1ms
- Bun receives → validates → forwards `agentRequest` RPC: ~2–5ms
- Renderer RPC handler → Zustand action (synchronous in-memory): ~1ms
- Response back to Bun → WS send → wrapper receives: ~2–5ms
- **Total: ~5–12ms typical**

For `getRoadmap` on a 100-node tree:
- JSON.stringify of the full schema: ~2–5ms
- Round-trip: ~10–20ms total

These are well within any agent-facing latency budget. Sync vs. async: all store actions are synchronous (Zustand `get()`/`set()` are synchronous); the RPC round-trip is the only async boundary.

[VERIFIED: `roadmapStore.ts` — all store actions (`addChild`, `renameNode`, etc.) are synchronous Zustand mutations]
[VERIFIED: `shared/types.ts` — existing RPC pattern with `maxRequestTime: 120_000`]

---

## Error Taxonomy

| Code | When It Fires | Sample Message | Hint Field |
|------|---------------|----------------|------------|
| `app_not_running` | Sentinel file missing or PID dead | "Roadmap Viewer is not running." | "Start the app and retry." |
| `no_file_loaded` | App running but `schema === null` (welcome screen) | "No roadmap file is loaded." | "Open a roadmap or call openFile(path)." |
| `node_not_found` | `nodeIndex.get(nodeId)` returns undefined | "Node '{nodeId}' not found in the loaded roadmap." | "Call getRoadmap or findNodes to discover node IDs." |
| `cascade_required` | `deleteNode` called on non-leaf without `cascade: true` | "Node has children. Pass cascade:true to delete the subtree." | `data: { childCount: N }` |
| `cannot_delete_last_root` | `deleteNode` on the only root node | "Cannot delete the last root node." | "Add a sibling root node first, or close the file." |
| `path_not_permitted` | `openFile`/`saveFileAs` path fails allowlist | "Path is outside the permitted directory." | "Open the target directory in the app first, or navigate to the file via the file picker." |
| `cross_ref_boundary` | `moveNode` targets a parent in a different `$ref` file | "Cannot move node across $ref file boundaries." | "Phase 3 EDIT-16: cross-boundary moves are blocked." |
| `move_would_create_cycle` | `moveNode` target is a descendant of the node being moved | "Cannot move a node into its own subtree." | — |
| `file_read_error` | `openFile` — file doesn't exist or permission denied | "Failed to read file: {system error}" | — |
| `save_error` | `saveFile`/`saveFileAs` — atomic write failed | "Failed to save: {system error}" | "Check disk space and file permissions." |
| `agent_api_disabled` | `agentApi.enabled: false` in settings | "Agent API is disabled in application settings." | "Enable it in .roadmap-settings.json: agentApi.enabled = true" |
| `unknown_tool` | Bun receives `method` not in the handler switch | "Unknown agent tool: '{method}'." | "Update the plugin to a version that matches the app." |
| `internal_error` | Unhandled exception in Bun request handler | "An internal error occurred." | "Check app logs for details." |

**Error propagation pattern:**

```typescript
// In MCP tool callback (server.ts):
try {
  const result = await wsClient.request<ResultType>(method, params);
  return { content: [{ type: "text", text: JSON.stringify(result) }] };
} catch (err: unknown) {
  const code = (err as { code?: string }).code ?? "internal_error";
  const hint = (err as { hint?: string }).hint;
  return {
    content: [{ type: "text", text: (err as Error).message + (hint ? ` ${hint}` : "") }],
    isError: true,
  };
}
```

The `code` is surfaced to the agent via the message text (not a machine-readable field in the MCP response, since MCP tool results are text). The agent can pattern-match on error codes in the message text to make decisions.

---

## Risks & Landmines

### L-01: wsClient.ts is One-Way Only

**What:** `wsClient.ts` currently has no `message` event listener. The `send()` method is fire-and-forget. Adding `request()` requires attaching a persistent `message` listener on the socket.

**Change surface:**
- `connectOnce()` must attach `socket.addEventListener("message", onMessage)` alongside the existing `open`, `error`, `close` listeners.
- A module-level `Map<string, PendingRequest>` tracks in-flight requests across reconnects.
- On socket `close`, all pending requests must be rejected with `new Error("WebSocket disconnected during request")` to prevent leaked Promises.

**Mitigation:** The `pending` map is cleared on every `close` event. `connectOnce` re-attaches `onMessage` on each new socket. Requests in flight during a disconnect fail fast (timeout or disconnect error); the agent is expected to retry.

[VERIFIED: `plugins/claude-code/src/wsClient.ts` lines 56-65 — close handler; must reject pending before scheduling reconnect]

### L-02: eventServer.ts Inbound Message Discriminator

**What:** `eventServer.ts` `message` handler currently parses all inbound messages through `parseIncoming` which expects event frames or hello frames. A `type: 'request'` message will currently fall into the event-frame branch and produce a malformed-event error.

**Mitigation:** Update `parseIncoming` (in `eventSchema.ts`) to return a three-way discriminated union:
```typescript
type ParseResult =
  | { ok: true; frame: HelloFrame | EventFrame | AgentRequest }
  | { ok: false };
```
The `message` handler in `eventServer.ts` branches on `frame.type === 'request'` before the existing event-classification path. This is a minimal diff.

[VERIFIED: `packages/desktop/src/bun/eventServer.ts` lines 156-210 — current branching structure]
[VERIFIED: `packages/desktop/src/bun/eventSchema.ts` exists — `parseIncoming` and `classifyEventFrame` are separate functions]

### L-03: Event-Batch 100ms Debounce vs. Agent Requests

**What:** Phase 4 D-25's `EventCoalescer` batches events with 100ms trailing-edge delay. If an agent read arrives while a batch is in-flight, the read will see the pre-batch state (because the batch hasn't been forwarded to the renderer yet).

**Assessment:** This is acceptable. The agent reads from the renderer's Zustand store (via `agentRequest` RPC), not from the Bun-side event queue. The renderer has already applied the last batch it received. The 100ms delay between an event arriving at Bun and the renderer seeing it means the agent read might be up to 100ms stale relative to the latest external event. This is the same latency the user sees on their screen. No action needed — document in tool descriptions.

**Mitigation:** Tool descriptions for `getNode`/`getRoadmap` note: "Returns the current state as seen in the app, which may be up to 100ms behind the most recent external events."

[VERIFIED: `packages/desktop/src/bun/eventCoalescer.ts` — FLUSH_MS_DEFAULT = 100]

### L-04: liveEventMeta 30s Window + Agent Status Reads

**What:** D-07 says read tools return merged state — `liveEventMeta` overlay wins within the 30s window. The merge is per-node, not a tree walk.

**Implementation:** `liveEventMeta[nodeId]` is a Zustand state slice. Reading it in the renderer handler is a simple Map lookup. The 30s clock is **wall-clock** (not per-event): `Date.now() - meta.lastEventAt < 30_000`. The handler must apply this check before returning each node's status.

```typescript
function mergeNodeStatus(node: RoadmapNode, liveEventMeta: Record<string, LiveMeta>): RoadmapNode {
  const meta = liveEventMeta[node.id];
  if (meta && Date.now() - meta.lastEventAt < 30_000 && meta.status) {
    return { ...node, status: meta.status as typeof node.status };
  }
  return node;
}
```

Wait — `liveEventMeta` stores `{ lastEventAt, source, meta }` but NOT the `status`. The `applyEventBatch` action mutates `node.status` directly (in-place, via `nodeIndex.get(u.nodeId).status = u.status`). So by the time the renderer handler reads from `nodeIndex`, the node's status is already the merged value. The `liveEventMeta` is only needed to compute whether the node is "currently live" for the pulse indicator.

**Conclusion:** No special merge needed in the renderer handler. `nodeIndex.get(nodeId).status` already reflects the live-overlaid value. The D-07 requirement is satisfied by the existing `applyEventBatch` mutation.

[VERIFIED: `roadmapStore.ts: applyEventBatch` lines 846-861 — directly mutates `node.status` via `nodeIndex`]

### L-05: Path-Traversal Allowlist is Per-Process, Not Persistent

**What:** `dialogAllowlist` in `saveFile.ts` is a `Set<string>` in module-level memory. It is populated by `pushDialogAllowlistPath()` when the user picks a file via the native dialog or loads a file. It is NOT persisted to disk.

**Impact for agents:** If the user opens `/project/roadmap.json`, then in the same session calls `saveFileAs('/project/roadmap-v2.json')`, this is allowed (same directory → `isPathWithinMainDir` returns true). If the app restarts and the agent tries `saveFileAs('/project/roadmap-v2.json')` without the user having loaded a file in that directory first, it will be rejected.

**The `recent-files` list is the persistent surface:** Paths the user previously opened via the picker are in `AppSettings.recentFiles`. On app start, the Bun handler could pre-seed the allowlist from `recentFiles`. However, this was explicitly NOT done in Phase 3 (D-13 says the allowlist is session state only).

**Mitigation:** Document in `openFile` and `saveFileAs` tool descriptions: "Permitted paths are those within the directory of the currently loaded file, previously user-picked paths in this session, or paths opened via the file picker. The agent may need to guide the user to open a file in the target directory first."

[VERIFIED: `packages/desktop/src/bun/saveFile.ts: dialogAllowlist` — module-level `Set`, not persisted]
[VERIFIED: `packages/desktop/src/bun/index.ts` — no allowlist pre-seeding from settings on startup]

### L-06: File-Watcher Does NOT Fire on Agent Mutations

**What:** Phase 3 wires a file watcher that fires `pushFileChanged` when the roadmap JSON is written externally. Agent mutations land via the renderer store path — the Bun process sends `agentRequest` to the renderer, the store action runs, and autosave writes the file later. When autosave writes, it calls `markSelfWrite(path)` to mark the write as self-initiated, which the file watcher uses to suppress the "external edit" toast.

**Verification:** `markSelfWrite` in `fileWatcher.ts` is called by `saveFileHandler` → `atomicWrite` path. The file watcher checks `isSelfWrite` before emitting `pushFileChanged`. Agent mutations → autosave → `saveFileHandler` → `atomicWrite` → `markSelfWrite` → watcher suppressed. No false "external edit" toast.

**Conclusion:** No action needed. The existing watcher suppression works correctly for agent-initiated saves.

[VERIFIED: `packages/desktop/src/bun/index.ts` — `saveFile` RPC calls `saveFileHandler` which calls `atomicWrite` which calls `markSelfWrite`]

### L-07: Zustand In-Place Mutations for Status/Type/Notes/Metadata

**What:** `updateNodeStatus`, `updateNodeType`, `updateNodeNotes`, `updateNodeMetadata` all mutate the node object **in-place** via `nodeIndex.get(nodeId)` — they do NOT create a new node object. This is intentional (performance: avoids react-d3-tree deep-clone). `updateNodeMetadata` currently accepts a full `Record<string, unknown>` and replaces the whole metadata object.

**Phase 6 impact:** D-04 requires shallow-PATCH semantics for `updateNodeMetadata`. The current store action does a full replace. The renderer handler must implement the patch manually:

```typescript
case "updateNodeMetadata": {
  const node = store.nodeIndex.get(args.nodeId as string);
  if (!node) return { ok: false, ... };
  const patch = args.patch as Record<string, unknown | null>;
  const current = node.metadata ?? {};
  const next: Record<string, unknown> = { ...current };
  for (const [k, v] of Object.entries(patch)) {
    if (v === null) delete next[k];
    else next[k] = v;
  }
  store.updateNodeMetadata(args.nodeId as string, next);
  return { ok: true, data: { metadata: next } };
}
```

The patch logic lives in the renderer handler, not the store action (the store action is already used by the side-panel editor which passes full metadata).

[VERIFIED: `roadmapStore.ts: updateNodeMetadata` line 688-696 — full replace, not patch]

### L-08: moveNode — No Existing Store Action

**What:** `roadmapStore` has `moveNodeUp` and `moveNodeDown` (reorder within siblings) but no `moveNode(nodeId, newParentId, position?)` action that re-parents a node to a different parent.

**New store action needed:** `moveNode` must be added to `roadmapStore.ts`. It must:
1. Find the node by ID and remove it from its current parent's children array
2. Detect cycles (if `newParentId` is a descendant of `nodeId`, reject)
3. Check `$ref` ownership boundary (if `nodeId`'s owner ≠ `newParentId`'s owner, reject with `cross_ref_boundary`)
4. Insert into `newParentId`'s children at `position` (or end if omitted)
5. Call `bumpStructural`

The `getOwnership()` function from `refMap.ts` is available in the renderer... actually wait — `refMap.ts` is a Bun-side module (`packages/desktop/src/bun/refMap.ts`). The renderer store does not have access to the ownership map directly. The ownership information is sent to the renderer via `pushOwnershipMap` at load time.

**Check if renderer has ownership data:** The renderer receives `pushOwnershipMap` which populates... let me verify.

[VERIFIED: `shared/types.ts` — `pushOwnershipMap: { entries: Array<[string, string]> }` is a webview message; renderer must store this to check ownership]

The renderer currently receives ownership data but there is no evidence it stores it. The `EDIT-16` cross-boundary block on user moves is implemented via... checking `packages/desktop/src/mainview/store/roadmapStore.ts` — the store does not have an `ownershipMap` slice.

**Action required by planner:** The ownership check for `moveNode` must either:
- **Option A:** Read the ownership map that Bun pushes via `pushOwnershipMap`. The renderer handler must cache this in store or module state.
- **Option B:** Do the cross-ref boundary check in the Bun request handler (before forwarding to renderer), using `getOwnership()` from `refMap.ts`.

**Recommendation: Option B — check cross-ref boundary in Bun before forwarding.** Bun has the authoritative ownership map. The renderer handler only needs to do the cycle check and the structural mutation.

### L-09: MCP Tool Return Shape for Errors

**What:** The MCP SDK `registerTool` callback must return `{ content: [{ type: "text", text: "..." }], isError?: boolean }`. When a tool fails, returning `isError: true` causes the MCP host to surface it as an error to the LLM. The error `code` string is embedded in the `text` content because MCP does not have a structured error field in tool results (per MCP spec 2024-11-05 onward).

**Pattern to use:**
```typescript
// On structured error:
return {
  content: [{ type: "text", text: `Error (${code}): ${message}. ${hint ?? ""}`.trim() }],
  isError: true,
};

// On success:
return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
```

This follows the pattern already used in the existing `updateNodeStatus` tool.

[VERIFIED: `plugins/claude-code/src/server.ts` lines 42-70 — existing error handling pattern with `isError: true`]
[VERIFIED: MCP SDK installed at `@modelcontextprotocol/sdk` version 1.29.0 — `registerTool` API confirmed in `mcp.d.ts`]

---

## Validation Architecture

`workflow.nyquist_validation: true` in `.planning/config.json` — this section is required.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest 4.1.4 (workspace-pinned) |
| Config file | `packages/desktop/vitest.config.ts` (desktop unit), `plugins/claude-code/vitest.config.ts` (plugin unit) |
| Quick run command | `bun run test:desktop` |
| Full suite command | `bun run test` |
| Bun-native test command | `bun test packages/desktop/tests/unit/bun/` (for Bun.serve-dependent files) |

### TDD Candidates vs Standard

Per `tdd.md` heuristics:
- **TDD:** `findNodes` filter logic (AND-combination, 6 fields, case-insensitive), `deleteNode` cascade gate, `updateNodeMetadata` patch semantics, `moveNode` cycle detection, error taxonomy dispatch, `wsClient.request` correlation ID round-trip
- **Standard:** MCP `registerTool` registrations (glue), `agentRequest` RPC wiring (connector), drawer event append (uses existing `appendEvents`)

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Location |
|--------|----------|-----------|-------------------|---------------|
| PLUG-AGENT-READ-03 | `findNodes` AND-filter all 6 fields | unit (TDD) | `bun run test:desktop` | `tests/unit/bun/agentRequestHandler.test.ts` (new) |
| PLUG-AGENT-DELETE-01 | Cascade gate: non-leaf no cascade → `cascade_required` | unit (TDD) | `bun run test:desktop` | `tests/unit/bun/agentRequestHandler.test.ts` |
| PLUG-AGENT-DELETE-01 | Last-root gate: `cannot_delete_last_root` | unit (TDD) | `bun run test:desktop` | `tests/unit/bun/agentRequestHandler.test.ts` |
| PLUG-AGENT-UPDATE-04 | `updateNodeMetadata` PATCH semantics: null deletes key, unlisted preserved | unit (TDD) | `bun run test:desktop` | `tests/unit/bun/agentRequestHandler.test.ts` |
| PLUG-AGENT-UPDATE-05 | `moveNode` cycle detection | unit (TDD) | `bun run test:desktop` | `tests/unit/bun/agentRequestHandler.test.ts` |
| PLUG-AGENT-TRANSPORT-02 | `wsClient.request` correlation: resolve on matching id, reject on timeout | unit (TDD) | `bun run test` (plugin) | `plugins/claude-code/tests/wsClient.test.ts` (extend) |
| PLUG-AGENT-TRANSPORT-01 | Bun `type:'request'` discriminator: routes to handler, not coalescer | unit | `bun test` (bun-native) | `packages/desktop/tests/unit/bun/eventServer.test.ts` (extend) |
| PLUG-AGENT-SAFETY-01 | Error codes returned for each gate | unit | `bun run test:desktop` | `tests/unit/bun/agentRequestHandler.test.ts` |
| PLUG-AGENT-SAFETY-02 | Drawer event written for each mutating tool | unit (renderer) | `bun run test:desktop` | `tests/unit/ui/agentRpcHandler.test.ts` (new) |
| PLUG-AGENT-FILE-03 | `openFile` flushes before loading (D-12) | unit | `bun run test:desktop` | `tests/unit/bun/agentRequestHandler.test.ts` |
| PLUG-AGENT-FILE-02 | `saveFileAs` path-traversal allowlist check | unit | `bun run test:desktop` | extend `saveFile.test.ts` |
| Full scaffold story | `createRoadmap` → 30× `createNode` → `saveFile` → file on disk | E2E integration | `bun run test` (integration) | `packages/desktop/tests/integration/agentScaffold.test.ts` (new) |
| Phase gate | All tools callable end-to-end via MCP stdio | acceptance (human) | Manual Claude Code session | per `06-HUMAN-UAT.md` |

### Sampling Rate

- **Per task commit:** `bun run test:desktop` (unit suite, ~30s)
- **Per wave merge:** `bun run test` (full suite all workspaces)
- **Phase gate:** Full suite green + human UAT ("scaffold a roadmap for migrating service X") before `/gsd-verify-work`

### Wave 0 Gaps

- `packages/desktop/tests/unit/bun/agentRequestHandler.test.ts` — new TDD file (covers PLUG-AGENT-READ-03, DELETE-01, UPDATE-04, UPDATE-05, SAFETY-01, FILE-03)
- `packages/desktop/tests/unit/ui/agentRpcHandler.test.ts` — new file for renderer handler (covers PLUG-AGENT-SAFETY-02)
- `packages/desktop/tests/integration/agentScaffold.test.ts` — new integration test for full scaffold story
- `plugins/claude-code/tests/wsClient.test.ts` — extend existing file for `request()` method (PLUG-AGENT-TRANSPORT-02)

---

## Security Domain

`security_enforcement` not explicitly set to false in config — included.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | Localhost-only; no auth (Phase 4 D-03) |
| V3 Session Management | No | Single-user desktop app |
| V4 Access Control | YES | Path-traversal allowlist (`isPathWithinMainDir` + `pushDialogAllowlistPath`) |
| V5 Input Validation | YES | Zod schemas at MCP tool boundary + RPC boundary |
| V6 Cryptography | No | No secrets; no encryption needed |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Path traversal via `openFile`/`saveFileAs` | Elevation of Privilege | `isPathWithinMainDir` check in Bun handler (D-13); same allowlist as user actions |
| Overwrite arbitrary files via `saveFileAs` | Tampering | Allowlist check blocks out-of-directory writes; no `..` traversal allowed |
| Resource exhaustion via rapid `createNode` calls | Denial of Service | Last-write-wins + autosave coalescing naturally rate-limits disk writes; no per-tool rate limit needed in v1 |
| Injection via metadata values | Tampering | `metadata` is stored as `Record<string, unknown>` in JSON; no SQL, no shell execution; no injection surface |
| Kill-switch bypass | Tampering | `agentApi.enabled` check is first gate in Bun request handler; cannot be bypassed via WS protocol |

---

## Open Questions for Planner

1. **`moveNode` ownership check implementation** — confirmed that the renderer store does not currently cache the ownership map. Planner must decide: (a) add an `ownershipMap` slice to `roadmapStore` populated from `pushOwnershipMap`, or (b) do the cross-ref check in the Bun request handler before `agentRequest` RPC. Recommendation: (b) — Bun is the authoritative owner of the ownership map, so the check belongs there. Planner should verify by reading `packages/desktop/src/mainview/` for any existing ownership map caching.

2. **`createNode` default status** — when `status` is not provided, should the tool use the first entry in `statusConfig` (dynamic, requires a read) or hardcode `"not-started"` (matches `makeNewNode()` behavior)? Recommendation: match `makeNewNode()` which uses `"not-started"` unconditionally, and document that agents should call `getStatusConfig` first if using a custom schema.

3. **Timeout values** — the research recommends 30s for all requests. For large `getRoadmap` calls on big schemas, this may be too tight. Planner should confirm or split into read timeout (30s) vs mutation timeout (10s).

4. **`wsClient.ts` reconnect race** — the existing STATE.md notes a known bug: the `close` handler unconditionally calls `scheduleReconnect`, racing with `connectLoop`. Phase 6 adds the `pending` map which must be cleared on close. Planner should confirm whether fixing the existing reconnect bug is in Phase 6 scope or still deferred.

5. **`agentRequest` RPC `maxRequestTime`** — the Bun RPC is configured with `maxRequestTime: 120_000` (2 minutes). Large `getRoadmap` calls should complete in <1s, so this is fine. But if an `openFile` on a large file with many `$ref` takes longer than the WS request timeout (30s), the WS times out but the RPC may still be in-flight. Planner should decide whether to set a shorter `maxRequestTime` override for the `agentRequest` method or accept this.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| WS correlation IDs | Custom framing from scratch | The pattern described in Transport Design | JSON-RPC 2.0 semantics are well-specified; follow them |
| Input validation | Custom validators per tool | Zod schemas reusing `RoadmapNodeSchema` from `@roadraven/core` | Already imported in plugin; handles edge cases |
| Drawer audit log | New UI components | Extend `eventLogStore.appendEvents` with `IntegrationEvent` | Already virtualized, filtered, and visible |
| Path security | Custom path-traversal guard | `isPathWithinMainDir` + `pushDialogAllowlistPath` in `saveFile.ts` | Already battle-tested with tests |
| Autosave on mutation | Per-tool file flush | Existing Phase 3 debounced autosave pipeline | `flushPending` + `saveFileHandler` already handle all edge cases |
| moveNode structural mutation | New tree-walk code | Extend `immutablyReplaceArray` pattern from `roadmapStore.ts` | Existing pattern handles all tree mutations consistently |

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `server.tool()` (deprecated) | `server.registerTool()` | MCP SDK ~1.10+ | Use `registerTool` — `tool()` is still functional but deprecated per MCP SDK 1.29.0 source |
| JSON-RPC spec error shape `{ code: number, message, data }` | Custom string code shape | Phase 6 design | Using string codes (not integer codes) is more readable in agent prompts; deviates from JSON-RPC 2.0 error number convention but is simpler |

**Deprecated/outdated:**
- `server.tool()` API: still works in 1.29.0 but deprecated — use `server.registerTool()` (already used in `server.ts`)

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | WS request timeout of 30s is sufficient for `getRoadmap` on any realistic roadmap size | Transport Design | Agent calls may timeout on very large schemas; mitigation: add size guard |
| A2 | `liveEventMeta` in the renderer already contains the merged status (via `applyEventBatch` direct node mutation) — no separate merge step needed in read tools | Landmine L-04 | If applyEventBatch doesn't mutate node.status, reads would return stale authored status — confirmed by reading roadmapStore.ts line 848-850, this is LOW risk |
| A3 | Renderer does not currently cache ownership map from `pushOwnershipMap` | Landmine L-08 / Open Question 1 | If renderer does cache it (in a component or hook), the Bun-side check recommendation may change |
| A4 | 10s/30s timeout values chosen for mutations/reads | Transport Design | If the renderer RPC takes longer due to large trees, timeouts need adjustment |
| A5 | `cross_ref_boundary` detection can be handled entirely in Bun without a new store slice | Landmine L-08 | If Bun-side ownership map is cleared between operations, check may fail silently |

---

## Environment Availability

Phase 6 has no new external dependencies beyond what Phase 4 established.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `@modelcontextprotocol/sdk` | MCP server | ✓ | 1.29.0 | — |
| `zod` | Input validation | ✓ | 4.3.6 | — |
| Bun runtime | WS server, RPC bridge | ✓ | (project-pinned) | — |
| vitest | Tests | ✓ | 4.1.4 | — |

[VERIFIED: `plugins/claude-code/package.json` — `@modelcontextprotocol/sdk: ^1.29.0`, `zod: ^4.3.6`]

---

## Sources

### Primary (HIGH confidence)
- `plugins/claude-code/src/server.ts` — existing `registerTool` pattern, error response shape
- `plugins/claude-code/src/wsClient.ts` — one-way WS client, backoff logic, connection lifecycle
- `packages/desktop/src/mainview/store/roadmapStore.ts` — all store actions, liveEventMeta, nodeIndex, findParentAndIndex
- `packages/desktop/src/bun/eventServer.ts` — inbound message discriminator, hello-frame handling
- `packages/desktop/src/bun/saveFile.ts` — allowlist, flushPending, isPathWithinMainDir
- `shared/types.ts` — RoadmapRPCType pattern
- `packages/core/src/schema.ts` — RoadmapNode, RoadmapSchema Zod schemas
- `packages/core/src/plugin.ts` — IntegrationEvent shape
- `@modelcontextprotocol/sdk` version 1.29.0 installed at `plugins/claude-code/node_modules/` — `registerTool` API confirmed in `mcp.d.ts`

### Secondary (MEDIUM confidence)
- `.planning/phases/04-event-api/04-CONTEXT.md` — D-25 debounce, D-14 live window, D-09 drawer taxonomy
- `.planning/phases/03-full-editor/03-CONTEXT.md` — autosave pipeline, path-traversal allowlist, $ref ownership
- `packages/desktop/src/mainview/store/eventLogStore.ts` — `appendEvents` signature, IntegrationEvent row shape

### Tertiary (LOW confidence)
- JSON-RPC 2.0 specification (www.jsonrpc.org) — error object conventions [ASSUMED from training]
- LSP WS-RPC correlation ID pattern [ASSUMED from training]
- Phoenix Channels framing [ASSUMED from training]

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already installed and verified in codebase
- Architecture: HIGH — all patterns verified in existing code; no new patterns introduced
- Transport design: MEDIUM — custom WS framing is a new design; implementation details confirmed against existing code patterns
- Pitfalls: HIGH — all landmines verified against actual source files

**Research date:** 2026-05-05
**Valid until:** 2026-06-05 (stable libraries; MCP SDK may release updates — recheck if SDK bumped before planning)
