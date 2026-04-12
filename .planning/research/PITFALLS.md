# Pitfalls Research

**Project:** Roadmap Viewer
**Researched:** 2026-04-12
**Confidence:** HIGH — most findings verified directly from installed source code and official Electrobun llms.txt

---

## Summary

Eight risk areas were investigated. The most dangerous pitfalls cluster around three themes: (1) react-d3-tree deep-clones the entire tree on every data reference change, making naive Zustand integration catastrophically expensive at 300+ nodes with live updates; (2) Electrobun is a niche framework with several undocumented Linux-specific sharp edges that will surface during packaging; (3) the monorepo publishing setup requires deliberate peer-dep and bundling decisions that are easy to get wrong and expensive to fix after packages are published. The remaining areas (WebSocket lifecycle, atomic writes, floating input, Playwright, plugin creep) have clear, established mitigations that need to be followed but are unlikely to cause rewrites.

---

## Critical Pitfalls
(Will definitely cause problems if ignored)

| Pitfall | Warning Signs | Prevention | Phase |
|---------|--------------|------------|-------|
| react-d3-tree full-tree deep clone on every update | FPS drops to <5 at 50+ nodes under live updates; profiler shows `clone()` dominating | Use `dataKey` prop for surgical updates; never mutate the data object reference on every tick | Step 2 performance gate |
| Zustand store passes new object reference to Tree on every `updateNode` | Tree re-renders fully even for single-node badge change | Keep `schema` in Zustand; derive a stable `treeData` selector that only changes object reference when structure changes, not when a node's status field changes | Step 2 / Step 3 |
| Electrobun Updater API typo in source | App crashes at startup in dev with "localInfo is undefined" or channel check fails silently | `Updater.localInfo.channel()` is the correct async call (NOT `Updater.getLocalInfo()`). The underlying function is `getLocallocalInfo` (double "local" — a typo in Electrobun 1.16.0 source). Never call `getLocallocalInfo` directly; use the `localInfo.*` accessor facade instead | Prerequisite / Step 5 |
| Linux: `bundleCEF: false` in electrobun.config.ts | App boots on macOS/Windows but WebKitGTK renders incorrectly or crashes on Ubuntu; context menus silently absent | Set `bundleCEF: true` for all three platforms in the config by Step 1. Current scaffold has it `false`. Do not defer this to packaging phase | Prerequisite |
| Updater reads `version.json` which does not exist in dev builds | App crashes on first run in any channel except "dev" during development | Wrap `Updater.localInfo.channel()` call in try/catch; treat missing `version.json` as channel `"dev"` | Prerequisite |

---

## Common Mistakes
(Often get teams into trouble)

| Mistake | Why It Happens | How to Avoid |
|---------|---------------|-------------|
| Passing entire `schema` object as react-d3-tree `data` prop directly | Obvious starting point; works fine at 20 nodes | Maintain a separate `treeData` derived value; use `useMemo` with deep equality check or a stable selector. Only change the reference when tree structure (add/remove/move) changes, not when node metadata changes |
| Forgetting `dataKey` prop when programmatically updating nodes | Library is a class component; object reference change triggers full clone + re-layout | Set `dataKey` to a stable tree-structure version counter; increment it only on structural changes (add/delete/move), not on status badge updates |
| WebSocket reconnect loop on app suspend/resume | All platforms: system sleeps kill TCP connections; no reconnect logic = stale connection forever | Use exponential backoff with jitter (start 1s, max 30s). Track connection state explicitly. Reset the timer on each successful message, not just on `open` |
| MQTT client not destroyed on plugin unload | Memory leak; second plugin load opens second connection to broker | `plugin.disconnect()` must call `client.end(true)` (force-close). Electrobun has no automatic cleanup on process messages — the plugin host must call `disconnect()` before replacing a plugin instance |
| Atomic write race on Windows: rename over existing file | On Windows, `rename(src, dest)` over an existing file succeeds but can collide with another write in-flight | Use Bun's `Bun.write()` with a UUID `.tmp` suffix, then `renameSync`. On Windows add a retry loop (3 attempts, 50ms apart) around the rename only |
| Inline floating `<input>` positioned with `getBoundingClientRect` | SVG zoom/pan transforms the node's visual position but `getBoundingClientRect` returns CSS layout position | After positioning, apply the inverse of the current D3 zoom transform to the input's position. Subscribe to zoom events and reposition on each zoom/pan frame |
| `ApplicationMenu` used as primary action surface on Linux | Menu bar is suppressed on Linux; actions are unreachable | All file/export/settings actions must have keyboard shortcuts AND toolbar buttons. Treat `ApplicationMenu` as a progressive enhancement, not the primary path |
| Publishing `@roadmap-viewer/react` with react bundled | Consumers get two React instances; hooks throw; tree state is inconsistent | Mark `react`, `react-dom`, `react-d3-tree` as `peerDependencies` in `packages/react/package.json`. Configure Vite library mode to externalize all peer deps |
| `packages/core` importing from `packages/react` | Creates a circular dep that npm will silently allow but Vite will fail to bundle | Enforce the rule in CI: `core` has zero imports from `react`; `react` may import from `core` only |

