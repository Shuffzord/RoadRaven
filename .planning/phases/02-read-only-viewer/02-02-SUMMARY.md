---
phase: 02-read-only-viewer
plan: 02
subsystem: ui, rpc
tags: [react-d3-tree, zustand, datakey-pattern, file-watcher, foreignObject, zod-validation, electrobun-rpc]

# Dependency graph
requires:
  - phase: 02-read-only-viewer-01
    provides: Zod schemas, Zustand roadmapStore with dataKey pattern, toTreeDatum, sample schemas
provides:
  - react-d3-tree integration in Canvas.tsx with dataKey, initialDepth=3, step connectors
  - RoadmapNodeCard adapted for foreignObject rendering with onSelect, isSelected, collapse/expand
  - SchemaErrorPanel for inline Zod validation error display
  - TopBar wired (layout toggle, Open file, Fit View reset)
  - StatusBar wired to roadmapStore (file name, node count)
  - Bun loadFile handler with Zod validation, error propagation, .bak.json backup
  - Bun openFilePicker handler via Electrobun Utils.openFileDialog
  - $ref resolution at load time with per-ref file watchers
  - fileWatcher.ts with 500ms debounce, stop/stopAll lifecycle
  - ESM-safe rpcHandlers.ts using dynamic import() for pushFileChanged
affects: [02-03, 02-04]

# Tech tracking
tech-stack:
  added: []
  patterns: [react-d3-tree foreignObject custom node rendering, ResizeObserver for canvas dimensions, Zod safeParse error-to-UI pipeline, Bun file watcher with debounce, dynamic import() for ESM-safe RPC handlers, $ref resolution with recursive tree walk]

key-files:
  created:
    - packages/desktop/src/mainview/components/SchemaErrorPanel.tsx
    - packages/desktop/src/bun/fileWatcher.ts
    - packages/desktop/src/mainview/rpcHandlers.ts
    - packages/desktop/tests/unit/fileWatcher.test.ts
  modified:
    - packages/desktop/src/mainview/components/Canvas.tsx
    - packages/desktop/src/mainview/components/RoadmapNode.tsx
    - packages/desktop/src/mainview/components/TopBar.tsx
    - packages/desktop/src/mainview/components/StatusBar.tsx
    - packages/desktop/src/mainview/App.tsx
    - packages/desktop/src/mainview/store/roadmapStore.ts
    - packages/desktop/src/bun/index.ts
    - packages/desktop/src/mainview/rpc.ts
    - shared/types.ts

key-decisions:
  - "Used role=application on Canvas div instead of empty onKeyDown for a11y -- allows Escape key to deselect nodes"
  - "Used role=button with tabIndex=0 and onKeyDown on RoadmapNodeCard instead of wrapping in <button> -- card has internal collapse button that cannot nest in <button>"
  - "Used relative import path for @roadraven/core in bun/index.ts dynamic import -- workspace alias not resolved by tsc with bundler moduleResolution"
  - "Moved shared/types.ts loadFile response update to Task 1 (from Task 2 per plan) -- TopBar compile dependency required it earlier"

patterns-established:
  - "foreignObject rendering: width=240 height=100 x=-120 y=-50 centers node cards in react-d3-tree SVG coordinate space"
  - "Canvas click-to-deselect: check e.target === e.currentTarget to avoid deselecting when clicking on nodes"
  - "File watcher lifecycle: stopAllWatchers before starting new watchers on file open to prevent leaked watchers"
  - "ESM-safe RPC handler: separate rpcHandlers.ts module with async functions using dynamic import() -- avoids circular deps and require() in ESM"
  - "Zod error propagation: safeParse -> issues.map -> { path, message, code } -> SchemaErrorPanel via store"

requirements-completed: [VIEW-01, VIEW-02, VIEW-03, VIEW-04, VIEW-05, VIEW-06, VIEW-07, VIEW-08, VIEW-12]

# Metrics
duration: 11min
completed: 2026-04-15
---

# Phase 2 Plan 2: Tree Renderer + File Loading + File Watcher Summary

