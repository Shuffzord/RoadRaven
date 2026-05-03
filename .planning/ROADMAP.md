# Roadmap: Roadmap Viewer

**Created:** 2026-04-12
**Granularity:** Standard
**Total phases:** 6 (+ Prerequisite)

## Overview

Starting from a bare Electrobun shell, we build outward through the visual stack: scaffold the monorepo and TDD pipeline, then establish the theme foundation, prove the tree renderer with a read-only viewer (gating on the 30 fps performance requirement), add the full editor with the `dataKey`-aware Zustand store, wire the WebSocket Event API with the Claude Code MCP reference producer, and finish with cross-platform packaging and npm distribution.

---

## Phases

- [ ] **Prerequisite: App Scaffold** — Electrobun shell boots; monorepo, TDD pipeline, and CI all operational
- [ ] **Phase 1: Visual Foundation & Themes** — App shell renders with all three built-in themes; `--rv-*` token system in place
- [ ] **Phase 2: Read-Only Viewer** — Any valid JSON schema renders as an interactive tree; performance gate passes
- [ ] **Phase 3: Full Editor** — A complete roadmap can be created, edited, and saved without touching JSON directly
- [ ] **Phase 4: Event API** — Nodes receive live status updates from external producers via WebSocket; Claude Code MCP wrapper works end-to-end (5/6 plans done; 04-06 gap closure pending)
- [ ] **Phase 5: Packaging & Distribution** — Native installers on all three platforms; npm packages published
- [ ] **Phase 6: Agentic Roadmap Authoring** — Agents (Claude Code and other MCP-capable LLMs) can read, create, edit, and delete roadmap nodes via MCP — turning RoadRaven into a substrate for agent-authored project plans

---

## Phase Details

### Prerequisite: App Scaffold

**Goal:** Electrobun shell boots to a blank window with the monorepo structure, typed RPC skeleton, and TDD pipeline fully operational on CI.

**Depends on:** Nothing

**Requirements covered:** SCAF-01, SCAF-02, SCAF-03, SCAF-04, SCAF-05, SCAF-06, SCAF-07, SCAF-08, SCAF-09

**Plans:** 3 plans

Plans:
- [x] 00-01-PLAN.md — Monorepo bootstrap: workspace structure, migrate code to packages/desktop, bundleCEF: true
- [x] 00-02-PLAN.md — RPC contract + Updater fix: shared/types.ts with RoadmapRPCType, SCAF-09 try/catch
- [x] 00-03-PLAN.md — TDD pipeline: Biome, Vitest, Playwright two-tier, GitHub Actions CI

**Done when:**
- `bun run dev` opens a blank window without errors
- `bun run build:canary` succeeds
- `bunx vitest run` exits green
- First Playwright test (window launches) passes
- CI pipeline passes on a test PR
- `bundleCEF: true` is set and confirmed in `electrobun.config.ts`

**Dependencies:** None

**UI hint**: yes

---

### Phase 1: Visual Foundation & Themes

**Goal:** The app shell renders the intended design with all three built-in themes switchable, using only `--rv-*` CSS custom property tokens, before any real data is wired.

**Depends on:** Prerequisite

**Requirements covered:** THEME-01, THEME-02, THEME-03, THEME-04, THEME-05

**Plans:** 3 plans

Plans:
- [x] 01-01-PLAN.md — Tailwind v4 migration + token system + ThemeProvider + Zustand store
- [x] 01-02-PLAN.md — App shell components (TopBar, Sidebar, Canvas, Node, SidePanel, StatusBar, ConfigPanel)
- [x] 01-03-PLAN.md — Per-schema themeConfig overrides + LogTape structured logging foundation

**Done when:**
- App visually matches `variant-c-merged.html` design reference
- All three built-in themes switch without page reload
- Switching to `'system'` preference reflects the OS `prefers-color-scheme` value
- Loading a schema with a `themeConfig` block overrides the active theme tokens for that file
- Zero hardcoded colour values anywhere in component CSS (verified by grep in CI)
- `ThemeProvider` component tests pass