---

## Electrobun-Specific Gotchas
(Framework-specific surprises — all verified from Electrobun 1.16.0 source and llms.txt)

### Process isolation is absolute
There is no equivalent of Electron's `contextBridge` that lets the webview call Node/Bun directly. Every filesystem operation, every network call, every plugin event flows through the typed RPC contract. If you forget this during prototyping and call `fetch()` from the webview for plugin connections, it will work in dev (CEF has network access) but violate the architecture — and plugin results will never reach the Bun process event log. Always put transport adapters in the Bun process.

### RPC has a 5-second timeout by default
Long-running operations (large file loads, PNG capture, plugin handshakes) must either: (a) return quickly and stream progress via fire-and-forget messages, or (b) raise `maxRequestTime` in the RPC config. A 300-node schema can take >500ms to Zod-validate on a slow machine — this should be a message pattern, not a request/response.

### `executeJavascript()` is fire-and-forget with no return
If you need to call webview-side JS from Bun and read the result, use `evaluateJavascriptWithResponse()` on a `BrowserView`. `executeJavascript()` will silently discard its return value. This matters for PNG export: the webview captures the canvas and must send the blob back via an RPC message, not a return value.

### Context menus are not available on Linux
`ContextMenu` from `electrobun/bun` does nothing on Linux. All right-click actions must have keyboard equivalents. The spec already addresses this, but it must be verified in CI on a Linux runner — not just on macOS.

### `before-quit` may not fire on Linux system-initiated quits
If the OS or a process manager kills the app (SIGTERM, session logout), the `before-quit` handler may not run on Linux. The 30-second periodic autosave is the safety net. The debounced 2s write must not be the only write path.

### CEF vs. WebKit CSS compatibility gap
With `bundleCEF: true`, the renderer on all platforms is CEF (Chromium). Without it, macOS uses WebKit and Linux uses WebKitGTK. CSS features like container queries and some SVG filters behave differently across engines. If development happens on macOS with `bundleCEF: false`, visual regressions can appear on Linux. Standardize on CEF for all platforms before Step 1 UI work begins.

### `titleBarStyle: "hidden"` requires custom drag regions
The CSS property is `electrobun-webkit-app-region-drag`, not `-webkit-app-region`. The toolbar area needs this class or the window will be unmovable. This is documented in llms.txt but easy to miss when copy-pasting from Electron examples.

### Updater API — `getLocallocalInfo` internal typo
Electrobun 1.16.0 source has `getLocallocalInfo` (not `getLocalInfo`). The public facade `Updater.localInfo.channel()` wraps this correctly. Do not call `getLocallocalInfo` directly — it is not part of the public API and will break on any future fix to the typo. Do not use the memory's proposed fix of `Updater.getLocalInfo()` — that function does not exist and will throw immediately.

