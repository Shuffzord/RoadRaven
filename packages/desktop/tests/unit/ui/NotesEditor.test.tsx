/** @vitest-environment jsdom */
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NotesEditor } from "../../../src/mainview/components/NotesEditor";

const NODE_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";

beforeEach(() => {
	vi.useFakeTimers();
});

afterEach(() => {
	vi.useRealTimers();
	document.body.innerHTML = "";
});

describe("NotesEditor", () => {
	it("default view mode is 'preview'; renders MarkdownRenderer", () => {
		const onPersist = vi.fn();
		render(
			<NotesEditor
				nodeId={NODE_ID}
				notes="hello **world**"
				onPersist={onPersist}
				panelWidth={600}
			/>,
		);
		// Preview mode shows MarkdownRenderer — rendered text "hello" with "world" as strong
		expect(document.querySelector(".markdown-notes")).not.toBeNull();
		// CodeMirror editor should NOT be mounted in preview mode
		expect(document.querySelector(".cm-editor")).toBeNull();
		const previewBtn = screen.getByRole("tab", { name: "Preview" });
		expect(previewBtn.getAttribute("aria-selected")).toBe("true");
	});

	it("clicking 'Edit' segment switches to edit mode; CodeMirror container renders", () => {
		const onPersist = vi.fn();
		render(
			<NotesEditor
				nodeId={NODE_ID}
				notes=""
				onPersist={onPersist}
				panelWidth={600}
			/>,
		);
		const editBtn = screen.getByRole("tab", { name: "Edit" });
		act(() => {
			fireEvent.click(editBtn);
		});
		expect(editBtn.getAttribute("aria-selected")).toBe("true");
		expect(document.querySelector(".cm-editor")).not.toBeNull();
	});

	it("clicking 'Split' segment shows BOTH MarkdownRenderer and CodeMirror", () => {
		const onPersist = vi.fn();
		render(
			<NotesEditor
				nodeId={NODE_ID}
				notes="hello"
				onPersist={onPersist}
				panelWidth={800}
			/>,
		);
		const splitBtn = screen.getByRole("tab", { name: "Split" });
		act(() => {
			fireEvent.click(splitBtn);
		});
		expect(document.querySelector(".cm-editor")).not.toBeNull();
		expect(document.querySelector(".markdown-notes")).not.toBeNull();
	});

	it("typing in edit mode triggers onPersist after 1s debounce", async () => {
		const onPersist = vi.fn();
		render(
			<NotesEditor
				nodeId={NODE_ID}
				notes=""
				onPersist={onPersist}
				panelWidth={600}
			/>,
		);
		act(() => {
			fireEvent.click(screen.getByRole("tab", { name: "Edit" }));
		});
		const cmEditor = document.querySelector(".cm-editor") as HTMLElement | null;
		expect(cmEditor).not.toBeNull();
		// Access the EditorView via CodeMirror's static lookup
		const { EditorView } = await import("@codemirror/view");
		// biome-ignore lint/style/noNonNullAssertion: asserted above
		const view = EditorView.findFromDOM(cmEditor!);
		expect(view).not.toBeNull();
		if (!view) throw new Error("view not found");
		act(() => {
			view.dispatch({
				changes: { from: 0, to: view.state.doc.length, insert: "typed" },
			});
		});
		act(() => {
			vi.advanceTimersByTime(1000);
		});
		expect(onPersist).toHaveBeenCalledTimes(1);
		expect(onPersist).toHaveBeenCalledWith(NODE_ID, "typed");
	});

	it("segmented toggle has role='tablist' and aria-label='Notes view mode'; each segment has role='tab' and aria-selected", () => {
		const onPersist = vi.fn();
		render(
			<NotesEditor
				nodeId={NODE_ID}
				notes=""
				onPersist={onPersist}
				panelWidth={600}
			/>,
		);
		const tablist = screen.getByRole("tablist");
		expect(tablist.getAttribute("aria-label")).toBe("Notes view mode");
		const tabs = screen.getAllByRole("tab");
		expect(tabs).toHaveLength(3);
		for (const tab of tabs) {
			expect(tab.getAttribute("aria-selected")).toMatch(/^(true|false)$/);
		}
	});

	it("active segment has class containing rv-accent-muted background", () => {
		const onPersist = vi.fn();
		render(
			<NotesEditor
				nodeId={NODE_ID}
				notes=""
				onPersist={onPersist}
				panelWidth={600}
			/>,
		);
		// Preview is active by default
		const previewBtn = screen.getByRole("tab", { name: "Preview" });
		expect(previewBtn.className).toMatch(/rv-accent-muted/);
	});

	it("when panel width < 560px and mode='split', renders narrow-panel notice and collapses to Edit mode", () => {
		const onPersist = vi.fn();
		render(
			<NotesEditor
				nodeId={NODE_ID}
				notes=""
				onPersist={onPersist}
				panelWidth={400}
			/>,
		);
		act(() => {
			fireEvent.click(screen.getByRole("tab", { name: "Split" }));
		});
		// Notice text visible
		expect(screen.getByText(/Panel too narrow for split view/i)).not.toBeNull();
		// CodeMirror still mounts (collapsed to edit); markdown preview should NOT render
		expect(document.querySelector(".cm-editor")).not.toBeNull();
		expect(document.querySelector(".markdown-notes")).toBeNull();
	});
});
