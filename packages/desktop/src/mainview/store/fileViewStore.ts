import { create } from "zustand";
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
interface FileViewState {
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
}));
