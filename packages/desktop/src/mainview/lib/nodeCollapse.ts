/**
 * Programmatic collapse/expand for canvas nodes.
 *
 * react-d3-tree owns subtree collapse state internally (`nodeDatum.__rd3t.collapsed`),
 * and the only toggle handle (`toggleNode`) is available solely inside the
 * canvas's `renderCustomNodeElement` callback — out of reach of the keyboard
 * router and the context menu. Rather than mirror that state (which historically
 * fought the dataKey/re-clone machinery — see
 * `.planning/debug/roadmap-collapse-keybind-regression.md`), we drive the exact
 * same proven path the mouse uses: click the node card's chevron button.
 *
 * The card renders with `data-source-id={nodeId}` (RoadmapNode.tsx) and the
 * chevron carries `aria-label="Collapse subtree" | "Expand subtree"`.
 */

const EXPAND_LABEL = "Expand subtree";

function findChevron(nodeId: string): HTMLButtonElement | null {
	// Match by dataset value rather than a `[data-source-id="..."]` selector so
	// arbitrary id characters need no escaping (and `CSS.escape`, absent in
	// jsdom, is never required).
	let card: HTMLElement | null = null;
	for (const el of document.querySelectorAll<HTMLElement>("[data-source-id]")) {
		if (el.dataset.sourceId === nodeId) {
			card = el;
			break;
		}
	}
	return (
		card?.querySelector<HTMLButtonElement>('button[aria-label$="subtree"]') ??
		null
	);
}

/** Collapse state of a node as currently rendered on the canvas. */
export function getNodeCollapseState(nodeId: string): {
	/** True when the node has a chevron (i.e. it has children). */
	hasChildren: boolean;
	/** True when the subtree is currently collapsed. */
	collapsed: boolean;
} {
	const chevron = findChevron(nodeId);
	if (!chevron) return { hasChildren: false, collapsed: false };
	return {
		hasChildren: true,
		collapsed: chevron.getAttribute("aria-label") === EXPAND_LABEL,
	};
}

/**
 * Toggle collapse/expand on a node's subtree. No-op (returns false) when the
 * node has no children, so no chevron exists to click.
 */
export function toggleNodeCollapse(nodeId: string): boolean {
	const chevron = findChevron(nodeId);
	if (!chevron) return false;
	chevron.click();
	return true;
}
