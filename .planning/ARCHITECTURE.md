# Architecture Reference

> Load this file on demand when making structural changes. For day-to-day work, CLAUDE.md is sufficient.

## Process model

Electrobun enforces a strict two-process model. This is the framework's security boundary — not optional.

```
┌─────────────────────────────────────┐    Typed RPC    ┌───────────────────────────────────────┐
│         Bun main process            │◄───────────────►│         Webview process                │
│                                     │                 │                                        │
│  • File I/O (load, save, watch)     │                 │  • React application                   │
│  • JSON validation (Zod)            │                 │  • react-d3-tree renderer              │
│  • $ref resolution                  │                 │  • SidePanel + MarkdownEditor          │
│  • Plugin host (integration hubs)   │                 │  • Toolbar, StatusBar, ContextMenu     │
│  • WebSocket / webhook / MQTT       │                 │  • Zustand store (in-memory schema)    │
│  • SQLite event log                 │                 │  • Theme engine (CSS custom props)     │
│  • Native menus & file dialogs      │                 │  • HTML export renderer                │
│  • Auto-updater                     │                 │                                        │
│  • PNG export (headless)            │                 │                                        │
└─────────────────────────────────────┘                 └───────────────────────────────────────┘
```

The webview has **no direct file system access**. All persistence and network calls go through the Bun process via RPC.

---

## RPC type contract (`shared/types.ts`)

Single source of truth for the Bun↔webview interface. Both sides import from it. Breaking changes require updating both sides before any code ships.

```typescript
export type RoadmapRPCType = {
  bun: RPCSchema<{
    requests: {
      loadFile:        { params: { path: string };                          response: { data: RoadmapSchema | null; errors?: Array<{ path: string; message: string; code: string }> } }
      saveFile:        { params: { schema: RoadmapSchema };                 response: undefined }
      exportHtml:      { params: { path: string };                          response: undefined }
      exportPng:       { params: { path: string };                          response: undefined }
      openFilePicker:  { params: Record<string, never>;                     response: string }
      resolveRef:      { params: { refPath: string };                       response: RoadmapNode[] }
      saveSettings:    { params: { settings: Partial<AppSettings> };        response: { success: boolean } }
      loadSettings:    { params: Record<string, never>;                     response: { settings: AppSettings } }
      logMessage:      { params: { level, category: string[], message: string, data?: Record<string, unknown> };  response: undefined }
    }
    messages: {
      nodeStatusUpdate: { nodeId: string; status: string; meta?: Record<string, unknown> }
      integrationEvent: { source: string; event: IntegrationEvent }
      fileChanged:      { path: string }
    }
  }>
  webview: RPCSchema<{
    requests: Record<string, never>
    messages: {
      pushStatusUpdate: { nodeId: string; status: string; meta?: Record<string, unknown> }
      pushEventLog:     { event: IntegrationEvent }
      pushFileChanged:  { path: string }
    }
  }>
}
```

---

## Zustand store shape

The store is the in-memory working copy of the schema. It uses the **dataKey pattern** for react-d3-tree performance: structural changes increment `dataKey`, status updates mutate in-place without changing it.

```typescript
interface RoadmapState {
  // Document data
  schema:      RoadmapSchema | null
  filePath:    string | null
  treeData:    RawNodeDatum | null       // react-d3-tree format via toTreeDatum()
  dataKey:     string                     // increment = full tree re-layout
  nodeIndex:   Map<string, RoadmapNode>  // O(1) lookup by ID via buildNodeIndex()

  // UI state
  selectedNodeId:     string | null
  layoutOrientation:  'TB' | 'LR'
  isPanelPinned:      boolean

  // Viewport state (Fit View)
  translate:     { x: number; y: number }
  zoomLevel:     number
  viewResetKey:  number                   // increment = force Tree remount

  // Schema validation errors (from Zod)
  schemaErrors:  Array<{ path: string; message: string; code: string }>

  // Actions -- structural (increment dataKey)
  loadSchema:    (schema: RoadmapSchema, filePath: string) => void
  reloadSchema:  (schema: RoadmapSchema) => void

  // Actions -- in-place (NO dataKey change -- critical performance path)
  updateNodeStatus: (nodeId: string, status: string) => void
  setSelectedNode:  (id: string | null) => void
  setLayout:        (orientation: 'TB' | 'LR') => void
  getSelectedNode:  () => RoadmapNode | undefined
  getNodeCount:     () => number

  // Viewport actions
  resetView:     () => void
  setTranslate:  (translate: { x: number; y: number }) => void
  setZoomLevel:  (zoom: number) => void

  // Schema error actions
  setSchemaErrors: (errors: Array<{ path: string; message: string; code: string }>) => void
}
```

Theme state is managed separately in `useThemeStore` (see `store/themeStore.ts`).

---

## Monorepo package structure

