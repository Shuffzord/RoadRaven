# Phase 4: Event API - Context

**Gathered:** 2026-04-23
**Status:** Ready for planning

<domain>
## Phase Boundary

The app becomes a passive live-state receiver. A WebSocket server runs on `ws://127.0.0.1:<port>` for the life of the app; external producers (first: a Claude Code MCP wrapper shipped as `plugins/claude-code/`) push events using the contract `{ nodeId, status, meta?, source? }`. Events are routed to the correct node within 100ms, live status overlays the source file's authored status in memory, and a complete event history is persisted next to the source file. The user sees: a "live" pulse on recently-updated nodes, per-node integration detail in the side panel, a global connected-producers count in the status bar, and a bottom-drawer event log with all received events.

This phase delivers PLUG-01 through PLUG-09 across 4 plans (research gate → WS server + routing → UI indicators + log → Claude Code MCP wrapper).

**Explicitly NOT in scope (v1.1 territory):**
- Plugin host / lifecycle / registry (`RoadmapPlugin` connect/disconnect)
- Subscription transports (WebSocket client, MQTT, file-as-subscription)
- Plugin secrets / auth / token handshake
- Dynamic plugin loading from local `plugins/` directory
- Custom plugin UI injection into the side panel
- Log compaction / retention policies

</domain>

<decisions>
## Implementation Decisions

### Port selection & binding (PLUG-01)
- **D-01:** Fixed default port **`47921`** (uncommon, easy for users to hand to an MCP config), with automatic collision fallback scanning `+1..+9`. Bind address is **`127.0.0.1`** (IPv4 localhost) — same-user, same-machine security boundary.
- **D-02:** User override available in **two places**, applied in this precedence: (1) `ROADRAVEN_EVENT_PORT` env var (highest priority, dev/testing), (2) `.roadmap-settings.json → eventApi.port` (persistent user setting), (3) default `47921` (fallback). When a user-specified port is in use, the server fails and surfaces a toast — no auto-fallback for user-chosen ports (user intent respected).
- **D-03:** No auth / no token handshake in v1. Localhost binding is the boundary. Token-gated handshake is a v1.1 concern aligned with the plugin secrets story.

### Port surfacing & MCP auto-discovery (PLUG-01, PLUG-08)
- **D-04:** On successful bind, Bun writes a sentinel file at **`<userData>/event-api.json`** with shape `{ port: number, url: string, startedAt: string, pid: number }`. File is atomically written (existing `atomicWrite.ts`) and removed on clean shutdown. `<userData>` = Electrobun user-data directory (same dir as `.roadmap-settings.json`).
- **D-05:** The Claude Code MCP wrapper reads `<userData>/event-api.json` on startup to auto-discover the URL. No user config needed for the happy path. If the file is missing (app not running), the wrapper reports a clear error to Claude.
- **D-06:** Status bar shows a **live event-api pill** replacing today's placeholder "Connected" indicator: `● :47921` when server up with green dot, `● :47921 · 2` when producers are connected (count after dot), `○ Event API off` when not running. Click the pill to copy the full `ws://127.0.0.1:47921` URL; clicking when connected-count > 0 opens the event log drawer.
- **D-07:** Welcome screen shows the URL as small text near the footer (e.g., `Event API: ws://127.0.0.1:47921 [copy]`) so users can paste it into ad-hoc scripts without opening the app.

