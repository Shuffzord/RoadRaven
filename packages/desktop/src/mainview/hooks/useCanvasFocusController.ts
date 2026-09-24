import { getLogger } from "@logtape/logtape";
import { type RefObject, useCallback, useEffect, useRef } from "react";
import {
	FOCUS_NODE_EVENT,
	type NodeFocusRequest,
	requestNodeFocus,
} from "../lib/focusRequest";
import { findNodeCard } from "../lib/nodeCard";
import { expandAncestors } from "../lib/nodeCollapse";
import { computePanDelta } from "../lib/viewportMath";
import { type FileViewState, useFileViewStore } from "../store/fileViewStore";
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

/** Controls the user may be typing into — never take focus from one. */
function isEditable(el: Element): boolean {
	return (
		el.tagName === "INPUT" ||
		el.tagName === "TEXTAREA" ||
		(el as HTMLElement).isContentEditable
	);
}

/**
 * True while the browser is handing focus from one element to another.
 *
 * `document.activeElement` reads `<body>` twice over: when focus really is
 * nowhere (a rename commit unmounted its input) and, for one moment, in the
 * middle of a transfer — `focusout` fires with `activeElement` already reset
 * to `<body>`, and only afterwards does the new element get `focusin`. A
 * blur-commit runs inside exactly that window: the commit bumps `dataKey`,
 * React flushes the A7 re-reveal synchronously from the `focusout` handler,
 * and a canvas that only checked `activeElement` would win a race against the
 * field the user clicked (A8). `relatedTarget` is what tells the two apart —
 * a removal leaves it null.
 */
let focusIsMoving = false;

function trackFocusTransfer(e: FocusEvent): void {
	focusIsMoving = e.type === "focusout" && e.relatedTarget !== null;
}

/**
 * True while the controller itself is moving DOM focus.
 *
 * `card.focus()` dispatches `focusin` synchronously, and the card answers a
 * keyboard-originated focus with a `nearest` request of its own, so Tab never
 * lands on a card the user cannot see. Without this the reveal would re-enter
 * itself and pan twice off one key press, the second time measuring a card
 * that is already mid-animation.
 */
let revealingFocus = false;

/**
 * Hand the revealed card real DOM focus — without ever stealing it (RC8).
 *
 * Logical focus and DOM focus used to be two unrelated things: arrow keys
 * moved only the store, and a rename commit unmounted its input and dropped
 * focus on `<body>`. The reveal is the one place that knows which card just
 * became the target, so it is also where the two are joined.
 *
 * The guard is the whole design: take focus only when it is nowhere (`<body>`
 * or null — exactly what a rename commit leaves behind) or already on the
 * canvas. The header search box while matches are followed, a SidePanel field
 * after a blur-commit (A8), the event-log drawer, an open Radix menu and the
 * card's own rename input are all places the user put focus on purpose.
 *
 * `preventScroll` because `overflow-hidden` never made the container
 * unscrollable programmatically (P0-6a/b); the container is `overflow: clip`
 * now as well, which is the layer native Tab focus needs.
 */
function focusCard(card: HTMLElement, container: HTMLElement): void {
	if (focusIsMoving) return;
	const active = document.activeElement;
	if (active && active !== document.body) {
		if (!container.contains(active) || isEditable(active)) return;
	}
	revealingFocus = true;
	try {
		card.focus({ preventScroll: true });
	} finally {
		revealingFocus = false;
	}
}

/**
 * Keep `focusedNodeId` on a card that is mounted, across a collapse (RC6).
 *
 * Collapsing a subtree unmounts every descendant card. Phase 0 recorded what
 * that costs when focus was inside it: NO card shows focus, and the next
 * sibling key resolves inside the hidden subtree too, so the canvas stays
 * blank-focused until a mouse click. Every collapse — the `C` key, the
 * chevron, the context menu, "Collapse all" / "to depth" — is a write to
 * `fileViewStore.collapsedIds` (v0.8.4 Phase 4), so one store subscription
 * covers all of them.
 *
 * Only FOCUS is corrected. Selection drives the SidePanel — what the user
 * chose to inspect — and a collapse is a structural action, not a change of
 * subject; a selected-but-hidden node still shows correctly and lights up
 * again when its ancestor re-expands. Invisible focus is what strands the
 * keyboard.
 *
 * Only an ADDED id can hide anything, so an expand never moves focus. Focus
 * goes to the topmost collapsed ancestor — the card that is still mounted —
 * one frame later, once the collapse has rendered and the card sits in its
 * new place for the reveal to measure.
 */
