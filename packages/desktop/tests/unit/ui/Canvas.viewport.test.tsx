// @vitest-environment jsdom
import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RoadmapSchema } from "../../../../../packages/core/src/schema";
import { resetStore } from "../../helpers/resetStore";

// v0.8.1 Phase 1 (RC1, RC7, RC10) — .planning/v0.8.1-canvas-focus-PLAN.md.
//
// react-d3-tree owns the live d3 transform but takes `translate`/`zoom` as
// props; jsdom has no layout and no d3 gestures, so the Tree is replaced by a
// capture component that records the props it was handed and lets each test
// drive `onUpdate` by hand — exactly the callback a real drag/wheel fires.
// The mock also invokes `renderCustomNodeElement` for a caller-supplied set of
// layout points, which is what populates Canvas's node-position cache.

interface FakeTreeProps {
	translate: { x: number; y: number };
	zoom: number;
	scaleExtent?: { min: number; max: number };
	onUpdate?: (target: {
		node: unknown;
		zoom: number;
		translate: { x: number; y: number };
	}) => void;
	renderCustomNodeElement?: (props: unknown) => React.ReactNode;
}

const captured = vi.hoisted(() => ({
	props: [] as FakeTreeProps[],
	nodes: [] as { id: string; name: string; x: number; y: number }[],
}));

vi.mock("react-d3-tree", async () => {
	const React = await import("react");
	const FakeTree = (props: FakeTreeProps): React.ReactElement => {
		captured.props.push(props);
		return React.createElement(
			"svg",
			{ "data-testid": "fake-tree" },
			captured.nodes.map((n) =>
				React.createElement(
					"g",
					{ key: n.id },
					props.renderCustomNodeElement?.({
						nodeDatum: {
							name: n.name,
							attributes: { id: n.id, status: "not-started" },
							children: [],
							__rd3t: { collapsed: false },
						},
						toggleNode: vi.fn(),
						hierarchyPointNode: { x: n.x, y: n.y },
					}),
				),
			),
		);
	};
	return { default: FakeTree };
});

import { Canvas } from "../../../src/mainview/components/Canvas";
import {
	FOCUS_NODE_EVENT,
	type NodeFocusRequest,
	requestNodeFocus,
} from "../../../src/mainview/lib/focusRequest";
import { SCALE_EXTENT } from "../../../src/mainview/lib/viewportMath";
import { useRoadmapStore } from "../../../src/mainview/store/roadmapStore";

const ROOT_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const FAR_ID = "11111111-2222-4333-8444-555555555555";

const SCHEMA: RoadmapSchema = {
	version: "1.0",
	title: "Viewport fixture",
	nodes: [
		{
			id: ROOT_ID,
			title: "Root",
			status: "not-started",
			children: [{ id: FAR_ID, title: "Far", status: "not-started" }],
		},
	],
};

// Both the layout points the fake Tree feeds `renderCustomNodeElement` and
// the SCREEN rects the canvas now measures (v0.8.1 Phase 2: the DOM is the
// registry and every pan/fit number comes from getBoundingClientRect, which
// jsdom always answers 0 for — hence the stub below).
const LAYOUT = [
	{ id: ROOT_ID, name: "Root", x: 0, y: 0 },
	{ id: FAR_ID, name: "Far", x: 1000, y: 1000 },
];

interface Box {
	left: number;
	top: number;
	right: number;
	bottom: number;
}

/** 800x600 at the origin, so the comfort zone is x 200..600 / y 150..450. */
const CONTAINER_RECT: Box = { left: 0, top: 0, right: 800, bottom: 600 };
const ZERO: Box = { left: 0, top: 0, right: 0, bottom: 0 };
/** Root sits in the comfort zone; "Far" needs a (-100, -70) pan to reach it. */
const CARD_RECTS: Record<string, Box> = {};
const DEFAULT_CARD_RECTS: Record<string, Box> = {
	[ROOT_ID]: { left: 350, top: 280, right: 450, bottom: 320 },
	[FAR_ID]: { left: 650, top: 500, right: 750, bottom: 540 },
};

function toDomRect(box: Box): DOMRect {
	return {
		...box,
		x: box.left,
		y: box.top,
		width: box.right - box.left,
		height: box.bottom - box.top,
		toJSON: () => ({}),
	} as DOMRect;
}

/** Give the canvas container and every node card a real-looking rect. */
function stubLayout(): void {
	vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
		function (this: Element): DOMRect {
			const el = this as HTMLElement;
			const id = el.dataset?.sourceId;
			if (id) return toDomRect(CARD_RECTS[id] ?? ZERO);
			if (el.getAttribute?.("role") === "application") {
				return toDomRect(CONTAINER_RECT);
			}
			return toDomRect(ZERO);
		},
	);
}

