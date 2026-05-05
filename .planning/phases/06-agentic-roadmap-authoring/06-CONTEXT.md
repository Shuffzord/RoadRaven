# Phase 6: Agentic Roadmap Authoring - Context

**Gathered:** 2026-05-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Turn Phase 4's one-way Event API (producer → app) into a **bidirectional MCP contract** so any MCP-capable LLM (Claude Code first, others later) can read, create, edit, move, and delete roadmap nodes — and drive file lifecycle (open, save, save-as) — through the existing `plugins/claude-code/` MCP wrapper. Concretely: the agent connects to the running RoadRaven desktop app via the same sentinel-discovered WebSocket the Phase 4 wrapper already uses; the wrapper exposes ~17 new MCP tools on top of the 2 already shipped (`updateNodeStatus`, `getEventApiStatus`); each tool maps to a renderer-store mutation or a structured store read; mutations flow through Phase 3's existing autosave + atomic-write pipeline; agent activity surfaces in the Phase 4 event-log drawer for audit. End-to-end story: a developer asks Claude to "scaffold a roadmap for migrating service X" and watches the tree assemble live in RoadRaven without touching JSON.

This phase delivers a new requirements block (PLUG-AGENT-* — to be derived in planning from the scope sketched in ROADMAP.md Phase 6 plus the decisions below). It extends, but does not replace, Phase 4's PLUG-08/PLUG-09 surface, and it does NOT activate the v1.1 plugin system (the `plugin` / `subscribe` schema fields stay parsed-but-inert per Phase 4 D-26).

**Explicitly NOT in scope (deferred):**
- The smart-adapter plugin host / `RoadmapPlugin` lifecycle / dynamic plugin loading (PLUG-V2-01 through PLUG-V2-09 stay v1.1)
- Auth / token handshake / multi-tenant isolation — localhost-only, single-user, same-machine boundary (Phase 4 D-01, D-03)
- Activating `plugin.id` / `subscribe` blocks — schema fields remain parsed-but-inert (Phase 4 D-26)
- Schema migration tooling — no schema changes in this phase (Phase 5 D-24)
- Telemetry / usage analytics on agent tool calls
- Web/HTTP transport — MCP stdio + the existing WS connection cover the surface; no second transport
- Multi-agent coordination / agent identity beyond `source` field — single-agent assumption
- Undo/redo for agent operations — same as MVP: not in v1 (PROJECT.md Out of Scope; git + autosave + drawer log are the recovery surface)
- importSubtree / bulk-paste tool — explicitly rejected in this discussion (single-node createNode only)
- Pulse animation on agent-mutated nodes — explicitly rejected (drawer log is the visibility channel)
- Auto-launching the desktop app from a tool call — agent gets "app not running" error and asks the user

</domain>

<decisions>
## Implementation Decisions

### Tool surface scope (PLUG-AGENT-SCOPE)
- **D-01:** Ship the **full sketched tool set** in v1, organized in five categories. Read tools: `getRoadmap`, `getNode`, `findNodes`, `getStatusConfig`, `getTypeConfig`, `getOpenFile`. Create tools: `createNode`, `createRoadmap`. Update tools: `renameNode`, `updateNodeStatus` (kept from Phase 4, not a new tool), `updateNodeType`, `updateNodeNotes`, `updateNodeMetadata`, `moveNode`. Delete tool: `deleteNode`. File-lifecycle tools: `saveFile`, `saveFileAs`, `openFile`. Two existing Phase 4 tools (`updateNodeStatus`, `getEventApiStatus`) carry forward unchanged. Net new: ~17 tools.
- **D-02:** **No `importSubtree` tool in v1.** Tree scaffolding goes one node at a time via `createNode({parentId, title, type?, status?, notes?, metadata?})`. Atomic bulk paste stays a human Ctrl+V capability (Phase 3 clipboard); agents pay the per-call cost. Rationale: simpler primitives, easier to reason about ordering, reuse of existing single-node mutation paths in `roadmapStore.ts`. If agent latency under big scaffolds becomes a real complaint, revisit by adding `importSubtree` in v1.1 — the Phase 3 `parseSubtree` + `refreshNodeIds` plumbing is already there.
- **D-03:** **`findNodes` accepts a structured filter object**, not a free-form query string and not title-only. Shape: `findNodes({titleContains?, status?, type?, metaKey?, metaValue?, parentId?})`. All provided fields are AND-combined. `titleContains` is case-insensitive substring against `node.title`. Walks `roadmapStore.nodeIndex` (already O(1) lookups via Map; full walk is O(N)). No DSL, no parser, no hidden semantics.
- **D-04:** **`updateNodeMetadata` is shallow-merge, not replace.** Tool shape: `updateNodeMetadata({nodeId, patch: Record<string, unknown | null>})`. Each key in `patch` overwrites the same key in `node.metadata`; passing `null` for a key deletes that key from metadata. Unlisted keys are preserved. Rationale: agents typically don't have the full metadata picture and shouldn't clobber user-added keys (e.g., `priority: 'P0'`). This deviates from typical "all updates are PUT" REST shape, but matches PATCH semantics and the agentic use case.