**Dependencies:** Prerequisite

**UI hint**: yes

---

### Phase 2: Read-Only Viewer

**Goal:** Any valid JSON schema renders as a fully interactive, read-only tree with correct status badges, file watching, and side panel — and the 30 fps performance gate is validated before the phase ships.

**Depends on:** Phase 1

**Requirements covered:** VIEW-01, VIEW-02, VIEW-03, VIEW-04, VIEW-05, VIEW-06, VIEW-07, VIEW-08, VIEW-09, VIEW-10, VIEW-11, VIEW-12, VIEW-13, VIEW-14

**Plans:** 5 plans

Plans:
- [x] 02-01-PLAN.md — Schema + Zustand store foundation: Zod schemas, roadmapStore with dataKey pattern, sample schemas
- [x] 02-02-PLAN.md — Tree renderer: react-d3-tree integration, file watcher, layout toggle, schema error panel
- [x] 02-03-PLAN.md — Side panel + welcome screen: data-driven panel, markdown renderer, recent files
- [x] 02-04-PLAN.md — Performance gate: 300+ node benchmark, dataKey stability verification
- [x] 02-05-PLAN.md — UAT gap closure: selection ring clipping fix, Fit View collapse preservation

**Done when:**
- Any valid schema file renders a correct interactive tree within 300ms for up to 500 nodes
- TB and LR layout toggle works; preference survives app restart
- Nodes beyond depth 3 collapse by default; collapse/expand works for all subtrees
- Side panel opens on node click showing title, status, type, timestamps, and rendered markdown notes
- Side panel is resizable and pins on wide screens
- Invalid schema shows an inline error panel identifying type, severity, and location
- File watcher reloads tree when the JSON file is edited externally
- 300+ nodes + 10 `updateNode()` calls/sec holds >= 30 fps (benchmark test must be green)
- Recent files list persists across sessions

**Dependencies:** Phase 1

**UI hint**: yes

---

### Phase 3: Full Editor

**Goal:** A complete roadmap can be created, edited, and saved without touching JSON directly — with full keyboard control, autosave, atomic writes, and correct `$ref` write-back.

**Depends on:** Phase 2

**Requirements covered:** EDIT-01, EDIT-02, EDIT-03, EDIT-04, EDIT-05, EDIT-06, EDIT-07, EDIT-08, EDIT-09, EDIT-10, EDIT-11, EDIT-12, EDIT-13, EDIT-14, EDIT-15, EDIT-16, EDIT-17, EDIT-18

**Plans:** 6 plans

Wave structure:
- **Wave 1** (parallel): 03-01 + 03-04a
- **Wave 2** (parallel): 03-02 + 03-03 + 03-04b
- **Wave 3**: 03-04c

Plans:
- [x] 03-01-PLAN.md — Node mutation operations + inline rename + confirmation dialog + clipboard + keyboard router (EDIT-01..EDIT-08) — UAT approved 2026-04-20
- [x] 03-02-PLAN.md — Context menu via Radix ContextMenu, satisfies Linux fallback via same custom-div (EDIT-09, EDIT-18)
- [x] 03-03-PLAN.md — Side panel editor with CodeMirror 6 Edit/Preview/Split + metadata + editable title/status/type (EDIT-10..EDIT-12) — Wave 2 — UAT approved 2026-04-22
- [x] 03-04a-PLAN.md — Persistence infrastructure: atomic write + ref ownership + saveFile RPC with path-traversal allowlist + Zod pre-write (EDIT-14, EDIT-16, EDIT-17 saveFile, EDIT-18 cross-boundary) — Wave 1 — UAT approved 2026-04-20
- [x] 03-04b-PLAN.md — Autosave wiring + save-state UI: triple-timer debounce + SaveIndicator + SaveFailureModal + Warning-8 snapshots (EDIT-13 debounce, EDIT-15) — Wave 2 — UAT approved 2026-04-22
- [x] 03-04c-PLAN.md — Shell features: before-quit + SIGTERM flush + File > New + external-edit toast (EDIT-13 flush-on-quit, EDIT-17 File>New, EDIT-18 Linux SIGTERM, D-14) — Wave 3

