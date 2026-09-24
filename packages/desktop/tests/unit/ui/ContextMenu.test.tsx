/** @vitest-environment jsdom */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { RoadRavenContextMenu } from "../../../src/mainview/components/ContextMenu";
import {
	CHEVRON_COLLAPSE_LABEL,
	CHEVRON_EXPAND_LABEL,
	COLLAPSE_ALL_LABEL,
	collapseToDepthLabel,
	EXPAND_ALL_LABEL,
	INDENT_LABEL,
	OUTDENT_LABEL,
	REDO_LABEL,
	UNDO_LABEL,
} from "../../../src/mainview/lib/domContract";
import {
	FOCUS_NODE_EVENT,
	type NodeFocusRequest,
} from "../../../src/mainview/lib/focusRequest";
import { useFileViewStore } from "../../../src/mainview/store/fileViewStore";
import { useHistoryStore } from "../../../src/mainview/store/historyStore";
import { useRoadmapStore } from "../../../src/mainview/store/roadmapStore";
import { resetStore } from "../../helpers/resetStore";

/** Listener teardown for the tests that observe the focus-request bridge. */
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

// Radix relies on PointerEvent APIs that jsdom does not implement.
const noop = (): void => {
	/* jsdom polyfill no-op */
};

beforeAll(() => {
	if (!HTMLElement.prototype.hasPointerCapture) {
		HTMLElement.prototype.hasPointerCapture = () => false;
	}
	if (!HTMLElement.prototype.releasePointerCapture) {
		HTMLElement.prototype.releasePointerCapture = noop;
	}
	if (!HTMLElement.prototype.scrollIntoView) {
		HTMLElement.prototype.scrollIntoView = noop;
	}
});

/** One animation frame, for the menu-close focus restore (Phase 5). */
function nextFrame(): Promise<void> {
	return new Promise((resolve) => {
		requestAnimationFrame(() => resolve());
	});
}

afterEach(async () => {
	// A menu closing without a focus intent schedules its restore one frame
	// later. Drain it here so it cannot land inside the NEXT test's listener.
	await nextFrame();
	await nextFrame();
	while (cleanups.length) cleanups.pop()?.();
	resetStore();
	vi.restoreAllMocks();
});

function seedSchema(withStatusConfig = true) {
	const root = {
		id: "root-id",
		title: "Root",
		status: "not-started" as const,
		children: [
			{
				id: "child-1",
				title: "Child 1",
				status: "in-progress" as const,
			},
		],
	};
	useRoadmapStore.getState().loadSchema(
		{
			version: "1",
			title: "Test",
			nodes: [root],
			...(withStatusConfig
				? {
						statusConfig: [
							{ id: "not-started", label: "Not Started" },
							{ id: "in-progress", label: "In Progress" },
							{ id: "completed", label: "Completed" },
							{ id: "blocked", label: "Blocked" },
							{ id: "review", label: "Review" },
						],
					}
				: {}),
		},
		"/tmp/test.json",
	);
}

/**
 * Test harness that wraps RoadRavenContextMenu with a simulated trigger.
 * The trigger has `data-source-id` so ContextMenu's onOpen receives it.
 */
function NodeHarness({ nodeId = "root-id" }: { nodeId?: string | null }) {
	return (
		<RoadRavenContextMenu>
			<div data-testid="trigger" data-source-id={nodeId ?? undefined}>
				trigger
			</div>
		</RoadRavenContextMenu>
	);
}

/** Canvas-background harness (no data-source-id). */
function CanvasHarness() {
	return (
		<RoadRavenContextMenu>
			<div data-testid="trigger">trigger</div>
		</RoadRavenContextMenu>
	);
}

function openMenu(trigger: HTMLElement) {
	fireEvent.contextMenu(trigger, { clientX: 100, clientY: 100, button: 2 });
}

