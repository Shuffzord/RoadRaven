# Phase 6: Agentic Roadmap Authoring - Pattern Map

**Mapped:** 2026-05-05
**Files analyzed:** 11 new/modified files
**Analogs found:** 11 / 11

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `plugins/claude-code/src/server.ts` (modify) | MCP tool registry | request-response | itself (current 2-tool version) | exact |
| `plugins/claude-code/src/tools/schemas.ts` (new) | Zod schema definitions | — (types only) | `packages/core/src/schema.ts` | role-match |
| `plugins/claude-code/src/wsClient.ts` (modify) | WS request/response client | request-response | itself (current one-way version) | exact |
| `packages/desktop/src/bun/agentRequestHandler.ts` (new) | Bun request router | request-response | `packages/desktop/src/bun/eventServer.ts` message handler | role-match |
| `packages/desktop/src/bun/eventSchema.ts` (modify) | Zod parse boundary | — (types only) | itself (current 2-type union) | exact |
| `packages/desktop/src/bun/eventServer.ts` (modify) | WS message dispatcher | event-driven + request-response | itself (current `hello` discriminator) | exact |
| `shared/types.ts` (modify) | RPC contract + settings types | — (types only) | itself (current `RoadmapRPCType`) | exact |
| `packages/desktop/src/mainview/rpc/agentRpcHandler.ts` (new) | Renderer RPC handler / store dispatcher | request-response | `packages/desktop/src/mainview/rpcHandlers.ts` | role-match |
| `packages/desktop/src/mainview/store/roadmapStore.ts` (modify — add `moveNode`) | Store action | CRUD | `moveNodeUp` / `moveNodeDown` actions within the same file | exact |
| `packages/desktop/tests/unit/bun/agentRequestHandler.test.ts` (new) | Vitest unit test (Bun-side) | — | `packages/desktop/tests/unit/bun/eventSchema.test.ts` | role-match |
| `plugins/claude-code/tests/wsClient.test.ts` (modify) | Vitest unit test (plugin-side) | — | itself (current reconnect tests) | exact |

---

## Pattern Assignments

---

### `plugins/claude-code/src/server.ts` — extend with ~17 new `registerTool` calls

**Analog:** itself — `plugins/claude-code/src/server.ts` (lines 1–97)

**Imports pattern** (lines 1–6 — copy exactly; add `wsClient.request` in each new tool callback):
```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { readSentinel } from "./sentinel";
import { createWsClient } from "./wsClient";
```

**`registerTool` shape** — copy the existing `updateNodeStatus` registration verbatim as the template for every new tool (lines 20–71). The three structural pieces are:

1. Tool name (string, flat camelCase — matches existing `updateNodeStatus`, `getEventApiStatus`)
2. Config object: `{ title, description, inputSchema: z.object({...}) }`
3. Async callback: validate sentinel → call `wsClient.request(method, params)` → return `{ content }` or `{ content, isError: true }`

```typescript
// lines 20–71 — master template to copy for each new tool:
server.registerTool(
  "updateNodeStatus",             // ← replace with new tool name
  {
    title: "Update RoadRaven node status",
    description: "...",
    inputSchema: z.object({
      nodeId: z.string().min(1).describe("The node UUID from the roadmap"),
      status: z.string().min(1).describe("..."),
      meta: z.record(z.string(), z.unknown()).optional().describe("..."),
    }),
  },
  async ({ nodeId, status, meta }) => {    // ← destructure from inputSchema
    try {
      await wsClient.send({ nodeId, status, meta });           // ← replace with wsClient.request(...)
      return { content: [{ type: "text", text: "ok" }] };
    } catch {
      const sentinel = await readSentinel();
      if (!sentinel.ok) {
        return {
          content: [{ type: "text", text: "Roadmap Viewer is not running. Start the app and retry." }],
          isError: true,
        };
      }
      return {
        content: [{ type: "text", text: `Roadmap Viewer is running but the Event API is unreachable at ${sentinel.url}. Check the logs for startup errors.` }],
        isError: true,
      };
    }
  },
);
```

