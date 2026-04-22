---
plan: 03-03
phase: 03-full-editor
status: code-complete
uat-status: pending (Tasks 6 & 7)
completed: 2026-04-22
---

# Plan 03-03 — SidePanel editor (CodeMirror 6 + metadata + editable fields)

## Outcome

The Phase 02 read-only side panel now has a full edit mode. A pencil button (or
clicking the title) toggles `isEditing`; in edit mode every field renders as an
input control wired to a Zustand mutation action, with autosave (Plan 03-04b)
persisting changes after the 1-second debounce. Escape exits edit mode without
committing.

Implements EDIT-10 (CodeMirror notes), EDIT-11 (metadata edit), EDIT-12
(editable title/status/type).

## Implementation path (atypical — recovery from partial executor)

This plan was executed in two phases:

1. **Wave 2 parallel worktree (agent-a99dc554)** — completed 3 of 7 tasks
   (CodeMirror hook + theme, NotesEditor with toggle, MetadataEditor with rows)
   then exhausted its tool-use budget while fighting a file-write hook. Agent
   used `--no-verify` per parallel-mode contract, so several biome violations
   slipped through.
2. **Orchestrator inline completion (this session)** — merged the partial
   worktree, fixed surfaced biome errors, then drove Tasks 4 & 5 directly
   without spawning another executor. Per user choice (`gsd:execute-phase 03
   --wave 2 --iterative` → "Merge both now, finish 03-03 inline after").

## Commits (in order on `gsd/phase-03-full-editor`)

- `311885d` feat(03-03): CodeMirror hook + rv-token theme — Task 1 (worktree)
- `486a08b` feat(03-03): NotesEditor with Edit/Preview/Split segmented toggle — Task 2 (worktree)
- `fc9be5d` feat(03-03): MetadataEditor with add/edit/delete rows — Task 3 (worktree)
- `d49af84` chore(03-03): merge partial executor worktree — orchestrator merge
- `5871d59` fix(03-03): biome violations from parallel --no-verify commits — orchestrator hotfix
- `054ca17` fix(store): moveNodeUp/moveNodeDown now refresh nodeIndex entries in place — surfaced pre-existing bug
- `a04d8f4` feat(03-03): SidePanel edit mode (title/status/type/notes/metadata) — Task 4 (inline)
- `d5cd8ef` feat(03-03): EditorPanel DevHarness for Plan 03 mid-plan UAT — Task 5 (inline)

## Files

### Created
- `packages/desktop/src/mainview/hooks/useCodeMirror.ts` — CodeMirror 6 mount hook with markdown lang, theme, and 1s debounce onPersist callback
- `packages/desktop/src/mainview/theme/codemirrorTheme.ts` — `rv-token`-based EditorView.theme()
- `packages/desktop/src/mainview/components/NotesEditor.tsx` — Edit/Preview/Split segmented toggle, embeds useCodeMirror + MarkdownRenderer
- `packages/desktop/src/mainview/components/MetadataEditor.tsx` — key/value rows with stable IDs, add/remove buttons
- `packages/desktop/src/renderer/components/_dev/EditorPanel.tsx` — Plan 03 DevHarness (auto-discovered via `import.meta.glob`)
- `packages/desktop/tests/unit/hooks/useCodeMirror.test.ts` — hook tests
- `packages/desktop/tests/unit/ui/NotesEditor.test.tsx` — toggle + persist tests (uses `aria-selected` post-fix)
- `packages/desktop/tests/unit/ui/MetadataEditor.test.tsx` — row tests
- `packages/desktop/tests/unit/ui/SidePanel.edit-mode.test.tsx` — 13 tests covering edit-mode entry/exit, every field, Escape cancellation, copy-ID regression

### Modified
- `packages/desktop/src/mainview/components/SidePanel.tsx` — full rewrite (60 → 459 lines): added isEditing state, titleDraft, cancellingRef (prevents Escape blur-on-unmount commit), and conditional preview/edit rendering for every field
- `packages/desktop/src/mainview/components/Canvas.tsx` — comment indent fix (biome flagged in transitive lint)
- `packages/desktop/src/mainview/store/roadmapStore.ts` — moveNodeUp/Down nodeIndex refresh fix (resolves deferred item from 03-04b)
- `packages/desktop/package.json` + `bun.lock` — CodeMirror 6 deps

## Verification gate

```
bunx vitest run            → 317 / 317 passed (34 files)
bunx vite build            → 790 modules transformed, EditorPanel stripped from production bundle
bunx tsc --noEmit          → clean
biome lint src/ shared/    → 0 errors, 6 pre-existing warnings (!important in index.css)
```

## Auto-fixed deviations from plan

1. **MetadataEditor row keys** — agent used `key={`row-${idx}`}` which is unstable
   under reorder/remove. Switched to per-row `id` field generated at row creation;
   Row interface gained `id: string`.
2. **NotesEditor aria attribute** — agent used `aria-pressed` on `role="tab"`,
   which is the wrong ARIA pairing. Changed to `aria-selected`; test updated.
3. **useCodeMirror missing-deps warnings** — added explicit `biome-ignore`
   comments documenting why `initialDoc` and `container.current` deserve to be
   omitted (mount-only seed; ref).
4. **SidePanel Escape race** — Escape unmounts the title input while it's
   focused, which fired `onBlur` → committed the in-progress draft. Added a
   `cancellingRef` flag the Escape handler sets and `handleTitleCommit` checks.

## Bug fixes outside plan scope

- **`moveNodeUp` / `moveNodeDown` nodeIndex stale entries** — discovered when
  pre-commit hook ran vitest and surfaced the deferred test. Root cause was
  `bumpStructural({ preserveNodeIndex: true })` keeping the Map instance but
  not refreshing its entries. Fix in `054ca17`. Resolves
  `.planning/phases/03-full-editor/deferred-items.md`.

## Checkpoints — Status

| Task | Type | Status | Notes |
|------|------|--------|-------|
| 1. CodeMirror hook + theme | implementation | ✓ committed | worktree agent |
| 2. NotesEditor toggle | implementation | ✓ committed | worktree agent |
| 3. MetadataEditor rows | implementation | ✓ committed | worktree agent |
| 4. SidePanel edit mode + tests | implementation | ✓ committed | orchestrator inline |
| 5. EditorPanel DevHarness | implementation | ✓ committed | orchestrator inline |
| 6. Mid-plan UAT | checkpoint:human-verify | ⏸ pending | drive via DevHarness's "Plan 03 — Editor" buttons in `bun run dev:hmr` |
| 7. Full-plan UAT | checkpoint:human-verify | ⏸ pending | drive in side panel: open hello-world.json, select root, click [E], edit title/status/type/notes/metadata, observe SaveIndicator transitions |

## Known follow-ups (out of scope here)

- The `useExhaustiveDependencies` `biome-ignore` comments on
  `MetadataEditor.tsx` and `useCodeMirror.ts` could be replaced with ref-based
  patterns if a future cleanup pass values zero suppressions over comment
  documentation.
- `EditorPanel.tsx` calls `useRoadmapStore.getState()` outside of subscriber
  hooks — works but bypasses React's reactivity; intentional for a dev-only
  click-to-fire harness.
