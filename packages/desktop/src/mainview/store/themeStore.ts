import { create } from "zustand";
import type { ThemePreference } from "../../../../../shared/types";
import { electroview } from "../rpc";

export type { ThemePreference };
export type ResolvedTheme = Exclude<ThemePreference, "system">;

export interface ThemeState {
	preference: ThemePreference;
	systemResolution: "dark" | "light";
	resolvedTheme: ResolvedTheme;
	setTheme: (pref: ThemePreference) => void;
	updateSystemResolution: (resolved: "dark" | "light") => void;
}

export const useThemeStore = create<ThemeState>((set, get) => ({
	preference: "dark",
	systemResolution: (() => {
		try {
			return typeof window !== "undefined" &&
				window.matchMedia?.("(prefers-color-scheme: dark)").matches
				? "dark"
				: "light";
		} catch {
			return "dark";
		}
	})(),
	resolvedTheme: "dark",
	setTheme: (pref) => {
		const resolved: ResolvedTheme =
			pref === "system" ? get().systemResolution : pref;
		set({ preference: pref, resolvedTheme: resolved });
		// Persist theme preference via saveSettings RPC (D-05)
		electroview?.rpc?.request
			.saveSettings({ settings: { theme: pref } })
			.catch((e: unknown) => {
				// RPC unavailable outside Electrobun runtime (test/Vite dev server)
				console.warn("[themeStore] saveSettings RPC failed:", e);
			});
	},
	updateSystemResolution: (resolved) => {
		const { preference } = get();
		set({
			systemResolution: resolved,
			resolvedTheme: preference === "system" ? resolved : get().resolvedTheme,
		});
	},
}));
