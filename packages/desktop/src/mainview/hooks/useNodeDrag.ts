import type React from "react";
import { useRef } from "react";
import {
	linkClassFor,
	linkFromClassFor,
	NODE_CARD_ATTR,
	NODE_DRAGGING_ATTR,
	NODE_OFFSET_ATTR,
} from "../lib/domContract";
import {
	type LayoutLink,
	offsetLink,
	stepEndpoints,
	stepPath,
} from "../lib/linkPath";
import {
	effectiveOffset,
	type Offset,
	type Orientation,
	screenDeltaToCanvas,
	ZERO_OFFSET,
} from "../lib/nodeOffsets";
import { useFileViewStore } from "../store/fileViewStore";
import { useRoadmapStore } from "../store/roadmapStore";

/** Below this travel (screen px) a press is a click, never a 1px move. */
const DRAG_THRESHOLD_PX = 4;

/** Presses on these stay theirs (chevron, rename input) and never drag. */
const CONTROL_SELECTOR = "button, input, textarea, select";

export interface NodeDragHandlers {
	onPointerDown: (e: React.PointerEvent<HTMLElement>) => void;
	onPointerMove: (e: React.PointerEvent<HTMLElement>) => void;
	onPointerUp: (e: React.PointerEvent<HTMLElement>) => void;
	onPointerCancel: (e: React.PointerEvent<HTMLElement>) => void;
}

interface DraggedLink {
	el: Element;
	original: string | null;
	link: LayoutLink;
	/** Which endpoint is the dragged node. */
	end: "source" | "target";
}

interface DragSession {
	pointerId: number;
	nodeId: string;
	card: HTMLElement;
	startX: number;
	startY: number;
	k: number;
	orientation: Orientation;
	base: Offset;
	/** The card's foreignObject (NODE_OFFSET_ATTR); its x/y carry the offset. */
	placed: Element | null;
	originalX: string | null;
	originalY: string | null;
	links: DraggedLink[];
	dragging: boolean;
	delta: Offset;
	frame: number | null;
}

function collectLinks(nodeId: string, orientation: Orientation): DraggedLink[] {
	const out: DraggedLink[] = [];
	const add = (className: string, end: DraggedLink["end"]): void => {
		for (const el of Array.from(document.getElementsByClassName(className))) {
			const original = el.getAttribute("d");
			const link = stepEndpoints(original, orientation);
			if (link) out.push({ el, original, link, end });
		}
	};
	add(linkClassFor(nodeId), "target");
	add(linkFromClassFor(nodeId), "source");
	return out;
}

/** Writes one drag frame straight to the DOM — never through React. */
function paint(s: DragSession, delta: Offset): void {
	s.placed?.setAttribute("x", String(Number(s.originalX) + delta.dx));
	s.placed?.setAttribute("y", String(Number(s.originalY) + delta.dy));
	for (const l of s.links) {
		const offsets =
			l.end === "target"
				? { source: ZERO_OFFSET, target: delta }
				: { source: delta, target: ZERO_OFFSET };
		const { source, target } = offsetLink(l.link, offsets, s.orientation);
		l.el.setAttribute("d", stepPath(source, target, s.orientation));
	}
}

/** Puts back exactly what React rendered (a cancelled drag). */
function restore(s: DragSession): void {
	if (s.originalX !== null) s.placed?.setAttribute("x", s.originalX);
	if (s.originalY !== null) s.placed?.setAttribute("y", s.originalY);
	for (const l of s.links) {
		if (l.original !== null) l.el.setAttribute("d", l.original);
	}
}

function startDragging(s: DragSession): void {
	s.dragging = true;
	s.links = collectLinks(s.nodeId, s.orientation);
	s.card.setAttribute(NODE_DRAGGING_ATTR, "true");
}

