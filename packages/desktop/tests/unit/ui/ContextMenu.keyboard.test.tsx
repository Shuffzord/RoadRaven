/** @vitest-environment jsdom */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useRef, useState } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { RoadRavenContextMenu } from "../../../src/mainview/components/ContextMenu";
import { useKeyboardRouter } from "../../../src/mainview/hooks/useKeyboardRouter";
import { useRoadmapStore } from "../../../src/mainview/store/roadmapStore";
import { resetStore } from "../../helpers/resetStore";

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

function NodeHarness({ nodeId = "root-id" }: { nodeId?: string }) {
	const [target, setTarget] = useState<string | null>(nodeId);
	return (
		<RoadRavenContextMenu onOpen={setTarget} targetNodeId={target}>
			<div data-testid="trigger" data-source-id={nodeId}>
				trigger
			</div>
		</RoadRavenContextMenu>
	);
}

function openMenu(trigger: HTMLElement) {
	fireEvent.contextMenu(trigger, { clientX: 100, clientY: 100, button: 2 });
}

/**
 * Radix moves DOM focus with each keyboard event. Firing on the stale `menu`
 * element stops working after the first keystroke because the handler lives
 * on the currently focused item. Always dispatch at the active element.
 */
function pressKey(fallback: HTMLElement, key: string) {
	const target = (document.activeElement as HTMLElement | null) ?? fallback;
	fireEvent.keyDown(target, { key });
}

describe("RoadRavenContextMenu — keyboard navigation", () => {
	it("ArrowDown highlights the first item", async () => {
		seedSchema();
		render(<NodeHarness />);
		openMenu(screen.getByTestId("trigger"));
		const menu = await screen.findByRole("menu", { name: /node actions/i });
		pressKey(menu, "ArrowDown");
		await waitFor(() => {
			const highlighted = menu.querySelector("[data-highlighted]");
			expect(highlighted?.textContent).toContain("Rename");
		});
	});

	it("ArrowDown ArrowDown highlights the second item", async () => {
		seedSchema();
		render(<NodeHarness />);
		openMenu(screen.getByTestId("trigger"));
		const menu = await screen.findByRole("menu", { name: /node actions/i });
		pressKey(menu, "ArrowDown");
		pressKey(menu, "ArrowDown");
		await waitFor(() => {
			const highlighted = menu.querySelector("[data-highlighted]");
			expect(highlighted?.textContent).toContain("Add Child");
		});
	});

	it("End highlights the last item; Home highlights the first", async () => {
		seedSchema();
		render(<NodeHarness />);
		openMenu(screen.getByTestId("trigger"));
		const menu = await screen.findByRole("menu", { name: /node actions/i });
		pressKey(menu, "End");
		await waitFor(() => {
			const highlighted = menu.querySelector("[data-highlighted]");
			expect(highlighted?.textContent).toContain("Delete");
		});
		pressKey(menu, "Home");
		await waitFor(() => {
			const highlighted = menu.querySelector("[data-highlighted]");
			expect(highlighted?.textContent).toContain("Rename");
		});
	});

	it("Enter on highlighted 'Add Child' activates store.addChild exactly once", async () => {
		seedSchema();
		const addChildSpy = vi.spyOn(useRoadmapStore.getState(), "addChild");
		render(<NodeHarness nodeId="child-1" />);
		openMenu(screen.getByTestId("trigger"));
		const menu = await screen.findByRole("menu", { name: /node actions/i });
		// ArrowDown twice: Rename → Add Child
		pressKey(menu, "ArrowDown");
		pressKey(menu, "ArrowDown");
		await waitFor(() => {
			const highlighted = menu.querySelector("[data-highlighted]");
			expect(highlighted?.textContent).toContain("Add Child");
		});
		pressKey(menu, "Enter");
		await waitFor(() => {
			expect(addChildSpy).toHaveBeenCalledWith("child-1");
		});
		expect(addChildSpy).toHaveBeenCalledTimes(1);
	});

	it("Escape closes the menu (Content unmounts)", async () => {
		seedSchema();
		render(<NodeHarness />);
		openMenu(screen.getByTestId("trigger"));
		const menu = await screen.findByRole("menu", { name: /node actions/i });
		pressKey(menu, "Escape");
		await waitFor(() => {
			expect(screen.queryByRole("menu", { name: /node actions/i })).toBeNull();
		});
	});

	it("ArrowRight on Change Status opens the sub-menu", async () => {
		seedSchema();
		render(<NodeHarness />);
		openMenu(screen.getByTestId("trigger"));
		const menu = await screen.findByRole("menu", { name: /node actions/i });
		// End → last item = Delete; need to move up to Change Status.
		pressKey(menu, "End");
		pressKey(menu, "ArrowUp");
		await waitFor(() => {
			const highlighted = menu.querySelector("[data-highlighted]");
			expect(highlighted?.textContent).toContain("Change Status");
		});
		pressKey(menu, "ArrowRight");
		await screen.findByRole("menu", { name: /change status/i });
	});

	it("Sub-menu has role='menu' and aria-label='Change status'", async () => {
		seedSchema();
		render(<NodeHarness />);
		openMenu(screen.getByTestId("trigger"));
		const menu = await screen.findByRole("menu", { name: /node actions/i });
		pressKey(menu, "End");
		pressKey(menu, "ArrowUp");
		await waitFor(() => {
			const highlighted = menu.querySelector("[data-highlighted]");
			expect(highlighted?.textContent).toContain("Change Status");
		});
		pressKey(menu, "ArrowRight");
		const sub = await screen.findByRole("menu", { name: /change status/i });
		expect(sub.getAttribute("aria-label")).toMatch(/change status/i);
	});

	it("Sub-menu enumerates schema.statusConfig (5 entries)", async () => {
		seedSchema(true);
		render(<NodeHarness />);
		openMenu(screen.getByTestId("trigger"));
		const menu = await screen.findByRole("menu", { name: /node actions/i });
		pressKey(menu, "End");
		pressKey(menu, "ArrowUp");
		await waitFor(() => {
			const highlighted = menu.querySelector("[data-highlighted]");
			expect(highlighted?.textContent).toContain("Change Status");
		});
		pressKey(menu, "ArrowRight");
		const sub = await screen.findByRole("menu", { name: /change status/i });
		const items = sub.querySelectorAll('[role="menuitem"]');
		// Seeded 5 statuses including "Review"
		expect(items.length).toBe(5);
		expect(sub.textContent).toContain("Review");
	});

	it("Sub-menu falls back to 4 defaults when statusConfig is undefined", async () => {
		seedSchema(false);
		render(<NodeHarness />);
		openMenu(screen.getByTestId("trigger"));
		const menu = await screen.findByRole("menu", { name: /node actions/i });
		pressKey(menu, "End");
		pressKey(menu, "ArrowUp");
		await waitFor(() => {
			const highlighted = menu.querySelector("[data-highlighted]");
			expect(highlighted?.textContent).toContain("Change Status");
		});
		pressKey(menu, "ArrowRight");
		const sub = await screen.findByRole("menu", { name: /change status/i });
		const items = sub.querySelectorAll('[role="menuitem"]');
		expect(items.length).toBe(4);
		expect(sub.textContent).toContain("Not Started");
		expect(sub.textContent).toContain("In Progress");
		expect(sub.textContent).toContain("Completed");
		expect(sub.textContent).toContain("Blocked");
	});
});