function focusOutOfCollapsed(
	state: Pick<FileViewState, "collapsedIds">,
	prev: Pick<FileViewState, "collapsedIds">,
): void {
	const { collapsedIds } = state;
	if (collapsedIds === prev.collapsedIds) return;
	if (![...collapsedIds].some((id) => !prev.collapsedIds.has(id))) return;
	const { focusedNodeId, schema } = useRoadmapStore.getState();
	if (!focusedNodeId) return;
	const target = getAncestorPath(schema?.nodes ?? [], focusedNodeId).find(
		(id) => collapsedIds.has(id),
	);
	if (!target) return;
	requestAnimationFrame(() => {
		// Something else claimed focus in the meantime; leave it alone.
		if (useRoadmapStore.getState().focusedNodeId !== focusedNodeId) return;
		requestNodeFocus(target, { align: "nearest" });
	});
}

export interface CanvasFocusControllerDeps {
	containerRef: RefObject<HTMLElement | null>;
	/** Move the camera by a screen-space delta. Canvas animates it. */
	panBy: (dx: number, dy: number) => void;
	/** Open the inline rename input on a node. Canvas owns that state. */
	openRename: (nodeId: string) => void;
}

export function useCanvasFocusController({
	containerRef,
	panBy,
	openRename,
}: CanvasFocusControllerDeps): void {
	const dataKey = useRoadmapStore((s) => s.dataKey);
	const layoutOrientation = useRoadmapStore((s) => s.layoutOrientation);
	// At most one request is in flight; a newer one supersedes it (the same
	// cancel discipline expandAncestors uses for overlapping rAF walks).
	const cancelRef = useRef<(() => void) | null>(null);
	/** Node the in-flight request is for, so A7 does not supersede it. */
	const pendingRef = useRef<string | null>(null);

	const reveal = useCallback(
		(request: NodeFocusRequest) => {
			// Our own focus() call, answered by the card — already being served.
			if (revealingFocus) return;
			cancelRef.current?.();
			let cancelled = false;
			let frame: number | null = null;
			let cancelExpand: (() => void) | null = null;
			pendingRef.current = request.nodeId;
			cancelRef.current = () => {
				cancelled = true;
				cancelExpand?.();
				if (frame !== null) cancelAnimationFrame(frame);
			};

			const measure = (): void => {
				cancelRef.current = null;
				pendingRef.current = null;
				const card = findNodeCard(request.nodeId);
				const container = containerRef.current;
				if (!card || !container) return;
				// Before the pan, and unconditionally: a card that needs no
				// camera move still needs DOM focus to follow the store.
				focusCard(card, container);
				const { dx, dy } = computePanDelta(
					card.getBoundingClientRect(),
					container.getBoundingClientRect(),
					request.align,
				);
				if (dx !== 0 || dy !== 0) panBy(dx, dy);
				// Last, so the measurement above is taken on the card as the
				// reveal found it. A rename is explicit user intent, so it runs
				// whether or not `focusCard` was allowed to move DOM focus — the
				// input focuses itself (RoadmapNode.tsx).
				if (request.rename) openRename(request.nodeId);
			};

			// Nothing to wait for: reveal in the same tick so key-repeat
			// navigation stays crisp. A `select` request is excluded because it
			// may open the SidePanel and shrink the canvas under us. A `rename`
			// request is excluded because the input must not open inside the
			// dispatch that asked for it: a Radix menu item's `onSelect` runs
			// while the menu's FocusScope is still mounted and trapping, and it
			// pulls focus straight back out of anything outside the menu
			// (@radix-ui/react-focus-scope 1.1.9 `handleFocusIn`) — which blurs
			// the input and blur-commits its placeholder. Polling costs
			// SETTLE_FRAMES+1 frames, long past the menu's unmount and the
			// setTimeout(0) its focus restore runs in.
			if (!request.select && !request.rename && findNodeCard(request.nodeId)) {
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
					pendingRef.current = null;
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
		[containerRef, panBy, openRename],
	);

	useEffect(() => {
		const handler = (e: Event): void => {
			reveal((e as CustomEvent<NodeFocusRequest>).detail);
		};
		window.addEventListener(FOCUS_NODE_EVENT, handler);
		// Capture, so the flag is already set when React runs the onBlur that
		// commits a rename inside the same focusout dispatch.
		window.addEventListener("focusout", trackFocusTransfer, true);
		window.addEventListener("focusin", trackFocusTransfer, true);
		// RC6: every collapse is a store write.
		const unsubCollapse = useFileViewStore.subscribe(focusOutOfCollapsed);
		return () => {
			window.removeEventListener(FOCUS_NODE_EVENT, handler);
			window.removeEventListener("focusout", trackFocusTransfer, true);
			window.removeEventListener("focusin", trackFocusTransfer, true);
			unsubCollapse();
			focusIsMoving = false;
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
		// A request already in flight for this node measures after the new
		// layout anyway, and it may carry intent this re-reveal does not — a
		// create's `center` + `rename`. Creating bumps `dataKey` itself, so
		// without this every create-and-rename would be superseded on the very
		// commit that mounts its card (RC4).
		if (pendingRef.current === focusedNodeId) return;
		reveal({
			nodeId: focusedNodeId,
			align: "nearest",
			select: false,
			rename: false,
		});
	}, [dataKey, layoutOrientation, reveal]);
}
