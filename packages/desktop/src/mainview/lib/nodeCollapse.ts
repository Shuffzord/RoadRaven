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

/**
 * Expand a chain of ancestor nodes (top-down) so a descendant becomes visible,
 * then invoke `onDone`. A collapsed ancestor hides its whole subtree from the
 * DOM, so descendants' chevrons can't be clicked until each ancestor above
 * them is expanded — hence the top-down, frame-by-frame walk: expand the
 * highest collapsed ancestor, wait one frame for react-d3-tree to render its
 * children, then proceed to the next ancestor down.
 *
 * `onDone` runs on the frame after the last ancestor is processed (whether or
 * not anything needed expanding), so callers can pan/select once the target is
 * guaranteed to be in the DOM with a fresh position. Used by the header search
 * to reveal matches buried inside collapsed subtrees before centering them.
 *
 * Returns a cancel function. Because the walk spans multiple animation frames,
 * a caller that re-invokes on rapid input (typing, holding F3) would otherwise
 * launch overlapping rAF chains that race on the shared chevron DOM — an
 * earlier chain's `onDone` firing after a later chain has already moved on, or
 * two chains toggling the same chevron. Callers (e.g. a React effect) should
 * call the returned canceller in cleanup so only the latest walk completes.
 */
export function expandAncestors(
	pathTopDown: string[],
	onDone: () => void,
): () => void {
	let cancelled = false;
	const raf =
		typeof requestAnimationFrame === "function"
			? requestAnimationFrame
			: (cb: FrameRequestCallback) => setTimeout(() => cb(0), 0);

	const step = (i: number): void => {
		if (cancelled) return;
		if (i >= pathTopDown.length) {
			raf(() => {
				if (!cancelled) onDone();
			});
			return;
		}
		const id = pathTopDown[i];
		const { hasChildren, collapsed } = getNodeCollapseState(id);
		if (hasChildren && collapsed) {
			toggleNodeCollapse(id);
			// Wait for the expanded children to mount before reaching deeper.
			raf(() => step(i + 1));
		} else {
			step(i + 1);
		}
	};

	step(0);
	return () => {
		cancelled = true;
	};
}