### Event persistence model (PLUG-03)
- **D-08:** **Ephemeral-in-source, persistent-in-sidecar.** The user's source `.roadmap.json` file is **never modified** by received events — it stays pristine (no `updatedAt` bump, no status rewrite, no git diff from agent heartbeats).
- **D-09:** A single sidecar file `<source>.events.jsonl` (append-only, one JSON object per line) lives next to the source file. Schema per line: `{ t: string (ISO), nodeId: string, status: string, source?: string, meta?: Record<string, unknown>, _error?: string }`. Error entries carry an `_error` field (e.g., `"unknown_node"`, `"invalid_status"`, `"malformed"`) so the log UI can surface them visually without a parallel error file.
- **D-10:** **No separate `live.json` cache.** The `.events.jsonl` log is the single source of truth for post-authored state. On app open, the Bun process reads the log and reduces to a last-event-per-nodeId map before forwarding the overlay to the webview as a single "hydrate" message. No lazy loading of the current-state overlay in v1 (entire log replayed on open). Compaction deferred — add when a log crosses a size threshold in practice.
- **D-11:** **Overlay semantics:** in-memory `roadmapStore` applies `.events.jsonl`-derived `status` values over the source schema's authored `status`. When the user explicitly edits a node's status via the UI (Phase 3 mutations), the user's edit wins and is written to the source file as usual — subsequent events continue overlaying unless/until a terminal source edit. No conflict dialog in v1: source edits and event overlays use the *same store field*, so the most recent write wins in the current session; on reopen, events.jsonl overlay is re-applied over the source's new authored value.
- **D-12:** **File lifecycle.** `.events.jsonl` is created on receipt of the first event for a given source. It is **not** removed automatically — it lives with the source file. On `File > Save As` or `File > New`, sidecars from the previous source do not follow (user manages them manually). Phase 3's safety-net `.bak.json` pattern stays as-is and is orthogonal.
- **D-13:** **Sidecar co-location with `$ref`.** One `.events.jsonl` per **main** roadmap file — the sidecar sits next to the file the user opened, not next to each `$ref` target. Entries are keyed by `nodeId` regardless of which `$ref` file the node originated from. The existing ownership map (Plan 03-04a) handles cross-file tracking; the event overlay is applied by nodeId lookup via `roadmapStore.nodeIndex`.

