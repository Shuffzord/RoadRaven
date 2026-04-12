# Architecture Research

**Project:** Roadmap Viewer (Electrobun desktop app)
**Researched:** 2026-04-12
**Overall confidence:** HIGH for Electrobun-specific findings (verified against official llms.txt); MEDIUM for plugin system patterns (design patterns from training data, no official Electrobun plugin model exists); HIGH for Bun monorepo patterns.

---

## Summary

The current spec architecture is sound. The two-process model, RPC contract, and monorepo layout are well-conceived and align with how Electrobun actually works. The critical risks are not in the big structural choices — they are in six specific seams where the spec's design assumptions meet reality: the plugin-to-webview component handoff, the nested-JSON mutation model at scale, the `$ref` + file watcher interaction, the Linux CEF context-menu gap, the `before-quit` Linux caveat for save flushing, and the request-timeout ceiling on the RPC layer. Each is preventable if addressed in the right phase.

---

## Process Model Analysis

### How Electrobun RPC actually works

Electrobun enforces a hard two-process model through its security boundary. Communication happens via a typed RPC layer defined in a shared type file. There are two distinct patterns:

**Requests** — bidirectional, awaitable, have a `maxRequestTime` (default 5000 ms). Use for operations that need a response: `loadFile`, `saveFile`, `exportPng`. If the handler does not resolve within the timeout, the call fails.

**Messages** — fire-and-forget, no return value. Use for streaming/push notifications: `pushStatusUpdate`, `pushFileChanged`, `pushEventLog`. These are the right choice for all live-update paths because they have no timeout constraint and impose no back-pressure.

The spec's RPC contract already makes this distinction correctly: all inbound pushes from Bun to webview are `messages`, and all user-initiated operations are `requests`. This is the right split. Do not drift from it.

### Risks in the process model

**Risk 1: `saveFile` request timeout.** The spec sends the full `RoadmapSchema` as the request payload. For a large schema (500 nodes, many notes), serialisation + IPC + disk write could approach the 5000 ms default. `maxRequestTime` must be set to at least 15000 ms on the `saveFile` handler. Set it at scaffold time before any performance pressure.

**Risk 2: `before-quit` Linux gap.** Electrobun's `before-quit` event fires for all quit triggers on macOS and Windows but only for user-initiated quits on Linux (not `SIGTERM` from the process manager). If the OS kills the app (systemd service restart, package manager upgrade), the pending debounced save will not flush on Linux. Mitigation: on Linux, also register `process.on('SIGTERM', ...)` to flush the write queue. This is a one-liner but easy to miss.

**Risk 3: No browser-to-browser communication.** Electrobun confirmed: cross-view RPC is not possible. All inter-view communication routes through the Bun process. This project has one webview, so this is not a concern for MVP. If multi-window is ever added (v1.1 scope), every status update must still flow through Bun — the architecture already enforces this.

**Risk 4: Sandbox mode disables RPC.** If a `BrowserWindow` is ever created with `sandbox: true`, the RPC system is disabled. The roadmap viewer must use the default (non-sandbox) mode. This is fine — the webview receives data through the RPC contract, not by executing arbitrary JS from untrusted sources.

---

## RPC Boundary Best Practices

### Message vs request decision rule

Use a **request** when:
- The webview needs to know if the operation succeeded or failed before proceeding
- The operation returns data the webview will immediately act on
- Examples: `loadFile`, `saveFile`, `exportPng`, `openFilePicker`, `resolveRef`

Use a **message** when:
- Bun is pushing a notification the webview should handle asynchronously
- No acknowledgement is needed
- Examples: `pushStatusUpdate`, `pushFileChanged`, `pushEventLog`

The spec contract already follows this rule. Lock it in the `shared/types.ts` review during the scaffold phase.

### Payload design

Keep RPC payloads serialisable. Avoid:
- `Date` objects (use ISO 8601 strings)
- Class instances (use plain objects)
- `undefined` values in objects (use `null` or omit the key)
- Circular references

The `RoadmapSchema` type should be a plain JSON-serialisable type with no class methods. Zod types validate it at the Bun boundary; the webview trusts what Bun sends.

### Error surface

Requests throw on timeout or handler error. The webview RPC client (`desktop/src/webview/rpc.ts`) must wrap all `await rpc.request.*` calls in try/catch and route errors to the appropriate UI state. The error taxonomy in the spec (Fatal / Blocking / Warning) maps to these catch sites:
- `loadFile` error → Fatal error screen
- `saveFile` error → `setSaveStatus('error')` + toast
- `exportPng` error → toast warning
- `openFilePicker` error → silently reset (user cancelled)

