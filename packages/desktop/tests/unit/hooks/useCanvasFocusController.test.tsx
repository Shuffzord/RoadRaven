/** @vitest-environment jsdom */
import { act, render } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RoadmapSchema } from "../../../../../packages/core/src/schema";
import { resetStore } from "../../helpers/resetStore";

// v0.8.1 Phase 2 (RC2, RC3, RC5, RC11) — .planning/v0.8.1-canvas-focus-PLAN.md.
//
// The controller is the REVEAL half of a focus request: the store writes
// already happened in requestNodeFocus. Its job is to make the target card
// mounted (expand collapsed ancestors), wait for it, measure the real DOM
// rects and ask the canvas for one pan. jsdom has no layout, so every rect
// here is stubbed — the maths itself is covered directly in
// tests/unit/lib/viewportMath.test.ts.

const logged = vi.hoisted(() => ({ warn: vi.fn() }));

vi.mock("@logtape/logtape", () => ({
	getLogger: () => ({
		debug: vi.fn(),
		info: vi.fn(),
		warn: logged.warn,
		error: vi.fn(),
		fatal: vi.fn(),
	}),
}));

import { useCanvasFocusController } from "../../../src/mainview/hooks/useCanvasFocusController";
import { requestNodeFocus } from "../../../src/mainview/lib/focusRequest";
import { useRoadmapStore } from "../../../src/mainview/store/roadmapStore";

const ROOT_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const CHILD_ID = "11111111-2222-4333-8444-555555555555";
const SIBLING_ID = "22222222-3333-4444-8555-666666666666";
const GRANDCHILD_ID = "33333333-4444-4555-8666-777777777777";

const SCHEMA: RoadmapSchema = {
	version: "1.0",
	title: "Focus controller fixture",
	nodes: [
		{
			id: ROOT_ID,
			title: "Root",
			status: "not-started",
			children: [
				{
					id: CHILD_ID,
					title: "Child",
					status: "not-started",
					children: [
						{ id: GRANDCHILD_ID, title: "Grandchild", status: "not-started" },
					],
				},
				{ id: SIBLING_ID, title: "Sibling", status: "not-started" },
			],
		},
	],
};

function rect(
	left: number,
	top: number,
	right: number,
	bottom: number,
): DOMRect {
	return {
		left,
		top,
		right,
		bottom,
		x: left,
		y: top,
		width: right - left,
		height: bottom - top,
		toJSON: () => ({}),
	} as DOMRect;
}

/** 800x600 at the origin: comfort zone x 200..600, y 150..450. */
let containerRect = rect(0, 0, 800, 600);
/** Centre (700, 300): 100px right of the comfort zone, 300px right of centre. */
const OUTSIDE = rect(650, 290, 750, 310);

/**
 * The canvas container, created before the hook mounts so cards can live
 * INSIDE it as they do in the app. The controller's DOM-focus guard asks
 * whether `document.activeElement` is inside the canvas, so a card parked
 * next to the container instead of in it would make that guard meaningless.
 */
let canvasEl: HTMLDivElement;

function mountCard(nodeId: string, box: DOMRect): HTMLElement {
	const card = document.createElement("div");
	card.dataset.sourceId = nodeId;
	card.tabIndex = -1;
	card.getBoundingClientRect = () => box;
	canvasEl.appendChild(card);
	return card;
}

/** A card whose chevron reads "Expand subtree" until it is clicked. */
function mountCollapsedCard(nodeId: string, onExpand: () => void): void {
	const card = mountCard(nodeId, rect(0, 0, 10, 10));
	const chevron = document.createElement("button");
	chevron.type = "button";
	chevron.setAttribute("aria-label", "Expand subtree");
	chevron.addEventListener("click", () => {
		expansions.push(nodeId);
		chevron.setAttribute("aria-label", "Collapse subtree");
		onExpand();
	});
	card.appendChild(chevron);
}

const expansions: string[] = [];
const panBy = vi.fn<(dx: number, dy: number) => void>();

function Harness(): React.ReactElement {
	const containerRef = useRef<HTMLElement | null>(canvasEl);
	useCanvasFocusController({ containerRef, panBy });
	return <></>;
}

function renderController(): void {
	render(<Harness />);
}

/** Run `n` animation frames. */
function frames(n: number): void {
	act(() => {
		vi.advanceTimersByTime(16 * n);
	});
}

