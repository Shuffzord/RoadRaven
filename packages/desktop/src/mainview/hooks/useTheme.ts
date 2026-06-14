import { useThemeStore } from "../store/themeStore";

export function useTheme() {
	const theme = useThemeStore((s) => s.resolvedTheme);
	const preference = useThemeStore((s) => s.preference);
	const setTheme = useThemeStore((s) => s.setTheme);
	return { theme, preference, setTheme } as const;
}
