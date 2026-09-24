/** @vitest-environment jsdom */
import { fireEvent, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RoadmapSchema } from "../../../../../packages/core/src/schema";
import { useKeyboardRouter } from "../../../src/mainview/hooks/useKeyboardRouter";
import { STATUS_HOTKEYS } from "../../../src/mainview/lib/domContract";
import {
	FOCUS_NODE_EVENT,
	type NodeFocusRequest,
} from "../../../src/mainview/lib/focusRequest";
import { useFileViewStore } from "../../../src/mainview/store/fileViewStore";
import { useRoadmapStore } from "../../../src/mainview/store/roadmapStore";
import { resetStore } from "../../helpers/resetStore";

/** Listener teardown for tests that observe the focus-request bridge. */
const cleanups: Array<() => void> = [];

/** Record every focus request the router issues until the test ends. */
function captureRequests(): NodeFocusRequest[] {
	const seen: NodeFocusRequest[] = [];
	const listener = (e: Event): void => {
		seen.push((e as CustomEvent<NodeFocusRequest>).detail);
	};
	window.addEventListener(FOCUS_NODE_EVENT, listener);
	cleanups.push(() => window.removeEventListener(FOCUS_NODE_EVENT, listener));
	return seen;
}

/** Child ids of a node, in order, read back from the live store. */
function childIdsOf(nodeId: string): string[] {
	return (
		useRoadmapStore
			.getState()
			.nodeIndex.get(nodeId)
			?.children?.map((c) => c.id) ?? []
	);
}

/**
 * v0.8.4 Phase 4: collapse state lives in fileViewStore, not in a DOM
 * chevron. Seeds it and returns a counter of later collapse writes.
 */
function trackCollapse(nodeId: string, collapsed: boolean): () => number {
	useFileViewStore.getState().setCollapsed(nodeId, collapsed);
	const start = useFileViewStore.getState().collapseVersion;
	return () => useFileViewStore.getState().collapseVersion - start;
}

const isCollapsed = (nodeId: string): boolean =>
	useFileViewStore.getState().collapsedIds.has(nodeId);

const ROOT_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const CHILD_A_ID = "11111111-2222-4333-8444-555555555555";
const CHILD_B_ID = "22222222-3333-4444-8555-666666666666";
const CHILD_B1_ID = "33333333-4444-4555-8666-777777777777";

function makeTestSchema(): RoadmapSchema {
	return {
		version: "1.0",
		title: "T",
		nodes: [
			{
				id: ROOT_ID,
				title: "Root",
				status: "not-started",
				children: [
					{ id: CHILD_A_ID, title: "A", status: "not-started" },
					{
						id: CHILD_B_ID,
						title: "B",
						status: "not-started",
						children: [{ id: CHILD_B1_ID, title: "B1", status: "not-started" }],
					},
				],
			},
		],
	};
}

interface RenderOpts {
	inlineRename?: {
		state: { nodeId: string | null };
		open: ReturnType<typeof vi.fn>;
		cancel: ReturnType<typeof vi.fn>;
	};
	togglePanelFocus?: ReturnType<typeof vi.fn<() => void>>;
}

function renderRouter(opts: RenderOpts = {}) {
	const inlineRename = opts.inlineRename ?? {
		state: { nodeId: null },
		open: vi.fn(),
		cancel: vi.fn(),
		commit: vi.fn(),
		setTitle: vi.fn(),
	};
	const togglePanelFocus = opts.togglePanelFocus ?? vi.fn<() => void>();

	renderHook(() =>
		useKeyboardRouter({
			inlineRename: inlineRename as never,
			togglePanelFocus,
		}),
	);

	return { inlineRename, togglePanelFocus };
}

beforeEach(() => {
	useRoadmapStore.getState().loadSchema(makeTestSchema(), "/tmp/t.json");
});

afterEach(() => {
	// Cleanup any stray event listeners from renderHook
	while (cleanups.length) cleanups.pop()?.();
	resetStore();
	useFileViewStore.getState().expandAll();
	vi.restoreAllMocks();
	document.body.innerHTML = "";
});

