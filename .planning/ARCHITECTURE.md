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
      loadFile:        { params: { path: string };          response: RoadmapSchema }
      saveFile:        { params: { schema: RoadmapSchema }; response: void }
      exportHtml:      { params: { path: string };          response: void }
      exportPng:       { params: { path: string };          response: void }
      openFilePicker:  { params: {};                        response: string | null }
      resolveRef:      { params: { refPath: string };       response: RoadmapNode[] }
    }
    messages: {
      nodeStatusUpdate: { nodeId: string; status: string; meta?: Record<string, unknown> }
      integrationEvent: { source: string; event: IntegrationEvent }
      fileChanged:      { path: string }
    }
  }>
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

## Zustand store shape

No undo/redo history in MVP. The store is the in-memory working copy of the schema.

```typescript
interface RoadmapStore {
  schema:      RoadmapSchema | null
  selectedId:  string | null
  panelOpen:   boolean
  layout:      'TB' | 'LR'
  saveStatus:  'saved' | 'saving' | 'error'
  activeTheme: string             // matches a themeConfig.id or 'default'

  loadSchema:    (s: RoadmapSchema) => void
  updateNode:    (id: string, patch: Partial<RoadmapNode>) => void
  addNode:       (parentId: string | null, position: InsertPosition) => void
  deleteNode:    (id: string) => void
  duplicateNode: (id: string) => void
  moveNode:      (id: string, direction: 'up' | 'down') => void
  setLayout:     (layout: 'TB' | 'LR') => void
  selectNode:    (id: string | null) => void
  setSaveStatus: (status: 'saved' | 'saving' | 'error') => void
  setTheme:      (themeId: string) => void
}
```

---

## Monorepo package structure

```
roadmap-viewer/
├── packages/
│   ├── core/                        # Framework-agnostic — @roadmap-viewer/core
│   │   └── src/
│   │       ├── schema.ts            # Zod schema + TypeScript types
│   │       ├── parser.ts            # Load, validate, resolve $refs
│   │       ├── mutations.ts         # Pure tree mutation functions
│   │       ├── theme.ts             # Theme resolution + CSS var generation
│   │       └── adapters/            # Transport adapters (websocket, webhook, mqtt, file)
│   │
│   ├── react/                       # React components — @roadmap-viewer/react
│   │   └── src/
│   │       ├── RoadmapTree.tsx
│   │       ├── RoadmapNode.tsx
│   │       ├── SidePanel.tsx
│   │       ├── MarkdownEditor.tsx
│   │       ├── ContextMenu.tsx
│   │       ├── Toolbar.tsx
│   │       ├── StatusBar.tsx
│   │       └── ThemeProvider.tsx    # Applies active theme as CSS custom properties
│   │
│   └── desktop/                     # Electrobun app — not published
│       └── src/
│           ├── bun/
│           │   ├── index.ts         # App bootstrap + BrowserWindow setup
│           │   ├── rpc.ts           # RPC handler definitions
│           │   ├── plugins/         # Plugin host — loads/unloads integration plugins
│           │   └── db.ts            # SQLite event log
│           ├── webview/
│           │   ├── index.tsx        # React entry point
│           │   ├── store.ts         # Zustand store
│           │   └── rpc.ts           # Webview RPC client
│           └── shared/
│               └── types.ts         # RPC type contract
│
├── plugins/                         # Built-in integration plugins
│   ├── claude-code/                 # Reference plugin implementation
│   ├── github-actions/
│   └── mqtt/
│
└── examples/
    ├── hello-world.json
    ├── getting-started.json
    └── roadmap-viewer-itself.json
```

---

## Plugin interface

Every integration plugin implements this interface in the Bun process:

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

The plugin host (`desktop/src/bun/plugins/`) loads plugins at startup, routes node `plugin` blocks to the correct plugin by `id`, and forwards events to the webview via RPC.

---

## Theme engine

Themes are applied as CSS custom properties on `:root` in the webview. The active theme is resolved from:
1. The `themeConfig` array in the loaded schema (schema-scoped themes)
2. App-level theme preference in `.roadmap-settings.json`
3. `'default'` built-in theme (fallback)

See `SPEC.md §4.X` for the `themeConfig` JSON schema.
