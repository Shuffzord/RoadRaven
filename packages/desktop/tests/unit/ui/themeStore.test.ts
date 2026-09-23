// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the rpc module before importing the store
vi.mock("../../../src/mainview/rpc", () => ({
	electroview: {
		rpc: {
			request: {
				saveSettings: vi.fn(() => Promise.resolve({ success: true })),
				loadSettings: vi.fn(() => Promise.resolve({ settings: {} })),
			},
		},
	},
}));

import type { UserThemeEntry } from "../../../../../shared/types";
import { electroview } from "../../../src/mainview/rpc";
import {
	THEME_NOTICE_SOURCE,
	useThemeStore,
} from "../../../src/mainview/store/themeStore";
import { useToastStore } from "../../../src/mainview/store/toastStore";
import {
	DEFAULT_THEME_ID,
	THEME_IDS,
	themeForId,
} from "../../../src/mainview/themes";

// A user theme (v0.8.3 Phase 4): a built-in's colours under a new id.
const mine: UserThemeEntry = {
	id: "mine",
	file: {
		id: "mine",
		meta: { name: "Mine", mode: "light" },
		colors: themeForId("light").colors,
	},
	requiredFailures: 0,
};

describe("themeStore", () => {
	beforeEach(() => {
		// Reset store to defaults before each test
		useThemeStore.setState({
			preference: DEFAULT_THEME_ID,
			systemResolution: "dark",
			resolvedTheme: DEFAULT_THEME_ID,
			userThemes: [],
		});
		useToastStore.setState({ toasts: [] });
		vi.clearAllMocks();
	});

	it("starts on the default theme, amber (D-8), before any preference is loaded", () => {
		const initial = useThemeStore.getInitialState();
		expect(DEFAULT_THEME_ID).toBe("amber");
		expect(initial.preference).toBe("amber");
		expect(initial.resolvedTheme).toBe("amber");
	});

	it("setTheme('light') updates preference and resolvedTheme to 'light'", () => {
		useThemeStore.getState().setTheme("light");
		const state = useThemeStore.getState();
		expect(state.preference).toBe("light");
		expect(state.resolvedTheme).toBe("light");
	});

	it("setTheme('system') resolves to systemResolution value", () => {
		useThemeStore.setState({ systemResolution: "light" });
		useThemeStore.getState().setTheme("system");
		const state = useThemeStore.getState();
		expect(state.preference).toBe("system");
		expect(state.resolvedTheme).toBe("light");
	});

	it("updateSystemResolution('light') changes resolvedTheme when preference is 'system'", () => {
		useThemeStore.setState({ preference: "system", resolvedTheme: "dark" });
		useThemeStore.getState().updateSystemResolution("light");
		expect(useThemeStore.getState().resolvedTheme).toBe("light");
	});

	it("updateSystemResolution('light') does NOT change resolvedTheme when preference is 'dark'", () => {
		useThemeStore.setState({ preference: "dark", resolvedTheme: "dark" });
		useThemeStore.getState().updateSystemResolution("light");
		expect(useThemeStore.getState().resolvedTheme).toBe("dark");
	});

	// RC3 (A4): an unknown id paints the default and says so once, and the
	// preference is kept so restoring the file brings the theme back.
	it("setTheme with an unknown id keeps the preference, resolves to the default and records one notice", () => {
		const warn = vi.spyOn(console, "warn");
		useThemeStore.getState().setTheme("solarized");
		useThemeStore.getState().setTheme("solarized");
		const state = useThemeStore.getState();
		expect(state.preference).toBe("solarized");
		expect(state.resolvedTheme).toBe(DEFAULT_THEME_ID);
		expect(warn).not.toHaveBeenCalled();
		warn.mockRestore();

		const toasts = useToastStore.getState().toasts;
		expect(toasts).toHaveLength(1);
		expect(toasts[0].count).toBe(1);
		expect(toasts[0].type).toBe("file_info");
		expect(toasts[0].source).toBe(THEME_NOTICE_SOURCE);
		expect(toasts[0].detail).toBe(
			`Theme 'solarized' not found — using ${themeForId(DEFAULT_THEME_ID).meta.name}`,
		);
	});

	it("a user theme id resolves to itself once the user list holds it", () => {
		useThemeStore.getState().setUserThemes([mine]);
		useThemeStore.getState().setTheme("mine");
		expect(useThemeStore.getState().resolvedTheme).toBe("mine");
		expect(useToastStore.getState().toasts).toEqual([]);
	});

	it("setUserThemes re-resolves a pending preference (restoring the file brings it back)", () => {
		useThemeStore.getState().setTheme("mine");
		expect(useThemeStore.getState().resolvedTheme).toBe(DEFAULT_THEME_ID);
		expect(useToastStore.getState().toasts).toHaveLength(1);

		useThemeStore.getState().setUserThemes([mine]);
		expect(useThemeStore.getState().preference).toBe("mine");
		expect(useThemeStore.getState().resolvedTheme).toBe("mine");
		// The setting was written once, with the preference — never rewritten.
		const saveSettings = electroview?.rpc?.request.saveSettings;
		expect(saveSettings).toHaveBeenCalledTimes(1);
		expect(saveSettings).toHaveBeenCalledWith({
			settings: { theme: "mine" },
		});
	});

	it("keeps the last good file when the active user theme's file turns invalid", () => {
		useThemeStore.getState().setUserThemes([mine]);
		useThemeStore.getState().setTheme("mine");
		useThemeStore
			.getState()
			.setUserThemes([{ id: "mine", error: "invalid JSON" }]);
		const state = useThemeStore.getState();
		expect(state.resolvedTheme).toBe("mine");
		expect(state.userThemes[0].file).toEqual(mine.file);
		expect(state.userThemes[0].error).toBe("invalid JSON");
		expect(useToastStore.getState().toasts).toEqual([]);
	});

	it("an invalid user theme with no good version falls back to the default with a notice", () => {
		useThemeStore
			.getState()
			.setUserThemes([{ id: "mine", error: "invalid JSON" }]);
		useThemeStore.getState().setTheme("mine");
		expect(useThemeStore.getState().resolvedTheme).toBe(DEFAULT_THEME_ID);
		expect(useToastStore.getState().toasts).toHaveLength(1);
	});

	it("'system' still maps to the OS mode's built-in when user themes exist", () => {
		useThemeStore.getState().setUserThemes([mine]);
		useThemeStore.setState({ systemResolution: "light" });
		useThemeStore.getState().setTheme("system");
		expect(useThemeStore.getState().resolvedTheme).toBe("light");
	});

	it("refreshUserThemes lists through the RPC with the built-in ids reserved", async () => {
		const listThemes = vi.fn(() =>
			Promise.resolve({ themes: [mine], dir: "/themes" }),
		);
		const request = electroview?.rpc?.request as unknown as Record<
			string,
			unknown
		>;
		request.listThemes = listThemes;
		await useThemeStore.getState().refreshUserThemes();
		expect(listThemes).toHaveBeenCalledWith({ reservedIds: [...THEME_IDS] });
		expect(useThemeStore.getState().userThemes).toEqual([mine]);
	});

	it("setTheme('light') calls saveSettings RPC with { theme: 'light' }", () => {
		useThemeStore.getState().setTheme("light");
		expect(electroview?.rpc).toBeDefined();
		expect(electroview!.rpc!.request.saveSettings).toHaveBeenCalledWith({
			settings: { theme: "light" },
		});
	});

	it("setTheme is called on every invocation with saveSettings", () => {
		useThemeStore.getState().setTheme("light");
		useThemeStore.getState().setTheme("dark");
		useThemeStore.getState().setTheme("high-contrast");
		expect(electroview?.rpc).toBeDefined();
		expect(electroview!.rpc!.request.saveSettings).toHaveBeenCalledTimes(3);
	});

	// v0.8.3 Phase 5: the editor's draft. It is not a preference — nothing
	// is persisted — and a user-list refresh (the watcher round-trip of the
	// editor's own write) never replaces it.
	it("setDraft holds the editor's file and clearDraft drops it, without touching the preference", () => {
		expect(useThemeStore.getState().draft).toBeNull();
		const file = mine.file as NonNullable<typeof mine.file>;
		useThemeStore.getState().setDraft(file);
		expect(useThemeStore.getState().draft).toBe(file);
		expect(useThemeStore.getState().preference).toBe(DEFAULT_THEME_ID);
		expect(electroview?.rpc?.request.saveSettings).not.toHaveBeenCalled();

		const edited = { ...file, colors: { ...file.colors, accent: "#ff00ff" } };
		useThemeStore.getState().setDraft(edited);
		useThemeStore.getState().setUserThemes([mine]);
		expect(useThemeStore.getState().draft).toBe(edited);

		useThemeStore.getState().clearDraft();
		expect(useThemeStore.getState().draft).toBeNull();
	});
});