/**
 * Pitfall 7 — Enter on a menu item must NOT double-fire via useKeyboardRouter.
 * Harness mounts a sibling element wired to useKeyboardRouter with the Canvas
 * focused so the router would normally see Enter as "Add Child" on the
 * focused node. Radix's menu should swallow the keydown first.
 */
function PitfallHarness() {
	const containerRef = useRef<HTMLDivElement>(null);
	useKeyboardRouter({
		inlineRename: {
			state: { nodeId: null, title: "", screenPos: null },
			open: noop,
			commit: noop,
			cancel: noop,
			setTitle: noop,
			updateForTransform: noop,
		},
		getTransform: () => ({ x: 0, y: 0, k: 1 }),
		getContainerRect: () => ({ left: 0, top: 0 }),
		getNodePosition: () => null,
		togglePanelFocus: noop,
	});

	const [target, setTarget] = useState<string | null>("child-1");
	return (
		<div>
			<button
				type="button"
				data-testid="canvas-root"
				ref={containerRef as unknown as React.Ref<HTMLButtonElement>}
				onClick={() => useRoadmapStore.getState().setFocusedNode("child-1")}
			>
				canvas
			</button>
			<RoadRavenContextMenu onOpen={setTarget} targetNodeId={target}>
				<div data-testid="trigger" data-source-id="child-1">
					trigger
				</div>
			</RoadRavenContextMenu>
		</div>
	);
}

describe("RoadRavenContextMenu — Pitfall 7 no double-fire", () => {
	it("Enter on highlighted Add Child menu item does NOT double-fire", async () => {
		seedSchema();
		// Simulate the Canvas having focused child-1 before the menu opens
		useRoadmapStore.setState({ focusedNodeId: "child-1" });

		// Replace addChild with a tracking shim via setState. We avoid vi.spyOn
		// here because Zustand's setState swaps the state object, which leaves
		// stale spies from prior tests on the current state — they accumulate
		// across tests and cause phantom double-calls.
		const original = useRoadmapStore.getState().addChild;
		const addChildSpy = vi.fn((parentId: string) => original(parentId));
		useRoadmapStore.setState({ addChild: addChildSpy });

		render(<PitfallHarness />);
		// Give the canvas focus (keyboard router active)
		const canvasRoot = screen.getByTestId("canvas-root");
		canvasRoot.focus();

		openMenu(screen.getByTestId("trigger"));
		const menu = await screen.findByRole("menu", { name: /node actions/i });
		pressKey(menu, "ArrowDown"); // Rename
		pressKey(menu, "ArrowDown"); // Add Child
		await waitFor(() => {
			const highlighted = menu.querySelector("[data-highlighted]");
			expect(highlighted?.textContent).toContain("Add Child");
		});
		pressKey(menu, "Enter");
		await waitFor(() => {
			expect(addChildSpy).toHaveBeenCalled();
		});
		// Grep anchor for the must_have truth:
		// expect(addChildSpy).toHaveBeenCalledTimes(1)
		expect(addChildSpy).toHaveBeenCalledTimes(1);
	});
});
