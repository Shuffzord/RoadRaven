// @vitest-environment jsdom
// v0.8.3 Phase 4: the picker lists user themes in their own group, flags
// invalid files and contrast failures with a badge, and stays keyboard
// navigable across both groups (the a11y specs select items by name).
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { UserThemeEntry } from "../../../../../shared/types";

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
	THEME_BADGE_TESTID,
	THEME_GROUP_BUILT_IN,
	THEME_GROUP_USER,
	ThemePicker,
} from "../../../src/mainview/components/ThemePicker";
import { useThemeStore } from "../../../src/mainview/store/themeStore";
import { BUILT_IN_THEMES, themeForId } from "../../../src/mainview/themes";

const mine: UserThemeEntry = {
	id: "mine",
	file: {
		id: "mine",
		meta: { name: "Mine", mode: "dark" },
		colors: themeForId("dark").colors,
	},
	requiredFailures: 0,
};
const murky: UserThemeEntry = {
	id: "murky",
	file: {
		id: "murky",
		meta: { name: "Murky", mode: "dark" },
		colors: themeForId("dark").colors,
	},
	requiredFailures: 2,
};
const broken: UserThemeEntry = { id: "broken", error: "invalid JSON" };

function openMenu() {
	fireEvent.click(screen.getByRole("button", { name: /^Theme:/ }));
	return screen.getByRole("menu", { name: "Theme" });
}

describe("ThemePicker with user themes", () => {
	beforeEach(() => {
		useThemeStore.setState({
			preference: "dark",
			systemResolution: "dark",
			resolvedTheme: "dark",
			userThemes: [mine, murky, broken],
		});
	});

	afterEach(() => cleanup());

	it("renders a built-in group (with System) and a user group", () => {
		render(<ThemePicker />);
		openMenu();
		const builtIn = screen.getByRole("group", { name: THEME_GROUP_BUILT_IN });
		const user = screen.getByRole("group", { name: THEME_GROUP_USER });
		const names = (g: HTMLElement) =>
			[...g.querySelectorAll('[role="menuitem"]')].map((el) =>
				el.querySelector("span.text-left")?.textContent?.trim(),
			);
		expect(names(builtIn)).toEqual([
			...BUILT_IN_THEMES.map((t) => t.meta.name),
			"System",
		]);
		expect(names(user)).toEqual(["Mine", "Murky", "broken"]);
	});

	it("omits the user group when there are no user themes", () => {
		useThemeStore.setState({ userThemes: [] });
		render(<ThemePicker />);
		openMenu();
		expect(screen.queryByRole("group", { name: THEME_GROUP_USER })).toBeNull();
		expect(screen.getAllByRole("menuitem")).toHaveLength(
			BUILT_IN_THEMES.length + 1,
		);
	});

	it("flags an invalid file with a badge carrying the reason, keeping the item's name exact", () => {
		render(<ThemePicker />);
		openMenu();
		const item = screen.getByRole("menuitem", { name: "broken" });
		const badge = item.querySelector(
			`[data-testid="${THEME_BADGE_TESTID}"]`,
		) as HTMLElement;
		expect(badge.getAttribute("title")).toBe("invalid JSON");
		expect(item.getAttribute("aria-disabled")).toBe("true");
		const describedBy = item.getAttribute("aria-describedby") ?? "";
		expect(document.getElementById(describedBy)?.textContent).toBe(
			"invalid JSON",
		);
		expect(screen.queryAllByTestId(THEME_BADGE_TESTID)).toHaveLength(2);
	});

	it("flags required contrast failures without disabling the item", () => {
		render(<ThemePicker />);
		openMenu();
		const item = screen.getByRole("menuitem", { name: "Murky" });
		const badge = item.querySelector(
			`[data-testid="${THEME_BADGE_TESTID}"]`,
		) as HTMLElement;
		expect(badge.getAttribute("title")).toBe("2 required contrast pairs fail");
		expect(item.getAttribute("aria-disabled")).toBeNull();
		fireEvent.click(item);
		expect(useThemeStore.getState().preference).toBe("murky");
	});

	it("selects a user theme by click and does nothing for an invalid one", () => {
		render(<ThemePicker />);
		openMenu();
		fireEvent.click(screen.getByRole("menuitem", { name: "broken" }));
		expect(useThemeStore.getState().preference).toBe("dark");
		fireEvent.click(screen.getByRole("menuitem", { name: "Mine" }));
		expect(useThemeStore.getState().preference).toBe("mine");
	});

	it("labels the button with the user theme's name when it is active", () => {
		useThemeStore.setState({ preference: "mine", resolvedTheme: "mine" });
		render(<ThemePicker />);
		expect(screen.getByRole("button", { name: "Theme: Mine" })).toBeTruthy();
	});

	it("arrow keys, Home and End walk across both groups", () => {
		render(<ThemePicker />);
		const menu = openMenu();
		const items = screen.getAllByRole("menuitem");
		const last = items.length - 1;

		fireEvent.keyDown(menu, { key: "End" });
		expect(document.activeElement).toBe(items[last]);
		fireEvent.keyDown(menu, { key: "ArrowDown" });
		expect(document.activeElement).toBe(items[0]);
		fireEvent.keyDown(menu, { key: "ArrowUp" });
		expect(document.activeElement).toBe(items[last]);
		fireEvent.keyDown(menu, { key: "Home" });
		expect(document.activeElement).toBe(items[0]);
		// From System (last built-in) ArrowDown enters the user group.
		const systemIdx = BUILT_IN_THEMES.length;
		items[systemIdx].focus();
		for (let i = 0; i < systemIdx; i++) {
			fireEvent.keyDown(menu, { key: "ArrowDown" });
		}
		expect(document.activeElement).toBe(items[systemIdx]);
		fireEvent.keyDown(menu, { key: "ArrowDown" });
		expect(document.activeElement).toBe(items[systemIdx + 1]);
	});
});
