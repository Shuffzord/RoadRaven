# Phase 03 Deferred Items

Out-of-scope discoveries noted during plan execution. Tracked here so they are
not lost; fix candidates for a dedicated cleanup plan.

## From Plan 03-04b execution (2026-04-21)

### Pre-existing failing test: `moveNodeUp swaps target with previous sibling` — RESOLVED 2026-04-22

- **File:** `packages/desktop/tests/unit/store/roadmapStore.mutations.test.ts` (~line 325)
- **Resolution:** fixed in commit `054ca17` (`fix(store): moveNodeUp/moveNodeDown now refresh nodeIndex entries in place`).
- **Root cause:** `bumpStructural({ preserveNodeIndex: true })` kept the nodeIndex
  Map instance stable but left its entries pointing at stale parent objects. The
  swap correctly updated `schema.nodes` but `nodeIndex.get(ROOT_ID).children` still
  returned the pre-swap ordering, so downstream consumers saw the old order.
- **Fix:** when preserving the Map, clear its entries and re-populate from
  `buildNodeIndex(nextNodes)` in place. Same Map identity (React memo consumers
  stay stable) with fresh entries (reflects reordered tree).
- **Surfaced during:** Plan 03-03 orchestrator inline completion — the pre-commit
  hook runs vitest, which blocked doc-only commits until this was fixed.