### `BuildConfig.getCached()` returns null until `BuildConfig.get()` is called
Any code that checks build config at module load time (before `BuildConfig.get()` has been called in the main process entry point) will get null. Ensure `BuildConfig.get()` is called before any plugin or RPC setup that reads config values.

### `setPageZoom()` only works on macOS/WebKit
If you want to implement app-level zoom, it is macOS-only via Electrobun. On Linux/Windows, zoom must be done via CSS transforms or the D3 zoom handler. Do not wire `setPageZoom()` as the primary zoom path.

---

## Performance Landmines
(Things that look fine but blow up at scale)

### react-d3-tree clones the entire tree on every `data` prop reference change

Verified from source: `getDerivedStateFromProps` calls `clone(nextProps.data)` (deep clone via the `clone` npm package) plus `assignInternalProperties` (recursive walk assigning new UUIDs) whenever the `data` object reference changes AND `dataKey` is absent or changed.

At 300 nodes, this is ~600 object allocations plus UUID generation on every update. At 10 updates/second this is 6,000 allocations/second. On a mid-range machine this will push GC pressure past the 30fps budget.

**Mitigation pattern:**
```typescript
// BAD: every updateNode() call in Zustand creates a new schema reference → full clone
store.updateNode(id, { status: 'done' })
// → new schema object → Tree re-renders fully

// GOOD: use dataKey to tell the tree "structure hasn't changed, only metadata"
const [structureVersion, setStructureVersion] = useState(0)

// Only increment structureVersion on add/delete/move; not on status updates
// Pass dataKey={structureVersion} to <Tree>
// For status-only updates, update node data in-place within the existing reference
// (clone once at edit start, not on every status tick)
```

The `dataKey` prop gates the full clone: if `dataKey` hasn't changed, tree skips the clone even if `data` reference changed. Use this for the performance gate in Step 2.

### SVG with 300+ nodes and `enableLegacyTransitions`

`enableLegacyTransitions` wraps every node in a CSS transition group, adding a 500ms animation lock per collapse/expand. At scale this serializes interactions. Disable it explicitly: `enableLegacyTransitions={false}`.

### Zustand subscription granularity

Zustand subscriptions that return the whole `schema` object will cause the Tree component to re-render on every keystroke in the markdown editor (because `updateNode` creates a new schema reference). Use `useShallow` or selector functions that return stable references for the tree data vs. the side panel data.

### MQTT / WebSocket message bursts

If a CI system emits 50 status updates in 100ms (e.g. parallel jobs completing), and each update calls `store.updateNode()` synchronously, React will batch some but not all of these in React 19. Accumulate updates in a buffer on the Bun side (100ms debounce window) and send batched `nodeStatusUpdates: Array<{id, status}>` messages to the webview rather than one RPC message per event.

### PNG export with html2canvas at 2x

html2canvas walks the entire DOM and re-fetches all stylesheets and images. At 300+ nodes this can take 5–10 seconds. The RPC request will time out at the default 5 seconds. Either: raise `maxRequestTime` for the `exportPng` RPC call, or restructure export to use a fire-and-forget message and a separate "export complete" callback.

### File watcher on large schemas with `$ref` files

Each `$ref` file change triggers a full re-parse of the root schema (to resolve all refs). If a user has 10 `$ref` files and saves one, the watcher fires once per file. Debounce file watcher events with a 300ms window before triggering re-parse.

---

## Testing Challenges

### Playwright with Electrobun (not Chromium)

Playwright's standard `chromium` browser target does not connect to an Electrobun app. Electrobun exposes no remote debugging port by default. The established approach for E2E testing is:

1. Use Playwright's `electron` launch target pointed at the Bun process (Playwright has Electron-specific hooks that are partially compatible with Bun-launched apps — verify this works before committing to it).
2. Alternatively: route around the native window entirely by running the webview in a standard Vite dev server for Playwright tests (`http://localhost:5173`) and mock the RPC layer. This tests 95% of behavior without needing to launch Electrobun at all.
3. For true end-to-end (including file I/O and RPC): use Playwright's `cdpSession` to connect to the CEF devtools port if Electrobun exposes one, or write integration tests as Bun scripts that invoke the RPC contract directly.