function openSession(
	e: React.PointerEvent<HTMLElement>,
	k: number,
): DragSession | null {
	if (e.button !== 0) return null;
	const card = e.currentTarget;
	const target = e.target as Element | null;
	if (target !== card && target?.closest(CONTROL_SELECTOR)) return null;
	const nodeId = card.getAttribute(NODE_CARD_ATTR);
	if (!nodeId) return null;
	const orientation = useRoadmapStore.getState().layoutOrientation;
	const placed = card.closest(`[${NODE_OFFSET_ATTR}]`);
	return {
		pointerId: e.pointerId,
		nodeId,
		card,
		startX: e.clientX,
		startY: e.clientY,
		k,
		orientation,
		base: effectiveOffset(useFileViewStore.getState(), orientation, nodeId),
		placed,
		originalX: placed?.getAttribute("x") ?? null,
		originalY: placed?.getAttribute("y") ?? null,
		links: [],
		dragging: false,
		delta: ZERO_OFFSET,
		frame: null,
	};
}

/**
 * v0.8.4 Phase 3 — drag a card under custom layout. While the pointer is
 * down, the card's foreignObject x/y and its connectors are updated on the DOM
 * once per animation frame; the store is written exactly once, on
 * pointer-up (a store write per frame would re-render every card — the
 * v0.8.1 lesson). A press that never travels DRAG_THRESHOLD_PX stays a
 * plain click; the click that follows a real drag is swallowed through
 * `consumeDragClick`.
 *
 * `drag` has one identity for the component's lifetime so RoadmapNodeCard's
 * memo still compares it by value; handlers read the node id from the card's
 * NODE_CARD_ATTR, not from a closure. d3-zoom never pans during a card drag:
 * react-d3-tree's zoom filter (hasInteractiveNodes) ignores presses that
 * start on a card.
 */
export function useNodeDrag(getZoom: () => number): {
	drag: NodeDragHandlers;
	consumeDragClick: () => boolean;
} {
	const getZoomRef = useRef(getZoom);
	getZoomRef.current = getZoom;
	const sessionRef = useRef<DragSession | null>(null);
	const suppressClickRef = useRef(false);

	const apiRef = useRef<{
		drag: NodeDragHandlers;
		consumeDragClick: () => boolean;
	} | null>(null);
	if (apiRef.current) return apiRef.current;

	const finish = (
		e: React.PointerEvent<HTMLElement>,
		commit: boolean,
	): void => {
		const s = sessionRef.current;
		if (!s || s.pointerId !== e.pointerId) return;
		sessionRef.current = null;
		if (s.frame !== null) cancelAnimationFrame(s.frame);
		if (s.card.hasPointerCapture?.(s.pointerId)) {
			s.card.releasePointerCapture(s.pointerId);
		}
		if (!s.dragging) return;
		s.card.removeAttribute(NODE_DRAGGING_ATTR);
		if (!commit) {
			restore(s);
			return;
		}
		paint(s, s.delta);
		suppressClickRef.current = true;
		useFileViewStore.getState().setNodeOffset(s.orientation, s.nodeId, {
			dx: s.base.dx + s.delta.dx,
			dy: s.base.dy + s.delta.dy,
		});
	};

	const drag: NodeDragHandlers = {
		onPointerDown: (e) => {
			suppressClickRef.current = false;
			const s = openSession(e, getZoomRef.current());
			if (!s) return;
			sessionRef.current = s;
			e.currentTarget.setPointerCapture?.(e.pointerId);
		},
		onPointerMove: (e) => {
			const s = sessionRef.current;
			if (!s || s.pointerId !== e.pointerId) return;
			const screen = { dx: e.clientX - s.startX, dy: e.clientY - s.startY };
			if (!s.dragging) {
				if (Math.hypot(screen.dx, screen.dy) < DRAG_THRESHOLD_PX) return;
				startDragging(s);
			}
			s.delta = screenDeltaToCanvas(screen, s.k);
			if (s.frame === null) {
				s.frame = requestAnimationFrame(() => {
					s.frame = null;
					paint(s, s.delta);
				});
			}
		},
		onPointerUp: (e) => finish(e, true),
		onPointerCancel: (e) => finish(e, false),
	};

	const consumeDragClick = (): boolean => {
		const suppressed = suppressClickRef.current;
		suppressClickRef.current = false;
		return suppressed;
	};

	apiRef.current = { drag, consumeDragClick };
	return apiRef.current;
}
