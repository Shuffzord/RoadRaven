/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RoadmapSchema } from "../../../../../packages/core/src/schema";
import {
	focusCanvasTabStop,
	togglePanelFocus,
	trackMenuFocus,
} from "../../../src/mainview/lib/focusHandoff";
import {
	FOCUS_NODE_EVENT,
	type NodeFocusRequest,
} from "../../../src/mainview/lib/focusRequest";
import { useRoadmapStore } from "../../../src/mainview/store/roadmapStore";
import { resetStore } from "../../helpers/resetStore";

// v0.8.1 Phase 5 — real DOM focus handoffs between the canvas, the SidePanel
// and the context menu (.planning/v0.8.1-canvas-focus-PLAN.md).
//
// The module moves DOM focus; it never reveals a card itself. Two different
// jobs need two different intents, and the tests below pin both:
//   - F6 is the user asking for the other pane, so leaving a control the user
//     chose is the point — the card is focused directly and a `nearest`
//     request reveals it.
//   - A menu closing without an action is NOT a request to move the camera,
//     so it goes through `align: "none"`, which lets the canvas controller's
//     never-steal guard decide and cannot disturb a fit that is animating.

const ROOT_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const CHILD_ID = "11111111-2222-4333-8444-555555555555";

const SCHEMA: RoadmapSchema = {
	version: "1.0",
	title: "Focus handoff fixture",
	nodes: [
		{
			id: ROOT_ID,
			title: "Root",
			status: "not-started",
			children: [{ id: CHILD_ID, title: "Child", status: "not-started" }],
		},
	],
};

const cleanups: Array<() => void> = [];

function captureRequests(): NodeFocusRequest[] {
	const seen: NodeFocusRequest[] = [];
	const listener = (e: Event): void => {
		seen.push((e as CustomEvent<NodeFocusRequest>).detail);
	};
	window.addEventListener(FOCUS_NODE_EVENT, listener);
	cleanups.push(() => window.removeEventListener(FOCUS_NODE_EVENT, listener));
	return seen;
}

/** The canvas container plus one card per node, as Canvas renders them. */
function mountCanvas(ids: string[] = [ROOT_ID, CHILD_ID]): HTMLElement {
	const container = document.createElement("div");
	container.setAttribute("role", "application");
	for (const id of ids) {
		const card = document.createElement("div");
		card.setAttribute("data-source-id", id);
		card.tabIndex = 0;
		container.appendChild(card);
	}
	document.body.appendChild(container);
	return container;
}

function card(id: string): HTMLElement {
	const el = document.querySelector<HTMLElement>(`[data-source-id="${id}"]`);
	if (!el) throw new Error(`no card ${id}`);
	return el;
}

/**
 * The SidePanel as App renders it. The `<aside>`, its resize grip and its
 * Close button exist even while the panel shows nothing — which is exactly
 * why the handoff waits for the panel's own marker instead of grabbing the
 * first focusable element it can see.
 */
function mountPanel(withNode = true): HTMLElement {
	const panel = document.createElement("aside");
	panel.setAttribute("aria-label", "Node details");
	const grip = document.createElement("div");
	grip.setAttribute("role", "separator");
	grip.setAttribute("aria-label", "Resize panel");
	grip.tabIndex = 0;
	panel.appendChild(grip);
	panel.appendChild(panelButton("Close panel"));
	document.body.appendChild(panel);
	if (withNode) addNodeControls(panel);
	return panel;
}

function panelButton(label: string): HTMLButtonElement {
	const button = document.createElement("button");
	button.type = "button";
	button.setAttribute("aria-label", label);
	return button;
}

/** The controls the panel only renders once a node is selected. */
function addNodeControls(panel: HTMLElement): void {
	const edit = panelButton("Edit node");
	edit.setAttribute("data-panel-focus", "");
	panel.insertBefore(edit, panel.querySelector('[aria-label="Close panel"]'));
}

function activeLabel(): string | null {
	return document.activeElement?.getAttribute("aria-label") ?? null;
}

/** Run `n` animation frames. */
function frames(n: number): void {
	vi.advanceTimersByTime(16 * n);
}

beforeEach(() => {
	resetStore();
	useRoadmapStore.getState().loadSchema(SCHEMA, "/tmp/handoff.json");
	vi.useFakeTimers({
		toFake: ["requestAnimationFrame", "cancelAnimationFrame"],
	});
});

afterEach(() => {
	while (cleanups.length) cleanups.pop()?.();
	vi.useRealTimers();
	document.body.innerHTML = "";
	resetStore();
});

