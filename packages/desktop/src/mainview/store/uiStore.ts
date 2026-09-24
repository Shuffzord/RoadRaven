import { create } from "zustand";

export const SIDEBAR_MIN_WIDTH = 160;
export const SIDEBAR_MAX_WIDTH = 480;
export const SIDEBAR_DEFAULT_WIDTH = 220;

/**
 * Session-only UI chrome state that more than one surface drives.
 * v0.8.2 F3: the sidebar collapse flag moved here from Sidebar's local state
 * so the keyboard router's Ctrl+B and the header button toggle the same bit.
 */
interface UiState {
	sidebarCollapsed: boolean;
	toggleSidebar: () => void;
	/** Expanded sidebar width in px; persisted via AppSettings.sidebarWidth. */
	sidebarWidth: number;
	/** Clamps to [SIDEBAR_MIN_WIDTH, SIDEBAR_MAX_WIDTH]. */
	setSidebarWidth: (width: number) => void;
	resetSidebarWidth: () => void;
}

export const useUiStore = create<UiState>((set) => ({
	sidebarCollapsed: false,
	toggleSidebar: () =>
		set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
	sidebarWidth: SIDEBAR_DEFAULT_WIDTH,
	setSidebarWidth: (width) =>
		set({
			sidebarWidth: Math.max(
				SIDEBAR_MIN_WIDTH,
				Math.min(SIDEBAR_MAX_WIDTH, width),
			),
		}),
	resetSidebarWidth: () => set({ sidebarWidth: SIDEBAR_DEFAULT_WIDTH }),
}));
