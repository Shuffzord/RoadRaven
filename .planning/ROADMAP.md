# Roadmap: Roadmap Viewer

**Created:** 2026-04-12
**Granularity:** Standard
**Total phases:** 5 (+ Prerequisite)

## Overview

Starting from a bare Electrobun shell, we build outward through the visual stack: scaffold the monorepo and TDD pipeline, then establish the theme foundation, prove the tree renderer with a read-only viewer (gating on the 30 fps performance requirement), add the full editor with the `dataKey`-aware Zustand store, wire the WebSocket Event API with the Claude Code MCP reference producer, and finish with export capabilities and cross-platform packaging.

---

## Phases

- [ ] **Prerequisite: App Scaffold** — Electrobun shell boots; monorepo, TDD pipeline, and CI all operational
- [ ] **Phase 1: Visual Foundation & Themes** — App shell renders with all three built-in themes; `--rv-*` token system in place
- [ ] **Phase 2: Read-Only Viewer** — Any valid JSON schema renders as an interactive tree; performance gate passes
- [ ] **Phase 3: Full Editor** — A complete roadmap can be created, edited, and saved without touching JSON directly
- [ ] **Phase 4: Event API** — Nodes receive live status updates from external producers via WebSocket; Claude Code MCP wrapper works end-to-end
- [ ] **Phase 5: Export & Packaging** — Self-contained HTML and 2x PNG export; native installers on all three platforms; npm packages published

---

## Phase Details

### Prerequisite: App Scaffold

**Goal:** Electrobun shell boots to a blank window with the monorepo structure, typed RPC skeleton, and TDD pipeline fully operational on CI.

**Depends on:** Nothing

**Requirements covered:** SCAF-01, SCAF-02, SCAF-03, SCAF-04, SCAF-05, SCAF-06, SCAF-07, SCAF-08, SCAF-09

**Plans:** 3 plans

Plans:
- [ ] 00-01-PLAN.md — Monorepo bootstrap: workspace structure, migrate code to packages/desktop, bundleCEF: true
- [ ] 00-02-PLAN.md — RPC contract + Updater fix: shared/types.ts with RoadmapRPCType, SCAF-09 try/catch
- [ ] 00-03-PLAN.md — TDD pipeline: Biome, Vitest, Playwright two-tier, GitHub Actions CI

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

**Plans:**
1. Theme token system — `ThemeProvider` applies active theme as `--rv-*` CSS custom properties on `:root`; `dark` (default), `light`, `high-contrast` themes defined; app-level preference persisted in `.roadmap-settings.json`; OS `prefers-color-scheme` respected when set to `'system'`
2. App shell components — static top bar, sidebar, canvas with dot-grid, status bar, node component (4px left colour-stripe, status badge pill, title), and side panel skeleton; all use `--rv-*` tokens exclusively — no hardcoded colours
3. Per-schema theme overrides — `themeConfig` block in JSON schema parsed and applied as token overrides on top of the active base theme; component tests for `ThemeProvider` and sample components pass

**Done when:**
- App visually matches `phase-1.html` design reference
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

**Plans:**
1. Schema + Zustand store foundation — Zod v4 schema validator with full unit coverage; two sample schemas committed (`hello-world.json`, `getting-started.json`); Zustand store with `dataKey` pattern designed before any component work: `dataKey` increments only on structural changes, status-only updates go in-place via `useShallow` selectors; `.bak.json` written on every file open
2. Tree renderer — react-d3-tree renders from JSON using `dataKey` pattern; TB and LR layout toggle; layout preference persisted per file in `.roadmap-settings.json`; collapse/expand with depth 3 default; zoom/pan (scroll wheel, pinch, click-drag); status badges (4px stripe + pill label) with correct theme colours; `$ref` resolution at load time with independent file watchers per referenced file; schema validation error panel
3. Side panel + welcome screen — side panel opens in read-only mode (title, status, type, timestamps, markdown notes rendered via remark/rehype); resizable (min 320px, max 50% viewport); pin mode on screens wider than 1400px; welcome screen when no recent files open; recent files list (last 10) persisted in `.roadmap-settings.json` and shown in File menu
4. Performance gate — benchmark harness: 300+ visible nodes + 10 simulated `store.updateNode()` calls/sec measured at ≥ 30 fps on a mid-range machine; file watcher reloads tree on external change without restarting the app; read-only E2E tests pass; phase does NOT ship until benchmark is green

