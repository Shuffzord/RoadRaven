/** @vitest-environment jsdom */
// v0.8.4 Phase 3 — the card drag gesture (custom layout). A press that
// never travels 4px is a click; a real drag writes the store exactly once,
// on pointer-up, with the screen delta divided by the zoom, and swallows the
// click the browser fires after it.
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useNodeDrag } from "../../../src/mainview/hooks/useNodeDrag";
import {
	linkClassFor,
	linkFromClassFor,
	NODE_CARD_ATTR,
	NODE_DRAGGING_ATTR,
	NODE_OFFSET_ATTR,
} from "../../../src/mainview/lib/domContract";
import { stepPath } from "../../../src/mainview/lib/linkPath";
import { useFileViewStore } from "../../../src/mainview/store/fileViewStore";
import { useRoadmapStore } from "../../../src/mainview/store/roadmapStore";

const NODE = "n1";
const PARENT_LINK = stepPath({ x: 0, y: 0 }, { x: 100, y: 100 }, "TB");
const CHILD_LINK = stepPath({ x: 100, y: 100 }, { x: 100, y: 200 }, "TB");

const setNodeOffset = vi.fn();
let zoom = 1;
let clicks = 0;

function Harness() {
	const { drag, consumeDragClick } = useNodeDrag(() => zoom);
	return (
		<svg>
			<title>drag harness</title>
			<path className={linkClassFor(NODE)} d={PARENT_LINK} />
			<path className={linkFromClassFor(NODE)} d={CHILD_LINK} />
			<foreignObject {...{ [NODE_OFFSET_ATTR]: NODE }} x={-120} y={-50}>
				<div
					data-testid="card"
					{...{ [NODE_CARD_ATTR]: NODE }}
					// Same role as the real card (RoadmapNode.tsx).
					role="treeitem"
					aria-selected={false}
					tabIndex={-1}
					onKeyDown={() => {
						// Keyboard selection is not under test here.
					}}
					onPointerDown={drag.onPointerDown}
					onPointerMove={drag.onPointerMove}
					onPointerUp={drag.onPointerUp}
					onPointerCancel={drag.onPointerCancel}
					onClick={() => {
						if (consumeDragClick()) return;
						clicks++;
					}}
				>
					<button type="button" data-testid="chevron">
						v
					</button>
				</div>
			</foreignObject>
		</svg>
	);
}

/** The card's foreignObject position (Canvas folds the offset into x/y). */
function placement(card: HTMLElement): string {
	const fo = card.closest(`[${NODE_OFFSET_ATTR}]`);
	return `${fo?.getAttribute("x")},${fo?.getAttribute("y")}`;
}

function setup(): HTMLElement {
	render(<Harness />);
	const card = screen.getByTestId("card");
	// jsdom has no pointer capture.
	card.setPointerCapture = vi.fn();
	card.releasePointerCapture = vi.fn();
	return card;
}

function press(el: HTMLElement, x: number, y: number): void {
	fireEvent.pointerDown(el, {
		button: 0,
		pointerId: 1,
		clientX: x,
		clientY: y,
	});
}
function move(el: HTMLElement, x: number, y: number): void {
	fireEvent.pointerMove(el, { pointerId: 1, clientX: x, clientY: y });
}
function release(el: HTMLElement, x: number, y: number): void {
	fireEvent.pointerUp(el, { pointerId: 1, clientX: x, clientY: y });
}

beforeEach(() => {
	zoom = 1;
	clicks = 0;
	setNodeOffset.mockReset();
	useRoadmapStore.setState({ layoutOrientation: "TB" });
	useFileViewStore.setState({
		customLayout: true,
		nodeOffsets: { TB: {}, LR: {} },
		setNodeOffset,
	});
});

afterEach(cleanup);

