/** @vitest-environment jsdom */
// MenuSelect against the real keyboard router (v0.9.0 Windows review).
//
// The router listens on document in capture phase, so it sees a key on the
// MenuSelect trigger before Radix does. With a canvas node focused (it stays
// focused after F6 or a click into the side panel) the canvas shortcuts used
// to run instead of the menu opening: Enter added a child, Delete deleted.

import { fireEvent, render, renderHook, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RoadmapSchema } from "../../../../../packages/core/src/schema";
import { MenuSelect } from "../../../src/mainview/components/MenuSelect";
import { useKeyboardRouter } from "../../../src/mainview/hooks/useKeyboardRouter";
import {
	MENU_SELECT_CHECK_TESTID,
	MENU_TRIGGER_SELECTOR,
} from "../../../src/mainview/lib/domContract";
import { FOCUS_NODE_EVENT } from "../../../src/mainview/lib/focusRequest";
import { useEventLogStore } from "../../../src/mainview/store/eventLogStore";
import { useFileViewStore } from "../../../src/mainview/store/fileViewStore";
import { useRoadmapStore } from "../../../src/mainview/store/roadmapStore";
import { useUiStore } from "../../../src/mainview/store/uiStore";
import { resetStore } from "../../helpers/resetStore";

const ROOT_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const CHILD_A_ID = "11111111-2222-4333-8444-555555555555";
const CHILD_B_ID = "22222222-3333-4444-8555-666666666666";
const CHILD_B1_ID = "33333333-4444-4555-8666-777777777777";

function makeSchema(): RoadmapSchema {
	return {
		version: "1.0",
		title: "T",
		nodes: [
			{
				id: ROOT_ID,
				title: "Root",
				status: "not-started",
				children: [
					{ id: CHILD_A_ID, title: "A", status: "not-started" },
					{
						id: CHILD_B_ID,
						title: "B",
						status: "not-started",
						children: [{ id: CHILD_B1_ID, title: "B1", status: "not-started" }],
					},
				],
			},
		],
	};
}

const OPTIONS = [
	{ value: "not-started", label: "Not started" },
	{ value: "in-progress", label: "In progress" },
	{ value: "completed", label: "Completed" },
];

const listeners: Array<() => void> = [];

/** Count window events of `type` until the test ends. */
function countEvents(type: string): () => number {
	let n = 0;
	const listener = (): void => {
		n++;
	};
	window.addEventListener(type, listener);
	listeners.push(() => window.removeEventListener(type, listener));
	return () => n;
}

/** Everything a canvas shortcut could change. */
function roadmapSnapshot() {
	const s = useRoadmapStore.getState();
	return {
		nodes: [...s.nodeIndex.values()].map((n) => `${n.id}:${n.status}`),
		pendingConfirmation: s.pendingConfirmation,
		focusedNodeId: s.focusedNodeId,
		selectedNodeId: s.selectedNodeId,
		collapsed: [...useFileViewStore.getState().collapsedIds],
	};
}

/**
 * Mount the router as Canvas.tsx does, plus one MenuSelect (inside the event
 * log drawer's section when `inDrawer`); focus its trigger.
 */
function setup({ inDrawer = false } = {}) {
	const togglePanelFocus = vi.fn<() => void>();
	renderHook(() =>
		useKeyboardRouter({
			inlineRename: {
				state: { nodeId: null },
				open: vi.fn(),
				cancel: vi.fn(),
			} as never,
			togglePanelFocus,
		}),
	);
	const onChange = vi.fn<(value: string) => void>();
	const select = (
		<MenuSelect
			label="Status"
			value="in-progress"
			options={OPTIONS}
			onChange={onChange}
		/>
	);
	render(
		inDrawer ? <section aria-label="Event log">{select}</section> : select,
	);
	const trigger = screen.getByRole("button", { name: "Status" });
	trigger.focus();
	return { trigger, togglePanelFocus, onChange };
}

const menuOpen = (): boolean => !!document.querySelector('[role="menu"]');

