// @vitest-environment jsdom
// v0.8.3 Phase 4: the picker lists user themes in their own group, flags
// invalid files and contrast failures with a badge, and stays keyboard
// navigable across both groups (the a11y specs select items by name).
import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
} from "@testing-library/react";
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
import {
	DELETE_THEME_CANCEL_LABEL,
	DELETE_THEME_CONFIRM_LABEL,
	deleteThemeLabel,
	deleteThemeTitle,
} from "../../../src/mainview/lib/domContract";
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
		// Theme rows only: a user row's "×" is a menuitem too (Phase 7).
		const names = (g: HTMLElement) =>
			[...g.querySelectorAll('[role="menuitem"]')]
				.filter((el) => !el.getAttribute("aria-label"))
				.map((el) => el.querySelector("span.text-left")?.textContent?.trim());
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
		// Theme rows only: a user row's "×" is a menuitem too (Phase 7).
		const items = screen
			.getAllByRole("menuitem")
			.filter((el) => !el.getAttribute("aria-label"));
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

// v0.8.3 Phase 7 (D-11): a delete control on each "Your themes" row. It is a
// menuitem of its own (a plain button inside a menu fails axe's
// aria-required-children) named "Delete theme <name>", so the theme row's
// own accessible name stays the bare theme name the a11y sampler selects on.
describe("ThemePicker delete control", () => {
	const deleteButton = (name: string) =>
		screen.getByRole("menuitem", { name: deleteThemeLabel(name) });
	const confirmDialog = (name: string) =>
		screen.getByRole("dialog", { name: deleteThemeTitle(name) });

	beforeEach(() => {
		useThemeStore.setState({
			preference: "dark",
			systemResolution: "dark",
			resolvedTheme: "dark",
			userThemes: [mine, murky, broken],
			deleteUserTheme: vi.fn(() => Promise.resolve(true)),
		});
	});

	afterEach(() => cleanup());

	it("every user row has a delete button named after the theme; built-in rows have none", () => {
		render(<ThemePicker />);
		openMenu();
		for (const name of ["Mine", "Murky", "broken"]) {
			expect(deleteButton(name)).toBeTruthy();
			// The theme row itself keeps its exact name.
			expect(screen.getByRole("menuitem", { name })).not.toBe(
				deleteButton(name),
			);
		}
		const builtIn = screen.getByRole("group", { name: THEME_GROUP_BUILT_IN });
		expect(
			[...builtIn.querySelectorAll('[role="menuitem"]')].filter((el) =>
				el.getAttribute("aria-label")?.startsWith("Delete theme"),
			),
		).toEqual([]);
		expect(screen.queryByRole("menuitem", { name: /Delete theme Dark/ })).toBe(
			null,
		);
	});

	it("clicking the delete button opens a confirm without selecting the theme; Delete calls the store", async () => {
		render(<ThemePicker />);
		openMenu();
		fireEvent.click(deleteButton("Mine"));
		expect(useThemeStore.getState().preference).toBe("dark");
		const dialog = confirmDialog("Mine");
		expect(dialog.textContent).toContain("This removes its file.");
		expect(useThemeStore.getState().deleteUserTheme).not.toHaveBeenCalled();

		fireEvent.click(
			screen.getByRole("button", { name: DELETE_THEME_CONFIRM_LABEL }),
		);
		expect(useThemeStore.getState().deleteUserTheme).toHaveBeenCalledWith(
			"mine",
		);
		await vi.waitFor(() =>
			expect(screen.queryByRole("dialog", { name: /Delete theme/ })).toBe(null),
		);
		// The menu is still open: the user sees the row go.
		expect(screen.getByRole("menu", { name: "Theme" })).toBeTruthy();
	});

	it("Cancel and Escape close the confirm, keep the theme and return focus to its row", async () => {
		render(<ThemePicker />);
		openMenu();
		fireEvent.click(deleteButton("Murky"));
		fireEvent.click(
			screen.getByRole("button", { name: DELETE_THEME_CANCEL_LABEL }),
		);
		await vi.waitFor(() =>
			expect(screen.queryByRole("dialog", { name: /Delete theme/ })).toBe(null),
		);
		expect(useThemeStore.getState().deleteUserTheme).not.toHaveBeenCalled();
		expect(screen.getByRole("menu", { name: "Theme" })).toBeTruthy();
		// Radix hands focus back on a macrotask after the dialog unmounts.
		await vi.waitFor(() =>
			expect(document.activeElement).toBe(
				screen.getByRole("menuitem", { name: "Murky" }),
			),
		);

		fireEvent.click(deleteButton("Murky"));
		const dialog = confirmDialog("Murky");
		fireEvent.keyDown(dialog, { key: "Escape" });
		await vi.waitFor(() =>
			expect(screen.queryByRole("dialog", { name: /Delete theme/ })).toBe(null),
		);
		expect(screen.getByRole("menu", { name: "Theme" })).toBeTruthy();
		await vi.waitFor(() =>
			expect(document.activeElement).toBe(
				screen.getByRole("menuitem", { name: "Murky" }),
			),
		);
	});

	it("arrow keys walk the theme rows only; the delete buttons are reached with Tab or the Delete key", () => {
		render(<ThemePicker />);
		const menu = openMenu();
		const rows = screen
			.getAllByRole("menuitem")
			.filter((el) => !el.getAttribute("aria-label")?.startsWith("Delete"));
		expect(
			rows.map((el) => el.querySelector("span.text-left")?.textContent),
		).toEqual([
			...BUILT_IN_THEMES.map((t) => t.meta.name),
			"System",
			"Mine",
			"Murky",
			"broken",
		]);
		// Focus that arrives by Tab or click (not the arrow keys) is a native
		// focus event; act() lets the row's onFocus land before the next key.
		act(() => screen.getByRole("menuitem", { name: "Mine" }).focus());
		fireEvent.keyDown(menu, { key: "ArrowDown" });
		expect(document.activeElement).toBe(
			screen.getByRole("menuitem", { name: "Murky" }),
		);
		fireEvent.keyDown(menu, { key: "ArrowDown" });
		expect(document.activeElement).toBe(
			screen.getByRole("menuitem", { name: "broken" }),
		);
		fireEvent.keyDown(menu, { key: "ArrowDown" });
		expect(document.activeElement).toBe(rows[0]);
		fireEvent.keyDown(menu, { key: "End" });
		expect(document.activeElement).toBe(
			screen.getByRole("menuitem", { name: "broken" }),
		);
		// Tab order puts the delete button right after its row.
		expect(deleteButton("broken").previousElementSibling).toBe(
			screen.getByRole("menuitem", { name: "broken" }),
		);
		expect(deleteButton("broken").tagName).toBe("BUTTON");

		// Delete on a focused user row opens its confirm; on a built-in, nothing.
		act(() => rows[0].focus());
		fireEvent.keyDown(menu, { key: "Delete" });
		expect(screen.queryByRole("dialog", { name: /Delete theme/ })).toBe(null);
		fireEvent.keyDown(menu, { key: "End" });
		fireEvent.keyDown(menu, { key: "Delete" });
		expect(confirmDialog("broken")).toBeTruthy();
	});
});
