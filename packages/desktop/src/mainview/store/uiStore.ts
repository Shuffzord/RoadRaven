import { create } from "zustand";

/**
 * Session-only UI chrome state that more than one surface drives.
 * v0.8.2 F3: the sidebar collapse flag moved here from Sidebar's local state
 * so the keyboard router's Ctrl+B and the header button toggle the same bit.
 */
interface UiState {
	sidebarCollapsed: boolean;
	toggleSidebar: () => void;
}

export const useUiStore = create<UiState>((set) => ({
	sidebarCollapsed: false,
	toggleSidebar: () =>
		set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
}));
