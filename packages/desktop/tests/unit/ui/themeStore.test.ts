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

import { electroview } from "../../../src/mainview/rpc";
import { useThemeStore } from "../../../src/mainview/store/themeStore";

describe("themeStore", () => {
	beforeEach(() => {
		// Reset store to defaults before each test
		useThemeStore.setState({
			preference: "dark",
			systemResolution: "dark",
			resolvedTheme: "dark",
		});
		vi.clearAllMocks();
	});

	it("defaults to preference 'dark', resolvedTheme 'dark'", () => {
		const state = useThemeStore.getState();
		expect(state.preference).toBe("dark");
		expect(state.resolvedTheme).toBe("dark");
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

	it("setTheme('light') calls saveSettings RPC with { theme: 'light' }", () => {
		useThemeStore.getState().setTheme("light");
		expect(electroview.rpc.request.saveSettings).toHaveBeenCalledWith({
			settings: { theme: "light" },
		});
	});

	it("setTheme is called on every invocation with saveSettings", () => {
		useThemeStore.getState().setTheme("light");
		useThemeStore.getState().setTheme("dark");
		useThemeStore.getState().setTheme("high-contrast");
		expect(electroview.rpc.request.saveSettings).toHaveBeenCalledTimes(3);
	});
});