### Live indicators (PLUG-04, PLUG-05)
- **D-14:** **Pulse model = recent-event window, 30 seconds.** A node shows the animated pulse iff `(now - lastEventAt) < 30s`. A 1 Hz timer tick in the renderer re-evaluates which nodes are "fresh" and toggles the pulse class. No producer-to-node binding logic in v1 (that's the `subscribe` block, v1.1).
- **D-15:** Pulse is a CSS-driven animation on the `RoadmapNodeCard` — keyed off a `data-live="true"` attribute set by a Zustand-derived selector. Respects `prefers-reduced-motion` (static highlight ring rather than animation when reduced motion is on).
- **D-16:** **SidePanel Integration zone** (new section, added after the metadata block, before the notes block):
  - **Header line:** `● Live` (green, when within 30s window) or `○ Last event 4m ago` (grey, with relative time) or `— No events received` (empty state).
  - **Source row:** last producer's `source` field with an inline copy button.
  - **Meta table:** last `meta` payload rendered as key-value rows, labeled "Last event meta" (reuses existing `MetaRow`-style styling). Non-string values rendered as `JSON.stringify`.
  - **Mini-history:** collapsed-by-default disclosure showing the last 5 events for this node (ISO timestamp, status, source). "Open full log" link opens the drawer pre-filtered to this node.
- **D-17:** Global connected-producer count lives in the status-bar pill only (not duplicated in the side panel).

### Event log UI (PLUG-07)
- **D-18:** **Bottom-panel drawer**, toggleable, resizable. Keyboard shortcut `Ctrl+Shift+L`. Toolbar toggle button in TopBar (icon + label "Events"). Drawer sits above the status bar, below the main canvas + side panel grid. Default height ~30% of viewport; collapse to a 24px header strip showing event count and filter state.
- **D-19:** **Row list is virtualized** (planner picks the library — lightweight preferred since we already depend on react-d3-tree for the heavy work). Each row: timestamp (relative "3s ago" with tooltip for absolute), nodeId (8-char prefix, full on hover, click to select node + focus in tree), status badge (reusing status colors), source, meta preview (first 2 keys). Rows with `_error` have a red left stripe. Expand row for full JSON meta.
- **D-20:** **Filter bar** above the list: source dropdown (populated from distinct `source` values in current log), "Selected node only" toggle (auto-binds to `selectedNodeId`), status filter. Free-text meta search deferred post-MVP.
- **D-21:** Clicking a row **selects the node** in the tree (opens SidePanel, scrolls into view using Phase 3's camera-follow). Double-click opens the expanded event JSON inline.

### Error UX & toasts (PLUG-02, PLUG-06)
- **D-22:** **Dismiss-only toasts** for error surfaces. No "Retry" button in v1 — the app is a passive WS server, producers own their own connection lifecycle. **PLUG-06 spec clarification** documented here: the "retry / dismiss option" wording in the original spec assumed bidirectional connection control that doesn't exist in the v1 Event API architecture. Dismiss is the only actionable option.
- **D-23:** Toast trigger map:
  - Malformed event (bad JSON / missing required field) → `"Invalid event from [source]. See event log."` → log entry with `_error: "malformed"`.
  - Unknown `nodeId` (not in `roadmapStore.nodeIndex`) → `"Event for unknown node from [source]."` → log entry with `_error: "unknown_node"`.
  - Status not in `statusConfig` → `"Unknown status '[s]' from [source]."` → log entry with `_error: "invalid_status"`.
  - Producer disconnect (abnormal close) → `"Producer [source] disconnected."` (once per disconnect, not per node).
- **D-24:** **Throttling:** same toast type + same `source` arriving within 5 s of the previous are **merged** into a single toast with a count (`"3 invalid events from [source]"`). All underlying events still land in `.events.jsonl` with their individual `_error` markers; toasts are the attention layer only.

### Debounce & routing performance (PLUG-03)
- **D-25:** **Bun-side 100 ms debounce buffer** batches events per flush cycle before forwarding to the webview. Strategy: per-node coalesce (last-write-wins within the 100 ms window for each `nodeId`) then flush the batch as a single `pushStatusUpdate` message containing `{ updates: [{ nodeId, status, meta?, source?, lastEventAt }] }`. RPC contract addition required — current `pushStatusUpdate` is single-node; expand to support batch. The 100 ms target is end-to-end: producer → server receive → debounce flush → webview store update → React re-render.

### Schema handling (PLUG-09)
- **D-26:** **`plugin` and `subscribe` fields are parsed but not acted on in v1.** Current schema has both as `z.unknown().optional()` — keep this permissive shape (no narrower schema in v1), which guarantees forward-compat with v1.1 plugin fields. Unknown `plugin.id` values are silently accepted (no warning). No runtime effect beyond parsing.

### Claude Code MCP wrapper (PLUG-08)
- **D-27:** **Ships as `plugins/claude-code/`** with its own package.json (today it's empty). Two entry points:
  1. An MCP server binary that Claude Code (or any MCP host) invokes — exposes tools (naming / structure: Claude's discretion during planning) that accept the event contract fields and push them over WebSocket.
  2. A thin WebSocket client module used by the MCP server to connect to the app's Event API URL (via sentinel file discovery).
- **D-28:** MCP wrapper **does not queue** events when the app is offline — it fails the tool call with a clear error ("Roadmap Viewer not running — start the app and retry"). Queueing / retry is v1.1 plugin-system territory.
- **D-29:** End-to-end acceptance: starting the app → invoking the MCP tool from a Claude Code session → node badge updates in the app within 100 ms → event visible in the drawer log with `source: "claude-code"`.

### Claude's Discretion
- Exact WebSocket library choice in Bun (native `Bun.serve` WebSocket or a lightweight wrapper)
- WS frame/message shape details (ack semantics, close codes, subprotocol naming) within the `{ nodeId, status, meta?, source? }` contract
- MCP tool naming and parameter shape (must map cleanly to the event contract)
- Virtualization library for the event log drawer (react-window, @tanstack/react-virtual, or roll-thin)
- Reconnect/backoff strategy in the MCP wrapper client
- 100 ms debounce flush mechanism internals (setTimeout loop vs rAF-aligned on Bun's event loop)
- Integration zone visual polish (exact spacing, icon choices, disclosure-arrow behavior)
- Event log row styling within the red/neutral marker convention
- Sentinel file read-retry strategy in the MCP wrapper (for race on fresh app start)
- Initial WebSocket handshake message — whether the producer sends a `{ source, version }` hello frame before events (recommended but not contract-mandated)
- Test fixture strategy for the Phase 4 plans (mock Bun `serve`, in-process WS loopback, etc.)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 4 Requirements
- `.planning/REQUIREMENTS.md` §Event API (PLUG-01 through PLUG-09) — full acceptance criteria; scope note at top of section distinguishes v1 Event API from v1.1 Plugin System.

### Roadmap
- `.planning/ROADMAP.md` §Phase 4 — phase goal, plan list, done-when criteria.

### Architecture & Data Model
- `.planning/PROJECT.md` §Context — integration model v1 (Event API) vs v1.1 (Plugin System); Claude Code integration = MCP wrapper + Event API; two-process boundary; 100 ms routing budget.
- `.planning/PROJECT.md` §Key Decisions — reasoning for Event API over Plugin System in v1; plugin deferral.

### Event Contract & Plugin Interface
- `packages/core/src/plugin.ts` — `IntegrationEvent` interface: `{ nodeId, status, meta?, source?, timestamp? }` (already defined; downstream implementation must match). `RoadmapPlugin` interface (v1.1 contract; parsed but not used in this phase).
- `packages/core/src/schema.ts` §RoadmapNodeSchema — `plugin: z.unknown().optional()` and `subscribe: z.unknown().optional()` fields (PLUG-09 target: keep permissive).

### RPC Contract
- `shared/types.ts` §RoadmapRPCType — existing `nodeStatusUpdate`, `integrationEvent`, `fileChanged` bun-side messages and `pushStatusUpdate`, `pushEventLog`, `pushOwnershipMap` webview-side messages. `pushStatusUpdate` currently single-node — Phase 4 must expand to a batch shape (see D-25).

### Prior Phase Context
- `.planning/phases/00-app-scaffold/00-CONTEXT.md` — monorepo structure, `@roadraven/` workspace scope, `shared/types.ts` boundary, Biome.
- `.planning/phases/01-visual-foundation-themes/01-CONTEXT.md` — Tailwind v4, `--rv-*` tokens, ThemeProvider, LogTape structured logging foundation, themeStore pattern.
- `.planning/phases/02-read-only-viewer/02-CONTEXT.md` — Zustand `roadmapStore` with `dataKey`, `nodeIndex` map, react-d3-tree custom node rendering, file watcher + debounce (500 ms), `$ref` resolution at load time.
- `.planning/phases/03-full-editor/03-CONTEXT.md` — mutation actions, autosave 2s debounce, SaveIndicator state machine, atomic writes, `$ref` write-back ownership map, ExternalEditToast pattern, Radix primitives (Dialog/DropdownMenu/ContextMenu).

### Design Reference
- `.planning/design/variant-c-merged.html` — canonical design reference (if any Phase 4 visuals borrow from it; side panel and status bar layout already set).

### Electrobun
- Electrobun LLM API reference: https://blackboard.sh/electrobun/llms.txt — WebSocket server APIs (via `Bun.serve`, not Electrobun itself), user-data directory resolution, lifecycle events.
- Electrobun source: https://github.com/blackboardsh/electrobun — verify `Bun.serve` WebSocket lifecycle patterns + shutdown hook compatibility with existing `flushPending()` wiring in `packages/desktop/src/bun/index.ts`.

### MCP (for the plugins/claude-code wrapper)
- Model Context Protocol spec — referenced during planning; researcher picks current URL.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `shared/types.ts` — RPC contract already reserves all Phase 4 message channels (`nodeStatusUpdate`, `integrationEvent`, `fileChanged` bun-side; `pushStatusUpdate`, `pushEventLog` webview-side). `pushStatusUpdate` currently single-node — must expand to batch shape (D-25).
- `packages/core/src/plugin.ts` — `IntegrationEvent` interface already exported; matches event contract exactly. Reuse as the canonical type.
- `packages/desktop/src/mainview/rpcHandlers.ts` — `pushStatusUpdate` and `pushEventLog` are currently no-op stubs marked `"Phase 3: wire to roadmapStore.updateNodeStatus"` (actually Phase 4 now). Wire these to the store and the drawer respectively.
- `packages/desktop/src/mainview/store/roadmapStore.ts` — `updateNodeStatus(nodeId, status)` action already implemented (Phase 2) and performs in-place updates without incrementing `dataKey` — exactly the semantics needed for event-driven status changes. Add `applyEventBatch(updates[])` action for the 100 ms debounced batch path.
- `packages/desktop/src/bun/index.ts` — Bun main entry point with existing `Electrobun.events.on("before-quit")` + `process.on("SIGTERM"/"SIGINT")` handlers (Plan 03-04c). Event API server lifecycle plugs in here: start on app boot, stop + delete sentinel file on before-quit/SIG*.
- `packages/desktop/src/bun/atomicWrite.ts` — existing atomic write helper. Reuse for sentinel file write and for `.events.jsonl` append safety (file-level append is atomic at single-line granularity on most filesystems, but atomicWrite is useful for the live.json reduction if ever added).
- `packages/desktop/src/bun/logging.ts` + `packages/desktop/src/mainview/logging/logger.ts` — LogTape is set up. Use hierarchical category `roadraven.events.*` for all Phase 4 server/routing/log code.
- `packages/desktop/src/mainview/components/ExternalEditToast.tsx` — Phase 3 pattern for non-blocking toasts. Use as the starting template for the Phase 4 error toast surface; the throttling logic in D-24 is new.
- `packages/desktop/src/mainview/components/StatusBar.tsx` — currently shows a static `● Connected` pill. Replace with the live event-api pill per D-06.
- `packages/desktop/src/mainview/components/SidePanel.tsx` — add the Integration zone section between metadata and notes (D-16). Reuse `MetaRow`, `FieldLabel`, `SavedFlash` styling.
- `packages/desktop/src/mainview/components/TopBar.tsx` — add the event log drawer toggle button.
- `packages/desktop/src/mainview/hooks/useKeyboardRouter.ts` — Phase 3 keyboard dispatcher; add `Ctrl+Shift+L` binding for the drawer (D-18). Respect the existing input-focused guard so the shortcut no-ops inside CodeMirror/rename inputs.
- `plugins/claude-code/package.json` — empty scaffold workspace. PLUG-08 implementation fills this directory.

### Established Patterns
- **Zustand + `useShallow`** for performance-sensitive selectors; apply to event-updated status so only re-rendered nodes react.
- **`dataKey` invariant:** event-driven status updates MUST NOT increment `dataKey` (they're status-only). Only structural changes (Phase 3 mutations) increment.
- **LogTape structured logging** with hierarchical categories — `roadraven.events.server`, `roadraven.events.routing`, `roadraven.events.log`, `roadraven.events.mcp`.
- **Self-write suppression** in the file watcher (Plan 03-04c) — Phase 4 does **not** write to the source file, so no new suppression needed, but the sidecar `.events.jsonl` must also be excluded from the file-watcher scope (watcher only watches the source + `$ref` files).
- **`--rv-*` CSS custom property tokens** — all Phase 4 UI (pulse color, pill states, drawer theming, toast variants, error row stripe) reads from tokens.
- **Radix UI primitives** for accessible menus/dialogs. Drawer can use Radix `Dialog` with custom slide-from-bottom styling, OR a plain `<aside role="region">` if Dialog's focus trap is undesirable for the drawer use case.
- **Atomic write pattern** for files the app owns.
- **`pushDialogAllowlistPath` + path-traversal allowlist** from Plan 03-04a — sentinel file + `.events.jsonl` paths are app-owned, not user-picker-derived, so this allowlist doesn't constrain them. But sentinel file path must be validated not to escape `<userData>`.

### Integration Points
- `shared/types.ts` — add batch shape to `pushStatusUpdate`, add sentinel-file RPC if the renderer ever needs to read it (probably not — it's for external MCP wrapper).
- `packages/desktop/src/bun/index.ts` — register Event API server start/stop in the Bun lifecycle alongside existing `flushPending` hooks. Sentinel file write happens post-bind; delete happens in the before-quit handler.
- `roadmapStore.ts` — add `applyEventBatch(updates[])` action; add `liveEventMeta` state keyed by nodeId for SidePanel Integration zone reads; derive the "live" boolean via a selector driven by a 1Hz interval in the root component.
- `SidePanel.tsx` — new Integration zone section; reads `liveEventMeta[selectedNodeId]` from the store; optional mini-history reads a slice of `.events.jsonl`-derived state via a new store slice.
- `StatusBar.tsx` — replace the static pill with a live one bound to `eventApiStore` (new, small) containing `{ status: 'off' | 'listening' | 'error', port: number | null, connectedCount: number }`.
- `TopBar.tsx` — event log toggle button.
- Event log drawer → new component `EventLogDrawer.tsx` under `packages/desktop/src/mainview/components/`; new store `eventLogStore.ts` under `store/` for in-memory mirror of recent events + filter state.
- `plugins/claude-code/` — new module(s) for MCP server + WS client; needs its own TypeScript config aligned with the workspace.
- New Bun-side modules likely needed: `bun/eventServer.ts` (WS lifecycle + routing), `bun/eventsLog.ts` (sidecar write + replay), `bun/sentinel.ts` (sentinel file lifecycle). Planner decides final split.

</code_context>

<specifics>
## Specific Ideas

- **Sidecar naming convention:** `.live.json` (considered and dropped) vs `.events.jsonl` (chosen). The `.jsonl` suffix broadcasts "append-only log" immediately to any developer who sees it; single source of truth for history + current state.
- **Port 47921:** arbitrary but in the IANA user/dynamic range, not commonly used by dev tooling, four memorable digits. If the default needs to change at the research gate for a clear reason (well-known conflict), it's an easy switch — but it's already cited in this doc and in user-facing surfaces, so pin it unless evidence requires otherwise.
- **Gitignore hint:** ship a suggested `.gitignore` snippet in the README covering `*.events.jsonl`, `*.bak.json`, and `.roadmap-settings.json` (the latter is often personal). First-run hint in the app: first time an event is received, show a one-time info toast pointing at the new sidecar file + the gitignore doc.
- **Status bar pill as interaction surface:** click = copy URL when idle, click = open event log drawer when producers are connected. Single widget that changes affordance with state — feels "dashboard-y" without taking more real estate.
- **PLUG-06 language:** the CONTEXT.md documents the "retry / dismiss" spec clarification (D-22) so the researcher and planner don't go hunting for a retry mechanism that doesn't fit the v1 architecture.
- **30-second pulse window:** picked as "comfortably longer than one agent iteration but short enough that stale state stops drawing attention." Window configurable in a future settings key if needed.

</specifics>

<deferred>
## Deferred Ideas

Captured here so they're not lost, but explicitly out of scope for this phase.

- **Log compaction / rotation** — `.events.jsonl` grows unbounded. Add a compaction step (rewrite log to keep only last event per nodeId + a terminator marker) when size crosses a threshold in practice. Backlog candidate.
- **Token-gated WebSocket handshake** — stronger per-connection auth on shared dev machines. Aligns with the v1.1 plugin-secrets story.
- **Schema-declared `liveStateRef` per node** — user-opt-in wiring of individual nodes to external live-state files (discussed as alternative to sidecar). Cleaner separation, but adds schema surface area; better done as part of the v1.1 plugin system once the broader state/secrets story lands.
- **"Retry event" semantics** — the spec hinted at retry; v1 has no sane retry actor. A future bidirectional plugin protocol might bring retry back in a well-defined form.
- **Producer queueing when app is offline** — the MCP wrapper could buffer events and flush on reconnect. Pushed to the v1.1 plugin system where producer-owned state is a first-class concern.
- **Free-text search in event log meta** — deferred post-MVP; source/status/nodeId filters ship first.
- **"Follow source" mode in event log** — auto-scroll & auto-filter the drawer to new events from a selected producer. Nice polish, post-MVP.
- **Multi-file sidecar co-location across `$ref`** — currently the sidecar lives next to the main file only. A future refinement could split sidecars per `$ref` file when producers attribute events that way. Not needed in v1.
- **Sentinel file cleanup on crash** — orphaned sentinel files after abnormal exit. Mitigation exists (embedded `pid`, check process liveness on MCP wrapper startup), but full cleanup is deferred.

</deferred>

---

*Phase: 04-event-api*
*Context gathered: 2026-04-23*