**New tool callback shape using `wsClient.request`** — replace the `wsClient.send` call with:
```typescript
async (args) => {
  try {
    const result = await wsClient.request<ResultType>("toolMethodName", args);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  } catch (err: unknown) {
    const sentinel = await readSentinel();
    if (!sentinel.ok) {
      return {
        content: [{ type: "text", text: "Roadmap Viewer is not running. Start the app and retry." }],
        isError: true,
      };
    }
    const code = (err as { code?: string }).code ?? "internal_error";
    const hint = (err as { hint?: string }).hint ?? "";
    const message = (err as Error).message ?? "Unknown error";
    return {
      content: [{ type: "text", text: `Error (${code}): ${message}${hint ? ` ${hint}` : ""}` }],
      isError: true,
    };
  }
}
```

**Shutdown + transport** (lines 89–97 — keep unchanged):
```typescript
const shutdown = async () => {
  await wsClient.close();
  process.exit(0);
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

const transport = new StdioServerTransport();
await server.connect(transport);
```

---

### `plugins/claude-code/src/tools/schemas.ts` — new Zod schema file for tool inputs

**Analog:** `packages/core/src/schema.ts` (lines 1–60) — same Zod-first pattern; import from `@roadraven/core` and compose.

**Imports pattern:**
```typescript
import { z } from "zod";
import {
  RoadmapNodeSchema,
  RoadmapSchemaSchema,
  StatusConfigSchema,
  TypeConfigSchema,
} from "@roadraven/core";
```

**Schema authoring pattern** (copy from `packages/core/src/schema.ts` lines 17–50):
```typescript
// Each exported const is a z.object({...}) with .describe() on every field
export const CreateNodeInputSchema = z.object({
  parentId: z.string().uuid().describe("UUID of the parent node"),
  title: z.string().min(1).max(200).describe("Node title"),
  type: z.string().optional().describe("Node type string"),
  status: z.string().optional().describe("Status id — defaults to first statusConfig entry"),
  notes: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const FindNodesInputSchema = z.object({
  titleContains: z.string().optional(),
  status: z.string().optional(),
  type: z.string().optional(),
  metaKey: z.string().optional(),
  metaValue: z.unknown().optional(),
  parentId: z.string().uuid().optional(),
});
// ... one export per tool that needs a non-trivial schema
```

**Key deviations from `RoadmapNodeSchema`:** Use `z.string().min(1)` for `status` fields (not a fixed enum) — user-defined statuses must be accepted (Phase 4 D-26 / RESEARCH §11).

---

### `plugins/claude-code/src/wsClient.ts` — add `request()` method

**Analog:** itself — `plugins/claude-code/src/wsClient.ts` (lines 1–116)

**Interface extension** (replace lines 18–22 with):
```typescript
export interface WsClient {
  send(event: OutgoingEvent): Promise<void>;
  request<T = unknown>(method: string, params: Record<string, unknown>): Promise<T>;
  isConnected(): boolean;
  close(): Promise<void>;
}
```

**New module-level `pending` map** (add after `let attempt = 0;` at line 28):
```typescript
interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
  timer: ReturnType<typeof setTimeout>;
}
const pending = new Map<string, PendingRequest>();
```

**`connectOnce` — attach persistent `message` listener** (inside the `new Promise<boolean>` at line 41, alongside existing `open`/`error`/`close` listeners):
```typescript
socket.addEventListener("message", (evt) => {
  try {
    const msg = JSON.parse((evt as MessageEvent).data as string) as Record<string, unknown>;
    if (msg.type === "response" && typeof msg.id === "string" && pending.has(msg.id)) {
      const entry = pending.get(msg.id)!;
      clearTimeout(entry.timer);
      pending.delete(msg.id);
      if (msg.error) {
        const err = Object.assign(new Error((msg.error as { message: string }).message), {
          code: (msg.error as { code?: string }).code,
          hint: (msg.error as { hint?: string }).hint,
          data: (msg.error as { data?: unknown }).data,
        });
        entry.reject(err);
      } else {
        entry.resolve(msg.result);
      }
    }
  } catch { /* ignore non-JSON or non-response messages */ }
});
```