beforeEach(() => {
	useRoadmapStore.getState().loadSchema(makeSchema(), "/tmp/t.json");
	useRoadmapStore.getState().setFocusedNode(CHILD_B_ID);
});

afterEach(() => {
	while (listeners.length) listeners.pop()?.();
	resetStore();
	useFileViewStore.getState().expandAll();
	vi.restoreAllMocks();
});

describe("MenuSelect trigger with a canvas node focused (RC1)", () => {
	it("the trigger matches the selector the router stands down for", () => {
		const { trigger } = setup();
		expect(trigger.matches(MENU_TRIGGER_SELECTOR)).toBe(true);
	});

	for (const key of ["Enter", " ", "ArrowDown"]) {
		it(`${JSON.stringify(key)} opens the menu and leaves the roadmap alone`, () => {
			const { trigger } = setup();
			const focusRequests = countEvents(FOCUS_NODE_EVENT);
			const before = roadmapSnapshot();
			fireEvent.keyDown(trigger, { key });
			expect(menuOpen()).toBe(true);
			expect(roadmapSnapshot()).toEqual(before);
			expect(focusRequests()).toBe(0);
		});
	}

	for (const key of [
		"Delete",
		"Backspace",
		"Tab",
		"1",
		"2",
		"3",
		"4",
		"c",
		"ArrowUp",
		"ArrowLeft",
		"ArrowRight",
	]) {
		it(`${JSON.stringify(key)} does nothing to the roadmap and is not swallowed`, () => {
			const { trigger } = setup();
			const focusRequests = countEvents(FOCUS_NODE_EVENT);
			const before = roadmapSnapshot();
			const notCanceled = fireEvent.keyDown(trigger, { key });
			expect(roadmapSnapshot()).toEqual(before);
			expect(focusRequests()).toBe(0);
			// Not prevented: Tab still moves DOM focus, the rest reach Radix.
			expect(notCanceled).toBe(true);
			expect(menuOpen()).toBe(false);
		});
	}

	it("global keys still work from the trigger (F6, Ctrl+F, Ctrl+Shift+L, Ctrl+B)", () => {
		const { trigger, togglePanelFocus } = setup();
		const searches = countEvents("roadraven:focus-search");
		const logWasOpen = useEventLogStore.getState().isOpen;
		const sidebarWasCollapsed = useUiStore.getState().sidebarCollapsed;

		fireEvent.keyDown(trigger, { key: "F6" });
		fireEvent.keyDown(trigger, { key: "f", ctrlKey: true });
		fireEvent.keyDown(trigger, { key: "L", ctrlKey: true, shiftKey: true });
		fireEvent.keyDown(trigger, { key: "b", ctrlKey: true });

		expect(togglePanelFocus).toHaveBeenCalledTimes(1);
		expect(searches()).toBe(1);
		expect(useEventLogStore.getState().isOpen).toBe(!logWasOpen);
		expect(useUiStore.getState().sidebarCollapsed).toBe(!sidebarWasCollapsed);
		useEventLogStore.getState().setOpen(logWasOpen);
		useUiStore.getState().toggleSidebar();
	});

	it("Escape on a filter trigger inside the open event log still closes it", () => {
		useEventLogStore.getState().setOpen(true);
		const { trigger } = setup({ inDrawer: true });
		fireEvent.keyDown(trigger, { key: "Escape" });
		expect(useEventLogStore.getState().isOpen).toBe(false);
	});
});

describe("MenuSelect checked option (RC3)", () => {
	it("marks the checked option with a ✓ indicator, and only that one", () => {
		const { trigger } = setup();
		fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false });
		const items = screen.getAllByRole("menuitemradio");
		const checked = items.filter(
			(el) => el.getAttribute("aria-checked") === "true",
		);
		expect(checked.map((el) => el.textContent)).toEqual(["In progress✓"]);
		const marks = screen.getAllByTestId(MENU_SELECT_CHECK_TESTID);
		expect(marks).toHaveLength(1);
		expect(checked[0].contains(marks[0])).toBe(true);
		expect(marks[0].getAttribute("aria-hidden")).toBe("true");
	});
});
