---
title: Architecture Overview
nav_order: 2
layout: default
---

# Architecture Overview

## What is RoadRaven?

RoadRaven is a desktop application for creating, editing, and live-monitoring visual roadmap trees. Nodes in the tree map to tasks or agents, and status updates arrive in real time via WebSocket (Claude Code integration). It uses a plain JSON data model, supports keyboard-first editing, and renders markdown in side panels.

## Why Electrobun (not Electron)

RoadRaven uses [Electrobun](https://blackboard.sh/electrobun/), not Electron. Electrobun runs on Bun (native TypeScript, fast startup) and renders through the system's native webview instead of bundling Chromium, which keeps app bundles small. Its strict two-process model with typed RPC enforces a security boundary by design.

| Aspect | Electrobun | Electron |
|--------|-----------|----------|
| Runtime | Bun (fast, native TypeScript) | Node.js |
| WebView | System webview (WKWebView/WebView2) | Bundled Chromium |
| Bundle size | Small (no browser engine shipped) | Large (~150 MB+) |
| API style | `electrobun/bun` and `electrobun/view` | `electron` unified |

The main process runs on Bun; the renderer runs in the system's native webview. The two communicate exclusively through typed RPC — there is no shared memory or direct module access between them.

## Process Model

```
+-------------------------------------+    Typed RPC    +--------------------------------------+
|         Bun main process            |<--------------->|         Webview process               |
|                                     |                 |                                      |
|  - File I/O (load, watch, save)     |                 |  - React 19 application              |
|  - Zod schema validation            |                 |  - react-d3-tree canvas renderer     |
|  - $ref resolution                  |                 |  - Zustand stores (roadmap, theme)   |
|  - .bak.json backup on load         |                 |  - Theme engine (CSS custom props)   |
|  - File watching (debounced)        |                 |  - SidePanel + MarkdownRenderer      |
|  - Settings + recent-file tracking  |                 |  - WelcomeScreen + recent files      |
|  - Log file writing                 |                 |  - SchemaErrorPanel                  |
|  - Native file dialogs              |                 |  - Log forwarding via RPC            |
+-------------------------------------+                 +--------------------------------------+
```

The webview has no direct file system access. All persistence goes through the Bun process via RPC. This is a framework-enforced security boundary, not a design choice.

State lives in [Zustand](https://github.com/pmndrs/zustand) stores: minimal boilerplate, no Provider wrapper, and usable outside React (e.g. in RPC handlers).

## Package Structure

RoadRaven is a monorepo. `packages/` contains the application code and `shared/` holds the RPC type contract used by both processes.

```
RoadRaven/
+-- shared/
|   +-- types.ts              # RPC type contract + Zod-inferred type re-exports
|
+-- packages/
|   +-- core/                 # Framework-agnostic logic (@roadraven/core)
|   |   +-- src/schema.ts     # Zod schemas + inferred TypeScript types
|   |
|   +-- desktop/              # Electrobun desktop app (@roadraven/desktop)
|       +-- src/
|       |   +-- bun/          # Bun main process
|       |   |   +-- index.ts        # App bootstrap, BrowserWindow, RPC handlers
|       |   |   +-- fileWatcher.ts  # Debounced file watching
|       |   |   +-- saveFile.ts     # Splits subtrees by refMap, atomic writes per file
|       |   |   +-- atomicWrite.ts  # Temp + rename with Windows retry loop
|       |   |   +-- logging.ts / settings.ts / refMap.ts
|       |   |
|       |   +-- mainview/     # Webview (React application)
|       |       +-- App.tsx          # App shell layout (grid)
|       |       +-- index.css        # Token system + theme definitions
|       |       +-- rpc.ts           # Electroview RPC client
|       |       +-- store/           # Zustand stores (roadmapStore, themeStore)
|       |       +-- components/      # Canvas, SidePanel, NotesEditor, TopBar, etc.
|       |       +-- hooks/           # useAutosave, useKeyboardRouter, useTheme, etc.
|       |
|       +-- tests/            # unit/ (node + jsdom) and bench/ (dataKey perf)
|       +-- vite.config.ts / vitest.config.ts / electrobun.config
|
+-- samples/                  # Sample roadmap JSON files
+-- docs/                     # This documentation
```

## Data Flow: Load and Persistence

The webview never touches the disk; the Bun process mediates every read and write over RPC.

```
LOAD
User opens a file (TopBar / recent file / sample)
       |
       v  rpc.openFilePicker -> native dialog -> rpc.loadFile({ path })
Bun loadFile handler:
  1. Read file, write .bak.json backup
  2. Parse JSON, validate with Zod (RoadmapSchemaSchema.safeParse)
  3. Resolve $ref nodes (recursive walk; watch ref files)
  4. Start file watcher on main file, track in recent files
  5. Return { data, errors? }
       |
       v
roadmapStore.loadSchema(data, path)
  - Converts nodes to react-d3-tree format, builds Map<id, node> index
  - Increments dataKey (forces a single re-layout)
       |
       v
Canvas renders <Tree data={treeData} dataKey={dataKey} />
       |
       v  (if errors present)
SchemaErrorPanel displays Zod validation errors inline


SAVE
User edits -> store updates in-memory state -> rpc.saveFile({ schema })
       |
       v
Bun saveFile handler writes JSON atomically -> response flows back
```

Validation catches malformed JSON early while still rendering partially valid data, and the `.bak.json` backup guards against corruption. The Zustand store is an in-memory cache, so the UI stays responsive while the slower disk write happens asynchronously — if a write fails, in-memory state is intact and no work is lost mid-session.

**File watching.** When the loaded file (or a `$ref`-referenced file) changes externally, `fs.watch` fires in the Bun process. After a debounce window the Bun process re-reads and validates the file and pushes the result to the webview, which calls `roadmapStore.reloadSchema(data)` — preserving the file path and incrementing `dataKey`.

## Editing & Autosave

The `SidePanel` opens in preview mode on node selection and can switch to an edit mode where the title, status, type, metadata (key/value table), and notes (a CodeMirror 6 editor with Edit / Preview / Split) become editable. Nodes can also be renamed inline on the canvas via a floating input overlay (`F2` or double-click), and newly created nodes auto-open rename so they can be titled immediately.

Saves are **debounced**, **atomic**, and **may target multiple files**. The autosave engine (`useAutosave`, mounted once in `App.tsx`) flushes after structural mutations (add / delete / move / rename), after in-place mutations (status / type / notes / metadata), on a periodic safety sweep, and on a manual save trigger. A flush calls `rpc.saveFile`, and the Bun handler consults `refMap` to split the in-memory schema back into one tree per source file, writing each atomically (temp file + rename, with retries on transient Windows errors).

Save status is surfaced in the StatusBar via the `SaveIndicator`. Failures escalate rather than failing silently: a single (usually transient) failure triggers a quiet auto-retry, a second shows a clickable retry indicator, and a third opens a `SaveFailureModal` offering Retry, Save As, and Dismiss. This avoids modal fatigue from one-off blips while guaranteeing persistent failures surface clearly.

## Theme Change Propagation

```
User selects a theme
       |
       v
useThemeStore.setTheme(...)
       |
       +---> rpc.saveSettings(...) -> Bun writes settings.json   (persist)
       |
       v
ThemeProvider sets document.documentElement[data-theme]          (apply)
       |
       v
CSS selectors activate: [data-theme="light"] { --rv-bg-base: #fff; ... }
       |
       v
All components using --rv-* tokens update instantly (no re-render)
```

Theme switching is handled by the browser's style engine, not React re-renders: swapping the `data-theme` attribute on `<html>` activates the matching CSS `[data-theme]` selectors, and every child inherits the new token values through CSS custom-property inheritance. The parallel RPC persistence path means the preference survives an app restart. Components reference tokens like `bg-rv-bg-base` via Tailwind utilities.

## Zustand Store Shape (roadmapStore)

`useRoadmapStore` is the in-memory working copy of the loaded schema. It uses the **dataKey pattern** for react-d3-tree performance: structural changes (load, reload) increment the `dataKey` string and trigger a full re-layout, while high-frequency status-only updates (e.g. from WebSocket integrations) mutate nodes in-place and notify subscribers without changing the tree reference. This prevents react-d3-tree from deep-cloning the entire tree on every status update.

```typescript
interface RoadmapState {
  // Document data
  schema: RoadmapSchema | null;
  filePath: string | null;
  treeData: RawNodeDatum | null;       // react-d3-tree format
  dataKey: string;                      // Increment = full re-layout
  nodeIndex: Map<string, RoadmapNode>; // O(1) lookup by ID

  // UI + viewport state
  selectedNodeId: string | null;
  layoutOrientation: "TB" | "LR";
  translate: { x: number; y: number };
  zoomLevel: number;

  // Structural actions (increment dataKey)
  loadSchema: (schema: RoadmapSchema, filePath: string) => void;
  reloadSchema: (schema: RoadmapSchema) => void;

  // In-place actions (no dataKey change)
  updateNodeStatus: (nodeId: string, status: string) => void;
  setSelectedNode: (id: string | null) => void;
  // ...viewport, schema-error, and selection helpers
}
```

Source: [`packages/desktop/src/mainview/store/roadmapStore.ts`](../packages/desktop/src/mainview/store/roadmapStore.ts)

## Component Tree

The webview renders these components in a CSS Grid layout:

```
App (h-screen grid)
+-- TopBar          [grid-area: topbar]    -- Toolbar: Open, New, Search, Fit, Zoom, Layout, Theme
+-- Sidebar         [grid-area: sidebar]   -- Left icon rail
+-- Canvas          [grid-area: canvas]    -- react-d3-tree renderer or WelcomeScreen
|   +-- WelcomeScreen                      -- Shown when no file loaded (recent files, samples)
|   +-- Tree (react-d3-tree)               -- SVG tree with foreignObject custom nodes
|   |   +-- RoadmapNodeCard                -- Status badge, collapse/expand chevron
|   +-- SchemaErrorPanel                   -- Inline Zod validation error display
+-- SidePanel       [grid-area: panel]     -- Node detail panel (on node selection)
|   +-- ResizeHandle                       -- Drag to resize panel width
|   +-- MarkdownRenderer                   -- remark/rehype pipeline for node notes
+-- StatusBar       [grid-area: status]    -- File name, node count, connection status
```

- **ThemeProvider** wraps the app and manages the `data-theme` attribute on `<html>`.
- **ThemeOverrideProvider** wraps the canvas area for per-schema CSS overrides.
- The **SidePanel** opens when a node is selected; the **WelcomeScreen** renders inside the Canvas when no file is loaded.

## Key Imports

Electrobun has its own import paths, distinct from Electron. Both processes import the shared RPC types from `shared/types.ts`, so the compiler catches contract mismatches at build time.

```typescript
// Bun main process
import { BrowserWindow, BrowserView, Updater, Utils } from "electrobun/bun";

// Webview renderer
import { Electroview } from "electrobun/view";

// Bundled view URLs (not file paths)
const url = "views://mainview/index.html";
```

## Zod Schema Model

Roadmap JSON files are validated at load time using Zod v4 schemas in `packages/core/src/schema.ts`. The schemas use Zod's getter-based recursion for the `children` field:

```typescript
export const RoadmapNodeSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1),
  status: NodeStatusSchema,          // "not-started" | "in-progress" | "completed" | "blocked"
  type: z.string().optional(),
  notes: z.string().optional(),       // Markdown content
  metadata: z.record(z.string(), z.unknown()).optional(),
  $ref: z.string().optional(),        // Reference to external JSON file
  get children() {
    return z.array(RoadmapNodeSchema).optional();
  },
});

export const RoadmapSchemaSchema = z.object({
  version: z.string(),
  title: z.string(),
  themeConfig: z.object({ ... }).optional(),
  statusConfig: z.array(StatusConfigSchema).optional(),
  typeConfig: z.array(TypeConfigSchema).optional(),
  nodes: z.array(RoadmapNodeSchema),
});
```

TypeScript types are inferred from the schemas (`z.infer<typeof ...>`) and re-exported through `shared/types.ts`, keeping the JSON format, validation, and types always in sync. On validation failure, the `loadFile` handler returns both the raw parsed data (for partial rendering) and the error array (for display in SchemaErrorPanel), so a file with minor violations can still be viewed.

Source: [`packages/core/src/schema.ts`](../packages/core/src/schema.ts)

## Related Documentation

- [Design System](./design-system.md) — token system, theming, how to add tokens
- [RPC and IPC](./rpc-and-ipc.md) — typed RPC contract, data flows
- [Logging](./logging.md) — two-process logging architecture
- [Development Guide](./development-guide.md) — commands, workflow, how to add features