describe("RoadRavenContextMenu — ARIA + structure", () => {
	it("node menu renders with role='menu' and aria-label='Node actions'", () => {
		seedSchema();
		render(<NodeHarness />);
		openMenu(screen.getByTestId("trigger"));
		const menu = screen.getByRole("menu", { name: /node actions/i });
		expect(menu).toBeTruthy();
	});

	it("node menu renders items in the expected order with 6 separators (root has children: the collapse item shows)", () => {
		seedSchema();
		render(<NodeHarness />);
		openMenu(screen.getByTestId("trigger"));
		const menu = screen.getByRole("menu", { name: /node actions/i });
		// Walk the direct menuitem nodes and pluck the leading label.
		const labels = Array.from(
			menu.querySelectorAll<HTMLElement>('[role="menuitem"]'),
		).map((el) => el.querySelector("span")?.textContent ?? "");
		expect(labels).toEqual([
			"Rename",
			CHEVRON_COLLAPSE_LABEL,
			"Add Child",
			"Add Sibling Above",
			"Add Sibling Below",
			"Duplicate",
			"Copy",
			"Paste",
			"Move Up",
			"Move Down",
			INDENT_LABEL,
			OUTDENT_LABEL,
			"Change Status",
			"Delete",
		]);
		const seps = menu.querySelectorAll('[role="separator"]');
		expect(seps.length).toBe(6);
	});

	it("each action entry has role='menuitem'", () => {
		seedSchema();
		render(<NodeHarness />);
		openMenu(screen.getByTestId("trigger"));
		const menu = screen.getByRole("menu", { name: /node actions/i });
		// 13 top-level menuitems (incl. the collapse, indent and outdent items)
		// + 1 submenu trigger
		expect(menu.querySelectorAll('[role="menuitem"]').length).toBe(14);
	});

	it("Delete item is styled with --rv-status-blocked", () => {
		seedSchema();
		render(<NodeHarness />);
		openMenu(screen.getByTestId("trigger"));
		const menu = screen.getByRole("menu", { name: /node actions/i });
		const deleteItem = Array.from(
			menu.querySelectorAll<HTMLElement>('[role="menuitem"]'),
		).find((el) => el.textContent?.includes("Delete"));
		expect(deleteItem).toBeTruthy();
		expect(deleteItem?.style.color).toBe("var(--rv-status-blocked)");
	});

	it("shortcut hints are present as text", () => {
		seedSchema();
		render(<NodeHarness />);
		openMenu(screen.getByTestId("trigger"));
		const menu = screen.getByRole("menu", { name: /node actions/i });
		const text = menu.textContent ?? "";
		for (const hint of [
			"F2",
			"Enter",
			"Shift+Enter",
			"Tab",
			"Ctrl+D",
			"Ctrl+C",
			"Ctrl+V",
			"Ctrl+↑",
			"Ctrl+↓",
			"Del",
		]) {
			expect(text).toContain(hint);
		}
	});

	it("Change Status submenu trigger has aria-haspopup='menu'", () => {
		seedSchema();
		render(<NodeHarness />);
		openMenu(screen.getByTestId("trigger"));
		const menu = screen.getByRole("menu", { name: /node actions/i });
		const subTrigger = Array.from(
			menu.querySelectorAll<HTMLElement>('[role="menuitem"]'),
		).find((el) => el.textContent?.includes("Change Status"));
		expect(subTrigger).toBeTruthy();
		expect(subTrigger?.getAttribute("aria-haspopup")).toBe("menu");
	});

	it("canvas menu renders Undo + Redo + Paste + Add Root Child + Fit to View + Toggle Layout + the four collapse items with 3 separators", () => {
		seedSchema();
		render(<CanvasHarness />);
		openMenu(screen.getByTestId("trigger"));
		const menu = screen.getByRole("menu", { name: /canvas actions/i });
		expect(menu.textContent).toMatch(/Paste/);
		expect(menu.textContent).toMatch(/Add Root Child/);
		expect(menu.textContent).toMatch(/Fit to View/);
		expect(menu.textContent).toMatch(/Toggle Layout/);
		expect(menu.querySelectorAll('[role="menuitem"]').length).toBe(10);
		expect(menu.querySelectorAll('[role="separator"]').length).toBe(3);
	});

	it("Paste item is aria-disabled when lastCopiedSubtree is null (node menu)", () => {
		seedSchema();
		render(<NodeHarness />);
		openMenu(screen.getByTestId("trigger"));
		const menu = screen.getByRole("menu", { name: /node actions/i });
		const pasteItem = Array.from(
			menu.querySelectorAll<HTMLElement>('[role="menuitem"]'),
		).find((el) => el.textContent?.includes("Paste"));
		expect(pasteItem).toBeTruthy();
		expect(pasteItem?.getAttribute("aria-disabled")).toBe("true");
	});

	it("Paste item becomes enabled when lastCopiedSubtree is set (canvas menu)", () => {
		seedSchema();
		useRoadmapStore.setState({
			lastCopiedSubtree: {
				id: "copied",
				title: "Copied",
				status: "not-started",
			},
		});
		render(<CanvasHarness />);
		openMenu(screen.getByTestId("trigger"));
		const menu = screen.getByRole("menu", { name: /canvas actions/i });
		const pasteItem = Array.from(
			menu.querySelectorAll<HTMLElement>('[role="menuitem"]'),
		).find((el) => el.textContent?.includes("Paste"));
		expect(pasteItem).toBeTruthy();
		expect(pasteItem?.getAttribute("aria-disabled")).not.toBe("true");
	});

	it("Add Child activates store.addChild(nodeId)", () => {
		seedSchema();
		const spy = vi.spyOn(useRoadmapStore.getState(), "addChild");
		render(<NodeHarness nodeId="child-1" />);
		openMenu(screen.getByTestId("trigger"));
		const menu = screen.getByRole("menu", { name: /node actions/i });
		const addChild = Array.from(
			menu.querySelectorAll<HTMLElement>('[role="menuitem"]'),
		).find((el) => el.textContent?.startsWith("Add Child"));
		expect(addChild).toBeTruthy();
		fireEvent.click(addChild as HTMLElement);
		expect(spy).toHaveBeenCalledWith("child-1");
	});

	it("Delete menu item activates store.requestDelete(nodeId)", () => {
		seedSchema();
		const spy = vi.spyOn(useRoadmapStore.getState(), "requestDelete");
		render(<NodeHarness nodeId="child-1" />);
		openMenu(screen.getByTestId("trigger"));
		const menu = screen.getByRole("menu", { name: /node actions/i });
		const del = Array.from(
			menu.querySelectorAll<HTMLElement>('[role="menuitem"]'),
		).find((el) => el.textContent?.startsWith("Delete"));
		expect(del).toBeTruthy();
		fireEvent.click(del as HTMLElement);
		expect(spy).toHaveBeenCalledWith("child-1");
	});
});

