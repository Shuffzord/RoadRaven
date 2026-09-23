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
