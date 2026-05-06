# Requirements: Roadmap Viewer

**Defined:** 2026-04-12
**Core Value:** Nodes in the tree reflect real-time state of external systems through a pluggable integration layer — turning any JSON roadmap into a live progress dashboard without locking users into a workflow.

---

## v1 Requirements

### Scaffold (SCAF)

- [ ] **SCAF-01**: Monorepo structure in place — `packages/core`, `packages/react`, `packages/desktop`, `plugins/` directories with correct workspace configuration
- [ ] **SCAF-02**: Electrobun shell boots to a blank window with `bun run dev:hmr` and `bun run build:canary` both succeeding
- [ ] **SCAF-03**: Typed RPC contract skeleton defined in `shared/types.ts`; both processes import from it
- [ ] **SCAF-04**: `RoadmapPlugin` interface defined in `packages/core/src/plugin.ts` (no implementation)
- [ ] **SCAF-05**: Vitest configured; first unit test passes
- [ ] **SCAF-06**: Playwright configured (two-tier: Vite dev server + mock RPC for UI tests; Bun-native for process logic); first test passes
- [ ] **SCAF-07**: GitHub Actions CI runs lint + `bunx tsc --noEmit` + unit tests on every PR
- [ ] **SCAF-08**: `bundleCEF: true` set in `electrobun.config.ts` from day one
- [ ] **SCAF-09**: `Updater.localInfo.channel()` wrapped in try/catch; missing `version.json` treated as channel `"dev"`

### Theme System (THEME)

- [ ] **THEME-01**: `ThemeProvider` applies active theme as `--rv-*` CSS custom properties on `:root`
- [ ] **THEME-02**: Built-in themes: `dark` (default, matches `variant-c-merged.html` design), `light`, `high-contrast`
- [ ] **THEME-03**: App-level theme preference persisted in `.roadmap-settings.json`; OS `prefers-color-scheme` respected when set to `'system'`
- [ ] **THEME-04**: Per-schema `themeConfig` block overrides the active base theme for a loaded file
- [ ] **THEME-05**: All components use `--rv-*` tokens exclusively — no hardcoded colors anywhere

### Read-Only Viewer (VIEW)

- [x] **VIEW-01**: JSON schema loads and validates via Zod; blocking validation errors shown in an inline error panel identifying type, severity, and location
- [x] **VIEW-02**: Tree renders from JSON using react-d3-tree with `dataKey` pattern — `dataKey` increments only on structural changes (add/delete/move), never on status-only updates
- [x] **VIEW-03**: TB and LR layout toggle; layout preference persisted per file in `.roadmap-settings.json`
- [x] **VIEW-04**: Collapse/expand subtrees; nodes beyond depth 3 collapse by default
- [x] **VIEW-05**: Zoom and pan (scroll wheel, pinch, click-drag) in both layouts
- [x] **VIEW-06**: Status badges on nodes: left border stripe (4px) + pill label with correct theme colors
- [x] **VIEW-07**: File watcher reloads tree on external file change without restarting the app
- [x] **VIEW-08**: `$ref` resolution at load time; each referenced file watched independently
- [ ] **VIEW-09**: Side panel opens in read-only mode (title, status, type, timestamps, markdown notes rendered)
- [ ] **VIEW-10**: Side panel resizable (min 320px, max 50% viewport); pin mode on screens wider than 1400px
- [ ] **VIEW-11**: Performance gate validated before phase ships: 300+ visible nodes + 10 simulated `store.updateNode()` calls/sec ≥ 30 fps on a mid-range machine
- [x] **VIEW-12**: `.bak.json` written alongside source file on every file open (safety net in absence of undo/redo)
- [ ] **VIEW-13**: Welcome screen shown when no recent files: "Open file" + "New roadmap" + links to sample schemas (`hello-world.json`, `getting-started.json`)
- [ ] **VIEW-14**: Recent files list (last 10) persisted in `.roadmap-settings.json`; shown in File menu

### Editor (EDIT)

