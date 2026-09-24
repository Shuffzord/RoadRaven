import { create } from "zustand";
import {
	clampKnobs,
	KNOB_DEFAULTS,
	type LayoutKnobs,
} from "../lib/layoutKnobs";

/**
 * v0.8.4 Phase 2 — the ONLY owner of `layoutKnobs` for the currently open
 * file: sibling gap, depth gap and card density. `useFileViewSettings`
 * restores it from `fileSettings[path].layoutKnobs` on open and persists it
 * back on change; orientation stays on `roadmapStore.layoutOrientation`.
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
}

export const useFileViewStore = create<FileViewState>((set) => ({
	layoutKnobs: { ...KNOB_DEFAULTS },
	setKnob: (name, value) =>
		set((state) => ({ layoutKnobs: { ...state.layoutKnobs, [name]: value } })),
	resetKnobs: () => set({ layoutKnobs: { ...KNOB_DEFAULTS } }),
	hydrate: (knobs) => set({ layoutKnobs: clampKnobs(knobs) }),
}));
