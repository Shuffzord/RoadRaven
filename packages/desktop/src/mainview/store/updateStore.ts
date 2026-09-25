import { create } from "zustand";
import type { UpdateState } from "../../../../../shared/types";

/**
 * v0.8.5: the renderer's only owner of UpdateState. The main-process update
 * service pushes every change (rpcHandlers.handlePushUpdateState) and the
 * actions in lib/updateActions.ts store their responses; components only
 * read. `dismissedVersion` is the per-launch "Later" of the prompt (D-2) —
 * never persisted.
 */
export interface UpdateStoreState {
	state: UpdateState;
	dismissedVersion: string | null;
	setState: (next: UpdateState) => void;
	dismiss: (version: string) => void;
}

export const useUpdateStore = create<UpdateStoreState>((set) => ({
	state: { status: "idle" },
	dismissedVersion: null,
	setState: (next) => set({ state: next }),
	dismiss: (version) => set({ dismissedVersion: version }),
}));

/** Should the "update available" prompt be open? */
export function shouldPromptForUpdate(
	state: UpdateState,
	dismissedVersion: string | null,
): boolean {
	return state.status === "available" && state.version !== dismissedVersion;
}
