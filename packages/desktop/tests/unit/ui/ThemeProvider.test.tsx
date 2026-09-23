// @vitest-environment jsdom

import { act, cleanup, render } from "@testing-library/react";
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

// Spy on applyTheme (v0.8.3 Phase 3) while keeping its real behaviour, so the
// data-theme assertions below still see the attribute it sets.
vi.mock("../../../src/mainview/theme/applyTheme", async (importOriginal) => {
	const actual =
		await importOriginal<
			typeof import("../../../src/mainview/theme/applyTheme")
		>();
	return { applyTheme: vi.fn(actual.applyTheme) };
});

import { resolveTheme } from "../../../../../shared/themeSchema";
import { ThemeProvider } from "../../../src/mainview/components/ThemeProvider";
import { useTheme } from "../../../src/mainview/hooks/useTheme";
import { electroview } from "../../../src/mainview/rpc";
import { useThemeStore } from "../../../src/mainview/store/themeStore";
import { applyTheme } from "../../../src/mainview/theme/applyTheme";
import {
	DEFAULT_THEME_ID,
	getBuiltInTheme,
} from "../../../src/mainview/themes";

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
			preference: DEFAULT_THEME_ID,
			systemResolution: "dark",
			resolvedTheme: DEFAULT_THEME_ID,
		});
		vi.clearAllMocks();

		mockMM = createMockMatchMedia(true);
		window.matchMedia = vi.fn(() => mockMM.mql as unknown as MediaQueryList);
	});

	afterEach(() => {
		cleanup();
	});

	it("sets data-theme to the default (amber, D-8) on document.documentElement on mount", async () => {
		render(
			<ThemeProvider>
				<div>child</div>
			</ThemeProvider>,
		);
		// Wait for effects
		await act(async () => {
			/* flush effects */
		});
		expect(document.documentElement.getAttribute("data-theme")).toBe("amber");
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

	it("paints the resolved theme through applyTheme on every resolved-theme change", async () => {
		render(
			<ThemeProvider>
				<div>child</div>
			</ThemeProvider>,
		);
		await act(async () => {
			/* flush effects */
		});
		const initial = getBuiltInTheme(DEFAULT_THEME_ID);
		expect(initial).toBeDefined();
		if (!initial) return;
		expect(applyTheme).toHaveBeenCalledWith(
			resolveTheme(initial),
			DEFAULT_THEME_ID,
		);
		vi.mocked(applyTheme).mockClear();

		await act(async () => {
			useThemeStore.getState().setTheme("paper");
		});
		const paper = getBuiltInTheme("paper");
		expect(paper).toBeDefined();
		if (!paper) return;
		expect(applyTheme).toHaveBeenCalledTimes(1);
		expect(applyTheme).toHaveBeenCalledWith(resolveTheme(paper), "paper");
		expect(
			document.documentElement.style.getPropertyValue("--rv-bg-base"),
		).toBe(paper.colors["bg-base"]);
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
		expect(electroview?.rpc).toBeDefined();
		vi.mocked(electroview!.rpc!.request.loadSettings).mockResolvedValueOnce({
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
		expect(electroview!.rpc!.request.loadSettings).toHaveBeenCalled();
		expect(useThemeStore.getState().preference).toBe("light");
	});

	it("keeps the default (amber) when loadSettings RPC fails", async () => {
		expect(electroview?.rpc).toBeDefined();
		vi.mocked(electroview!.rpc!.request.loadSettings).mockRejectedValueOnce(
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
		expect(useThemeStore.getState().preference).toBe(DEFAULT_THEME_ID);
	});
});

describe("useTheme hook", () => {
	beforeEach(() => {
		useThemeStore.setState({
			preference: DEFAULT_THEME_ID,
			systemResolution: "dark",
			resolvedTheme: DEFAULT_THEME_ID,
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
		expect(hookResult!.theme).toBe(DEFAULT_THEME_ID);
		expect(hookResult!.preference).toBe(DEFAULT_THEME_ID);
		expect(typeof hookResult!.setTheme).toBe("function");
	});
});