**`close` handler — reject pending before reconnect** (modify lines 59–65 to add pending cleanup):
```typescript
socket.addEventListener("close", () => {
  connected = false;
  ws = null;
  // Reject all in-flight requests on disconnect
  for (const [id, entry] of pending) {
    clearTimeout(entry.timer);
    entry.reject(new Error("WebSocket disconnected during request"));
  }
  pending.clear();
  if (!stopped) {
    scheduleReconnect();
  }
});
```

**`request` method** (add to the returned object alongside `send`, using the same guard pattern as `send` at lines 96–100):
```typescript
request<T = unknown>(method: string, params: Record<string, unknown>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    if (!connected || ws === null) {
      reject(new Error("Not connected to Roadmap Viewer Event API."));
      return;
    }
    const id = crypto.randomUUID();
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`Agent request timed out: ${method}`));
    }, 30_000);
    pending.set(id, { resolve: resolve as (v: unknown) => void, reject, timer });
    ws.send(JSON.stringify({ type: "request", id, method, params }));
  });
},
```

---

### `packages/desktop/src/bun/eventSchema.ts` — add `AgentRequest` to parse union

**Analog:** itself — `packages/desktop/src/bun/eventSchema.ts` (lines 1–67, read entirely above)

**New schema to add** (after `EventFrameSchema`, before `IncomingFrameSchema`):
```typescript
// Add AgentRequest shape to the three-way discriminated union
export const AgentRequestSchema = z.object({
  type: z.literal("request"),
  id: z.string().min(1),
  method: z.string().min(1),
  params: z.record(z.string(), z.unknown()),
});

export type AgentRequest = z.infer<typeof AgentRequestSchema>;
```

**Update `IncomingFrameSchema`** (line 29 — change union to three-way):
```typescript
// Before:
const IncomingFrameSchema = z.union([HelloFrameSchema, EventFrameSchema]);
// After:
const IncomingFrameSchema = z.union([HelloFrameSchema, AgentRequestSchema, EventFrameSchema]);
```

**Update `parseIncoming` return type** (lines 53–67):
```typescript
// Before return type:
| { ok: true; frame: HelloFrame | EventFrame }
// After:
| { ok: true; frame: HelloFrame | AgentRequest | EventFrame }
```

The `parseIncoming` function body is unchanged — `IncomingFrameSchema.safeParse` handles the wider union automatically.

---

### `packages/desktop/src/bun/eventServer.ts` — add `type: 'request'` branch

**Analog:** itself — `packages/desktop/src/bun/eventServer.ts` (lines 124–211, the `websocket.message` handler)

**New `StartOptions` callback** (add to `StartOptions` interface at lines 44–53):
```typescript
// Add alongside existing onFlush, onEvent, onError, onConnectionChange:
onAgentRequest: (ws: ServerWebSocket<WsData>, request: AgentRequest) => void;
```

**New branch in `message` handler** (insert after `hello` check at line 162, before the event-frame path at line 164 — copy the branch structure from the existing `hello` check):
```typescript
// Existing hello branch (lines 156–162) — keep unchanged:
if ("type" in frame && frame.type === "hello") {
  ws.data.source = frame.source;
  ws.data.version = frame.version;
  ws.data.helloAt = Date.now();
  serverLogger.info`Hello frame from source=${frame.source} version=${frame.version ?? "unset"}`;
  return;
}

// NEW — agent request branch (insert here):
if ("type" in frame && frame.type === "request") {
  opts.onAgentRequest(ws, frame as AgentRequest);
  return;  // does NOT enter coalescer
}

// Event frame path (lines 164+) — keep unchanged
```

**`StartOptions.onAgentRequest` wiring** (in `packages/desktop/src/bun/index.ts`, alongside the existing `onFlush`/`onEvent` callbacks at lines 100–121):
```typescript
onAgentRequest: (ws, request) => {
  void agentRequestHandler(ws, request, mainWindow);
},
```

---

### `packages/desktop/src/bun/agentRequestHandler.ts` — new Bun-side request router

