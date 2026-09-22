import { create } from "zustand";

/**
 * Preferences dialog open state (v0.8.2 D5-A). Opened from the top-bar cog
 * and Ctrl+, ; the dialog itself reads and writes settings over RPC.
 */
interface PreferencesState {
	open: boolean;
	openPreferences: () => void;
	closePreferences: () => void;
}

export const usePreferencesStore = create<PreferencesState>((set) => ({
	open: false,
	openPreferences: () => set({ open: true }),
	closePreferences: () => set({ open: false }),
}));
