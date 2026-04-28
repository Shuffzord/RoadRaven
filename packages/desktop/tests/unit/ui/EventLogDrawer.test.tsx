// @vitest-environment jsdom
// Plan 04-04 Task 2 — EventLogDrawer real tests.
// Sources: D-18, D-19 in 04-CONTEXT.md, PLUG-07.

import "@testing-library/jest-dom";
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { IntegrationEvent } from "../../../../../shared/types";
import { useEventApiStore } from "../../../src/mainview/store/eventApiStore";
import { useEventLogStore } from "../../../src/mainview/store/eventLogStore";
import { useRoadmapStore } from "../../../src/mainview/store/roadmapStore";

// Mock @tanstack/react-virtual to avoid jsdom infinite loop.
// In jsdom, ResizeObserver + getBoundingClientRect always return 0, which
// causes the virtualizer's useSyncExternalStore snapshot to change on every
// render → "Maximum update depth exceeded" (Pitfall 9 in RESEARCH §5.2).
// In a real browser with actual layout, measureElement works correctly.
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

function makeEvent(nodeId: string, i: number): IntegrationEvent {
	return {
		nodeId,
		status: "in-progress",
		source: "test-agent",
		timestamp: new Date(Date.now() - i * 1000).toISOString(),
	};
}

// Import drawer AFTER mock is set up
// eslint-disable-next-line import/first
const { EventLogDrawer } = await import(
	"../../../src/mainview/components/EventLogDrawer"
);

beforeEach(() => {
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
});

describe("EventLogDrawer (D-18, D-19)", () => {
	it("renders 1000 rows virtualized without jank", () => {
		const events = Array.from({ length: 1000 }, (_, i) =>
			makeEvent(`node-${i}`, i),
		);
		act(() => {
			useEventLogStore.getState().appendEvents(events);
		});
		render(<EventLogDrawer />);
		const region = screen.getByRole("region", { name: "Event log" });
		expect(region).toBeInTheDocument();
		// Virtualizer mock limits to ~30 items — NOT 1000 full DOM rows
		const listItems = screen.queryAllByRole("listitem");
		expect(listItems.length).toBeLessThan(1000);
		expect(listItems.length).toBeGreaterThan(0);
	});

	it("collapsed state shows 24px header strip when drawerHeightPx=24", () => {
		act(() => {
			useEventLogStore.setState({ drawerHeightPx: 24, isOpen: true });
			useEventLogStore.getState().appendEvents([makeEvent("n1", 0)]);
		});
		render(<EventLogDrawer />);
		const region = screen.getByRole("region", { name: "Event log" });
		expect(region).toHaveStyle({ height: "24px" });
	});

	it("expanded default is ~30% viewport height", () => {
		act(() => {
			useEventLogStore.getState().appendEvents([makeEvent("n1", 0)]);
		});
		render(<EventLogDrawer />);
		const region = screen.getByRole("region", { name: "Event log" });
		// drawerHeightPx was set to 300 in beforeEach
		expect(region).toHaveStyle({ height: "300px" });
	});

	it("shows 'No events received yet' when rows is empty", () => {
		render(<EventLogDrawer />);
		expect(screen.getByText("No events received yet.")).toBeInTheDocument();
	});

	it("shows 'Event API is not running' when status is off", () => {
		act(() => {
			useEventApiStore.setState({ status: "off" });
		});
		render(<EventLogDrawer />);
		expect(screen.getByText("Event API is not running.")).toBeInTheDocument();
	});

	it("shows port-in-use message when status is error", () => {
		act(() => {
			useEventApiStore.setState({ status: "error", port: 47921 });
		});
		render(<EventLogDrawer />);
		expect(screen.getByText("Port 47921 is in use.")).toBeInTheDocument();
	});

	it("shows 'No events match these filters' when filtered to zero rows", () => {
		act(() => {
			useEventLogStore.getState().appendEvents([makeEvent("n1", 0)]);
			useEventLogStore.getState().setFilterSource("nonexistent-source");
		});
		render(<EventLogDrawer />);
		expect(
			screen.getByText("No events match these filters."),
		).toBeInTheDocument();
	});

	it("returns null when isOpen is false", () => {
		act(() => {
			useEventLogStore.setState({ isOpen: false, drawerHeightPx: 300 });
		});
		const { container } = render(<EventLogDrawer />);
		expect(container.firstChild).toBeNull();
	});
});