beforeEach(() => {
	vi.useFakeTimers({
		toFake: ["requestAnimationFrame", "cancelAnimationFrame"],
	});
	containerRect = rect(0, 0, 800, 600);
	canvasEl = document.createElement("div");
	canvasEl.tabIndex = 0;
	canvasEl.getBoundingClientRect = () => containerRect;
	document.body.appendChild(canvasEl);
	expansions.length = 0;
	panBy.mockClear();
	logged.warn.mockClear();
	useRoadmapStore.getState().loadSchema(SCHEMA, "/tmp/controller.json");
});

afterEach(() => {
	vi.useRealTimers();
	vi.restoreAllMocks();
	document.body.innerHTML = "";
	resetStore();
});

describe("useCanvasFocusController — reveal", () => {
	it("pans a mounted card in the same tick, with the delta from its rect", () => {
		mountCard(CHILD_ID, OUTSIDE);
		renderController();

		act(() => {
			requestNodeFocus(CHILD_ID, { align: "nearest" });
		});

		// No frame advanced: key-repeat navigation must not wait for rAF.
		expect(panBy).toHaveBeenCalledTimes(1);
		expect(panBy).toHaveBeenCalledWith(-100, 0);
	});

	it("does not pan a card that is already inside the comfort zone", () => {
		mountCard(CHILD_ID, rect(350, 290, 450, 310));
		renderController();

		act(() => {
			requestNodeFocus(CHILD_ID, { align: "nearest" });
		});
		frames(4);

		expect(panBy).not.toHaveBeenCalled();
	});

	it("waits for an unmounted card and pans once it appears", () => {
		renderController();

		act(() => {
			requestNodeFocus(CHILD_ID, { align: "nearest" });
		});
		frames(3);
		expect(panBy).not.toHaveBeenCalled();

		mountCard(CHILD_ID, OUTSIDE);
		frames(6);

		expect(panBy).toHaveBeenCalledTimes(1);
		expect(panBy).toHaveBeenCalledWith(-100, 0);
	});

	it("drops the request with one logged warning when the card never mounts", () => {
		renderController();

		act(() => {
			requestNodeFocus(CHILD_ID, { align: "nearest" });
		});
		frames(40);

		expect(panBy).not.toHaveBeenCalled();
		expect(logged.warn).toHaveBeenCalledTimes(1);
	});

	it("cancels a pending request when a newer one arrives", () => {
		mountCard(SIBLING_ID, OUTSIDE);
		renderController();

		act(() => {
			requestNodeFocus(CHILD_ID, { align: "nearest" });
		});
		act(() => {
			requestNodeFocus(SIBLING_ID, { align: "nearest" });
		});
		expect(panBy).toHaveBeenCalledTimes(1);

		// The superseded request's node mounts late — it must stay superseded.
		mountCard(CHILD_ID, rect(0, 0, 10, 10));
		frames(40);

		expect(panBy).toHaveBeenCalledTimes(1);
		expect(logged.warn).not.toHaveBeenCalled();
	});

	it("expands collapsed ancestors top-down before it measures a jump-to", () => {
		mountCollapsedCard(ROOT_ID, () => {
			mountCollapsedCard(CHILD_ID, () => {
				mountCard(GRANDCHILD_ID, OUTSIDE);
			});
		});
		renderController();

		act(() => {
			requestNodeFocus(GRANDCHILD_ID, { align: "center" });
		});
		expect(panBy).not.toHaveBeenCalled();
		frames(8);

		expect(expansions).toEqual([ROOT_ID, CHILD_ID]);
		expect(panBy).toHaveBeenCalledTimes(1);
		expect(panBy).toHaveBeenCalledWith(-300, 0);
	});

	// The camera never restructures the tree behind the user's back: whether a
	// child-direction key should expand a collapsed node is `enterChild`'s
	// decision (A6, Phase 4), and RC6 stays reproducible until then.
	it("does not expand anything for an arrow-key reveal", () => {
		mountCollapsedCard(ROOT_ID, () => {
			mountCollapsedCard(CHILD_ID, () => {
				mountCard(GRANDCHILD_ID, OUTSIDE);
			});
		});
		renderController();

		act(() => {
			requestNodeFocus(GRANDCHILD_ID, { align: "nearest" });
		});
		frames(40);

		expect(expansions).toEqual([]);
		expect(panBy).not.toHaveBeenCalled();
		expect(logged.warn).toHaveBeenCalledTimes(1);
	});

	it("never pans from remembered coordinates once the card has left the DOM (RC5)", () => {
		const card = mountCard(CHILD_ID, OUTSIDE);
		renderController();
		act(() => {
			requestNodeFocus(CHILD_ID, { align: "nearest" });
		});
		expect(panBy).toHaveBeenCalledTimes(1);
		panBy.mockClear();

		// Collapsing an ancestor (or deleting the node) unmounts the card.
		card.remove();
		act(() => {
			requestNodeFocus(CHILD_ID, { align: "nearest" });
		});
		frames(40);

		expect(panBy).not.toHaveBeenCalled();
	});
});