**Analog:** The `message` handler in `packages/desktop/src/bun/eventServer.ts` (lines 124–211) for overall structure; `packages/desktop/src/bun/saveFile.ts` (lines 80–165) for the path-traversal guard pattern.

**Imports pattern** (mirror `eventServer.ts` lines 1–19 style):
```typescript
import type { ServerWebSocket } from "bun";
import { getLogger } from "@logtape/logtape";
import type { RoadmapRPCType } from "../../../../shared/types";
import type { AgentRequest } from "./eventSchema";
import {
  flushPending,
  isPathWithinMainDir,
  pushDialogAllowlistPath,
} from "./saveFile";
import { loadSettings } from "./settings";

const agentLogger = getLogger(["roadraven", "agent"]);
```

**Core dispatch pattern** — single `switch` on `request.method` routing to `mainWindow.webview.rpc.request.agentRequest`. Copy the structured-error return shape from `eventServer.ts`'s `onError` call sites:
```typescript
export async function agentRequestHandler(
  ws: ServerWebSocket<{ id: string; source?: string }>,
  request: AgentRequest,
  mainWindow: { webview: { rpc?: { request: RoadmapRPCType["bun"]["requests"] } } },
): Promise<void> {
  const start = Date.now();

  // Kill-switch check (RESEARCH §13)
  const settings = loadSettings();
  if (settings.agentApi?.enabled === false) {
    sendResponse(ws, request.id, null, {
      code: "agent_api_disabled",
      message: "Agent API is disabled in application settings.",
      hint: "Enable it in .roadmap-settings.json: agentApi.enabled = true",
    });
    return;
  }

  try {
    const result = await mainWindow.webview.rpc!.request.agentRequest({
      tool: request.method,
      args: request.params,
    });
    const durationMs = Date.now() - start;
    agentLogger.info`Agent tool call`, {
      tool: request.method,
      args: request.params,
      result: result.ok ? "ok" : result.code,
      durationMs,
    };
    if (result.ok) {
      sendResponse(ws, request.id, result.data, null);
    } else {
      sendResponse(ws, request.id, null, {
        code: result.code,
        message: result.error,
        hint: result.hint,
        data: result.data,
      });
    }
  } catch (err) {
    agentLogger.error`Agent request internal error: ${String(err)}`;
    sendResponse(ws, request.id, null, {
      code: "internal_error",
      message: "An internal error occurred.",
      hint: "Check app logs for details.",
    });
  }
}

function sendResponse(
  ws: ServerWebSocket<unknown>,
  id: string,
  result: unknown,
  error: { code: string; message: string; hint?: string; data?: unknown } | null,
): void {
  if (error) {
    ws.send(JSON.stringify({ type: "response", id, error }));
  } else {
    ws.send(JSON.stringify({ type: "response", id, result }));
  }
}
```

**Logging pattern** (copy from `packages/desktop/src/bun/logging.ts` — `serverLogger` shape, lines 79–80):
```typescript
// serverLogger uses getLogger(["roadraven", "events", "server"])
// agentLogger uses getLogger(["roadraven", "agent"])  — same hierarchy, new leaf
const agentLogger = getLogger(["roadraven", "agent"]);
// Usage: agentLogger.info`Agent tool call`, { tool, args, result, durationMs }
```

---

### `shared/types.ts` — add `agentRequest` RPC entry + `agentApi` settings field

**Analog:** itself — `shared/types.ts` (lines 57–162, read entirely above)

