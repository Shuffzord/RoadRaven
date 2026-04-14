// @vitest-environment jsdom

import { act, cleanup, render } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock the rpc module
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

import { ThemeProvider } from "../../../src/mainview/components/ThemeProvider";
import { useTheme } from "../../../src/mainview/hooks/useTheme";
import { electroview } from "../../../src/mainview/rpc";
import { useThemeStore } from "../../../src/mainview/store/themeStore";

// Mock matchMedia
function createMockMatchMedia(matches: boolean) {
	const listeners: Array<(e: MediaQueryListEvent) => void> = [];
	const mql = {
		matches,
		media: "(prefers-color-scheme: dark)",
		addEventListener: vi.fn(
			(_event: string, handler: (e: MediaQueryListEvent) => void) => {
				listeners.push(handler);
			},
		),
		removeEventListener: vi.fn(
			(_event: string, handler: (e: MediaQueryListEvent) => void) => {
				const idx = listeners.indexOf(handler);
				if (idx >= 0) listeners.splice(idx, 1);
			},
		),
		dispatchEvent: vi.fn(),
		onchange: null,
		addListener: vi.fn(),
		removeListener: vi.fn(),
	};
	return { mql, listeners };
}

describe("ThemeProvider", () => {
	let mockMM: ReturnType<typeof createMockMatchMedia>;

	beforeEach(() => {
		// Reset store
		useThemeStore.setState({
			preference: "dark",
			systemResolution: "dark",
			resolvedTheme: "dark",
		});
		vi.clearAllMocks();

		mockMM = createMockMatchMedia(true);
		window.matchMedia = vi.fn(() => mockMM.mql as unknown as MediaQueryList);
	});

	afterEach(() => {
		cleanup();
	});

	it("sets data-theme='dark' on document.documentElement on mount", async () => {
		render(
			<ThemeProvider>
				<div>child</div>
			</ThemeProvider>,
		);
		// Wait for effects
		await act(async () => {
			/* flush effects */
		});
		expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
	});

	it("updates data-theme when store changes to 'light'", async () => {
		render(
			<ThemeProvider>
				<div>child</div>
			</ThemeProvider>,
		);
		await act(async () => {
			useThemeStore.getState().setTheme("light");
		});
		expect(document.documentElement.getAttribute("data-theme")).toBe("light");
	});

	it("registers matchMedia listener when preference is 'system'", async () => {
		render(
			<ThemeProvider>
				<div>child</div>
			</ThemeProvider>,
		);
		await act(async () => {
			useThemeStore.getState().setTheme("system");
		});
		expect(mockMM.mql.addEventListener).toHaveBeenCalledWith(
			"change",
			expect.any(Function),
		);
	});

	it("removes matchMedia listener on cleanup", async () => {
		const { unmount } = render(
			<ThemeProvider>
				<div>child</div>
			</ThemeProvider>,
		);
		await act(async () => {
			useThemeStore.getState().setTheme("system");
		});
		unmount();
		expect(mockMM.mql.removeEventListener).toHaveBeenCalledWith(
			"change",
			expect.any(Function),
		);
	});

	it("calls loadSettings on mount and applies saved theme preference", async () => {
		vi.mocked(electroview.rpc.request.loadSettings).mockResolvedValueOnce({
			settings: { theme: "light" },
		});

		render(
			<ThemeProvider>
				<div>child</div>
			</ThemeProvider>,
		);
		// Wait for the async loadSettings call
		await act(async () => {
			await new Promise((r) => setTimeout(r, 10));
		});
		expect(electroview.rpc.request.loadSettings).toHaveBeenCalled();
		expect(useThemeStore.getState().preference).toBe("light");
	});

	it("uses default 'dark' when loadSettings RPC fails", async () => {
		vi.mocked(electroview.rpc.request.loadSettings).mockRejectedValueOnce(
			new Error("RPC not available"),
		);

		render(
			<ThemeProvider>
				<div>child</div>
			</ThemeProvider>,
		);
		await act(async () => {
			await new Promise((r) => setTimeout(r, 10));
		});
		expect(useThemeStore.getState().preference).toBe("dark");
	});
});

describe("useTheme hook", () => {
	beforeEach(() => {
		useThemeStore.setState({
			preference: "dark",
			systemResolution: "dark",
			resolvedTheme: "dark",
		});
		vi.clearAllMocks();

		const mockMM = createMockMatchMedia(true);
		window.matchMedia = vi.fn(() => mockMM.mql as unknown as MediaQueryList);
	});

	afterEach(() => {
		cleanup();
	});

	it("returns { theme, preference, setTheme }", () => {
		let hookResult: ReturnType<typeof useTheme> | undefined;

		function TestComponent() {
			hookResult = useTheme();
			return null;
		}

		render(
			<ThemeProvider>
				<TestComponent />
			</ThemeProvider>,
		);

		expect(hookResult).toBeDefined();
		expect(hookResult!.theme).toBe("dark");
		expect(hookResult!.preference).toBe("dark");
		expect(typeof hookResult!.setTheme).toBe("function");
	});
});