### Source-of-truth & app-state requirements (PLUG-AGENT-SOURCE)
- **D-05:** **App-required for every tool.** All read AND write tools require the desktop app to be running (sentinel file present at `<userData>/event-api.json` per Phase 4 D-04). When sentinel is missing, every tool returns the same "Roadmap Viewer not running. Start the app and retry." error the Phase 4 wrapper already returns (`plugins/claude-code/src/server.ts` updateNodeStatus path). No disk-direct read fallback. No auto-launch. Single source of truth = renderer's Zustand store; reads see the same state the user sees on screen.
- **D-06:** **No-file-loaded is a distinct, structured error.** When the app is running but on the welcome screen (`schema === null` in `roadmapStore`), tools return `{ error: 'no_file_loaded', hint: 'Open a roadmap or call openFile(path)' }` rather than empty/null. Distinguishable from "app not running" so the agent can react differently — typically by suggesting `openFile` to the user. This applies to both read and mutating tools (you can't mutate a roadmap that isn't loaded).
- **D-07:** **Read tools return the merged state — live overlay wins.** `getNode.status`, `getRoadmap` node statuses, and `findNodes` filtering all reflect the same value the user sees on the badge: authored value if no recent event, or the live event overlay if it landed within Phase 4's 30-second window (D-14). Rationale: the agent should reason about "current state of the world," not a divergent disk-only view. Because liveEventMeta is per-node in the Zustand store, the merge is a per-node lookup, not a tree walk.

### Concurrency with human edits (PLUG-AGENT-COEXIST)
- **D-08:** **Last-write-wins, silent.** Agent mutations apply through the existing renderer-store actions (`addChild`, `renameNode`, `updateNodeNotes`, etc.) — same actions the user's keyboard shortcuts and side-panel inputs already call. Most recent write to a field wins, regardless of which side wrote it. No locks, no modals, no input-focused queue. Matches Phase 4 D-11's overlay model (events and user edits use the same store field; latest write wins). Rationale: simplest model, matches the live-collaboration feel the use case wants, no surprise pauses during agent runs. If concurrent-edit collisions become a real complaint, revisit with finer-grained signaling — don't pre-build it.
- **D-09:** **Agent activity surfaces in the Phase 4 event-log drawer.** Each mutating tool call writes a synthetic IntegrationEvent into the existing `eventLogStore` (Ctrl+Shift+L drawer; populated today by Bun's onEvent forwarding). Shape additions: `source = 'claude-code'` (or whatever the wrapper reports as its `source` field), `meta` carries `{ tool: 'createNode' | 'renameNode' | ... }` and tool-call args. The existing virtualized list, filter bar, and row-click-selects-node behavior all light up for free. **No new pulse animation on agent-mutated nodes** — the drawer is the durable audit channel; visual motion of nodes appearing/changing is the in-canvas signal. (Pulse stays Phase 4's "node receiving live status events" indicator, not "agent edited me.")
- **D-10:** **Agent tools return `ok` after the renderer-store mutation lands; durability follows existing autosave.** No synchronous flush per tool call. Phase 3's 2-second debounced atomic write + 30-second periodic autosave + before-quit flush + Linux SIGTERM flush handle persistence — same guarantees as a human edit. A 50-call scaffold coalesces into one atomic write 2s after the last call. **Crash window = same as a human typing rapidly**, which is the documented MVP behavior. Agents are expected to be idempotent on retry where it matters.

