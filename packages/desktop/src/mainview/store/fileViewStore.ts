import { create } from "zustand";
import type { RoadmapNode } from "../../../../../packages/core/src/schema";
import { idsAtDepth } from "../lib/collapseTree";
import {
	clampKnobs,
	KNOB_DEFAULTS,
	type LayoutKnobs,
} from "../lib/layoutKnobs";
import {
	clampOffsets,
	EMPTY_NODE_OFFSETS,
	type NodeOffsets,
	type Offset,
	type Orientation,
} from "../lib/nodeOffsets";

/**
 * v0.8.4 Phase 2 — the ONLY owner of `layoutKnobs` for the currently open
 * file: sibling gap, depth gap and card density. `useFileViewSettings`
 * restores it from `fileSettings[path].layoutKnobs` on open and persists it
 * back on change; orientation stays on `roadmapStore.layoutOrientation`.
 *
 * v0.8.4 Phase 3 — also the ONLY owner of custom layout: the on/off switch
 * and the per-orientation card offsets. Only `useNodeDrag` (on pointer-up)
 * and the popover's Reset write offsets; the roadmap JSON never sees them.
 */
export interface FileViewState {
	layoutKnobs: LayoutKnobs;
	setKnob: <K extends keyof LayoutKnobs>(
		name: K,
		value: LayoutKnobs[K],
	) => void;
	resetKnobs: () => void;
	/** Clamps arbitrary (possibly hand-edited) input via layoutKnobs.ts. */
	hydrate: (knobs: unknown) => void;

	customLayout: boolean;
	nodeOffsets: NodeOffsets;
	/** Off snaps cards back to the automatic layout but keeps the offsets. */
	setCustomLayout: (on: boolean) => void;
	setNodeOffset: (orientation: Orientation, id: string, offset: Offset) => void;
	resetNodeOffsets: (orientation: Orientation) => void;
	/**
	 * Applies only the keys that were stored (undefined = keep the on-screen
	 * value); offsets are cleaned via nodeOffsets.ts `clampOffsets`.
	 */
	hydrateCustomLayout: (saved: {
		customLayout?: unknown;
		nodeOffsets?: unknown;
	}) => void;

	/**
	 * v0.8.4 Phase 4 — the ONLY owner of canvas collapse state (RC1).
	 * react-d3-tree is handed a tree pruned from this set (lib/collapseTree.ts)
	 * and never toggles on its own. `collapseVersion` bumps on every change;
	 * Canvas composes it into the tree's `dataKey`.
	 */
	collapsedIds: ReadonlySet<string>;
	collapseVersion: number;
	toggleCollapsed: (id: string) => void;
	setCollapsed: (id: string, on: boolean) => void;
	/** One write for every id that is currently collapsed. */
	expandMany: (ids: readonly string[]) => void;
	/** Replaces the set with `ids` (every node that has children). */
	collapseAll: (ids: readonly string[]) => void;
	expandAll: () => void;
	/** Collapses the nodes with children at `depth`, expands everything else. */
	collapseToDepth: (depth: number, nodes: readonly RoadmapNode[]) => void;
	/** undefined = keep the on-screen set; an array replaces it. */
	hydrateCollapsed: (ids: unknown) => void;

	/** A different file was opened: every piece of view state to defaults. */
	resetForNewFile: () => void;
}

const NO_COLLAPSED: ReadonlySet<string> = new Set();

/**
 * Store update that publishes a new collapsed set, or `state` itself when
 * the set is unchanged — zustand then skips the write and notifies no one.
 */
function collapsePatch(
	state: FileViewState,
	next: ReadonlySet<string>,
): Partial<FileViewState> {
	const prev = state.collapsedIds;
	if (next.size === prev.size && [...next].every((id) => prev.has(id))) {
		return state;
	}
	return { collapsedIds: next, collapseVersion: state.collapseVersion + 1 };
}

export const useFileViewStore = create<FileViewState>((set) => ({
	layoutKnobs: { ...KNOB_DEFAULTS },
	setKnob: (name, value) =>
		set((state) => ({ layoutKnobs: { ...state.layoutKnobs, [name]: value } })),
	resetKnobs: () => set({ layoutKnobs: { ...KNOB_DEFAULTS } }),
	hydrate: (knobs) => set({ layoutKnobs: clampKnobs(knobs) }),

	customLayout: false,
	nodeOffsets: EMPTY_NODE_OFFSETS,
	setCustomLayout: (on) => set({ customLayout: on }),
	setNodeOffset: (orientation, id, offset) =>
		set((state) => ({
			nodeOffsets: {
				...state.nodeOffsets,
				[orientation]: { ...state.nodeOffsets[orientation], [id]: offset },
			},
		})),
	resetNodeOffsets: (orientation) =>
		set((state) => ({
			nodeOffsets: { ...state.nodeOffsets, [orientation]: {} },
		})),
	hydrateCustomLayout: (saved) =>
		set((state) => ({
			customLayout:
				saved.customLayout === undefined
					? state.customLayout
					: saved.customLayout === true,
			nodeOffsets:
				saved.nodeOffsets === undefined
					? state.nodeOffsets
					: clampOffsets(saved.nodeOffsets),
		})),

	collapsedIds: NO_COLLAPSED,
	collapseVersion: 0,
	toggleCollapsed: (id) =>
		set((state) => {
			const next = new Set(state.collapsedIds);
			if (!next.delete(id)) next.add(id);
			return collapsePatch(state, next);
		}),
	setCollapsed: (id, on) =>
		set((state) => {
			const next = new Set(state.collapsedIds);
			if (on) next.add(id);
			else next.delete(id);
			return collapsePatch(state, next);
		}),
	expandMany: (ids) =>
		set((state) => {
			const next = new Set(state.collapsedIds);
			for (const id of ids) next.delete(id);
			return collapsePatch(state, next);
		}),
	collapseAll: (ids) => set((state) => collapsePatch(state, new Set(ids))),
	expandAll: () => set((state) => collapsePatch(state, NO_COLLAPSED)),
	collapseToDepth: (depth, nodes) =>
		set((state) => collapsePatch(state, new Set(idsAtDepth(nodes, depth)))),
	hydrateCollapsed: (ids) =>
		set((state) =>
			Array.isArray(ids)
				? collapsePatch(
						state,
						new Set(ids.filter((id): id is string => typeof id === "string")),
					)
				: state,
		),

	resetForNewFile: () =>
		set((state) => ({
			...collapsePatch(state, NO_COLLAPSED),
			layoutKnobs: { ...KNOB_DEFAULTS },
			customLayout: false,
			nodeOffsets: EMPTY_NODE_OFFSETS,
		})),
}));