describe("Canvas menu — Add Root Child disabled when no schema", () => {
	it("disables Add Root Child when schema.nodes is empty", () => {
		// Explicitly do NOT seed schema
		render(<CanvasHarness />);
		openMenu(screen.getByTestId("trigger"));
		const menu = screen.getByRole("menu", { name: /canvas actions/i });
		const addRoot = Array.from(
			menu.querySelectorAll<HTMLElement>('[role="menuitem"]'),
		).find((el) => el.textContent?.includes("Add Root Child"));
		expect(addRoot).toBeTruthy();
		expect(addRoot?.getAttribute("aria-disabled")).toBe("true");
	});
});

// v0.8.1 Phase 4 (RC4): every menu entry that renames — the Rename item and
// the five create items — states ONE intent through `requestNodeFocus`. It
// used to be `setFocusedNode` plus a `roadraven:open-rename` window event that
// Canvas answered one rAF later, knowing nothing about where the new card had
// landed. Now the reveal owns both: it waits for the card, measures it, pans
// to it and only then opens the input — which is also what keeps the Radix
// close-autofocus race shut (the menu's FocusScope is long gone by then).
describe("RoadRavenContextMenu — create and rename intents (RC4)", () => {
	function clickItem(menuName: RegExp, label: string): void {
		const menu = screen.getByRole("menu", { name: menuName });
		const item = Array.from(
			menu.querySelectorAll<HTMLElement>('[role="menuitem"]'),
		).find((el) => el.textContent?.startsWith(label));
		if (!item) throw new Error(`no menu item "${label}"`);
		fireEvent.click(item);
	}

	function childIdsOf(nodeId: string): string[] {
		return (
			useRoadmapStore
				.getState()
				.nodeIndex.get(nodeId)
				?.children?.map((c) => c.id) ?? []
		);
	}

	function openNodeMenu(nodeId: string): NodeFocusRequest[] {
		seedSchema();
		const seen = captureRequests();
		render(<NodeHarness nodeId={nodeId} />);
		openMenu(screen.getByTestId("trigger"));
		return seen;
	}

	function openCanvasMenu(): NodeFocusRequest[] {
		seedSchema();
		const seen = captureRequests();
		render(<CanvasHarness />);
		openMenu(screen.getByTestId("trigger"));
		return seen;
	}

	const CREATED = { align: "center", select: false, rename: true };

	it("Rename reveals the node in place and opens its input", () => {
		const seen = openNodeMenu("child-1");

		clickItem(/node actions/i, "Rename");

		expect(seen).toEqual([
			{ nodeId: "child-1", align: "nearest", select: false, rename: true },
		]);
		expect(useRoadmapStore.getState().focusedNodeId).toBe("child-1");
	});

	it.each([
		[
			"Add Child",
			/node actions/i,
			() => openNodeMenu("child-1"),
			() => childIdsOf("child-1")[0],
		],
		[
			"Add Sibling Above",
			/node actions/i,
			() => openNodeMenu("child-1"),
			() => childIdsOf("root-id")[0],
		],
		[
			"Add Sibling Below",
			/node actions/i,
			() => openNodeMenu("child-1"),
			() => childIdsOf("root-id")[1],
		],
		[
			"Duplicate",
			/node actions/i,
			() => openNodeMenu("child-1"),
			() => childIdsOf("root-id")[1],
		],
		[
			"Add Root Child",
			/canvas actions/i,
			() => openCanvasMenu(),
			() => childIdsOf("root-id")[1],
		],
	] as const)("%s centres the new node and renames it", (label, menuName, open, expectedId) => {
		const seen = open();

		clickItem(menuName, label);

		expect(seen).toEqual([{ nodeId: expectedId(), ...CREATED }]);
		expect(useRoadmapStore.getState().focusedNodeId).toBe(seen[0].nodeId);
	});
});