```
RoadRaven/
├── shared/
│   └── types.ts                     # RPC type contract + Zod-inferred type re-exports
│
├── packages/
│   ├── core/                        # Framework-agnostic — @roadraven/core
│   │   └── src/
│   │       ├── schema.ts            # Zod v4 schemas + inferred TypeScript types
│   │       ├── plugin.ts            # IntegrationEvent type
│   │       └── index.ts             # Re-exports
│   │
│   └── desktop/                     # Electrobun app — @roadraven/desktop
│       ├── src/
│       │   ├── bun/                 # Bun main process
│       │   │   ├── index.ts         # App bootstrap, BrowserWindow, RPC handlers
│       │   │   ├── fileWatcher.ts   # File watching with 500ms debounce
│       │   │   ├── logging.ts       # LogTape setup, file sink, category loggers
│       │   │   └── settings.ts      # Settings read/write + addRecentFile
│       │   │
│       │   └── mainview/            # Webview (React application)
│       │       ├── main.tsx         # React entry point
│       │       ├── App.tsx          # App shell (CSS Grid layout)
│       │       ├── index.css        # Token system + theme definitions
│       │       ├── rpc.ts           # Electroview RPC client
│       │       ├── rpcHandlers.ts   # ESM-safe inbound message handlers
│       │       ├── store/
│       │       │   ├── roadmapStore.ts   # Schema, tree, viewport, dataKey pattern
│       │       │   └── themeStore.ts     # Theme preference + system resolution
│       │       ├── components/
│       │       │   ├── Canvas.tsx              # react-d3-tree renderer + WelcomeScreen
│       │       │   ├── RoadmapNode.tsx         # Custom node card (foreignObject)
│       │       │   ├── SidePanel.tsx           # Node detail panel + markdown
│       │       │   ├── MarkdownRenderer.tsx    # unified/remark/rehype pipeline
│       │       │   ├── ResizeHandle.tsx        # Drag-to-resize handle
│       │       │   ├── WelcomeScreen.tsx       # Landing screen, recent files, samples
│       │       │   ├── SchemaErrorPanel.tsx    # Zod validation error display
│       │       │   ├── TopBar.tsx              # Toolbar (open, layout, theme, fit)
│       │       │   ├── StatusBar.tsx           # File name + node count
│       │       │   ├── Sidebar.tsx             # Left icon rail
│       │       │   ├── ThemeProvider.tsx        # data-theme attribute management
│       │       │   └── ThemeOverrideProvider.tsx # Per-schema CSS overrides
│       │       ├── hooks/
│       │       │   └── useTheme.ts
│       │       └── logging/
│       │           └── logger.ts    # Webview LogTape + RPC forwarding
│       │
│       ├── tests/
│       │   ├── unit/                # Unit tests (node env)
│       │   │   └── ui/             # Component tests (jsdom env)
│       │   └── bench/              # Vitest benchmarks
│       │
│       ├── vite.config.ts
│       ├── vitest.config.ts
│       └── electrobun.config
│
├── samples/
│   ├── hello-world.json             # 4 nodes, all statuses
│   └── getting-started.json         # 15 nodes, 4 depth levels
│
├── docs/                            # Developer documentation
└── .planning/                       # Project planning artifacts
```

> **Note:** The planned `packages/react/` (shared component library) and `plugins/` (integration plugins) directories are future work. Currently all React components live inside `packages/desktop/src/mainview/components/`.

---

## Plugin interface (planned -- not yet implemented)

Every integration plugin will implement this interface in the Bun process:

```typescript
interface RoadmapPlugin {
  id:      string          // e.g. "claude-code", "github-actions"
  name:    string          // Display name in integration status bar
  version: string

  // Called when a node with a matching plugin binding is loaded
  connect(nodeId: string, config: Record<string, unknown>): Promise<void>

  // Called when a subscribed node is deleted or the file is closed
  disconnect(nodeId: string): Promise<void>

  // Emits IntegrationEvent to the plugin host when state changes
  on(event: 'status', handler: (e: IntegrationEvent) => void): void

  // Optional: render config in the side panel Integration zone
  sidePanel?: {
    component: string   // Name of a registered webview component
  }
}
```

The RPC contract already includes `nodeStatusUpdate`, `integrationEvent`, and `pushStatusUpdate` messages in preparation for plugin support. The `IntegrationEvent` type is defined in `packages/core/src/plugin.ts`. The plugin host and built-in plugins (claude-code, github-actions, mqtt) are planned for a future phase.

---

## Theme engine

Themes are applied via `data-theme` attribute on `<html>` in the webview. Three built-in themes: **dark** (default), **light**, **high-contrast**. System preference detection supported via `"system"` option.

The active theme is resolved from:
1. App-level theme preference persisted in `settings.json` (platform-specific directory)
2. System OS preference (when set to `"system"`)
3. `"dark"` fallback

Per-schema overrides (`themeConfig.statusColors`, `themeConfig.nodeRadius`) are applied via `ThemeOverrideProvider` as scoped inline CSS custom properties on a wrapper div -- they do not leak to global UI.

See [Design System docs](../docs/design-system.md) for token naming, theme mechanism, and how to add themes.
