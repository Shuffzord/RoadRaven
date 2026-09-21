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

// Canvas's default dimensions in jsdom (ResizeObserver never fires) are
// 800x600, so the comfort zone is x 200..600 / y 150..450.
const VIEW = { width: 800, height: 600 };
// Root sits at the layout origin; "Far" is outside the comfort zone at every
// zoom this file uses, so focusing it always triggers a programmatic pan.
const LAYOUT = [
	{ id: ROOT_ID, name: "Root", x: 0, y: 0 },
	{ id: FAR_ID, name: "Far", x: 1000, y: 1000 },
];

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
	resetStore();
	// jsdom implements neither of these and Canvas calls both on mount.
	vi.stubGlobal(
		"ResizeObserver",
		class {
			observe = vi.fn();
			unobserve = vi.fn();
			disconnect = vi.fn();
		},
	);
	act(() => {
		useRoadmapStore.getState().loadSchema(SCHEMA, "/test/viewport.json");
	});
});

afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
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

	it("reset view -> gesture -> reset view moves the camera the second time", () => {
		const container = renderCanvas();
		act(() => {
			useRoadmapStore.getState().resetView();
		});
		const afterFirstReset = { ...lastProps().translate };

		gesture(container, { x: -90, y: 239.5 }, 0.4595);
		const beforeSecondReset = { ...lastProps().translate };

		act(() => {
			useRoadmapStore.getState().resetView();
		});

		expect(beforeSecondReset).not.toEqual(afterFirstReset);
		expect(lastProps().translate).not.toEqual(beforeSecondReset);
		expect(lastProps().translate).toEqual(afterFirstReset);
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
			useRoadmapStore.getState().setFocusedNode(FAR_ID);
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
		// ...and only y needed correcting (1000*0.5 + 20 = 520, below the
		// comfort zone's 450 edge), so it lands 70px up with x untouched.
		expect(settled).toEqual({ x: 10, y: -50, k: 0.5 });
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

	it("never asks for a zoom outside the extent and pans with the clamped zoom", () => {
		vi.useFakeTimers({
			toFake: ["requestAnimationFrame", "cancelAnimationFrame", "performance"],
		});
		renderCanvas();
		act(() => {
			useRoadmapStore.getState().setFocusedNode(FAR_ID);
			vi.advanceTimersByTime(1000);
		});

		act(() => {
			useRoadmapStore.getState().fitView();
			vi.advanceTimersByTime(1000);
		});

		const settled = viewport();
		expect(settled.k).toBeLessThanOrEqual(SCALE_EXTENT.max);
		expect(settled.k).toBeGreaterThanOrEqual(SCALE_EXTENT.min);
		// The close-up translate must be computed with the zoom the tree will
		// actually render at, not with the unclamped request.
		expect(settled.x).toBeCloseTo(VIEW.width / 2 - 1000 * settled.k, 1);
		expect(settled.y).toBeCloseTo(VIEW.height / 2 - 1000 * settled.k, 1);
	});
});
