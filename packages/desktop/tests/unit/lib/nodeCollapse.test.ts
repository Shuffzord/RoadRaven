// @vitest-environment jsdom
// expandAncestors — the rAF-driven ancestor reveal used by header search.
// With no matching chevrons in the DOM, each path entry reports "no children"
// so the walk recurses to the end and fires onDone on the next frame. These
// tests cover that trailing-onDone contract and the cancellation guard added
// for the rapid-input race (MEDIUM-1 review finding).

import { afterEach, describe, expect, it, vi } from "vitest";
import { expandAncestors } from "../../../src/mainview/lib/nodeCollapse";

// Resolve after enough animation frames for a short walk to reach onDone.
function nextFrames(n: number): Promise<void> {
	return new Promise((resolve) => {
		let remaining = n;
		const tick = () => {
			remaining -= 1;
			if (remaining <= 0) resolve();
			else requestAnimationFrame(tick);
		};
		requestAnimationFrame(tick);
	});
}

afterEach(() => {
	document.body.replaceChildren();
});

describe("expandAncestors", () => {
	it("calls onDone exactly once after the walk completes", async () => {
		const onDone = vi.fn();
		expandAncestors(["x", "y"], onDone);
		await nextFrames(5);
		expect(onDone).toHaveBeenCalledTimes(1);
	});

	it("calls onDone for an empty path (nothing to expand)", async () => {
		const onDone = vi.fn();
		expandAncestors([], onDone);
		await nextFrames(3);
		expect(onDone).toHaveBeenCalledTimes(1);
	});

	it("does not call onDone after the returned canceller runs", async () => {
		const onDone = vi.fn();
		const cancel = expandAncestors(["x", "y"], onDone);
		cancel();
		await nextFrames(5);
		expect(onDone).not.toHaveBeenCalled();
	});
});
