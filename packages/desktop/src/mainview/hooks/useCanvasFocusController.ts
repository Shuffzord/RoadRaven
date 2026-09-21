import { getLogger } from "@logtape/logtape";
import { type RefObject, useCallback, useEffect, useRef } from "react";
import { FOCUS_NODE_EVENT, type NodeFocusRequest } from "../lib/focusRequest";
import { findNodeCard } from "../lib/nodeCard";
import { expandAncestors } from "../lib/nodeCollapse";
import { computePanDelta } from "../lib/viewportMath";
import { getAncestorPath, useRoadmapStore } from "../store/roadmapStore";

/**
 * The reveal half of a focus request (v0.8.1 RC2, RC3, RC5, RC11).
 *
 * `requestNodeFocus` has already written the store; this hook, owned by
 * Canvas, makes the target visible: expand collapsed ancestors, wait for the
 * card to mount, measure the real rects and ask for one pan. Measuring the
 * DOM rather than remembered layout points is what fixes LR coordinates (RC2)
 * and the card-vs-layout-point offset (RC11), and makes a request for an
 * unmounted node impossible to satisfy from stale coordinates (RC5).
 */

const log = getLogger(["webview", "canvas", "focus"]);

/** Frames a request waits for its card before it is dropped. */
const MAX_WAIT_FRAMES = 30;

/**
 * Consecutive frames the container's size must agree on before measuring.
 *
 * Selecting a node opens the SidePanel, which animates its width over 200ms
 * (SidePanel.tsx) and shrinks the canvas with it. A CSS transition is only
 * created during the style recalc that FOLLOWS the commit, and rAF callbacks
 * run before that recalc — so the first two samples after a click can still
 * both read the pre-transition width. Three agreeing frames is past that
 * window, and once the transition is running every frame disagrees, so the
 * measurement lands after it finishes. Measuring early is what produced the
 * old click-pan + resize-re-pan pair (RC3).
 */
const SETTLE_FRAMES = 3;

export interface CanvasFocusControllerDeps {
	containerRef: RefObject<HTMLElement | null>;
	/** Move the camera by a screen-space delta. Canvas animates it. */
	panBy: (dx: number, dy: number) => void;
}

export function useCanvasFocusController({
	containerRef,
	panBy,
}: CanvasFocusControllerDeps): void {
	const dataKey = useRoadmapStore((s) => s.dataKey);
	const layoutOrientation = useRoadmapStore((s) => s.layoutOrientation);
	// At most one request is in flight; a newer one supersedes it (the same
	// cancel discipline expandAncestors uses for overlapping rAF walks).
	const cancelRef = useRef<(() => void) | null>(null);

	const reveal = useCallback(
		(request: NodeFocusRequest) => {
			cancelRef.current?.();
			let cancelled = false;
			let frame: number | null = null;
			let cancelExpand: (() => void) | null = null;
			cancelRef.current = () => {
				cancelled = true;
				cancelExpand?.();
				if (frame !== null) cancelAnimationFrame(frame);
			};

			const measure = (): void => {
				cancelRef.current = null;
				const card = findNodeCard(request.nodeId);
				const container = containerRef.current;
				if (!card || !container) return;
				const { dx, dy } = computePanDelta(
					card.getBoundingClientRect(),
					container.getBoundingClientRect(),
					request.align,
				);
				if (dx === 0 && dy === 0) return;
				panBy(dx, dy);
			};

			// Nothing to wait for: reveal in the same tick so key-repeat
			// navigation stays crisp. A `select` request is excluded because it
			// may open the SidePanel and shrink the canvas under us.
			if (!request.select && findNodeCard(request.nodeId)) {
				measure();
				return;
			}

			let waited = 0;
			let stable = 0;
			let lastSize = "";
			const poll = (): void => {
				if (cancelled) return;
				const container = containerRef.current;
				if (container && findNodeCard(request.nodeId)) {
					const rect = container.getBoundingClientRect();
					const size = `${rect.right - rect.left}x${rect.bottom - rect.top}`;
					stable = size === lastSize ? stable + 1 : 0;
					lastSize = size;
					if (stable >= SETTLE_FRAMES) {
						measure();
						return;
					}
				}
				waited += 1;
				if (waited >= MAX_WAIT_FRAMES) {
					cancelRef.current = null;
					log.warn("Focus request dropped: {nodeId} never became visible.", {
						nodeId: request.nodeId,
					});
					return;
				}
				frame = requestAnimationFrame(poll);
			};

			// Only a jump-to request (`center`: search, event log) may restructure
			// the tree to reach its node. A `nearest` reveal is camera work: it
			// must never un-collapse a subtree the user just collapsed — whether
			// a child-direction key should expand is `enterChild`'s decision
			// (A6, Phase 4), not the camera's.
			if (request.align === "center") {
				const { schema } = useRoadmapStore.getState();
				cancelExpand = expandAncestors(
					getAncestorPath(schema?.nodes ?? [], request.nodeId),
					poll,
				);
				return;
			}
			frame = requestAnimationFrame(poll);
		},
		[containerRef, panBy],
	);

	useEffect(() => {
		const handler = (e: Event): void => {
			reveal((e as CustomEvent<NodeFocusRequest>).detail);
		};
		window.addEventListener(FOCUS_NODE_EVENT, handler);
		return () => {
			window.removeEventListener(FOCUS_NODE_EVENT, handler);
			cancelRef.current?.();
		};
	}, [reveal]);

	// A7: every re-layout (reorder, delete-successor, layout toggle, the BUG-3
	// re-expansion) moves the focused card out from under the camera. Running
	// after the commit is what guarantees the card is measured in its NEW
	// position.
	// biome-ignore lint/correctness/useExhaustiveDependencies: dataKey and layoutOrientation are the trigger — a new tree layout — not values the effect reads.
	useEffect(() => {
		const { focusedNodeId } = useRoadmapStore.getState();
		if (!focusedNodeId) return;
		reveal({ nodeId: focusedNodeId, align: "nearest", select: false });
	}, [dataKey, layoutOrientation, reveal]);
}
