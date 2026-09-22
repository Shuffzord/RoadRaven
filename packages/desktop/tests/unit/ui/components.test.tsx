// @vitest-environment jsdom

import fs from "node:fs";
import path from "node:path";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RoadmapSchema } from "../../../../../packages/core/src/schema";
import { resetStore } from "../../helpers/resetStore";

// Mock the rpc module to prevent Electroview import
vi.mock("../../../src/mainview/rpc", () => ({
	electroview: {
		rpc: {
			request: {
				saveSettings: vi.fn(() => Promise.resolve({ success: true })),
				loadSettings: vi.fn(() => Promise.resolve({ settings: {} })),
			},
		},
	},
}));

import { RoadmapNodeCard } from "../../../src/mainview/components/RoadmapNode";
import { SidePanel } from "../../../src/mainview/components/SidePanel";
import { KEYBOARD_NAV_CLASS } from "../../../src/mainview/hooks/useKeyboardRouter";
import { FOCUS_NODE_EVENT } from "../../../src/mainview/lib/focusRequest";
import { CHEVRON_SELECTOR } from "../../../src/mainview/lib/nodeCollapse";
import { useRoadmapStore } from "../../../src/mainview/store/roadmapStore";

describe("RoadmapNodeCard", () => {
	it("renders title text", () => {
		render(<RoadmapNodeCard title="Test Node" status="in-progress" />);
		expect(screen.getByText("Test Node")).toBeTruthy();
	});

	it("renders status badge with text label", () => {
		render(<RoadmapNodeCard title="Test Node" status="in-progress" />);
		expect(screen.getByText("In Progress")).toBeTruthy();
	});

	it("sets --node-stripe-color CSS variable matching status", () => {
		const { container } = render(
			<RoadmapNodeCard title="Test Node" status="completed" />,
		);
		const node = container.querySelector(".node");
		expect(node).toBeTruthy();
		const style = node?.getAttribute("style") ?? "";
		expect(style).toContain("--node-stripe-color");
		expect(style).toContain("--rv-status-completed");
	});

	it("sets --badge-color and --badge-bg CSS variables", () => {
		const { container } = render(
			<RoadmapNodeCard title="Test Node" status="blocked" />,
		);
		const node = container.querySelector(".node");
		const style = node?.getAttribute("style") ?? "";
		expect(style).toContain("--badge-color");
		expect(style).toContain("--badge-bg");
		expect(style).toContain("--rv-status-blocked");
		expect(style).toContain("--rv-status-blocked-bg");
	});

	// Screen readers announce aria-label verbatim. UUIDs are meaningless noise
	// to a human listener, so the label must not leak the internal node id.
	it("aria-label contains the title only — no UUID substring", () => {
		const nodeId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
		render(
			<RoadmapNodeCard nodeId={nodeId} title="My Task" status="in-progress" />,
		);
		const card = screen.getByRole("treeitem");
		const label = card.getAttribute("aria-label") ?? "";
		expect(label).toBe("My Task");
		expect(label).not.toContain(nodeId);
	});
});

// v0.8.1 closing perf pass — .planning/v0.8.1-canvas-focus-PLAN.md,
// "Large-tree performance".
//
// react-d3-tree rebuilds its `subscriptions` object on every Tree render, so
// every mounted node re-runs `renderCustomNodeElement` whenever Canvas
// renders. On a 1400-node tree that was 1400 card bodies per pan frame, per
// typed character and per right-click. The card is memoised with a comparator
// that ignores callback identity, because Canvas necessarily recreates
// `onSelect`/`onDoubleClick` on every render and they close over nothing but
// `nodeId`.
describe("RoadmapNodeCard — memoised body", () => {
	it("skips the re-render when only a callback identity changed", () => {
		const first = vi.fn();
		const second = vi.fn();
		const { rerender } = render(
			<RoadmapNodeCard
				nodeId="memo-1"
				title="Stable"
				status="not-started"
				onSelect={first}
			/>,
		);
		rerender(
			<RoadmapNodeCard
				nodeId="memo-1"
				title="Stable"
				status="not-started"
				onSelect={second}
			/>,
		);
		// The skipped render kept the first closure wired to the card. Both
		// callbacks do the same thing (they only capture `nodeId`), which is
		// precisely why identity may be ignored.
		fireEvent.click(screen.getByRole("treeitem"));
		expect(first).toHaveBeenCalledTimes(1);
		expect(second).not.toHaveBeenCalled();
	});

	it("re-renders when a value prop changed", () => {
		const { rerender } = render(
			<RoadmapNodeCard nodeId="memo-1" title="Before" status="not-started" />,
		);
		rerender(
			<RoadmapNodeCard nodeId="memo-1" title="After" status="not-started" />,
		);
		expect(screen.getByText("After")).toBeTruthy();
	});

	it("re-renders when the prop set gains a key", () => {
		const { rerender } = render(
			<RoadmapNodeCard nodeId="memo-1" title="Shape" status="not-started" />,
		);
		rerender(
			<RoadmapNodeCard
				nodeId="memo-1"
				title="Shape"
				status="not-started"
				isSelected
			/>,
		);
		expect(screen.getByRole("treeitem").getAttribute("data-selected")).toBe(
			"true",
		);
	});
});

