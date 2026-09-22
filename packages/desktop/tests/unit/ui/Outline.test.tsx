/** @vitest-environment jsdom */
// v0.8.2 Phase 3b — sidebar Outline (Navigator).
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RoadmapSchema } from "../../../../../packages/core/src/schema";
import {
	flattenOutline,
	Outline,
} from "../../../src/mainview/components/Outline";
import {
	FOCUS_NODE_EVENT,
	type NodeFocusRequest,
} from "../../../src/mainview/lib/focusRequest";
import { useRoadmapStore } from "../../../src/mainview/store/roadmapStore";
import { resetStore } from "../../helpers/resetStore";

const SCHEMA: RoadmapSchema = {
	version: "1.0",
	title: "Outline test",
	nodes: [
		{
			id: "root",
			title: "Root",
			status: "in-progress",
			children: [
				{
					id: "a",
					title: "Alpha",
					status: "completed",
					children: [{ id: "a1", title: "Alpha One", status: "blocked" }],
				},
				{ id: "b", title: "Beta", status: "not-started" },
			],
		},
		{ id: "root2", title: "Second root", status: "not-started" },
	],
};

/** Record every focus request the outline issues until the test ends. */
function captureRequests(): NodeFocusRequest[] {
	const seen: NodeFocusRequest[] = [];
	const listener = (e: Event): void => {
		seen.push((e as CustomEvent<NodeFocusRequest>).detail);
	};
	window.addEventListener(FOCUS_NODE_EVENT, listener);
	cleanups.push(() => window.removeEventListener(FOCUS_NODE_EVENT, listener));
	return seen;
}

const cleanups: Array<() => void> = [];
let scrollIntoView: ReturnType<typeof vi.fn>;

beforeEach(() => {
	// jsdom has no scrollIntoView; the selected row calls it on select.
	scrollIntoView = vi.fn();
	Element.prototype.scrollIntoView = scrollIntoView as never;
	useRoadmapStore.getState().loadSchema(SCHEMA, "/tmp/outline.json");
});

afterEach(() => {
	while (cleanups.length) cleanups.pop()?.();
	resetStore();
	vi.restoreAllMocks();
});

const rowByTitle = (title: string): HTMLElement =>
	screen.getByRole("treeitem", { name: title });

describe("flattenOutline", () => {
	it("walks every root in pre-order with depths", () => {
		const rows = flattenOutline(SCHEMA.nodes, new Set());
		expect(rows.map((r) => [r.node.id, r.depth])).toEqual([
			["root", 0],
			["a", 1],
			["a1", 2],
			["b", 1],
			["root2", 0],
		]);
	});

	it("prunes the subtree of a collapsed id but keeps the node itself", () => {
		const rows = flattenOutline(SCHEMA.nodes, new Set(["a"]));
		expect(rows.map((r) => r.node.id)).toEqual(["root", "a", "b", "root2"]);
	});
});

describe("Outline", () => {
	it("renders every node as a treeitem with aria-level, indent and dot colour", () => {
		render(<Outline collapsed={false} />);
		const tree = screen.getByRole("tree", { name: "Roadmap outline" });
		expect(tree.hasAttribute("data-outline-tree")).toBe(true);
		expect(screen.getAllByRole("treeitem")).toHaveLength(5);

		const a1 = rowByTitle("Alpha One");
		expect(a1.getAttribute("aria-level")).toBe("3");
		expect(a1.style.paddingLeft).toBe("38px");
		expect(a1.getAttribute("title")).toBe("Alpha One");
		expect(a1.getAttribute("aria-expanded")).toBeNull();

		const root = rowByTitle("Root");
		expect(root.getAttribute("aria-level")).toBe("1");
		expect(root.style.paddingLeft).toBe("14px");
		expect(root.getAttribute("aria-expanded")).toBe("true");

		const dot = (el: HTMLElement): string =>
			(el.querySelector("span[aria-hidden]") as HTMLElement).style
				.backgroundColor;
		expect(dot(root)).toBe("var(--rv-status-in-progress)");
		expect(dot(rowByTitle("Alpha"))).toBe("var(--rv-status-completed)");
		expect(dot(a1)).toBe("var(--rv-status-blocked)");
		expect(dot(rowByTitle("Beta"))).toBe("var(--rv-status-not-started)");
	});

	it("row click selects the node and asks the canvas for a centred reveal", () => {
		const seen = captureRequests();
		render(<Outline collapsed={false} />);
		fireEvent.click(rowByTitle("Beta"));
		const state = useRoadmapStore.getState();
		expect(state.selectedNodeId).toBe("b");
		expect(state.focusedNodeId).toBe("b");
		expect(seen).toEqual([
			{ nodeId: "b", align: "center", select: true, rename: false },
		]);
	});

	it("chevron click toggles collapse without selecting", () => {
		const seen = captureRequests();
		render(<Outline collapsed={false} />);
		const alpha = rowByTitle("Alpha");
		const chevron = alpha.querySelector("[data-outline-chevron]");
		if (!chevron) throw new Error("expected a chevron on a parent row");

		fireEvent.click(chevron);
		expect(screen.queryByRole("treeitem", { name: "Alpha One" })).toBeNull();
		expect(alpha.getAttribute("aria-expanded")).toBe("false");
		expect(useRoadmapStore.getState().selectedNodeId).toBeNull();
		expect(seen).toEqual([]);

		fireEvent.click(chevron);
		expect(rowByTitle("Alpha One")).toBeTruthy();
		expect(alpha.getAttribute("aria-expanded")).toBe("true");
	});

	it("highlights the selected row and scrolls it into view when selection changes elsewhere", () => {
		render(<Outline collapsed={false} />);
		expect(scrollIntoView).not.toHaveBeenCalled();

		act(() => useRoadmapStore.getState().setSelectedNode("a1"));

		const a1 = rowByTitle("Alpha One");
		expect(a1.getAttribute("aria-selected")).toBe("true");
		expect(a1.className).toContain("bg-rv-bg-hover");
		expect(rowByTitle("Root").getAttribute("aria-selected")).toBe("false");
		expect(scrollIntoView).toHaveBeenCalledTimes(1);
		expect(scrollIntoView.mock.instances[0]).toBe(a1);
		expect(scrollIntoView).toHaveBeenCalledWith({ block: "nearest" });
	});

	it("shows the empty state when no roadmap is open", () => {
		resetStore();
		render(<Outline collapsed={false} />);
		expect(screen.getByText("No roadmap open")).toBeTruthy();
		expect(screen.queryByRole("tree")).toBeNull();
	});

	it("renders nothing in the collapsed rail", () => {
		const { container } = render(<Outline collapsed={true} />);
		expect(container.innerHTML).toBe("");
	});
});
