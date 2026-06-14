import { useEffect, useRef } from "react";
import type { ThemePreference } from "../../../../../shared/types";
import { electroview } from "../rpc";
import { useThemeStore } from "../store/themeStore";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
	const resolvedTheme = useThemeStore((s) => s.resolvedTheme);
	const preference = useThemeStore((s) => s.preference);
	const hasLoadedSettings = useRef(false);

	// Load saved theme preference on first mount
	useEffect(() => {
		if (hasLoadedSettings.current) return;
		hasLoadedSettings.current = true;
		electroview?.rpc?.request
			.loadSettings({})
			.then((response: { settings?: { theme?: ThemePreference } }) => {
				const saved = response?.settings?.theme;
				if (saved && saved !== useThemeStore.getState().preference) {
					useThemeStore.getState().setTheme(saved);
				}
			})
			.catch((e: unknown) => {
				console.warn(
					"[ThemeProvider] loadSettings RPC failed, using defaults:",
					e,
				);
			});
	}, []);

	// Apply data-theme attribute to <html> (D-02)
	useEffect(() => {
		document.documentElement.setAttribute("data-theme", resolvedTheme);
	}, [resolvedTheme]);

	// Listen for OS preference changes when in "system" mode (D-05)
	useEffect(() => {
		if (preference !== "system") return;
		const mq = window.matchMedia("(prefers-color-scheme: dark)");
		const handler = (e: MediaQueryListEvent) => {
			useThemeStore
				.getState()
				.updateSystemResolution(e.matches ? "dark" : "light");
		};
		mq.addEventListener("change", handler);
		return () => mq.removeEventListener("change", handler);
	}, [preference]);

	return <>{children}</>;
}
