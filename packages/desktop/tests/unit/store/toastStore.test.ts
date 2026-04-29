// Phase 4 Plan 04-03 Task 5 — toastStore tests.
// Sources: D-22, D-23, D-24 in 04-CONTEXT.md, PLUG-06.

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	MAX_STACKED,
	THROTTLE_WINDOW_MS,
	useToastStore,
} from "../../../src/mainview/store/toastStore";

beforeEach(() => {
	useToastStore.setState({ toasts: [] });
	vi.useRealTimers();
});

describe("toastStore", () => {
	it("merges same-type same-source within 5s into a single toast with count (D-24)", () => {
		useToastStore
			.getState()
			.pushToast({ type: "malformed", source: "claude-code" });
		useToastStore
			.getState()
			.pushToast({ type: "malformed", source: "claude-code" });
		useToastStore
			.getState()
			.pushToast({ type: "malformed", source: "claude-code" });
		expect(useToastStore.getState().toasts).toHaveLength(1);
		expect(useToastStore.getState().toasts[0].count).toBe(3);
	});

	it("does not merge when > 5s apart", () => {
		vi.useFakeTimers();
		useToastStore
			.getState()
			.pushToast({ type: "malformed", source: "claude-code" });
		vi.advanceTimersByTime(THROTTLE_WINDOW_MS + 100);
		useToastStore
			.getState()
			.pushToast({ type: "malformed", source: "claude-code" });
		expect(useToastStore.getState().toasts).toHaveLength(2);
		vi.useRealTimers();
	});

	it("does not merge different types", () => {
		useToastStore.getState().pushToast({ type: "malformed", source: "s" });
		useToastStore.getState().pushToast({ type: "unknown_node", source: "s" });
		expect(useToastStore.getState().toasts).toHaveLength(2);
	});

	it("does not merge different sources", () => {
		useToastStore.getState().pushToast({ type: "malformed", source: "a" });
		useToastStore.getState().pushToast({ type: "malformed", source: "b" });
		expect(useToastStore.getState().toasts).toHaveLength(2);
	});

	it(`caps at ${MAX_STACKED} toasts, drops oldest`, () => {
		for (let i = 0; i < 5; i++) {
			// Different sources prevent merging
			useToastStore
				.getState()
				.pushToast({ type: "malformed", source: `src-${i}` });
		}
		expect(useToastStore.getState().toasts).toHaveLength(MAX_STACKED);
		// Oldest (src-0, src-1) dropped; newest 3 remain
		expect(useToastStore.getState().toasts[0].source).toBe("src-2");
		expect(useToastStore.getState().toasts[1].source).toBe("src-3");
		expect(useToastStore.getState().toasts[2].source).toBe("src-4");
	});

	it("dismissToast removes by id", () => {
		useToastStore
			.getState()
			.pushToast({ type: "disconnect", source: "prod-1" });
		const id = useToastStore.getState().toasts[0].id;
		useToastStore.getState().dismissToast(id);
		expect(useToastStore.getState().toasts).toHaveLength(0);
	});

	it("initial state has empty toasts array", () => {
		expect(useToastStore.getState().toasts).toHaveLength(0);
	});
});
