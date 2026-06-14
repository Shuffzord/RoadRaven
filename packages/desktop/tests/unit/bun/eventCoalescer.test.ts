// Phase 4 Wave 1 — real test implementations for Plan 04-02 Task 2.
// Sources: D-25 in 04-CONTEXT.md, §3 in 04-RESEARCH.md.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EventCoalescer } from "../../../src/bun/eventCoalescer";

describe("EventCoalescer", () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => vi.useRealTimers());

	it("batches events within 100ms window", () => {
		const flushes: number[] = [];
		const c = new EventCoalescer(100, (updates) =>
			flushes.push(updates.length),
		);
		c.enqueue({ nodeId: "a", status: "done", lastEventAt: 1 });
		c.enqueue({ nodeId: "b", status: "done", lastEventAt: 2 });
		vi.advanceTimersByTime(100);
		expect(flushes).toEqual([2]);
	});

	it("last-write-wins per nodeId", () => {
		let latest: { status: string } | null = null;
		const c = new EventCoalescer(100, (updates) => {
			latest = updates[0];
		});
		c.enqueue({ nodeId: "n1", status: "in-progress", lastEventAt: 1 });
		c.enqueue({ nodeId: "n1", status: "completed", lastEventAt: 2 });
		vi.advanceTimersByTime(100);
		expect(latest?.status).toBe("completed");
	});

	it("flushes exactly once per batch", () => {
		let flushCount = 0;
		const c = new EventCoalescer(100, () => {
			flushCount++;
		});
		c.enqueue({ nodeId: "a", status: "done", lastEventAt: 1 });
		c.enqueue({ nodeId: "b", status: "done", lastEventAt: 2 });
		c.enqueue({ nodeId: "a", status: "in-progress", lastEventAt: 3 });
		vi.advanceTimersByTime(100);
		expect(flushCount).toBe(1);
	});

	it("flushNow() drains pending and clears timer", () => {
		const flushed: string[] = [];
		const c = new EventCoalescer(100, (updates) => {
			for (const u of updates) flushed.push(u.nodeId);
		});
		c.enqueue({ nodeId: "x", status: "done", lastEventAt: 1 });
		// Timer armed but not fired yet
		vi.advanceTimersByTime(50);
		c.flushNow();
		// Should have flushed immediately, even though 100ms hasn't passed
		expect(flushed).toEqual(["x"]);
		// Timer should be cleared — advancing another 100ms should NOT produce a second flush
		vi.advanceTimersByTime(100);
		expect(flushed).toEqual(["x"]);
	});

	it("timer is null when idle (no pending events)", () => {
		const c = new EventCoalescer(100, () => {
			/* noop */
		});
		// Access private field via type assertion for verification
		const internal = c as unknown as {
			timer: ReturnType<typeof setTimeout> | null;
		};
		expect(internal.timer).toBeNull();
		c.enqueue({ nodeId: "y", status: "done", lastEventAt: 1 });
		expect(internal.timer).not.toBeNull();
		vi.advanceTimersByTime(100);
		// After flush, timer should be null again
		expect(internal.timer).toBeNull();
	});
});
