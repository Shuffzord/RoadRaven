# Phase 2: Read-Only Viewer - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-15
**Phase:** 02-read-only-viewer
**Areas discussed:** Schema & data model, Tree rendering & layout, Side panel & welcome screen, Performance gate approach, Phasing/splitting

---

## Schema & Data Model

### Zod Schema Location

| Option | Description | Selected |
|--------|-------------|----------|
| Zod in @roadraven/core | Full Zod schemas in packages/core/src/schema.ts. shared/types.ts imports inferred types. | ✓ |
| Zod in shared/types.ts | Keep schema definitions alongside RPC contract. Simpler but couples to desktop layer. | |
| You decide | Claude picks based on monorepo structure. | |

**User's choice:** Zod in @roadraven/core
**Notes:** None

### Zustand Store Shape

| Option | Description | Selected |
|--------|-------------|----------|
| Single roadmapStore | One store: schema data, selected node, layout, collapse state, viewport. themeStore separate. | ✓ |
| Multiple fine-grained stores | Separate stores for document data, UI state, and viewport. | |
| You decide | Claude designs based on dataKey constraint. | |

**User's choice:** Single roadmapStore
**Notes:** None

### $ref Resolution Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Resolve at load, inline into tree | All $ref files read upfront, merged into one tree. Each ref file watched. | ✓ |
| Lazy resolve on expand | $ref subtrees load on-demand when expanded. | |
| You decide | Claude picks based on constraints. | |

**User's choice:** Resolve at load, inline into tree
**Notes:** User asked for detailed explanation of what $ref resolution implies. After explanation of both approaches, chose upfront resolution given local file I/O speed.

---

## Tree Rendering & Layout

### react-d3-tree Integration

| Option | Description | Selected |
|--------|-------------|----------|
| Replace Canvas internals | Canvas becomes wrapper around react-d3-tree <Tree>. Custom node rendering reuses RoadmapNodeCard styling. | ✓ |
| Overlay d3 on Canvas | Keep Canvas structure, overlay react-d3-tree SVG. | |
| You decide | Claude picks cleanest approach. | |

**User's choice:** Replace Canvas internals
**Notes:** None

### Default Layout

| Option | Description | Selected |
|--------|-------------|----------|
| Top-to-Bottom (TB) | Root at top, children flow down. Natural for roadmap hierarchies. | ✓ |
| Left-to-Right (LR) | Root at left, children flow right. Better horizontal space usage. | |
| You decide | Claude picks based on design reference. | |

**User's choice:** Top-to-Bottom (TB)
**Notes:** None

### Zoom/Pan Controls

| Option | Description | Selected |
|--------|-------------|----------|
| Core controls only | Scroll wheel, pinch, click-drag, fit-to-view. No toolbar or minimap. | ✓ |
| Core + zoom toolbar | Add floating +/- toolbar with fit-to-view button. | |
| You decide | Claude picks minimal set. | |

**User's choice:** Core controls only
**Notes:** User specified: "Core controls for now - but add stubs for future improvements (some exist)"

---

## Side Panel & Welcome Screen

### Markdown Rendering

| Option | Description | Selected |
|--------|-------------|----------|
| remark/rehype pipeline | remark (md -> AST) + rehype (AST -> HTML). Supports GFM. Themed with --rv-* tokens. | ✓ |
| Simple marked/DOMPurify | Lighter weight. Less extensible but fewer dependencies. | |
| You decide | Claude picks based on bundle size and Phase 3 needs. | |

**User's choice:** remark/rehype pipeline
**Notes:** None

### Welcome Screen

| Option | Description | Selected |
|--------|-------------|----------|
| Centered hero with actions | Logo, app name, Open/New buttons, recent files, sample schema links. Minimal. | ✓ |
| Split layout with tips | Actions left, getting started tips right. More informative but busier. | |
| You decide | Claude designs based on design reference. | |

**User's choice:** Centered hero with actions
**Notes:** None

---

## Performance Gate

### Benchmark Approach

| Option | Description | Selected |
|--------|-------------|----------|
| Vitest benchmark + manual | Vitest generates 300+ nodes, fires updates, asserts p95 frame time. Manual Playwright supplement. | ✓ |
| Playwright-only benchmark | Full browser benchmark. More realistic but slower and CI-dependent. | |
| You decide | Claude designs balanced approach. | |

**User's choice:** Vitest benchmark + manual
**Notes:** None

### File Watcher

| Option | Description | Selected |
|--------|-------------|----------|
| Bun fs.watch + RPC notify | Main process watches files, re-reads on change, pushes via RPC. 500ms debounce. | ✓ |
| Polling fallback | Poll mtime every 2s. More reliable on network drives. | |
| You decide | Claude picks based on platform support. | |

**User's choice:** Bun fs.watch + RPC notify
**Notes:** None

---

## Phasing & Splitting

### Phase Scope Management

| Option | Description | Selected |
|--------|-------------|----------|
| One phase + mid-phase verify | Keep Phase 2 as-is. Verify after Plan 2 (tree renderer) before continuing. | ✓ |
| Split into 2a + 2b in roadmap | Formally split. Separate GSD cycles per sub-phase. | |
| One phase, no checkpoints | Execute all 4 plans straight through. | |

**User's choice:** One phase + mid-phase verify
**Notes:** User asked how GSD handles splits. After explanation of flow disruption per option, chose the pragmatic middle ground.

### Verification Checkpoint Location

| Option | Description | Selected |
|--------|-------------|----------|
| After Plan 2 (tree renderer) | Verify tree renders from JSON, layout toggle, collapse/expand, zoom/pan, badges. | ✓ |
| After Plan 1 (schema + store) | Verify data foundation before rendering. | |
| You decide | Claude picks natural breakpoint. | |

**User's choice:** After Plan 2 (tree renderer)
**Notes:** None

---

## Claude's Discretion

- Zod schema structure details
- react-d3-tree configuration (node separation, path function)
- Connector styling
- remark/rehype plugin selection
- Welcome screen exact layout
- Benchmark schema generator
- dataKey increment strategy
- File watcher error handling
- Schema validation error panel design

## Deferred Ideas

None — discussion stayed within phase scope.
