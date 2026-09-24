/**
 * DOM attribute names the a11y suites select on (v0.8.3 Phase 2, design
 * rule 5). Components render these; `tests/a11y/*` builds its selectors from
 * them, so a rename fails to compile instead of silently matching nothing.
 *
 * Dependency-free on purpose: Playwright loads this file outside Vite, so it
 * must import nothing that reaches a store, `../rpc` or `electrobun/*`. The
 * schema package is neither, so `NodeStatus`/`NodeStatusSchema` are fine.
 */

import {
	type NodeStatus,
	NodeStatusSchema,
} from "../../../../../packages/core/src/schema";

/** Node card: value is the node id (RoadmapNode.tsx). */
export const NODE_CARD_ATTR = "data-source-id";
/** `"true"` on the keyboard-focused card (RoadmapNode.tsx). */
export const NODE_FOCUSED_ATTR = "data-focused";
/** `"node"` on the card, marking it a node surface for theme rules. */
export const NODE_SURFACE_ATTR = "data-rv-surface";
/** Save-state dot in the top-bar document chip (DocumentChip.tsx). */
export const SAVE_STATE_ATTR = "data-save-state";

// -- Collapse chevron (v0.8.4 Phase 0) --------------------------------------
// Rendered by RoadmapNode.tsx; read by nodeCollapse.ts and
// tests/ui/canvas-comfort.spec.ts.

/** Chevron `aria-label` when the subtree is expanded (next click collapses it). */
export const CHEVRON_COLLAPSE_LABEL = "Collapse subtree";
/** Chevron `aria-label` when the subtree is collapsed (next click expands it). */
export const CHEVRON_EXPAND_LABEL = "Expand subtree";

// -- Theme editor (v0.8.3 Phase 5) ------------------------------------------
// Rendered by PreferencesDialog.tsx and components/ThemeEditor/*; selected
// on by tests/unit/ui/ThemeEditor.test.tsx and tests/a11y/editor.spec.ts.

/** Preferences → Theme row: opens the editor (a built-in is duplicated first). */
export const EDIT_THEME_LABEL = "Edit…";
/** The duplicate-name prompt's input label and submit button. */
export const THEME_NAME_LABEL = "New theme name";
export const CREATE_THEME_LABEL = "Create";

/** `aria-label` of the editor dialog. */
export const EDITOR_DIALOG_LABEL = "Theme editor";
export const EDITOR_HIDE_LABEL = "Hide";
export const EDITOR_PEEK_LABEL = "Peek at the canvas (hold)";
export const EDITOR_CLOSE_LABEL = "Close theme editor";
export const EDITOR_ADVANCED_LABEL = "Advanced";
export const EDITOR_RESET_LABEL = "Reset to derived";
export const EDITOR_DERIVED_TAG = "derived";
export const EDITOR_SUGGEST_FIX_LABEL = "Suggest fix";
export const EDITOR_DISCARD_LABEL = "Discard changes";
export const EDITOR_KEEP_EDITING_LABEL = "Keep editing";
/** The floating pill the dialog collapses to; its text is the accessible name. */
export const EDITOR_PILL_TESTID = "theme-editor-pill";
export function editorPillLabel(themeName: string): string {
	return `Editing ${themeName} — Show`;
}
/** `aria-label` of a field's native colour picker. */
export function editorSwatchLabel(fieldLabel: string): string {
	return `${fieldLabel} swatch`;
}
/** On a field's wrapper and on its text input: value is the `--rv-*` token. */
export const EDITOR_FIELD_ATTR = "data-token";
/** One contrast chip; `data-pair` is the pair id, `data-status` pass/warn/fail. */
export const EDITOR_CHIP_TESTID = "theme-editor-chip";
export const EDITOR_CHIP_PAIR_ATTR = "data-pair";
export const EDITOR_CHIP_STATUS_ATTR = "data-status";
/** Header line: "N required failures · M advisory". */
export const EDITOR_COUNTS_TESTID = "theme-editor-counts";
/** Header line: "Saved · just now" / "Saving…" / "Could not save: …". */
export const EDITOR_SAVE_STATUS_TESTID = "theme-editor-save-status";