### One-way data flow discipline

The Zustand store is the single source of truth in the webview. When Bun pushes a `pushStatusUpdate` message, the handler must call `store.updateNode()` — not mutate React state directly. This ensures the debounced save picks up the change and the tree re-renders from one consistent source. Violating this (updating a local component state alongside the store) is the most common cause of stale-render bugs in this architecture.

---

## Monorepo Structure Recommendations

### Workspace configuration

Bun workspaces use the standard `workspaces` key in the root `package.json`. The spec layout (`packages/core`, `packages/react`, `packages/desktop`) is correct. Recommended root `package.json`:

```json
{
  "name": "roadmap-viewer",
  "private": true,
  "workspaces": ["packages/*", "plugins/*"],
  "scripts": {
    "test": "bunx vitest run",
    "build": "bun run --filter ./packages/core build && bun run --filter ./packages/react build"
  }
}
```

Use `workspace:*` protocol for cross-package dependencies (e.g. `packages/react` depends on `packages/core`). Bun resolves these to local paths during development and replaces them with semver versions on publish.

### TypeScript project references

Use TypeScript project references for monorepo correctness. Each package needs its own `tsconfig.json` extending a root base config. The `packages/desktop` tsconfig references both `packages/core` and `packages/react`:

```json
// packages/desktop/tsconfig.json
{
  "extends": "../../tsconfig.base.json",
  "references": [
    { "path": "../core" },
    { "path": "../react" }
  ]
}
```

The root `tsconfig.base.json` sets `"moduleResolution": "bundler"` and `"verbatimModuleSyntax": true` as recommended by Bun's own TypeScript docs. Do not use `noEmit: true` in packages that need to emit declarations for npm publishing.

### Shared types location

The `shared/types.ts` inside `packages/desktop` is the right home for the RPC contract because it is desktop-specific (Electrobun types, `RPCSchema`). Do NOT move it to `packages/core` — `@roadmap-viewer/core` must remain a framework-agnostic npm package with no Electrobun dependency. The domain types (`RoadmapSchema`, `RoadmapNode`, `IntegrationEvent`) belong in `packages/core/src/schema.ts` and are imported by `shared/types.ts`.

The import graph must stay acyclic:
```
packages/core          (no local deps)
packages/react         (depends on core)
packages/desktop       (depends on core + react; never imported by core or react)
plugins/*              (depends on core; loaded by desktop at runtime)
```

### Build pipeline

Build order enforced by the dependency graph above:
1. `packages/core` — `bun build` outputs ESM to `dist/`; also emits `.d.ts` declarations
2. `packages/react` — Vite (library mode) builds the component library; peer-depends on React
3. `packages/desktop` — Electrobun's own build pipeline (`bunx electrobun build`) handles this; Vite bundles the webview, Bun compiles the main process

For development, `bun run dev:hmr` runs Vite dev server + Electrobun concurrently. The core and react packages do not need to be rebuilt during development if path aliases point to `src/` directly (configure via `tsconfig.json` `paths`).

For CI, build must always run `core` before `react` before `desktop`. A Turborepo or `bun run --filter` ordering handles this, but with only three packages the simplest approach is an explicit sequential script in root `package.json`.

---

## Plugin System Design Patterns

### The fundamental constraint

Plugins run in the Bun process (Node-like runtime, full file system and network access). They cannot render UI directly. Any plugin UI in the side panel must go through the webview via RPC. This is the hardest seam in the plugin design.

### Recommended plugin interface

The spec's current `RoadmapPlugin` interface is mostly right. Four clarifications needed:

**1. Config validation is the plugin's responsibility.**
The plugin host passes `config: Record<string, unknown>` to `connect()`. The plugin must validate it internally (Zod is available in `@core`). If config is invalid, `connect()` should throw a descriptive error that surfaces as a Warning on the node.

**2. The `sidePanel.component` field is a design timebomb.**
The spec proposes `sidePanel?: { component: string }` — a string reference to a "registered webview component". This implies a plugin can register React components, but plugins live in the Bun process and have no access to the webview's React tree. There are two honest options:

- **Option A (recommended for MVP):** Remove `sidePanel.component` from the plugin interface. Instead, each plugin emits structured data (a serialisable `pluginState` object) via `on('state', handler)`. The Bun process forwards this via `pushStatusUpdate` / a new `pushPluginState` message. The webview has a single generic `PluginStatePanel` component that renders key-value data from whatever the plugin emits. This requires no dynamic component loading and is safe, testable, and serialisable over RPC.
- **Option B (v1.1+):** Allow plugins to ship their own webview bundle (a separate JS file loaded into a sandboxed iframe). This is the full plugin UI story but requires significant scaffolding.

Use Option A for MVP. The spec already acknowledges the plugin system needs a research phase — this is what that phase should resolve.

**3. Plugin lifecycle must be explicit.**
The plugin host needs four lifecycle hooks, not two:

```typescript
interface RoadmapPlugin {
  id:      string
  name:    string
  version: string

  connect(nodeId: string, config: Record<string, unknown>): Promise<void>
  disconnect(nodeId: string): Promise<void>
  on(event: 'status' | 'state', handler: (e: IntegrationEvent | PluginState) => void): void
  off(event: 'status' | 'state', handler: Function): void  // needed to avoid leaks
}
```

Without `off()`, the plugin host cannot cleanly remove listeners when a node is deleted. Event listener accumulation is a silent memory leak — in a long-running app this will manifest as ghost status updates after nodes are deleted.

**4. Static loading for MVP.**
The spec defers dynamic runtime loading to v1.1. For MVP, built-in plugins (`claude-code`, `github-actions`) are imported directly in `desktop/src/bun/plugins/index.ts`. A plugin registry is a plain `Map<string, RoadmapPlugin>` populated at startup. Unknown `plugin.id` values do a `registry.has(id)` check and surface a Warning if not found. This is simple, fully typed, and testable.

### Plugin host structure

```
desktop/src/bun/plugins/
├── index.ts          # Plugin registry, host lifecycle (connect/disconnect all on file load/close)
├── claude-code.ts    # Claude Code plugin implementation
└── github-actions.ts # GitHub Actions plugin implementation
```

The plugin host is responsible for:
- Registering all built-in plugins at startup
- Iterating schema nodes on file load, calling `plugin.connect()` for each `plugin` block
- Routing incoming `IntegrationEvent` from plugins to webview via `rpc.send.pushStatusUpdate`
- Calling `plugin.disconnect()` for each node when file is closed or node is deleted
- Surfacing unknown `plugin.id` as Warning (does not block load)

---

## Integration Adapter Layer

### Adapter responsibilities