describe("useCanvasFocusController — select requests (RC3)", () => {
	it("pans a center request although a different node holds canvas focus", () => {
		mountCard(CHILD_ID, OUTSIDE);
		renderController();
		act(() => {
			useRoadmapStore.getState().setFocusedNode(SIBLING_ID);
		});

		act(() => {
			requestNodeFocus(CHILD_ID, { align: "center", select: true });
		});
		frames(6);

		expect(panBy).toHaveBeenCalledTimes(1);
		expect(panBy).toHaveBeenCalledWith(-300, 0);
	});

	it("pans once, after the SidePanel has finished shrinking the canvas", () => {
		mountCard(CHILD_ID, OUTSIDE);
		renderController();

		act(() => {
			requestNodeFocus(CHILD_ID, { align: "center", select: true });
		});
		frames(1);
		// Selecting opened the SidePanel: the canvas is now 600px wide.
		containerRect = rect(0, 0, 600, 600);
		frames(6);

		expect(panBy).toHaveBeenCalledTimes(1);
		// Measured against the SHRUNK container (centre 300), not the old one.
		expect(panBy).toHaveBeenCalledWith(-400, 0);
	});
});

describe("useCanvasFocusController — re-reveal after a re-layout (A7)", () => {
	it("re-reveals the focused node when dataKey changes", () => {
		mountCard(CHILD_ID, OUTSIDE);
		renderController();
		act(() => {
			useRoadmapStore.getState().setFocusedNode(CHILD_ID);
		});
		expect(panBy).not.toHaveBeenCalled();

		act(() => {
			useRoadmapStore.getState().addChild(ROOT_ID);
		});
		frames(6);

		expect(panBy).toHaveBeenCalledTimes(1);
		expect(panBy).toHaveBeenCalledWith(-100, 0);
	});

	it("re-reveals the focused node when the layout orientation flips", () => {
		mountCard(CHILD_ID, OUTSIDE);
		renderController();
		act(() => {
			useRoadmapStore.getState().setFocusedNode(CHILD_ID);
		});

		act(() => {
			useRoadmapStore.getState().setLayout("LR");
		});
		frames(6);

		expect(panBy).toHaveBeenCalledTimes(1);
		expect(panBy).toHaveBeenCalledWith(-100, 0);
	});

	it("does nothing on a re-layout when no node is focused", () => {
		mountCard(CHILD_ID, OUTSIDE);
		renderController();

		act(() => {
			useRoadmapStore.getState().setLayout("LR");
			useRoadmapStore.getState().addChild(ROOT_ID);
		});
		frames(6);

		expect(panBy).not.toHaveBeenCalled();
		expect(logged.warn).not.toHaveBeenCalled();
	});
});