- [ ] **EDIT-01**: Inline node rename via double-click or F2; floating `<input>` positioned over SVG node with inverse D3 zoom transform applied
- [ ] **EDIT-02**: Add child, add sibling above/below via keyboard shortcuts and context menu
- [ ] **EDIT-03**: Delete node: immediate for leaf nodes; confirmation dialog for non-leaf ("Delete node and N children?")
- [ ] **EDIT-04**: Duplicate node + subtree in place (`Ctrl+D`)
- [ ] **EDIT-05**: Copy/paste node + subtree (`Ctrl+C` / `Ctrl+V`); JSON clipboard format; cross-file paste via clipboard text
- [ ] **EDIT-06**: Move node up/down within siblings (`Ctrl+↑` / `Ctrl+↓`)
- [ ] **EDIT-07**: Arrow-key tree focus navigation: Up/Down between siblings, Right to expand/enter subtree, Left to collapse/return to parent
- [ ] **EDIT-08**: Change node status via context menu sub-menu and side panel dropdown
- [ ] **EDIT-09**: Right-click context menu with full action set; keyboard-navigable (arrow keys + Enter + Escape); ARIA compliant; appears within 50ms
- [ ] **EDIT-10**: Side panel: CodeMirror 6 markdown editor; Edit / Preview / Split modes; autosave debounced 1s; no explicit Save button
- [ ] **EDIT-11**: Side panel: editable metadata key-value table
- [ ] **EDIT-12**: Side panel: editable title, status dropdown, type dropdown, created/updated timestamps, copy-ID button
- [ ] **EDIT-13**: Autosave: debounced 2s write, 30s periodic, flush on `before-quit` Electrobun event and `SIGTERM` (Linux)
- [ ] **EDIT-14**: Atomic writes: `.tmp` then rename on all platforms; Windows retry loop (3 attempts, 50ms apart) around rename
- [ ] **EDIT-15**: Save indicator in status bar: `Saved ✓` / `Saving…` / `Error saving — click to retry`
- [ ] **EDIT-16**: `$ref` write-back: mutations write to the originating file; cross-boundary moves blocked with a clear error message
- [ ] **EDIT-17**: File > New: creates in-memory schema with a single root node and default statusConfig; app prompts for save location on first edit
- [ ] **EDIT-18**: Linux context menu fallback: custom webview-rendered `<div>` context menu (native `ContextMenu.showContextMenu()` is a no-op on Linux)

### Event API (PLUG)

> **Scope note:** v1 integration = Event API only (app as server, external producers push events). The Plugin system (smart adapters with own lifecycle/logic) is v1.1. See v2 Requirements for the full plugin architecture.

- [x] **PLUG-01**: App runs a WebSocket server on `ws://127.0.0.1:<port>` (port configurable, default TBD; determined in Phase 4); server starts with the app and is always available while the app is running
- [x] **PLUG-02**: Event contract defined and documented: `{ nodeId: string, status: string, meta?: Record<string, unknown>, source?: string }`; `status` must match a `statusConfig` id or the event is dropped with a warning in the event log
- [x] **PLUG-03**: Events routed to the correct node by `nodeId` within 100ms; node status updated in-memory and badge re-rendered; 100ms debounce buffer on Bun side to batch bursts before forwarding to webview
- [ ] **PLUG-04**: Nodes receiving live events show an animated pulse indicator while their producer is connected
- [ ] **PLUG-05**: Side panel Integration zone shows: connection status (connected / disconnected), last event timestamp, last received `meta` as a key-value table; no custom component injection
- [x] **PLUG-06**: Connection drops and malformed events surface as non-blocking toasts with a retry / dismiss option
- [x] **PLUG-07**: All received events logged to in-app event log (View menu): `nodeId`, `status`, `source`, `meta`, timestamp
- [x] **PLUG-08**: Claude Code MCP wrapper ships as the reference Event Producer — wraps the event contract as MCP tools callable by Claude; connects to the app's WebSocket and pushes `{ nodeId, status, meta }` events
- [x] **PLUG-09**: `plugin` and `subscribe` blocks in node JSON are parsed and stored by the Zod schema validator in v1 but not acted on — fields are reserved for the v1.1 plugin system; unknown `plugin.id` values are silently accepted (no warning in v1)

### Agent API (PLUG-AGENT)