function lastProps(): FakeTreeProps {
	const props = captured.props.at(-1);
	if (!props) throw new Error("the Tree was never rendered");
	return props;
}

/** Drive the callback a real d3 drag / wheel gesture frame fires. */
function gestureFrame(translate: { x: number; y: number }, zoom: number): void {
	act(() => {
		lastProps().onUpdate?.({ node: null, zoom, translate });
	});
}

/** A complete drag: gesture frames, then the pointer comes back up. */
function gesture(
	container: HTMLElement,
	translate: { x: number; y: number },
	zoom: number,
): void {
	gestureFrame(translate, zoom);
	act(() => {
		container.dispatchEvent(new Event("pointerup", { bubbles: true }));
	});
}

function viewport(): { x: number; y: number; k: number } {
	const s = useRoadmapStore.getState();
	return { x: s.translate.x, y: s.translate.y, k: s.zoomLevel };
}

function renderCanvas(): HTMLElement {
	const { container } = render(<Canvas />);
	const root = container.querySelector<HTMLElement>('[role="application"]');
	if (!root) throw new Error("canvas container did not render");
	return root;
}

beforeEach(() => {
	captured.props.length = 0;
	captured.nodes = LAYOUT;
	for (const key of Object.keys(CARD_RECTS)) delete CARD_RECTS[key];
	Object.assign(CARD_RECTS, DEFAULT_CARD_RECTS);
	resetStore();
	stubLayout();
	act(() => {
		useRoadmapStore.getState().loadSchema(SCHEMA, "/test/viewport.json");
	});
});

afterEach(() => {
	vi.useRealTimers();
	vi.restoreAllMocks();
	resetStore();
});

describe("Canvas viewport truth (RC1)", () => {
	it("syncs a gesture's translate AND zoom into the store", () => {
		const container = renderCanvas();
		expect(viewport()).toEqual({ x: 400, y: 50, k: 0.8 });

		gesture(container, { x: -90, y: 239.5 }, 0.4595);

		expect(viewport()).toEqual({ x: -90, y: 239.5, k: 0.4595 });
	});

	it("passes the gesture transform back to the Tree on the next render", () => {
		const container = renderCanvas();

		gesture(container, { x: -90, y: 239.5 }, 0.4595);

		expect(lastProps().translate).toEqual({ x: -90, y: 239.5 });
		expect(lastProps().zoom).toBe(0.4595);
	});

	it("does not re-render the tree per gesture frame (perf fallback)", () => {
		const container = renderCanvas();
		const rendersBefore = captured.props.length;

		for (let i = 1; i <= 10; i++) gestureFrame({ x: 400 - i, y: 50 + i }, 0.8);
		const rendersDuringGesture = captured.props.length;
		// ...but the camera position is already readable for anything that
		// asks: only the store write is deferred, not the knowledge.
		expect(viewport()).toEqual({ x: 400, y: 50, k: 0.8 });

		act(() => {
			container.dispatchEvent(new Event("pointerup", { bubbles: true }));
		});

		expect(rendersDuringGesture).toBe(rendersBefore);
		expect(viewport()).toEqual({ x: 390, y: 60, k: 0.8 });
	});

	it("syncs a wheel gesture that never sends a pointerup, after a delay", () => {
		vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
		renderCanvas();

		gestureFrame({ x: -90, y: 239.5 }, 0.4595);
		expect(viewport()).toEqual({ x: 400, y: 50, k: 0.8 });

		act(() => {
			vi.advanceTimersByTime(500);
		});

		expect(viewport()).toEqual({ x: -90, y: 239.5, k: 0.4595 });
	});

	it("performs no store write for the componentDidUpdate echo", () => {
		const container = renderCanvas();
		gesture(container, { x: -90, y: 239.5 }, 0.4595);

		let notifications = 0;
		const unsubscribe = useRoadmapStore.subscribe(() => {
			notifications++;
		});
		// react-d3-tree echoes state.d3 through onUpdate after every render it
		// does because the props changed. Those values are already in the store.
		gestureFrame({ x: -90, y: 239.5 }, 0.4595);
		act(() => {
			container.dispatchEvent(new Event("pointerup", { bubbles: true }));
		});
		unsubscribe();

		expect(notifications).toBe(0);
	});

	// The RC1 regression in its original shape: "reset view, drag, reset view
	// again" was a no-op, because the gesture never reached the store and the
	// second command therefore wrote a value the store already held (its own
	// guard then dropped it). Phase 5 deleted `resetView`, so the same
	// round-trip is expressed with the viewport command that survived.
	it("command -> gesture -> the same command moves the camera the second time", () => {
		const container = renderCanvas();
		const HOME = { x: 400, y: 50 };
		act(() => {
			useRoadmapStore.getState().setViewport(HOME, 0.8);
		});
		const afterFirst = { ...lastProps().translate };

		gesture(container, { x: -90, y: 239.5 }, 0.4595);
		const beforeSecond = { ...lastProps().translate };

		act(() => {
			useRoadmapStore.getState().setViewport(HOME, 0.8);
		});

		expect(beforeSecond).not.toEqual(afterFirst);
		expect(lastProps().translate).not.toEqual(beforeSecond);
		expect(lastProps().translate).toEqual(afterFirst);
	});
});