**Done when:**
- Any valid schema file renders a correct interactive tree within 300ms for up to 500 nodes
- TB and LR layout toggle works; preference survives app restart
- Nodes beyond depth 3 collapse by default; collapse/expand works for all subtrees
- Side panel opens on node click showing title, status, type, timestamps, and rendered markdown notes
- Side panel is resizable and pins on wide screens
- Invalid schema shows an inline error panel identifying type, severity, and location
- File watcher reloads tree when the JSON file is edited externally
- 300+ nodes + 10 `updateNode()` calls/sec holds ≥ 30 fps (benchmark test must be green)
- Recent files list persists across sessions

**Dependencies:** Phase 1

**UI hint**: yes

---

### Phase 3: Full Editor

**Goal:** A complete roadmap can be created, edited, and saved without touching JSON directly — with full keyboard control, autosave, atomic writes, and correct `$ref` write-back.

**Depends on:** Phase 2

**Requirements covered:** EDIT-01, EDIT-02, EDIT-03, EDIT-04, EDIT-05, EDIT-06, EDIT-07, EDIT-08, EDIT-09, EDIT-10, EDIT-11, EDIT-12, EDIT-13, EDIT-14, EDIT-15, EDIT-16, EDIT-17, EDIT-18

**Plans:**
1. Node mutation operations — inline rename (double-click / F2) using floating `<input>` with inverse D3 zoom transform; add child / add sibling above and below via keyboard shortcuts and context menu; delete (immediate for leaf, confirmation dialog for non-leaf showing count); duplicate node + subtree (`Ctrl+D`); copy/paste node + subtree (`Ctrl+C` / `Ctrl+V`) with JSON clipboard format; move node up/down within siblings (`Ctrl+↑` / `Ctrl+↓`); change node status via context menu sub-menu; arrow-key tree focus navigation (Up/Down siblings, Right expand/enter, Left collapse/return)
2. Context menu + Linux fallback — right-click context menu with full action set; keyboard-navigable (arrow keys + Enter + Escape); ARIA compliant; appears within 50ms; Linux fallback: custom webview-rendered `<div>` context menu (native `ContextMenu.showContextMenu()` is a no-op on Linux)
3. Side panel editor — CodeMirror 6 markdown editor with Edit / Preview / Split modes; autosave debounced 1s; no explicit Save button; editable metadata key-value table; editable title, status dropdown, type dropdown, created/updated timestamps, copy-ID button
4. Autosave + atomic writes + $ref — debounced 2s write, 30s periodic autosave, flush on `before-quit` Electrobun event and `SIGTERM` (Linux); atomic writes via `.tmp` then rename on all platforms; Windows retry loop (3 attempts, 50ms apart); save indicator in status bar (`Saved ✓` / `Saving…` / `Error saving — click to retry`); `$ref` write-back writes mutations to the originating file; cross-boundary moves blocked with a clear error message; `File > New` creates in-memory schema with single root node and prompts for save location on first edit

**Done when:**
- A complete roadmap can be created from `File > New`, all nodes added, edited, and saved without touching JSON
- Inline rename, add/delete/duplicate/move all work via keyboard shortcuts and context menu
- Non-leaf delete shows a confirmation dialog naming the number of children to be removed
- Copy/paste preserves the full subtree; pasting into another file via clipboard text works
- Context menu appears within 50ms, is fully keyboard-navigable, and has correct ARIA roles
- On Linux, right-click opens the webview-rendered fallback menu (not a no-op)
- CodeMirror markdown editor autosaves debounced 1s; all three view modes work
- Status bar shows correct save state at all times
- Atomic write: if the process is killed during a write, the file is not corrupted (`.tmp` → rename)
- Flush on `before-quit` confirmed: closing the app writes any pending changes
- `$ref` mutations write to the correct originating file; cross-boundary move shows an error

**Dependencies:** Phase 2

**UI hint**: yes

---

### Phase 4: Event API

**Goal:** The app receives live node status updates from external producers via WebSocket and routes them to the correct nodes within 100ms — with the Claude Code MCP wrapper working end-to-end as the reference producer.

**Depends on:** Phase 3

**Requirements covered:** PLUG-01, PLUG-02, PLUG-03, PLUG-04, PLUG-05, PLUG-06, PLUG-07, PLUG-08, PLUG-09

