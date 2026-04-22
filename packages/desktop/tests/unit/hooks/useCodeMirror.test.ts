/** @vitest-environment jsdom */
import { act, renderHook } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCodeMirror } from "../../../src/mainview/hooks/useCodeMirror";

const NODE_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";

function makeContainer(): HTMLDivElement {
	const div = document.createElement("div");
	document.body.appendChild(div);
	return div;
}

function renderCodeMirror(
	initialDoc: string,
	onPersist: (id: string, content: string) => void,
	debounceMs = 1000,
) {
	const container = makeContainer();
	const hook = renderHook(() => {
		const ref = useRef<HTMLDivElement>(container);
		return useCodeMirror({
			container: ref,
			nodeId: NODE_ID,
			initialDoc,
			onPersist,
			debounceMs,
		});
	});
	return { hook, container };
}

beforeEach(() => {
	vi.useFakeTimers();
});

afterEach(() => {
	vi.useRealTimers();
	document.body.innerHTML = "";
});

describe("useCodeMirror", () => {
	it('mounting hook with initialDoc="hello" creates an EditorView', () => {
		const onPersist = vi.fn();
		const { hook } = renderCodeMirror("hello", onPersist);
		expect(hook.result.current.current).not.toBeNull();
		expect(hook.result.current.current?.state.doc.toString()).toBe("hello");
	});

	it("simulating a doc change + advancing 999ms does NOT call onPersist", () => {
		const onPersist = vi.fn();
		const { hook } = renderCodeMirror("hello", onPersist);
		const view = hook.result.current.current;
		if (!view) throw new Error("view not mounted");
		act(() => {
			view.dispatch({
				changes: { from: 0, to: view.state.doc.length, insert: "changed" },
			});
		});
		act(() => {
			vi.advanceTimersByTime(999);
		});
		expect(onPersist).not.toHaveBeenCalled();
	});

	it("simulating a doc change + advancing 1000ms calls onPersist exactly once with new content", () => {
		const onPersist = vi.fn();
		const { hook } = renderCodeMirror("hello", onPersist);
		const view = hook.result.current.current;
		if (!view) throw new Error("view not mounted");
		act(() => {
			view.dispatch({
				changes: { from: 0, to: view.state.doc.length, insert: "changed" },
			});
		});
		act(() => {
			vi.advanceTimersByTime(1000);
		});
		expect(onPersist).toHaveBeenCalledTimes(1);
		expect(onPersist).toHaveBeenCalledWith(NODE_ID, "changed");
	});

	it("multiple rapid changes within 1s window result in exactly ONE onPersist call (debounce semantics)", () => {
		const onPersist = vi.fn();
		const { hook } = renderCodeMirror("", onPersist);
		const view = hook.result.current.current;
		if (!view) throw new Error("view not mounted");
		act(() => {
			view.dispatch({
				changes: { from: 0, to: view.state.doc.length, insert: "a" },
			});
		});
		act(() => {
			vi.advanceTimersByTime(500);
		});
		act(() => {
			view.dispatch({
				changes: { from: 0, to: view.state.doc.length, insert: "ab" },
			});
		});
		act(() => {
			vi.advanceTimersByTime(500);
		});
		act(() => {
			view.dispatch({
				changes: { from: 0, to: view.state.doc.length, insert: "abc" },
			});
		});
		act(() => {
			vi.advanceTimersByTime(1000);
		});
		expect(onPersist).toHaveBeenCalledTimes(1);
		expect(onPersist).toHaveBeenLastCalledWith(NODE_ID, "abc");
	});

	it("unmounting the hook destroys the EditorView and clears any pending debounce timer", () => {
		const onPersist = vi.fn();
		const { hook } = renderCodeMirror("hello", onPersist);
		const view = hook.result.current.current;
		if (!view) throw new Error("view not mounted");
		act(() => {
			view.dispatch({
				changes: { from: 0, to: view.state.doc.length, insert: "changed" },
			});
		});
		act(() => {
			vi.advanceTimersByTime(500);
		});
		hook.unmount();
		expect(hook.result.current.current).toBeNull();
		act(() => {
			vi.advanceTimersByTime(2000);
		});
		expect(onPersist).not.toHaveBeenCalled();
	});
});
