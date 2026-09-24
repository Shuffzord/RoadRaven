import { useEffect, useRef } from "react";
import { resolveTheme } from "../../../../../shared/themeSchema";
import type { ThemePreference } from "../../../../../shared/types";
import { electroview, onThemesChanged } from "../rpc";
import { userThemeFiles, useThemeStore } from "../store/themeStore";
import { applyTheme } from "../theme/applyTheme";
import { resolveThemeFile } from "../themes";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
	const resolvedTheme = useThemeStore((s) => s.resolvedTheme);
	const preference = useThemeStore((s) => s.preference);
	const userThemes = useThemeStore((s) => s.userThemes);
	const draft = useThemeStore((s) => s.draft);
	const hasLoadedSettings = useRef(false);
	const lastPainted = useRef("");

	// Load the user themes, then the saved preference, on first mount — in
	// that order, so a saved user theme id resolves instead of falling back.
	useEffect(() => {
		if (hasLoadedSettings.current) return;
		hasLoadedSettings.current = true;
		useThemeStore
			.getState()
			.refreshUserThemes()
			.then(() => electroview?.rpc?.request.loadSettings({}))
			.then((response?: { settings?: { theme?: ThemePreference } }) => {
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

	// Hot reload (v0.8.3 Phase 4): a change in <userData>/themes re-lists; the
	// paint effect below repaints only if the active theme's tokens moved.
	useEffect(
		() =>
			onThemesChanged(() => {
				void useThemeStore.getState().refreshUserThemes();
			}),
		[],
	);

	// Paint the resolved theme's tokens onto <html> (v0.8.3 Phase 3; D-02
	// kept the data-theme attribute, applyTheme sets it too). A user-list
	// refresh (Phase 4 hot reload) repaints only when the painted tokens
	// actually changed, so editing an inactive theme file is a no-op here.
	// While the theme editor holds a draft (Phase 5) the draft is painted
	// instead: its own autosave comes back through the watcher as a list
	// refresh, and the draft — not the file on disk — is what the user sees.
	useEffect(() => {
		const file =
			draft ?? resolveThemeFile(resolvedTheme, userThemeFiles(userThemes));
		const resolved = resolveTheme(file);
		const key = `${file.id}\n${JSON.stringify(resolved)}`;
		if (key === lastPainted.current) return;
		lastPainted.current = key;
		applyTheme(resolved, file.id);
	}, [resolvedTheme, userThemes, draft]);

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
