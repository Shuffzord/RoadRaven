/** @vitest-environment jsdom */
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCanvasViewport } from "../../../src/mainview/hooks/useCanvasViewport";
import { useRoadmapStore } from "../../../src/mainview/store/roadmapStore";
import { resetStore } from "../../helpers/resetStore";

// v0.8.1 Phase 1 (RC1) — .planning/v0.8.1-canvas-focus-PLAN.md.
//
// The hook's contract, exercised without Canvas: a d3 gesture is mirrored
// locally and published to the store as ONE translate+zoom write once the
// gesture settles, react-d3-tree's own echo is ignored, and any viewport
// command wins over a gesture that has not been published yet.

// The trailing delay is an implementation detail (120 ms today); these bounds
// bracket it instead of importing it. BEFORE is shorter than any sane delay,
// AFTER is longer — and BEFORE + (AFTER - BEFORE) stays below BEFORE + delay,
// which is what makes the "an echo does not restart the timer" case decisive.
const BEFORE_SYNC_MS = 100;
const AFTER_SYNC_MS = 200;

// resetStore()'s defaults — the value an "echo" payload carries.
const INITIAL = { x: 400, y: 50, k: 0.8 };
const GESTURE = { x: -90, y: 239.5, k: 0.4595 };

function viewport(): { x: number; y: number; k: number } {
	const s = useRoadmapStore.getState();
	return { x: s.translate.x, y: s.translate.y, k: s.zoomLevel };
}

/** Count store writes, so "one write" and "no write" are assertable. */
function countWrites(): { get: () => number; stop: () => void } {
	let writes = 0;
	const stop = useRoadmapStore.subscribe(() => {
		writes++;
	});
	return { get: () => writes, stop };
}

function advance(ms: number): void {
	act(() => {
		vi.advanceTimersByTime(ms);
	});
}

beforeEach(() => {
	resetStore();
	vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
});

afterEach(() => {
	vi.useRealTimers();
	resetStore();
});

describe("useCanvasViewport — publishing a gesture", () => {
	it("publishes translate and zoom as one write after the sync delay, not before", () => {
		const { result } = renderHook(() => useCanvasViewport());
		const writes = countWrites();

		act(() => {
			result.current.syncGesture({ x: GESTURE.x, y: GESTURE.y }, GESTURE.k);
		});
		advance(BEFORE_SYNC_MS);
		expect(viewport(), "nothing may be published mid-gesture").toEqual(INITIAL);
		expect(writes.get()).toBe(0);

		advance(AFTER_SYNC_MS - BEFORE_SYNC_MS);

		expect(viewport()).toEqual(GESTURE);
		expect(writes.get(), "translate and zoom land in a single write").toBe(1);
		writes.stop();
	});

	it("restarts the delay on each gesture frame and publishes only the last value", () => {
		const { result } = renderHook(() => useCanvasViewport());
		const writes = countWrites();

		act(() => {
			result.current.syncGesture({ x: 10, y: 20 }, 0.5);
		});
		advance(BEFORE_SYNC_MS);
		act(() => {
			result.current.syncGesture({ x: GESTURE.x, y: GESTURE.y }, GESTURE.k);
		});
		advance(BEFORE_SYNC_MS);
		expect(viewport(), "the second frame restarted the delay").toEqual(INITIAL);

		advance(AFTER_SYNC_MS);

		expect(viewport()).toEqual(GESTURE);
		expect(writes.get(), "intermediate frames are never published").toBe(1);
		writes.stop();
	});

	it("ignores the componentDidUpdate echo: no restart, no overwrite", () => {
		const { result } = renderHook(() => useCanvasViewport());

		act(() => {
			result.current.syncGesture({ x: GESTURE.x, y: GESTURE.y }, GESTURE.k);
		});
		advance(BEFORE_SYNC_MS);
		// react-d3-tree hands back the props it was rendered with — which are
		// still the store's values, because the gesture has not been published.
		act(() => {
			result.current.syncGesture({ x: INITIAL.x, y: INITIAL.y }, INITIAL.k);
		});

		expect(
			result.current.getTransform(),
			"the echo must not overwrite the live gesture value",
		).toEqual(GESTURE);

		advance(AFTER_SYNC_MS - BEFORE_SYNC_MS);

		expect(
			viewport(),
			"the echo must not have restarted the delay either",
		).toEqual(GESTURE);
	});
});

