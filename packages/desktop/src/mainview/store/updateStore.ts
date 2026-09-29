import { create } from "zustand";
import type { UpdateState } from "../../../../../shared/types";

/**
 * v0.8.5: the renderer's only owner of UpdateState. The main-process update
 * service pushes every change (rpcHandlers.handlePushUpdateState) and the
 * actions in lib/updateActions.ts store their responses; components only
 * read. `dismissedVersion` is the per-launch "Later" / "Hide" / "Close" of
 * the update card (D-2) — never persisted.
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

/**
 * Should the update card be open? It follows one version from the prompt
 * through the download to the restart offer (v0.8.7); dismissing hides every
 * later phase of that version for this launch — the status-bar pill still
 * reports them.
 */
export function shouldPromptForUpdate(
	state: UpdateState,
	dismissedVersion: string | null,
): boolean {
	return (
		(state.status === "available" ||
			state.status === "downloading" ||
			state.status === "ready") &&
		state.version !== dismissedVersion
	);
}
