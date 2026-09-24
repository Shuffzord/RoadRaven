import { create } from "zustand";
import type { ThemeFile } from "../../../../../shared/themeSchema";
import type {
	ThemeDeleteResult,
	ThemePreference,
	UserThemeEntry,
} from "../../../../../shared/types";
import { electroview } from "../rpc";
import {
	DEFAULT_THEME_ID,
	getBuiltInTheme,
	THEME_IDS,
	themeForId,
} from "../themes";
import { useToastStore } from "./toastStore";

export type { ThemePreference };
/** A theme id that is guaranteed to be registered. */
export type ResolvedTheme = string;

/** `source` of the fallback notice toast (A4). */
export const THEME_NOTICE_SOURCE = "theme";

export interface ThemeState {
	preference: ThemePreference;
	systemResolution: "dark" | "light";
	resolvedTheme: ResolvedTheme;
	/** Files in <userData>/themes, valid or not (v0.8.3 Phase 4). */
	userThemes: UserThemeEntry[];
	setTheme: (pref: ThemePreference) => void;
	updateSystemResolution: (resolved: "dark" | "light") => void;
	/**
	 * Replaces the user list, keeping the last good file of an entry that
	 * turned invalid, and re-resolves the preference (a restored file brings
	 * a pending preference back).
	 */
	setUserThemes: (entries: UserThemeEntry[]) => void;
	/** Re-lists through the RPC; a no-op outside Electrobun. */
	refreshUserThemes: () => Promise<void>;
	/**
	 * Deletes a user theme's file through the RPC, then drops its entry
	 * (v0.8.3 Phase 7, D-11). Deleting the active theme switches to the
	 * default through setTheme, so the choice is persisted and no
	 * missing-theme notice fires later; a draft of it is cleared. A failure
	 * keeps the entry and pushes a notice. Resolves to whether it was deleted.
	 */
	deleteUserTheme: (id: string) => Promise<boolean>;
	/**
	 * The theme editor's working copy (v0.8.3 Phase 5). While set,
	 * ThemeProvider paints it instead of the preference; nothing here
	 * persists it — the editor's autosave writes the file.
	 */
	draft: ThemeFile | null;
	setDraft: (file: ThemeFile) => void;
	clearDraft: () => void;
}

/** The paintable user files (a stale-good file on an invalid entry counts). */
export function userThemeFiles(
	entries: readonly UserThemeEntry[],
): ThemeFile[] {
	return entries.flatMap((e) => (e.file ? [e.file] : []));
}

// One notice per missing id: not again while the same id stays missing.
let noticedFor: string | null = null;

/**
 * "system" follows the OS; an id nobody owns (a theme file that was deleted
 * or is invalid, A4) paints the default and says so once — the preference
 * itself is kept so restoring the file brings the theme back.
 */
function resolveThemeId(
	pref: ThemePreference,
	system: "dark" | "light",
	userThemes: readonly UserThemeEntry[],
): ResolvedTheme {
	if (pref === "system") return system;
	if (
		getBuiltInTheme(pref) ||
		userThemes.some((e) => e.id === pref && e.file)
	) {
		noticedFor = null;
		return pref;
	}
	if (noticedFor !== pref) {
		noticedFor = pref;
		useToastStore.getState().pushToast({
			type: "file_info",
			source: THEME_NOTICE_SOURCE,
			detail: `Theme '${pref}' not found — using ${themeForId(DEFAULT_THEME_ID).meta.name}`,
		});
	}
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
	userThemes: [],
	setTheme: (pref) => {
		set({
			preference: pref,
			resolvedTheme: resolveThemeId(
				pref,
				get().systemResolution,
				get().userThemes,
			),
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
	setUserThemes: (entries) => {
		const previous = get().userThemes;
		const userThemes = entries.map((entry) => {
			if (entry.file) return entry;
			const lastGood = previous.find((p) => p.id === entry.id)?.file;
			return lastGood ? { ...entry, file: lastGood } : entry;
		});
		const { preference, systemResolution } = get();
		set({
			userThemes,
			resolvedTheme: resolveThemeId(preference, systemResolution, userThemes),
		});
	},
	refreshUserThemes: async () => {
		try {
			const result = await electroview?.rpc?.request.listThemes({
				reservedIds: [...THEME_IDS],
			});
			if (result) get().setUserThemes(result.themes);
		} catch {
			// RPC unavailable outside Electrobun runtime (test/Vite dev server)
		}
	},
	deleteUserTheme: async (id) => {
		const rpc = electroview?.rpc;
		let result: ThemeDeleteResult;
		if (!rpc) {
			// Outside Electrobun (HMR dev server, the a11y preview bundle) the
			// list is in-memory only: nothing on disk to delete.
			result = { ok: true };
		} else {
			try {
				result = await rpc.request.deleteTheme({
					id,
					reservedIds: [...THEME_IDS],
				});
			} catch (err) {
				result = { ok: false, error: String(err) };
			}
		}
		if (!result.ok) {
			useToastStore.getState().pushToast({
				type: "file_error",
				source: THEME_NOTICE_SOURCE,
				detail: `Could not delete theme '${id}': ${result.error}`,
			});
			return false;
		}
		const { preference, resolvedTheme, draft } = get();
		set({
			userThemes: get().userThemes.filter((e) => e.id !== id),
			draft: draft?.id === id ? null : draft,
		});
		if (preference === id || resolvedTheme === id)
			get().setTheme(DEFAULT_THEME_ID);
		return true;
	},
	draft: null,
	setDraft: (file) => set({ draft: file }),
	clearDraft: () => set({ draft: null }),
}));