**Plans:**
1. Research gate — before any implementation, produce a design document covering: WebSocket server lifecycle (port config, start/stop, user communication of port/URL), event contract finalisation, 100ms debounce buffer design, connection-drop and malformed-event handling strategy, and event log storage; no implementation code written until research is complete and approved
2. WebSocket server + event routing — WebSocket server on `ws://127.0.0.1:<port>` (port configurable, default locked in after research); server starts with the app and is always available; event contract `{ nodeId, status, meta?, source? }` implemented; events routed to correct node within 100ms; 100ms debounce buffer on Bun side batches bursts before forwarding to webview; `plugin` and `subscribe` blocks parsed and stored by Zod schema but not acted on (reserved for v1.1); unknown `plugin.id` values silently accepted
3. UI — animated pulse indicator on nodes receiving live events while producer is connected; side panel Integration zone: connection status, last event timestamp, last received `meta` as key-value table (no custom component injection); non-blocking toasts for connection drops and malformed events with retry/dismiss; in-app event log (View menu) showing `nodeId`, `status`, `source`, `meta`, timestamp for all received events
4. Claude Code MCP wrapper — reference Event Producer ships as `plugins/claude-code/`; wraps event contract as MCP tools callable by Claude; connects to app's WebSocket and pushes `{ nodeId, status, meta }` events; end-to-end test: Claude Code updates a node status and the badge re-renders in the app

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

### Phase 5: Export & Packaging

**Goal:** Self-contained HTML and 2x PNG exports work reliably, native installers build on all three platforms, and `@roadmap-viewer/core` + `@roadmap-viewer/react` are published to npm.

**Depends on:** Phase 4

**Requirements covered:** EXPO-01, EXPO-02, EXPO-03, PACK-01, PACK-02, PACK-03, PACK-04, PACK-05, PACK-06

**Plans:**
1. PNG export spike — before committing to an approach, spike both candidates (direct SVG serialization: `XMLSerializer.serializeToString(svgElement)` → canvas → `toDataURL('image/png')`, and `modern-screenshot`); measure output quality on a 300-node tree; choose one; raise `maxRequestTime` for `exportPng` RPC call to 15s; no production PNG code written until spike concludes
2. Export implementation — HTML export: self-contained single-file HTML with interactive tree and active theme tokens embedded; PNG export: full tree at 2x resolution using the approach chosen in the spike; both export types accessible via `Ctrl+Shift+E` and `File > Export` menu; export E2E tests pass
3. Packaging + auto-updater — macOS `.dmg`, Windows `.exe`, Ubuntu `.deb` native installers; Electrobun auto-updater configured (canary + stable channels); Linux: `bundleCEF: true` confirmed; all export and file actions reachable via keyboard/toolbar (no `ApplicationMenu` dependency); `process.on('SIGTERM', flushWriteQueue)` registered
4. npm packages + accessibility + docs — `@roadmap-viewer/core` and `@roadmap-viewer/react` published to npm; `react`, `react-dom`, `react-d3-tree` marked as `peerDependencies` in `packages/react`; all peer deps externalized in Vite library build; `packages/core` has zero desktop dependencies (enforced in CI); accessibility audit: full keyboard navigation, ARIA roles on context menu and modal dialogs, colour not used as sole status indicator, focus indicators visible; README, docs site, plugin authoring guide, contribution guide

**Done when:**
- HTML export produces a self-contained file that opens in a browser with the correct interactive tree and active theme
- PNG export produces a 2x resolution image of the full tree without corrupted SVG rendering
- Both export types are reachable via `Ctrl+Shift+E` and `File > Export` menu
- `bun run build:canary` produces `.dmg`, `.exe`, and `.deb` installers that install and launch cleanly
- Auto-updater channels (canary / stable) are configured and the version channel resolves correctly
- `@roadmap-viewer/core` and `@roadmap-viewer/react` install from npm in a clean project without peer-dep errors
- `packages/core` has no desktop dependencies (CI enforces this)
- Accessibility audit passes: keyboard navigation covers all operations, ARIA roles are correct, status is never conveyed by colour alone
- README and plugin authoring guide are published

**Dependencies:** Phase 4

**UI hint**: yes

---

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| Prerequisite: App Scaffold | 0/3 | Planned | - |
| 1. Visual Foundation & Themes | 0/3 | Not started | - |
| 2. Read-Only Viewer | 0/4 | Not started | - |
| 3. Full Editor | 0/4 | Not started | - |
| 4. Event API | 0/4 | Not started | - |
| 5. Export & Packaging | 0/4 | Not started | - |
