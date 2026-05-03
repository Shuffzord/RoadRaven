# Roadmap Viewer — Requirements & Architecture Specification

> **Version:** 0.3 — Themes + Plugin System  
> **Status:** In Review  
> **Stack:** Electrobun · Bun · React · TypeScript  
> **License:** MIT (open source)

*An open-source, Electrobun-based desktop tool for creating, editing, and live-monitoring visual roadmap trees — with built-in pub/sub integration for external tooling.*

---

## Table of Contents

1. [Overview & Goals](#1-overview--goals)
2. [Development Phases](#2-development-phases)
3. [User Stories](#3-user-stories)
4. [JSON Schema Design](#4-json-schema-design)
5. [Architecture](#5-architecture)
6. [Event Flow Sequences](#6-event-flow-sequences)
7. [Error Taxonomy](#7-error-taxonomy)
8. [UI Design Principles](#8-ui-design-principles)
9. [Accessibility Requirements](#9-accessibility-requirements)
10. [Performance & Scalability](#10-performance--scalability)
11. [Testing Strategy](#11-testing-strategy)
12. [Sample Schemas](#12-sample-schemas)
13. [Dependencies](#13-dependencies)
14. [Known Constraints & Future Concerns](#14-known-constraints--future-concerns)
15. [Open Questions Log](#15-open-questions-log)

---

## 1. Overview & Goals

Roadmap Viewer is a lightweight desktop application built with **Electrobun** that lets anyone load, visualise, create, and edit hierarchical roadmap trees from a plain JSON schema. Each node in the tree carries a Notion-style side panel with markdown notes. The tool is deliberately generic — the same schema serves learning roadmaps, product plans, data pipeline maps, and task boards. No opinions about workflow are baked in.

### Core value propositions

- **Zero-opinion data model** — user-defined node statuses and types via JSON
- **Keyboard-first editing** — Tab, Enter, F2, no mode-switching
- **Notion-like side panel** — markdown, notes, links, arbitrary metadata per node
- **Live status updates** — nodes reflect real pipeline / CI / agent state via pub/sub
- **Plugin system** — integrations are pluggable; Claude Code is the reference implementation
- **Themes** — per-schema or app-level visual themes via `themeConfig`; colors, fonts, node shapes configurable without code changes
- **Git-friendly** — plain JSON, human-readable diffs
- **Open source, MIT licensed** — embeddable as an npm package (`@roadmap-viewer/core`, `@roadmap-viewer/react`)

### Primary v1 anchor use case

> A developer opens a JSON roadmap describing their project task tree. Each node is bound to an external tool via the plugin system. The app loads the relevant plugin (e.g. the Claude Code plugin) which connects to the tool's event stream and live-updates node statuses as work progresses — turning the roadmap into a real-time progress dashboard.

---

## 2. Features & Development Sequence

### 2.1 Feature Capabilities

What the app can do, independent of build order. See §2.2 for sequence.

**Core Data Model** — load, validate, and persist roadmap trees from a versioned JSON schema. Nodes carry title, status, type, notes, metadata, and children. User-defined `statusConfig` and `typeConfig`. Split-file support via `$ref`.

**Theme System** — built-in themes: `dark` (default), `light`, `high-contrast`. Per-schema overrides via `themeConfig` (CSS custom property tokens). App-level preference, with OS `prefers-color-scheme` as fallback when set to `'system'`.

**Tree Viewer** — interactive hierarchical tree (TB and LR layouts). Collapse/expand, zoom/pan. Status badges. File watcher for live external reload. Schema validation error panel.

**Node Editor** — inline rename, add/delete/duplicate/move nodes via keyboard and context menu. Full keyboard shortcut suite. Autosave with atomic writes.

**Side Panel** — node inspector: editable title, status, type, timestamps, markdown notes (CodeMirror 6), metadata key-value table. Plugin integration zone and actions zone.

**Plugin Integration System** ⚠️ *Research required — see §2.2 Step 4.*
Nodes receive live status updates from external tools; the app can publish node state outward. Generic plugin interface — Claude Code is the reference implementation.

**Packaging** — native installers (macOS, Windows, Linux), auto-updater, npm packages (`@roadmap-viewer/core`, `@roadmap-viewer/react`), plugin authoring guide.

---

### 2.2 Development Sequence

All steps follow a **TDD-first** approach — tests are written before implementation. No step begins until the prior step's acceptance tests are green.

---

#### Prerequisite — App Scaffold

**Goal:** A running Electrobun app with all dependencies installed and the TDD pipeline operational.

- Monorepo scaffold: `packages/core`, `packages/react`, `packages/desktop`, `plugins/`
- All production and dev dependencies installed (`bun install`)
- Electrobun shell boots to a blank window
- RPC type contract skeleton defined in `shared/types.ts`
- `RoadmapPlugin` interface defined in `packages/core/src/plugin.ts` (no implementation)
- Vitest configured; first unit test passes
- Playwright E2E configured; first test (window launches) passes
- GitHub Actions CI: lint + unit tests on every PR
- `bun run dev:hmr` and `bun run build:canary` both succeed

**Done when:** `bun run dev` opens a blank window. CI passes.

---

#### Step 1 — Visual Foundation & Themes

**Goal:** The app renders the design shown in `.planning/design/variant-c-merged.html`. Theme loading and switching works before any real data is wired up.

- `ThemeProvider` applies the active theme as `--rv-*` CSS custom properties on `:root`
- Built-in themes: `dark` (default, matching `variant-c-merged.html`), `light`, `high-contrast`
- App-level preference persisted in `.roadmap-settings.json`; OS `prefers-color-scheme` respected when preference is `'system'`
- Static sample components matching the `variant-c-merged.html` design:
  - App shell: top bar (with search, new/open, view controls), collapsible sidebar, canvas with dot-grid, status bar
  - Node component: left colour-stripe (4 px), status badge (pill + text label), title — rounded corners (8px) default
  - Side panel: slides in from right on node click, header zone, metadata grid, notes area
- Schema-scoped `themeConfig` block overrides the active base theme for a loaded file
- All components use `--rv-*` tokens — no hardcoded colours

**Done when:** App visually matches `variant-c-merged.html`. All three built-in themes switch without reload. Component tests for `ThemeProvider` and sample components pass.

---

#### Step 2 — Read-Only Viewer

**Goal:** A working tree viewer. No editing. Proves the renderer and file-loading stack.

- JSON schema design locked; Zod validator written with full unit test coverage
- Two sample schemas committed (`hello-world.json`, `getting-started.json`)
- Tree renders from JSON using `react-d3-tree`
- Collapse / expand subtrees; nodes beyond depth 3 collapse by default
- Layout toggle: TB and LR; preference persisted per file
- Zoom and pan
- Status badges with correct theme colours
- Side panel opens in **read-only** mode (title, status, notes as markdown)
- File watcher reloads tree on external file change
- Schema validation errors shown in inline error panel
- **Performance gate:** 300+ visible nodes + 10 simulated `store.updateNode()` calls/sec ≥ 30 fps

**Done when:** Any valid schema renders correctly. Read-only E2E tests pass. Benchmark passes.

---

#### Step 3 — Editor

**Goal:** Full in-app editing. A user can build a roadmap entirely inside the app.

- Inline node rename (double-click / F2)
- Add child, add sibling above/below (keyboard + context menu)
- Delete node (confirmation for non-leaf nodes)
- Duplicate node + subtree; move node up/down (sibling reorder)
- Change node status (context menu + side panel dropdown)
- Right-click context menu (full spec in §8.1); keyboard shortcuts (full spec in §8.2)
- Side panel: CodeMirror 6 markdown editor with autosave; editable metadata table
- Side panel Integration zone: placeholder scaffold (empty, non-rendered) ready for Step 4
- Autosave: debounced 2 s, periodic 30 s, flush on app close
- Atomic writes: `.tmp` then rename — prevents corruption on crash
- Save indicator in status bar
- `$ref` write-back (writes to originating file; cross-boundary moves blocked with error)

**Done when:** A complete roadmap can be created, edited, and saved without touching JSON directly. Editor E2E tests pass.

---

#### Step 4 — Plugin Integration System

> ⚠️ **A research phase is required before any implementation begins.**
>
> A dedicated research task must produce a design document covering: plugin interface contract, transport adapters (WebSocket, Webhook, MQTT, file watcher), security and isolation model, Bun-to-webview side panel component handoff, static vs. dynamic loading decision, and at minimum two reference implementations (Claude Code + one other). No implementation code is written until the research document is approved.

**Desired outcome:**
- Nodes receive live status updates published by external tools (CI pipelines, AI agents, scripts)
- The app can publish node state changes outward to external consumers
- Integration layer is pluggable — a generic interface any tool can implement
- Claude Code ships as the reference implementation

**Done when:** At least one plugin works end-to-end. Node status updates live. Plugin interface is documented for third-party authors.

---

#### Step 5 — Polish & Packaging

**Goal:** Shippable, accessible, documented.

- Accessibility audit (full requirements in §9)
- npm package publishing: `@roadmap-viewer/core`, `@roadmap-viewer/react`
- Plugin authoring guide
- Electrobun auto-updater configured
- Native installers: macOS `.dmg`, Windows `.exe`, Ubuntu `.deb`
  - **Linux note:** `bundleCEF: true` required in `electrobun.config.ts` for Linux builds. `ApplicationMenu` is not supported on Linux — all file actions must be reachable via keyboard shortcuts and toolbar buttons (not app menu only).
- README, docs site, contribution guide

**Done when:** Installers build cleanly on all three platforms. Accessibility checklist passes.

---

#### Future — v1.1

- Drag-and-drop node reordering
- Schema migration tooling (`migrator` in `@core`)
- Multi-file workspace (tabbed)
- Node search with highlighted results
- Bulk operations on multi-selected nodes
- Radial / mindmap layout mode
- SQLite persistence mode
- Dynamic runtime plugin loading from local `plugins/` directory

---

### Out of scope (all versions)

- User authentication or cloud sync
- Real-time multi-user editing (CRDT)
- Mobile / web deployment
- Multi-window support

---

## 3. User Stories

### US-01 · Load and display a roadmap

| | |
|---|---|
| **As a** | developer / knowledge worker |
| **I want** | to open a JSON file and see my roadmap rendered as an interactive tree |
| **So that** | I can immediately visualise and navigate complex hierarchies without setup |

**Acceptance criteria**
- App opens a `.json` file via native file picker or CLI argument (`roadmap-viewer ./my-roadmap.json`)
- Tree renders within 300 ms for schemas up to 500 nodes
- Nodes display: title, status badge, type icon, child count when collapsed
- File watcher detects external changes and re-renders without restarting the app
- Invalid schema shows an inline error panel identifying the error type, severity, and location

**Phase:** 1

---

### US-02 · Keyboard-first node editing

| | |
|---|---|
| **As a** | power user |
| **I want** | to create, rename, and delete nodes entirely with the keyboard |
| **So that** | I can build and restructure roadmaps at the speed of thought |

**Acceptance criteria**
- `Enter` — adds a sibling node below selected; new node enters rename mode immediately
- `Shift+Enter` — adds a sibling node above selected
- `Tab` — indents selected node (makes it child of node above); disabled if no node above at same level
- `Shift+Tab` — outdents selected node (promotes to parent's sibling)
- `F2` / double-click — enters inline rename mode
- `Delete` on empty node — removes node, focuses previous node
- `Delete` on non-empty node — shows confirmation: *"Delete node and N children?"*
- `Ctrl+D` — duplicates selected node and subtree; paste appears as sibling below
- `Escape` — cancel rename → close panel → deselect (context-sensitive cascade)
- All operations reflected immediately in in-memory JSON; autosave triggers within 2 s

**Phase:** 2

---

### US-03 · Right-click context menu

| | |
|---|---|
| **As a** | mouse-first user |
| **I want** | a right-click context menu on any node |
| **So that** | I can discover all editing capabilities without memorising shortcuts |

**Acceptance criteria**
- Menu appears within 50 ms of right-click
- Menu items: `Add child`, `Add sibling above`, `Add sibling below`, `Rename`, `Change status` (sub-menu), `Duplicate`, `Move up`, `Move down`, `Delete`
- `Change status` sub-menu lists all statuses from `statusConfig`
- `Add sibling` is disabled on root nodes
- Menu closes on `Escape`, click-away, or after action executes
- Menu is keyboard-navigable: Arrow keys + Enter + Escape (see §9 for ARIA requirements)

**Phase:** 2

---

### US-04 · Notion-style side panel

| | |
|---|---|
| **As a** | user |
| **I want** | to click any node and open a rich side panel with markdown notes and metadata |
| **So that** | every roadmap element can carry full context without cluttering the tree |

**Acceptance criteria**
- Clicking a node slides open a right-side panel (resizable: min 320 px, max 50% viewport)
- Panel is read-only in Phase 1; editable from Phase 2 onward
- Panel header: editable title, status dropdown, type dropdown, created/updated timestamps, copy-ID button
- Panel body: CodeMirror 6 markdown editor; modes: Edit | Preview | Split
- Markdown supports: headings, bold, italic, code blocks, inline code, links, checklists, tables
- Notes stored in node JSON as markdown string under key `"notes"`
- **Autosave behaviour:** notes save automatically on every edit (debounced 1 s); no explicit Save button; no confirmation on close
- Panel width preference persisted in `.roadmap-settings.json`
- Panel closes with `Escape` or X button; focus returns to the triggering node
- On screens wider than 1400 px: optional pin mode (panel sits beside tree, does not overlay)

**Phase:** 1 (read-only), 2 (editable)

---

### US-05 · Node status and metadata

| | |
|---|---|
| **As a** | user |
| **I want** | each node to carry configurable status and arbitrary metadata fields |
| **So that** | the tool serves any domain without a forced workflow |

**Acceptance criteria**
- Schema supports top-level `statusConfig` array; each entry has `id`, `label`, `color`, `isDefault`
- One status must be marked `isDefault`; it is applied automatically to new nodes
- Each node's `status` must match a `statusConfig` id; mismatch is a blocking validation error
- Status changes via side panel dropdown or context menu sub-menu
- Status color reflected in node's left border (4 px) and badge background (20% opacity)
- Status badge uses text label — never color alone (accessibility requirement)
- Nodes support optional `meta` object: arbitrary key-value pairs, rendered as editable table in side panel

**Phase:** 1 (display), 2 (editing)

---

### US-06 · Layout modes

| | |
|---|---|
| **As a** | user |
| **I want** | to switch between top-down and left-right tree layouts |
| **So that** | I can choose the layout that fits my roadmap's shape |

**Acceptance criteria**
- Toolbar toggle switches between vertical (TB) and horizontal (LR) layouts
- Layout preference persisted per file in `.roadmap-settings.json`
- Layout switch animates with 200 ms transition; no flicker
- Both layouts support collapse/expand of subtrees
- Zoom and pan (pinch, scroll wheel, click-drag) work identically in both layouts
- Nodes beyond depth 3 render collapsed by default (configurable in settings)

**Phase:** 1

---

### US-07 · Live status via pub/sub

| | |
|---|---|
| **As a** | developer / automation engineer |
| **I want** | nodes to receive live status updates from external tools |
| **So that** | my roadmap reflects real-time state of pipelines, CI runs, and agent tasks |

**Acceptance criteria**
- Each node may define a `subscribe` block specifying `transport`, `channel`, `endpoint`, `statusMap`
- Bun main process establishes subscriptions at load time
- Incoming events update node status in-memory and re-render badge within 100 ms
- Live-subscribed nodes show an animated pulse indicator while connected
- Integration status bar shows all active connections and their health
- Connection errors surface as non-blocking toasts with a retry button
- All events logged to in-app event log (View menu)
- When a subscribed node is deleted, the Bun process closes the associated connection
- If a deleted node's removal is not undone (no undo in MVP), connection remains closed

**Phase:** 3

---

### US-08 · Plugin integration (Claude Code reference implementation)

| | |
|---|---|
| **As a** | developer using an external tool (e.g. Claude Code, GitHub Actions) |
| **I want** | roadmap nodes to bind to that tool via its plugin and receive live status |
| **So that** | I can visually track progress from any external system |

**Acceptance criteria**
- Node carries optional `plugin` block: `id`, `config` (shape is plugin-defined)
- Plugin host loads the matching plugin and calls `connect(nodeId, config)`
- Node status updates when the plugin emits a status event
- Clicking a node with an active plugin shows connection state and event log in the side panel Integration zone
- Plugin may register custom actions that appear in the side panel Actions zone
- Unknown `plugin.id` shows a Warning indicator on the node; app continues loading normally

**Phase:** 3

---

## 4. JSON Schema Design

### 4.1 Design decisions

**Nested vs flat structure**

The schema uses a **nested structure** (children arrays) rather than a flat list with parent IDs.

- ✅ Human-readable and hand-editable
- ✅ Maps directly to the tree renderer without transformation
- ✅ Clean Git diffs for additions
- ⚠️ Moving a node across subtrees requires splicing arrays — the editor handles this; the parser does not need to

**Node ID format: UUIDs**

Node IDs are UUIDs (v4). Rationale:

- Guaranteed unique without checking existing IDs
- Stable across renames — subscriptions, Claude Code bindings, and future git-based history all depend on IDs never changing
- The app generates IDs; users rarely type them

Drawback: ugly in raw JSON. Mitigation: nodes have a human-readable `title`; the ID is infrastructure. If readability in diffs is needed, an optional `"label"` field can be added (display only, never used for routing).

**Slug alternative (rejected for MVP)**

User-defined slugs are readable but create a collision risk and break subscriptions silently if a user edits the ID by hand. Rejected for v1.

---

### 4.2 Top-level structure

```json
{
  "version": "1.0",
  "title": "My Project Roadmap",
  "description": "Optional description shown in the app header",
  "statusConfig": [ ... ],
  "typeConfig": [ ... ],
  "themeConfig": { ... },
  "nodes": [ ... ]
}
```

The `version` field is required and used by the migration system (v3.0+). The parser reads it at load time and will surface a warning if the version is newer than the app supports.

---

### 4.3 statusConfig

Defines all valid statuses. Every node's `status` field must match an entry here. Mismatch is a **blocking validation error**.

```json
"statusConfig": [
  { "id": "todo",        "label": "To Do",      "color": "#D3D1C7", "isDefault": true },
  { "id": "in-progress", "label": "In Progress", "color": "#FAC775" },
  { "id": "done",        "label": "Done",        "color": "#5DCAA5" },
  { "id": "blocked",     "label": "Blocked",     "color": "#F09595" }
]
```

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | string | ✅ | Unique key used in node `status` field and `statusMap` routing |
| `label` | string | ✅ | Display text in badges and menus |
| `color` | hex string | ✅ | Node border and badge colour |
| `isDefault` | boolean | one required | Applied to new nodes automatically |

---

### 4.4 typeConfig

Optional. Defines node types (e.g. `task`, `milestone`, `epic`). If omitted, no type system is enforced.

```json
"typeConfig": [
  { "id": "task",      "label": "Task",      "icon": "check-square" },
  { "id": "milestone", "label": "Milestone", "icon": "flag" }
]
```

Icons reference the built-in icon set. Custom SVG icons are a v1.1 feature.

---

### 4.5 Node object

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | UUID string | ✅ | Unique across the document. Generated by the app; do not edit manually. |
| `title` | string | ✅ | Displayed on the node in the tree. |
| `status` | string | ✅ | Must match a `statusConfig.id`. |
| `type` | string | — | Must match a `typeConfig.id` if `typeConfig` is defined. |
| `notes` | string | — | Markdown content stored as raw string. Displayed in the side panel. |
| `meta` | object | — | Arbitrary key-value pairs. Values must be strings or numbers. |
| `children` | Node[] | — | Nested child nodes. |
| `subscribe` | object | — | Pub/sub subscription config. See §4.6. |
| `plugin` | object | — | Plugin binding (replaces the former `claudeCode` field). See §4.7. |
| `$ref` | string | — | Relative path to an external JSON file for this subtree. See §4.8. |

Example node:

```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "title": "Customer ETL Pipeline",
  "status": "in-progress",
  "type": "task",
  "notes": "## Overview\n\nThis pipeline extracts from Postgres, transforms with dbt, loads to BigQuery.\n\n- [ ] Write extraction query\n- [ ] Configure dbt models\n- [ ] Set up BigQuery schema",
  "meta": {
    "owner": "data-team",
    "priority": "high",
    "ticket": "ENG-1234"
  },
  "children": []
}
```

---

### 4.6 subscribe block

Attaches a live data subscription to a node. The Bun main process reads this at load time and establishes the connection.

```json
"subscribe": {
  "transport": "websocket",
  "channel":   "pipelines.etl_customers",
  "endpoint":  "ws://localhost:4242",
  "statusMap": {
    "running": "in-progress",
    "success": "done",
    "failed":  "blocked",
    "queued":  "todo"
  }
}
```

| Field | Type | Description |
|---|---|---|
| `transport` | `"websocket"` \| `"webhook"` \| `"mqtt"` \| `"file"` | Integration adapter to use |
| `channel` | string | Channel name / MQTT topic / webhook path to subscribe to |
| `endpoint` | string | Connection target (WebSocket URL, broker URL, or file path) |
| `statusMap` | object | Maps inbound event status strings to `statusConfig` ids |

**Expected inbound event shape (all transports):**

```json
{
  "status": "running",
  "meta": { "duration_ms": 1240, "rows": 52000 }
}
```

The `status` field is required. `meta` is optional and merged into the node's `meta` on receipt.

---

### 4.7 plugin block

Binds a node to an integration plugin by `id`. The plugin host in the Bun process reads this at load time and delegates to the matching plugin.

```json
"plugin": {
  "id":     "claude-code",
  "config": {
    "taskLabel": "Implement customer ETL pipeline",
    "channel":   "ws://localhost:3284/tasks/etl-customers",
    "autoSync":  true
  }
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | string | ✅ | Plugin identifier. Must match a registered plugin's `id`. Unknown ids surface a Warning. |
| `config` | object | ✅ | Plugin-specific configuration. Shape is defined and validated by the plugin itself. |

The `plugin` block replaces the former `claudeCode` hardcoded field. Migrating: rename `claudeCode` → `plugin: { id: "claude-code", config: { ...former claudeCode fields } }`.

**Built-in plugin ids:** `"claude-code"`, `"github-actions"`. Third-party plugins are loaded from a `plugins/` directory next to the app binary (v1.1+).

### 4.8 themeConfig block

Optional. Defines schema-scoped theme overrides. When present, the schema's theme takes precedence over the app-level preference for this file. Unspecified tokens fall back to the active base theme.

**Design note:** The app is dark-first. The `dark` theme (default) matches the design shown in `.planning/design/variant-c-merged.html` — rounded corners (8px default, configurable), dark surfaces, subtle shadows on hover, blue accent. The `light` theme is the alternative.

```json
"themeConfig": {
  "base":   "dark",
  "tokens": {
    "--rv-canvas-bg":             "#131313",
    "--rv-canvas-grid-color":     "rgba(255,255,255,0.03)",
    "--rv-canvas-grid-size":      "40px",

    "--rv-node-border-radius":    "0px",
    "--rv-node-border-width":     "4px",
    "--rv-node-title-transform":  "uppercase",
    "--rv-node-title-tracking":   "0.08em",

    "--rv-font-family-headline":  "\"Inter\", sans-serif",
    "--rv-font-family-body":      "\"Inter\", sans-serif",
    "--rv-font-family-label":     "\"Space Grotesk\", sans-serif",
    "--rv-font-size-node":        "13px",

    "--rv-surface":               "#131313",
    "--rv-surface-container":     "#1b1b1c",
    "--rv-surface-container-high":"#2a2a2a",
    "--rv-on-surface":            "#e5e2e1",
    "--rv-on-surface-muted":      "#919191",

    "--rv-status-done-color":     "#10b981",
    "--rv-status-progress-color": "#fbbf24",
    "--rv-status-todo-color":     "#52525b",
    "--rv-status-blocked-color":  "#ef4444"
  }
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `base` | `"dark"` \| `"light"` \| `"high-contrast"` | — | Base theme to inherit from. Defaults to app-level preference (default: `"dark"`). |
| `tokens` | object | — | CSS custom property overrides. Keys must begin with `--rv-`. Values are free-form CSS strings — the browser silently ignores invalid values and falls back to the base theme token. |

**Token categories:**

| Prefix | Controls |
|---|---|
| `--rv-canvas-*` | Canvas background colour, dot-grid colour and size |
| `--rv-node-*` | Node border radius, border width, title text transform and letter spacing |
| `--rv-font-family-*` | Headline, body, and label typefaces |
| `--rv-font-size-*` | Node title size, badge size |
| `--rv-surface*` / `--rv-on-surface*` | App chrome colours (sidebar, panels, status bar) |
| `--rv-status-*-color` | Left-stripe and badge colour per status (overrides `statusConfig[].color` visually) |

The canonical token list with all defaults lives in `packages/core/src/theme.ts`. Token type enforcement (validating that a color token is not given a length value) is a v1.1 lint concern — at runtime, invalid CSS values silently fall back.

---

### 4.9 $ref split-file support

Large roadmaps can split subtrees into separate files. `$ref` paths are relative to the root file.

```json
{
  "id": "a1b2c3d4-...",
  "title": "Backend Systems",
  "$ref": "./subtrees/backend.json"
}
```

**Resolution rules:**
- `$ref` is resolved at load time; the merged in-memory tree is the working copy
- Each referenced file is watched independently by the file watcher
- Mutations to a node write back to the file that originally defined that node
- **Cross-boundary moves are blocked in MVP:** moving a node from one `$ref` subtree to another surfaces an error: *"Moving nodes between file references is not supported yet."* This is a v1.1 feature.

---

### 4.9 Schema version and migration

The `version` field is reserved for the migration system, planned for **v3.0**.

- v1.0 files opened in a v1.0 app: normal load
- v1.0 files opened in a future app that supports migration: the `migrator` module in `@core` runs automatically for additive changes (silent); surfaces a blocking dialog for breaking changes
- Before any migration runs, the app writes a backup: `filename.roadmap.bak.json`
- Migrations are versioned functions composable across versions (v1→v3 = v1→v2, then v2→v3)

**The `version` field and the parser hook point for the migrator are built into v1 even though the migrator itself ships in v3.0.**

---

## 5. Architecture

### 5.1 Process model

Electrobun enforces a strict two-process model. This is not optional — it is the framework's security boundary.

```
┌─────────────────────────────────────┐    Typed RPC    ┌───────────────────────────────────────┐
│         Bun main process            │◄───────────────►│         Webview process                │
│                                     │                 │                                        │
│  • File I/O (load, save, watch)     │                 │  • React application                   │
│  • JSON validation (Zod)            │                 │  • react-d3-tree renderer              │
│  • $ref resolution                  │                 │  • SidePanel + MarkdownEditor          │
│  • Pub/sub adapter hub              │                 │  • Toolbar, StatusBar, ContextMenu     │
│  • WebSocket / MQTT / webhook       │                 │  • Zustand store (in-memory schema)    │
│  • SQLite event log                 │                 │                                        │
│  • Native menus & file dialogs      │                 │                                        │
│  • Auto-updater                     │                 │                                        │
└─────────────────────────────────────┘                 └───────────────────────────────────────┘
```

The webview has **no direct file system access**. All persistence and network calls go through the Bun process via RPC.

---

### 5.2 RPC type contract (`shared/types.ts`)

This file is the single source of truth for the Bun↔webview interface. Both sides import from it. Breaking changes to this file require updating both sides before any code ships.

```typescript
export type RoadmapRPCType = {
  // Functions that execute in the Bun main process
  bun: RPCSchema<{
    requests: {
      loadFile:        { params: { path: string };          response: RoadmapSchema }
      saveFile:        { params: { schema: RoadmapSchema }; response: void }
      openFilePicker:  { params: {};                        response: string | null }
      resolveRef:      { params: { refPath: string };       response: RoadmapNode[] }
    }
    messages: {
      nodeStatusUpdate: { nodeId: string; status: string; meta?: Record<string, unknown> }
      integrationEvent: { source: string; event: IntegrationEvent }
      fileChanged:      { path: string }
    }
  }>

  // Functions that execute in the webview
  webview: RPCSchema<{
    messages: {
      pushStatusUpdate: { nodeId: string; status: string; meta?: Record<string, unknown> }
      pushEventLog:     { event: IntegrationEvent }
      pushFileChanged:  { path: string }
    }
  }>
}
```

---

### 5.3 Zustand store shape

No undo/redo history in MVP. The store is the in-memory working copy of the schema. The JSON file on disk is the durability mechanism.

```typescript
interface RoadmapStore {
  // State
  schema:      RoadmapSchema | null  // full in-memory schema; null = no file loaded
  selectedId:  string | null         // currently selected node UUID
  panelOpen:   boolean               // side panel visibility
  layout:      'TB' | 'LR'          // tree layout direction
  saveStatus:  'saved' | 'saving' | 'error'

  // Actions
  loadSchema:    (s: RoadmapSchema) => void
  updateNode:    (id: string, patch: Partial<RoadmapNode>) => void
  addNode:       (parentId: string | null, position: InsertPosition) => void
  deleteNode:    (id: string) => void
  duplicateNode: (id: string) => void
  moveNode:      (id: string, direction: 'up' | 'down') => void  // sibling reorder only in MVP
  setLayout:     (layout: 'TB' | 'LR') => void
  selectNode:    (id: string | null) => void
  setSaveStatus: (status: 'saved' | 'saving' | 'error') => void
}
```

---

### 5.4 Save behavior

| Trigger | Behavior |
|---|---|
| Any node mutation | Debounced write to disk: 2 s after last mutation |
| Periodic autosave | Every 30 s if schema is dirty |
| App close / window blur | Immediate flush of any pending write |
| File write error | `saveStatus` → `'error'`; non-blocking toast with "Save to new location" option |

A small save indicator in the status bar shows `Saved ✓` / `Saving…` / `Error saving — click to retry`. No explicit Save button. No "unsaved changes" confirmation on close.

**Implementation note:** The flush on app close must be registered via `Electrobun.events.on("before-quit", async (e) => { ... })`, not `process.on("beforeExit")`. The `before-quit` event fires for Cmd+Q, dock quit, SIGTERM, and updater restarts. It supports async handlers, allowing in-flight saves to complete before the process exits.

---

### 5.5 Integration adapter layer (Bun)

Each adapter normalises inbound events into a standard `IntegrationEvent` envelope, then routes to the correct node via the `statusMap` defined in the node's `subscribe` block.

```typescript
interface IntegrationEvent {
  nodeId:    string              // resolved by channel→node lookup
  status:    string              // raw status string from the external tool
  mappedTo:  string              // statusConfig id after statusMap lookup
  meta?:     Record<string, unknown>
  timestamp: string              // ISO 8601
  source:    'websocket' | 'webhook' | 'mqtt' | 'file'
}
```

| Adapter | Mechanism | Example integrations |
|---|---|---|
| **WebSocket** | Connects to `ws://` or `wss://`. Subscribes to named channels. Reconnects with exponential backoff. | Claude Code, custom pipelines, n8n |
| **Webhook** | HTTP server on configurable local port (default: 7342), bound to `127.0.0.1` only. Accepts `POST` with JSON body. | GitHub Actions, CI/CD runners, Airflow |
| **MQTT** | Connects to a broker (Mosquitto, NATS). Subscribes to topics. Supports wildcard topics. | IoT systems, NATS-based microservices |
| **File watcher** | Bun's native `fs.watch`. Monitors a JSON state file written by an external tool. Triggers on change. | Any tool that writes JSON to disk |

**Security:** All adapters bind to `127.0.0.1` by default. An optional `allowedOrigins` field in the `integrations` config block can whitelist remote hosts. No external ports are opened without explicit user configuration.

---

### 5.6 Tree renderer: react-d3-tree

**Chosen over React Flow for the following reasons:**

| Criterion | react-d3-tree | React Flow |
|---|---|---|
| Designed for strict trees | ✅ Purpose-built | ⚠️ General graph editor |
| Performance to ~1000 nodes | ✅ SVG, efficient | ⚠️ Degrades with many live re-renders |
| Built-in collapse/expand | ✅ | ❌ Manual |
| Custom node components | ✅ `renderCustomNodeElement` | ✅ Fully custom |
| Bundle size | Smaller | Larger |
| Complexity for this use case | Low | Higher |

**Inline rename caveat:** SVG does not support `<input>` elements. When a node enters rename mode, a floating HTML `<input>` is positioned over the node using `getBoundingClientRect()`. This is a known pattern for SVG-based tree editors.

**Validation requirement:** Before Phase 1 ships, a prototype with 300+ nodes and simulated live status updates (10 updates/second) must be benchmarked. If frame rate drops below 30 fps on a mid-range machine, the rendering approach must be revisited before proceeding.

---

### 5.7 Monorepo package structure

```
roadmap-viewer/
├── packages/
│   ├── core/                        # Framework-agnostic — published as @roadmap-viewer/core
│   │   ├── src/
│   │   │   ├── schema.ts            # Zod schema + TypeScript types
│   │   │   ├── parser.ts            # Load, validate, resolve $refs
│   │   │   ├── mutations.ts         # Pure tree mutation functions (tested independently)
│   │   │   └── adapters/
│   │   │       ├── websocket.ts
│   │   │       ├── webhook.ts
│   │   │       ├── mqtt.ts
│   │   │       └── fileWatcher.ts
│   │   └── tests/
│   │       ├── schema.test.ts
│   │       ├── parser.test.ts
│   │       ├── mutations.test.ts
│   │       └── adapters/
│   │
│   ├── react/                       # React components — published as @roadmap-viewer/react
│   │   ├── src/
│   │   │   ├── RoadmapTree.tsx      # Main tree component (react-d3-tree wrapper)
│   │   │   ├── RoadmapNode.tsx      # Custom node component
│   │   │   ├── SidePanel.tsx        # Notion-style side panel
│   │   │   ├── MarkdownEditor.tsx   # CodeMirror 6 markdown editor
│   │   │   ├── ContextMenu.tsx      # Right-click menu
│   │   │   ├── Toolbar.tsx
│   │   │   └── StatusBar.tsx
│   │   └── tests/
│   │       └── *.test.tsx           # React Testing Library
│   │
│   └── desktop/                     # Electrobun app — not published to npm
│       ├── src/
│       │   ├── bun/
│       │   │   ├── index.ts         # App bootstrap + BrowserWindow setup
│       │   │   ├── rpc.ts           # RPC handler definitions
│       │   │   ├── integrations/    # Adapter orchestration + event routing
│       │   │   └── db.ts            # SQLite event log
│       │   ├── webview/
│       │   │   ├── index.tsx        # React entry point
│       │   │   ├── store.ts         # Zustand store
│       │   │   └── rpc.ts           # Webview RPC client
│       │   └── shared/
│       │       └── types.ts         # RPC type contract (imports from @core types)
│       ├── electrobun.config.ts
│       └── tests/
│           └── e2e/                 # Playwright E2E tests
│
├── examples/
│   ├── hello-world.json             # 5 nodes, minimal valid schema
│   ├── getting-started.json         # 15 nodes, 3 statuses, one $ref, notes
│   └── roadmap-viewer-itself.json   # PLACEHOLDER — completed when spec is finalised
│
└── .github/
    └── workflows/
        ├── ci.yml                   # Lint + unit tests on every PR
        └── e2e.yml                  # Playwright E2E on merge to main
```

---

## 6. Event Flow Sequences

These sequences define the exact behavior at the Bun↔webview boundary. Implementers must not deviate from these without updating this document.

### 6.1 File load

```
User                    Webview                    Bun process
 │                         │                           │
 │── opens file ──────────►│                           │
 │                         │── rpc.loadFile(path) ────►│
 │                         │                           │── read file from disk
 │                         │                           │── parse JSON
 │                         │                           │── run Zod validation
 │                         │                           │── resolve all $refs
 │                         │                           │── register file watchers
 │                         │                           │── establish subscriptions
 │                         │◄── RoadmapSchema ─────────│
 │                         │── store.loadSchema() ─────│
 │                         │── render tree ────────────│
 │◄── tree visible ────────│                           │
```

**Error paths:**
- File unreadable → Bun throws; webview shows fatal error screen
- JSON parse failure → Bun throws; webview shows fatal error screen  
- Zod validation failure → Bun returns `{ error: ValidationError[] }`; webview shows inline error panel with all errors listed; tree does not render

---

### 6.2 Live status update

```
External tool           Bun process                Webview
 │                         │                           │
 │── publishes event ─────►│ (WebSocket/webhook/MQTT)  │
 │                         │── look up nodeId          │
 │                         │   by channel              │
 │                         │── apply statusMap         │
 │                         │── log to SQLite           │
 │                         │── rpc.pushStatusUpdate ──►│
 │                         │                           │── store.updateNode(id, { status })
 │                         │                           │── re-render node badge
 │                         │                           │── update live indicator
```

**Error paths:**
- Channel not mapped to any node → event logged; silently discarded
- Mapped status not in `statusConfig` → event logged with warning; node status unchanged; toast shown
- Connection drops → adapter attempts reconnect with exponential backoff (1 s, 2 s, 4 s, 8 s, max 60 s); integration status bar shows `Reconnecting…`

---

### 6.3 Manual node edit and save

```
User                    Webview                    Bun process           Disk
 │                         │                           │                   │
 │── edits node title ────►│                           │                   │
 │                         │── store.updateNode() ─────│                   │
 │                         │── setSaveStatus('saving') │                   │
 │                         │                           │                   │
 │                    [2 s debounce]                   │                   │
 │                         │                           │                   │
 │                         │── rpc.saveFile(schema) ──►│                   │
 │                         │                           │── write JSON ─────►│
 │                         │◄── void ──────────────────│                   │
 │                         │── setSaveStatus('saved')  │                   │
```

**Error paths:**
- Write fails (permissions, disk full) → `setSaveStatus('error')`; toast with "Save to new location" option

---

## 7. Error Taxonomy

All errors are classified by severity. Implementers must handle each class as specified. No case-by-case judgment calls.

| Severity | Description | User-visible behavior |
|---|---|---|
| **Fatal** | App cannot render the tree at all | Full-screen error state replaces tree. Message + error detail. File picker to open a different file. |
| **Blocking** | Schema loaded but invalid; editing would corrupt data | Tree renders with offending nodes highlighted in red. Error panel lists all violations. Save is disabled until resolved. |
| **Warning** | Degraded functionality; app still usable | Node or integration shows a warning indicator (⚠️). Non-blocking toast. App continues normally. |
| **Info** | Informational state change | Status bar update only. No interruption. |

### Error classification

| Error | Severity | Notes |
|---|---|---|
| File unreadable / not found | Fatal | |
| JSON syntax error | Fatal | |
| Schema `version` newer than app supports | Blocking | Prompt to check for app update |
| Node `status` not in `statusConfig` | Blocking | Highlights offending node(s) |
| Duplicate node `id` | Blocking | Both nodes highlighted |
| `$ref` file not found | Warning | Node renders with ⚠️ indicator; children not shown |
| `$ref` file has validation errors | Warning | Warning indicator; loads what it can |
| WebSocket connection failure | Warning | Integration status bar: `Disconnected`. Retry toast. |
| Webhook port already in use | Warning | Webhook adapter disabled. Toast: "Port 7342 is in use. Change in Settings." |
| MQTT broker unreachable | Warning | Same as WebSocket. |
| Mapped status not in `statusConfig` | Warning | Event discarded; logged. |
| File changed externally while editing | Info | Status bar: "File updated externally — reloaded." In-memory changes are preserved over the external change (last-write-wins from the app's perspective). |
| Disk full / write permission error | Warning (on save) | `saveStatus` → error; toast with escape hatch. |
| Cross-boundary move attempted | Warning | Inline error: "Moving nodes between file references is not supported yet." |

---

## 8. UI Design Principles

### 8.1 Context menu — full item specification

| Item | Enabled when | Action |
|---|---|---|
| Add child | Always | Adds child node; new node enters rename mode |
| Add sibling above | Node is not root | Inserts sibling above selected |
| Add sibling below | Node is not root | Inserts sibling below selected |
| Rename | Always | Activates inline rename mode |
| Change status ► | Always | Sub-menu: lists all `statusConfig` entries |
| Duplicate | Always | Copies node + entire subtree; paste appears as sibling below |
| Move up | Node has a sibling above | Swaps position with sibling above |
| Move down | Node has a sibling below | Swaps position with sibling below |
| Delete | Always | Confirmation if node has children |

---

### 8.2 Keyboard shortcut specification

All editing shortcuts. No undo/redo in MVP.

| Key | Action | Notes |
|---|---|---|
| `Enter` | Add sibling below | New node enters rename mode immediately |
| `Shift+Enter` | Add sibling above | |
| `Tab` | Indent (make child of node above) | Disabled if no node directly above at same level |
| `Shift+Tab` | Outdent (promote to parent's sibling) | |
| `F2` | Rename selected node | Same as double-click |
| `Escape` | Context-sensitive cancel | Cascade: cancel rename → close panel → deselect |
| `Delete` | Delete node | Confirmation if node has children |
| `Ctrl+D` | Duplicate node + subtree | Sibling appears below |
| `Ctrl+F` | Open search | Fuzzy search over node titles |
| `Space` | Collapse / expand selected node | Toggles subtree visibility |
| `↑` / `↓` | Navigate siblings | |
| `←` | Collapse node or move to parent | |
| `→` | Expand node or move to first child | |
| `Ctrl+Click` | Multi-select | Enables bulk status change and bulk delete |
| `Ctrl+Enter` | Open side panel | Equivalent to single click when panel is closed |

---

### 8.3 Node visual anatomy

| Element | Specification |
|---|---|
| Left border | 4 px solid; colour = `statusConfig[status].color` |
| Type icon | 16 px; top-left corner |
| Title | 14 px semibold; truncated with ellipsis at max-width |
| Status badge | Pill; 11 px text; `statusConfig[status].label`; background = status color at 20% opacity; **text label always present** |
| Child count | Shown when collapsed: `▶ N` in muted text |
| Live indicator | Animated green pulse dot; shown when node has active subscription |
| Hover state | Subtle background tint; `+` button appears (quick add child) |
| Selected state | Elevated box-shadow; purple border ring |

---

### 8.4 Side panel zones

| Zone | Phase | Contents |
|---|---|---|
| **Header** | 1 (read-only), 2 (editable) | Editable title, status dropdown, type dropdown, created/updated timestamps, copy-ID button |
| **Metadata** | 1 (read-only), 2 (editable) | Collapsible key-value table; "Add field" button in Phase 2 |
| **Notes** | 1 (read-only), 2 (editable) | CodeMirror 6 markdown editor; toolbar: Bold, Italic, Code, Link, Heading, Checklist, Table; modes: Edit \| Preview \| Split |
| **Integration** | 3 | Shown when node has `subscribe` or `plugin`. Connection state, last event timestamp, expandable raw event log. Plugin may provide a custom component rendered here. |
| **Actions** | 3 | Plugin-contributed actions (e.g. "Send to Claude Code"), "Copy as Markdown", "Copy ID" |

**UX — placeholder for dedicated session**

> Side panel layout, empty states, onboarding, and detailed UX flows are defined in a separate design session. This section is intentionally left as a placeholder.

---

## 9. Accessibility Requirements

These are non-negotiable for Phase 4. They must be validated before the Phase 4 definition of done is met.

### Tree

- Tree container: `role="tree"`, `aria-label="Roadmap tree"`
- Each node: `role="treeitem"`, `aria-expanded` (if has children), `aria-level` (nesting depth), `aria-selected`
- Nodes must be reachable and operable via keyboard alone

### Context menu

- Container: `role="menu"`
- Items: `role="menuitem"`
- Navigation: Arrow keys (up/down), `Enter` to activate, `Escape` to close
- Focus returns to the triggering node on close

### Side panel

- Container: `role="complementary"`, `aria-label="Node details"`
- Focus is trapped within the panel while open (`Tab` cycles panel elements)
- Focus returns to triggering node on close
- All form elements have visible labels

### General

- Status badges must use text labels — never color alone
- All interactive elements must have visible focus indicators (not just browser default outlines)
- Color contrast ratio: minimum 4.5:1 for all text
- Animated elements (live indicator pulse) must respect `prefers-reduced-motion`

---

## 10. Performance & Scalability

### Rendering approach

- **Default:** Nodes beyond depth 3 render collapsed. Visible node count is bounded regardless of schema size.
- **$ref lazy loading:** Collapsed nodes with a `$ref` do not load or render their subtree until expanded. This is free performance for large split-file roadmaps.
- **Soft limit:** 500 nodes rendered simultaneously. Beyond this threshold, the app shows a warning in the status bar but does not refuse to load.
- **Hard limit (v1):** Schema files up to 5 MB (~50,000 nodes total). Larger files are out of scope.

### Benchmarking gate (Phase 1 exit criterion)

Before Phase 1 ships: prototype with 300+ visible nodes + 10 simulated status updates per second. Target: ≥ 30 fps on a mid-range machine (2020-era laptop). If not achieved, rendering strategy is revisited before Phase 2 begins.

### Degradation strategy

| Node count (visible) | Behavior |
|---|---|
| < 200 | No restrictions |
| 200–500 | Status bar warning: "Large roadmap — consider collapsing subtrees" |
| > 500 | Warning + auto-collapse deepest levels to bring visible count under 500 |

---

## 11. Testing Strategy

This is a **TDD project.** Tests are written before implementation for all non-trivial logic.

### Framework

| Layer | Framework | Scope |
|---|---|---|
| Unit | Vitest | `@core` — schema validation, tree mutations, adapter statusMap routing, $ref resolution |
| Component | React Testing Library + Vitest | `@react` — render, interaction, ARIA compliance per component |
| Integration | Vitest + mock RPC | RPC contract, adapter reconnection logic, file watcher behavior |
| E2E | Playwright | Full keyboard editing flows, side panel, Claude Code integration happy path |

### Coverage targets

| Package | Target |
|---|---|
| `@core` | 90% — pure functions, highest ROI |
| `@react` | 70% — component tests |
| `@desktop` (E2E) | All critical paths in §6 event flows; all keyboard shortcuts in §8.2 |

### TDD workflow

1. Write failing test describing the behavior
2. Write minimal implementation to make it pass
3. Refactor
4. Commit test + implementation together — PRs without tests for new behavior are not merged

### CI pipeline

- **Every PR:** lint + unit tests + component tests (Vitest)
- **Merge to main:** full E2E suite (Playwright, all three platforms via GitHub Actions matrix)
- **Release:** E2E + installer build validation

### Test fixtures

The sample schemas in `examples/` serve double duty as test fixtures. The Zod validator tests run against all example files as part of the unit test suite. This ensures examples never go stale.

---

## 12. Sample Schemas

### 12.1 hello-world.json

A minimal valid schema. 5 nodes, 2 statuses, no integrations. Used in unit tests and as the new-user starting point.

```json
{
  "version": "1.0",
  "title": "Hello World",
  "description": "A minimal example roadmap.",
  "statusConfig": [
    { "id": "todo", "label": "To Do", "color": "#D3D1C7", "isDefault": true },
    { "id": "done", "label": "Done",  "color": "#5DCAA5" }
  ],
  "nodes": [
    {
      "id": "11111111-0000-0000-0000-000000000001",
      "title": "Getting started",
      "status": "done",
      "notes": "Welcome to Roadmap Viewer.",
      "children": [
        {
          "id": "11111111-0000-0000-0000-000000000002",
          "title": "Open a JSON file",
          "status": "done"
        },
        {
          "id": "11111111-0000-0000-0000-000000000003",
          "title": "Click a node to open the side panel",
          "status": "done"
        }
      ]
    },
    {
      "id": "11111111-0000-0000-0000-000000000004",
      "title": "Next steps",
      "status": "todo",
      "children": [
        {
          "id": "11111111-0000-0000-0000-000000000005",
          "title": "Create your own roadmap",
          "status": "todo",
          "notes": "Copy this file and edit it, or use File > New."
        }
      ]
    }
  ]
}
```

---

### 12.2 getting-started.json

A realistic example. 15 nodes, 4 statuses, metadata fields, markdown notes on several nodes, one `$ref` to demonstrate split-file loading.

```json
{
  "version": "1.0",
  "title": "Frontend Developer Roadmap",
  "description": "A learning path for modern frontend development.",
  "statusConfig": [
    { "id": "todo",        "label": "To Do",      "color": "#D3D1C7", "isDefault": true },
    { "id": "in-progress", "label": "In Progress", "color": "#FAC775" },
    { "id": "done",        "label": "Done",        "color": "#5DCAA5" },
    { "id": "skip",        "label": "Skip",        "color": "#B4B2A9" }
  ],
  "typeConfig": [
    { "id": "topic",     "label": "Topic",     "icon": "book" },
    { "id": "milestone", "label": "Milestone", "icon": "flag" }
  ],
  "nodes": [
    {
      "id": "22222222-0000-0000-0000-000000000001",
      "title": "Foundations",
      "status": "done",
      "type": "milestone",
      "notes": "## Foundations\n\nCore web technologies every frontend developer must know before moving on.",
      "children": [
        {
          "id": "22222222-0000-0000-0000-000000000002",
          "title": "HTML",
          "status": "done",
          "type": "topic",
          "meta": { "resources": "MDN, htmlreference.io", "priority": "high" },
          "children": [
            {
              "id": "22222222-0000-0000-0000-000000000003",
              "title": "Semantic elements",
              "status": "done"
            },
            {
              "id": "22222222-0000-0000-0000-000000000004",
              "title": "Forms and validation",
              "status": "done"
            },
            {
              "id": "22222222-0000-0000-0000-000000000005",
              "title": "Accessibility basics",
              "status": "in-progress",
              "notes": "- [ ] ARIA roles\n- [ ] Keyboard navigation\n- [x] Alt text for images"
            }
          ]
        },
        {
          "id": "22222222-0000-0000-0000-000000000006",
          "title": "CSS",
          "status": "in-progress",
          "type": "topic",
          "children": [
            {
              "id": "22222222-0000-0000-0000-000000000007",
              "title": "Flexbox",
              "status": "done"
            },
            {
              "id": "22222222-0000-0000-0000-000000000008",
              "title": "Grid",
              "status": "in-progress"
            },
            {
              "id": "22222222-0000-0000-0000-000000000009",
              "title": "CSS custom properties",
              "status": "todo"
            }
          ]
        }
      ]
    },
    {
      "id": "22222222-0000-0000-0000-000000000010",
      "title": "JavaScript",
      "status": "in-progress",
      "type": "milestone",
      "children": [
        {
          "id": "22222222-0000-0000-0000-000000000011",
          "title": "ES2020+ features",
          "status": "in-progress"
        },
        {
          "id": "22222222-0000-0000-0000-000000000012",
          "title": "Async / Promises / fetch",
          "status": "todo"
        }
      ]
    },
    {
      "id": "22222222-0000-0000-0000-000000000013",
      "title": "Frameworks",
      "status": "todo",
      "type": "milestone",
      "$ref": "./subtrees/frameworks.json"
    }
  ]
}
```

---

### 12.3 roadmap-viewer-itself.json — PLACEHOLDER

```json
{
  "version": "1.0",
  "title": "Roadmap Viewer — Product Roadmap",
  "description": "PLACEHOLDER: This file will be completed once the requirements specification is finalised.",
  "statusConfig": [
    { "id": "todo",        "label": "To Do",      "color": "#D3D1C7", "isDefault": true },
    { "id": "in-progress", "label": "In Progress", "color": "#FAC775" },
    { "id": "done",        "label": "Done",        "color": "#5DCAA5" },
    { "id": "blocked",     "label": "Blocked",     "color": "#F09595" }
  ],
  "nodes": [
    { "id": "00000000-0000-0000-0000-000000000001", "title": "Phase 0 — Foundation",    "status": "todo", "children": [] },
    { "id": "00000000-0000-0000-0000-000000000002", "title": "Phase 1 — Viewer",        "status": "todo", "children": [] },
    { "id": "00000000-0000-0000-0000-000000000003", "title": "Phase 2 — Editor",        "status": "todo", "children": [] },
    { "id": "00000000-0000-0000-0000-000000000004", "title": "Phase 3 — Integrations", "status": "todo", "children": [] },
    { "id": "00000000-0000-0000-0000-000000000005", "title": "Phase 4 — Packaging",    "status": "todo", "children": [] }
  ]
}
```

---

## 13. Dependencies

### Runtime

| Package | Role | Notes |
|---|---|---|
| `electrobun` | Desktop framework | v1.x — Bun runtime, native WebView, typed RPC |
| `react` / `react-dom` | UI framework | v18+ |
| `react-d3-tree` | Tree renderer | SVG-based, purpose-built for hierarchical trees |
| `zustand` | State management | Lightweight, no boilerplate |
| `@codemirror/lang-markdown` | Markdown editor | v6, CodeMirror 6 core |
| `remark` / `rehype` | Markdown → HTML | Preview mode rendering |
| `zod` | Schema validation | Runtime validation of user JSON |
| `mqtt` | MQTT client | Used by the MQTT transport adapter; bundled with the `@roadmap-viewer/core` adapters |
| `fuse.js` | Fuzzy search | Node title search |
| `uuid` | UUID generation | v4 node ID generation |

### Development

| Package | Role |
|---|---|
| `vitest` | Unit + integration tests |
| `@testing-library/react` | Component tests |
| `playwright` | E2E tests |
| `typescript` | Type checking |
| `eslint` | Linting |

### Explicitly not used

| Package | Reason |
|---|---|
| `immer` | No undo/redo history in MVP |
| `react-flow` | react-d3-tree is more appropriate for strict trees |
| `dagre` | Not needed without React Flow |

---

## 14. Known Constraints & Future Concerns

### Webhook port conflict

If the configured webhook port (default: 7342) is already in use, the webhook adapter fails to start and is marked as disabled in the integration status bar. A toast informs the user with a link to Settings to change the port. Auto-incrementing the port is not implemented — this avoids silently binding to an unexpected port.

### $ref cross-boundary moves

Moving a node from one `$ref` subtree to another is blocked in MVP (Phase 2). The correct behavior — write to destination file, remove from source file atomically — will be implemented in v1.1.

### Multi-window

Only one window is supported in MVP. If the user attempts to open a second window (OS-level), the behavior is undefined and should be prevented. Multi-window is a v1.1 feature.

### Schema migration

The `version` field and parser hook point are built into v1. The migration UI and `migrator` module are v3.0 features. When opened, a file whose `version` is newer than the app supports shows a blocking dialog recommending an app update.

### Undo / redo

Not in MVP. The JSON file on disk (autosaved every 2 s) is the recovery mechanism. Users who need version history should track their schema files in Git. Full undo/redo is a v2.0 feature.

### Drag and drop

Not in MVP. Sibling reordering via "Move up" / "Move down" in the context menu is the MVP mechanism. Drag-and-drop reordering is v1.1.

### Performance beyond 500 visible nodes

The app warns but does not fail. Behavior beyond this threshold is not optimised in v1. Virtualization and on-demand subtree loading beyond $ref lazy loading are v2.0 concerns.

---

## 15. Open Questions Log

Decisions logged here when raised; marked resolved when answer is incorporated into the spec.

| # | Question | Status | Decision |
|---|---|---|---|
| 1 | Node ID format: UUIDs vs slugs? | ✅ Resolved | UUIDs. Stable, collision-free, generated by app. Optional `label` field for display. |
| 2 | Webhook port conflict behavior? | ✅ Resolved | Adapter disables with warning toast. No auto-increment. Configurable in Settings. |
| 3 | Live events undoable? | ✅ Resolved | No undo/redo in MVP. Question is moot. |
| 4 | Side panel autosave vs explicit save? | ✅ Resolved | Autosave: debounced 1 s on edit. No Save button. No close confirmation. |
| 5 | Side panel pin mode threshold? | ✅ Resolved | User preference, default off. Auto-pin available on screens > 1400 px. |
| 6 | Markdown storage: raw string vs AST? | ✅ Resolved | Raw markdown string in `notes` field. Simpler, portable, human-readable. |
| 7 | $ref write-back on cross-boundary move? | ✅ Resolved | Blocked in MVP. Surfaces error. v1.1 feature. |
| 8 | react-d3-tree vs React Flow? | ✅ Resolved | react-d3-tree. Benchmarking gate at Phase 1 exit. |
| 9 | Undo/redo scope for live events? | ✅ Resolved | Undo/redo removed from MVP entirely. |
| 10 | Drag and drop in MVP? | ✅ Resolved | Removed from MVP. v1.1 feature. |
| 11 | Multi-window support? | ✅ Resolved | Out of scope for MVP. One window only. |
| 12 | Integration model: hardcoded adapters vs plugin system? | ✅ Resolved | Plugin system. Each integration is a plugin implementing `RoadmapPlugin`. Claude Code ships as the reference implementation. `claudeCode` node field replaced by generic `plugin: { id, config }`. |
| 13 | Theming: CSS-in-JS vs CSS custom properties vs JSON tokens? | ✅ Resolved | CSS custom properties (`--rv-*`). Built-in base themes: `dark` (default), `light`, `high-contrast`. App is dark-first; default matches `variant-c-merged.html` design. Schema-scoped `themeConfig` overrides app preference for that file. |
| 14 | Should third-party plugins be loadable at runtime? | ✅ Resolved | MVP uses static compile-time imports — all plugins bundled into the app. The `RoadmapPlugin` interface is designed to be loadable either way. Dynamic runtime loading from a local `plugins/` directory is v1.1. Sandboxing model is deferred to v1.1 research. |
| 15 | Should `themeConfig.tokens` accept full CSS values or only predefined scales? | ✅ Resolved | Free-form CSS strings for MVP. Zod validates only that keys start with `--rv-` and values are non-empty strings. Invalid CSS values are silently ignored by the browser and fall back to the base theme token. Token-type enforcement (e.g. validating a color token isn't given a length) is a v1.1 lint rule, not a runtime validator. |