**Plans:**
1. Node mutation operations — inline rename (double-click / F2) using floating `<input>` with inverse D3 zoom transform; add child / add sibling above and below via keyboard shortcuts and context menu; delete (immediate for leaf, confirmation dialog for non-leaf showing count); duplicate node + subtree (`Ctrl+D`); copy/paste node + subtree (`Ctrl+C` / `Ctrl+V`) with JSON clipboard format; move node up/down within siblings (`Ctrl+↑` / `Ctrl+↓`); change node status via context menu sub-menu; arrow-key tree focus navigation (Up/Down siblings, Right expand/enter, Left collapse/return)
2. Context menu + Linux fallback — right-click context menu with full action set; keyboard-navigable (arrow keys + Enter + Escape); ARIA compliant; appears within 50ms; Linux fallback: custom webview-rendered `<div>` context menu (native `ContextMenu.showContextMenu()` is a no-op on Linux)
3. Side panel editor — CodeMirror 6 markdown editor with Edit / Preview / Split modes; autosave debounced 1s; no explicit Save button; editable metadata key-value table; editable title, status dropdown, type dropdown, created/updated timestamps, copy-ID button
4. Autosave + atomic writes + $ref — debounced 2s write, 30s periodic autosave, flush on `before-quit` Electrobun event and `SIGTERM` (Linux); atomic writes via `.tmp` then rename on all platforms; Windows retry loop (3 attempts, 50ms apart); save indicator in status bar (`Saved ✓` / `Saving...` / `Error saving — click to retry`); `$ref` write-back writes mutations to the originating file; cross-boundary moves blocked with a clear error message; `File > New` creates in-memory schema with single root node and prompts for save location on first edit

**Done when:**
- A complete roadmap can be created from `File > New`, all nodes added, edited, and saved without touching JSON
- Inline rename, add/delete/duplicate/move all work via keyboard shortcuts and context menu
- Non-leaf delete shows a confirmation dialog naming the number of children to be removed
- Copy/paste preserves the full subtree; pasting into another file via clipboard text works
- Context menu appears within 50ms, is fully keyboard-navigable, and has correct ARIA roles
- On Linux, right-click opens the webview-rendered fallback menu (not a no-op)
- CodeMirror markdown editor autosaves debounced 1s; all three view modes work
- Status bar shows correct save state at all times
- Atomic write: if the process is killed during a write, the file is not corrupted (`.tmp` -> rename)
- Flush on `before-quit` confirmed: closing the app writes any pending changes
- `$ref` mutations write to the correct originating file; cross-boundary move shows an error

**Dependencies:** Phase 2

**UI hint**: yes

---

### Phase 4: Event API

**Goal:** The app receives live node status updates from external producers via WebSocket and routes them to the correct nodes within 100ms — with the Claude Code MCP wrapper working end-to-end as the reference producer.

**Depends on:** Phase 3

**Requirements covered:** PLUG-01, PLUG-02, PLUG-03, PLUG-04, PLUG-05, PLUG-06, PLUG-07, PLUG-08, PLUG-09

**Plans:** 6 plans (6/6 complete)

Wave structure:
- **Wave 0**: 04-01 (test scaffolding + RPC contract + deps)
- **Wave 1**: 04-02 (Bun WS server + routing + sidecar + sentinel)
- **Wave 2**: 04-03 (pill/pulse/Integration zone/toasts + rpcHandlers scaffolding)
- **Wave 3**: 04-04 (event log drawer + pushEventLog wire-through; depends on rpcHandlers from 04-03)
- **Wave 4**: 04-05 (Claude Code MCP wrapper)
- **Wave 5 (gap closure)**: 04-06 (UAT defect fixes — pulse animation visibility, connected pill click, drawer close affordance)

