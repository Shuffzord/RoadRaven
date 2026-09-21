/**
 * The DOM is the canvas's node registry (v0.8.1 A3).
 *
 * react-d3-tree mounts one card per visible node, tagged `data-source-id`
 * (RoadmapNode.tsx). A node is therefore mounted exactly when its card is in
 * the document — collapsed subtrees, deleted nodes and a previously loaded
 * schema simply are not there. The Canvas used to keep its own `Map` of layout
 * positions instead, which was never pruned and happily answered for nodes
 * that had long since disappeared (RC5).
 *
 * Both lookups match on `dataset.sourceId` rather than a
 * `[data-source-id="..."]` selector, so arbitrary id characters need no
 * escaping (and `CSS.escape`, absent in jsdom, is never required) — the same
 * approach `lib/nodeCollapse.ts` already used for the chevron.
 */

const CARD_SELECTOR = "[data-source-id]";

/** Every node card currently mounted, in document order. */
export function listNodeCards(root: ParentNode = document): HTMLElement[] {
	return Array.from(root.querySelectorAll<HTMLElement>(CARD_SELECTOR));
}

/** The mounted card for `nodeId`, or null when the node is not rendered. */
export function findNodeCard(
	nodeId: string,
	root: ParentNode = document,
): HTMLElement | null {
	for (const el of root.querySelectorAll<HTMLElement>(CARD_SELECTOR)) {
		if (el.dataset.sourceId === nodeId) return el;
	}
	return null;
}
