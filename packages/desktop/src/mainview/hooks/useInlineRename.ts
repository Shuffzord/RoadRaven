import { useCallback, useRef, useState } from "react";
import { useRoadmapStore } from "../store/roadmapStore";

export interface InlineRenameState {
	nodeId: string | null;
	screenPos: { x: number; y: number } | null;
	title: string;
}

export interface RenameTransform {
	x: number;
	y: number;
	k: number;
}

/**
 * Manages the floating inline-rename input overlay state.
 *
 * Position math (per research Pattern 2):
 *   screenX = localX * k + t.x + containerRect.left
 *   screenY = localY * k + t.y + containerRect.top
 *
 * - `localX/Y` are the node's coordinates in react-d3-tree's local SVG space
 *   (from hierarchyPointNode.x / .y).
 * - `t` is the current zoom transform from the tree's onUpdate callback.
 * - `containerRect` is the canvas container's getBoundingClientRect().
 */
export function useInlineRename() {
	const [state, setState] = useState<InlineRenameState>({
		nodeId: null,
		screenPos: null,
		title: "",
	});
	// Mirror the latest state in a ref so callbacks can read fresh values
	// without re-binding on every re-render. Avoids calling side-effects
	// (renameNode) inside functional setState updaters, which can execute
	// twice under React StrictMode / testing-library's act wrappers.
	const stateRef = useRef(state);
	stateRef.current = state;

	const open = useCallback(
		(
			nodeId: string,
			localX: number,
			localY: number,
			t: RenameTransform,
			rect: { left: number; top: number },
		) => {
			const node = useRoadmapStore.getState().nodeIndex.get(nodeId);
			const next: InlineRenameState = {
				nodeId,
				screenPos: {
					x: localX * t.k + t.x + rect.left,
					y: localY * t.k + t.y + rect.top,
				},
				title: node?.title ?? "",
			};
			stateRef.current = next;
			setState(next);
		},
		[],
	);

	const setTitle = useCallback((title: string) => {
		const next = { ...stateRef.current, title };
		stateRef.current = next;
		setState(next);
	}, []);

	const commit = useCallback(() => {
		const current = stateRef.current;
		if (current.nodeId && current.title.trim()) {
			useRoadmapStore
				.getState()
				.renameNode(current.nodeId, current.title.trim());
		}
		const next: InlineRenameState = {
			nodeId: null,
			screenPos: null,
			title: "",
		};
		stateRef.current = next;
		setState(next);
	}, []);

	const cancel = useCallback(() => {
		const next: InlineRenameState = {
			nodeId: null,
			screenPos: null,
			title: "",
		};
		stateRef.current = next;
		setState(next);
	}, []);

	const updateForTransform = useCallback(
		(
			localX: number,
			localY: number,
			t: RenameTransform,
			rect: { left: number; top: number },
		) => {
			const current = stateRef.current;
			if (!current.nodeId) return;
			const x = localX * t.k + t.x + rect.left;
			const y = localY * t.k + t.y + rect.top;
			// No-op guard: react-d3-tree's onUpdate can fire on every render. If
			// we always call setState here, we re-render → Canvas re-runs
			// useCallback → Tree sees a new onUpdate → Tree fires onUpdate → loop.
			// Breaking the loop on unchanged position keeps the overlay cheap.
			if (
				current.screenPos &&
				current.screenPos.x === x &&
				current.screenPos.y === y
			) {
				return;
			}
			const next: InlineRenameState = {
				...current,
				screenPos: { x, y },
			};
			stateRef.current = next;
			setState(next);
		},
		[],
	);

	return { state, open, setTitle, commit, cancel, updateForTransform };
}