Plans:
- [x] 04-01-PLAN.md — Wave 0: RPC contract batched pushStatusUpdate + setNodeAllowlist request, IntegrationEvent _error field, @tanstack/react-virtual + @modelcontextprotocol/sdk installs, 22 failing test scaffolds (PLUG-02, PLUG-03, PLUG-09)
- [x] 04-02-PLAN.md — Wave 1: Bun.serve WebSocket lifecycle on 127.0.0.1:47921 (+fallback), Zod event boundary + classifier, EventCoalescer (100ms trailing-edge), .events.jsonl sidecar append+replay, sentinel file write/delete, eventServerStandalone entry, integrated into before-quit/SIGTERM/SIGINT chain (PLUG-01, PLUG-02, PLUG-03, PLUG-09)
- [x] 04-03-PLAN.md — Wave 2: eventApiStore + roadmapStore.applyEventBatch + liveEventMeta + isNodeLive selector + 1Hz tick, pulse CSS (reduced-motion fallback), EventApiPill status-bar component, WelcomeScreen URL line, SidePanel IntegrationZone, EventToast + EventToastStack with 5s throttle-merge, setNodeAllowlist pushed on dataKey bump (PLUG-03 renderer, PLUG-04, PLUG-05, PLUG-06)
- [x] 04-04-PLAN.md — Wave 2: eventLogStore with 1000-row sliding window + filter predicates, EventLogDrawer with @tanstack/react-virtual, EventLogRow + EventLogFilterBar, TopBar Events toggle button, Ctrl+Shift+L keyboard binding, row-click-selects-node + camera-follow (PLUG-06, PLUG-07)
- [x] 04-05-PLAN.md — Wave 3: Claude Code MCP wrapper at plugins/claude-code/ — node-only runtime, sentinel resolver + PID liveness, WS client with exponential backoff capped at 30s, hello frame, updateNodeStatus + getEventApiStatus tools via @modelcontextprotocol/sdk StdioServerTransport, README (PLUG-08)
- [x] 04-06-PLAN.md — Wave 5 (gap closure): UAT-driven fixes for pulse animation visibility (UAT-1: per-theme `--rv-pulse` token via `.node::after` pseudo-element), connected EventApiPill click opens drawer (UAT-3: static import replaces dynamic), and drawer close affordances [×] button + Escape-while-focused (drive-by). PLUG-01, PLUG-04, PLUG-07

**Done when:**
- WebSocket server starts with the app; port is visible to the user (status bar or welcome screen)
- An external script pushing a valid event sees the node badge update within 100ms
- A node with an active producer shows the animated pulse indicator
- Side panel Integration zone shows connection status, last event time, and last meta key-values
- Malformed or unknown-nodeId events surface as non-blocking toasts (not silent failures)
- Event log in View menu shows all received events with full detail
- Claude Code MCP wrapper connects and successfully updates a node status end-to-end
- `plugin` and `subscribe` fields in node JSON are parsed without errors and stored; no action taken on them

**Dependencies:** Phase 3

**UI hint**: yes

---

### Phase 5: Packaging & Distribution

**Goal:** Native installers build on all three platforms, and `@roadmap-viewer/core` + `@roadmap-viewer/react` are published to npm.

**Depends on:** Phase 4

**Requirements covered:** PACK-01, PACK-02, PACK-03, PACK-04, PACK-05, PACK-06

**Plans:**
1. Packaging + auto-updater — macOS `.dmg`, Windows `.exe`, Ubuntu `.deb` native installers; Electrobun auto-updater configured (canary + stable channels); Linux: `bundleCEF: true` confirmed; all file actions reachable via keyboard/toolbar (no `ApplicationMenu` dependency); `process.on('SIGTERM', flushWriteQueue)` registered
2. npm packages + accessibility + docs — `@roadmap-viewer/core` and `@roadmap-viewer/react` published to npm; `react`, `react-dom`, `react-d3-tree` marked as `peerDependencies` in `packages/react`; all peer deps externalized in Vite library build; `packages/core` has zero desktop dependencies (enforced in CI); accessibility audit: full keyboard navigation, ARIA roles on context menu and modal dialogs, colour not used as sole status indicator, focus indicators visible; README, docs site, plugin authoring guide, contribution guide

