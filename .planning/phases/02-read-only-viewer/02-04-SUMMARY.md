---
phase: 02-read-only-viewer
plan: 04
subsystem: testing, performance
tags: [benchmark, vitest-bench, dataKey-pattern, performance-gate, schema-generator, smoke-test]

# Dependency graph
requires:
  - phase: 02-read-only-viewer-01
    provides: roadmapStore with loadSchema, updateNodeStatus, nodeIndex, dataKey pattern
provides:
  - generateLargeSchema(N) deterministic schema generator producing N-node trees
  - collectNodeIds() for random-access node lookup during benchmarks
  - Vitest benchmark validating dataKey stability under sustained updateNodeStatus calls
  - Viewer smoke tests covering schema loading, tree shape, dataKey contract, layout, selection
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns: [vitest benchmark config in vitest.config.ts, bench() with inline contract assertion]

key-files:
  created:
    - packages/desktop/tests/bench/generateSchema.ts
    - packages/desktop/tests/bench/perf.bench.ts
    - packages/desktop/tests/unit/ui/viewer-smoke.test.tsx
  modified:
    - packages/desktop/vitest.config.ts

key-decisions:
  - "Benchmark asserts dataKey invariant inline via throw rather than separate test -- validates contract during every benchmark iteration"
  - "generateSchema uses crypto.randomUUID() for node IDs matching Zod uuid() validation -- benchmark data is schema-valid"
  - "Viewer smoke tests reset full store state in beforeEach to ensure isolation between tests"

patterns-established:
  - "Vitest benchmark config: tests/bench/**/*.bench.ts with environment node"
  - "Schema generator pattern: recursive tree builder with nodeCount cap and depth limit"

requirements-completed: [VIEW-11]

# Metrics
duration: 3min
completed: 2026-04-15
---

# Phase 2 Plan 4: Performance Gate Summary

**Vitest benchmark proving dataKey stability under 300+ node load with sustained updateNodeStatus calls, schema generator for reproducible test data, smoke tests validating store contracts**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-15T13:57:05Z
- **Completed:** 2026-04-15T14:00:36Z
- **Tasks:** 2 of 2 auto tasks complete (Task 3 checkpoint:human-verify pending)
- **Files created:** 3
- **Files modified:** 1

## Accomplishments

- generateLargeSchema(N) produces deterministic N-node tree schemas with configurable children-per-node and depth limit of 6
- collectNodeIds() walks schema tree and collects all UUIDs for random-access benchmark lookups
- Vitest benchmark config added to vitest.config.ts (tests/bench/**/*.bench.ts, environment: node)
- perf.bench.ts contains 3 benchmarks validating the critical dataKey performance contract:
  - loadSchema with 300+ nodes: ~18us/op (54,838 ops/sec)
  - updateNodeStatus x10 without dataKey increment: ~40us/op (25,189 ops/sec)
  - Sustained 50 updates (simulating 5sec at 10/sec): ~193us/op (5,178 ops/sec)
- dataKey stability confirmed: zero drift during all updateNodeStatus benchmark iterations
- viewer-smoke.test.tsx contains 7 tests covering:
  - generateLargeSchema(300) produces >= 300 nodes
  - 300-node schema loads without error, nodeIndex.size >= 300
  - treeData has react-d3-tree compatible shape (name, attributes.id, attributes.status)
  - updateNodeStatus does NOT change dataKey (performance contract)
  - reloadSchema increments dataKey
  - setLayout updates layoutOrientation
  - setSelectedNode + getSelectedNode round-trips correctly
- Full test suite: 119 tests passing across 15 test files
- Production build succeeds (vite build green)

## Benchmark Results

| Benchmark | ops/sec | mean (us) | p99 (us) | rme |
|-----------|---------|-----------|----------|-----|
| loadSchema 300+ nodes | 54,838 | 18.2 | 57.7 | +/-0.93% |
| updateNodeStatus x10 (no dataKey) | 25,189 | 39.7 | 104.3 | +/-0.76% |
| sustained 50 updates (5sec sim) | 5,178 | 193.1 | 353.4 | +/-0.86% |

All operations are sub-millisecond. The dataKey invariant holds: updateNodeStatus never triggers dataKey increment.

## Task Commits

Each task was committed atomically:

1. **Task 1: Schema generator + vitest benchmark config** - `a07caa9` (feat)
2. **Task 2: Performance benchmark + viewer smoke tests** - `fec1df9` (feat)
3. **Task 3: Manual Playwright fps verification checkpoint** - PENDING (checkpoint:human-verify)

## Pending Checkpoint

**Task 3 (checkpoint:human-verify)** requires human verification of 30+ fps rendering at 300+ nodes under zoom/pan/layout-toggle interactions. This validates the rendering layer -- the second half of D-09's performance gate. The automated benchmarks (Tasks 1-2) validate the store-layer invariant (dataKey stability).

**To verify:**
1. Run `bun run dev:hmr` to start the app
2. Load `samples/getting-started.json` via the Open button
3. Verify tree renders without visible lag
4. Rapidly resize, toggle TB/LR layout, zoom in/out -- verify smooth 30+ fps
5. Confirm: "At 300+ nodes with zoom/pan interactions, the tree renders at 30+ fps with no visible jank"

## Files Created/Modified

- `packages/desktop/tests/bench/generateSchema.ts` - New: deterministic schema generator with generateLargeSchema() and collectNodeIds()
- `packages/desktop/tests/bench/perf.bench.ts` - New: 3 Vitest benchmarks validating dataKey stability under load
- `packages/desktop/tests/unit/ui/viewer-smoke.test.tsx` - New: 7 smoke tests covering store contracts and schema loading
- `packages/desktop/vitest.config.ts` - Added benchmark config block for tests/bench/**/*.bench.ts

## Decisions Made

- Benchmark asserts dataKey invariant inline via throw rather than separate test -- validates contract during every benchmark iteration, catching regressions immediately
- generateSchema uses crypto.randomUUID() for node IDs matching Zod uuid() validation -- benchmark data is schema-valid
- Viewer smoke tests reset full store state in beforeEach to ensure test isolation

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Biome import ordering in generateSchema.ts**
- **Found during:** Task 1 (pre-commit hook)
- **Issue:** Import members not alphabetically sorted (RoadmapNode before NodeStatus)
- **Fix:** Reordered imports to NodeStatus, RoadmapNode, RoadmapSchema
- **Files modified:** packages/desktop/tests/bench/generateSchema.ts
- **Committed in:** a07caa9

**Total deviations:** 1 auto-fixed (import ordering). No scope creep.

## Threat Flags

None -- this plan is purely test/benchmark code with no new trust boundaries or security surfaces.

## Known Stubs

None -- all test and benchmark files are fully implemented with no placeholder logic.

## Self-Check: PASSED

All 4 created/modified files verified present on disk. Both task commits (a07caa9, fec1df9) verified in git log. 119 unit tests passing, benchmark green with zero dataKey drift, production build succeeds.

---
*Phase: 02-read-only-viewer*
*Completed: 2026-04-15*
*Note: Task 3 (checkpoint:human-verify) pending human verification of 30+ fps rendering*
