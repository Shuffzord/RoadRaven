# Architecture Overview

> Last updated: 2026-04-14 | Phase: 01-visual-foundation-themes

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
|  - File I/O (load, save, watch)     |                 |  - React 19 application              |
|  - JSON validation (Zod)            |                 |  - Zustand store (in-memory state)   |
|  - Settings persistence             |                 |  - Theme engine (CSS custom props)   |
|  - Log file writing                 |                 |  - UI components (TopBar, Canvas...) |
|  - Plugin host (WebSocket, etc.)    |                 |  - Log forwarding via RPC            |
|  - Native menus & file dialogs      |                 |                                      |
+-------------------------------------+                 +--------------------------------------+
```

<!-- Structured flow (machine-readable) -->
<!-- COMPONENTS: BunProcess [File I/O, JSON validation, Settings, Log writing, Plugin host, Native menus] -->
<!-- COMPONENTS: WebviewProcess [React 19, Zustand store, Theme engine, UI components, Log forwarding] -->
<!-- LINK: BunProcess <-> TypedRPC <-> WebviewProcess -->

The webview has no direct file system access. All persistence goes through the Bun process via RPC. This is a framework-enforced security boundary, not a design choice.

> **Why Zustand over Redux/Context:** Zustand requires minimal boilerplate, needs no Provider wrapper in the component tree, works outside React (e.g., in RPC handlers), and has a tiny bundle. Redux adds ceremony that is not justified for this app's state complexity. React Context works but does not provide devtools or persistence hooks that later phases need. Zustand was already installed in the project. *(See 01-RESEARCH.md -- Alternatives Considered.)*

## Package Structure

RoadRaven is a monorepo. The `packages/` directory contains the main application code, and `shared/` holds the RPC type contract used by both processes.

```
RoadRaven/
+-- shared/
|   +-- types.ts              # RPC type contract (single source of truth)
|
+-- packages/
|   +-- core/                 # Framework-agnostic logic (@roadraven/core)
|   |   +-- src/
|   |       +-- plugin.ts     # IntegrationEvent type
|   |
|   +-- desktop/              # Electrobun desktop app (@roadraven/desktop)
|       +-- src/
|       |   +-- bun/          # Bun main process
|       |   |   +-- index.ts      # App bootstrap, BrowserWindow, RPC handlers
|       |   |   +-- logging.ts    # LogTape setup, file sink, category loggers
|       |   |   +-- settings.ts   # .roadmap-settings.json read/write
|       |   |
|       |   +-- mainview/     # Webview (React application)
|       |       +-- main.tsx      # React entry point
|       |       +-- App.tsx       # App shell layout (grid)
|       |       +-- index.css     # Token system + theme definitions
|       |       +-- rpc.ts        # Electroview RPC client
|       |       +-- store/        # Zustand stores
|       |       +-- components/   # React components
|       |       +-- logging/      # Webview LogTape setup
|       |
|       +-- vite.config.ts    # Vite bundler config
|       +-- vitest.config.ts  # Test config
|       +-- electrobun.config  # Electrobun app manifest
|
+-- docs/                     # This documentation
+-- .planning/                # Project planning artifacts
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
       |     Bun writes to .roadmap-settings.json
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
<!-- SIDE_EFFECT: ZustandStore -> rpc.saveSettings -> BunProcess -> .roadmap-settings.json -->

> **Why this flow matters:** Theme switching must be instant (no full re-render) and persistent (survives app restart). The `data-theme` attribute approach means CSS handles the visual switch with zero JavaScript re-rendering -- only the attribute value changes, and CSS selectors do the rest. Without the RPC persistence step, the user's preference would reset on every app launch. The two parallel paths (visual update + disk persistence) ensure the UI responds immediately while the setting is saved in the background.

> **Why `data-theme` attribute on `<html>`:** A single attribute swap on the root element triggers all CSS `[data-theme]` selectors simultaneously. Every child element inherits the new token values through CSS custom property inheritance. This is cheaper than re-rendering the React tree -- the browser's style engine handles it natively. *(Decision D-02.)*

The CSS custom property approach means theme changes are handled by the browser's style engine, not by React re-renders. Components reference tokens like `bg-rv-bg-base` through Tailwind utilities, and the browser resolves the actual color values from the active `[data-theme]` selector.

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

## Related Documentation

- [Design System](./design-system.md) -- token system, theming, how to add tokens
- [RPC and IPC](./rpc-and-ipc.md) -- typed RPC contract, data flows
- [Logging](./logging.md) -- two-process logging architecture
- [Development Guide](./development-guide.md) -- commands, workflow, how to add features
- [`.planning/ARCHITECTURE.md`](../.planning/ARCHITECTURE.md) -- full architecture reference with store shape and plugin interface
