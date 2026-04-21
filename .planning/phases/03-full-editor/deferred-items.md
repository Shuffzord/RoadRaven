# Phase 03 Deferred Items

Out-of-scope discoveries noted during plan execution. Tracked here so they are
not lost; fix candidates for a dedicated cleanup plan.

## From Plan 03-04b execution (2026-04-21)

### Pre-existing failing test: `moveNodeUp swaps target with previous sibling`

- **File:** `packages/desktop/tests/unit/store/roadmapStore.mutations.test.ts` (~line 325)
- **Observed:** Fails on base commit `d29fd41` before any Plan 03-04b changes
  (verified via `git stash` round-trip). The test asserts
  `ids[0] === CHILD_B_ID` after `moveNodeUp(CHILD_B_ID)`, but receives
  `CHILD_A_ID` — implying the swap-in-place either didn't happen or the fixture
  ordering isn't what the test expects.
- **Scope:** pre-existing; not caused by any Plan 03-04b change. Per scope
  boundary (do not fix pre-existing failures in unrelated code paths), left as-is.
- **Recommended follow-up:** investigate whether `moveNodeUp` regressed in an
  earlier plan, or whether the test setup ordering needs updating after Plan 01
  landed the final mutation semantics.
