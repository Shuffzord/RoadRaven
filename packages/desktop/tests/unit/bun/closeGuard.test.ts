// v0.8.2 A1 — will-close guard (bun/closeGuard.ts).
//
// The devkit emits will-close synchronously and reads the response right
// after emit (sdks/main/proc/native.ts:2634-2645), so the guard answers
// { allow: false } first, asks the renderer, and closes programmatically on
// approval. These tests drive that state machine with fake timers.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	CONFIRM_CLOSE_TIMEOUT_MS,
	createCloseGuard,
} from "../../../src/bun/closeGuard";
import type { WillCloseEvent } from "../../../src/bun/platform/window";

function makeEvent(): WillCloseEvent & { response: { allow: boolean } } {
	return { response: { allow: true } };
}

function deferred<T>() {
	let resolve!: (value: T) => void;
	let reject!: (err: unknown) => void;
	const promise = new Promise<T>((res, rej) => {
		resolve = res;
		reject = rej;
	});
	return { promise, resolve, reject };
}

describe("createCloseGuard", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});
	afterEach(() => {
		vi.useRealTimers();
	});

	it("denies the first will-close, then closes programmatically when the renderer allows", async () => {
		const answer = deferred<{ allow: boolean }>();
		const closeWindow = vi.fn();
		const guard = createCloseGuard({
			confirmClose: () => answer.promise,
			closeWindow,
		});

		const first = makeEvent();
		guard(first);
		expect(first.response).toEqual({ allow: false });
		expect(closeWindow).not.toHaveBeenCalled();

		answer.resolve({ allow: true });
		await vi.advanceTimersByTimeAsync(0);
		expect(closeWindow).toHaveBeenCalledTimes(1);

		// A platform that routes close() back through will-close sees the flag.
		const second = makeEvent();
		guard(second);
		expect(second.response).toEqual({ allow: true });
	});

	it("keeps the window open when the renderer denies, and asks again on the next will-close", async () => {
		const confirmClose = vi.fn(async () => ({ allow: false }));
		const closeWindow = vi.fn();
		const guard = createCloseGuard({ confirmClose, closeWindow });

		const first = makeEvent();
		guard(first);
		await vi.advanceTimersByTimeAsync(0);
		expect(first.response).toEqual({ allow: false });
		expect(closeWindow).not.toHaveBeenCalled();

		const second = makeEvent();
		guard(second);
		expect(second.response).toEqual({ allow: false });
		expect(confirmClose).toHaveBeenCalledTimes(2);
	});

	it("treats a silent renderer as allow after the timeout", async () => {
		const closeWindow = vi.fn();
		const guard = createCloseGuard({
			confirmClose: () =>
				new Promise(() => {
					/* never settles */
				}),
			closeWindow,
		});

		guard(makeEvent());
		await vi.advanceTimersByTimeAsync(CONFIRM_CLOSE_TIMEOUT_MS - 1);
		expect(closeWindow).not.toHaveBeenCalled();
		await vi.advanceTimersByTimeAsync(1);
		expect(closeWindow).toHaveBeenCalledTimes(1);
	});

	it("treats a failing confirmClose request as allow", async () => {
		const closeWindow = vi.fn();
		const guard = createCloseGuard({
			confirmClose: () => Promise.reject(new Error("renderer gone")),
			closeWindow,
		});

		guard(makeEvent());
		await vi.advanceTimersByTimeAsync(0);
		expect(closeWindow).toHaveBeenCalledTimes(1);
	});

	it("does not ask the renderer twice while a confirm is in flight", () => {
		const confirmClose = vi.fn(
			() =>
				new Promise<{ allow: boolean }>(() => {
					/* never settles */
				}),
		);
		const guard = createCloseGuard({ confirmClose, closeWindow: vi.fn() });

		guard(makeEvent());
		const second = makeEvent();
		guard(second);
		expect(second.response).toEqual({ allow: false });
		expect(confirmClose).toHaveBeenCalledTimes(1);
	});
});