describe("Canvas programmatic pan (RC1, RC10)", () => {
	beforeEach(() => {
		vi.useFakeTimers({
			toFake: ["requestAnimationFrame", "cancelAnimationFrame", "performance"],
		});
	});

	function focusFar(): void {
		act(() => {
			requestNodeFocus(FAR_ID, { align: "nearest" });
		});
	}

	it("starts from the gesture transform and leaves the zoom untouched", () => {
		renderCanvas();
		// Deliberately NOT ended: a pan requested while the gesture value is
		// still only in the live mirror must start from it, not from the store.
		gestureFrame({ x: 10, y: 20 }, 0.5);

		focusFar();
		act(() => {
			vi.advanceTimersByTime(16);
		});
		const firstFrame = viewport();

		act(() => {
			vi.advanceTimersByTime(1000);
		});
		const settled = viewport();

		// The pan continues from where the gesture left the camera...
		expect(firstFrame.x).toBeCloseTo(10, 0);
		expect(firstFrame.y).toBeCloseTo(20, 0);
		// ...and moves by exactly the comfort-zone delta the card's measured
		// rect asks for: centre (700, 520) -> (600, 450).
		expect(settled).toEqual({ x: -90, y: -50, k: 0.5 });
		expect(lastProps().zoom).toBe(0.5);
	});

	it("cancels an in-flight pan on pointerdown inside the canvas", () => {
		const container = renderCanvas();
		focusFar();
		act(() => {
			vi.advanceTimersByTime(16);
		});
		const interrupted = viewport();

		act(() => {
			container.dispatchEvent(new Event("pointerdown", { bubbles: true }));
			vi.advanceTimersByTime(1000);
		});

		expect(viewport()).toEqual(interrupted);
	});

	it("cancels an in-flight pan on wheel inside the canvas", () => {
		const container = renderCanvas();
		focusFar();
		act(() => {
			vi.advanceTimersByTime(16);
		});
		const interrupted = viewport();

		act(() => {
			container.dispatchEvent(new Event("wheel", { bubbles: true }));
			vi.advanceTimersByTime(1000);
		});

		expect(viewport()).toEqual(interrupted);
	});
});

describe("Canvas zoom extent (RC7)", () => {
	it("hands the shared scale extent to the Tree", () => {
		renderCanvas();

		expect(lastProps().scaleExtent).toEqual(SCALE_EXTENT);
	});
});