**New `bun.requests` entry** (add after `getEventApiState` block at line 119, inside the `requests` object):
```typescript
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

**New `AppSettings` field** (add to `AppSettings` interface at lines 29–37, copy the `eventApi` optional-object pattern at lines 33–37):
```typescript
// Existing pattern to copy (lines 33–37):
eventApi?: {
  /** User-specified WebSocket port override. */
  port?: number;
};
// New entry (same optional-object pattern):
agentApi?: {
  /** Set to false to disable the agent mutation API while keeping event push alive. */
  enabled?: boolean;
};
```

---

### `packages/desktop/src/mainview/rpc/agentRpcHandler.ts` — new renderer handler

**Analog:** `packages/desktop/src/mainview/rpcHandlers.ts` (lines 1–81, read entirely above) for the dynamic-import + store access pattern.

**File location note:** RESEARCH.md places this at `packages/desktop/src/mainview/rpc/agentRpcHandler.ts`. The `rpc/` subdirectory does not yet exist — create it alongside the file.

**Imports pattern** (copy `rpcHandlers.ts` lines 18–20 style — dynamic imports inside each case avoid circular deps):
```typescript
import type { IntegrationEvent } from "../../../../shared/types";
// Store imports are dynamic (same as rpcHandlers.ts) to break circular deps
```

**Handler registration** — this file exports a single `handleAgentRequest` function that is called from `rpc.ts` as an `agentRequest` request handler. Copy the `rpc.ts` message handler pattern (lines 6–43):
```typescript
// In packages/desktop/src/mainview/rpc.ts, add to handlers.requests:
agentRequest: async ({ tool, args }) => {
  const { handleAgentRequest } = await import("./rpc/agentRpcHandler");
  return handleAgentRequest(tool, args);
},
```

**Core switch pattern** — copy `rpcHandlers.ts` per-handler function shape:
```typescript
export async function handleAgentRequest(
  tool: string,
  args: Record<string, unknown>,
): Promise<{ ok: true; data: unknown } | { ok: false; error: string; code: string; hint?: string; data?: unknown }> {
  const { useRoadmapStore } = await import("../store/roadmapStore");
  const { useEventLogStore } = await import("../store/eventLogStore");
  const store = useRoadmapStore.getState();

  // Gate: no file loaded
  if (!store.schema) {
    return {
      ok: false,
      error: "No roadmap file is loaded.",
      code: "no_file_loaded",
      hint: "Open a roadmap or call openFile(path).",
    };
  }

  switch (tool) {
    case "getRoadmap":
      return { ok: true, data: { schema: store.schema, filePath: store.filePath, isUntitled: store.isUntitled } };

    case "getNode": {
      const node = store.nodeIndex.get(args.nodeId as string);
      if (!node) return { ok: false, error: `Node '${args.nodeId}' not found.`, code: "node_not_found", hint: "Call getRoadmap or findNodes to discover node IDs." };
      return { ok: true, data: { node, parentId: null /* compute via findParentAndIndex */, ancestorIds: [] } };
    }

    case "createNode": {
      const newId = store.addChild(args.parentId as string, args.title as string);
      if (!newId) return { ok: false, error: `Parent node '${args.parentId}' not found.`, code: "node_not_found" };
      appendAgentDrawerEvent("createNode", newId, args, store, useEventLogStore.getState());
      return { ok: true, data: { nodeId: newId } };
    }

    // ... remaining cases follow same pattern
    default:
      return { ok: false, error: `Unknown tool: ${tool}`, code: "unknown_tool", hint: "Update the plugin to a version that matches the app." };
  }
}
```

**Drawer event append helper** (D-09 — copy `handlePushEventLog` in `rpcHandlers.ts` lines 76–81 as structural model):
```typescript
function appendAgentDrawerEvent(
  tool: string,
  nodeId: string,
  args: Record<string, unknown>,
  _store: ReturnType<typeof import("../store/roadmapStore").useRoadmapStore.getState>,
  eventLogStore: ReturnType<typeof import("../store/eventLogStore").useEventLogStore.getState>,
): void {
  const event: IntegrationEvent = {
    nodeId,
    status: (_store.nodeIndex.get(nodeId)?.status) ?? "unknown",
    source: "claude-code",
    timestamp: new Date().toISOString(),
    meta: {
      tool,
      args,
      label: `Claude → ${tool}`,
    },
  };
  eventLogStore.appendEvents([event]);
}
```

`IntegrationEvent` shape (from `packages/core/src/plugin.ts` lines 1–12):
```typescript
interface IntegrationEvent {
  nodeId: string;      // primary affected node ("__lifecycle__" for file ops)
  status: string;      // current status after mutation
  meta?: Record<string, unknown>;  // tool + args + human-readable label
  source?: string;     // "claude-code"
  timestamp?: string;  // ISO 8601
  _error?: "malformed" | "unknown_node" | "invalid_status";  // NOT set for agent events
}
```

---

### `packages/desktop/src/mainview/store/roadmapStore.ts` — add `moveNode` action

**Analog:** `moveNodeUp` / `moveNodeDown` within the same file (lines 611–650, read above).

**Interface addition** (add after `moveNodeDown` at line 257):
```typescript
moveNode: (nodeId: string, newParentId: string, position?: number) => void;
```

**Implementation pattern** (copy `moveNodeUp` / `moveNodeDown` structure at lines 611–650, using `immutablyReplaceArray`):
```typescript
moveNode: (nodeId, newParentId, position) => {
  const schema = get().schema;
  if (!schema) return;
  const nodes = schema.nodes;

  // Find the node to move
  const found = findParentAndIndex(nodes, nodeId);
  if (!found) return;
  const node = found.parentArray[found.index];

  // Remove from current parent
  const currentParentId = found.parent ? found.parent.id : null;
  const nodesAfterRemove = immutablyReplaceArray(nodes, currentParentId, (arr) => {
    const copy = [...arr];
    copy.splice(found.index, 1);
    return copy;
  });

  // Insert at new parent (cycle check is performed in agentRequestHandler before this call)
  const nextNodes = immutablyReplaceArray(nodesAfterRemove, newParentId, (arr) => {
    const copy = [...arr];
    const pos = position !== undefined ? Math.min(position, copy.length) : copy.length;
    copy.splice(pos, 0, node);
    return copy;
  });

  bumpStructural(nextNodes);
},
```

**Cycle detection** — performed in `agentRequestHandler.ts` (Bun side) before forwarding, NOT in the store action. Use the existing `findParentAndIndex` tree walk to check if `newParentId` is a descendant of `nodeId`.

---

## Shared Patterns

### Error Response Shape
**Source:** `plugins/claude-code/src/server.ts` lines 42–70 (existing `updateNodeStatus` error paths)
**Apply to:** All 19 `registerTool` callbacks in `server.ts`
```typescript
// Sentinel-missing branch:
return {
  content: [{ type: "text", text: "Roadmap Viewer is not running. Start the app and retry." }],
  isError: true,
};
// Structured error from wsClient.request (code + message + hint):
return {
  content: [{ type: "text", text: `Error (${code}): ${message}${hint ? ` ${hint}` : ""}` }],
  isError: true,
};
// Success:
return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
```

### Bun Structured Error Return
**Source:** `packages/desktop/src/bun/saveFile.ts` lines 119–165 (`saveFileHandler` guard pattern)
**Apply to:** Every gate check in `agentRequestHandler.ts` and `agentRpcHandler.ts`
```typescript
// Pattern: explicit { ok: false, error, code, hint? } before the happy path
if (!target) {
  return { ok: false, error: "saveFile: no file path — use saveFileAs" };
}
const resolved = resolve(target);
if (!isAllowlisted(resolved)) {
  bunLogger.warn`saveFile: filePath ${resolved} not in session allowlist; rejecting`;
  return { ok: false, error: "saveFile: filePath not in session allowlist ..." };
}
```

### Bun Logging
**Source:** `packages/desktop/src/bun/logging.ts` lines 79–80; `packages/desktop/src/bun/eventServer.ts` line 19
**Apply to:** `agentRequestHandler.ts`
```typescript
// Two existing loggers as models:
export const bunLogger = getLogger(["bun"]);
export const serverLogger = getLogger(["roadraven", "events", "server"]);
// New logger for agentRequestHandler.ts:
const agentLogger = getLogger(["roadraven", "agent"]);
// Usage (template literal style — matches all existing log call sites):
agentLogger.info`Agent tool call ${{ tool, durationMs }}`;
agentLogger.warn`Agent gate error ${{ code, tool }}`;
```

### Store Action Pattern (Structural Mutations)
**Source:** `packages/desktop/src/mainview/store/roadmapStore.ts` lines 469–516 (`addChild`, `addSiblingAbove`, `addSiblingBelow`)
**Apply to:** `moveNode` addition in `roadmapStore.ts`; also guides how `agentRpcHandler` dispatches to existing actions
```typescript
// Template: guard schema → find parent → immutably replace → bumpStructural → return
addChild: (parentId, title) => {
  const schema = get().schema;
  if (!schema) return null;
  const nodes = schema.nodes;
  const found = findParentAndIndex(nodes, parentId);
  if (!found) return null;
  const newNode = makeNewNode(title);
  const nextNodes = immutablyReplaceArray(nodes, parentId, (children) => [
    ...children,
    newNode,
  ]);
  bumpStructural(nextNodes);
  return newNode.id;
},
```

### Store Action Pattern (In-Place Mutations)
**Source:** `packages/desktop/src/mainview/store/roadmapStore.ts` lines 668–704 (`updateNodeStatus`, `updateNodeType`, `updateNodeNotes`, `updateNodeMetadata`)
**Apply to:** `agentRpcHandler` dispatch for those four tools
```typescript
// Template: nodeIndex.get → guard undefined → mutate in-place → bump statusTick
updateNodeType: (nodeId, type) => {
  const node = get().nodeIndex.get(nodeId);
  if (!node) return;
  if (node.type === type) return;
  node.type = type;
  node.updatedAt = new Date().toISOString();
  set({ statusTick: get().statusTick + 1 });
},
```

### Dynamic Import in Renderer Handlers
**Source:** `packages/desktop/src/mainview/rpcHandlers.ts` lines 31–41
**Apply to:** `agentRpcHandler.ts` — use `await import(...)` for store access, not top-level imports
```typescript
export async function handlePushStatusUpdate(msg: { ... }): Promise<void> {
  const { useRoadmapStore } = await import("./store/roadmapStore");
  useRoadmapStore.getState().applyEventBatch(msg.updates);
}
```

### RPC Message Handler Registration
**Source:** `packages/desktop/src/mainview/rpc.ts` lines 6–43 (`Electroview.defineRPC` handlers object)
**Apply to:** Adding `agentRequest` to the renderer-side `rpc.ts` `requests` section
```typescript
// Existing pattern for messages (copy for new request handler):
pushEventLog: (msg) => {
  import("./rpcHandlers").then(({ handlePushEventLog }) => {
    handlePushEventLog(msg);
  });
},
// New request handler (same import pattern, but in handlers.requests not handlers.messages):
// Note: requests return values, so use async/await form
```

### Drawer Event Append
**Source:** `packages/desktop/src/mainview/store/eventLogStore.ts` lines 45–53 (`appendEvents` action)
**Apply to:** `agentRpcHandler.ts` — every mutating tool case calls `useEventLogStore.getState().appendEvents([event])`
```typescript
appendEvents: (events) =>
  set((s) => {
    const merged = [...s.rows, ...events];
    const capped = merged.length > EVENT_LOG_ROW_CAP
      ? merged.slice(merged.length - EVENT_LOG_ROW_CAP)
      : merged;
    return { rows: capped };
  }),
