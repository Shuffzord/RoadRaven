# Architecture Overview

> Last updated: 2026-04-15 | Phase: 02-read-only-viewer

## What is RoadRaven?

RoadRaven is a desktop application for creating, editing, and live-monitoring visual roadmap trees. Nodes in the tree map to tasks or agents, and status updates arrive in real time via WebSocket (Claude Code integration). It uses a plain JSON data model, supports keyboard-first editing, and renders markdown in side panels.

## Why Electrobun (not Electron)

> **Why:** Electrobun uses the system's native webview instead of bundling Chromium, which means tiny app bundles (no 150 MB+ browser engine shipped). It runs on Bun (native TypeScript, fast startup), and its strict two-process model with typed RPC enforces security boundaries by design. Electron was rejected because the bundle size, Node.js runtime overhead, and Chromium maintenance burden are unnecessary when a system webview suffices. *(Decision context: PROJECT.md -- Electrobun is the designated framework.)*

RoadRaven uses [Electrobun](https://blackboard.sh/electrobun/), not Electron. The differences matter:

| Aspect | Electrobun | Electron |
|--------|-----------|----------|
| Runtime | Bun (fast, native TypeScript) | Node.js |
| WebView | System webview (WKWebView/WebView2) | Bundled Chromium |
| Bundle size | Small (no browser engine shipped) | Large (~150 MB+) |
| API style | `electrobun/bun` and `electrobun/view` | `electron` unified |

Electrobun enforces a strict two-process model. The main process runs on Bun. The renderer runs in the system's native webview. These two processes communicate exclusively through typed RPC -- there is no shared memory or direct module access between them.

## Process Model

```
+-------------------------------------+    Typed RPC    +--------------------------------------+
|         Bun main process            |<--------------->|         Webview process               |
|                                     |                 |                                      |
|  - File I/O (load, watch)           |                 |  - React 19 application              |
|  - Zod schema validation            |                 |  - react-d3-tree canvas renderer     |
|  - $ref resolution                  |                 |  - Zustand stores (roadmap, theme)   |
|  - .bak.json backup on load         |                 |  - Theme engine (CSS custom props)   |
|  - File watching (500ms debounce)   |                 |  - SidePanel + MarkdownRenderer      |
|  - Settings persistence             |                 |  - WelcomeScreen + recent files      |
|  - Recent file tracking             |                 |  - SchemaErrorPanel                  |
|  - Log file writing                 |                 |  - Log forwarding via RPC            |
|  - Plugin host (future)             |                 |                                      |
|  - Native file dialogs              |                 |                                      |
+-------------------------------------+                 +--------------------------------------+
```

<!-- Structured flow (machine-readable) -->
<!-- COMPONENTS: BunProcess [File I/O, Zod validation, $ref resolution, .bak.json backup, File watching, Settings, Recent files, Log writing, Native file dialogs] -->
<!-- COMPONENTS: WebviewProcess [React 19, react-d3-tree, Zustand stores (roadmap+theme), Theme engine, SidePanel, MarkdownRenderer, WelcomeScreen, SchemaErrorPanel, Log forwarding] -->
<!-- LINK: BunProcess <-> TypedRPC <-> WebviewProcess -->

The webview has no direct file system access. All persistence goes through the Bun process via RPC. This is a framework-enforced security boundary, not a design choice.

> **Why Zustand over Redux/Context:** Zustand requires minimal boilerplate, needs no Provider wrapper in the component tree, works outside React (e.g., in RPC handlers), and has a tiny bundle. Redux adds ceremony that is not justified for this app's state complexity. React Context works but does not provide devtools or persistence hooks that later phases need. Zustand was already installed in the project. *(See 01-RESEARCH.md -- Alternatives Considered.)*

## Package Structure

RoadRaven is a monorepo. The `packages/` directory contains the main application code, and `shared/` holds the RPC type contract used by both processes.

```
RoadRaven/
+-- shared/
|   +-- types.ts              # RPC type contract + Zod-inferred type re-exports
|
+-- packages/
|   +-- core/                 # Framework-agnostic logic (@roadraven/core)
|   |   +-- src/
|   |       +-- schema.ts     # Zod schemas + inferred TypeScript types
|   |       +-- plugin.ts     # IntegrationEvent type
|   |
|   +-- desktop/              # Electrobun desktop app (@roadraven/desktop)
|       +-- src/
|       |   +-- bun/          # Bun main process
|       |   |   +-- index.ts      # App bootstrap, BrowserWindow, RPC handlers
|       |   |   +-- fileWatcher.ts # File watching with 500ms debounce
|       |   |   +-- logging.ts    # LogTape setup, file sink, category loggers
|       |   |   +-- settings.ts   # Settings read/write + addRecentFile
|       |   |
|       |   +-- mainview/     # Webview (React application)
|       |       +-- main.tsx      # React entry point
|       |       +-- App.tsx       # App shell layout (grid)
|       |       +-- index.css     # Token system + theme definitions
|       |       +-- rpc.ts        # Electroview RPC client
|       |       +-- rpcHandlers.ts # ESM-safe inbound message handlers
|       |       +-- store/
|       |       |   +-- roadmapStore.ts  # Zustand store (schema, tree, viewport)
|       |       |   +-- themeStore.ts    # Zustand store (theme preference)
|       |       +-- components/
|       |       |   +-- Canvas.tsx           # react-d3-tree tree renderer
|       |       |   +-- RoadmapNode.tsx      # Custom node card (foreignObject)
|       |       |   +-- SidePanel.tsx        # Node detail panel with markdown
|       |       |   +-- MarkdownRenderer.tsx # remark/rehype markdown pipeline
|       |       |   +-- ResizeHandle.tsx     # Drag-to-resize panel handle
|       |       |   +-- WelcomeScreen.tsx    # Landing screen with recent files
|       |       |   +-- SchemaErrorPanel.tsx # Zod validation error display
|       |       |   +-- TopBar.tsx           # Toolbar (open, layout, theme, fit)
|       |       |   +-- StatusBar.tsx        # File name + node count
|       |       |   +-- Sidebar.tsx          # Left icon sidebar
|       |       |   +-- ConfigPanel.tsx      # Settings panel (stub)
|       |       |   +-- ThemeProvider.tsx     # Applies data-theme attribute
|       |       |   +-- ThemeOverrideProvider.tsx # Per-schema CSS overrides
|       |       +-- hooks/
|       |       |   +-- useTheme.ts          # Theme hook
|       |       +-- logging/
|       |           +-- logger.ts            # Webview LogTape + RPC forwarding
|       |
|       +-- tests/
|       |   +-- unit/             # Unit tests (node environment)
|       |   |   +-- ui/           # Component tests (jsdom environment)
|       |   +-- bench/            # Vitest benchmarks (dataKey performance)
|       |
|       +-- vite.config.ts    # Vite bundler config
|       +-- vitest.config.ts  # Test + benchmark config
|       +-- electrobun.config  # Electrobun app manifest
|
+-- samples/                  # Sample roadmap JSON files
|   +-- hello-world.json      # Minimal (4 nodes)
|   +-- getting-started.json  # Rich (15 nodes, 4 depth levels)
|
+-- docs/                     # This documentation
+-- .planning/                # Project planning artifacts
```

## Data Flow: File Loading (Primary Path)

This is the path a file open action takes from the UI through validation to the tree renderer:

```
User clicks "Open" in TopBar (or clicks a recent file / sample link)
       |
       v
TopBar/Canvas calls electroview.rpc.request.openFilePicker({})
       |
       v (RPC transport)
Bun opens native file dialog (Utils.openFileDialog)
       |
       v
User selects a .json file -> path returned to webview
       |
       v
electroview.rpc.request.loadFile({ path })
       |
       v (RPC transport)
Bun loadFile handler:
  1. Read file from disk (Bun.file().text())
  2. Write .bak.json backup
  3. Parse JSON
  4. Validate with Zod (RoadmapSchemaSchema.safeParse)
  5. Resolve $ref nodes (recursive tree walk, start watchers on ref files)
  6. Start file watcher on main file (500ms debounce)
  7. Track in recent files (addRecentFile, capped at 10)
  8. Return { data: RoadmapSchema | null, errors?: ZodIssue[] }
       |
       v (RPC response)
Webview receives { data, errors }
       |
       v
roadmapStore.loadSchema(data, path)
  - Converts nodes to react-d3-tree RawNodeDatum (toTreeDatum)
  - Builds flat Map<id, RoadmapNode> index (buildNodeIndex)
  - Increments dataKey (forces react-d3-tree re-render)
       |
       v
Canvas renders <Tree data={treeData} dataKey={dataKey} />
  - react-d3-tree renders SVG tree with foreignObject nodes
  - Each node renders a RoadmapNodeCard component
       |
       v (if errors present)
SchemaErrorPanel displays Zod validation errors inline
```

> **Why this flow matters:** The webview is sandboxed with no filesystem access -- this is an Electrobun security boundary, not a design choice. The Zod validation step ensures malformed JSON is caught early and reported to the user via the SchemaErrorPanel, while still attempting to render partially valid data. The `.bak.json` backup protects against data loss if the file is corrupted. The `dataKey` pattern is critical: it tells react-d3-tree to rebuild its internal layout only on structural changes, not on status-only updates.

## Data Flow: File Watching (External Changes)

When the loaded file (or a `$ref`-referenced file) is modified externally:

```
External editor saves file
       |
       v
fs.watch fires change event (Bun process)
       |
       v
500ms debounce timer starts (prevents rapid-fire reloads)
       |
       v (after debounce)
pushFileChanged RPC message sent to webview
       |
       v
rpcHandlers.ts receives message -> re-reads + validates file via loadFile RPC
       |
       v
roadmapStore.reloadSchema(data) -- preserves filePath, increments dataKey
```

## Data Flow: User Action to Persistence

This is the path a user action takes from the UI to disk and back:

```
User clicks "Save"
       |
       v
React component calls store action
       |
       v
Zustand store updates in-memory state
       |
       v
Store action calls electroview.rpc.request.saveFile(...)
       |
       v
Electrobun serializes request, sends to Bun process
       |
       v
Bun RPC handler receives typed request
       |
       v
Bun writes JSON to file system
       |
       v
Response flows back: Bun -> RPC -> webview -> store -> React re-render
```

<!-- Structured flow (machine-readable) -->
<!-- FLOW: User -> action -> ReactComponent -> storeAction -> ZustandStore -> rpc.saveFile -> Electrobun -> BunRPCHandler -> FileSystem -->
<!-- RETURNS: FileSystem -> BunRPCHandler -> Electrobun -> ZustandStore -> ReactComponent -> re-render -->

> **Why this flow matters:** The webview is sandboxed with no filesystem access -- this is an Electrobun security boundary, not a design choice. Without RPC-mediated persistence, user data could only live in memory and would be lost on app close. The Zustand store provides an in-memory cache so the UI stays responsive while the slower disk write happens asynchronously through the Bun process. If the RPC call fails, the in-memory state is still intact, and the user does not lose their work mid-session.

## Event Flow: Theme Change Propagation

When a user switches themes, the change flows through several layers:

```
User selects "Light" theme
       |
       v
useThemeStore.setTheme("light")
       |
       v
Zustand store updates: { preference: "light", resolvedTheme: "light" }
       |
       +---> electroview.rpc.request.saveSettings({ theme: "light" })
       |            |
       |            v
       |     Bun writes to settings.json
       |
       v
ThemeProvider reacts to resolvedTheme change
       |
       v
document.documentElement.setAttribute("data-theme", "light")
       |
       v
CSS selectors activate: [data-theme="light"] { --rv-bg-base: #ffffff; ... }
       |
       v
All components using --rv-* tokens update instantly (no re-render needed)
```

<!-- Structured flow (machine-readable) -->
<!-- FLOW: User -> setTheme("light") -> ZustandStore -> ThemeProvider -> document.documentElement.setAttribute("data-theme", "light") -> CSS selectors activate -> all --rv-* tokens resolve to new values -->
<!-- SIDE_EFFECT: ZustandStore -> rpc.saveSettings -> BunProcess -> settings.json -->

> **Why this flow matters:** Theme switching must be instant (no full re-render) and persistent (survives app restart). The `data-theme` attribute approach means CSS handles the visual switch with zero JavaScript re-rendering -- only the attribute value changes, and CSS selectors do the rest. Without the RPC persistence step, the user's preference would reset on every app launch. The two parallel paths (visual update + disk persistence) ensure the UI responds immediately while the setting is saved in the background.

> **Why `data-theme` attribute on `<html>`:** A single attribute swap on the root element triggers all CSS `[data-theme]` selectors simultaneously. Every child element inherits the new token values through CSS custom property inheritance. This is cheaper than re-rendering the React tree -- the browser's style engine handles it natively. *(Decision D-02.)*

The CSS custom property approach means theme changes are handled by the browser's style engine, not by React re-renders. Components reference tokens like `bg-rv-bg-base` through Tailwind utilities, and the browser resolves the actual color values from the active `[data-theme]` selector.

## Zustand Store Shape (roadmapStore)

The `useRoadmapStore` is the in-memory working copy of the loaded schema. It uses the **dataKey pattern** for react-d3-tree performance: structural changes (load, reload) increment the `dataKey` string, while status-only updates mutate in-place without changing `dataKey`. This prevents react-d3-tree from deep-cloning the entire tree on every status update.

```typescript
interface RoadmapState {
  // Document data
  schema: RoadmapSchema | null;
  filePath: string | null;
  treeData: RawNodeDatum | null;       // react-d3-tree format (toTreeDatum)
  dataKey: string;                      // Increment = full re-layout
  nodeIndex: Map<string, RoadmapNode>; // O(1) lookup by ID

  // UI state
  selectedNodeId: string | null;
  layoutOrientation: "TB" | "LR";
  isPanelPinned: boolean;

  // Viewport state (for Fit View)
  translate: { x: number; y: number };
  zoomLevel: number;
  viewResetKey: number;                // Increment = force Tree remount

  // Schema validation errors (from Zod)
  schemaErrors: Array<{ path: string; message: string; code: string }>;

  // Actions -- structural (increment dataKey)
  loadSchema: (schema: RoadmapSchema, filePath: string) => void;
  reloadSchema: (schema: RoadmapSchema) => void;

  // Actions -- in-place (no dataKey change)
  updateNodeStatus: (nodeId: string, status: string) => void;
  setSelectedNode: (id: string | null) => void;
  setLayout: (orientation: "TB" | "LR") => void;
  getSelectedNode: () => RoadmapNode | undefined;
  getNodeCount: () => number;

  // Viewport actions
  resetView: () => void;
  setTranslate: (translate: { x: number; y: number }) => void;
  setZoomLevel: (zoom: number) => void;

  // Schema error actions
  setSchemaErrors: (errors: Array<{ path: string; message: string; code: string }>) => void;
}
```

> **Why the dataKey pattern:** react-d3-tree uses deep comparison to detect data changes and triggers expensive layout recalculation. By passing `dataKey` as a prop, structural changes (loading a new file) trigger a re-layout, while high-frequency status updates (from WebSocket integrations) mutate nodes in-place and call `set({})` to notify Zustand subscribers without changing the tree reference. This is the critical performance invariant validated by benchmarks.

Source: [`packages/desktop/src/mainview/store/roadmapStore.ts`](../packages/desktop/src/mainview/store/roadmapStore.ts)

## Component Tree

The webview renders these components in a CSS Grid layout:

```
App (h-screen grid)
+-- TopBar          [grid-area: topbar]    -- Toolbar: Open, New, Search, Fit, Zoom, Layout toggle, Theme
+-- Sidebar         [grid-area: sidebar]   -- Left icon rail
+-- Canvas          [grid-area: canvas]    -- react-d3-tree renderer or WelcomeScreen
|   +-- WelcomeScreen                      -- Shown when no file loaded (recent files, sample links)
|   +-- Tree (react-d3-tree)               -- SVG tree with foreignObject custom nodes
|   |   +-- RoadmapNodeCard                -- Status badge, collapse/expand chevron
|   +-- SchemaErrorPanel                   -- Inline Zod validation error display
+-- SidePanel       [grid-area: panel]     -- Node detail panel (on node selection)
|   +-- ResizeHandle                       -- Drag to resize panel width
|   +-- MarkdownRenderer                   -- remark/rehype pipeline for node notes
+-- StatusBar       [grid-area: status]    -- File name, node count, connection status
```

- **ThemeProvider** wraps the entire app and manages `data-theme` attribute on `<html>`.
- **ThemeOverrideProvider** wraps the canvas area for per-schema CSS overrides.
- The **SidePanel** opens when a node is selected (`selectedNodeId !== null`) and shows node details including markdown-rendered notes.
- The **WelcomeScreen** renders inside the Canvas area when `treeData === null` (no file loaded).

## Key Imports

> **Why typed RPC via `shared/types.ts`:** Both processes import the same type definition, so the TypeScript compiler catches contract mismatches at build time. Without this, the Bun process and webview could silently disagree on parameter shapes, leading to runtime errors that are hard to reproduce and debug. A single source of truth eliminates contract drift. *(Decision D-22; see [RPC and IPC](./rpc-and-ipc.md) for details.)*

Electrobun has its own import paths. These are different from Electron:

```typescript
// Bun main process
import { BrowserWindow, BrowserView, Updater, Utils } from "electrobun/bun";

// Webview renderer
import { Electroview } from "electrobun/view";

// Bundled view URLs (not file paths)
const url = "views://mainview/index.html";
```

## Zod Schema Model

Roadmap JSON files are validated at load time using Zod v4 schemas defined in `packages/core/src/schema.ts`. The schemas use Zod's getter-based recursion for the `children` field:

```typescript
export const RoadmapNodeSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1),
  status: NodeStatusSchema,          // "not-started" | "in-progress" | "completed" | "blocked"
  type: z.string().optional(),
  notes: z.string().optional(),       // Markdown content
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
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

TypeScript types are inferred from Zod schemas (`z.infer<typeof ...>`) and re-exported through `shared/types.ts` for use in both processes. This ensures the JSON file format, the Zod validation, and the TypeScript types are always in sync.

When validation fails, the `loadFile` RPC handler returns both the raw parsed data (for partial rendering) and the error array (for display in SchemaErrorPanel). This means a file with minor schema violations can still be viewed.

Source: [`packages/core/src/schema.ts`](../packages/core/src/schema.ts)

## Related Documentation

- [Design System](./design-system.md) -- token system, theming, how to add tokens
- [RPC and IPC](./rpc-and-ipc.md) -- typed RPC contract, data flows
- [Logging](./logging.md) -- two-process logging architecture
- [Development Guide](./development-guide.md) -- commands, workflow, how to add features
- [`.planning/ARCHITECTURE.md`](../.planning/ARCHITECTURE.md) -- full architecture reference with store shape and plugin interface