describe("useCanvasViewport — getTransform", () => {
	it("returns the store's transform when no gesture is in flight", () => {
		const { result } = renderHook(() => useCanvasViewport());

		expect(result.current.getTransform()).toEqual(INITIAL);
	});

	it("returns the in-flight gesture value instead of the stale store", () => {
		const { result } = renderHook(() => useCanvasViewport());

		act(() => {
			result.current.syncGesture({ x: GESTURE.x, y: GESTURE.y }, GESTURE.k);
		});

		expect(result.current.getTransform()).toEqual(GESTURE);
		expect(viewport(), "the store is deliberately still behind").toEqual(
			INITIAL,
		);
	});

	it("follows the store again once the gesture has been published", () => {
		const { result } = renderHook(() => useCanvasViewport());
		act(() => {
			result.current.syncGesture({ x: GESTURE.x, y: GESTURE.y }, GESTURE.k);
		});
		advance(AFTER_SYNC_MS);

		act(() => {
			useRoadmapStore.getState().setTranslate({ x: 7, y: 8 });
		});

		expect(result.current.getTransform()).toEqual({ x: 7, y: 8, k: GESTURE.k });
	});
});

describe("useCanvasViewport — flushViewport", () => {
	it("publishes immediately and cancels the pending delay", () => {
		const { result } = renderHook(() => useCanvasViewport());
		const writes = countWrites();

		act(() => {
			result.current.syncGesture({ x: GESTURE.x, y: GESTURE.y }, GESTURE.k);
			result.current.flushViewport();
		});

		expect(viewport()).toEqual(GESTURE);
		expect(writes.get()).toBe(1);

		advance(AFTER_SYNC_MS);

		expect(writes.get(), "the cancelled timer must not fire as well").toBe(1);
		writes.stop();
	});

	it("is a no-op when no gesture is pending", () => {
		const { result } = renderHook(() => useCanvasViewport());
		const writes = countWrites();

		act(() => {
			result.current.flushViewport();
		});
		advance(AFTER_SYNC_MS);

		expect(viewport()).toEqual(INITIAL);
		expect(writes.get()).toBe(0);
		writes.stop();
	});
});

describe("useCanvasViewport — a command beats a pending gesture", () => {
	// Without this, a trailing write landing after the command would silently
	// undo it (reset view, MCP camera, or a pan animation frame).
	const commands: [string, () => void][] = [
		// `setViewport` is what a fit or an MCP camera command lands through
		// (Phase 5 removed `resetView`, the old fixed-camera stand-in here).
		[
			"setViewport",
			() => useRoadmapStore.getState().setViewport({ x: 5, y: 6 }, 0.9),
		],
		[
			"setTranslate",
			() => useRoadmapStore.getState().setTranslate({ x: 7, y: 8 }),
		],
		["setZoomLevel", () => useRoadmapStore.getState().setZoomLevel(0.3)],
	];

	for (const [name, command] of commands) {
		it(`${name} drops the pending gesture`, () => {
			const { result } = renderHook(() => useCanvasViewport());
			act(() => {
				result.current.syncGesture({ x: GESTURE.x, y: GESTURE.y }, GESTURE.k);
			});

			act(command);
			const afterCommand = viewport();
			advance(AFTER_SYNC_MS);

			expect(viewport(), "the gesture must not be replayed").toEqual(
				afterCommand,
			);
			expect(result.current.getTransform()).toEqual(afterCommand);
		});
	}
});

describe("useCanvasViewport — teardown", () => {
	it("clears the pending timer on unmount", () => {
		const { result, unmount } = renderHook(() => useCanvasViewport());
		act(() => {
			result.current.syncGesture({ x: GESTURE.x, y: GESTURE.y }, GESTURE.k);
		});
		const writes = countWrites();

		unmount();
		advance(AFTER_SYNC_MS);

		expect(viewport()).toEqual(INITIAL);
		expect(writes.get(), "no store write may happen after unmount").toBe(0);
		writes.stop();
	});
});