> **Scope note:** Phase 6 turns Phase 4's one-way Event API into a bidirectional MCP contract. Adds 17 net-new MCP tools to the existing `@roadraven/plugin-claude-code` so any MCP-capable LLM can read, create, edit, move, delete, and persist roadmap nodes. Localhost-only, single-user, no auth (Phase 4 D-01/D-03 inherited). Mutations route through the renderer Zustand store and the Phase 3 autosave pipeline — no direct disk writes. Phase 6 D-01 through D-18 in `.planning/phases/06-agentic-roadmap-authoring/06-CONTEXT.md` are the locked decisions for these requirements.

- [ ] **PLUG-AGENT-READ-01**: `getRoadmap` MCP tool returns the full schema tree with live-merged statuses (Phase 4 D-14 30s window applies)
- [ ] **PLUG-AGENT-READ-02**: `getNode` MCP tool returns a node + parentId + ancestorIds, status reflects the live overlay if recent
- [ ] **PLUG-AGENT-READ-03**: `findNodes` MCP tool accepts a structured filter `{titleContains?, status?, type?, metaKey?, metaValue?, parentId?}` AND-combined; titleContains is case-insensitive substring (D-03)
- [ ] **PLUG-AGENT-READ-04**: `getStatusConfig` MCP tool returns the schema's statusConfig array
- [ ] **PLUG-AGENT-READ-05**: `getTypeConfig` MCP tool returns the schema's typeConfig array
- [ ] **PLUG-AGENT-READ-06**: `getOpenFile` MCP tool returns filePath, isUntitled, title, nodeCount
- [ ] **PLUG-AGENT-CREATE-01**: `createNode({parentId, title, type?, status?, notes?, metadata?})` returns the new node UUID; mirrors `roadmapStore.addChild` plus optional in-place setters (D-01)
- [ ] **PLUG-AGENT-CREATE-02**: `createRoadmap({title?, statusConfig?, typeConfig?})` invokes `newUntitledSchema` (mirrors File > New); agent must call `saveFileAs` to persist (D-01)
- [ ] **PLUG-AGENT-UPDATE-01**: `renameNode({nodeId, title})` updates node.title via roadmapStore.renameNode
- [ ] **PLUG-AGENT-UPDATE-02**: `updateNodeType({nodeId, type})` updates node.type via roadmapStore.updateNodeType
- [ ] **PLUG-AGENT-UPDATE-03**: `updateNodeNotes({nodeId, notes})` replaces node.notes (REPLACE semantics, not patch)
- [ ] **PLUG-AGENT-UPDATE-04**: `updateNodeMetadata({nodeId, patch})` shallow-merges patch into node.metadata; null values delete keys; unlisted keys preserved (D-04)
- [ ] **PLUG-AGENT-UPDATE-05**: `moveNode({nodeId, newParentId, position?})` re-parents the node, blocking cycles (`move_would_create_cycle`) and cross-$ref boundaries (`cross_ref_boundary`)
- [ ] **PLUG-AGENT-UPDATE-06**: `updateNodeStatus` (Phase 4 carry-forward) is rewritten to flow through the agent dispatcher so it writes a synthetic IntegrationEvent into the drawer (D-09)
- [ ] **PLUG-AGENT-DELETE-01**: `deleteNode({nodeId, cascade?})` requires cascade:true for non-leaf nodes (`cascade_required`, returns childCount); blocks last-root delete (`cannot_delete_last_root`) (D-11)
- [ ] **PLUG-AGENT-FILE-01**: `saveFile()` flushes the autosave debounce immediately (Phase 3 EDIT-13 force-flush)
- [ ] **PLUG-AGENT-FILE-02**: `saveFileAs({path})` saves to a new path; subject to the Phase 3 path-traversal allowlist (D-13 — same `isPathWithinMainDir` + `pushDialogAllowlistPath` plumbing)
- [ ] **PLUG-AGENT-FILE-03**: `openFile({path})` flushes pending autosave (D-12) then loads a roadmap by path; subject to the same path-allowlist as saveFileAs (D-13)
- [ ] **PLUG-AGENT-TRANSPORT-01**: Bun WebSocket server accepts inbound `{type:"request", id, method, params}` frames and routes them via `agentRequestHandler` BEFORE the EventCoalescer (D-15 — agent traffic bypasses the 100ms coalescer)
- [ ] **PLUG-AGENT-TRANSPORT-02**: `wsClient.request(method, params): Promise<T>` correlates by id, times out at 30s, and rejects all pending requests when the WebSocket closes (D-15)
- [ ] **PLUG-AGENT-SAFETY-01**: All gate checks (kill-switch, path-allowlist, no-file-loaded, node-not-found, cascade, cycle, last-root, cross-ref, file-read, save) return one of 13 string error codes; messages match the published taxonomy
- [ ] **PLUG-AGENT-SAFETY-02**: Every mutating tool call writes a synthetic IntegrationEvent into `eventLogStore` with `source="claude-code"` and `meta.tool`/`meta.args`/`meta.label` — visible in the Ctrl+Shift+L drawer (D-09)
- [ ] **PLUG-AGENT-SAFETY-03**: `agentApi.enabled === false` in `.roadmap-settings.json` short-circuits with `agent_api_disabled` BEFORE any tool dispatch (D-18 kill-switch); applies to read AND mutation tools

