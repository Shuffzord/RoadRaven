---
title: Development Guide
nav_order: 3
layout: default
---

# Development Guide

## Prerequisites

- [Bun](https://bun.sh) (latest) -- Electrobun's runtime; provides native TypeScript execution and fast package management
- [Electrobun](https://blackboard.sh/electrobun/) installed globally or via the project

## Commands

Prefer the `bun run` script wrappers over calling `bunx vitest` / `bunx vite` directly -- the wrappers use the workspace-pinned tool versions and avoid silent version drift. Run `bun run verify` before opening a PR.

```bash
bun install           # Install all dependencies

bun run dev:hmr       # Recommended: Vite HMR + Electrobun running concurrently
bun run dev           # Alternative: Electrobun with file watching (restarts on changes)
bun run start         # One-shot: Vite build then Electrobun dev (no watching)
bun run hmr           # Vite dev server only, port 5173 (desktop package; used internally by dev:hmr)
bun run build:canary  # Production build (canary channel)
```

### Tests

```bash
bun run test          # Full test suite across all workspaces
bun run test:desktop  # Desktop package only (faster)
bun run test:file path/to/file.test.ts  # Run a single test file
bun run test:typecheck # tsc --noEmit
bun run test:build    # Production build (catches import/CSS issues unit tests miss)
bun run test:lint     # Biome lint (matches CI)
bun run verify        # test + typecheck + build + lint -- the PR-readiness check
```

The desktop package also provides `test:bun` (Bun-native event-server tests), `test:e2e`
(Playwright), and `test:a11y` (Playwright accessibility). Run these from
`packages/desktop` (or via `bun run --cwd packages/desktop <script>`).

### Why dev:hmr is Preferred

`bun run dev:hmr` runs the Vite dev server (port 5173, with Hot Module Replacement) and
Electrobun concurrently. On startup the Bun main process probes the dev server: if it is
up, the app loads from `http://localhost:5173`; otherwise it falls back to the bundled
`views://mainview/index.html`. This gives instant CSS/component feedback without
restarting the app.

`bun run dev` (no HMR) watches files and restarts the Bun process, but does not provide
instant CSS/component updates. Use it when testing main-process changes.

## Test Environment

Tests use Vitest with environment-specific configuration (see
`packages/desktop/vitest.config.ts`):

- **Unit tests** (`tests/unit/`) run in the `node` environment by default.
- **UI tests** (`tests/unit/ui/`) run in `jsdom` for DOM access (matched via `environmentMatchGlobs`).
- **Benchmarks** (`tests/bench/`) run in `node` via `bunx vitest bench` (run from the desktop package).
- `@testing-library/react` and `@testing-library/jest-dom` are available for component testing.

The benchmark suite (`tests/bench/perf.bench.ts`) uses a schema generator
(`generateLargeSchema(300)`) to build deterministic 300+ node trees and asserts that
`updateNodeStatus` never changes the `dataKey` value -- the invariant that status
updates must not trigger tree re-layout.

### Sample Schemas

- `samples/hello-world.json` -- Minimal schema (4 nodes, all 4 statuses)
- `samples/getting-started.json` -- Rich schema (15 nodes, 4 depth levels, markdown notes, metadata)

In the Vite dev server (HMR mode without Electrobun), the Open button loads
`getting-started.json` as a fallback. The WelcomeScreen offers links to load both samples directly.

### The electrobun/view Unavailability Issue

`electrobun/view` is injected by the Electrobun runtime and is **not** a regular npm
package -- it does not exist in the Vite dev server (standalone HMR) or in the test
environment (vitest with jsdom). Any code that imports it eagerly will crash there. Use a
lazy import wrapped in try/catch so the app still works in dev/test:

```typescript
try {
  const { electroview } = await import("../rpc");
  rpcSend = (payload) => electroview.rpc.request.logMessage(payload);
} catch {
  // electrobun/view unavailable outside the runtime -- fall back gracefully
}
```

Follow this pattern whenever new code uses `electroview`.

## How to Add a New Component

1. **Create the component file** in `packages/desktop/src/mainview/components/`.

2. **Use only `--rv-*` tokens** via Tailwind classes -- no hardcoded colors (a CI grep check enforces this):

   ```tsx
   // Good
   <div className="bg-rv-bg-surface text-rv-text-primary border border-rv-border">Content</div>

   // Bad -- hardcoded colors fail the CI grep check
   <div className="bg-[#1b1b1c] text-[#e0e0e0]">Content</div>
   ```

3. **If you need a new token**, follow [Design System -- How to Add a New Token](./design-system.md#how-to-add-a-new-token).

4. **Add the component** to the app shell in `App.tsx` or the appropriate parent.

5. **Write tests** in `tests/unit/ui/` using `@testing-library/react` (these get the `jsdom` environment automatically).

## How to Add a New RPC Endpoint

A three-file change; TypeScript enforces consistency across all three.

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
   myEndpoint: ({ input }) => ({ output: input.length }),
   ```

3. **Call from webview code**:

   ```typescript
   import { electroview } from "../rpc";
   const result = await electroview.rpc.request.myEndpoint({ input: "hello" });
   ```

See [RPC and IPC](./rpc-and-ipc.md) for the full contract reference and data flow diagrams.

## How to Add a New Logger Category

Create a logger with `getLogger()` using an array-based category. No extra configuration
is needed -- loggers inherit from their parent category.

```typescript
// Webview side (packages/desktop/src/mainview/logging/logger.ts)
export const myFeatureLogger = getLogger(["webview", "my-feature"]);

// Bun side (packages/desktop/src/bun/logging.ts)
export const myFeatureLogger = getLogger(["bun", "my-feature"]);
```

See [Logging](./logging.md) for details.

## Keyboard Shortcuts

The canvas keyboard layer lives in
[`hooks/useKeyboardRouter.ts`](../packages/desktop/src/mainview/hooks/useKeyboardRouter.ts).
The router runs in capture phase and stands down when a Radix dialog or context menu is
open, or when a text input / CodeMirror editor is focused.

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

Arrow-key axes follow the layout orientation: in TB (top-bottom) layout siblings are
horizontal and children flow downward; in LR (left-right) layout siblings are vertical and
children flow rightward. `Ctrl+C` / `Ctrl+V` are context-aware -- when a text input,
`<textarea>`, `contentEditable`, or CodeMirror (`.cm-editor`) is focused, they fall through
to the browser's native text copy/paste instead of the node clipboard.

### Side panel

| Shortcut | Action | Context |
|----------|--------|---------|
| `e` | Enter edit mode | Side panel open, no text input focused, not already editing |
| `Escape` | Cancel title edit / exit edit mode | Side panel in edit mode |

Edit mode can also be entered by clicking the title field or the `[E]` pencil button in
the panel header. Node cards are keyboard-accessible (`role="button"`, `tabIndex={0}`,
Enter / Space handlers); the dashed focus ring uses a `keyboard-nav-active` class on
`<body>` so it shows only during keyboard navigation, not after a mouse click.

## Project Conventions

| Convention | Rule | Why |
|-----------|------|-----|
| Token prefix | All CSS custom properties start with `--rv-` | Namespace isolation from Tailwind internals and third-party CSS |
| Hardcoded colors | Not allowed in components; CI grep enforces this | Ensures theme switching works for every component |
| RPC contract | Defined once in `shared/types.ts`, imported by both processes | Compile-time safety across the process boundary |
| Logging | Use LogTape loggers, not `console.log` | Structured output, file persistence, category filtering |
| Test location | `tests/unit/` for unit tests, `tests/unit/ui/` for component tests | Environment matching: node for logic, jsdom for components |
| Formatter | Biome (not Prettier) | Faster; linting + formatting in one tool |
| Package scope | `@roadraven/` | Consistent npm namespace for publishable packages |

## Related Documentation

- [Architecture Overview](./architecture-overview.md) -- process model, package structure
- [Design System](./design-system.md) -- token system, theming, adding themes
- [RPC and IPC](./rpc-and-ipc.md) -- typed RPC contract details
- [Logging](./logging.md) -- two-process logging architecture