// v0.8.1 Phase 5 (D3): ONE "Fit to View". The item used to call `resetView`,
// a fixed camera derived from window.innerWidth — never a fit.
describe("Canvas menu — Fit to View", () => {
	it("asks the store to fit the whole tree", () => {
		seedSchema();
		const fitView = vi.spyOn(useRoadmapStore.getState(), "fitView");
		render(<CanvasHarness />);
		openMenu(screen.getByTestId("trigger"));
		const menu = screen.getByRole("menu", { name: /canvas actions/i });
		const item = Array.from(
			menu.querySelectorAll<HTMLElement>('[role="menuitem"]'),
		).find((el) => el.textContent?.includes("Fit to View"));

		fireEvent.click(item as HTMLElement);

		expect(fitView).toHaveBeenCalledTimes(1);
	});
});

// v0.8.1 Phase 5: a menu that closes without an action used to leave
// `document.activeElement` on `<body>` — `onCloseAutoFocus` is prevented (it
// would restore focus to the element that had it when the Content mounted,
// which for a create item is the OLD card, cancelling the new node's pending
// rename). The close therefore hands focus back itself, one frame later, as an
// `align: "none"` request so the canvas controller's never-steal guard decides
// and a "Fit to View" animation is not disturbed.
describe("RoadRavenContextMenu — focus after a plain close", () => {
	it("asks the canvas to take its card back when Escape closes the menu", async () => {
		seedSchema();
		useRoadmapStore.getState().setFocusedNode("child-1");
		const seen = captureRequests();
		render(<NodeHarness nodeId="child-1" />);
		openMenu(screen.getByTestId("trigger"));
		const menu = screen.getByRole("menu", { name: /node actions/i });

		fireEvent.keyDown(document.activeElement ?? menu, { key: "Escape" });

		await waitFor(() => expect(seen).toHaveLength(1));
		expect(seen[0]).toEqual({
			nodeId: "child-1",
			align: "none",
			select: false,
			rename: false,
		});
	});

	it("stands down when the item that closed it already stated an intent", async () => {
		seedSchema();
		useRoadmapStore.getState().setFocusedNode("child-1");
		const seen = captureRequests();
		render(<NodeHarness nodeId="child-1" />);
		openMenu(screen.getByTestId("trigger"));
		const menu = screen.getByRole("menu", { name: /node actions/i });
		const addChild = Array.from(
			menu.querySelectorAll<HTMLElement>('[role="menuitem"]'),
		).find((el) => el.textContent?.startsWith("Add Child"));

		fireEvent.click(addChild as HTMLElement);
		await waitFor(() => expect(seen).toHaveLength(1));
		await nextFrame();

		// Only the create's own centre+rename request: a restore here would
		// supersede it and the new node would never get its input.
		expect(seen).toHaveLength(1);
		expect(seen[0].rename).toBe(true);
	});
});