describe("useKeyboardRouter", () => {
	it("F2 with focusedNodeId set asks the canvas to reveal and rename it", () => {
		useRoadmapStore.getState().setFocusedNode(CHILD_A_ID);
		const seen = captureRequests();
		const { inlineRename } = renderRouter();
		fireEvent.keyDown(document, { key: "F2" });
		// v0.8.1 Phase 4: one create-and-rename path. `nearest`, not `center`:
		// renaming a node the user is looking at must not whip the camera, but
		// an off-screen one is revealed before its input opens. The router no
		// longer opens the input itself — the controller does, once the card is
		// mounted and measured.
		expect(seen).toEqual([
			{ nodeId: CHILD_A_ID, align: "nearest", select: false, rename: true },
		]);
		expect(inlineRename.open).not.toHaveBeenCalled();
	});

	it("Enter adds a child to focusedNodeId", () => {
		useRoadmapStore.getState().setFocusedNode(CHILD_A_ID);
		const addChildSpy = vi.spyOn(useRoadmapStore.getState(), "addChild");
		renderRouter();
		fireEvent.keyDown(document, { key: "Enter" });
		expect(addChildSpy).toHaveBeenCalledWith(CHILD_A_ID);
	});

	it("Shift+Enter adds a sibling above", () => {
		useRoadmapStore.getState().setFocusedNode(CHILD_A_ID);
		const spy = vi.spyOn(useRoadmapStore.getState(), "addSiblingAbove");
		renderRouter();
		fireEvent.keyDown(document, { key: "Enter", shiftKey: true });
		expect(spy).toHaveBeenCalledWith(CHILD_A_ID);
	});

	it("Tab (with preventDefault) adds a sibling below", () => {
		useRoadmapStore.getState().setFocusedNode(CHILD_A_ID);
		const spy = vi.spyOn(useRoadmapStore.getState(), "addSiblingBelow");
		renderRouter();
		fireEvent.keyDown(document, { key: "Tab" });
		expect(spy).toHaveBeenCalledWith(CHILD_A_ID);
	});

	it("Del on a leaf deletes immediately; Del on a non-leaf sets pendingConfirmation", () => {
		useRoadmapStore.getState().setFocusedNode(CHILD_A_ID);
		renderRouter();
		fireEvent.keyDown(document, { key: "Delete" });
		// CHILD_A was a leaf - it's gone
		expect(useRoadmapStore.getState().nodeIndex.has(CHILD_A_ID)).toBe(false);
		expect(useRoadmapStore.getState().pendingConfirmation).toBeNull();

		// Now focus B (has one child) — should NOT delete immediately
		useRoadmapStore.getState().setFocusedNode(CHILD_B_ID);
		fireEvent.keyDown(document, { key: "Delete" });
		expect(useRoadmapStore.getState().nodeIndex.has(CHILD_B_ID)).toBe(true);
		expect(useRoadmapStore.getState().pendingConfirmation).not.toBeNull();
		expect(useRoadmapStore.getState().pendingConfirmation?.nodeId).toBe(
			CHILD_B_ID,
		);
	});

	it("C toggles collapse on the focused node in the store, both ways", () => {
		useRoadmapStore.getState().setFocusedNode(CHILD_B_ID);

		renderRouter();
		fireEvent.keyDown(document, { key: "c" });
		expect(isCollapsed(CHILD_B_ID)).toBe(true);
		fireEvent.keyDown(document, { key: "C" });
		expect(isCollapsed(CHILD_B_ID)).toBe(false);
	});

	it("plain C is a no-op when the focused node has no children (leaf)", () => {
		useRoadmapStore.getState().setFocusedNode(CHILD_A_ID);
		renderRouter();
		// Must not throw and must not preventDefault.
		const evt = new KeyboardEvent("keydown", {
			key: "c",
			cancelable: true,
			bubbles: true,
		});
		document.dispatchEvent(evt);
		expect(evt.defaultPrevented).toBe(false);
	});

	it("Ctrl+C does NOT trigger collapse (defers to copy)", () => {
		useRoadmapStore.getState().setFocusedNode(CHILD_B_ID);
		const writes = trackCollapse(CHILD_B_ID, false);
		vi.spyOn(
			useRoadmapStore.getState(),
			"copySubtreeToClipboard",
		).mockResolvedValue();

		renderRouter();
		fireEvent.keyDown(document, { key: "c", ctrlKey: true });
		expect(writes()).toBe(0);
	});

	it("Ctrl+D duplicates focused node", () => {
		useRoadmapStore.getState().setFocusedNode(CHILD_A_ID);
		const spy = vi.spyOn(useRoadmapStore.getState(), "duplicateNode");
		renderRouter();
		fireEvent.keyDown(document, { key: "d", ctrlKey: true });
		expect(spy).toHaveBeenCalledWith(CHILD_A_ID);
	});

	it("Ctrl+Up / Ctrl+Down move focused up/down", () => {
		useRoadmapStore.getState().setFocusedNode(CHILD_B_ID);
		const upSpy = vi.spyOn(useRoadmapStore.getState(), "moveNodeUp");
		const downSpy = vi.spyOn(useRoadmapStore.getState(), "moveNodeDown");
		renderRouter();
		fireEvent.keyDown(document, { key: "ArrowUp", ctrlKey: true });
		expect(upSpy).toHaveBeenCalledWith(CHILD_B_ID);
		fireEvent.keyDown(document, { key: "ArrowDown", ctrlKey: true });
		expect(downSpy).toHaveBeenCalledWith(CHILD_B_ID);
	});

	it("Ctrl+C when canvas focused calls copySubtreeToClipboard; when input focused, does NOT", () => {
		useRoadmapStore.getState().setFocusedNode(CHILD_A_ID);
		const copySpy = vi
			.spyOn(useRoadmapStore.getState(), "copySubtreeToClipboard")
			.mockResolvedValue();
		renderRouter();

		// Canvas focus (no input in focus)
		fireEvent.keyDown(document, { key: "c", ctrlKey: true });
		expect(copySpy).toHaveBeenCalledWith(CHILD_A_ID);

		// Now put focus in an input element — keyboard event dispatches on input
		// which bubbles up to document, but our router checks document.activeElement.
		copySpy.mockClear();
		const input = document.createElement("input");
		document.body.appendChild(input);
		input.focus();
		// Fire event on the focused input — its target is input, handler reads activeElement
		fireEvent.keyDown(input, { key: "c", ctrlKey: true });
		expect(copySpy).not.toHaveBeenCalled();
	});

	it("Ctrl+V when canvas focused calls pasteFromClipboard; when input focused, does NOT", () => {
		useRoadmapStore.getState().setFocusedNode(CHILD_A_ID);
		const pasteSpy = vi
			.spyOn(useRoadmapStore.getState(), "pasteFromClipboard")
			.mockResolvedValue(null);
		renderRouter();

		fireEvent.keyDown(document, { key: "v", ctrlKey: true });
		expect(pasteSpy).toHaveBeenCalled();

		pasteSpy.mockClear();
		const input = document.createElement("input");
		document.body.appendChild(input);
		input.focus();
		fireEvent.keyDown(input, { key: "v", ctrlKey: true });
		expect(pasteSpy).not.toHaveBeenCalled();
	});

	// Arrow mapping matches the TB (top-to-bottom) tree layout:
	//   ArrowRight → next sibling    ArrowLeft  → previous sibling
	//   ArrowDown  → enter child     ArrowUp    → return to parent
	it("ArrowRight on focused sibling moves focus to next sibling", () => {
		useRoadmapStore.getState().setFocusedNode(CHILD_A_ID);
		renderRouter();
		fireEvent.keyDown(document, { key: "ArrowRight" });
		expect(useRoadmapStore.getState().focusedNodeId).toBe(CHILD_B_ID);
	});

	it("ArrowDown on a focused parent moves focus into its first child", () => {
		useRoadmapStore.getState().setFocusedNode(CHILD_B_ID);
		renderRouter();
		fireEvent.keyDown(document, { key: "ArrowDown" });
		expect(useRoadmapStore.getState().focusedNodeId).toBe(CHILD_B1_ID);
	});

	it("ArrowUp on a focused child returns focus to its parent", () => {
		useRoadmapStore.getState().setFocusedNode(CHILD_B1_ID);
		renderRouter();
		fireEvent.keyDown(document, { key: "ArrowUp" });
		expect(useRoadmapStore.getState().focusedNodeId).toBe(CHILD_B_ID);
	});

	// LR layout: tree flows left→right, so the hierarchy/sibling axes rotate 90°.
	//   ArrowRight → enter child    ArrowLeft  → return to parent
	//   ArrowDown  → next sibling   ArrowUp    → previous sibling
	describe("Arrow navigation respects LR layout orientation", () => {
		beforeEach(() => {
			useRoadmapStore.getState().setLayout("LR");
		});

		it("LR: ArrowRight on a focused parent moves focus into its first child", () => {
			useRoadmapStore.getState().setFocusedNode(CHILD_B_ID);
			renderRouter();
			fireEvent.keyDown(document, { key: "ArrowRight" });
			expect(useRoadmapStore.getState().focusedNodeId).toBe(CHILD_B1_ID);
		});

		it("LR: ArrowLeft on a focused child returns focus to its parent", () => {
			useRoadmapStore.getState().setFocusedNode(CHILD_B1_ID);
			renderRouter();
			fireEvent.keyDown(document, { key: "ArrowLeft" });
			expect(useRoadmapStore.getState().focusedNodeId).toBe(CHILD_B_ID);
		});

		it("LR: ArrowDown moves to the next sibling", () => {
			useRoadmapStore.getState().setFocusedNode(CHILD_A_ID);
			renderRouter();
			fireEvent.keyDown(document, { key: "ArrowDown" });
			expect(useRoadmapStore.getState().focusedNodeId).toBe(CHILD_B_ID);
		});

		it("LR: ArrowUp moves to the previous sibling", () => {
			useRoadmapStore.getState().setFocusedNode(CHILD_B_ID);
			renderRouter();
			fireEvent.keyDown(document, { key: "ArrowUp" });
			expect(useRoadmapStore.getState().focusedNodeId).toBe(CHILD_A_ID);
		});
	});

	// v0.8.1 Phase 5: F6 is the WAI-ARIA pane-switch key, and a pane switch is
	// expected to work from inside a text field — that is most of the point of
	// having one. The router's blanket `inTextInput` early return used to swallow
	// it, so a user editing the SidePanel title had no keyboard route back to the
	// canvas. F6 is a function key: it can never be part of what someone is
	// typing, so hoisting it above that guard costs no typing behaviour, and
	// Escape and every printable key still return first.
	describe("F6 pane switching", () => {
		it("hands over to the panel-focus handoff", () => {
			const { togglePanelFocus } = renderRouter();

			fireEvent.keyDown(document, { key: "F6" });

			expect(togglePanelFocus).toHaveBeenCalledTimes(1);
		});

		it("works while a text input has focus", () => {
			const { togglePanelFocus } = renderRouter();
			const input = document.createElement("input");
			document.body.appendChild(input);
			input.focus();

			fireEvent.keyDown(input, { key: "F6" });

			expect(togglePanelFocus).toHaveBeenCalledTimes(1);
		});

		it("still leaves Escape and printable keys to the field being typed in", () => {
			useRoadmapStore.getState().setFocusedNode(CHILD_A_ID);
			useRoadmapStore.getState().setSelectedNode(CHILD_A_ID);
			renderRouter();
			const input = document.createElement("input");
			document.body.appendChild(input);
			input.focus();

			fireEvent.keyDown(input, { key: "Escape" });
			fireEvent.keyDown(input, { key: "Delete" });

			expect(useRoadmapStore.getState().selectedNodeId).toBe(CHILD_A_ID);
			expect(useRoadmapStore.getState().nodeIndex.has(CHILD_A_ID)).toBe(true);
		});
	});

	// v0.8.1 Phase 2 (RC3): the canvas no longer guesses its viewport target
	// from `focusedNodeId ?? selectedNodeId` — each mover states its intent.
	describe("explicit focus requests", () => {
		it("arrow navigation asks for the comfort zone, without selecting", () => {
			useRoadmapStore.getState().setFocusedNode(CHILD_A_ID);
			const seen = captureRequests();
			renderRouter();

			fireEvent.keyDown(document, { key: "ArrowRight" });

			expect(seen).toEqual([
				{
					nodeId: CHILD_B_ID,
					align: "nearest",
					select: false,
					rename: false,
				},
			]);
			expect(useRoadmapStore.getState().selectedNodeId).toBeNull();
		});

		it("Space promotes the focused node to selected and keeps it in view", () => {
			useRoadmapStore.getState().setFocusedNode(CHILD_B_ID);
			const seen = captureRequests();
			renderRouter();

			fireEvent.keyDown(document, { key: " " });

			expect(seen).toEqual([
				{ nodeId: CHILD_B_ID, align: "nearest", select: true, rename: false },
			]);
			expect(useRoadmapStore.getState().selectedNodeId).toBe(CHILD_B_ID);
		});
	});

	// v0.8.1 Phase 4 (RC4): every create shortcut goes through the one
	// create-and-rename path. Before, `dispatchOpenRename(store.addChild(id))`
	// left focus on the parent and let the rename input open ~518px outside
	// the canvas (P0-4). `center` because a new node is a jump-to, not a
	// neighbour; `rename` because the reveal is the only thing that knows when
	// the card exists and where it landed.
	describe("create and rename (RC4)", () => {
		const CREATED = { align: "center", select: false, rename: true };

		function pressAndCapture(init: KeyboardEventInit): NodeFocusRequest[] {
			useRoadmapStore.getState().setFocusedNode(CHILD_A_ID);
			const seen = captureRequests();
			renderRouter();
			fireEvent.keyDown(document, init);
			return seen;
		}

		it.each([
			["Enter", { key: "Enter" }, () => childIdsOf(CHILD_A_ID)[0]],
			[
				"Shift+Enter",
				{ key: "Enter", shiftKey: true },
				() => childIdsOf(ROOT_ID)[0],
			],
			["Tab", { key: "Tab" }, () => childIdsOf(ROOT_ID)[1]],
			["Ctrl+D", { key: "d", ctrlKey: true }, () => childIdsOf(ROOT_ID)[1]],
		] as const)("%s requests a centred create-and-rename on the new node", (_label, init, expectedId) => {
			const seen = pressAndCapture(init);

			expect(seen).toEqual([{ nodeId: expectedId(), ...CREATED }]);
			expect(useRoadmapStore.getState().focusedNodeId).toBe(seen[0].nodeId);
		});

		it("asks for nothing when the store refuses the create", () => {
			// With no schema loaded addChild returns null, and a null id must
			// not become a focus request — or a rename on nothing.
			resetStore();
			useRoadmapStore.getState().setFocusedNode(CHILD_A_ID);
			const seen = captureRequests();
			renderRouter();

			fireEvent.keyDown(document, { key: "Enter" });

			expect(seen).toEqual([]);
		});
	});

	// v0.8.1 Phase 4 (A6 / RC6): a child-direction key must never put focus on
	// a card that is not mounted. On a COLLAPSED node it expands and keeps
	// focus (WAI-ARIA tree); the next press enters the first child. The
	// parent-direction key is unchanged — `C` is the only key that collapses.
	describe("collapse-aware navigation (A6)", () => {
		it.each([
			["TB", undefined, "ArrowDown"],
			["LR", "LR", "ArrowRight"],
		] as const)("%s: child key on a collapsed node expands it and keeps focus", (_label, layout, key) => {
			if (layout) useRoadmapStore.getState().setLayout(layout);
			useRoadmapStore.getState().setFocusedNode(CHILD_B_ID);
			const writes = trackCollapse(CHILD_B_ID, true);
			const seen = captureRequests();
			renderRouter();

			fireEvent.keyDown(document, { key });

			expect(writes()).toBe(1);
			expect(isCollapsed(CHILD_B_ID)).toBe(false);
			expect(useRoadmapStore.getState().focusedNodeId).toBe(CHILD_B_ID);
			expect(seen).toEqual([]);
		});

		it("the next child key then enters the first child", () => {
			useRoadmapStore.getState().setFocusedNode(CHILD_B_ID);
			trackCollapse(CHILD_B_ID, true);
			renderRouter();

			fireEvent.keyDown(document, { key: "ArrowDown" });
			fireEvent.keyDown(document, { key: "ArrowDown" });

			expect(useRoadmapStore.getState().focusedNodeId).toBe(CHILD_B1_ID);
		});

		it("child key on an expanded node enters the first child straight away", () => {
			useRoadmapStore.getState().setFocusedNode(CHILD_B_ID);
			const writes = trackCollapse(CHILD_B_ID, false);
			renderRouter();

			fireEvent.keyDown(document, { key: "ArrowDown" });

			expect(writes()).toBe(0);
			expect(useRoadmapStore.getState().focusedNodeId).toBe(CHILD_B1_ID);
		});

		it("parent key never collapses the node it leaves", () => {
			useRoadmapStore.getState().setFocusedNode(CHILD_B1_ID);
			const writes = trackCollapse(CHILD_B_ID, false);
			renderRouter();

			fireEvent.keyDown(document, { key: "ArrowUp" });

			expect(writes()).toBe(0);
			expect(useRoadmapStore.getState().focusedNodeId).toBe(CHILD_B_ID);
		});
	});

	// v0.8.4 Phase 5 (RC2): reorder follows the layout's sibling axis, indent
	// and outdent follow the hierarchy axis, and a modifier held with an arrow
	// never navigates. Tree: ROOT -> [CHILD_A, CHILD_B -> [CHILD_B1]].
	describe("orientation-aware reorder + indent/outdent (Phase 5)", () => {
		it("TB: Ctrl+ArrowRight reorders (moveNodeDown)", () => {
			useRoadmapStore.getState().setFocusedNode(CHILD_A_ID);
			const downSpy = vi.spyOn(useRoadmapStore.getState(), "moveNodeDown");
			renderRouter();
			fireEvent.keyDown(document, { key: "ArrowRight", ctrlKey: true });
			expect(downSpy).toHaveBeenCalledWith(CHILD_A_ID);
		});

		it("TB: Ctrl+ArrowLeft reorders (moveNodeUp)", () => {
			useRoadmapStore.getState().setFocusedNode(CHILD_B_ID);
			const upSpy = vi.spyOn(useRoadmapStore.getState(), "moveNodeUp");
			renderRouter();
			fireEvent.keyDown(document, { key: "ArrowLeft", ctrlKey: true });
			expect(upSpy).toHaveBeenCalledWith(CHILD_B_ID);
		});

		it("TB: Ctrl+ArrowDown still reorders (moveNodeDown, legacy pair, D-8)", () => {
			useRoadmapStore.getState().setFocusedNode(CHILD_A_ID);
			const downSpy = vi.spyOn(useRoadmapStore.getState(), "moveNodeDown");
			renderRouter();
			fireEvent.keyDown(document, { key: "ArrowDown", ctrlKey: true });
			expect(downSpy).toHaveBeenCalledWith(CHILD_A_ID);
		});

		it("LR: Ctrl+ArrowDown reorders (moveNodeDown, legacy pair)", () => {
			useRoadmapStore.getState().setLayout("LR");
			useRoadmapStore.getState().setFocusedNode(CHILD_A_ID);
			const downSpy = vi.spyOn(useRoadmapStore.getState(), "moveNodeDown");
			renderRouter();
			fireEvent.keyDown(document, { key: "ArrowDown", ctrlKey: true });
			expect(downSpy).toHaveBeenCalledWith(CHILD_A_ID);
		});

		it("TB: Ctrl+ArrowRight does NOT navigate (modifier guard)", () => {
			useRoadmapStore.getState().setFocusedNode(CHILD_A_ID);
			const seen = captureRequests();
			renderRouter();
			fireEvent.keyDown(document, { key: "ArrowRight", ctrlKey: true });
			expect(seen).toEqual([]);
		});

		it("TB: Alt+ArrowDown indents the focused node under its previous sibling", () => {
			useRoadmapStore.getState().setFocusedNode(CHILD_B_ID);
			const spy = vi.spyOn(useRoadmapStore.getState(), "indentNode");
			renderRouter();
			fireEvent.keyDown(document, { key: "ArrowDown", altKey: true });
			expect(spy).toHaveBeenCalledWith(CHILD_B_ID);
		});

		it("TB: Alt+ArrowUp outdents the focused node to right after its parent", () => {
			useRoadmapStore.getState().setFocusedNode(CHILD_B1_ID);
			const spy = vi.spyOn(useRoadmapStore.getState(), "outdentNode");
			renderRouter();
			fireEvent.keyDown(document, { key: "ArrowUp", altKey: true });
			expect(spy).toHaveBeenCalledWith(CHILD_B1_ID);
		});

		it("LR: Alt+ArrowRight indents, Alt+ArrowLeft outdents", () => {
			useRoadmapStore.getState().setLayout("LR");
			const indentSpy = vi.spyOn(useRoadmapStore.getState(), "indentNode");
			const outdentSpy = vi.spyOn(useRoadmapStore.getState(), "outdentNode");
			renderRouter();

			useRoadmapStore.getState().setFocusedNode(CHILD_B_ID);
			fireEvent.keyDown(document, { key: "ArrowRight", altKey: true });
			expect(indentSpy).toHaveBeenCalledWith(CHILD_B_ID);

			useRoadmapStore.getState().setFocusedNode(CHILD_B1_ID);
			fireEvent.keyDown(document, { key: "ArrowLeft", altKey: true });
			expect(outdentSpy).toHaveBeenCalledWith(CHILD_B1_ID);
		});

		it("Indent expands a collapsed previous sibling so the moved node does not vanish", () => {
			useRoadmapStore.getState().setFocusedNode(CHILD_B_ID);
			trackCollapse(CHILD_A_ID, true);
			renderRouter();
			fireEvent.keyDown(document, { key: "ArrowDown", altKey: true });
			expect(isCollapsed(CHILD_A_ID)).toBe(false);
		});

		it.each(
			Object.entries(STATUS_HOTKEYS) as Array<
				[keyof typeof STATUS_HOTKEYS, string]
			>,
		)("%s sets status to %s via updateNodeStatus", (key, status) => {
			useRoadmapStore.getState().setFocusedNode(CHILD_A_ID);
			const spy = vi.spyOn(useRoadmapStore.getState(), "updateNodeStatus");
			renderRouter();
			fireEvent.keyDown(document, { key });
			expect(spy).toHaveBeenCalledWith(CHILD_A_ID, status);
		});

		it("a status digit inside a text input does nothing", () => {
			useRoadmapStore.getState().setFocusedNode(CHILD_A_ID);
			// mockClear: a spy on a store action can carry call history forward
			// from an earlier test (zustand's set() copies the current — possibly
			// spied — function reference into each new state object), so a
			// `not.toHaveBeenCalled()` assertion needs a clean slate first.
			const spy = vi
				.spyOn(useRoadmapStore.getState(), "updateNodeStatus")
				.mockClear();
			renderRouter();
			const input = document.createElement("input");
			document.body.appendChild(input);
			input.focus();
			fireEvent.keyDown(input, { key: "2" });
			expect(spy).not.toHaveBeenCalled();
		});

		it("Ctrl+<digit> does nothing (status hotkeys are modifier-free)", () => {
			useRoadmapStore.getState().setFocusedNode(CHILD_A_ID);
			const spy = vi
				.spyOn(useRoadmapStore.getState(), "updateNodeStatus")
				.mockClear();
			renderRouter();
			fireEvent.keyDown(document, { key: "2", ctrlKey: true });
			expect(spy).not.toHaveBeenCalled();
		});
	});
});