### Packaging (PACK)

- [ ] **PACK-01**: Native installers: Windows `.exe` (distributed inside `{channel}-win-x64-RoadRaven-Setup-{channel}.zip`) and Linux `.tar.gz` (Electrobun-native self-extracting bundle, `{channel}-linux-x64-RoadRavenSetup-{channel}.tar.gz`). macOS `.dmg` deferred to v1.1. Linux `.deb` deferred to v1.1 alongside GPG signing + apt repo.
- [ ] **PACK-02**: Electrobun auto-updater configured for **stable channel only** in v1.0. `release.baseUrl` resolves the per-platform `{channel}-{os}-{arch}-update.json` manifest. Canary channel deferred to v1.1; tag pattern `v*-canary.*` reserved.
- [ ] **PACK-03**: Linux: `bundleCEF: true` confirmed; all file actions reachable via keyboard shortcuts and toolbar (no `ApplicationMenu` dependency); `process.on('SIGTERM', flushWriteQueue)` registered
- [ ] **PACK-04**: npm package `@roadraven/core` published with pre-built ESM + `.d.ts` in `dist/` and only `zod` as a runtime dependency (CI enforces dependency allowlist via `scripts/check-core-deps.ts`). `@roadraven/plugin-claude-code` also published at the same lockstep version. `@roadraven/react` deferred to v1.1 (currently a `export {};` stub; component extraction is its own phase). `react`, `react-dom`, `react-d3-tree` peer-dep externalization is moot in v1 since `@roadraven/react` is not published.
- [ ] **PACK-05**: README, docs site, contribution guide
- [ ] **PACK-06**: Accessibility audit passes: full keyboard navigation, ARIA roles on context menu and modal dialogs, color not used as sole status indicator (text labels required), focus indicators visible

---

## v2 Requirements

### Editor Enhancements

- **EDIT-V2-01**: Undo / redo (command-pattern stack, capped at 50 entries) — deferred; `$ref` + live-subscription tracking adds complexity; git + `.bak.json` covers MVP recovery
- **EDIT-V2-02**: Drag-and-drop node reordering — deferred; SVG drag conflicts with canvas pan/drag
- **EDIT-V2-03**: Node search / Ctrl+F find-in-tree — store must maintain flat node index (planned for perf anyway); UI deferred
- **EDIT-V2-04**: Bulk operations on multi-selected nodes

### Data Model

- **DATA-V2-01**: Schema migration tooling (`migrator` in `@core`) — version field and hook point built in v1; migrator itself is v3.0
- **DATA-V2-02**: Multi-file workspace (tabbed)
- **DATA-V2-03**: SQLite persistence mode (alternative to JSON file)

### Plugin System (v1.1)

> The Event API (v1) covers the primary use case. Plugins are smart adapters that run inside the Bun process, own their connection logic, and are needed for cloud integrations (GitHub Actions, Goodreads, Linear) that require auth, polling, and data normalisation.

