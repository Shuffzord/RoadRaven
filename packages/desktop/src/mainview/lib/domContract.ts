/**
 * DOM attribute names the a11y suites select on (v0.8.3 Phase 2, design
 * rule 5). Components render these; `tests/a11y/*` builds its selectors from
 * them, so a rename fails to compile instead of silently matching nothing.
 *
 * Dependency-free on purpose: Playwright loads this file outside Vite, so it
 * must import nothing that reaches a store, `../rpc` or `electrobun/*`.
 */

/** Node card: value is the node id (RoadmapNode.tsx). */
export const NODE_CARD_ATTR = "data-source-id";
/** `"true"` on the keyboard-focused card (RoadmapNode.tsx). */
export const NODE_FOCUSED_ATTR = "data-focused";
/** `"node"` on the card, marking it a node surface for theme rules. */
export const NODE_SURFACE_ATTR = "data-rv-surface";
/** Save-state dot in the top-bar document chip (DocumentChip.tsx). */
export const SAVE_STATE_ATTR = "data-save-state";

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
