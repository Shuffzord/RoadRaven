---
title: Development Guide
nav_order: 3
layout: default
---

# Development Guide

> Last updated: 2026-04-22 | Phase: 03-full-editor (Waves 1 + 2)

## Prerequisites

- [Bun](https://bun.sh) (latest) -- Electrobun's runtime; provides native TypeScript execution and fast package management
- [Electrobun](https://blackboard.sh/electrobun/) installed globally or via the project

## Commands

```bash
bun install           # Install all dependencies

bun run dev:hmr       # Recommended: Vite HMR + Electrobun running concurrently
bun run dev           # Alternative: Electrobun with file watching (restarts on changes)
bun run start         # One-shot: Vite build then Electrobun dev (no watching)

bun run hmr           # Vite dev server only (port 5173) -- used internally by dev:hmr

bun run build:canary  # Production build (canary channel)

bunx vitest           # Run tests in watch mode
bunx vitest run       # Run tests once (CI)
bunx vitest run path/to/file.test.ts  # Run a single test file
```

### Why dev:hmr is Preferred

`bun run dev:hmr` runs two processes concurrently:

1. **Vite dev server** on port 5173 with Hot Module Replacement (HMR)
2. **Electrobun** in dev mode

When the Bun main process starts, it checks if the Vite dev server is running. If it is, the app loads from `http://localhost:5173` instead of the bundled `views://mainview/index.html`. This gives you instant feedback on CSS and component changes without restarting the app.

```typescript
// From packages/desktop/src/bun/index.ts
if (channel === "dev") {
  try {
    await fetch(DEV_SERVER_URL, { method: "HEAD" });
    return DEV_SERVER_URL;       // Vite dev server is running
  } catch {
    // Fall through to bundled view
  }
}
return "views://mainview/index.html";
```

`bun run dev` (without HMR) watches for file changes and restarts the Bun process, but does not provide instant CSS/component updates. Use it when you need to test main process changes.

## Test Environment

Tests use Vitest with environment-specific configuration:

```typescript
// From packages/desktop/vitest.config.ts
test: {
  globals: true,
  environment: "node",                                        // Default: node
  include: ["tests/unit/**/*.test.ts", "tests/unit/**/*.test.tsx"],
  environmentMatchGlobs: [
    ["tests/unit/ui/**/*.test.{ts,tsx}", "jsdom"]             // UI tests: jsdom
  ],
}
```

- **Unit tests** (`tests/unit/`) run in the `node` environment by default.
- **UI tests** (`tests/unit/ui/`) run in `jsdom` for DOM access.
- **Benchmarks** (`tests/bench/`) run in the `node` environment via `bunx vitest bench`.
- `@testing-library/react` and `@testing-library/jest-dom` are available for component testing.

### Benchmarks

Performance benchmarks validate the dataKey invariant (status updates must not trigger tree re-layout):

```bash
bunx vitest bench                     # Run benchmarks
```

The benchmark suite in `tests/bench/perf.bench.ts` uses a schema generator (`generateLargeSchema(300)`) to create deterministic test trees with 300+ nodes. It asserts that `updateNodeStatus` never changes the `dataKey` value.

### Sample Schemas

Two sample schemas are available for development and testing:

- `samples/hello-world.json` -- Minimal schema (4 nodes, all 4 statuses)
- `samples/getting-started.json` -- Rich schema (15 nodes, 4 depth levels, markdown notes, metadata)

In the Vite dev server (HMR mode without Electrobun), the Open button loads `getting-started.json` as a fallback. The WelcomeScreen offers links to load both samples directly.

### The electrobun/view Unavailability Issue

> **Why this matters:** Unlike Electron (where `electron` is always importable), `electrobun/view` is injected by the Electrobun runtime and does not exist as a regular npm package. Any code that imports it will crash outside Electrobun. This affects two common development scenarios, and every developer working on the webview side will encounter it.

`electrobun/view` is only available inside the Electrobun runtime. In two situations it is not available:

1. **Vite dev server** (standalone HMR mode)
2. **Test environment** (vitest with jsdom)

The codebase handles this with lazy imports and try/catch:

```typescript
// Logging setup uses lazy import
try {
  const { electroview } = await import("../rpc");
  rpcSend = (payload) => electroview.rpc.request.logMessage(payload);
} catch {
  // RPC forwarding disabled -- console-only logging
}
```

```typescript
// Main entry catches logging setup failure
try {
  await setupWebviewLogging();
} catch {
  // electrobun/view may not be available outside Electrobun runtime
}
```

When writing new code that uses `electroview`, follow this same pattern: catch the import failure gracefully so the app still works in dev/test environments.

## How to Add a New Component

1. **Create the component file** in `packages/desktop/src/mainview/components/`.

2. **Use only `--rv-*` tokens** via Tailwind classes. No hardcoded colors:

   ```tsx
   // Good
   export function MyComponent() {
     return (
       <div className="bg-rv-bg-surface text-rv-text-primary border border-rv-border">
         Content
       </div>
     );
   }
   ```

   ```tsx
   // Bad -- hardcoded colors will fail CI grep check
   export function MyComponent() {
     return (
       <div className="bg-[#1b1b1c] text-[#e0e0e0]">
         Content
       </div>
     );
   }
   ```

3. **If you need a new token**, follow the steps in [Design System -- How to Add a New Token](./design-system.md#how-to-add-a-new-token).

4. **Add the component** to the app shell in `App.tsx` or the appropriate parent component.

5. **Write tests** in `tests/unit/ui/` using `@testing-library/react`. UI tests automatically get the `jsdom` environment.

## How to Add a New RPC Endpoint

This is a three-file change. TypeScript enforces consistency across all three.

1. **`shared/types.ts`** -- Define the contract:

   ```typescript
   // Inside RoadmapRPCType.bun.requests:
   myEndpoint: {
     params: { input: string };
     response: { output: number };
   };
   ```

2. **`packages/desktop/src/bun/index.ts`** -- Add the handler:

   ```typescript
   // Inside BrowserView.defineRPC handlers.requests:
   myEndpoint: ({ input }) => {
     return { output: input.length };
   },
   ```

3. **Call from webview code**:

   ```typescript
   import { electroview } from "../rpc";
   const result = await electroview.rpc.request.myEndpoint({ input: "hello" });
   ```

See [RPC and IPC](./rpc-and-ipc.md) for the full contract reference and data flow diagrams.

## How to Add a New Logger Category

Create a logger with `getLogger()` using an array-based category:

```typescript
// Webview side (in packages/desktop/src/mainview/logging/logger.ts)
export const myFeatureLogger = getLogger(["webview", "my-feature"]);

// Bun side (in packages/desktop/src/bun/logging.ts)
export const myFeatureLogger = getLogger(["bun", "my-feature"]);
```

No additional configuration needed -- loggers inherit from their parent category. See [Logging](./logging.md) for details.

## Keyboard Shortcuts

The canvas keyboard layer is implemented in [`hooks/useKeyboardRouter.ts`](../packages/desktop/src/mainview/hooks/useKeyboardRouter.ts). The router runs in capture phase and stands down when a Radix dialog or context menu is open, or when a text input / CodeMirror editor is focused.

### Canvas (focused node)

| Shortcut | Action |
|----------|--------|
| `Arrow ←` / `Arrow →` (TB) | Move focus between siblings |
| `Arrow ↑` / `Arrow ↓` (LR) | Move focus between siblings |
| `Arrow ↓` (TB) / `Arrow →` (LR) | Enter first child (descend) |
| `Arrow ↑` (TB) / `Arrow ←` (LR) | Return to parent |
| `Space` | Select focused node (open / refresh side panel) |
| `Enter` | Add child + open inline rename on the new node |
| `Tab` | Add sibling below + open inline rename |
| `Shift+Enter` | Add sibling above + open inline rename |
| `F2` | Inline rename on focused node |
| `Del` / `Backspace` | Delete focused node (confirmation dialog if it has children) |
| `Ctrl+D` | Duplicate focused node + subtree, then open rename on the copy |
| `Ctrl+C` | Copy node + subtree to clipboard as JSON |
| `Ctrl+V` | Paste clipboard subtree under focused node |
| `Ctrl+Arrow ↑` | Move focused node up among its siblings |
| `Ctrl+Arrow ↓` | Move focused node down among its siblings |
| `Escape` | Cancel inline rename, or deselect node |
| `F6` | Toggle focus between canvas and side panel |

Arrow-key axes follow the layout orientation: in TB (top-bottom) layout siblings are horizontal neighbours and children flow downward; in LR (left-right) layout siblings are vertical neighbours and children flow rightward. The same focus-then-act mental model applies to both.

`Ctrl+C` / `Ctrl+V` are context-aware: when `document.activeElement` is a text input, `<textarea>`, `contentEditable` element, or inside a `.cm-editor` (CodeMirror), the shortcuts fall through to the browser's native text copy/paste instead of the node clipboard.

### Side panel

| Shortcut | Action | Context |
|----------|--------|---------|
| `e` | Enter edit mode | Side panel open, no text input focused, not already editing |
| `Escape` | Cancel title edit / exit edit mode | Side panel in edit mode |

Edit mode can also be entered by clicking the title field or the `[E]` pencil button in the panel header.

Node cards are keyboard-accessible (`role="button"`, `tabIndex={0}`, Enter / Space handlers). The dashed focus ring uses a `keyboard-nav-active` class on `<body>` so it only shows during keyboard navigation, not after a mouse click.

## Project Conventions

> **Why these conventions exist:** Each rule prevents a specific class of bug or maintenance problem. The token prefix prevents CSS collisions. The hardcoded color ban ensures themes work everywhere. The single RPC contract prevents process drift. LogTape loggers provide persistent, structured output that `console.log` cannot. These are not style preferences -- they are guardrails for a two-process desktop app where bugs across the process boundary are hard to debug.

| Convention | Rule | Why |
|-----------|------|-----|
| Token prefix | All CSS custom properties start with `--rv-` | Namespace isolation from Tailwind internals and third-party CSS *(D-03)* |
| Hardcoded colors | Not allowed in components. CI grep enforces this. | Ensures theme switching works for every component *(D-03, D-17)* |
| RPC contract | Defined once in `shared/types.ts`, imported by both processes | Compile-time safety across the process boundary *(D-22)* |
| Logging | Use LogTape loggers, not `console.log` | Structured output, file persistence, category filtering *(D-21)* |
| Test location | `tests/unit/` for unit tests, `tests/unit/ui/` for component tests | Environment matching: node for logic, jsdom for components |
| Formatter | Biome (not Prettier) | Faster, linting + formatting in one tool (Phase 0 decision) |
| Package scope | `@roadraven/` | Consistent npm namespace for publishable packages |

## Related Documentation

- [Architecture Overview](./architecture-overview.md) -- process model, package structure
- [Design System](./design-system.md) -- token system, theming, adding themes
- [RPC and IPC](./rpc-and-ipc.md) -- typed RPC contract details
- [Logging](./logging.md) -- two-process logging architecture