describe("togglePanelFocus — canvas to panel (F6)", () => {
	it("focuses the control the panel marks, not the grip or its Close button", () => {
		mountCanvas();
		mountPanel();
		useRoadmapStore.getState().setFocusedNode(CHILD_ID);
		useRoadmapStore.getState().setSelectedNode(CHILD_ID);
		card(CHILD_ID).focus();

		togglePanelFocus();

		expect(activeLabel()).toBe("Edit node");
	});

	it("selects the focused node first, then focuses the control once it mounts", () => {
		mountCanvas();
		const panel = mountPanel(false);
		useRoadmapStore.getState().setFocusedNode(CHILD_ID);
		card(CHILD_ID).focus();

		togglePanelFocus();

		// Selecting is what opens the panel; its node controls only exist after
		// the render that follows, and the Close button already sitting there
		// must not be mistaken for them.
		expect(useRoadmapStore.getState().selectedNodeId).toBe(CHILD_ID);
		expect(activeLabel()).toBe(null);

		addNodeControls(panel);
		frames(2);

		expect(activeLabel()).toBe("Edit node");
	});

	it("does nothing when no node is focused or selected", () => {
		mountCanvas();
		mountPanel();

		togglePanelFocus();
		frames(5);

		expect(document.activeElement).toBe(document.body);
		expect(useRoadmapStore.getState().selectedNodeId).toBeNull();
	});

	it("gives up rather than polling forever when the panel never appears", () => {
		mountCanvas();
		useRoadmapStore.getState().setFocusedNode(CHILD_ID);
		useRoadmapStore.getState().setSelectedNode(CHILD_ID);
		card(CHILD_ID).focus();

		togglePanelFocus();
		frames(40);

		expect(document.activeElement).toBe(card(CHILD_ID));
	});
});

describe("togglePanelFocus — panel to canvas (F6)", () => {
	it("moves DOM focus onto the focused card and asks for a nearest reveal", () => {
		mountCanvas();
		const panel = mountPanel();
		useRoadmapStore.getState().setFocusedNode(CHILD_ID);
		useRoadmapStore.getState().setSelectedNode(CHILD_ID);
		panel.querySelector("button")?.focus();
		const seen = captureRequests();

		togglePanelFocus();

		// The canvas controller's never-steal guard refuses to pull focus out of
		// a control the user chose — by design. F6 IS the user choosing, so the
		// handoff moves DOM focus itself and only then asks for the reveal.
		expect(document.activeElement).toBe(card(CHILD_ID));
		expect(seen).toEqual([
			{ nodeId: CHILD_ID, align: "nearest", select: false, rename: false },
		]);
	});

	it("falls back to the tab-stop card when nothing is focused yet", () => {
		mountCanvas();
		const panel = mountPanel();
		useRoadmapStore.getState().setSelectedNode(CHILD_ID);
		panel.querySelector("button")?.focus();

		togglePanelFocus();

		// Nothing focused: the root card is the tree's single tab stop.
		expect(document.activeElement).toBe(card(ROOT_ID));
	});

	it("leaves focus alone when the focused node has no mounted card", () => {
		mountCanvas([ROOT_ID]);
		const panel = mountPanel();
		useRoadmapStore.getState().setFocusedNode(CHILD_ID);
		const button = panel.querySelector("button");
		button?.focus();
		const seen = captureRequests();

		togglePanelFocus();

		expect(document.activeElement).toBe(button);
		expect(seen).toEqual([]);
	});
});

describe("trackMenuFocus — a context menu that closes without an action", () => {
	it("asks the canvas to take its focused card back, one frame after the close", () => {
		mountCanvas();
		useRoadmapStore.getState().setFocusedNode(CHILD_ID);
		const seen = captureRequests();

		trackMenuFocus(true);
		trackMenuFocus(false);
		expect(seen, "not inside the closing dispatch").toEqual([]);

		frames(1);

		// `none`, not `nearest`: Escape is not a request to move the camera, and
		// a "Fit to View" item's animation is still running one frame later.
		expect(seen).toEqual([
			{ nodeId: CHILD_ID, align: "none", select: false, rename: false },
		]);
	});

	it("stands down when the menu action already stated a focus intent", () => {
		mountCanvas();
		useRoadmapStore.getState().setFocusedNode(CHILD_ID);
		const seen = captureRequests();

		trackMenuFocus(true);
		// What "Rename" and the five create items do: the reveal that follows
		// owns the rename input, and a restore would cancel it.
		window.dispatchEvent(
			new CustomEvent<NodeFocusRequest>(FOCUS_NODE_EVENT, {
				detail: {
					nodeId: CHILD_ID,
					align: "center",
					select: false,
					rename: true,
				},
			}),
		);
		trackMenuFocus(false);
		frames(2);

		expect(seen).toHaveLength(1);
		expect(seen[0].rename).toBe(true);
	});

	it("restores to the tab-stop card when the canvas has no focused node", () => {
		mountCanvas();
		const seen = captureRequests();

		trackMenuFocus(true);
		trackMenuFocus(false);
		frames(1);

		expect(seen).toEqual([
			{ nodeId: ROOT_ID, align: "none", select: false, rename: false },
		]);
	});

	it("forgets the previous menu's focus request when a new menu opens", () => {
		mountCanvas();
		useRoadmapStore.getState().setFocusedNode(CHILD_ID);
		const seen = captureRequests();

		trackMenuFocus(true);
		window.dispatchEvent(
			new CustomEvent<NodeFocusRequest>(FOCUS_NODE_EVENT, {
				detail: {
					nodeId: CHILD_ID,
					align: "center",
					select: false,
					rename: true,
				},
			}),
		);
		trackMenuFocus(false);
		frames(1);

		trackMenuFocus(true);
		trackMenuFocus(false);
		frames(1);

		expect(seen.at(-1)).toEqual({
			nodeId: CHILD_ID,
			align: "none",
			select: false,
			rename: false,
		});
	});
});

describe("focusCanvasTabStop", () => {
	it("is a no-op when no card is mounted", () => {
		const seen = captureRequests();

		focusCanvasTabStop();

		expect(seen).toEqual([]);
	});
});