**react-d3-tree canvas rendering from JSON with dataKey pattern, foreignObject node cards, layout toggle, file watcher with 500ms debounce, $ref resolution, .bak.json backup, and Zod validation error panel**

## Performance

- **Duration:** 11 min
- **Started:** 2026-04-15T11:17:19Z
- **Completed:** 2026-04-15T11:29:16Z
- **Tasks:** 3 of 3 (Task 3 human verification checkpoint passed)
- **Files modified:** 13

## Accomplishments
- Canvas.tsx fully replaced with react-d3-tree Tree component using dataKey, initialDepth=3, step connectors, zoom/pan, and Fit View reset
- RoadmapNodeCard adapted for foreignObject rendering with selection ring, collapse/expand chevron, and keyboard accessibility
- Bun loadFile handler validates with Zod, creates .bak.json backup, resolves $ref nodes, starts file watchers, and propagates errors to UI
- File watcher module with 500ms debounce, clean lifecycle management, and 8 passing unit tests

## Task Commits

Each task was committed atomically:

1. **Task 1: UI components -- Canvas, RoadmapNode, TopBar, StatusBar, SchemaErrorPanel, App.tsx, roadmapStore** - `caa99d7` (feat)
2. **Task 2: Bun RPC handlers -- loadFile, openFilePicker, resolveRef, fileWatcher, rpcHandlers** - `a6677fd` (feat)
3. **Task 3: Human verification checkpoint** - PASSED (user verified tree rendering, filed fixes for connectors, chevron, fit view, RPC timeout)

## Files Created/Modified
- `packages/desktop/src/mainview/components/Canvas.tsx` - react-d3-tree Tree with dataKey, ResizeObserver, renderNode foreignObject, SchemaErrorPanel
- `packages/desktop/src/mainview/components/RoadmapNode.tsx` - Extended with onSelect, isSelected ring, collapse/expand chevron, a11y role=button
- `packages/desktop/src/mainview/components/SchemaErrorPanel.tsx` - New: inline error panel with role=alert, error rows, dismiss button
- `packages/desktop/src/mainview/components/TopBar.tsx` - Wired layout toggle, Open file via RPC, Fit View reset
- `packages/desktop/src/mainview/components/StatusBar.tsx` - Wired to roadmapStore for file name and node count
- `packages/desktop/src/mainview/App.tsx` - SidePanel driven by selectedNodeId from store
- `packages/desktop/src/mainview/store/roadmapStore.ts` - Added viewport state (translate, zoomLevel, resetView), schemaErrors, setSchemaErrors
- `packages/desktop/src/bun/index.ts` - loadFile with Zod validation + .bak.json, openFilePicker, resolveRef, $ref resolution, file watchers
- `packages/desktop/src/bun/fileWatcher.ts` - New: watchFile/stopWatching/stopAllWatchers with 500ms debounce
- `packages/desktop/src/mainview/rpc.ts` - pushFileChanged wired via dynamic import to rpcHandlers
- `packages/desktop/src/mainview/rpcHandlers.ts` - New: ESM-safe handlePushFileChanged with dynamic imports
- `shared/types.ts` - loadFile response now { data, errors? }, AppSettings extended with recentFiles and fileSettings
- `packages/desktop/tests/unit/fileWatcher.test.ts` - New: 8 tests for watcher lifecycle and debounce

## Decisions Made
- Used `role="application"` on Canvas div for a11y compliance instead of empty onKeyDown -- allows Escape key to deselect nodes
- Used `role="button"` with tabIndex/onKeyDown on RoadmapNodeCard rather than wrapping in `<button>` element -- the card has an internal collapse button that cannot nest inside a `<button>`
- Used relative import path (`../../../../packages/core/src/schema`) for dynamic import in bun/index.ts instead of `@roadraven/core` workspace alias -- tsc with `bundler` moduleResolution does not resolve workspace aliases
- Moved shared/types.ts loadFile response type update from Task 2 to Task 1 as a blocking dependency -- TopBar's handleOpenFile accesses `response.data` which requires the updated response shape to compile

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Moved loadFile response type update to Task 1**
- **Found during:** Task 1 (TopBar wiring)
- **Issue:** TopBar.tsx handleOpenFile accesses `response.data` and `response.errors` but the RPC contract type still returned bare `RoadmapSchema`
- **Fix:** Updated shared/types.ts loadFile response and AppSettings in Task 1 instead of Task 2
- **Files modified:** shared/types.ts
- **Verification:** TypeScript compilation passes, build succeeds
- **Committed in:** caa99d7 (Task 1 commit)

