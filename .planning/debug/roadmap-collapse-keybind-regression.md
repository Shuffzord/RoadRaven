---
status: awaiting_human_verify
trigger: "After commit aad416e (Camera adjustments), creating a child node auto-collapses the surrounding subtree, and arrow-key navigation into the new child appears broken. User suspects the isNodeVisible change is the cause."
created: 2026-05-04T00:00:00Z
updated: 2026-05-04T00:00:00Z
---

## Current Focus

hypothesis (CONFIRMED + FIX APPLIED): aad416e re-introduced `initialDepth={3}` on <Tree> + added `isNodeVisible` skip-logic in arrow-nav. Trigger = initialDepth recombining with dataKey-bump-on-mutation re-collapsed deep subtrees on every structural change. Amplifier = isNodeVisible silenced arrow-keys because the just-created child had no DOM card. Fix = minimal revert of those two changes; all camera-comfort improvements kept.
test: Applied four-file edit (Canvas.tsx + useKeyboardRouter.ts + 2 test files). Self-verified: 18/18 unit tests pass, tsc --noEmit clean, biome lint clean on changed files.
expecting: User opens a deep roadmap, expands past depth 3, triggers Add Child / Add Sibling — new child should now appear immediately under the expanded parent, inline rename input should focus, and arrow-keys should traverse to the new child without no-op silence.
next_action: Await human UI verification (do NOT archive session yet — per scope_constraints, user verifies UI fixes manually before resolution).

## Symptoms

expected:
  - Create child → new child visible under parent → focus moves to it → user can rename immediately
  - Add sibling → new sibling visible at same level → focus moves to it
  - Previously-expanded subtrees stay expanded across structural mutations
  - ArrowRight/ArrowDown on a parent enters its first child

actual:
  - After "create child" the new child is created but the surrounding subtree appears auto-collapsed; new child not visible
  - Same for add-sibling / structural mutations
  - Keyboard navigation into just-created child appears broken (no-op because target "not visible")
  - User intuition: regression from recent isVisible / "Camera adjustments" change

errors: none reported (silent UX regression)

reproduction:
  1. bun run dev:hmr
  2. Open a roadmap with > depth-3 structure (samples/gsd-roadmap.json: milestone → phase → plan → task)
  3. Manually expand a subtree past depth 3
  4. Select any node
  5. Trigger "Add Child" via context menu OR keyboard shortcut
  6. Observe: subtree auto-collapses, new child hidden, follow-up keybinds fail

started:
  - Worked correctly before commit aad416e
  - Broke at aad416e ("Camera adjustments", 2026-05-03)
  - Prior commit 0113ef0 attempted underlying fix but was reverted in b28cb04 — reason for revert is suspicious context

## Eliminated

- hypothesis: User's intuition that the `isNodeVisible` filter is the *root* cause
  evidence: `isNodeVisible` only short-circuits arrow-nav into already-collapsed nodes; it doesn't *cause* the collapse. Without it, arrow-nav would silently focus invisible cards (worse UX, same data state). The collapse itself comes from `initialDepth={3}` re-applying on every `dataKey` bump. `isNodeVisible` is a downstream amplifier (it makes the keybinds *silent* instead of focusing-into-the-void), but removing it alone would not restore visible new children.
  timestamp: 2026-05-04

- hypothesis: Re-applying the reverted `loadKey`/`dataKey` split (commit 0113ef0) is the right fix
  evidence: The prior debug session at `.planning/debug/05-05-a11y-keyboard-routing.md` (commit e521e04, on the unmerged `gsd/phase-05-packaging-distribution` branch) records WHY this approach was reverted in `b28cb04`. Quoting verbatim: "With `loadKey` stable, `dataKeyChanged` is always false except on schema load. So the entire `derivedState` block is skipped, and react-d3-tree keeps rendering against `prevState.data` (the OLD cloned tree). New nodes in our `treeData` are never observed by the library. That's why mutations stopped reflecting visually — they were correctly stored, but react-d3-tree's internal state was frozen." This is corroborated directly by react-d3-tree v3.6.6 source: `getDerivedStateFromProps` requires BOTH `nextProps.data !== prevState.dataRef` AND `dataKeyChanged` to re-clone; freezing `dataKey` makes the AND false even though `data` reference changed (because `bumpStructural` builds a fresh `treeData` object).
  timestamp: 2026-05-04

## Evidence

