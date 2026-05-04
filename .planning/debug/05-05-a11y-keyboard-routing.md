---
slug: 05-05-a11y-keyboard-routing
status: complete
created: 2026-05-04
completed: 2026-05-04
branch: gsd/phase-05-packaging-distribution
head_at_start: 4139e2e
head_at_complete: 6e16777
trigger: Three bugs surfaced during Phase 5 manual a11y walkthrough. Prior fix attempt (commits 564b0fc + 0113ef0, both REVERTED at 4139e2e) shipped untested code that broke node creation. Re-debug under higher engineering rigor (hypothesize → probe → integration-test → commit).
goal: find_and_fix
---

# Debug session — Phase 5 a11y / keyboard-routing bugs

## Summary

| Bug | Disposition | Commit | Verification |
| --- | ----------- | ------ | ------------ |
| BUG-1 — Chevron in tab cycle | **FIXED** | `d890ad0` | Playwright integration test (red→green confirmed) |
| BUG-2 — Tab handler fires on Shift+Tab | **FIXED** | `6e16777` | Playwright integration test (red→green confirmed) |
| BUG-3 — Tree auto-collapses on every structural mutation | **DEFERRED to v1.1** | (none) | See backlog disposition below; documented in `.planning/phases/05-packaging-distribution/05-A11Y-AUDIT.md` as known-issue with workaround |

---

## BUG-1 — Chevron buttons in tab order

### Hypothesis