// v0.8.1 Phase 3 (RC8 + the scroll hazard) —
// .planning/v0.8.1-canvas-focus-PLAN.md.
//
// Logical focus (`focusedNodeId`) and DOM focus used to be two unrelated
// things: every card was `tabIndex={0}`, arrow keys only moved the store, and
// a rename commit dropped DOM focus on `<body>`. The card's half of the fix is
// the WAI-ARIA roving tabindex, an `onFocus` that keeps the store honest about
// natively-arriving focus, and `preventScroll` on every focus() it issues
// (a plain focus() scrolls the canvas container — P0-6a/b).
describe("RoadmapNodeCard — roving tabindex and DOM focus (RC8)", () => {
	const ROOT_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
	const CHILD_ID = "11111111-2222-4333-8444-555555555555";

	const SCHEMA: RoadmapSchema = {
		version: "1.0",
		title: "Card focus fixture",
		nodes: [
			{
				id: ROOT_ID,
				title: "Root",
				status: "not-started",
				children: [{ id: CHILD_ID, title: "Child", status: "not-started" }],
			},
		],
	};

	beforeEach(() => {
		useRoadmapStore.getState().loadSchema(SCHEMA, "/tmp/cards.json");
	});

	afterEach(() => {
		document.body.classList.remove(KEYBOARD_NAV_CLASS);
		vi.restoreAllMocks();
		resetStore();
	});

	it("is the single tab stop when isTabStop is set", () => {
		render(
			<RoadmapNodeCard
				nodeId={CHILD_ID}
				title="Child"
				status="not-started"
				isTabStop
			/>,
		);
		expect(screen.getByRole("treeitem").getAttribute("tabindex")).toBe("0");
	});

	it("leaves the tab order when another card is the tab stop", () => {
		render(
			<RoadmapNodeCard nodeId={CHILD_ID} title="Child" status="not-started" />,
		);
		expect(screen.getByRole("treeitem").getAttribute("tabindex")).toBe("-1");
	});

	// BUG-1 (a11y walkthrough 2026-05-04): only the treeitem is tabbable, never
	// the chevron. Roving tabindex must not resurrect it.
	it("keeps the chevron out of the tab order even on the tab stop", () => {
		render(
			<RoadmapNodeCard
				nodeId={ROOT_ID}
				title="Root"
				status="not-started"
				hasChildren
				isTabStop
			/>,
		);
		expect(
			screen.getByLabelText("Collapse subtree").getAttribute("tabindex"),
		).toBe("-1");
	});

	it("syncs logical focus when focus arrives natively", () => {
		render(
			<RoadmapNodeCard nodeId={CHILD_ID} title="Child" status="not-started" />,
		);
		expect(useRoadmapStore.getState().focusedNodeId).toBeNull();

		fireEvent.focus(screen.getByRole("treeitem"));

		expect(useRoadmapStore.getState().focusedNodeId).toBe(CHILD_ID);
	});

	// The controller focuses the card it just revealed, so onFocus fires on a
	// card that is ALREADY the logical target. Re-announcing it would cancel
	// the very request that is mid-reveal.
	it("does not re-announce a card that is already the logical focus", () => {
		useRoadmapStore.getState().setFocusedNode(CHILD_ID);
		const requests = vi.fn();
		window.addEventListener(FOCUS_NODE_EVENT, requests);
		render(
			<RoadmapNodeCard nodeId={CHILD_ID} title="Child" status="not-started" />,
		);

		fireEvent.focus(screen.getByRole("treeitem"));

		expect(requests).not.toHaveBeenCalled();
		window.removeEventListener(FOCUS_NODE_EVENT, requests);
	});

	/** Collect the `align` of every focus request a case produces. */
	function recordAligns(): { aligns: string[]; stop: () => void } {
		const aligns: string[] = [];
		const listener = (e: Event): void => {
			aligns.push((e as CustomEvent<{ align: string }>).detail.align);
		};
		window.addEventListener(FOCUS_NODE_EVENT, listener);
		return {
			aligns,
			stop: () => window.removeEventListener(FOCUS_NODE_EVENT, listener),
		};
	}

	it("never pans on a pointer-originated focus", () => {
		const rec = recordAligns();
		render(
			<RoadmapNodeCard nodeId={CHILD_ID} title="Child" status="not-started" />,
		);

		fireEvent.focus(screen.getByRole("treeitem"));

		// A pointer focus lands BEFORE the click handler's own `nearest` +
		// `select` request; a camera move here would be the double-pan RC3
		// removed — and the user can see what they clicked anyway.
		expect(rec.aligns).toEqual(["none"]);
		rec.stop();
	});

	// Tab can put focus on a card the camera never went to, and `overflow: clip`
	// means the browser will not scroll it into view either.
	it("reveals the card when focus arrives from the keyboard", () => {
		document.body.classList.add(KEYBOARD_NAV_CLASS);
		const rec = recordAligns();
		render(
			<RoadmapNodeCard nodeId={CHILD_ID} title="Child" status="not-started" />,
		);

		fireEvent.focus(screen.getByRole("treeitem"));

		expect(rec.aligns).toEqual(["nearest"]);
		expect(useRoadmapStore.getState().focusedNodeId).toBe(CHILD_ID);
		rec.stop();
	});

	// Tabbing back to a card that is ALREADY the logical target still has to
	// bring it on screen — the "already focused" short-circuit is for the
	// pointer path only.
	it("reveals an already-focused card when the keyboard tabs back to it", () => {
		useRoadmapStore.getState().setFocusedNode(CHILD_ID);
		document.body.classList.add(KEYBOARD_NAV_CLASS);
		const rec = recordAligns();
		render(
			<RoadmapNodeCard nodeId={CHILD_ID} title="Child" status="not-started" />,
		);

		fireEvent.focus(screen.getByRole("treeitem"));

		expect(rec.aligns).toEqual(["nearest"]);
		rec.stop();
	});

	it("focuses the rename input without scrolling the canvas (P0-6a)", () => {
		const focus = vi.spyOn(HTMLElement.prototype, "focus");
		render(
			<RoadmapNodeCard
				nodeId={CHILD_ID}
				title="Child"
				status="not-started"
				isRenaming
				renameValue="Child"
			/>,
		);

		expect(focus).toHaveBeenCalledWith({ preventScroll: true });
		focus.mockRestore();
	});

	// A8: Enter and Escape put focus back on the card. A blur-commit must not —
	// a blur means the user clicked something else.
	it.each(["Enter", "Escape"] as const)("restores card focus on %s", (key) => {
		const { container } = render(
			<RoadmapNodeCard
				nodeId={CHILD_ID}
				title="Child"
				status="not-started"
				isRenaming
				renameValue="Child"
			/>,
		);
		const card = container.querySelector<HTMLElement>(".node");
		if (!card) throw new Error("no card");
		const focus = vi.spyOn(card, "focus");

		fireEvent.keyDown(screen.getByLabelText("Rename node"), { key });

		expect(focus).toHaveBeenCalledWith({ preventScroll: true });
		focus.mockRestore();
	});

	it("does not grab focus back when the rename is committed by a blur", () => {
		const { container } = render(
			<RoadmapNodeCard
				nodeId={CHILD_ID}
				title="Child"
				status="not-started"
				isRenaming
				renameValue="Child"
			/>,
		);
		const card = container.querySelector<HTMLElement>(".node");
		if (!card) throw new Error("no card");
		const focus = vi.spyOn(card, "focus");

		fireEvent.blur(screen.getByLabelText("Rename node"));

		expect(focus).not.toHaveBeenCalled();
		focus.mockRestore();
	});
});