- timestamp: 2026-05-04
  checked: aad416e diff against Canvas.tsx, useKeyboardRouter.ts, roadmapStore.ts
  found: aad416e bundles SIX independent changes: (1) animatePanTo distance-aware duration + reduced-motion guard + cubic-in-out ease, (2) comfort-zone clamp (middle 50% of viewport), (3) `setTranslate` no-op guard, (4) separation `{1, 1.3}` from `{1.5, 2.0}`, (5) removed `dimensions={dimensions}` prop, (6) added `initialDepth={3}` + added `isNodeVisible` skip-logic in nav. Items 1-3 are the load-bearing camera-comfort fix. Items 4-6 are scope creep that re-introduced this regression.
  implication: A minimal fix can keep items 1-3 untouched and revert ONLY items 5-6 (or only item 6 — `initialDepth={3}` plus `isNodeVisible` and nav skip).

- timestamp: 2026-05-04
  checked: commit c58b749 ("fix(03-01): UAT round 2 — F2 loop, modal focus, space/enter propagation, collapse"), Apr 20
  found: This commit EXPLICITLY removed `initialDepth={3}` from Canvas.tsx, with this rationale verbatim in its message: "4/5/6/9. New children hidden / parent appears collapsed after Enter / Shift+Enter / Tab / Ctrl+V: removed `initialDepth={3}` on the Tree. Structural mutations bump `dataKey` which remounts react-d3-tree; with initialDepth set, any subtree deeper than 3 levels was re-collapsed on every mutation. New nodes are now visible immediately."
  implication: The `aad416e` re-introduction of `initialDepth={3}` is a direct undo of c58b749. The rationale was already known and documented in the commit log. There is no new requirement that justifies re-adding `initialDepth={3}`.

- timestamp: 2026-05-04
  checked: react-d3-tree v3.6.6 (packages/desktop/node_modules/react-d3-tree/lib/esm/Tree/index.js, package version 3.6.6)
  found:
    - Line 186-198 (`getDerivedStateFromProps`): `const dataKeyChanged = !nextProps.dataKey || prevState.dataKey !== nextProps.dataKey; if (nextProps.data !== prevState.dataRef && dataKeyChanged) { derivedState = { ..., data: assignInternalProperties(clone(nextProps.data)), isInitialRenderForDataset: true, ... } }`
    - Line 299-316 (`assignInternalProperties`): unconditionally writes `nodeDatum.__rd3t = { id: null, depth: null, collapsed: false }` for every node — wipes any prior collapse state.
    - Line 384-404 (`generateTree`): `if (initialDepth !== undefined && isInitialRenderForDataset) { this.setInitialTreeDepth(nodes, initialDepth); }`
    - Line 241-245 (`setInitialTreeDepth`): `nodeSet.forEach(n => { n.data.__rd3t.collapsed = n.depth >= initialDepth; });`
  implication: The mechanism is mechanical and unconditional. Any time both (`data` reference changed) AND (`dataKey` value changed), every node deeper than `initialDepth` is force-collapsed regardless of prior user expand state. Our `bumpStructural` in roadmapStore.ts:354 satisfies BOTH conditions on every structural mutation — it builds a fresh `treeData` object via `toTreeDatum(nextNodes[0])` AND increments `dataKey`.