- **PLUG-V2-01**: `RoadmapPlugin` interface: `connect(nodeId, config)`, `disconnect()`, `on()`, `off()` — `off()` mandatory to prevent ghost updates after node deletion
- **PLUG-V2-02**: Plugin host in Bun: static loading (built-in plugins as direct imports); plugin registry as `Map<string, RoadmapPlugin>`
- **PLUG-V2-03**: Outbound polling pattern: plugin reaches out to external API on a schedule; owns auth, rate-limiting, normalisation
- **PLUG-V2-04**: Plugin config and secrets stored separately from roadmap JSON (API keys must not live in committed files)
- **PLUG-V2-05**: `plugin` block on nodes activates plugin lifecycle: app calls `connect(nodeId, config)` at load time
- **PLUG-V2-06**: Subscribe transport adapters: WebSocket client (app as subscriber), MQTT, file-as-subscription
- **PLUG-V2-07**: Plugin authoring guide and SDK
- **PLUG-V2-08**: Dynamic runtime plugin loading from local `plugins/` directory
- **PLUG-V2-09**: Custom plugin UI in side panel (component injection) — requires iframe sandbox or dynamic loader

### Agent API Enhancements (v1.1+)

- **PLUG-AGENT-V2-01**: `importSubtree({parentId, schema})` atomic bulk import — explicitly rejected for v1 (Phase 6 D-02). Revisit if agent latency under big scaffolds becomes a real complaint.
- **PLUG-AGENT-V2-02**: Pulse animation on agent-mutated nodes — explicitly rejected for v1 (D-09 tail). Revisit if user feedback is "I can't tell when Claude touched my tree."
- **PLUG-AGENT-V2-03**: Conflict UI / queue / lock for agent + human concurrent edits — last-write-wins is the v1 model (D-08).
- **PLUG-AGENT-V2-04**: Idempotency keys for create operations — agent retry on partial scaffolds is acceptable in v1; revisit if real-world.
- **PLUG-AGENT-V2-05**: Disk-direct read fallback when app is off — v1 returns `app_not_running` always (D-05).
- **PLUG-AGENT-V2-06**: Auto-launching the desktop app from a tool call — v1 returns `app_not_running` and asks the user.
- **PLUG-AGENT-V2-07**: Per-tool settings toggles (`agentApi.confirmDelete`, etc.) — only the global kill-switch ships in v1 (D-11/D-18).
- **PLUG-AGENT-V2-08**: Multi-agent / agent identity beyond `source` — v1 is single-agent.

### Visualisation

- **VIS-V2-01**: Radial / mindmap layout mode — requires different layout algorithm
- **VIS-V2-02**: Custom SVG type icons
- **VIS-V2-03**: Timeline / Gantt view — fundamentally different data model; out of scope for v2 as well

---

## Out of Scope

| Feature | Reason |
|---------|--------|
| User authentication or cloud sync | Not a collaboration tool; complexity not justified |
| Real-time multi-user editing (CRDT) | Desktop-first, single-user tool for v1+ |
| Mobile / web deployment | Electrobun is desktop-only |
| Multi-window support | Single-file focus for MVP |
| Rich text in node titles | Adds second markdown context; notes panel handles rich content |
| Comment threads on nodes | Collaboration mental model; out of scope for single-user tool |
| Inline image attachments | Bloats JSON; markdown image links in notes cover the use case |
| Templates library | Sample schemas (`hello-world.json`) cover 80% of the value |
| Real-time collaboration | CRDT complexity is enormous |
| Cross-boundary `$ref` node moves | MVP blocks with error; v1.1 feature |

---

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| SCAF-01 to SCAF-09 | Prerequisite | Pending |
| THEME-01 to THEME-05 | Phase 1 | Pending |
| VIEW-01 to VIEW-14 | Phase 2 | Pending |
| EDIT-01 to EDIT-17 | Phase 3 | Pending |
| PLUG-01 to PLUG-09 | Phase 4 | Pending |
| PACK-01 to PACK-06 | Phase 5 | Pending |
| PLUG-AGENT-READ-01..06, CREATE-01..02, UPDATE-01..06, DELETE-01, FILE-01..03, TRANSPORT-01..02, SAFETY-01..03 | Phase 6 | Pending |

**Coverage:**
- v1 requirements: 84 total (61 + 23 PLUG-AGENT)
- Mapped to phases: 84
- Unmapped: 0 ✓

---

*Requirements defined: 2026-04-12*
*Last updated: 2026-05-05 — Phase 6 PLUG-AGENT-* block added during plan creation (replan in TDD mode)*
