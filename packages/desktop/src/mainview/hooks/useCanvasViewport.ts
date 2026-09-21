import { useCallback, useEffect, useRef } from "react";
import { useRoadmapStore } from "../store/roadmapStore";

/**
 * Viewport truth for the canvas (v0.8.1 RC1).
 *
 * The store owns `translate` + `zoomLevel` and feeds them to react-d3-tree as
 * props, but d3 owns them during a pan/zoom gesture and only reports them
 * back through `onUpdate`. Writing every gesture frame into the store
 * re-renders all ~300 node cards and re-runs the d3 layout (measured p95
 * 50ms vs 17ms per frame on the 300-node fixture), so a gesture is mirrored
 * here and written to the store once it settles — on `flushViewport` (the
 * pointer coming up, or a programmatic pan starting) or after
 * VIEWPORT_SYNC_MS, whichever comes first.
 *
 * There is still only one source of truth: the mirror is non-null only while
 * the store is known to be behind, and `getTransform` is what everything asks
 * for "where is the camera now".
 */

/**
 * How long after the last gesture event the store is brought up to date.
 * Long enough that a continuous drag/wheel never pays for a re-render, short
 * enough that the next keyboard or menu command already sees the truth.
 */
const VIEWPORT_SYNC_MS = 120;

export interface CanvasViewport {
	/** The live transform: the in-flight gesture's, else the store's. */
	getTransform: () => { x: number; y: number; k: number };
	/** Publish a pending gesture now, as one translate + zoom write. */
	flushViewport: () => void;
	/** Report one `onUpdate` payload from the tree. */
	syncGesture: (translate: { x: number; y: number }, zoom: number) => void;
}

export function useCanvasViewport(): CanvasViewport {
	const setViewport = useRoadmapStore((s) => s.setViewport);
	const gestureRef = useRef<{ x: number; y: number; k: number } | null>(null);
	const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const getTransform = useCallback((): { x: number; y: number; k: number } => {
		const live = gestureRef.current;
		if (live) return live;
		const s = useRoadmapStore.getState();
		return { x: s.translate.x, y: s.translate.y, k: s.zoomLevel };
	}, []);

	const dropPending = useCallback(() => {
		if (syncTimerRef.current !== null) {
			clearTimeout(syncTimerRef.current);
			syncTimerRef.current = null;
		}
		gestureRef.current = null;
	}, []);

	const flushViewport = useCallback(() => {
		const live = gestureRef.current;
		dropPending();
		if (live) setViewport({ x: live.x, y: live.y }, live.k);
	}, [setViewport, dropPending]);

	const syncGesture = useCallback(
		(translate: { x: number; y: number }, zoom: number) => {
			// A payload equal to the store is react-d3-tree echoing the props it
			// was just handed (componentDidUpdate), never a gesture: it must not
			// restart the sync, and it must not overwrite a live gesture value
			// with the stale props that triggered the render.
			const s = useRoadmapStore.getState();
			if (
				s.translate.x === translate.x &&
				s.translate.y === translate.y &&
				s.zoomLevel === zoom
			) {
				return;
			}
			gestureRef.current = { x: translate.x, y: translate.y, k: zoom };
			if (syncTimerRef.current !== null) clearTimeout(syncTimerRef.current);
			syncTimerRef.current = setTimeout(flushViewport, VIEWPORT_SYNC_MS);
		},
		[flushViewport],
	);

	// Any viewport command (reset view, MCP camera, a pan frame) makes the
	// store authoritative again, so a gesture value still waiting to be synced
	// is history and must not be replayed over it.
	useEffect(
		() =>
			useRoadmapStore.subscribe((s, prev) => {
				if (s.translate !== prev.translate || s.zoomLevel !== prev.zoomLevel) {
					dropPending();
				}
			}),
		[dropPending],
	);
	useEffect(() => dropPending, [dropPending]);

	return { getTransform, flushViewport, syncGesture };
}
