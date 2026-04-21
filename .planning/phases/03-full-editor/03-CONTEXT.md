# Phase 3: Full Editor - Context

**Gathered:** 2026-04-16
**Status:** Ready for planning

<domain>
## Phase Boundary

A complete roadmap can be created, edited, and saved without touching JSON directly — with full keyboard control, autosave, atomic writes, and correct `$ref` write-back. This phase transforms the read-only viewer into a fully interactive editor.

This phase delivers EDIT-01 through EDIT-18 across 4 plans (node mutations, context menu, side panel editor, autosave + persistence).

</domain>

<decisions>
## Implementation Decisions

### Context Menu Structure
- **D-01:** Flat layout with separators — all actions at a single level, grouped: `[Rename F2]` --- `[Add Child Enter | Add Sibling Above Shift+Enter | Add Sibling Below Tab]` --- `[Duplicate Ctrl+D | Copy Ctrl+C | Paste Ctrl+V]` --- `[Move Up Ctrl+↑ | Move Down Ctrl+↓]` --- `[Change Status ▶]` --- `[Delete Del]`. Status is the only sub-menu (lists available statuses from `statusConfig`).
- **D-02:** Custom webview-rendered `<div>` context menu on ALL platforms — skip Electrobun's native `ContextMenu.showContextMenu()` entirely. One implementation, consistent behavior, easier to test. Keyboard-navigable (arrow keys + Enter + Escape), ARIA-compliant, appears within 50ms.
- **D-03:** Canvas background (no node) right-click shows a subset menu: `[Paste]` `[Add Root Child]` `[Fit to View]` `[Toggle Layout]`.

### Keyboard Shortcuts & Navigation
- **D-04:** Node creation shortcuts: **Enter = Add Child** (go deeper), **Tab = Add Sibling Below** (same level, after), **Shift+Enter = Add Sibling Above** (same level, before). User's mental model: Enter creates underneath, Tab creates alongside.
- **D-05:** **Space = select node** (opens side panel). ARIA listbox pattern — Space activates, arrows navigate.
- **D-06:** Distinct **focus + selection** visual indicators. Focus = dashed outline (keyboard navigation indicator, shows current position). Selection = solid accent outline (node whose details are in the side panel). Both can coexist on the same node. Focus ring uses `:focus-visible` behavior — disappears on mouse click, reappears on first keyboard press.
- **D-07:** **F6** toggles focus between canvas and side panel. In canvas: arrow keys navigate focus, Space selects, Enter/Tab/Shift+Enter create nodes, F2 renames, Del deletes. In panel: Tab cycles editable fields, Escape returns focus to canvas.
- **D-08:** Context-aware **Ctrl+C/Ctrl+V**: when canvas is focused, copies/pastes node + subtree as JSON to clipboard. When a text input is focused (inline rename, panel fields, CodeMirror), does normal browser text copy/paste. Detection via `document.activeElement`.

### Full Keyboard Shortcut Map
- **D-09:** Complete shortcut reference:

| Key | Canvas Action |
|-----|--------------|
| Arrow Up/Down | Move focus between siblings |
| Arrow Right | Expand / enter subtree |
| Arrow Left | Collapse / return to parent |
| Space | Select node (open panel) |
| Enter | Add Child |
| Tab | Add Sibling Below |
| Shift+Enter | Add Sibling Above |
| F2 | Inline rename |
| Del | Delete node |
| Ctrl+D | Duplicate node + subtree |
| Ctrl+C | Copy node + subtree |
| Ctrl+V | Paste node |
| Ctrl+↑ | Move node up in siblings |
| Ctrl+↓ | Move node down in siblings |
| Escape | Deselect node |
| F6 | Toggle focus canvas ↔ panel |

### Side Panel Editor
- **D-10:** Panel opens in **preview mode** by default (read-only, current Phase 2 behavior). Click any field or press an edit button `[E]` to switch to edit mode. Prevents accidental edits while browsing the tree.
- **D-11:** Notes area has a **segmented toggle** `[Edit | Preview | Split]` in the notes header. Default is Preview. Click notes area or the Edit segment to switch to CodeMirror editor. Split mode shows side-by-side editor + rendered preview. CodeMirror 6 with GFM syntax highlighting, 1s debounce autosave.
- **D-12:** Metadata editing via **add/edit/delete rows** table. Each row has inline-editable key + value text inputs. `[+]` button adds a new row, `[x]` button removes a row. Simple key-value interface.
- **D-13:** Node title editable in **both canvas and panel**. Canvas: double-click or F2 triggers inline rename with floating `<input>` positioned via `getBoundingClientRect()` with inverse D3 zoom transform. Panel: title is an editable text field in edit mode. Both sync via the Zustand store.

### External Edit Conflict & Save Failures
- **D-14:** External file change with unsaved edits triggers a **non-blocking toast**: "File changed externally. [Reload] [Keep mine]." Reload = discard in-memory edits, load new file. Keep mine = ignore external change, next autosave overwrites. Autosave timer **pauses** until user resolves the conflict.
- **D-15:** Escalating save failure handling:
  - 1st failure: status bar shows `[!] Error saving — retrying...` + auto-retry in 5s
  - 2nd failure: status bar shows `[!] Error saving — click to retry` (persistent, manual only)
  - 3rd failure: **modal dialog** with file path, error message, and `[Retry] [Save As] [Dismiss]` buttons
  - User is never left unaware of save failures.

