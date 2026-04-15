---
phase: 02-read-only-viewer
plan: 01
subsystem: data-model
tags: [zod, zustand, schema-validation, react-d3-tree, datakey-pattern]

# Dependency graph
requires:
  - phase: 00-app-scaffold
    provides: monorepo structure, shared/types.ts RPC contract, packages/core package
provides:
  - Zod schemas for roadmap JSON validation (RoadmapSchemaSchema, RoadmapNodeSchema, NodeStatusSchema, StatusConfigSchema, TypeConfigSchema)
  - Inferred TypeScript types (RoadmapSchema, RoadmapNode, NodeStatus, StatusConfig, TypeConfig)
  - Zustand roadmapStore with dataKey pattern for react-d3-tree performance
  - toTreeDatum and buildNodeIndex helper functions
  - Two sample schemas (hello-world.json, getting-started.json)
  - Type re-exports in shared/types.ts replacing placeholder interfaces
affects: [02-02, 02-03, 02-04]

# Tech tracking
tech-stack:
  added: [zod@4.3.6 (to @roadraven/core)]
  patterns: [Zod v4 getter-based recursion for children, dataKey pattern (structural=increment, status=no-increment), toTreeDatum conversion (title->name, custom data in attributes), buildNodeIndex flat Map for O(1) lookups]

key-files:
  created:
    - packages/core/src/schema.ts
    - packages/desktop/src/mainview/store/roadmapStore.ts
    - samples/hello-world.json
    - samples/getting-started.json
    - packages/desktop/tests/unit/schema.test.ts
    - packages/desktop/tests/unit/store/roadmapStore.test.ts
  modified:
    - packages/core/src/index.ts
    - packages/core/package.json
    - shared/types.ts
    - bun.lock

key-decisions:
  - "Used z.record(z.string(), z.unknown()) instead of z.record(z.unknown()) for metadata field -- Zod v4 single-arg z.record treats the argument as key type, not value type"
  - "Re-exported types from shared/types.ts via import-then-export-type pattern to keep types available for RPC contract in same file"

patterns-established:
  - "Zod v4 getter recursion: use `get children() { return z.array(Schema).optional() }` for recursive schemas"
  - "dataKey pattern: loadSchema/reloadSchema increment string counter; updateNodeStatus mutates in-place with set({}) to notify subscribers without changing dataKey"
  - "toTreeDatum: map RoadmapNode to RawNodeDatum with name=title, all custom data in attributes record"

requirements-completed: [VIEW-01, VIEW-02, VIEW-03]

# Metrics
duration: 10min
completed: 2026-04-15
---

# Phase 2 Plan 1: Zod Schemas + Zustand Store + Sample Schemas Summary

**Zod v4 recursive schema validation with Zustand dataKey pattern store, type re-exports replacing shared/types.ts placeholders, and two validated sample schemas**

## Performance

- **Duration:** 10 min
- **Started:** 2026-04-15T11:02:08Z
- **Completed:** 2026-04-15T11:12:21Z
- **Tasks:** 3
- **Files modified:** 10

## Accomplishments
- Zod schemas in @roadraven/core validate roadmap JSON with recursive children via v4 getter pattern
- Zustand roadmapStore implements the critical dataKey invariant: structural changes increment, status updates do not
- Two sample schemas (hello-world: 4 nodes, getting-started: 15 nodes at 4+ depth) validate cleanly
- shared/types.ts placeholder interfaces replaced with Zod-inferred type re-exports while preserving RPC contract compatibility

## Task Commits

Each task was committed atomically:

1. **Task 1: Define Zod schemas in @roadraven/core** - `e9ef8e8` (feat)
2. **Task 2: Replace shared/types.ts placeholders + create sample schemas** - `9fe0b6b` (feat)
3. **Task 3: Create Zustand roadmapStore with dataKey pattern** - `d35d78d` (feat)