describe("Canvas menu — Paste inserts under root, not as a second root", () => {
	it("paste from canvas background inserts under the existing root and keeps schema.nodes.length = 1", async () => {
		seedSchema();
		useRoadmapStore.setState({
			lastCopiedSubtree: {
				id: "copied-id",
				title: "Pasted",
				status: "not-started",
			},
		});
		const spy = vi.spyOn(useRoadmapStore.getState(), "pasteFromClipboard");
		render(<CanvasHarness />);
		openMenu(screen.getByTestId("trigger"));
		const menu = screen.getByRole("menu", { name: /canvas actions/i });
		const pasteItem = Array.from(
			menu.querySelectorAll<HTMLElement>('[role="menuitem"]'),
		).find((el) => el.textContent?.includes("Paste"));
		fireEvent.click(pasteItem as HTMLElement);
		// Must be rootId, not null — null appends a second root that is
		// silently dropped from treeData (only nodes[0] renders).
		expect(spy).toHaveBeenCalledWith("root-id");
	});

	it("disables Paste when there is no schema, even with a buffered subtree", () => {
		useRoadmapStore.setState({
			lastCopiedSubtree: {
				id: "copied-id",
				title: "P",
				status: "not-started",
			},
		});
		render(<CanvasHarness />);
		openMenu(screen.getByTestId("trigger"));
		const menu = screen.getByRole("menu", { name: /canvas actions/i });
		const pasteItem = Array.from(
			menu.querySelectorAll<HTMLElement>('[role="menuitem"]'),
		).find((el) => el.textContent?.includes("Paste"));
		expect(pasteItem?.getAttribute("aria-disabled")).toBe("true");
	});
});