### Destructive operation safety (PLUG-AGENT-SAFETY)
- **D-11:** **Tool-args are the only gate for destructive ops.** No UI confirmation modal, no per-tool settings toggle, no agent-side picker prompt. `deleteNode({nodeId, cascade?: boolean})` requires `cascade: true` for non-leaf nodes; missing or false `cascade` on a non-leaf returns `{ error: 'cascade_required', childCount: N }` so the agent can re-plan. Leaf delete needs no cascade flag. The existing root-delete safeguard in `roadmapStore.deleteNode` (no-op when deleting the last remaining root) carries over — agent gets `{ error: 'cannot_delete_last_root' }`. Rationale: agent has full responsibility; trusts Claude Code's host-level approval flow; matches the agent-native pattern of "explicit args, predictable behavior."
- **D-12:** **`openFile(path)` auto-flushes pending autosave before opening.** If `roadmapStore.hasUnsavedEdits()` is true, the tool synchronously flushes the autosave debouncer (atomic write), waits for `saveState === 'saved'`, then opens the new file via the existing `loadFile` RPC. If the flush fails, the open fails too with the saveFile error message — consistent with Phase 3's save-error escalation (D-15). No data loss, no agent choreography required. The Phase 3 external-edit-toast does NOT fire (this is an in-process load, not a watcher event).
- **D-13:** **Path-traversal allowlist applies to agent calls — same allowlist as user actions.** Agent paths to `openFile` and `saveFileAs` must satisfy the existing Phase 3 03-04a checks: same directory as the currently-open main file, `$ref`-resolved sibling files, the recent-files list, or paths the user previously chose via the picker (`pushDialogAllowlistPath` history). Out-of-allowlist paths return `{ error: 'path_not_permitted', hint: 'open this directory in the app first' }`. Reuses `isPathWithinMainDir` and `pushDialogAllowlistPath` plumbing in `packages/desktop/src/bun/saveFile.ts`. **Path policy is the same plumbing for `saveFile` (no path arg) and `saveFileAs(path)`** — `saveFile` already has it; `saveFileAs` extends it to the agent-supplied path.