### Claude's Discretion
- Exact floating `<input>` positioning math (inverse D3 zoom transform calculation)
- Context menu animation and render pipeline (must appear within 50ms per EDIT-09)
- CodeMirror 6 extension selection and configuration
- Autosave debounce and periodic timer implementation
- Atomic write implementation details (`.tmp` → rename, Windows 3-attempt retry loop)
- `$ref` file ownership tracking data structure
- Store mutation action implementations (addChild, deleteNode, duplicateNode, moveNode, renameNode, etc.)
- New node defaults (UUID v4 generation, default status `not-started`, timestamps)
- Confirmation dialog design for non-leaf delete (must show child count per EDIT-03)
- `File > New` in-memory schema structure (single root node, default `statusConfig`)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 3 Requirements
- `.planning/REQUIREMENTS.md` §Editor (EDIT-01 through EDIT-18) — full acceptance criteria for each editor requirement

### Architecture & Data Model
- `.planning/PROJECT.md` §Architecture — two-process model, RPC contract, react-d3-tree performance notes, `dataKey` pattern
- `.planning/PROJECT.md` §Context — save behavior (debounced 2s, 30s periodic, flush on `before-quit`), atomic writes, `$ref` write-back, no undo/redo, `.bak.json` safety net, inline rename floating `<input>` pattern, Linux context menu no-op

### Prior Phase Context
- `.planning/phases/00-app-scaffold/00-CONTEXT.md` — monorepo structure, `@roadraven/` scope, `shared/types.ts` location
- `.planning/phases/01-visual-foundation-themes/01-CONTEXT.md` — Tailwind v4, `--rv-*` tokens, LogTape structured logging
- `.planning/phases/02-read-only-viewer/02-CONTEXT.md` — Zustand `roadmapStore` with `dataKey` pattern, react-d3-tree integration, `nodeIndex` Map, `SidePanel`, remark/rehype markdown rendering

### RPC Contract
- `shared/types.ts` — existing RPC contract; `saveFile` already stubbed; must be implemented in Phase 3

### Electrobun
- Electrobun LLM API reference: https://blackboard.sh/electrobun/llms.txt — check for `before-quit` event handling and file dialog APIs

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `roadmapStore.ts`: Zustand store with `dataKey` pattern, `nodeIndex` (flat `Map<string, RoadmapNode>`), `loadSchema()`, `reloadSchema()`, `updateNodeStatus()`. **Needs:** mutation actions (addChild, addSibling, deleteNode, duplicateNode, moveNode, renameNode, updateMetadata). Structural mutations must increment `dataKey`; metadata/notes changes do not.
- `RoadmapNodeCard`: Node component with status badges, collapse/expand chevron, selection outline (`outline-[var(--rv-accent)]`). **Needs:** dashed focus ring (separate from selection), inline rename trigger support.
- `SidePanel`: Read-only panel with title, status, type, dates, ID (copy button), markdown notes. **Needs:** edit mode toggle, CodeMirror 6 editor for notes, status/type dropdowns, editable metadata table, editable title field.
- `Canvas.tsx`: react-d3-tree integration with custom `renderCustomNodeElement`. **Needs:** context menu handler, keyboard event layer, focus management, inline rename overlay.
- `StatusBar.tsx`: Shows "Connected" + filename + node count. **Needs:** save indicator (`Saved ✓` / `Saving…` / `Error saving`).
- `MarkdownRenderer`: remark/rehype pipeline for notes preview mode — reuse as-is.
- `ResizeHandle`: Panel resize component — reuse as-is.

### Established Patterns
- Zustand + `useShallow` for performance-sensitive selectors
- RPC via `electroview.rpc.request.*` and `electroview.rpc.send.*`
- `--rv-*` CSS custom property tokens for all colors
- LogTape structured logging with hierarchical categories
- `dataKey` increment ONLY on structural mutations (add/delete/move/duplicate), NEVER on status/metadata changes

### Integration Points
- `shared/types.ts` — `saveFile` RPC stub exists, needs Bun-side implementation; may need `newFile` and `saveFileAs` additions
- `roadmapStore` — new mutation actions feed into `saveFile` via autosave debounce
- `StatusBar` — needs a `saveState` field from store (`saved` | `saving` | `error`)
- New dependency: **CodeMirror 6** (`@codemirror/state`, `@codemirror/view`, `@codemirror/lang-markdown`)
- New component: **ContextMenu** (custom `<div>`, not native)
- New component: **ConfirmationDialog** (for non-leaf delete)
- New layer: **KeyboardManager** (canvas-level keyboard event handler)

</code_context>

<specifics>
## Specific Ideas

- The `Enter = Add Child` / `Tab = Add Sibling` mapping reflects the user's mental model: Enter goes deeper, Tab stays alongside. This is the opposite of the Workflowy outliner convention — intentional choice.
- Context menu is a custom `<div>` everywhere (not just Linux fallback). Simplifies implementation to one codepath.
- Focus and selection are visually distinct: you can keyboard-navigate the tree (dashed focus ring) without changing what's shown in the side panel (solid selection ring). This lets users browse the tree structure without the panel constantly flickering.
- Panel opens in preview mode to avoid accidental edits. The edit button `[E]` is the primary entry point for editing.
- Notes split mode (editor + preview side-by-side) is particularly useful for longer markdown notes.
- Save failure escalation ensures the user is always aware — no silent data loss.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 03-full-editor*
*Context gathered: 2026-04-16*