describe("useNodeDrag", () => {
	it("a press+release under 4px does not write the store and does not suppress the click", () => {
		const card = setup();
		press(card, 100, 100);
		move(card, 102, 101);
		release(card, 102, 101);
		fireEvent.click(card);

		expect(setNodeOffset).not.toHaveBeenCalled();
		expect(clicks).toBe(1);
		expect(placement(card)).toBe("-120,-50");
	});

	it("a press+move 30px+release writes once with the delta divided by k and suppresses the next click only", () => {
		zoom = 2;
		const card = setup();
		press(card, 100, 100);
		move(card, 115, 100);
		move(card, 130, 90);
		release(card, 130, 90);
		fireEvent.click(card);

		expect(setNodeOffset).toHaveBeenCalledTimes(1);
		expect(setNodeOffset).toHaveBeenCalledWith("TB", NODE, { dx: 15, dy: -5 });
		expect(clicks).toBe(0);

		// The suppression is one-shot: the next plain click selects again.
		fireEvent.click(card);
		expect(clicks).toBe(1);
	});

	it("adds the delta to the node's existing offset in the current orientation", () => {
		useRoadmapStore.setState({ layoutOrientation: "LR" });
		useFileViewStore.setState({
			nodeOffsets: {
				TB: { [NODE]: { dx: 99, dy: 99 } },
				LR: { [NODE]: { dx: 10, dy: 20 } },
			},
		});
		const card = setup();
		press(card, 0, 0);
		move(card, 40, 0);
		release(card, 40, 0);

		expect(setNodeOffset).toHaveBeenCalledWith("LR", NODE, { dx: 50, dy: 20 });
	});

	it("moves the card's foreignObject and both connectors on the DOM during the drag, and marks the card", async () => {
		const card = setup();
		press(card, 100, 100);
		move(card, 130, 160);
		await new Promise((r) => requestAnimationFrame(() => r(null)));

		expect(placement(card)).toBe("-90,10");
		expect(card.getAttribute(NODE_DRAGGING_ATTR)).toBe("true");
		const [parentLink] = Array.from(
			document.getElementsByClassName(linkClassFor(NODE)),
		);
		const [childLink] = Array.from(
			document.getElementsByClassName(linkFromClassFor(NODE)),
		);
		expect(parentLink.getAttribute("d")).toBe(
			stepPath({ x: 0, y: 0 }, { x: 130, y: 160 }, "TB"),
		);
		expect(childLink.getAttribute("d")).toBe(
			stepPath({ x: 130, y: 160 }, { x: 100, y: 200 }, "TB"),
		);
		// Nothing reaches the store until the pointer comes up.
		expect(setNodeOffset).not.toHaveBeenCalled();

		release(card, 130, 160);
		expect(card.getAttribute(NODE_DRAGGING_ATTR)).toBeNull();
		expect(setNodeOffset).toHaveBeenCalledTimes(1);
	});

	it("pointercancel restores the DOM and writes nothing", async () => {
		const card = setup();
		press(card, 100, 100);
		move(card, 150, 100);
		await new Promise((r) => requestAnimationFrame(() => r(null)));
		fireEvent.pointerCancel(card, { pointerId: 1 });

		expect(setNodeOffset).not.toHaveBeenCalled();
		expect(placement(card)).toBe("-120,-50");
		expect(
			document.getElementsByClassName(linkClassFor(NODE))[0].getAttribute("d"),
		).toBe(PARENT_LINK);
	});

	it("ignores a press that starts on a control inside the card", () => {
		const card = setup();
		const chevron = screen.getByTestId("chevron");
		press(chevron, 100, 100);
		move(card, 150, 100);
		release(card, 150, 100);

		expect(setNodeOffset).not.toHaveBeenCalled();
	});

	it("ignores a non-primary button", () => {
		const card = setup();
		fireEvent.pointerDown(card, {
			button: 2,
			pointerId: 1,
			clientX: 0,
			clientY: 0,
		});
		move(card, 50, 0);
		release(card, 50, 0);

		expect(setNodeOffset).not.toHaveBeenCalled();
	});

	it("returns the same drag object across renders (card memo stays intact)", () => {
		const seen: unknown[] = [];
		function Probe() {
			seen.push(useNodeDrag(() => 1).drag);
			return null;
		}
		const { rerender } = render(<Probe />);
		rerender(<Probe />);
		expect(seen[0]).toBe(seen[1]);
	});
});
