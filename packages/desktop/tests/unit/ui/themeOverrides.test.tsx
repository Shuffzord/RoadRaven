// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import React, { act } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the rpc module to prevent WebSocket connection
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

import {
	buildOverrideVars,
	ThemeOverrideProvider,
} from "../../../src/mainview/components/ThemeOverrideProvider";
import { useThemeStore } from "../../../src/mainview/store/themeStore";

describe("buildOverrideVars", () => {
	it("returns empty object for undefined config", () => {
		const result = buildOverrideVars(undefined);
		expect(result).toEqual({});
	});

	it("returns empty object for empty themeConfig", () => {
		const result = buildOverrideVars({});
		expect(result).toEqual({});
	});

	it("maps statusColors to --rv-status-* and --rv-status-*-bg variables", () => {
		const result = buildOverrideVars({
			statusColors: { "in-progress": "#ff6b00" },
		});
		expect(result).toHaveProperty("--rv-status-in-progress", "#ff6b00");
		expect(result).toHaveProperty(
			"--rv-status-in-progress-bg",
			"rgba(255,107,0,0.1)",
		);
	});

	it("maps nodeShape.borderRadius to --node-radius", () => {
		const result = buildOverrideVars({
			nodeShape: { borderRadius: "2px" },
		});
		expect(result).toHaveProperty("--node-radius", "2px");
	});

	it("rejects non-hex-color statusColors values (CSS injection prevention)", () => {
		const result = buildOverrideVars({
			statusColors: {
				valid: "#ff6b00",
				"xss-url": "url(javascript:alert(1))",
				"xss-expression": "expression(alert(1))",
				"short-hex": "#f00",
				"eight-hex": "#ff6b00ff",
			},
		});
		// Only the valid hex color should be present
		expect(result).toHaveProperty("--rv-status-valid", "#ff6b00");
		expect(result).not.toHaveProperty("--rv-status-xss-url");
		expect(result).not.toHaveProperty("--rv-status-xss-expression");
		expect(result).not.toHaveProperty("--rv-status-short-hex");
		expect(result).not.toHaveProperty("--rv-status-eight-hex");
	});

	it("rejects borderRadius values not matching /^\\d+px$/ pattern", () => {
		const invalidValues = [
			"2em",
			"calc(2px + 1px)",
			"2px; background: red",
			"auto",
			"",
		];
		for (const val of invalidValues) {
			const result = buildOverrideVars({ nodeShape: { borderRadius: val } });
			expect(result).not.toHaveProperty("--node-radius");
		}
	});
});

describe("ThemeOverrideProvider", () => {
	beforeEach(() => {
		// Clear any leftover styles on documentElement
		document.documentElement.removeAttribute("style");
		// Reset theme store
		useThemeStore.setState({
			preference: "dark",
			systemResolution: "dark",
			resolvedTheme: "dark",
		});
	});

	it("renders children inside a div with inline CSS variable overrides", () => {
		render(
			<ThemeOverrideProvider
				themeConfig={{
					statusColors: { blocked: "#ff0000" },
				}}
			>
				<span>child content</span>
			</ThemeOverrideProvider>,
		);
		const container = screen.getByTestId("theme-override-container");
		expect(container).toBeTruthy();
		expect(container.textContent).toContain("child content");
		expect(container.style.getPropertyValue("--rv-status-blocked")).toBe(
			"#ff0000",
		);
	});

	it("override CSS variables are on the scoped container, NOT on document.documentElement (D-08)", () => {
		render(
			<ThemeOverrideProvider
				themeConfig={{
					statusColors: { "in-progress": "#ff6b00" },
				}}
			>
				<span>test</span>
			</ThemeOverrideProvider>,
		);
		const container = screen.getByTestId("theme-override-container");
		// Override should be on the container
		expect(container.style.getPropertyValue("--rv-status-in-progress")).toBe(
			"#ff6b00",
		);
		// Override should NOT be on document.documentElement
		expect(
			document.documentElement.style.getPropertyValue(
				"--rv-status-in-progress",
			),
		).toBe("");
	});

	it("switching base theme while overrides are active retains the overrides on the container", () => {
		const { rerender } = render(
			<ThemeOverrideProvider
				themeConfig={{
					statusColors: { completed: "#00ff00" },
					nodeShape: { borderRadius: "4px" },
				}}
			>
				<span>test</span>
			</ThemeOverrideProvider>,
		);

		// Simulate theme switch
		act(() => {
			useThemeStore.getState().setTheme("light");
		});

		// Re-render to pick up any changes
		rerender(
			<ThemeOverrideProvider
				themeConfig={{
					statusColors: { completed: "#00ff00" },
					nodeShape: { borderRadius: "4px" },
				}}
			>
				<span>test</span>
			</ThemeOverrideProvider>,
		);

		const container = screen.getByTestId("theme-override-container");
		expect(container.style.getPropertyValue("--rv-status-completed")).toBe(
			"#00ff00",
		);
		expect(container.style.getPropertyValue("--node-radius")).toBe("4px");
	});
});