## Files Created/Modified
- `packages/core/src/schema.ts` - Zod schemas (NodeStatusSchema, RoadmapNodeSchema, RoadmapSchemaSchema, etc.) with inferred types
- `packages/core/src/index.ts` - Re-exports all schemas and types alongside existing plugin.ts exports
- `packages/core/package.json` - Added zod@4.3.6 dependency
- `shared/types.ts` - Replaced placeholder interfaces with Zod-inferred type re-exports
- `packages/desktop/src/mainview/store/roadmapStore.ts` - Zustand store with dataKey pattern, toTreeDatum, buildNodeIndex
- `samples/hello-world.json` - Minimal sample (4 nodes, all 4 statuses)
- `samples/getting-started.json` - Rich sample (15 nodes, 4 depth levels, markdown notes, metadata, timestamps)
- `packages/desktop/tests/unit/schema.test.ts` - 19 tests for schema validation + sample validation
- `packages/desktop/tests/unit/store/roadmapStore.test.ts` - 17 tests for store behavior including dataKey stability

## Decisions Made
- Used `z.record(z.string(), z.unknown())` for metadata field instead of `z.record(z.unknown())` -- Zod v4 treats single-argument `z.record()` as key-type specification, causing runtime errors when parsing actual record values
- Re-exported types from shared/types.ts via `import type ... as _Alias` then `export type = _Alias` pattern, because `export type { X } from "..."` re-exports are not available as type references later in the same file (TypeScript limitation)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed z.record(z.unknown()) runtime crash in Zod v4**
- **Found during:** Task 1 (Zod schema implementation)
- **Issue:** `z.record(z.unknown())` crashes at runtime when parsing objects with actual metadata values -- Zod v4 interprets the single argument as the key type, leaving valueType undefined
- **Fix:** Changed to `z.record(z.string(), z.unknown())` for metadata and `z.record(z.string(), z.string())` for statusColors
- **Files modified:** packages/core/src/schema.ts
- **Verification:** All 14 schema tests pass
- **Committed in:** e9ef8e8 (Task 1 commit)

**2. [Rule 1 - Bug] Fixed invalid UUID variant bytes in sample schemas**
- **Found during:** Task 2 (sample schema creation)
- **Issue:** Handcrafted UUIDs had invalid variant bytes (position 4th group must start with 8/9/a/b per RFC 4122)
- **Fix:** Changed `0e1f` to `ae1f` and `1f2a` to `8f2a` in hello-world.json
- **Files modified:** samples/hello-world.json
- **Verification:** Both sample schemas validate via safeParse
- **Committed in:** 9fe0b6b (Task 2 commit)

**3. [Rule 3 - Blocking] Fixed shared/types.ts type re-export pattern for RPC contract compatibility**
- **Found during:** Task 2 (shared/types.ts update)
- **Issue:** Direct `export type { X } from "..."` re-exports are not resolvable as type references in the same file, breaking RoadmapRPCType which uses RoadmapSchema and RoadmapNode
- **Fix:** Used import-then-export pattern: `import type { X as _X } from "..."; export type X = _X;`
- **Files modified:** shared/types.ts
- **Verification:** TypeScript pre-commit check passes, build succeeds
- **Committed in:** 9fe0b6b (Task 2 commit)

**4. [Rule 3 - Blocking] Added zod dependency to packages/core**
- **Found during:** Task 1 (schema implementation)
- **Issue:** Zod was only in packages/desktop dependencies, but schema.ts lives in packages/core
- **Fix:** Ran `bun add zod@^4.3.6` in packages/core
- **Files modified:** packages/core/package.json, bun.lock
- **Verification:** Import resolves, tests pass
- **Committed in:** e9ef8e8 (Task 1 commit)

---

**Total deviations:** 4 auto-fixed (2 bugs, 2 blocking)
**Impact on plan:** All auto-fixes necessary for correctness. No scope creep.

## Issues Encountered
None beyond the auto-fixed deviations above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Zod schemas and Zustand store are ready for Plan 02-02 (Tree Renderer) to wire react-d3-tree against roadmapStore
- toTreeDatum produces RawNodeDatum-compatible data; Plan 02-02 can pass it directly to `<Tree data={treeData} />`
- dataKey pattern is tested and ready for the `dataKey` prop on react-d3-tree
- Sample schemas available for visual testing during tree renderer development

## Self-Check: PASSED

All 8 created/modified files verified present on disk. All 3 task commits (e9ef8e8, 9fe0b6b, d35d78d) verified in git log. 95 unit tests passing, production build succeeds, lint clean.

---
*Phase: 02-read-only-viewer*
*Completed: 2026-04-15*
