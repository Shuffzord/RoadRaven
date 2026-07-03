import { create } from "zustand";

/**
 * Setup Wizard open state (v0.6). The wizard auto-opens on first run (see
 * SetupWizard's mount effect) and can be re-opened later from the TopBar.
 */
interface SetupState {
	open: boolean;
	openWizard: () => void;
	closeWizard: () => void;
}

export const useSetupStore = create<SetupState>((set) => ({
	open: false,
	openWizard: () => set({ open: true }),
	closeWizard: () => set({ open: false }),
}));