// -- Theme picker: delete a user theme (v0.8.3 Phase 7, D-11) ---------------
// Rendered by ThemePicker.tsx; selected on by tests/unit/ui/ThemePicker.test.tsx
// and tests/a11y/editor.spec.ts.

/** `aria-label` of the "×" after a user theme's row in the picker menu. */
export function deleteThemeLabel(themeName: string): string {
	return `Delete theme ${themeName}`;
}
/** Title (accessible name) of the confirm dialog the "×" opens. */
export function deleteThemeTitle(themeName: string): string {
	return `Delete theme "${themeName}"?`;
}
export const DELETE_THEME_CONFIRM_LABEL = "Delete";
export const DELETE_THEME_CANCEL_LABEL = "Cancel";

// -- Node card visuals (v0.8.4 Phase 1) --------------------------------------
// Rendered by RoadmapNode.tsx; read by index.css (the in-progress scale),
// tests/unit/ui/RoadmapNode.visuals.test.tsx, tests/ui/canvas-comfort.spec.ts
// and tests/a11y/contrastSampler.ts.

/** On the card: value is the live node status (`in-progress`, ...). */
export const NODE_STATUS_ATTR = "data-status";
/** On the status ribbon across the card's top-right corner. */
export const NODE_RIBBON_ATTR = "data-ribbon";
/** On the in-progress progress line (`n / m done`, `last event Xs ago`). */
export const NODE_PROGRESS_ATTR = "data-progress";
/** On the node-type chip left of the status badge. */
export const NODE_TYPE_CHIP_ATTR = "data-type-chip";

// -- Layout knobs popover (v0.8.4 Phase 2) -----------------------------------
// Rendered by LayoutKnobsPopover.tsx (trigger lives in TopBar.tsx); selected
// on by tests/unit/ui and tests/ui/canvas-comfort.spec.ts.

/** `aria-label` of the button in the top bar that opens the popover. */
export const LAYOUT_KNOBS_TRIGGER_LABEL = "Layout options";
/** `aria-label` of the sibling-gap range input. */
export const KNOB_SIBLING_GAP_LABEL = "Sibling gap";
/** `aria-label` of the depth-gap range input. */
export const KNOB_DEPTH_GAP_LABEL = "Depth gap";
/** Accessible name of the density radio group. */
export const KNOB_DENSITY_LABEL = "Card density";
/** Label of the button that restores the three knobs to their defaults. */
export const KNOB_RESET_LABEL = "Reset";

// -- Custom layout (v0.8.4 Phase 3) -------------------------------------------
// Rendered by LayoutKnobsPopover.tsx and Canvas.tsx; written during a drag by
// hooks/useNodeDrag.ts; read by index.css, tests/unit/hooks/useNodeDrag.test.tsx
// and tests/ui/canvas-comfort.spec.ts (+ helpers/canvasGestures.ts).

/** Label of the popover checkbox that lets the user drag cards. */
export const CUSTOM_LAYOUT_LABEL = "Custom layout";
/** Label of the button that clears the current orientation's card offsets. */
export const RESET_POSITIONS_LABEL = "Reset positions";
/** `"true"` on the card while it is being dragged (cursor/shadow rule). */
export const NODE_DRAGGING_ATTR = "data-dragging";
/** On each card's foreignObject while custom layout is on: value is the node id. */
export const NODE_OFFSET_ATTR = "data-node-offset";
/** Class on the connector path INTO `targetId` (react-d3-tree pathClassFunc). */
export function linkClassFor(targetId: string): string {
	return `rv-link-to-${targetId}`;
}
/** Class on every connector path OUT OF `sourceId` (to its children). */
export function linkFromClassFor(sourceId: string): string {
	return `rv-link-from-${sourceId}`;
}

// -- Store-owned collapse (v0.8.4 Phase 4) ------------------------------------
// Rendered by ContextMenu.tsx (canvas-empty menu) and RoadmapNode.tsx (the
// chevron); selected on by tests/unit/ui/ContextMenu.test.tsx,
// tests/unit/ui/components.test.tsx and tests/ui/canvas-comfort.spec.ts.

