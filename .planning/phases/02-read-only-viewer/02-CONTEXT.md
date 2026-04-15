# Phase 2: Read-Only Viewer - Context

**Gathered:** 2026-04-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Any valid JSON schema renders as a fully interactive, read-only tree with correct status badges, file watching, side panel with markdown notes, and a validated 30 fps performance gate. The viewer is read-only — no editing capabilities.

This phase delivers VIEW-01 through VIEW-14 across 4 plans, with a mid-phase verification checkpoint after Plan 2 (tree renderer).

</domain>

<decisions>
## Implementation Decisions

### Schema & Data Model
- **D-01:** Zod schemas defined in `packages/core/src/schema.ts` (`@roadraven/core`). `shared/types.ts` imports inferred types via `z.infer<>`. Core package is the single source of truth for data shape. Placeholder types in `shared/types.ts` are replaced with re-exports from `@roadraven/core`.
- **D-02:** Single `roadmapStore` Zustand store holds: loaded schema data, selected node ID, layout preference (TB/LR), collapse state, viewport (zoom/pan). `themeStore` remains separate. Clean separation: `roadmapStore` = document state, `themeStore` = app appearance.
- **D-03:** `$ref` nodes resolved at load time — all referenced files read upfront and merged into one unified tree in memory. Each referenced file gets its own file watcher. User does not see `$ref` boundaries in read-only mode. (Phase 3 will track file ownership for write-back.)

### Tree Rendering & Layout
- **D-04:** Canvas component internals replaced with react-d3-tree's `<Tree>` component. Static placeholder `RoadmapNodeCard` nodes and SVG connector paths removed. react-d3-tree handles all node positioning, connectors, and zoom/pan. Custom node rendering via `renderCustomNodeElement` reuses existing `RoadmapNodeCard` styling. Dot-grid background and watermark preserved via CSS on the wrapper div.
- **D-05:** Default layout is **Top-to-Bottom (TB)** for new files. Layout preference persisted per file in `.roadmap-settings.json`.
- **D-06:** Zoom/pan controls: scroll wheel zoom, pinch zoom (trackpad), click-drag pan, plus a "Fit to view" reset. Core controls only for now — stubs for future toolbar/minimap improvements. All built into react-d3-tree.

### Side Panel & Welcome Screen
- **D-07:** Markdown notes rendered via **remark/rehype pipeline** (remark for markdown-to-AST, rehype for AST-to-HTML). Supports GFM (tables, task lists, strikethrough). Rendered HTML styled with `--rv-*` tokens.
- **D-08:** Welcome screen: **centered hero with actions** — RoadRaven logo (reuse existing watermark asset), app name, "Open File" button, "New Roadmap" button, recent files list (last 10), and links to bundled sample schemas (`hello-world.json`, `getting-started.json`). Clean and minimal.

### Performance Gate
- **D-09:** Benchmark approach: **Vitest benchmark + manual Playwright smoke test**. Vitest test generates a 300+ node schema, mounts the tree, fires 10 `updateNode()` calls/sec for 5 seconds, asserts p95 frame time <= 33ms. Supplemented by manual Playwright test opening the benchmark schema in the real app. CI runs the Vitest benchmark; manual Playwright run before shipping.
- **D-10:** File watcher: **Bun `fs.watch()` + RPC notify**. Main process watches loaded file and each `$ref` file. On change, re-reads and validates, pushes `pushFileChanged` message to webview via existing RPC contract. Webview reloads store data. 500ms debounce to avoid thrashing on rapid saves.

### Phasing & Verification
- **D-11:** Phase 2 stays as **one phase with 4 plans** (no roadmap split). Mid-phase verification checkpoint after Plan 2 (tree renderer). At that point, verify: tree renders from JSON, layout toggle works, collapse/expand works, zoom/pan works, status badges display correctly. Only after verification passes do Plans 3-4 (side panel + performance gate) proceed.
- **D-12:** Plan ordering follows ROADMAP.md: (1) Schema + Zustand store, (2) Tree renderer, (3) Side panel + welcome screen, (4) Performance gate. Each plan has atomic commits per task.