// v0.8.4 Phase 4 — collapse state is read from fileViewStore (not a DOM
// chevron snapshot), and the canvas-empty menu carries the tree-wide items.
describe("RoadRavenContextMenu — collapse (Phase 4)", () => {
	afterEach(() => {
		useFileViewStore.getState().expandAll();
	});

	function menuItem(menu: HTMLElement, label: string): HTMLElement {
		const item = Array.from(
			menu.querySelectorAll<HTMLElement>('[role="menuitem"]'),
		).find((el) => el.querySelector("span")?.textContent === label);
		if (!item) throw new Error(`no menu item "${label}"`);
		return item;
	}

	it("the node item reads the store: Expand subtree on a collapsed node, and it writes the store", () => {
		seedSchema();
		useFileViewStore.getState().setCollapsed("root-id", true);
		render(<NodeHarness />);
		openMenu(screen.getByTestId("trigger"));
		const menu = screen.getByRole("menu", { name: /node actions/i });

		fireEvent.click(menuItem(menu, CHEVRON_EXPAND_LABEL));

		expect(useFileViewStore.getState().collapsedIds.has("root-id")).toBe(false);
	});

	it("a leaf gets no collapse item", () => {
		seedSchema();
		render(<NodeHarness nodeId="child-1" />);
		openMenu(screen.getByTestId("trigger"));
		const menu = screen.getByRole("menu", { name: /node actions/i });
		expect(menu.textContent).not.toMatch(/subtree/);
	});

	it.each([
		[EXPAND_ALL_LABEL, "expandAll", []],
		[COLLAPSE_ALL_LABEL, "collapseAll", [["root-id"]]],
	] as const)("canvas item %s calls the store's %s", (label, action, args) => {
		seedSchema();
		// Stubbed: a real write would copy the spy into the next state object,
		// out of reach of restoreAllMocks.
		const spy = vi
			.spyOn(useFileViewStore.getState(), action)
			.mockImplementation(() => undefined);
		render(<CanvasHarness />);
		openMenu(screen.getByTestId("trigger"));
		const menu = screen.getByRole("menu", { name: /canvas actions/i });

		fireEvent.click(menuItem(menu, label));

		expect(spy).toHaveBeenCalledTimes(1);
		expect(spy.mock.calls[0]).toEqual(args);
	});

	it.each([
		1, 2,
	])("canvas item Collapse to depth %i calls collapseToDepth with the file's nodes", (depth) => {
		seedSchema();
		const spy = vi
			.spyOn(useFileViewStore.getState(), "collapseToDepth")
			.mockImplementation(() => undefined);
		render(<CanvasHarness />);
		openMenu(screen.getByTestId("trigger"));
		const menu = screen.getByRole("menu", { name: /canvas actions/i });

		fireEvent.click(menuItem(menu, collapseToDepthLabel(depth)));

		expect(spy).toHaveBeenCalledTimes(1);
		expect(spy.mock.calls[0]).toEqual([
			depth,
			useRoadmapStore.getState().schema?.nodes,
		]);
	});
});

// v0.8.4 Phase 5 — Indent/Outdent items follow the same no-op rules as the
// Alt+arrow shortcuts (lib/treeEdits.ts).
function seedNestedSchema() {
	useRoadmapStore.getState().loadSchema(
		{
			version: "1",
			title: "Test",
			nodes: [
				{
					id: "root-id",
					title: "Root",
					status: "not-started" as const,
					children: [
						{
							id: "child-1",
							title: "Child 1",
							status: "not-started" as const,
							children: [
								{
									id: "grandchild-1",
									title: "Grandchild 1",
									status: "not-started" as const,
								},
							],
						},
						{
							id: "child-2",
							title: "Child 2",
							status: "not-started" as const,
						},
					],
				},
			],
		},
		"/tmp/test.json",
	);
}