Each adapter in `packages/core/src/adapters/` is responsible for exactly one thing: normalising events from a transport into `IntegrationEvent` objects and emitting them. Adapters must NOT:
- Write to the Zustand store (they live in Bun, not the webview)
- Write to disk
- Know about node IDs (channel→node routing is the plugin host's job)

### WebSocket adapter

The spec's design is sound. Two implementation risks:

**Reconnection backoff must be capped.** The spec says "1 s, 2 s, 4 s, 8 s, max 60 s". Implement this with a jitter factor (e.g. +/- 20% of the delay) to prevent reconnection storms if multiple nodes subscribe to the same endpoint and it drops. Without jitter, all nodes reconnect simultaneously after 60 s, hammering the server.

**Connection deduplication.** Multiple nodes can subscribe to the same WebSocket endpoint. The adapter must maintain one WebSocket connection per endpoint, not one per node. A `Map<endpoint, WebSocket>` with reference counting handles connect/disconnect lifecycle correctly.

### Webhook adapter

**Port conflict is a real user-facing issue.** The spec correctly identifies "port 7342 already in use" as a Warning. The adapter must attempt to bind, catch `EADDRINUSE`, surface the Warning, and disable itself gracefully (other adapters continue working). Default port should be user-configurable in `.roadmap-settings.json`.

**Bun's built-in HTTP server** (`Bun.serve`) handles this cleanly — it is native and fast. The webhook adapter is a `POST` handler bound to `127.0.0.1:7342/events`. Route by the `channel` field in the JSON body.

### MQTT adapter

MQTT in Bun requires a third-party library. `mqtt` (the npm package, v5.x) works in Bun. Verify before coding — the adapter's viability depends on this. Topic wildcard handling (`#` and `+` patterns) must match node `channel` subscriptions. The adapter should normalise topic wildcards to a regex for matching.

**Confidence: MEDIUM** — MQTT + Bun compatibility confirmed by community reports but no official documentation exists.

### File watcher adapter

Bun's `fs.watch` is native and efficient. Key risk: `fs.watch` on Linux uses `inotify`, which has a system-level file descriptor limit (`/proc/sys/fs/inotify/max_user_watches`, typically 8192). A roadmap with 500 `file` transport subscriptions will hit this limit. Mitigation: the file watcher adapter should batch multiple paths into a single watcher instance where possible, and document the limitation.

The `$ref` file watcher (for split-file schemas) uses the same mechanism. The file watcher adapter and the `$ref` resolver must share the same `fs.watch` infrastructure to avoid double-watching the same path.

### `$ref` + file watcher interaction risk

This is the highest-complexity seam in the data layer. When a `$ref`-included file changes externally:
1. The file watcher fires for that specific file
2. Bun must re-read and re-validate that subtree only
3. Bun must merge it into the in-memory schema (replacing the old subtree)
4. Bun must send `pushFileChanged` to the webview
5. The webview re-renders from the updated schema

The risk: a `$ref` file may be modified simultaneously by both an external tool (writing status JSON) and the app user (editing notes). The spec's "last-write-wins from the app's perspective" rule handles the conflict case, but the implementation must be careful not to overwrite in-memory user edits with a stale reload. The correct implementation:
- Track a `isDirty` flag per `$ref` subtree
- When a file change arrives and `isDirty` is true (user has made edits), surface an "Info" toast rather than silently overriding
- When `isDirty` is false, reload silently

---

## Build Order Analysis

### Component dependency graph

```
packages/core          → standalone, no local deps
  └── schema.ts        → needed by everything
  └── mutations.ts     → needed by desktop/webview store
  └── adapters/        → needed by desktop/bun

packages/react         → depends on core (types + schema)
  └── RoadmapTree.tsx  → needs RoadmapNode type
  └── ThemeProvider    → needs theme token types

packages/desktop       → depends on core + react
  └── bun/index.ts     → entry point (must compile last)
  └── webview/index.tsx → bundles React components

plugins/*              → depends on core (IntegrationEvent type)
  └── built at same time as desktop
```

### Phase-to-build mapping

**Scaffold phase:** Establish the full workspace. `packages/core` must have its `package.json`, `tsconfig.json`, and an empty `src/index.ts` before any other package tries to import from it. Even if `core` contains no logic yet, the module must resolve. Attempting to build `packages/react` or `packages/desktop` with an unresolved workspace dependency causes cryptic module-not-found errors that waste time.

**Step 1 (Themes):** The theme token types must live in `packages/core/src/theme.ts` from day one, even if it is just `export type ThemeTokens = Record<string, string>`. The `ThemeProvider` in `packages/react` will import this.

**Step 2 (Read-only viewer):** `packages/core/src/schema.ts` (Zod) and `packages/core/src/parser.ts` must be complete and tested before webview rendering begins. The Zod schema is the contract. Writing parser tests before implementation is the TDD gate here.

**Step 3 (Editor):** `packages/core/src/mutations.ts` must be pure functions — no side effects, no RPC calls, no file system. This makes them trivially testable. The webview store calls mutations on its in-memory copy of the schema; the Bun process only sees the result when `saveFile` is called. This separation is critical for testability.

**Step 4 (Plugin system):** The `RoadmapPlugin` interface in `packages/core/src/plugin.ts` must be finalised in the Step 3 scaffold (the spec already calls this out). The plugin host (`desktop/src/bun/plugins/`) can then be built against a stable contract. Do not implement the plugin host until the interface is locked.

---

## Architectural Risks

### Risk 1: Plugin side-panel component handoff (HIGH)

**What:** The spec's `sidePanel.component: string` implies a plugin can register a React component by name. This is architecturally broken — plugins run in Bun and cannot reach the webview's React tree.

**Consequence:** If this is implemented literally, it will require a dynamic component loader, an eval-equivalent, or a sandboxed iframe — all of which are significant scope and security concerns.

**Prevention:** Use the Option A pattern described in the Plugin System section above. Plugins emit serialisable state; the webview renders it generically. This is the right MVP design.

### Risk 2: Nested JSON mutation + performance (MEDIUM)

**What:** The spec uses a nested JSON schema (children arrays). All tree mutations (add, delete, duplicate, move) must traverse the tree to find a node by ID and then splice the children array. For a tree with 300+ nodes, a naive recursive search on every mutation could cause noticeable jank, especially during rapid keyboard editing.

**Consequence:** The 30 fps performance gate could be violated not by the renderer but by the mutation layer.

**Prevention:** Build `packages/core/src/mutations.ts` with a node index: a flat `Map<string, RoadmapNode>` derived from the schema at load time and kept in sync with mutations. Mutations operate via the index (O(1) lookup), then reconstruct the nested structure for the webview. This is a known pattern for nested-tree editors.

Alternatively: keep the nested structure as the source of truth but memoize the traversal. The index approach is cleaner for a library.

### Risk 3: `saveFile` payload size over RPC (MEDIUM)

**What:** `saveFile` sends the entire `RoadmapSchema` as a request payload over the Bun↔webview IPC channel. For schemas with large `notes` fields (markdown content) and many nodes, this payload could be several hundred KB on every debounced save.

**Consequence:** IPC serialisation overhead adds latency to every save. The 5000 ms default timeout could be hit for very large schemas.

**Prevention:** Set `maxRequestTime` to 15000 ms for `saveFile`. Consider sending only a diff (changed node IDs + their new data) rather than the full schema. However, the diff approach complicates the Bun-side write logic — for MVP, send the full schema with a generous timeout. Profile before optimising.

### Risk 4: `fs.watch` on Linux — inotify limits (MEDIUM)

**What:** The file watcher adapter + `$ref` resolver + integration adapters all use `fs.watch`. Large roadmaps with many `$ref` files and many `file` transport subscriptions can exhaust the default inotify watch limit.

**Consequence:** File change notifications silently stop arriving. Users see stale tree data and cannot tell why.

**Prevention:** Share a single watcher registry. Deduplicate paths. Document the system limit. Provide a CLI flag to increase it (`--max-watchers`). Test with 50+ watched files before shipping.

### Risk 5: Context menus not available on Linux (HIGH for Linux users)

**What:** Electrobun confirmed: `ContextMenu.showContextMenu()` is not supported on Linux. The spec's right-click context menu (US-03) and the full editing keyboard/context-menu suite depend on this API.

**Consequence:** Linux users cannot right-click to access editing operations.

**Prevention:** All context menu operations must also be reachable via keyboard shortcuts. The spec already mandates this (`§8.1`, `§8.2`). On Linux, implement a custom webview-rendered context menu (a positioned `<div>` on `contextmenu` event) as a fallback. This is more work than expected — plan for it in Phase 3 (Editor).

### Risk 6: ASAR and plugin file paths (LOW for MVP, MEDIUM for v1.1)

**What:** Electrobun supports ASAR packaging (`useAsar`). Plugin files loaded from a `plugins/` directory next to the binary will not be inside the ASAR archive. Path resolution after packaging is different from development.

**Consequence:** Dynamic plugin loading (v1.1) will fail silently if plugin paths are resolved relative to the source directory rather than the binary location.

**Prevention:** Not a v1 concern (built-in plugins are statically imported). Flag for v1.1: always use `process.execPath` to derive the plugins directory path, not `__dirname` or `import.meta.dir`.

### Risk 7: React 18 concurrent mode + react-d3-tree (LOW)

**What:** react-d3-tree uses D3 for layout computation. D3 manipulates the DOM imperatively, which conflicts with React's virtual DOM model. In React 18 concurrent mode, a D3 layout update during a concurrent render could cause tearing.

**Consequence:** Visual glitches or incorrect node positions during rapid status updates.

**Prevention:** The `renderCustomNodeElement` API in react-d3-tree keeps React in control of node rendering while D3 handles layout. Use this API (not D3 direct DOM manipulation) for all custom node rendering. The spec already specifies this approach. The performance gate benchmark (300 nodes, 10 updates/sec) will surface any issues before Phase 2 ships.

---

## Sources

- Electrobun official API reference (llms.txt): https://blackboard.sh/electrobun/llms.txt — HIGH confidence
- Bun workspaces documentation: https://bun.sh/docs/install/workspaces — HIGH confidence
- Bun TypeScript documentation: https://bun.sh/docs/runtime/typescript — HIGH confidence
- Electrobun lifecycle event documentation (from llms.txt): `before-quit` Linux caveat — HIGH confidence
- SPEC.md §5 Architecture, §6 Event flows — authoritative project spec
- ARCHITECTURE.md — existing project reference
- MQTT + Bun community compatibility: MEDIUM confidence (no official documentation; based on `mqtt` npm package compatibility with Bun's Node.js compatibility layer)