```

---

## Test Patterns

### Plugin-side test (`plugins/claude-code/tests/wsClient.test.ts` — extend)

**Analog:** `plugins/claude-code/tests/wsClient.test.ts` (lines 1–187, read entirely above)

**MockWebSocket extension** — add `emit("message", ...)` capability (already present in the existing mock) to simulate server-side `type: "response"` frames. The existing mock already implements `addEventListener` + `emit`. No changes to the mock class needed.

**New test cases to add** (copy `describe` / `beforeEach` / `afterEach` scaffolding from lines 46–59):
```typescript
describe("WsClient request/response (Phase 6)", () => {
  // ... copy beforeEach/afterEach from existing describe block

  it("request() resolves when matching response arrives", async () => {
    const client = createWsClient({ source: "claude-code", version: "0.1.0" });
    await vi.waitFor(() => MockWebSocket.instances.length > 0);
    const ws = MockWebSocket.instances[0];
    ws.emit("open");

    const promise = client.request("getRoadmap", {});
    // Extract the sent message to get the id
    const sent = JSON.parse(ws.send.mock.calls.at(-1)![0]) as { id: string };
    // Simulate Bun response:
    ws.emit("message", { data: JSON.stringify({ type: "response", id: sent.id, result: { ok: true } }) });
    const result = await promise;
    expect(result).toEqual({ ok: true });
    await client.close();
  });

  it("request() rejects on timeout", async () => {
    vi.useFakeTimers();
    const client = createWsClient({ source: "claude-code", version: "0.1.0" });
    await vi.advanceTimersByTimeAsync(0);
    const ws = MockWebSocket.instances[0];
    ws.emit("open");

    const promise = client.request("getRoadmap", {});
    await vi.advanceTimersByTimeAsync(30_001);
    await expect(promise).rejects.toThrow("timed out");
    vi.useRealTimers();
    await client.close();
  });
});
```

### Bun-side test (`packages/desktop/tests/unit/bun/agentRequestHandler.test.ts` — new file)

**Analog:** `packages/desktop/tests/unit/bun/eventSchema.test.ts` (lines 1–121, read entirely above) for overall structure; `packages/desktop/tests/unit/store/roadmapStore.mutations.test.ts` (lines 1–79) for schema fixture helpers.

**Scaffolding template:**
```typescript
// Matches eventSchema.test.ts header comment style and import pattern
import { describe, expect, it, vi } from "vitest";
// import the handler under test once it exists:
// import { agentRequestHandler } from "../../../src/bun/agentRequestHandler";

