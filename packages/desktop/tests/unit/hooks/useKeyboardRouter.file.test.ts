/** @vitest-environment jsdom */
// v0.8.2 F3 — file shortcuts in the keyboard router, routed through the
// fileCommands registry: Ctrl+N / Ctrl+O / Ctrl+S / Ctrl+Shift+S / Ctrl+B —
// plus Ctrl+, for Preferences (Phase 4).
import { fireEvent, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RoadmapSchema } from "../../../../../packages/core/src/schema";

const actions = vi.hoisted(() => ({
	newRoadmap: vi.fn(() => Promise.resolve()),
	openFile: vi.fn(() => Promise.resolve()),
	openRecent: vi.fn(() => Promise.resolve()),
	save: vi.fn(() => Promise.resolve()),
	saveAs: vi.fn(() => Promise.resolve({ filePath: null })),
	closeFile: vi.fn(() => Promise.resolve()),
	revealInFolder: vi.fn(() => Promise.resolve()),
	copyPath: vi.fn(() => Promise.resolve()),
}));

vi.mock("../../../src/mainview/hooks/useFileActions", () => actions);

import { useKeyboardRouter } from "../../../src/mainview/hooks/useKeyboardRouter";
import { usePreferencesStore } from "../../../src/mainview/store/preferencesStore";
import { useRoadmapStore } from "../../../src/mainview/store/roadmapStore";
import { useUiStore } from "../../../src/mainview/store/uiStore";
import { resetStore } from "../../helpers/resetStore";

const NODE_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const SCHEMA: RoadmapSchema = {
	version: "1.0",
	title: "T",
	nodes: [{ id: NODE_ID, title: "Root", status: "not-started" }],
};

function renderRouter() {
	renderHook(() =>
		useKeyboardRouter({
			inlineRename: {
				state: { nodeId: null },
				open: vi.fn(),
				cancel: vi.fn(),
				commit: vi.fn(),
				setTitle: vi.fn(),
			} as never,
			togglePanelFocus: vi.fn(),
		}),
	);
}

function press(
	key: string,
	mods: Partial<
		Pick<KeyboardEvent, "ctrlKey" | "metaKey" | "shiftKey" | "altKey">
	> = {},
	target: Element | Document = document,
): boolean {
	const event = new KeyboardEvent("keydown", {
		key,
		bubbles: true,
		cancelable: true,
		...mods,
	});
	fireEvent(target, event);
	return event.defaultPrevented;
}

beforeEach(() => {
	resetStore();
	useUiStore.setState({ sidebarCollapsed: false });
	vi.clearAllMocks();
	useRoadmapStore.getState().loadSchema(SCHEMA, "/tmp/plan.json");
});

afterEach(() => {
	resetStore();
	document.body.innerHTML = "";
});

describe("useKeyboardRouter — file shortcuts (F3)", () => {
	it("Ctrl+N → new", () => {
		renderRouter();
		expect(press("n", { ctrlKey: true })).toBe(true);
		expect(actions.newRoadmap).toHaveBeenCalledTimes(1);
	});

	it("Ctrl+O → open", () => {
		renderRouter();
		expect(press("o", { ctrlKey: true })).toBe(true);
		expect(actions.openFile).toHaveBeenCalledTimes(1);
	});

	it("Ctrl+S → save; Cmd+S on mac too", () => {
		renderRouter();
		expect(press("s", { ctrlKey: true })).toBe(true);
		expect(press("s", { metaKey: true })).toBe(true);
		expect(actions.save).toHaveBeenCalledTimes(2);
		expect(actions.saveAs).not.toHaveBeenCalled();
	});

	it("Ctrl+Shift+S → saveAs (upper-case key from the shift state)", () => {
		renderRouter();
		expect(press("S", { ctrlKey: true, shiftKey: true })).toBe(true);
		expect(actions.saveAs).toHaveBeenCalledTimes(1);
		expect(actions.save).not.toHaveBeenCalled();
	});

	it("Ctrl+B toggles the sidebar via uiStore", () => {
		renderRouter();
		expect(press("b", { ctrlKey: true })).toBe(true);
		expect(useUiStore.getState().sidebarCollapsed).toBe(true);
		press("b", { ctrlKey: true });
		expect(useUiStore.getState().sidebarCollapsed).toBe(false);
	});

	it("Ctrl+, opens Preferences, from a text input too", () => {
		renderRouter();
		expect(press(",", { ctrlKey: true })).toBe(true);
		expect(usePreferencesStore.getState().open).toBe(true);
		usePreferencesStore.setState({ open: false });

		const input = document.createElement("input");
		document.body.appendChild(input);
		input.focus();
		expect(press(",", { ctrlKey: true }, input)).toBe(true);
		expect(usePreferencesStore.getState().open).toBe(true);
		usePreferencesStore.setState({ open: false });
	});

	it("Ctrl+N / Ctrl+O / Ctrl+B are ignored inside a text input", () => {
		renderRouter();
		const input = document.createElement("input");
		document.body.appendChild(input);
		input.focus();
		expect(press("n", { ctrlKey: true }, input)).toBe(false);
		expect(press("o", { ctrlKey: true }, input)).toBe(false);
		expect(press("b", { ctrlKey: true }, input)).toBe(false);
		expect(actions.newRoadmap).not.toHaveBeenCalled();
		expect(actions.openFile).not.toHaveBeenCalled();
		expect(useUiStore.getState().sidebarCollapsed).toBe(false);
	});

	it("Ctrl+S and Ctrl+Shift+S still work inside a text input", () => {
		renderRouter();
		const textarea = document.createElement("textarea");
		document.body.appendChild(textarea);
		textarea.focus();
		expect(press("s", { ctrlKey: true }, textarea)).toBe(true);
		expect(press("S", { ctrlKey: true, shiftKey: true }, textarea)).toBe(true);
		expect(actions.save).toHaveBeenCalledTimes(1);
		expect(actions.saveAs).toHaveBeenCalledTimes(1);
	});

	it("respects the registry's enablement: Ctrl+S with no document is swallowed but not run", () => {
		resetStore();
		renderRouter();
		expect(press("s", { ctrlKey: true })).toBe(true);
		expect(actions.save).not.toHaveBeenCalled();
	});

	it("plain letters and Alt-chords fall through", () => {
		renderRouter();
		expect(press("s")).toBe(false);
		expect(press("n", { ctrlKey: true, altKey: true })).toBe(false);
		expect(actions.save).not.toHaveBeenCalled();
		expect(actions.newRoadmap).not.toHaveBeenCalled();
	});
});