**2. [Rule 1 - Bug] Fixed Zod v4 issue.path type mismatch in bun/index.ts**
- **Found during:** Task 2 (loadFile handler)
- **Issue:** Zod v4 `$ZodIssue.path` is `PropertyKey[]` (includes `symbol`), not `(string | number)[]` as annotated
- **Fix:** Removed explicit type annotation, used `.map(String).join("/")` for path serialization
- **Files modified:** packages/desktop/src/bun/index.ts
- **Verification:** tsc --noEmit passes clean
- **Committed in:** a6677fd (Task 2 commit)

**3. [Rule 1 - Bug] Fixed mainWindow.webview.rpc possibly undefined**
- **Found during:** Task 2 (file watcher callback)
- **Issue:** TypeScript strict null check flagged `mainWindow.webview.rpc` as possibly undefined
- **Fix:** Added optional chaining `mainWindow.webview.rpc?.send.pushFileChanged()`
- **Files modified:** packages/desktop/src/bun/index.ts
- **Verification:** tsc --noEmit passes clean
- **Committed in:** a6677fd (Task 2 commit)

**4. [Rule 1 - Bug] Fixed Biome lint errors across all modified files**
- **Found during:** Tasks 1 and 2 (pre-commit hook)
- **Issue:** Multiple Biome lint violations: import ordering, static element interactions, empty block statements, unused params, array index keys, format inconsistencies
- **Fix:** Auto-fixed formatting; added role=application to Canvas, role=button to RoadmapNode, comments to empty RPC handler stubs, composite keys for error list
- **Files modified:** Canvas.tsx, RoadmapNode.tsx, SchemaErrorPanel.tsx, TopBar.tsx, StatusBar.tsx, roadmapStore.ts, rpc.ts
- **Verification:** `bunx @biomejs/biome check` passes clean
- **Committed in:** caa99d7 and a6677fd

---

**Total deviations:** 4 auto-fixed (3 bugs, 1 blocking)
**Impact on plan:** All auto-fixes necessary for compilation and lint compliance. No scope creep.

## Issues Encountered
None beyond the auto-fixed deviations above.

## User Setup Required
None - no external service configuration required.

## Post-Checkpoint Fixes
- **Connector lines**: Overrode `.rd3t-link` with `!important` — library injects own `<style>` tag after our CSS
- **Collapse chevron**: Status-colored badge with 12px icon and child count
- **Fit View**: Added `viewResetKey` counter forcing Tree remount on each click
- **RPC timeout**: Set `maxRequestTime: 120_000` on both Bun and webview — native file dialogs block for user duration
- **openFileDialog**: Pass `homedir()` as `startingFolder` — Electrobun crashes on `undefined`
- **loadFile errors**: Default to `[]` instead of `undefined` — avoids serialization issues

## Next Phase Readiness
- Task 3 human verification checkpoint PASSED
- Plan 02-03 (side panel + welcome screen) ready to proceed
- All data flows are wired: file open -> Zod validate -> loadSchema -> treeData -> Canvas -> react-d3-tree -> RoadmapNodeCard
- File watcher pipeline ready: fs.watch -> debounce -> RPC pushFileChanged -> rpcHandlers -> reloadSchema
- SchemaErrorPanel wired to display Zod validation errors from loadFile response

## Self-Check: PASSED

All 13 created/modified files verified present on disk. Both task commits (caa99d7, a6677fd) verified in git log. 104 unit tests passing, production build succeeds, lint clean, TypeScript clean.

---
*Phase: 02-read-only-viewer*
*Completed: 2026-04-15*