### Transport & RPC contract (Claude's discretion within constraints)
- **D-14:** **Reuse the existing `plugins/claude-code/` MCP server**, extended with new `server.registerTool(...)` calls for each new tool. Single `McpServer` instance over `StdioServerTransport` (today's setup at `plugins/claude-code/src/server.ts`). No second binary, no separate module split.
- **D-15:** **The existing one-way WebSocket needs request/response framing.** Phase 4's WS protocol is producer-pushes-events. Read tools require responses. Planner picks the framing (correlation IDs on a single WS, separate request channel, or wrapper sends RPC-shaped JSON and Bun replies on the same socket); the constraint is: the wrapper keeps using the same sentinel-discovered URL and the same WS client (`plugins/claude-code/src/wsClient.ts`) — no second transport, no HTTP fallback. Bun-side handlers route requests to renderer-store reads/mutations through the existing RoadmapRPCType pattern (`shared/types.ts`).
- **D-16:** **Agent mutations route through the renderer store**, not direct disk writes. Bun receives the agent request, forwards it to the renderer via RoadmapRPCType (extending the contract), the renderer's Zustand action runs, autosave handles disk persistence. This preserves all Phase 3 invariants (immutable structural mutations, dataKey discipline, ownership-aware `$ref` write-back, save-state machine, before-quit flush). A direct-Bun-mutation path would diverge from the human edit path and double the test surface; rejected.

### Backwards compatibility & versioning
- **D-17:** **Lockstep version bump applies** (Phase 5 D-04). Adding ~17 tools to `@roadraven/plugin-claude-code` ships at the same release as `@roadraven/core` and the desktop app. Existing tools (`updateNodeStatus`, `getEventApiStatus`) keep their names, schemas, and behavior. New tools are additive only.
- **D-18:** **Schema is unchanged.** No new fields on `RoadmapNode` or `RoadmapSchema` (`packages/core/src/schema.ts`). All agent operations work over the existing shape. PLUG-09's parsed-but-inert `plugin` and `subscribe` fields remain parsed-but-inert.

### Claude's Discretion
- Exact MCP tool naming (e.g., `getRoadmap` vs `roadraven_getRoadmap` vs `roadmap_get` — pick what reads cleanest in MCP host UIs and stays consistent across tools)
- WebSocket request/response framing mechanism (correlation IDs on a single channel, JSON-RPC shape, or wrapper-to-Bun envelope — pick the simplest that round-trips reliably; document in RESEARCH.md)
- Specific shape of the Bun → renderer RPC additions (one big RPC method per agent tool, or a generic `agentMutate({ tool, args })` dispatcher — both work; planner picks)
- Whether `getRoadmap` paginates or always returns the full tree (start with full; revisit if a real roadmap exceeds reasonable token limits)
- How `getNode` reports ancestry (array of parent IDs, full ancestor RoadmapNodes, or a single `parentId` plus a separate `getAncestors` tool — pick the shape that minimizes round-trips)
- Subtree depth in `getNode` / `getRoadmap` responses (full subtree vs depth-limited with pagination — start full; constrain when needed)
- Synthetic IntegrationEvent shape for agent activity in the drawer (D-09): exact fields and how the row renders ("Claude → createNode" vs full args inline)
- Tool error response taxonomy (one error class per gate above, plus a generic `internal_error` — pick concrete error codes and document)
- Idempotency keys for create operations (probably not needed in v1; agent retry on a partial scaffold is acceptable — but planner can add if cheap)
- Whether `createRoadmap` mirrors File > New exactly (in-memory schema, prompts on first save) or returns a path-required arg (forces explicit save location). The Phase 3 `newUntitledSchema` action already covers File > New; reusing it is the cheapest path
- Tool-input validation (Zod schemas on each tool — match `plugins/claude-code/src/server.ts`'s existing pattern; reuse `RoadmapNode` Zod from `@roadraven/core` where possible)
- How agent activity is logged on the Bun side (LogTape category? structured fields?) — match Phase 1 D-21 logging conventions
- Whether to add a kill-switch setting for the agent API (`agentApi.enabled: false` in `.roadmap-settings.json`) — small effort if planner thinks it's worth it; not required by the discussion

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase context (read in this order)
- `.planning/phases/04-event-api/04-CONTEXT.md` — sentinel discovery (D-04, D-05), localhost-only / no-auth security boundary (D-01, D-03), MCP wrapper at `plugins/claude-code/` baseline (D-27), event-log drawer (D-18..D-21), live-overlay 30s window (D-14), event-batch debounce on Bun (D-25), `_error` taxonomy in `.events.jsonl` (D-09)
- `.planning/phases/03-full-editor/03-CONTEXT.md` — autosave debounce ladder + atomic write pattern (D-15 escalation), keyboard router that the canvas focus model relies on, $ref-aware ownership map for write-back, path-traversal allowlist on saveFile (set up in 03-04a)
- `.planning/phases/05-packaging-distribution/05-CONTEXT.md` — lockstep versioning across `@roadraven/core` + `@roadraven/plugin-claude-code` (D-04), already-published `@roadraven/plugin-claude-code` with `bin: roadraven-mcp` (D-21), npm provenance + OIDC publish flow

### Project-level
- `.planning/PROJECT.md` — Tier 1 (Event API) vs Tier 2 (Plugin system v1.1) integration model; Out of Scope row "Plugin system (smart adapters running in Bun)" — Phase 6 stays Tier 1
- `.planning/REQUIREMENTS.md` — PLUG-08, PLUG-09 (Phase 4 carry-over); PLUG-V2-01..V2-09 (deferred plugin system, NOT activated by Phase 6)
- `.planning/ROADMAP.md` — Phase 6 entry with the read/create/update/delete/file-lifecycle tool sketch (this is the spec source for the planner; Phase 6 in-line "Out of scope" list still applies)
- `.planning/SPEC.md` §5 (Architecture) and §6 (Event Flow Sequences) for the Bun ↔ renderer RPC pattern Phase 6 extends

### Code (current state of art)
- `plugins/claude-code/src/server.ts` — current MCP server with `updateNodeStatus` + `getEventApiStatus`; the registration pattern Phase 6 extends
- `plugins/claude-code/src/wsClient.ts` — current WS client with sentinel-resolved URL + exponential backoff; Phase 6 reuses, but extends to support request/response framing (D-15)
- `plugins/claude-code/src/sentinel.ts` — sentinel-file reader; Phase 6 reuses unchanged
- `plugins/claude-code/package.json` — already configured for npm publish with OIDC provenance; lockstep version bumps here per release
- `shared/types.ts` — `RoadmapRPCType` (Bun ↔ renderer contract); Phase 6 extends with agent-mutation request shapes (D-16)
- `packages/core/src/plugin.ts` — `IntegrationEvent` shape; Phase 6's drawer entries reuse it (D-09)
- `packages/core/src/schema.ts` — `RoadmapNode`, `RoadmapSchema`, `statusConfig`, `typeConfig` Zod schemas; agent tool inputs validate against subsets of these
- `packages/desktop/src/mainview/store/roadmapStore.ts` — every mutation Phase 6 needs (`addChild`, `addSiblingAbove/Below`, `deleteNode`, `duplicateNode`, `moveNodeUp/Down`, `renameNode`, `updateNodeStatus`, `updateNodeType`, `updateNodeMetadata`, `updateNodeNotes`); `findParentAndIndex` and `nodeIndex` for O(1) lookups; `hasUnsavedEdits()` helper for D-12; `liveEventMeta` for D-07 merge; `newUntitledSchema` for `createRoadmap` (D-01)
- `packages/desktop/src/bun/index.ts` — current Bun process startup, RPC handler wiring, sentinel write/delete on app lifecycle; Phase 6 hooks new request handlers here
- `packages/desktop/src/bun/saveFile.ts` — `flushPending`, `pushDialogAllowlistPath`, `isPathWithinMainDir`; D-12 and D-13 reuse all three
- `packages/desktop/src/bun/eventServer.ts` — current WS server (`Bun.serve`) with the `_error`-classified event boundary; Phase 6 either extends with request/response routing or runs alongside, depending on D-15
- `packages/desktop/src/mainview/store/eventLogStore.ts` — drawer's underlying store; D-09 writes synthetic IntegrationEvents through this surface

### Out-of-repo (linked by phase 4)
- MCP TypeScript SDK at https://github.com/modelcontextprotocol/typescript-sdk — `McpServer.registerTool` API surface used in `server.ts`
- MCP spec at https://modelcontextprotocol.io — for tool-call response shape and error conventions

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`roadmapStore` mutations** — every action Phase 6 needs is already implemented and tested for the human-edit path. New code is the agent-side request → store-action dispatcher, not new domain logic.
- **`findParentAndIndex` + `nodeIndex` Map** — O(1) lookups by id, recursive parent walk; covers all `findNodes`, `getNode`, and parentId-based mutations.
- **`hasUnsavedEdits()` helper** — already used by Phase 3 external-edit toast; D-12's openFile-flush check reuses it directly.
- **`liveEventMeta` per-node store slice** — D-07's overlay merge for reads is a single Map lookup per node returned.
- **`flushPending` / `setCachedSchema` / `setCachedMainPath`** in `saveFile.ts` — the existing autosave flush path; D-10 inherits, D-12 calls explicitly before opening.
- **`pushDialogAllowlistPath` / `isPathWithinMainDir`** — Phase 3's path-traversal allowlist; D-13 reuses end-to-end.
- **`eventLogStore` + `EventLogDrawer` virtualized list** — Phase 4's audit surface; D-09 writes into it without UI changes.
- **`newUntitledSchema` action** — File > New equivalent the agent's `createRoadmap` can call (D-01).
- **WS client at `plugins/claude-code/src/wsClient.ts`** — exponential-backoff connection, sentinel-discovered URL, hello-frame handshake; Phase 6 extends its `send` method (or adds `request`) to support response correlation (D-15).

### Established Patterns
- **Single source of truth = renderer store; Bun owns transport + persistence** — Phase 6 follows this strictly (D-16). Direct-Bun mutations would split the truth.
- **Zod-validated boundaries** — every external input (loadFile, saveFile RPC params, event-server JSON, MCP tool input) is Zod-checked at the boundary. Agent tool inputs follow suit.
- **Last-write-wins on shared store fields** — Phase 4 D-11 established this for live events; Phase 6 D-08 inherits the model for agent mutations.
- **Toasts are non-blocking + dismiss-only** — Phase 4 D-22; Phase 6 doesn't add new toast surfaces (drawer log is the audit channel, D-09).
- **`_error`-classified events in the drawer** — Phase 4 D-09; Phase 6 doesn't need new classifications (agent ops succeed or return structured errors to the agent, not to the drawer).
- **Lockstep version bumps with provenance** — Phase 5 D-04, D-21; Phase 6 ships under the same release rules.

### Integration Points
- **`server.registerTool(...)` in `plugins/claude-code/src/server.ts`** — net-new tool registrations land here; existing two tools stay above for backwards compat.
- **`wsClient.send` / a new `wsClient.request`** — D-15 adds request/response framing; planner picks the shape.
- **`RoadmapRPCType` in `shared/types.ts`** — extend `bun.requests` with agent-mutation entries OR add a single `agentMutate` dispatcher; both fit the existing pattern.
- **Bun-side handler module (new file)** — the request router that maps incoming agent WS messages to RPC calls into the renderer; sits next to `eventServer.ts` or extends it.
- **`eventLogStore.append` in renderer** — D-09's drawer-write hook; existing function signature already accepts an IntegrationEvent.

</code_context>

<specifics>
## Specific Ideas

- "Scaffold a roadmap for migrating service X" is the named end-to-end story the phase delivers. Plan acceptance should validate against this: agent connects → createRoadmap → ~30-50 createNode calls → user sees tree assemble → autosave fires → file on disk has the result.
- Drawer rows for agent ops should read in plain English ("Claude renamed 'Auth' → 'Authentication service'") — the audit channel is the visibility tradeoff for refusing pulse animation.
- Single MCP server, all tools registered into it. No splitting by capability category.

</specifics>

<deferred>
## Deferred Ideas

- **`importSubtree({ parentId, schema })` atomic bulk import** — explicitly considered and rejected for v1 (D-02). Revisit in v1.1 if agent-latency under big scaffolds becomes a real complaint. Phase 3 `parseSubtree` + `refreshNodeIds` already exist — implementation cost is low when reasoned to be needed.
- **Pulse animation on agent-mutated nodes** — explicitly considered and rejected (D-09 tail). Revisit if user feedback after v1 is "I can't tell when Claude touched my tree."
- **Conflict UI / queue / lock for agent + human concurrent edits** — explicitly considered and rejected (D-08). Revisit only if real-world collisions become a complaint.
- **Synchronous-flush-per-tool-call for stronger durability** — considered and rejected (D-10). Revisit if "agent ops are lost on crash" becomes a real failure mode.
- **Auto-launching the desktop app from a tool call** — considered and rejected. v1.1 territory if at all.
- **Disk-direct read fallback when app is off** — considered and rejected (D-05). v1.1 if there's a real "agent-only headless" use case.
- **Per-tool settings toggle** (`agentApi.confirmDelete`, `agentApi.confirmOpenFile`, etc.) — considered and rejected (D-11). The kill-switch question (`agentApi.enabled: false`) was kicked to Claude's discretion in planning.
- **System-picker prompt per agent path** — considered and rejected (D-13). v1.1 if user demand surfaces.
- **Multi-agent / agent identity** — out of scope for v1.0; `source` field on events is the only tag.
- **Plugin host activation (PLUG-V2-01..V2-09)** — Phase 6 stays Tier 1 (Event API). Tier 2 (smart adapters) remains v1.1. Phase 6 does NOT activate `plugin` / `subscribe` schema fields.

</deferred>

---

*Phase: 6-agentic-roadmap-authoring*
*Context gathered: 2026-05-05*
