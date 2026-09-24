// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parseColor } from "../../../../../shared/contrast";

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

import { ThemePicker } from "../../../src/mainview/components/ThemePicker";
import { useThemeStore } from "../../../src/mainview/store/themeStore";
import {
	DEFAULT_THEME_ID,
	getBuiltInTheme,
} from "../../../src/mainview/themes";
import fixtureJson from "./fixtures/css-tokens-pre-phase3.json";

// RC1 (F5): the picker's swatches were hand-copied hexes and drifted from the
// CSS (light accent #4a9eff vs --rv-accent #155bb8). The swatch must be the
// theme's own bg-base and accent.

const fixture = fixtureJson as Record<string, Record<string, string>>;

function swatchColours(item: HTMLElement): [string, string] {
	const spans = [...item.querySelectorAll("span span")] as HTMLElement[];
	expect(spans.length, "two swatch halves").toBe(2);
	return [
		spans[0].style.backgroundColor || spans[0].style.background,
		spans[1].style.backgroundColor || spans[1].style.background,
	];
}

describe("ThemePicker swatches", () => {
	beforeEach(() => {
		useThemeStore.setState({
			preference: "dark",
			systemResolution: "dark",
			resolvedTheme: "dark",
		});
	});

	afterEach(() => cleanup());

	it("paints every built-in theme's bg-base and accent, in registry order, then System", () => {
		render(<ThemePicker />);
		fireEvent.click(screen.getByRole("button", { name: /^Theme:/ }));
		const items = screen.getAllByRole("menuitem") as HTMLElement[];
		const ids = Object.keys(fixture);
		expect(items.length).toBe(ids.length + 1);
		const drift = ids.flatMap((id, i) => {
			const [bg, accent] = swatchColours(items[i]);
			const out: string[] = [];
			if (
				JSON.stringify(parseColor(bg)) !==
				JSON.stringify(parseColor(fixture[id]["--rv-bg-base"]))
			) {
				out.push(`${id} bg ${bg} != ${fixture[id]["--rv-bg-base"]}`);
			}
			if (
				JSON.stringify(parseColor(accent)) !==
				JSON.stringify(parseColor(fixture[id]["--rv-accent"]))
			) {
				out.push(`${id} accent ${accent} != ${fixture[id]["--rv-accent"]}`);
			}
			return out;
		});
		expect(drift).toEqual([]);
		expect(items[ids.length].textContent).toContain("System");
	});

	it("labels an unknown preference with the default theme it paints (D-8: amber)", () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {
			/* silence the fallback notice */
		});
		try {
			useThemeStore.getState().setTheme("solarized");
		} finally {
			warn.mockRestore();
		}
		render(<ThemePicker />);
		const name = getBuiltInTheme(DEFAULT_THEME_ID)?.meta.name ?? "";
		expect(name).not.toBe("");
		expect(screen.getByRole("button", { name: `Theme: ${name}` })).toBeTruthy();
	});
});
