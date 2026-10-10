/** @vitest-environment jsdom */

import { undo } from "@codemirror/commands";
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

	it("unmounting with a pending debounce flushes the in-flight content before destroying the view", () => {
		// Regression: previously the cleanup canceled the timer without flushing,
		// silently dropping the user's last <debounceMs> of typing on node switch.
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
		expect(onPersist).toHaveBeenCalledTimes(1);
		expect(onPersist).toHaveBeenCalledWith(NODE_ID, "changed");
		expect(hook.result.current.current).toBeNull();
		// And no spurious second call once the cancelled timer would have fired.
		act(() => {
			vi.advanceTimersByTime(2000);
		});
		expect(onPersist).toHaveBeenCalledTimes(1);
	});

	it("unmounting with no pending debounce does NOT call onPersist", () => {
		const onPersist = vi.fn();
		const { hook } = renderCodeMirror("hello", onPersist);
		hook.unmount();
		expect(onPersist).not.toHaveBeenCalled();
	});
	it("external initialDoc change replaces the doc and a later local edit keeps it (no stale overwrite)", () => {
		const onPersist = vi.fn();
		const container = makeContainer();
		const hook = renderHook(
			({ doc }) => {
				const ref = useRef<HTMLDivElement>(container);
				return useCodeMirror({
					container: ref,
					nodeId: NODE_ID,
					initialDoc: doc,
					onPersist,
				});
			},
			{ initialProps: { doc: "hello" } },
		);
		// Agent appends via MCP → store → new notes prop.
		hook.rerender({ doc: "hello\n\nagent line" });
		const view = hook.result.current.current;
		if (!view) throw new Error("view not mounted");
		expect(view.state.doc.toString()).toBe("hello\n\nagent line");
		// The sync itself must not be persisted back.
		act(() => {
			vi.advanceTimersByTime(2000);
		});
		expect(onPersist).not.toHaveBeenCalled();
		act(() => {
			view.dispatch({ changes: { from: view.state.doc.length, insert: "!" } });
		});
		act(() => {
			vi.advanceTimersByTime(1000);
		});
		expect(onPersist).toHaveBeenCalledTimes(1);
		expect(onPersist.mock.calls[0][1]).toContain("agent line");
	});

	it("external initialDoc change while a local edit is pending keeps the user's edit", () => {
		const onPersist = vi.fn();
		const container = makeContainer();
		const hook = renderHook(
			({ doc }) => {
				const ref = useRef<HTMLDivElement>(container);
				return useCodeMirror({
					container: ref,
					nodeId: NODE_ID,
					initialDoc: doc,
					onPersist,
				});
			},
			{ initialProps: { doc: "hello" } },
		);
		const view = hook.result.current.current;
		if (!view) throw new Error("view not mounted");
		act(() => {
			view.dispatch({ changes: { from: 5, insert: " typed" } });
		});
		hook.rerender({ doc: "hello agent" });
		expect(view.state.doc.toString()).toBe("hello typed");
	});

	// Re-renderable hook whose initialDoc prop stands in for the store's notes.
	function renderWithDoc(doc: string, onPersist = vi.fn()) {
		const container = makeContainer();
		const hook = renderHook(
			({ doc }) => {
				const ref = useRef<HTMLDivElement>(container);
				return useCodeMirror({
					container: ref,
					nodeId: NODE_ID,
					initialDoc: doc,
					onPersist,
				});
			},
			{ initialProps: { doc } },
		);
		const view = hook.result.current.current;
		if (!view) throw new Error("view not mounted");
		return { hook, view, onPersist };
	}

	it("external append during a pending local edit is kept alongside the edit when the persist fires", () => {
		const { hook, view, onPersist } = renderWithDoc("hello");
		act(() => {
			view.dispatch({ changes: { from: 5, insert: " typed" } });
		});
		hook.rerender({ doc: "hello\n\n**UAT failed**" });
		act(() => {
			vi.advanceTimersByTime(1000);
		});
		expect(onPersist).toHaveBeenCalledTimes(1);
		expect(onPersist).toHaveBeenCalledWith(
			NODE_ID,
			"hello typed\n\n**UAT failed**",
		);
		expect(view.state.doc.toString()).toBe("hello typed\n\n**UAT failed**");
	});

	it("conflicting (non-append) external change during a pending edit keeps both texts", () => {
		const { hook, view, onPersist } = renderWithDoc("hello");
		act(() => {
			view.dispatch({ changes: { from: 5, insert: " typed" } });
		});
		hook.rerender({ doc: "rewritten by agent" });
		act(() => {
			vi.advanceTimersByTime(1000);
		});
		expect(onPersist).toHaveBeenCalledTimes(1);
		const saved: string = onPersist.mock.calls[0][1];
		expect(saved.startsWith("hello typed")).toBe(true);
		expect(saved.endsWith("rewritten by agent")).toBe(true);
		expect(view.state.doc.toString()).toBe(saved);
	});

	it("undo after an external sync does not remove the synced text", () => {
		const { hook, view } = renderWithDoc("hello");
		act(() => {
			view.dispatch({ changes: { from: 5, insert: " typed" } });
		});
		act(() => {
			vi.advanceTimersByTime(1000);
		});
		hook.rerender({ doc: "hello typed" });
		hook.rerender({ doc: "hello typed\n\nagent line" });
		expect(view.state.doc.toString()).toBe("hello typed\n\nagent line");
		act(() => {
			undo(view);
		});
		expect(view.state.doc.toString()).toContain("agent line");
	});

	it("switching nodes with a pending edit flushes it without the next node's notes", () => {
		const onPersist = vi.fn();
		const container = makeContainer();
		const hook = renderHook(
			({ id, doc }) => {
				const ref = useRef<HTMLDivElement>(container);
				return useCodeMirror({
					container: ref,
					nodeId: id,
					initialDoc: doc,
					onPersist,
				});
			},
			{ initialProps: { id: NODE_ID, doc: "hello" } },
		);
		const view = hook.result.current.current;
		if (!view) throw new Error("view not mounted");
		act(() => {
			view.dispatch({ changes: { from: 5, insert: " typed" } });
		});
		hook.rerender({ id: "other-node", doc: "other notes" });
		expect(onPersist).toHaveBeenCalledTimes(1);
		expect(onPersist).toHaveBeenCalledWith(NODE_ID, "hello typed");
	});
});