**Done when:**
- `bun run build:canary` produces `.dmg`, `.exe`, and `.deb` installers that install and launch cleanly
- Auto-updater channels (canary / stable) are configured and the version channel resolves correctly
- `@roadmap-viewer/core` and `@roadmap-viewer/react` install from npm in a clean project without peer-dep errors
- `packages/core` has no desktop dependencies (CI enforces this)
- Accessibility audit passes: keyboard navigation covers all operations, ARIA roles are correct, status is never conveyed by colour alone
- README and plugin authoring guide are published

**Dependencies:** Phase 4

**UI hint**: yes

### Phase 6: Agentic Roadmap Authoring

**Goal:** Agents (Claude Code and other MCP-capable LLM tools) can read, create, edit, move, and delete roadmap nodes via the MCP wrapper — turning Phase 4's one-way producer→app pipe into a bidirectional contract so a developer can ask "scaffold a roadmap for migrating service X" and watch the tree assemble live without ever touching the JSON.

**Depends on:** Phase 4 (Event API / MCP wrapper foundation). Can ship before, after, or alongside Phase 5 (Packaging) — the two are independent.

**Requirements**: TBD (extend PLUG-09 plugin/subscribe scaffolding into a working bidirectional contract; new requirements to be derived during planning)

**Plans:** 0 plans

Plans:
- [ ] TBD (run /gsd-plan-phase 6 to break down)

**Scope sketch (refine in planning):**

*Read tools:* `getRoadmap`, `getNode(id)` (with ancestry), `findNodes(query)` (by title/status/type/metadata), `getStatusConfig`, `getTypeConfig`, `getOpenFile`.

*Create tools:* `createNode({parentId, title, type?, status?, notes?, metadata?})` returning new UUID, `createRoadmap({title, statusConfig?, typeConfig?})` (mirrors File > New), stretch: `importSubtree({parentId, schema})`.

*Update tools:* `renameNode`, `updateNodeStatus` (preserve Phase 4 compat), `updateNodeType`, `updateNodeNotes`, `updateNodeMetadata` (merge-vs-replace TBD), `moveNode(nodeId, newParentId, position?)`.

*Delete tools:* `deleteNode(nodeId, {cascade?})` — non-leaf requires explicit cascade flag mirroring the UI confirmation dialog.

*File lifecycle tools:* `saveFile` (flush autosave debounce), `saveFileAs(path)`, `openFile(path)` — all gated by the existing path-traversal allowlist.

**Out of scope (initial cut):**
- Arbitrary RPC passthrough — only explicitly-exposed tools.
- Mutating `themeConfig` or app settings.
- Reading files outside the loaded roadmap and its `$ref`-linked siblings.
- Bypassing the existing path-traversal allowlist on `openFile` / `saveFileAs`.

**Why this phase:** PLUG-09 left `plugin` / `subscribe` schema fields as parsed-but-unused v1.1 scaffolding. The renderer store already exposes every mutation needed (`addChild`, `deleteNode`, `renameNode`, `updateNodeStatus`, `updateNodeType`, `updateNodeMetadata`, `updateNodeNotes` in `packages/desktop/src/mainview/store/roadmapStore.ts`) — Phase 6 only adds a new transport surface, not new domain logic. Without it, an MCP agent that does not already know node UUIDs from out-of-band context cannot enumerate the roadmap, look up nodes by title, or discover valid status ids.

---

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| Prerequisite: App Scaffold | 3/3 | Complete | - |
| 1. Visual Foundation & Themes | 3/3 | Complete | - |
| 2. Read-Only Viewer | 4/5 | UAT Gap Closure | - |
| 3. Full Editor | 0/6 | Planned | - |
| 4. Event API | 6/6 | Complete | 2026-04-29 |
| 5. Packaging & Distribution | 0/2 | Not started | - |