### Claude's Discretion
- Exact Zod schema structure (field names, nesting, validators) — guided by existing placeholder types
- react-d3-tree configuration: node separation, sibling separation, path function (step vs diagonal vs elbow)
- Connector styling (solid, dashed, animated — building on Phase 1 animated line pattern)
- remark/rehype plugin selection and configuration
- Welcome screen exact layout and styling (follows variant-c-merged.html design language)
- Benchmark schema generator implementation details
- `dataKey` increment strategy (which mutations trigger increment vs in-place update)
- File watcher error handling (permission denied, file deleted, etc.)
- Schema validation error panel design and placement

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 2 Requirements
- `.planning/REQUIREMENTS.md` §Read-Only Viewer (VIEW-01 through VIEW-14) — full acceptance criteria for each viewer requirement

### Design Reference
- `.planning/design/variant-c-merged.html` — canonical design reference (layout, color, interactions)

### Architecture & Data Model
- `.planning/PROJECT.md` §Architecture — two-process model, RPC contract, react-d3-tree performance notes, dataKey pattern
- `.planning/PROJECT.md` §Context — Zustand store shape guidance, `$ref` behavior, save behavior

### Prior Phase Context
- `.planning/phases/00-app-scaffold/00-CONTEXT.md` — monorepo structure, `@roadraven/` scope, Biome, shared/types.ts location
- `.planning/phases/01-visual-foundation-themes/01-CONTEXT.md` — Tailwind v4, `--rv-*` tokens, ThemeProvider, LogTape logging, themeStore

### RPC Contract
- `shared/types.ts` — existing RPC contract with `loadFile`, `resolveRef`, `pushFileChanged`, `loadSettings`, `saveSettings` already defined

### Electrobun
- Electrobun LLM API reference: https://blackboard.sh/electrobun/llms.txt

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `RoadmapNodeCard` (`components/RoadmapNode.tsx`): Status badge component with `STATUS_TOKEN_MAP` for theme-aware status colors. Reuse styling in react-d3-tree custom node renderer.
- `SidePanel` (`components/SidePanel.tsx`): Full skeleton with Status, Type, Created/Updated, ID (with copy button), and Notes fields. Evolve into data-driven read-only panel.
- `Canvas` (`components/Canvas.tsx`): Dot-grid background and watermark logo. Replace internals with react-d3-tree but preserve background CSS.
- `themeStore.ts`: Zustand theme state management with RPC persistence. Pattern to follow for `roadmapStore`.
- `rpc.ts`: Electroview RPC client setup. Used by stores for Bun communication.

### Established Patterns
- Zustand stores with RPC persistence (themeStore pattern)
- `--rv-*` CSS custom property tokens for all colors
- `data-theme` attribute switching for theme changes
- LogTape structured logging with categories

### Integration Points
- `shared/types.ts` — RPC contract already defines `loadFile`, `saveFile`, `resolveRef`, `pushFileChanged`, `loadSettings`, `saveSettings`
- `packages/core/src/` — empty except for plugin interface; Zod schemas go here
- `.roadmap-settings.json` — already used for theme preference; will extend for layout preference and recent files

### What Does NOT Exist Yet
- No Zod dependency in `@roadraven/core`
- No react-d3-tree dependency
- No remark/rehype dependencies
- No `roadmapStore` (Zustand store for document state)
- No file watcher in Bun main process
- No welcome screen component
- No sample schemas (`hello-world.json`, `getting-started.json`)

</code_context>

<specifics>
## Specific Ideas

- Core zoom/pan controls only for now, but leave stubs for future toolbar and minimap improvements (some UI stubs already exist in the Phase 1 shell components).
- Mid-phase verification after Plan 2 is a natural breakpoint — the tree must render correctly before building side panel features on top of it.
- The `dataKey` pattern from PROJECT.md is critical: only increment on structural changes (add/delete/move), never on status-only updates. This must be designed into the store from the start.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 02-read-only-viewer*
*Context gathered: 2026-04-15*
