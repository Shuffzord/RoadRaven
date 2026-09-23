import { create } from "zustand";
import type { ThemePreference } from "../../../../../shared/types";
import { electroview } from "../rpc";
import { DEFAULT_THEME_ID, getBuiltInTheme } from "../themes";

export type { ThemePreference };
/** A theme id that is guaranteed to be registered. */
export type ResolvedTheme = string;

export interface ThemeState {
	preference: ThemePreference;
	systemResolution: "dark" | "light";
	resolvedTheme: ResolvedTheme;
	setTheme: (pref: ThemePreference) => void;
	updateSystemResolution: (resolved: "dark" | "light") => void;
}

/**
 * "system" follows the OS; an unknown id (a theme file that no longer
 * exists, v0.8.3 Phase 4) paints the default rather than nothing.
 */
function resolveThemeId(
	pref: ThemePreference,
	system: "dark" | "light",
): ResolvedTheme {
	if (pref === "system") return system;
	if (getBuiltInTheme(pref)) return pref;
	console.warn(
		`[themeStore] unknown theme "${pref}", using "${DEFAULT_THEME_ID}"`,
	);
	return DEFAULT_THEME_ID;
}

export const useThemeStore = create<ThemeState>((set, get) => ({
	preference: DEFAULT_THEME_ID,
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
	resolvedTheme: DEFAULT_THEME_ID,
	setTheme: (pref) => {
		set({
			preference: pref,
			resolvedTheme: resolveThemeId(pref, get().systemResolution),
		});
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
