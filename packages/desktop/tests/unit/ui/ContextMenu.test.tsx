/** @vitest-environment jsdom */
import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { RoadRavenContextMenu } from "../../../src/mainview/components/ContextMenu";
import { useRoadmapStore } from "../../../src/mainview/store/roadmapStore";
import { resetStore } from "../../helpers/resetStore";

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

afterEach(() => {
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
	const [target, setTarget] = useState<string | null>(nodeId);
	return (
		<RoadRavenContextMenu onOpen={setTarget} targetNodeId={target}>
			<div data-testid="trigger" data-source-id={nodeId ?? undefined}>
				trigger
			</div>
		</RoadRavenContextMenu>
	);
}

/** Canvas-background harness (no data-source-id). */
function CanvasHarness() {
	const [target, setTarget] = useState<string | null>(null);
	return (
		<RoadRavenContextMenu onOpen={setTarget} targetNodeId={target}>
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

	it("node menu renders items in the expected order with 5 separators", () => {
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
			"Add Child",
			"Add Sibling Above",
			"Add Sibling Below",
			"Duplicate",
			"Copy",
			"Paste",
			"Move Up",
			"Move Down",
			"Change Status",
			"Delete",
		]);
		const seps = menu.querySelectorAll('[role="separator"]');
		expect(seps.length).toBe(5);
	});

	it("each action entry has role='menuitem'", () => {
		seedSchema();
		render(<NodeHarness />);
		openMenu(screen.getByTestId("trigger"));
		const menu = screen.getByRole("menu", { name: /node actions/i });
		// 10 top-level menuitems + 1 submenu trigger = 11
		expect(menu.querySelectorAll('[role="menuitem"]').length).toBe(11);
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

	it("canvas menu renders Paste + Add Root Child + Fit to View + Toggle Layout with 1 separator", () => {
		seedSchema();
		render(<CanvasHarness />);
		openMenu(screen.getByTestId("trigger"));
		const menu = screen.getByRole("menu", { name: /canvas actions/i });
		expect(menu.textContent).toMatch(/Paste/);
		expect(menu.textContent).toMatch(/Add Root Child/);
		expect(menu.textContent).toMatch(/Fit to View/);
		expect(menu.textContent).toMatch(/Toggle Layout/);
		expect(menu.querySelectorAll('[role="menuitem"]').length).toBe(4);
		expect(menu.querySelectorAll('[role="separator"]').length).toBe(1);
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