**Recommendation:** Design tests in two tiers from the start: (a) Playwright against the Vite dev server with a mock RPC client for UI behavior; (b) Bun-native integration tests for the Bun process logic (file I/O, validation, plugin lifecycle). Do not attempt to drive the full Electrobun native app via Playwright until the framework's testing story matures.

### Vitest + jsdom + SVG

react-d3-tree uses D3 zoom/selection which calls `document.createElementNS` and expects a real SVG DOM. jsdom's SVG support is incomplete — `getBoundingClientRect` returns `{0,0,0,0}` for all SVG elements. Tests that exercise tree rendering will need:
- `happy-dom` instead of `jsdom` (better SVG support), or
- Component tests that mock react-d3-tree and only test the wrapping logic, or
- Visual regression tests via Playwright (webview tier) for layout assertions

### Mocking the RPC boundary in unit tests

The webview imports `Electroview` from `electrobun/view` and calls `rpc.bun.request(...)`. In Vitest (jsdom/happy-dom), `electrobun/view` will fail to import because it depends on native bindings. Create a `__mocks__/electrobun` directory with a mock `view.ts` that exports a no-op `Electroview` and a configurable mock RPC client. This mock must be in place before any webview component test can run.

### TDD sequence dependency

The spec mandates TDD-first: acceptance tests written before implementation. For Electrobun specifically, the acceptance test for "window launches" (the Prerequisite step) requires knowing the Playwright strategy before writing a single line of app code. This needs to be resolved in the Prerequisite phase, not deferred to Step 2.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Prerequisite: electrobun.config.ts | `bundleCEF: false` is the current default; Linux will regress | Set `bundleCEF: true` immediately, even in dev |
| Prerequisite: Updater API | `version.json` absent in dev → crash at startup | Wrap in try/catch; default to `"dev"` channel |
| Prerequisite: Playwright | No established Electrobun + Playwright pattern | Decide testing strategy (Vite mock tier vs. native) before writing first test |
| Step 1: Theme system | CEF vs. WebKit CSS differences | Develop with CEF on all platforms from day one |
| Step 2: Performance gate | react-d3-tree deep clone on every update | Implement `dataKey` pattern before writing the live update path |
| Step 2: Floating rename input | `getBoundingClientRect` ignores D3 transform | Apply inverse zoom transform to input position |
| Step 3: Atomic write on Windows | `rename` over existing file contention | Retry loop around rename on Windows; use UUID tmp filenames |
| Step 4: Plugin system | Plugin unload without cleanup → leaked connections | `disconnect()` contract must be enforced by plugin host, not assumed |
| Step 4: WebSocket/MQTT burst handling | 50 simultaneous updates → GC pressure → dropped frames | Buffer and batch on Bun side before sending to webview |
| Step 5: npm publishing | `react` bundled into `@roadmap-viewer/react` | External peer deps in Vite lib mode from the start |
| Step 5: Monorepo circular deps | `core` accidentally imports `react` components | Enforce in CI with a package boundary lint rule |
| Step 5: PNG export timeout | html2canvas at 2x on 300 nodes → >5s → RPC timeout | Raise `maxRequestTime` for exportPng or switch to message pattern |

---

## Sources

- Electrobun 1.16.0 source: `node_modules/electrobun/dist/api/bun/core/Updater.ts` (verified directly)
- Electrobun API reference: https://blackboard.sh/electrobun/llms.txt (fetched 2026-04-12)
- react-d3-tree 3.6.6 source: `node_modules/react-d3-tree/lib/cjs/Tree/index.js` (verified directly — `clone()` call in `getDerivedStateFromProps`, `dataKey` gating logic)
- Project architecture: `.planning/ARCHITECTURE.md`
- Project spec: `.planning/SPEC.md` (v0.3)
- Known Updater bug: `.claude/projects/memory/project_updater_bug.md`