// Mock mainWindow RPC (matches wsClient.test.ts vi.mock pattern)
// Mock roadmapStore with a fixture (matches roadmapStore.mutations.test.ts makeTestSchema())

describe("agentRequestHandler — findNodes filter", () => {
  it("AND-combines all provided fields", () => { ... });
  it("titleContains is case-insensitive", () => { ... });
});

describe("agentRequestHandler — deleteNode gates", () => {
  it("returns cascade_required for non-leaf without cascade:true", () => { ... });
  it("returns cannot_delete_last_root for single root", () => { ... });
});

describe("agentRequestHandler — updateNodeMetadata PATCH", () => {
  it("null value deletes the key", () => { ... });
  it("unlisted keys are preserved", () => { ... });
});

describe("agentRequestHandler — moveNode cycle detection", () => {
  it("returns move_would_create_cycle when newParentId is descendant", () => { ... });
});

describe("agentRequestHandler — kill-switch", () => {
  it("returns agent_api_disabled when agentApi.enabled === false", () => { ... });
});
```

### Renderer-side test (`packages/desktop/tests/unit/ui/agentRpcHandler.test.ts` — new file)

**Analog:** `packages/desktop/tests/unit/store/roadmapStore.mutations.test.ts` (lines 1–80) for fixture + store access pattern.

**Scaffolding template:**
```typescript
import { afterEach, describe, expect, it } from "vitest";
import { useEventLogStore } from "../../../src/mainview/store/eventLogStore";
import { useRoadmapStore } from "../../../src/mainview/store/roadmapStore";
// import { handleAgentRequest } from "../../../src/mainview/rpc/agentRpcHandler";

describe("agentRpcHandler — drawer events (D-09)", () => {
  afterEach(() => { /* reset stores */ });

  it("createNode appends IntegrationEvent with source='claude-code' and meta.tool='createNode'", async () => {
    // Load fixture schema into store
    // Call handleAgentRequest("createNode", { parentId, title })
    // Assert useEventLogStore.getState().rows has 1 entry matching expected shape
  });

  it("read tools (getRoadmap, getNode) do NOT append drawer events", async () => { ... });
});
```

---

## No Analog Found

All files have close analogs in the codebase. No entries needed here.

---

## Metadata

**Analog search scope:** `plugins/claude-code/src/`, `packages/desktop/src/bun/`, `packages/desktop/src/mainview/`, `packages/desktop/tests/`, `plugins/claude-code/tests/`, `shared/`, `packages/core/src/`
**Files scanned:** 28 source files + 4 test files
**Pattern extraction date:** 2026-05-05