The chevron `<button>` in `RoadmapNodeCard` (RoadmapNode.tsx:178) had no
explicit `tabIndex`, so it sat in the default document tab cycle. WAI-ARIA
tree pattern (https://www.w3.org/WAI/ARIA/apg/patterns/treeview/) says
only the treeitem itself should be tabbable; expand/collapse activates
via Enter or Right/Left arrow on the row, never via Tab to a child
focusable. Adding `tabIndex={-1}` removes the chevron from the tab cycle
without affecting mouse-click activation.

**Risk:** Low. Single attribute addition, no interaction with mutation
logic, no dependency on react-d3-tree internals.

### Probe

Read RoadmapNode.tsx line 178–215. Confirmed:
- The chevron is rendered as a plain `<button type="button">` with `onClick`
  but no `tabIndex`. Default tab behavior: included.
- The card itself (line 110–138) has `tabIndex={0}` + `role="treeitem"`
  + `onKeyDown` for Enter/Space → onSelect.
- No keyboard-shortcut path on the chevron itself; toggle is only via
  mouse onClick.

So `tabIndex={-1}` is provably safe — no caller depends on the chevron
receiving keyboard focus.

### Fix

`packages/desktop/src/mainview/components/RoadmapNode.tsx` line 183:
added `tabIndex={-1}` with a 6-line comment explaining the WAI-ARIA
rationale.

### Integration evidence

New Playwright test `packages/desktop/tests/ui/keyboard-routing.spec.ts`
test "BUG-1: chevron is not in document tab order (tabIndex=-1)":
1. Loads basic-schema fixture (3 nodes: root + 2 children).
2. Queries `document.querySelector('[data-source-id="..."] button[aria-label]')`
   for the root's chevron.
3. Asserts the `tabindex` attribute equals `"-1"`.

**Red-then-green protocol verified:**
- `git stash push packages/desktop/src/mainview/components/RoadmapNode.tsx`,
  ran the test → `Expected: "-1", Received: null` (RED, as expected).
- `git stash pop`, re-ran the test → PASS (GREEN).

A11y axe suite still GREEN (8/8) — no semantic-markup regression.

### Commit

`d890ad0 fix(05-05): chevron tabIndex=-1 — keep treeitem-only tab order (BUG-1)`

---

## BUG-2 — Tab handler also fires on Shift+Tab

### Hypothesis

`useKeyboardRouter.ts:208` had:
```ts
if (e.key === "Tab" && focusedId) {
    e.preventDefault();
    dispatchOpenRename(store.addSiblingBelow(focusedId));
    return;
}
```
With no `!e.shiftKey` guard, Shift+Tab also matched and called
`addSiblingBelow`. The user perceived this as "Shift+Tab collapses my
nodes" because:
1. `addSiblingBelow` bumps `dataKey` via `bumpStructural`.
2. react-d3-tree re-inits via `setInitialTreeDepth` (BUG-3).
3. Manually-expanded deep parents get re-collapsed.
The user's mental model interpreted the simultaneous "node created +
parent re-collapsed" as "shift-Tab folds the tree". Actually two bugs
stacking.

Adding `&& !e.shiftKey` makes plain Tab → addSiblingBelow, Shift+Tab →
native focus-backward (which after BUG-1 correctly walks between
treeitems).

**Risk:** Low. Single boolean check addition. Existing E2E tests for
plain Tab still pass.

### Probe

Read useKeyboardRouter.ts:198–212. Confirmed:
- `Enter` (no shift) → `addChild` (line 198, has `!e.shiftKey` guard).
- `Shift+Enter` → `addSiblingAbove` (line 203, has `e.shiftKey` guard).
- `Tab` → `addSiblingBelow` (line 208, MISSING shift guard — the bug).

The asymmetry is the smoking gun — Enter/Shift+Enter are explicitly
distinguished, but the Tab branch is over-eager.

### Fix

`packages/desktop/src/mainview/hooks/useKeyboardRouter.ts` line 208:
added `&& !e.shiftKey` to the Tab branch with a 6-line comment
documenting why (and the BUG-3 stack-up).

### Integration evidence

New Playwright test `packages/desktop/tests/ui/keyboard-routing.spec.ts`
test "BUG-2: Shift+Tab on a focused node does NOT create a sibling":
1. Loads basic-schema fixture (count=3).
2. Clicks child A (sets focusedNodeId via card.onClick → setFocusedNode).
3. Presses Shift+Tab.
4. Asserts node count unchanged (still 3).

Plus regression guard "Plain Tab on a focused node still creates a
sibling": same setup, presses plain Tab, asserts count = 4.

**Red-then-green protocol verified:**
- `git stash push packages/desktop/src/mainview/hooks/useKeyboardRouter.ts`,
  ran the BUG-2 test → `Expected: 3, Received: 4` (RED — Shift+Tab created
  a sibling, exactly the bug).
- `git stash pop`, re-ran → PASS (GREEN).

A11y axe suite still GREEN (8/8); 452/452 unit tests still pass.

### Commit

`6e16777 fix(05-05): guard Tab handler against shift modifier (BUG-2)`

---

## BUG-3 — Tree auto-collapses on structural mutation (DEFERRED to v1.1)

### Hypothesis

`bumpStructural` (roadmapStore.ts:354) increments `dataKey` on every
structural mutation. Canvas.tsx:396 passes `dataKey` to
`<Tree dataKey={...}>`. react-d3-tree's `Tree.getDerivedStateFromProps`
treats any `dataKey` change as "fresh dataset" and triggers re-init.

### Probe — read react-d3-tree source

`packages/desktop/node_modules/react-d3-tree/lib/esm/Tree/index.js`:

Line 186–198, `getDerivedStateFromProps`:
```js
const dataKeyChanged = !nextProps.dataKey || prevState.dataKey !== nextProps.dataKey;
if (nextProps.data !== prevState.dataRef && dataKeyChanged) {
    derivedState = {
        dataRef: nextProps.data,
        data: Tree.assignInternalProperties(clone(nextProps.data)),
        isInitialRenderForDataset: true,    // ← critical
        dataKey: nextProps.dataKey,
    };
}
```

Line 299–316, `assignInternalProperties`:
```js
nodeDatum.__rd3t = { id: null, depth: null, collapsed: false };
```
Unconditionally overwrites `__rd3t.collapsed = false` for every node.

Line 384–404, `generateTree`:
```js
if (initialDepth !== undefined && isInitialRenderForDataset) {
    this.setInitialTreeDepth(nodes, initialDepth);
}
```

Line 241–245, `setInitialTreeDepth`:
```js
setInitialTreeDepth(nodeSet, initialDepth) {
    nodeSet.forEach(n => {
        n.data.__rd3t.collapsed = n.depth >= initialDepth;
    });
}
```

**Confirmed root cause:** Every `dataKey` change → `assignInternalProperties`
wipes `__rd3t.collapsed` to false → `generateTree` calls `setInitialTreeDepth`
because `isInitialRenderForDataset` is true → all nodes deeper than
`initialDepth=3` are forced collapsed. Manual expand state is lost.

### Why the prior fix attempt failed (`0113ef0`)

The split into `dataKey` (autosave) + `loadKey` (Tree prop) made `loadKey`
stable across structural mutations. But the condition is:
```js
nextProps.data !== prevState.dataRef && dataKeyChanged
```
With `loadKey` stable, `dataKeyChanged` is always false except on schema
load. So the entire `derivedState` block is skipped, and react-d3-tree
keeps rendering against `prevState.data` (the OLD cloned tree). New nodes
in our `treeData` are never observed by the library. **That's why
mutations stopped reflecting visually — they were correctly stored, but
react-d3-tree's internal state was frozen.**

### Why a clean fix is hard

The library's contract requires `dataKey` change to detect new structure.
There is no per-node API to opt out of `setInitialTreeDepth`. The only
viable approaches:

1. **Ref-based collapse-state restoration.** Track `manuallyToggled:
   Map<nodeId, collapsed>` in our store. After every `dataKey` bump, in
   a `useLayoutEffect`, walk `treeRef.current.state.data` (react-d3-tree's
   internal cloned tree) and reapply `__rd3t.collapsed` per our tracking,
   then force a setState. **Risk: HIGH** — depends on react-d3-tree's
   internal state shape. Library version pin would mitigate but the
   contract-fragility remains. Would require pinning `react-d3-tree`
   exactly and version-gating the workaround.
2. **Replace react-d3-tree with custom d3-hierarchy renderer.** Out of
   scope for v1; tracked as v1.1 candidate.
3. **`initialDepth = 999` (always-fully-expanded by default).** Removes
   the auto-collapse-on-load entirely — "wall of nodes" on first open
   for any roadmap with > ~30 nodes. UX regression for the common case.

### Disposition: defer to v1.1

**Why deferred:**
- The only correct fix (option 1) depends on react-d3-tree internals,
  which is exactly the kind of risky integration the prior failed attempt
  taught us to be cautious about.
- BUG-3 is a UX-degradation, not a correctness bug. Data is correct;
  only the visual collapse state of deep parents is lost. The user can
  re-expand the parent with one click after each structural mutation in
  a deep subtree.
- The user explicitly cited "30 minutes burned on a broken installer
  round" as the trust-breaker. Shipping another speculative fix here
  would risk repeating that pattern.
- BUG-3 only manifests when the user manually expands a parent at depth
  ≥ initialDepth=3 (the default). Roadmaps shallower than that never
  hit it. The Hello World sample (2 levels) doesn't hit it; only
  gsd-roadmap.json and similar deep trees do.

**What conditions would make it fixable:**
- v1.1 spike on react-d3-tree internals OR a small-effort proof-of-concept
  of approach 1 in a worktree, integration-tested in the actual CEF
  binary. Pin `react-d3-tree` to the exact tested version and add a
  contract test that fails loudly if `state.data[].__rd3t.collapsed`
  field shape changes.
- Alternatively, scope a v1.1 task to evaluate replacement libraries
  (react-flow, custom d3-hierarchy renderer).

**User-facing workaround documented in audit doc:**
"For roadmaps deeper than 3 levels: after creating, deleting, or
duplicating a node inside a manually-expanded deep subtree, re-click
the parent's chevron to re-expand. The new node will then be visible.
This is a known v1 limitation; v1.1 spike planned."

### Commit

(none — no code change)

---

## What was deliberately NOT changed

The prior commit `564b0fc` bundled three things:
1. BUG-1 chevron tabIndex=-1 (correct — kept here as `d890ad0`)
2. BUG-2 shift-Tab guard (correct — kept here as `6e16777`)
3. **focused→selected fallback** (`targetId = focusedId ?? selectedNodeId`
   used by Ctrl+C/V/D/↑/↓, F2, Enter/Tab, Delete) — scope creep,
   not part of any of the three reported bugs.

Item 3 is a UX behavior change that:
- Was not motivated by any of the three audit findings;
- Has not been tested for regressions;
- Could mask real bugs by silently expanding the focusable surface;
- May have contributed to the prior commit's instability.

It is intentionally NOT carried forward in this debug session. If the
user wants the focused→selected fallback, that should be a separate
proposal with its own justification and tests (likely a Plan-03-02
follow-up rather than a Phase 5 a11y fix).

---

## Files touched (this session)

| File | Change | Commit |
| ---- | ------ | ------ |
| `packages/desktop/src/mainview/components/RoadmapNode.tsx` | +7 lines (BUG-1 fix + comment) | d890ad0 |
| `packages/desktop/src/mainview/hooks/useKeyboardRouter.ts` | +7 lines, -1 line (BUG-2 fix + comment) | 6e16777 |
| `packages/desktop/tests/ui/keyboard-routing.spec.ts` | +138 lines (new integration test, 3 cases) | 6e16777 |
| `.planning/phases/05-packaging-distribution/05-A11Y-AUDIT.md` | known-issue row + walkthrough updates | (next commit) |

---

## Verification matrix

| Check | Result |
| ----- | ------ |
| `bun run --cwd packages/desktop test` (vitest) | 452/452 PASS |
| `bun run --cwd packages/desktop typecheck` (tsc --noEmit) | clean |
| `bunx @biomejs/biome lint <changed files>` | clean |
| `bun run --cwd packages/desktop build` (vite) | succeeds |
| `bun run --cwd packages/desktop test:e2e --project=ui --grep "Keyboard routing"` | 3/3 PASS |
| `bun run --cwd packages/desktop test:a11y` (axe) | 8/8 PASS |
| Red-then-green for BUG-1 (revert → red, restore → green) | PASS |
| Red-then-green for BUG-2 (revert → red, restore → green) | PASS |

---

## What the user needs to retest manually

**Surgical, NOT the full a11y checklist.** The Playwright integration
tests cover BUG-1 and BUG-2 against the production-built renderer
(via dev-mode test seam — same React component tree as ships in CEF).
Anything CEF-specific (e.g. focus rings rendered via OS-native paths)
is NOT covered by Playwright.

Specific checks (5 minutes total):

1. **BUG-1 verification** — Build the installer, install, open
   `samples/gsd-roadmap.json`, focus a child node, press Shift+Tab.
   Expected: focus moves to the previous treeitem (sibling or parent),
   NOT to the parent's chevron. Mouse-click on the chevron still
   collapses/expands.

2. **BUG-2 verification** — Same setup, focus a child node, press
   Shift+Tab. Expected: NO new sibling is created (compare node count
   in the chevron badge before vs after).

3. **BUG-3 (known-issue) confirmation** — Same setup, manually expand
   a deep parent (depth ≥ 3), focus one of its children, press plain
   Tab. Expected (known v1 limitation): a new sibling IS created in
   the data, but the parent visually re-collapses. To see the new
   node, re-click the parent's chevron. Confirm the workaround is
   acceptable for v1; note v1.1 backlog item.

If checks 1 and 2 PASS in the installed CEF binary, the Phase 5 a11y
keyboard-routing remediation is complete. Check 3 documents the
deferred item.

---

## Backlog entry for v1.1

**Title:** Preserve react-d3-tree collapse state across structural mutations

**Acceptance:** After creating, deleting, duplicating, renaming, or
reordering nodes inside a manually-expanded deep subtree, the parent
remains visually expanded and any new nodes are immediately visible.

**Approach (proposal — must be spiked):** Track `manuallyToggled:
Map<nodeId, collapsed>` in `roadmapStore`. Wrap the chevron's `onToggle`
in `Canvas.renderNode` to mirror the toggle into the store. Add a
`useLayoutEffect` keyed on `dataKey` that walks `treeRef.current.state.data`
and reapplies `__rd3t.collapsed` per the tracked map, then forces a
setState. Pin `react-d3-tree` exactly. Add a contract test that fails
if the internal state shape changes.

**Risk:** HIGH — depends on react-d3-tree internals. Spike must include
integration test against the CEF binary, not just `vite preview`.

**Alternative:** Evaluate replacement (react-flow, custom d3-hierarchy
renderer with our own collapse state).