describe("RoadRavenContextMenu — indent/outdent (Phase 5)", () => {
	it("both items are disabled on a node with no previous sibling and a root-level parent", () => {
		seedSchema();
		render(<NodeHarness nodeId="child-1" />);
		openMenu(screen.getByTestId("trigger"));
		const menu = screen.getByRole("menu", { name: /node actions/i });
		const indentItem = Array.from(
			menu.querySelectorAll<HTMLElement>('[role="menuitem"]'),
		).find((el) => el.textContent === INDENT_LABEL);
		const outdentItem = Array.from(
			menu.querySelectorAll<HTMLElement>('[role="menuitem"]'),
		).find((el) => el.textContent === OUTDENT_LABEL);
		expect(indentItem?.getAttribute("aria-disabled")).toBe("true");
		expect(outdentItem?.getAttribute("aria-disabled")).toBe("true");
	});

	it("Indent is enabled and calls indentNode when a previous sibling exists", () => {
		seedNestedSchema();
		const spy = vi.spyOn(useRoadmapStore.getState(), "indentNode");
		render(<NodeHarness nodeId="child-2" />);
		openMenu(screen.getByTestId("trigger"));
		const menu = screen.getByRole("menu", { name: /node actions/i });
		const indentItem = Array.from(
			menu.querySelectorAll<HTMLElement>('[role="menuitem"]'),
		).find((el) => el.textContent === INDENT_LABEL);
		expect(indentItem?.getAttribute("aria-disabled")).not.toBe("true");
		fireEvent.click(indentItem as HTMLElement);
		expect(spy).toHaveBeenCalledWith("child-2");
	});

	it("Outdent is enabled and calls outdentNode when a grandparent exists", () => {
		seedNestedSchema();
		const spy = vi.spyOn(useRoadmapStore.getState(), "outdentNode");
		render(<NodeHarness nodeId="grandchild-1" />);
		openMenu(screen.getByTestId("trigger"));
		const menu = screen.getByRole("menu", { name: /node actions/i });
		const outdentItem = Array.from(
			menu.querySelectorAll<HTMLElement>('[role="menuitem"]'),
		).find((el) => el.textContent === OUTDENT_LABEL);
		expect(outdentItem?.getAttribute("aria-disabled")).not.toBe("true");
		fireEvent.click(outdentItem as HTMLElement);
		expect(spy).toHaveBeenCalledWith("grandchild-1");
	});
});

// v0.8.4 Phase 6 — Undo/Redo on the canvas-empty menu, disabled exactly when
// the matching stack is empty.
describe("Canvas menu — Undo / Redo (Phase 6)", () => {
	afterEach(() => {
		useHistoryStore.getState().clear();
	});

	function canvasItem(label: string): HTMLElement {
		render(<CanvasHarness />);
		openMenu(screen.getByTestId("trigger"));
		const menu = screen.getByRole("menu", { name: /canvas actions/i });
		const item = Array.from(
			menu.querySelectorAll<HTMLElement>('[role="menuitem"]'),
		).find((el) => el.querySelector("span")?.textContent === label);
		if (!item) throw new Error(`no menu item "${label}"`);
		return item;
	}

	it.each([
		UNDO_LABEL,
		REDO_LABEL,
	])("%s is disabled with an empty history", (label) => {
		seedSchema();
		expect(canvasItem(label).getAttribute("aria-disabled")).toBe("true");
	});

	it("Undo is enabled after an edit, reverts it and reveals the node", () => {
		seedSchema();
		useRoadmapStore.getState().renameNode("child-1", "Renamed");
		const seen = captureRequests();
		const item = canvasItem(UNDO_LABEL);
		expect(item.getAttribute("aria-disabled")).not.toBe("true");
		fireEvent.click(item);
		expect(useRoadmapStore.getState().nodeIndex.get("child-1")?.title).toBe(
			"Child 1",
		);
		expect(seen).toEqual([
			{ nodeId: "child-1", align: "nearest", select: true, rename: false },
		]);
	});

	it("Redo is enabled after an undo and re-applies the edit", () => {
		seedSchema();
		useRoadmapStore.getState().renameNode("child-1", "Renamed");
		useRoadmapStore.getState().undo();
		const item = canvasItem(REDO_LABEL);
		expect(item.getAttribute("aria-disabled")).not.toBe("true");
		fireEvent.click(item);
		expect(useRoadmapStore.getState().nodeIndex.get("child-1")?.title).toBe(
			"Renamed",
		);
	});
});
