// @vitest-environment jsdom
// Node-search keyboard shortcuts on the global router: Ctrl+F focuses the
// search box (and MUST preventDefault so the renderer's native find-in-page
// never opens), F3 / Shift+F3 step matches. Unlike the older router tests,
// this mounts the real hook and dispatches real keydown events so the
// preventDefault contract — the thing that suppresses the browser find bar —
// is actually exercised.

import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { RoadmapSchema } from "../../../../../packages/core/src/schema";
import { useKeyboardRouter } from "../../../src/mainview/hooks/useKeyboardRouter";
import { useRoadmapStore } from "../../../src/mainview/store/roadmapStore";
import { resetStore } from "../../helpers/resetStore";

// Minimal RouterDeps stub — Ctrl+F / F3 return before touching any of these.
// Function stubs use `() => undefined` (not `() => {}`) to satisfy biome's
// noEmptyBlockStatements; they are never invoked by these tests.
const noop = (): undefined => undefined;
const deps = {
	inlineRename: {
		state: { nodeId: null, title: "" },
		open: noop,
		commit: noop,
		cancel: noop,
		setTitle: noop,
		updateForTransform: noop,
	},
	getTransform: () => ({ x: 0, y: 0, k: 1 }),
	getContainerRect: () => ({ left: 0, top: 0 }),
	getNodePosition: () => null,
	togglePanelFocus: noop,
} as unknown as Parameters<typeof useKeyboardRouter>[0];

const SCHEMA: RoadmapSchema = {
	version: "1.0",
	title: "Router Search Test",
	statusConfig: [{ id: "not-started", label: "Not Started" }],
	nodes: [
		{ id: "a", title: "Alpha task", status: "not-started" },
		{ id: "b", title: "Beta task", status: "not-started" },
	],
};

beforeEach(() => {
	resetStore();
});

afterEach(() => {
	resetStore();
});

// Dispatch a Ctrl+F keydown on document and report whether the router cancelled
// the default (the find-bar suppressor) and fired the focus-search event.
function pressCtrlF(): { defaultPrevented: boolean; focusFired: boolean } {
	let focusFired = false;
	const onFocus = () => {
		focusFired = true;
	};
	window.addEventListener("roadraven:focus-search", onFocus);
	const ev = new KeyboardEvent("keydown", {
		key: "f",
		ctrlKey: true,
		bubbles: true,
		cancelable: true,
	});
	document.dispatchEvent(ev);
	window.removeEventListener("roadraven:focus-search", onFocus);
	return { defaultPrevented: ev.defaultPrevented, focusFired };
}

describe("useKeyboardRouter node-search shortcuts", () => {
	it("Ctrl+F preventDefaults (suppresses native find) and dispatches focus-search", () => {
		renderHook(() => useKeyboardRouter(deps));

		const { defaultPrevented, focusFired } = pressCtrlF();

		expect(defaultPrevented).toBe(true);
		expect(focusFired).toBe(true);
	});

	it("Ctrl+F fires even while a text input is focused (overrides native find globally)", () => {
		renderHook(() => useKeyboardRouter(deps));
		const input = document.createElement("input");
		document.body.appendChild(input);
		input.focus();

		const { defaultPrevented, focusFired } = pressCtrlF();

		expect(defaultPrevented).toBe(true);
		expect(focusFired).toBe(true);

		document.body.removeChild(input);
	});

	it("F3 steps to the next match, Shift+F3 to the previous", () => {
		renderHook(() => useKeyboardRouter(deps));
		useRoadmapStore.getState().loadSchema(SCHEMA, "/test.json");
		useRoadmapStore.getState().setSearchQuery("task");
		expect(useRoadmapStore.getState().searchCurrentIndex).toBe(0);

		document.dispatchEvent(
			new KeyboardEvent("keydown", {
				key: "F3",
				bubbles: true,
				cancelable: true,
			}),
		);
		expect(useRoadmapStore.getState().searchCurrentIndex).toBe(1);

		document.dispatchEvent(
			new KeyboardEvent("keydown", {
				key: "F3",
				shiftKey: true,
				bubbles: true,
				cancelable: true,
			}),
		);
		expect(useRoadmapStore.getState().searchCurrentIndex).toBe(0);
	});
});