// v0.8.1 Phase 2 (RC5, D3): fit always fits the WHOLE tree, and its bounding
// box is the union of the cards actually mounted — measured, so a collapsed
// subtree cannot inflate it and LR coordinates cannot invert it.
describe("Canvas fit to view (RC5, D3)", () => {
	/** A tree too big for the viewport, so the fit zoom is not the max. */
	const WIDE_FAR: Box = { left: 1650, top: 1500, right: 1750, bottom: 1540 };
	// Union 350..1750 x 280..1540 at transform (400, 50, k 0.8):
	// local 1750 x 1575 -> zoom = min(680/1750, 510/1575) = 0.323809...
	const WIDE_FIT = { x: 136.904_761_904, y: -48.095_238_095, k: 0.323_809_523 };

	beforeEach(() => {
		vi.useFakeTimers({
			toFake: ["requestAnimationFrame", "cancelAnimationFrame", "performance"],
		});
	});

	function fit(): void {
		act(() => {
			useRoadmapStore.getState().fitView();
			vi.advanceTimersByTime(2000);
		});
	}

	it("fits the union of the mounted cards' rects", () => {
		CARD_RECTS[FAR_ID] = WIDE_FAR;
		renderCanvas();

		fit();

		const settled = viewport();
		expect(settled.k).toBeCloseTo(WIDE_FIT.k, 6);
		expect(settled.x).toBeCloseTo(WIDE_FIT.x, 6);
		expect(settled.y).toBeCloseTo(WIDE_FIT.y, 6);
	});

	it("ignores a node whose card is not mounted (collapsed subtree)", () => {
		CARD_RECTS[FAR_ID] = WIDE_FAR;
		// Only Root renders: "Far" lives inside a collapsed subtree now.
		captured.nodes = LAYOUT.slice(0, 1);
		renderCanvas();

		fit();

		// Root alone would fit far above the extent, so the zoom is the cap and
		// the camera centres the one card rather than the stale wide box.
		const settled = viewport();
		expect(settled.k).toBe(SCALE_EXTENT.max);
		expect(settled.x).toBeCloseTo(400 - 0 * settled.k, 6);
	});

	it("never leaves the shared scale extent", () => {
		CARD_RECTS[FAR_ID] = { left: -9000, top: -9000, right: 9000, bottom: 9000 };
		renderCanvas();

		fit();

		const settled = viewport();
		expect(settled.k).toBeGreaterThanOrEqual(SCALE_EXTENT.min);
		expect(settled.k).toBeLessThanOrEqual(SCALE_EXTENT.max);
	});

	it("still fits the whole tree when a node is focused and selected (D3)", () => {
		CARD_RECTS[FAR_ID] = WIDE_FAR;
		renderCanvas();
		act(() => {
			useRoadmapStore.getState().setFocusedNode(ROOT_ID);
			useRoadmapStore.getState().setSelectedNode(ROOT_ID);
		});

		fit();

		// The old close-up branch would have zoomed to SCALE_EXTENT.max on Root.
		expect(viewport().k).toBeCloseTo(WIDE_FIT.k, 6);
	});

	it("publishes a pending gesture before its first store write", () => {
		CARD_RECTS[FAR_ID] = WIDE_FAR;
		renderCanvas();
		// A wheel gesture with no pointerup: still only in the live mirror.
		gestureFrame({ x: -90, y: 239.5 }, 0.4595);
		const writes: { x: number; y: number; k: number }[] = [];
		const unsubscribe = useRoadmapStore.subscribe((s) =>
			writes.push({ x: s.translate.x, y: s.translate.y, k: s.zoomLevel }),
		);

		fit();
		unsubscribe();

		// Without the flush the gesture would be dropped by the fit's own
		// setZoomLevel and its translate lost.
		expect(writes[0]).toEqual({ x: -90, y: 239.5, k: 0.4595 });
	});

	it("does nothing when no card is mounted", () => {
		captured.nodes = [];
		renderCanvas();
		const before = viewport();

		fit();

		expect(viewport()).toEqual(before);
	});
});

describe("Canvas mouse selection (RC3)", () => {
	it("asks for a nearest reveal and selects, in one explicit request", () => {
		const requests: NodeFocusRequest[] = [];
		const listener = (e: Event): void => {
			requests.push((e as CustomEvent<NodeFocusRequest>).detail);
		};
		window.addEventListener(FOCUS_NODE_EVENT, listener);
		const container = renderCanvas();

		const card = container.querySelector<HTMLElement>(
			`[data-source-id="${FAR_ID}"]`,
		);
		act(() => {
			card?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
		});
		window.removeEventListener(FOCUS_NODE_EVENT, listener);

		expect(requests).toEqual([
			{ nodeId: FAR_ID, align: "nearest", select: true, rename: false },
		]);
		const state = useRoadmapStore.getState();
		expect(state.selectedNodeId).toBe(FAR_ID);
		expect(state.focusedNodeId).toBe(FAR_ID);
	});
});

// v0.8.1 Phase 4 (RC4): Canvas hands the focus controller its `openRename`,
// so a create-and-rename request ends in a real input inside the new card —
// no `roadraven:open-rename` bridge, no rAF guesswork about when it is safe.
describe("Canvas create and rename (RC4)", () => {
	beforeEach(() => {
		vi.useFakeTimers({
			toFake: ["requestAnimationFrame", "cancelAnimationFrame", "performance"],
		});
	});

	function renameInput(container: HTMLElement): HTMLElement | null {
		return container.querySelector<HTMLElement>(
			'input[aria-label="Rename node"]',
		);
	}

	it("opens the inline rename input on the requested card", () => {
		const container = renderCanvas();

		act(() => {
			requestNodeFocus(FAR_ID, { align: "center", rename: true });
		});
		expect(renameInput(container), "not inside the requesting tick").toBeNull();

		act(() => {
			vi.advanceTimersByTime(16 * 10);
		});

		const input = renameInput(container);
		expect(input).not.toBeNull();
		expect(
			input?.closest("[data-source-id]")?.getAttribute("data-source-id"),
		).toBe(FAR_ID);
	});

	it("leaves a plain reveal alone", () => {
		const container = renderCanvas();

		act(() => {
			requestNodeFocus(FAR_ID, { align: "nearest" });
			vi.advanceTimersByTime(16 * 10);
		});

		expect(renameInput(container)).toBeNull();
	});
});