// v0.8.1 Phase 3 (RC8) — DOM focus follows logical focus, and never steals it.
//
// The reveal already knows which card it just made visible, so it is also the
// one place that can hand that card real DOM focus. The rule is a single
// guard: move focus only when it is currently nowhere (`<body>`, the state a
// rename commit leaves behind) or already inside the canvas. Anywhere else —
// the header search box while matches are followed, a SidePanel field after a
// blur-commit, the event-log drawer, an open Radix menu — is a place the user
// put it on purpose.
describe("useCanvasFocusController — DOM focus (RC8)", () => {
	/** An input outside the canvas, as the SidePanel and header search are. */
	function mountOutsideInput(): HTMLInputElement {
		const input = document.createElement("input");
		document.body.appendChild(input);
		return input;
	}

	it("focuses the revealed card, without scrolling the container", () => {
		const card = mountCard(CHILD_ID, OUTSIDE);
		const focus = vi.spyOn(card, "focus");
		renderController();

		act(() => {
			requestNodeFocus(CHILD_ID, { align: "nearest" });
		});

		// Same tick, like the pan: key-repeat navigation must not wait for rAF.
		expect(focus).toHaveBeenCalledWith({ preventScroll: true });
		expect(document.activeElement).toBe(card);
	});

	it("focuses the card even when no pan is needed", () => {
		const card = mountCard(CHILD_ID, rect(350, 290, 450, 310));
		renderController();

		act(() => {
			requestNodeFocus(CHILD_ID, { align: "nearest" });
		});

		expect(panBy).not.toHaveBeenCalled();
		expect(document.activeElement).toBe(card);
	});

	it("takes focus from <body> — the state a rename commit leaves behind", () => {
		const card = mountCard(CHILD_ID, OUTSIDE);
		renderController();
		document.body.focus();

		act(() => {
			requestNodeFocus(CHILD_ID, { align: "nearest" });
		});

		expect(document.activeElement).toBe(card);
	});

	it("moves focus that is already inside the canvas", () => {
		const other = mountCard(SIBLING_ID, OUTSIDE);
		const card = mountCard(CHILD_ID, OUTSIDE);
		renderController();
		other.focus();

		act(() => {
			requestNodeFocus(CHILD_ID, { align: "nearest" });
		});

		expect(document.activeElement).toBe(card);
	});

	it("leaves focus alone when it sits in a control outside the canvas", () => {
		mountCard(CHILD_ID, OUTSIDE);
		renderController();
		const input = mountOutsideInput();
		input.focus();

		act(() => {
			requestNodeFocus(CHILD_ID, { align: "center", select: true });
		});
		frames(6);

		// The camera still follows — only the focus is left where the user put it.
		expect(panBy).toHaveBeenCalledTimes(1);
		expect(document.activeElement).toBe(input);
	});

	// A8 and the reason the plan's "<body> or inside the canvas" rule is not
	// enough on its own: a blur-commit runs while the browser has already
	// reset activeElement to <body> but has not yet given the clicked field
	// focusin, and React flushes the A7 re-reveal from inside that focusout.
	it("does not race the field a blur-commit is handing focus to", () => {
		const card = mountCard(CHILD_ID, OUTSIDE);
		renderController();
		const input = mountOutsideInput();

		act(() => {
			canvasEl.dispatchEvent(
				new FocusEvent("focusout", {
					bubbles: true,
					relatedTarget: input,
				}),
			);
			requestNodeFocus(CHILD_ID, { align: "nearest" });
		});

		expect(document.activeElement).not.toBe(card);
		// The camera still followed; only the focus was left alone.
		expect(panBy).toHaveBeenCalledTimes(1);
	});

	// A card that simply disappeared (rename commit, delete) leaves no
	// relatedTarget behind — that focus really is nowhere and is ours to take.
	it("takes focus after a focusout that goes nowhere", () => {
		const card = mountCard(CHILD_ID, OUTSIDE);
		renderController();

		act(() => {
			canvasEl.dispatchEvent(
				new FocusEvent("focusout", { bubbles: true, relatedTarget: null }),
			);
			requestNodeFocus(CHILD_ID, { align: "nearest" });
		});

		expect(document.activeElement).toBe(card);
	});

	it("focuses a card that mounts late, on the polled path", () => {
		renderController();

		act(() => {
			requestNodeFocus(CHILD_ID, { align: "nearest" });
		});
		frames(3);
		const card = mountCard(CHILD_ID, OUTSIDE);
		frames(6);

		expect(document.activeElement).toBe(card);
	});

	it("focuses the re-revealed card after a re-layout (A7)", () => {
		const card = mountCard(CHILD_ID, OUTSIDE);
		renderController();
		act(() => {
			useRoadmapStore.getState().setFocusedNode(CHILD_ID);
		});
		expect(document.activeElement).not.toBe(card);

		act(() => {
			useRoadmapStore.getState().addChild(ROOT_ID);
		});
		frames(6);

		expect(document.activeElement).toBe(card);
	});

	// The real card answers a keyboard-originated focus with a `nearest`
	// request of its own, and `focus()` dispatches focusin synchronously — so
	// the reveal must not re-enter itself and pan twice off one key press.
	it("does not re-enter its own reveal when the card answers the focus", () => {
		const card = mountCard(CHILD_ID, OUTSIDE);
		card.addEventListener("focus", () => {
			requestNodeFocus(CHILD_ID, { align: "nearest" });
		});
		renderController();

		act(() => {
			requestNodeFocus(CHILD_ID, { align: "nearest" });
		});
		frames(6);

		expect(document.activeElement).toBe(card);
		expect(panBy).toHaveBeenCalledTimes(1);
		expect(panBy).toHaveBeenCalledWith(-100, 0);
	});

	it("never focuses the card of a superseded request", () => {
		mountCard(SIBLING_ID, OUTSIDE);
		renderController();

		act(() => {
			requestNodeFocus(CHILD_ID, { align: "nearest" });
		});
		act(() => {
			requestNodeFocus(SIBLING_ID, { align: "nearest" });
		});
		const late = mountCard(CHILD_ID, rect(0, 0, 10, 10));
		const lateFocus = vi.spyOn(late, "focus");
		frames(40);

		expect(lateFocus).not.toHaveBeenCalled();
	});
});
