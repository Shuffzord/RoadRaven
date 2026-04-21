# Phase 3: Full Editor - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-16
**Phase:** 03-full-editor
**Areas discussed:** Context menu structure, Keyboard nav & focus model, Side panel editor experience, External edit conflicts

---

## Context Menu Structure

| Option | Description | Selected |
|--------|-------------|----------|
| Flat with separators | All actions single level, grouped by separators. Status is a sub-menu. | ✓ |
| Nested sub-menus | Group related actions into sub-menus (Add ▶, Edit ▶, Move ▶). Cleaner top level but two clicks for common actions. | |
| Minimal + keyboard | Only 4-5 most-used actions in menu, everything else keyboard-only. | |

**User's choice:** Flat with separators
**Notes:** User emphasized that Add Child/Siblings also need keyboard shortcuts — keyboard-only navigation is important.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Enter=child, Tab=sibling | Enter = Add Child (go deeper). Tab = Add Sibling Below (same level). Shift+Enter = Add Sibling Above. | ✓ |
| Outliner model (Enter=sibling, Tab=child) | Enter = Add Sibling Below (like Workflowy). Tab = Add Child (indent). | |

**User's choice:** Enter=child, Tab=sibling
**Notes:** User's mental model: Enter creates underneath, Tab creates alongside. This was clarified after initial confusion — user explicitly chose this over the outliner convention.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, with subset | Right-click on empty canvas shows: Paste, Add Root Child, Fit to View, Toggle Layout. | ✓ |
| No, nodes only | Context menu only on nodes. Canvas right-click does nothing. | |

**User's choice:** Yes, with subset

---

| Option | Description | Selected |
|--------|-------------|----------|
| Use custom div everywhere | Skip native ContextMenu.showContextMenu() entirely. One implementation, consistent behavior. | ✓ |
| Native on macOS/Windows, custom on Linux | Platform-native look on supported platforms, fallback on Linux. Two codepaths. | |

**User's choice:** Use custom div everywhere

---

## Keyboard Nav & Focus Model

| Option | Description | Selected |
|--------|-------------|----------|
| Distinct focus + selection rings | Focus = dashed outline, Selection = solid accent outline. Both can coexist. Focus-visible behavior. | ✓ |
| Combined focus = selection | Arrow keys both move focus AND select. Simpler but less flexible. | |
| You decide | Let Claude pick. | |

**User's choice:** Distinct focus + selection rings

---

| Option | Description | Selected |
|--------|-------------|----------|
| Tab toggles canvas/panel | Tab moves focus between canvas and panel. F6 also available. | ✓ |
| F6 toggles, Tab is always add-child | Tab always means Add Child. F6 is the only way to switch focus areas. | |
| You decide | Let Claude pick. | |

**User's choice:** Tab toggles canvas/panel (with F6 as the switch key from the preview)
**Notes:** The selected preview showed F6 for toggle and Tab for add-child within canvas context.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Space = select | Space selects focused node and opens panel. ARIA listbox pattern. | ✓ |
| Click-only selection | Mouse click selects. Keyboard focus is separate from selection. | |
| Enter = select, Ctrl+Enter = add sibling | Keep Enter as activate, modifier combos for node creation. | |

**User's choice:** Space = select
**Notes:** This resolved a conflict — Enter was initially shown as "select + open panel" but was already committed to "Add Child" from the context menu shortcuts.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Context-aware Ctrl+C | Canvas focused = copy node as JSON. Text input focused = browser text copy. | ✓ |
| Always Ctrl+Shift+C for nodes | Ctrl+C always does browser text copy. Ctrl+Shift+C for node copy. | |
| You decide | Let Claude pick. | |

**User's choice:** Context-aware Ctrl+C

---

## Side Panel Editor Experience

| Option | Description | Selected |
|--------|-------------|----------|
| Preview mode, click to edit | Panel opens read-only. Click field or edit button to switch to edit mode. | ✓ |
| Always editable | Panel opens in edit mode immediately. Title is input, status is dropdown. | |
| Smart: edit if keyboard, preview if click | Adapts based on selection method. | |

**User's choice:** Preview mode, click to edit

---

| Option | Description | Selected |
|--------|-------------|----------|
| Segmented toggle in notes header | [Edit\|Preview\|Split] control above notes. Default Preview. Split = side-by-side. | ✓ |
| Inline toggle (click-to-edit) | No explicit mode control. Click notes to edit, blur to preview. No split. | |
| You decide | Let Claude pick. | |

**User's choice:** Segmented toggle in notes header

---

| Option | Description | Selected |
|--------|-------------|----------|
| Add/edit/delete rows | Table with inline-editable key+value columns. [+] to add, [x] to remove. | ✓ |
| JSON editor for metadata | Raw JSON in CodeMirror. Full flexibility but requires JSON knowledge. | |
| You decide | Let Claude pick. | |

**User's choice:** Add/edit/delete rows

---

| Option | Description | Selected |
|--------|-------------|----------|
| Both canvas + panel | Double-click/F2 on canvas = inline rename. Panel edit mode = editable title field. Both sync. | ✓ |
| Canvas only (F2 / double-click) | Title editable only on canvas via inline rename. | |
| Panel only | Title editable only in side panel. | |

**User's choice:** Both canvas + panel

---

## External Edit Conflicts

| Option | Description | Selected |
|--------|-------------|----------|
| Warn + let user choose | Non-blocking toast: "Reload" or "Keep mine". Autosave pauses until resolved. | ✓ |
| Always reload (external wins) | External change always wins, auto-reload discards edits. | |
| Always keep mine (internal wins) | Ignore external changes while dirty. Next autosave overwrites. | |
| You decide | Let Claude pick. | |

**User's choice:** Warn + let user choose

---

| Option | Description | Selected |
|--------|-------------|----------|
| Escalating status bar + retry | 1st: auto-retry 5s. 2nd: click to retry. 3rd: modal with Retry/Save As/Dismiss. | ✓ |
| Silent retry, toast on 3rd failure | Background retries, only surface error after 3 failures. | |
| You decide | Let Claude pick. | |

**User's choice:** Escalating status bar + retry

---

## Claude's Discretion

- Floating `<input>` positioning math for inline rename
- Context menu render pipeline (50ms target)
- CodeMirror 6 extension configuration
- Autosave implementation details
- Atomic write implementation
- `$ref` file ownership tracking
- Store mutation actions
- New node defaults
- Confirmation dialog design for non-leaf delete

## Deferred Ideas

None — discussion stayed within phase scope.
