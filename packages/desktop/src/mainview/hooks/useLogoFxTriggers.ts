import { useEffect } from "react";
import {
	LOGO_FX_EVENT,
	LOGO_FX_SOURCE,
	type LogoFxRequest,
} from "../lib/logoFx/constants";
import {
	classifyLoad,
	detectActions,
	LOGO_FX_TRIGGERS,
	type LogoFxSnapshot,
	snapshotNodes,
} from "../lib/logoFx/triggers";
import { useEventApiStore } from "../store/eventApiStore";
import { useRoadmapStore } from "../store/roadmapStore";

type RoadmapState = ReturnType<typeof useRoadmapStore.getState>;

/** Asks for the effect of the most specific action between two snapshots. */
function requestEffect(prev: LogoFxSnapshot, next: LogoFxSnapshot): void {
	const [action] = detectActions(prev, next);
	if (!action) return;
	const detail: LogoFxRequest = {
		variant: LOGO_FX_TRIGGERS[action],
		source: LOGO_FX_SOURCE.ACTION,
	};
	window.dispatchEvent(new CustomEvent(LOGO_FX_EVENT, { detail }));
}

/** The snapshot after one roadmap store update; the tree is re-read only when the schema changed. */
function advance(
	snap: LogoFxSnapshot,
	prev: RoadmapState,
	next: RoadmapState,
): LogoFxSnapshot {
	const load = classifyLoad(prev, next);
	const nodes =
		next.schema === prev.schema
			? snap.nodes
			: snapshotNodes(next.schema?.nodes ?? []);
	return {
		...snap,
		nodes,
		baseline: snap.baseline + (load ? 1 : 0),
		opened: snap.opened + (load === "open" ? 1 : 0),
		saveState: next.saveState,
	};
}

/**
 * Turns app actions into logo effects (the D-1 map in LOGO_FX_TRIGGERS) by
 * watching the roadmap and event-API stores from outside React: no state,
 * no selectors, so it never renders anything. Each store update asks for at
 * most one effect, through LOGO_FX_EVENT; the player decides whether it plays.
 */
export function useLogoFxTriggers(): void {
	useEffect(() => {
		const roadmap = useRoadmapStore.getState();
		let snap: LogoFxSnapshot = {
			nodes: snapshotNodes(roadmap.schema?.nodes ?? []),
			baseline: 0,
			opened: 0,
			saveState: roadmap.saveState,
			connectedCount: useEventApiStore.getState().connectedCount,
		};
		// Updates in the same task as a load (the sidecar status overlay
		// applied right after loadSchema) belong to the load's baseline.
		let settling = false;

		const step = (next: LogoFxSnapshot): void => {
			if (!settling) requestEffect(snap, next);
			snap = next;
		};

		const unsubRoadmap = useRoadmapStore.subscribe((state, prev) => {
			const next = advance(snap, prev, state);
			const loaded = next.baseline !== snap.baseline;
			step(next);
			if (loaded && !settling) {
				settling = true;
				queueMicrotask(() => {
					settling = false;
				});
			}
		});
		const unsubEventApi = useEventApiStore.subscribe((state) => {
			step({ ...snap, connectedCount: state.connectedCount });
		});
		return () => {
			unsubRoadmap();
			unsubEventApi();
		};
	}, []);
}