/** The one chevron button a node card renders, whichever label it carries. */
export const CHEVRON_SELECTOR = 'button[aria-label$="subtree"]';
/** Canvas-empty menu item that expands every subtree. */
export const EXPAND_ALL_LABEL = "Expand all";
/** Canvas-empty menu item that collapses every node that has children. */
export const COLLAPSE_ALL_LABEL = "Collapse all";
/** Canvas-empty menu item: collapse the nodes at `depth` (root is depth 0). */
export function collapseToDepthLabel(depth: number): string {
	return `Collapse to depth ${depth}`;
}

// -- Structure keys (v0.8.4 Phase 5) -----------------------------------------
// Rendered by ContextMenu.tsx (Indent/Outdent items); read by
// useKeyboardRouter.ts (Alt+arrow indent/outdent, 1-4 status hotkeys) and
// selected on by tests/unit/ui/ContextMenu.test.tsx,
// tests/unit/hooks/useKeyboardRouter.test.ts and tests/ui/canvas-comfort.spec.ts.

/** Context-menu item: make the focused node the last child of its previous sibling. */
export const INDENT_LABEL = "Indent";
/** Context-menu item: move the focused node out to right after its parent. */
export const OUTDENT_LABEL = "Outdent";

/** `1`-`4` set node status, in `NodeStatusSchema.options` order. */
export const STATUS_HOTKEYS: Record<"1" | "2" | "3" | "4", NodeStatus> = {
	"1": NodeStatusSchema.options[0],
	"2": NodeStatusSchema.options[1],
	"3": NodeStatusSchema.options[2],
	"4": NodeStatusSchema.options[3],
};

// -- Undo / redo (v0.8.4 Phase 6) ---------------------------------------------
// Rendered by ContextMenu.tsx (canvas-empty menu); selected on by
// tests/unit/ui/ContextMenu.test.tsx.

/** Canvas-empty menu item: undo the last edit (Ctrl+Z). */
export const UNDO_LABEL = "Undo";
/** Canvas-empty menu item: redo the last undone edit (Ctrl+Y / Ctrl+Shift+Z). */
export const REDO_LABEL = "Redo";

// -- Structure keys (v0.8.4 Phase 7 UAT-3; one table since Phase 8) -----------
// The single source for the indent/outdent/move key bindings AND their menu
// hints: useKeyboardRouter.ts matches `key` (Alt for indent/outdent,
// Ctrl/Cmd for move), ContextMenu.tsx renders `hint`, keyed by the store's
// `layoutOrientation`. Indent follows the child (inward) direction, move the
// sibling axis. Selected on by tests/unit/hooks/useKeyboardRouter.test.ts and
// tests/unit/ui/ContextMenu.test.tsx.

const ARROW_GLYPHS = {
	ArrowUp: "↑",
	ArrowDown: "↓",
	ArrowLeft: "←",
	ArrowRight: "→",
} as const;

type StructureKey = { key: keyof typeof ARROW_GLYPHS; hint: string };

function bind(modifier: "Alt" | "Ctrl", key: StructureKey["key"]) {
	return { key, hint: `${modifier}+${ARROW_GLYPHS[key]}` };
}

/** Key bindings and menu hints for indent/outdent/move, by layout orientation. */
export const STRUCTURE_KEYS: Record<
	"TB" | "LR",
	Record<"indent" | "outdent" | "moveUp" | "moveDown", StructureKey>
> = {
	TB: {
		indent: bind("Alt", "ArrowDown"),
		outdent: bind("Alt", "ArrowUp"),
		moveUp: bind("Ctrl", "ArrowLeft"),
		moveDown: bind("Ctrl", "ArrowRight"),
	},
	LR: {
		indent: bind("Alt", "ArrowRight"),
		outdent: bind("Alt", "ArrowLeft"),
		moveUp: bind("Ctrl", "ArrowUp"),
		moveDown: bind("Ctrl", "ArrowDown"),
	},
};
