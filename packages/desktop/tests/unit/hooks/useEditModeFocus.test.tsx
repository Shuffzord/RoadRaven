/** @vitest-environment jsdom */
import { act, fireEvent, render } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RoadmapSchema } from "../../../../../packages/core/src/schema";
import { useEditModeFocus } from "../../../src/mainview/hooks/useEditModeFocus";
import {
	FOCUS_NODE_EVENT,
	type NodeFocusRequest,
} from "../../../src/mainview/lib/focusRequest";
import { useRoadmapStore } from "../../../src/mainview/store/roadmapStore";
import { resetStore } from "../../helpers/resetStore";

// v0.8.1 Phase 5 — `E` is one keystroke to retype a node's name, and leaving
// edit mode never drops the keyboard user on <body>
// (.planning/v0.8.1-canvas-focus-PLAN.md).
//
// The hook exists so SidePanel does not grow these branches: it is already
// fallow's second-worst function in scope (34 cyclomatic / 40 cognitive) and
// the plan forbids making it worse.

const ROOT_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";

const SCHEMA: RoadmapSchema = {
	version: "1.0",
	title: "Edit-mode focus fixture",
	nodes: [{ id: ROOT_ID, title: "Root", status: "not-started" }],
};

const cleanups: Array<() => void> = [];

function captureRequests(): NodeFocusRequest[] {
	const seen: NodeFocusRequest[] = [];
	const listener = (e: Event): void => {
		seen.push((e as CustomEvent<NodeFocusRequest>).detail);
	};
	window.addEventListener(FOCUS_NODE_EVENT, listener);
	cleanups.push(() => window.removeEventListener(FOCUS_NODE_EVENT, listener));
	return seen;
}

/**
 * The parts of SidePanel this hook touches: an "Edit node" button that only
 * exists while NOT editing (so its element really is gone afterwards, exactly
 * as React re-creates it) and the title input it swaps to.
 */
function Harness({ isOpen = true, hasNode = true } = {}): React.ReactElement {
	const [isEditing, setIsEditing] = useState(false);
	const { titleInputRef, beginEdit } = useEditModeFocus({
		isOpen,
		hasNode,
		isEditing,
		setIsEditing,
	});
	return (
		<div>
			{isEditing ? (
				<input
					ref={titleInputRef}
					aria-label="Title"
					defaultValue="Root"
					type="text"
				/>
			) : (
				<button aria-label="Edit node" onClick={beginEdit} type="button">
					edit
				</button>
			)}
			<button
				aria-label="Leave"
				onClick={() => setIsEditing(false)}
				type="button"
			>
				leave
			</button>
		</div>
	);
}

function titleInput(): HTMLInputElement | null {
	return document.querySelector<HTMLInputElement>('input[aria-label="Title"]');
}

function button(label: string): HTMLButtonElement {
	const el = document.querySelector<HTMLButtonElement>(
		`button[aria-label="${label}"]`,
	);
	if (!el) throw new Error(`no button ${label}`);
	return el;
}

/** A mounted canvas card, the fallback focus target. */
function mountCard(id: string): HTMLElement {
	const container = document.createElement("div");
	container.setAttribute("role", "application");
	const card = document.createElement("div");
	card.setAttribute("data-source-id", id);
	card.tabIndex = 0;
	container.appendChild(card);
	document.body.appendChild(container);
	return card;
}

beforeEach(() => {
	resetStore();
	useRoadmapStore.getState().loadSchema(SCHEMA, "/tmp/edit-mode.json");
});

afterEach(() => {
	while (cleanups.length) cleanups.pop()?.();
	document.body.innerHTML = "";
	vi.restoreAllMocks();
	resetStore();
});

// Test audit (2026-09-21): "E enters edit mode and puts a selected caret in
// the title" and "the Edit button opens the same focused, selected input"
// were dropped — both entry points call the identical `beginEdit` (this
// file's source: entering here just flips a boolean and calls it), and
// SidePanel.edit-mode.test.tsx's "pressing E focuses the title input and
// selects its text" already exercises that exact effect through the real
// component. "hands focus back to the control the user came from" and
// "never steals focus from wherever the user clicked instead" were dropped
// the same way — `restoreEditOrigin` does not care why `isEditing` went
// false, and SidePanel.edit-mode.test.tsx's Escape/Enter-commit and
// "does not steal focus" cases already exercise it end to end.
describe("useEditModeFocus — entering edit mode", () => {
	it("E is ignored with a modifier, while typing, closed, or without a node", () => {
		const { unmount } = render(<Harness />);
		const textbox = document.createElement("input");
		document.body.appendChild(textbox);
		textbox.focus();
		fireEvent.keyDown(window, { key: "e" });
		expect(titleInput(), "while typing").toBeNull();
		textbox.blur();
		fireEvent.keyDown(window, { key: "e", ctrlKey: true });
		expect(titleInput(), "with Ctrl held").toBeNull();
		unmount();

		render(<Harness isOpen={false} />);
		fireEvent.keyDown(window, { key: "e" });
		expect(titleInput(), "panel closed").toBeNull();
	});
});

describe("useEditModeFocus — leaving edit mode", () => {
	it("falls back to the canvas tab stop when that control is gone", () => {
		render(<Harness />);
		mountCard(ROOT_ID);
		const seen = captureRequests();

		// Entering from the Edit button: React removes that very element while
		// editing, so there is nothing left to restore to.
		button("Edit node").focus();
		fireEvent.click(button("Edit node"));
		act(() => {
			button("Leave").click();
		});

		expect(seen).toEqual([
			{ nodeId: ROOT_ID, align: "none", select: false, rename: false },
		]);
	});
});