- timestamp: 2026-05-04
  checked: roadmapStore.ts:349-383 (`bumpStructural`)
  found: Called by addChild, addSiblingAbove, addSiblingBelow, deleteNode, duplicateNode, moveNodeUp, moveNodeDown, renameNode, pasteFromClipboard. Each path: (a) builds `treeData = toTreeDatum(nextNodes[0])` — fresh object reference, AND (b) `dataKey: String(Number(get().dataKey) + 1)` — incremented value. Both conditions for getDerivedStateFromProps re-clone are satisfied.
  implication: Every structural mutation is a remount-trigger for react-d3-tree as long as `initialDepth` is set. (Move-up/move-down also trigger it, even though their `preserveNodeIndex: true` flag preserves Map identity in our store — that flag doesn't affect what props reach react-d3-tree.)

- timestamp: 2026-05-04
  checked: Canvas.tsx:148-173, the camera-follow effect after aad416e
  found: `targetNodeId = focusedNodeId ?? selectedNodeId`. After `addChild`, `useKeyboardRouter` calls `dispatchOpenRename(store.addChild(focusedId))` which (a) creates the child, (b) bumps dataKey, (c) does NOT setFocusedNode to the new child id. The new child id is dispatched via the `OPEN_RENAME_EVENT` to start inline-rename. Camera-follow only re-runs on `targetNodeId/dimensions/animatePanTo` changes; `targetNodeId` (still the parent) doesn't change, so camera doesn't pan. But `dataKey` changed, so react-d3-tree re-derives, applies initialDepth, and the parent's deep subtree (which user had manually expanded) collapses. The new child id sits in `inlineRename.state.nodeId` but its card is never rendered (collapsed). The rename input never appears because `<RoadmapNodeCard>` for that id is not in the DOM.
  implication: This explains BOTH the visual collapse AND the "rename appears not to work" symptom: the rename target's card never mounts.

- timestamp: 2026-05-04
  checked: useKeyboardRouter.ts:51-71 (`navigateSibling`) and 73-83 (`enterChild`) after aad416e
  found: Both functions now skip candidates where `isVisible(c.id) === false`. After `addChild`, the new child's id has no `[data-source-id="..."]` element on the canvas (because it's inside a freshly-collapsed subtree). So:
    - `enterChild(parent)` calls `target.children?.find(c => isVisible(c.id))` — returns undefined for the new child path, no-op.
    - `navigateSibling` similarly skips invisible siblings.
  implication: This is the keybind-silence amplifier. It is *correct* logic in steady-state (don't focus-into invisible cards), but combined with `initialDepth={3}` it produces the silent-failure UX.

- timestamp: 2026-05-04
  checked: tests covering keyboard router (`packages/desktop/tests/unit/hooks/useKeyboardRouter*.test.*`)
  found: Both files stub `isNodeVisible: () => true` in their `makeStubDeps`/`renderRouter` helpers. No test exercises the `isNodeVisible: false` skip-path. No Canvas-level integration test exists for the expand-subtree-then-mutate scenario. tests/unit/store/* tests `addChild` / `bumpStructural` data behavior but not the rendered tree state.
  implication: The regression slipped through CI because the unit test layer doesn't exercise the prop interaction between `initialDepth`, `dataKey`, and rendered DOM. The prior debug session (e521e04) added a Playwright integration test for BUG-1/BUG-2 but explicitly deferred BUG-3 — and even that test infrastructure isn't in develop.

- timestamp: 2026-05-04
  checked: prior debug session at `.planning/debug/05-05-a11y-keyboard-routing.md` (created in commit e521e04 on unmerged branch `gsd/phase-05-packaging-distribution`)
  found: Documents this exact bug (labelled BUG-3) along with the failed fix attempt 0113ef0 and the reason for revert b28cb04. Three approaches were considered: (1) ref-based collapse-state restoration via `treeRef.current.state.data` walk in useLayoutEffect — HIGH risk, depends on react-d3-tree internal shape; (2) replace react-d3-tree — out of scope; (3) `initialDepth = 999` (always-fully-expanded) — wall-of-nodes UX regression on big roadmaps. Disposition: defer to v1.1; user-facing workaround = re-click parent chevron after each mutation.
  implication: The prior author has already trodden this exact path and burned a fix attempt on it. Whoever is fixing this regression in develop must NOT re-implement the loadKey/dataKey split (it's been proven to freeze the tree's internal state) and should weigh: (A) simply removing `initialDepth={3}` (= revert to c58b749's resolution; trade-off: large roadmaps render fully expanded on load), versus (B) accept the prior session's "deferred to v1.1" disposition for this UX issue and document the workaround, versus (C) spike option-1 (ref-based collapse-state restoration with a contract test) only if the wall-of-nodes regression of (A) is unacceptable.

- timestamp: 2026-05-04
  checked: `aad416e` commit message ("Camera adjustments") and the file-level diff
  found: Commit message describes only camera-comfort intent. The bundled `initialDepth={3}` re-introduction and `isNodeVisible` nav skip are not mentioned in the commit message and appear to be drive-by changes orthogonal to the camera-comfort fix.
  implication: This is the proximate process cause: scope creep in a "Camera adjustments" commit silently undid a documented fix. A minimal correction is to revert just the two non-camera-related changes (initialDepth={3} prop and the isNodeVisible nav skip) while keeping the actual camera-comfort improvements.

## Resolution

root_cause: |
  Commit aad416e ("Camera adjustments", 2026-05-03) re-introduced `initialDepth={3}` on the <Tree> component in Canvas.tsx (line 396) — silently undoing the explicit fix in commit c58b749 (2026-04-20) which had removed it for this exact reason. Combined with `bumpStructural` in roadmapStore.ts incrementing `dataKey` on every structural mutation, this triggers react-d3-tree v3.6.6's `getDerivedStateFromProps` → `assignInternalProperties` → `generateTree` → `setInitialTreeDepth` chain on every addChild/addSiblingAbove/addSiblingBelow/deleteNode/duplicateNode/moveNodeUp/moveNodeDown/renameNode/pasteFromClipboard call, force-collapsing every node at depth ≥ 3 and wiping the user's manual expand state.

  The same commit also added an `isNodeVisible(nodeId)` filter in `useKeyboardRouter.ts` (`navigateSibling` and `enterChild`) which skips nodes whose `[data-source-id]` is not in the DOM. This is *correct* logic in steady state (avoids focusing invisible cards) but in this regression context it amplifies the failure: after a structural mutation, the just-created child sits inside the freshly-collapsed subtree, has no DOM card, and is therefore silently skipped by every arrow-key, by `enterChild`, and by the inline-rename open path — producing the "keybinds appear broken" symptom.

  User's intuition was directionally right (the isNodeVisible change is part of the regression bundle) but mechanistically slightly off — `isNodeVisible` is the *amplifier*, not the *trigger*. The trigger is `initialDepth={3}` recombining with the existing `dataKey`-bump-on-mutation pattern.

  This is fundamentally the "BUG-3" issue documented in the prior unmerged debug session at `.planning/debug/05-05-a11y-keyboard-routing.md` (commit e521e04 on `gsd/phase-05-packaging-distribution`). That session explicitly deferred the issue to v1.1, with workaround "re-click parent chevron after each mutation". The current regression is not a new bug — it's the same pre-existing latent issue that c58b749 had patched out of the develop branch by removing `initialDepth={3}`, and aad416e silently re-exposed.

fix: |
  Minimal revert of the two regression-causing changes from aad416e, while keeping all camera-comfort improvements (animatePanTo distance-aware duration + reduced-motion guard + cubic-in-out ease, comfort-zone clamp, setTranslate no-op guard, separation tweak):

  1. packages/desktop/src/mainview/components/Canvas.tsx
     - Removed `initialDepth={3}` prop on <Tree> (the trigger — restores user-expanded collapse state across structural mutations).
     - Removed the `isNodeVisible` callback from the useKeyboardRouter deps (no longer needed once the amplifier is gone).

  2. packages/desktop/src/mainview/hooks/useKeyboardRouter.ts
     - Removed `isNodeVisible` from `RouterDeps`.
     - Reverted `navigateSibling` and `enterChild` to their pre-aad416e shape (no visibility filter — direct sibling/child lookup).
     - Removed the third `deps.isNodeVisible` arg at all three call sites.

  3. packages/desktop/tests/unit/hooks/useKeyboardRouter.test.ts
     - Removed `isNodeVisible: () => true` from `renderRouter`'s stub deps.

  4. packages/desktop/tests/unit/hooks/useKeyboardRouter.escape.test.tsx
     - Removed `isNodeVisible: () => true` from `makeStubDeps`.

  Did NOT re-attempt the loadKey/dataKey split (commits 0113ef0 / b28cb04) — proven broken because freezing dataKey makes react-d3-tree's getDerivedStateFromProps AND-condition short-circuit, so mutations stop reflecting visually.

verification: |
  Self-verified:
    - bun run test:file tests/unit/hooks/useKeyboardRouter.test.ts → 16/16 passed
    - bun run test:file tests/unit/hooks/useKeyboardRouter.escape.test.tsx → 2/2 passed
    - bun run test:typecheck → clean (tsc --noEmit, no errors)
    - biome lint on the four changed files → no errors

  Awaiting user UI verification:
    - Open a roadmap with > depth-3 structure (samples/gsd-roadmap.json: milestone → phase → plan → task)
    - Manually expand a subtree past depth 3
    - Trigger Add Child / Add Sibling on a deep node
    - Confirm: subtree stays expanded, new child visible, inline rename input appears on the new card, arrow-keys traverse into the new child correctly

files_changed:
  - packages/desktop/src/mainview/components/Canvas.tsx
  - packages/desktop/src/mainview/hooks/useKeyboardRouter.ts
  - packages/desktop/tests/unit/hooks/useKeyboardRouter.test.ts
  - packages/desktop/tests/unit/hooks/useKeyboardRouter.escape.test.tsx