// Test audit gap (2026-09-21): unit tests elsewhere fabricate the chevron
// contract (`aria-label="Expand subtree" | "Collapse subtree"`) as plain DOM
// they build by hand (e.g. useKeyboardRouter.test.ts's mountCardWithChevron).
// This pins it against the REAL rendered card, matched by the exact selector
// lib/nodeCollapse.ts drives every programmatic collapse through, so a
// selector or label drift here would be caught here rather than silently
// making those fabricated-DOM unit tests lie.
describe("RoadmapNodeCard — chevron contract (nodeCollapse.ts)", () => {
	it.each([
		[false, "Collapse subtree"],
		[true, "Expand subtree"],
	])("isCollapsed=%s renders a chevron matched by CHEVRON_SELECTOR with that aria-label", (isCollapsed, label) => {
		const { container } = render(
			<RoadmapNodeCard
				nodeId="node-1"
				title="Parent"
				status="not-started"
				hasChildren
				isCollapsed={isCollapsed}
			/>,
		);
		const chevron = container.querySelector(CHEVRON_SELECTOR);
		expect(chevron).not.toBeNull();
		expect(chevron?.getAttribute("aria-label")).toBe(label);
	});
});

describe("SidePanel", () => {
	it("renders field labels: STATUS, TYPE, CREATED, UPDATED, ID, NOTES", () => {
		// Set up store with a selected node so field labels render
		useRoadmapStore.getState().loadSchema(
			{
				version: "1.0",
				title: "Test",
				nodes: [
					{
						id: "test-node-1",
						title: "Test Node",
						status: "in-progress",
						type: "task",
						notes: "Some notes",
					},
				],
			},
			"test.json",
		);
		useRoadmapStore.getState().setSelectedNode("test-node-1");

		render(
			<SidePanel
				isOpen={true}
				onClose={() => {
					/* noop */
				}}
			/>,
		);
		for (const label of [
			"STATUS",
			"TYPE",
			"CREATED",
			"UPDATED",
			"ID",
			"NOTES",
		]) {
			expect(screen.getByText(label)).toBeTruthy();
		}

		// Clean up store state
		useRoadmapStore.getState().setSelectedNode(null);
	});

	it("close button has aria-label='Close panel'", () => {
		render(
			<SidePanel
				isOpen={true}
				onClose={() => {
					/* noop */
				}}
			/>,
		);
		expect(screen.getByLabelText("Close panel")).toBeTruthy();
	});

	it("renders in closed state (width 0) by default", () => {
		const { container } = render(
			<SidePanel
				isOpen={false}
				onClose={() => {
					/* noop */
				}}
			/>,
		);
		const panel = container.firstElementChild as HTMLElement;
		expect(panel.style.width).toBe("0px");
	});
});

describe("Hardcoded color check", () => {
	it("components contain zero hardcoded hex/rgb color values", () => {
		const componentsDir = path.resolve(
			__dirname,
			"../../../src/mainview/components",
		);
		// ThemePicker renders swatches previewing every available theme's palette,
		// so its hex constants are intentional data (not a theming violation).
		const THEME_PREVIEW_COMPONENTS = new Set([
			"ThemeOverrideProvider.tsx",
			"ThemePicker.tsx",
		]);
		const files = fs
			.readdirSync(componentsDir)
			.filter(
				(f: string) => f.endsWith(".tsx") && !THEME_PREVIEW_COMPONENTS.has(f),
			);
		const hexPattern = /#[0-9a-fA-F]{3,8}\b/;
		const rgbPattern = /rgb\(|rgba\(|hsl\(/;

		for (const file of files) {
			const content = fs.readFileSync(path.join(componentsDir, file), "utf-8");
			expect(hexPattern.test(content)).toBe(false);
			expect(rgbPattern.test(content)).toBe(false);
		}
	});
});
