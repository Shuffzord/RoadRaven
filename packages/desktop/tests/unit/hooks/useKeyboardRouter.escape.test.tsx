// @vitest-environment jsdom
// Plan 04-06 Task 2 sub-edit F — Escape handler focus-containment behavior tests.
// Sources: D-06/D-18 in 04-CONTEXT.md, UAT 04-06 drive-by fix.
//
// The router-contract test in EventLogDrawer.test.tsx only checks that the
// role/aria-label selector resolves. This file exercises the actual branch:
//   - inside-drawer focus + Escape → drawer closes
//   - outside-drawer focus + Escape → drawer stays open + Phase 3 fall-through fires

import "@testing-library/jest-dom";
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { IntegrationEvent } from "../../../../../shared/types";
import { useKeyboardRouter } from "../../../src/mainview/hooks/useKeyboardRouter";
import { useEventApiStore } from "../../../src/mainview/store/eventApiStore";
import { useEventLogStore } from "../../../src/mainview/store/eventLogStore";
import { useRoadmapStore } from "../../../src/mainview/store/roadmapStore";

// Mock @tanstack/react-virtual to avoid jsdom infinite loop (matches EventLogDrawer.test.tsx).
vi.mock("@tanstack/react-virtual", () => ({
	useVirtualizer: ({
		count,
		estimateSize,
	}: {
		count: number;
		estimateSize: () => number;
	}) => {
		const itemHeight = estimateSize();
		const items = Array.from({ length: Math.min(count, 30) }, (_, i) => ({
			index: i,
			key: i,
			start: i * itemHeight,
			size: itemHeight,
		}));
		return {
			getVirtualItems: () => items,
			getTotalSize: () => count * itemHeight,
			measureElement: undefined,
		};
	},
}));

// Import drawer AFTER mock is set up
const { EventLogDrawer } = await import(
	"../../../src/mainview/components/EventLogDrawer"
);

// Stub deps shape — mirror the RouterDeps interface required by useKeyboardRouter.
// inlineRename.cancel + setSelectedNode are the spy targets for the fall-through assertions.
function makeStubDeps() {
	return {
		inlineRename: {
			state: { nodeId: null as string | null },
			cancel: vi.fn(),
			open: vi.fn(),
			commit: vi.fn(),
			update: vi.fn(),
		},
		getTransform: () => ({ x: 0, y: 0, k: 1 }),
		getContainerRect: () => ({ left: 0, top: 0 }),
		getNodePosition: () => null,
		isNodeVisible: () => true,
		togglePanelFocus: vi.fn(),
	};
}

function RouterHarness({ deps }: { deps: ReturnType<typeof makeStubDeps> }) {
	// Cast to RouterDeps — stub shape suffices for the Escape branch under test.
	useKeyboardRouter(deps as never);
	return null;
}

beforeEach(() => {
	// Drawer open + at least one row so the full-list branch renders the region
	act(() => {
		useEventLogStore.setState({
			rows: [],
			filter: { source: null, selectedNodeOnly: false, status: null },
			isOpen: true,
			drawerHeightPx: 300,
		});
		useEventApiStore.setState({
			status: "listening",
			port: 47921,
			connectedCount: 0,
			errorMessage: null,
		});
		useRoadmapStore.setState({ selectedNodeId: null });
		// Append at least one event so we hit the full-list branch (not empty state)
		useEventLogStore.getState().appendEvents([
			{
				nodeId: "n1",
				status: "in-progress",
				source: "test",
				timestamp: new Date().toISOString(),
			} as IntegrationEvent,
		]);
	});
});

afterEach(() => {
	act(() => {
		useEventLogStore.setState({
			rows: [],
			filter: { source: null, selectedNodeOnly: false, status: null },
			isOpen: false,
			drawerHeightPx: 300,
		});
	});
	vi.restoreAllMocks();
});

describe("useKeyboardRouter Escape branch (UAT 04-06 drive-by)", () => {
	it("Escape with focus inside drawer region closes the drawer", async () => {
		// Track state transitions via a subscription instead of spying on the
		// action method (zustand recreates state on each set, so vi.spyOn on
		// a state-object method can be lost on subsequent setState calls).
		const isOpenChanges: boolean[] = [];
		const unsub = useEventLogStore.subscribe((state, prev) => {
			if (state.isOpen !== prev.isOpen) isOpenChanges.push(state.isOpen);
		});

		const setSelectedNodeSpy = vi.spyOn(
			useRoadmapStore.getState(),
			"setSelectedNode",
		);
		const deps = makeStubDeps();

		render(
			<>
				<RouterHarness deps={deps} />
				<EventLogDrawer />
			</>,
		);

		// Find a focusable element inside the drawer region — the close button is the simplest target
		const drawer = screen.getByRole("region", {
			name: "Event log",
		}) as HTMLElement;
		expect(drawer).toBeInTheDocument();
		const closeBtn = drawer.querySelector<HTMLButtonElement>(
			'button[aria-label="Close event log"]',
		);
		expect(closeBtn).not.toBeNull();
		const target = closeBtn as HTMLButtonElement;
		act(() => {
			target.focus();
		});
		expect(document.activeElement).toBe(target);
		// Sanity check: drawer is open + activeElement is inside drawer
		expect(useEventLogStore.getState().isOpen).toBe(true);
		expect(drawer.contains(document.activeElement)).toBe(true);

		// The router's Escape branch uses this exact selector — confirm it
		// resolves on the rendered DOM (we anchor on element+accessible-name
		// to avoid biome's redundant-role lint on <section role="region">).
		expect(
			document.querySelector('section[aria-label="Event log"]'),
		).not.toBeNull();

		// Dispatch on document — the router's capture-phase listener handles
		// keydowns at document scope regardless of focused element.
		await act(async () => {
			document.dispatchEvent(
				new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
			);
		});

		unsub();

		// The drawer-close branch fired: isOpen flipped true → false, AND
		// the Phase 3 fall-through (setSelectedNode) did NOT fire.
		expect(isOpenChanges).toContain(false);
		expect(useEventLogStore.getState().isOpen).toBe(false);
		expect(deps.inlineRename.cancel).not.toHaveBeenCalled();
		expect(setSelectedNodeSpy).not.toHaveBeenCalled();
	});

	it("Escape with focus on document.body (outside drawer) leaves drawer open and falls through to deselect", async () => {
		const setSelectedNodeSpy = vi.spyOn(
			useRoadmapStore.getState(),
			"setSelectedNode",
		);
		const deps = makeStubDeps();

		render(
			<>
				<RouterHarness deps={deps} />
				<EventLogDrawer />
			</>,
		);

		// Focus on body — outside the drawer region
		act(() => {
			(document.body as HTMLElement).focus();
		});

		await act(async () => {
			document.dispatchEvent(
				new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
			);
		});

		// Drawer stays open (containment check correctly identified focus as outside)
		expect(useEventLogStore.getState().isOpen).toBe(true);
		// Phase 3 deselect fall-through MUST have fired
		expect(setSelectedNodeSpy).toHaveBeenCalledWith(null);
	});
});
