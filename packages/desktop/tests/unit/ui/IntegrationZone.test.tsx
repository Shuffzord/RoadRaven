// @vitest-environment jsdom
// Phase 4 Plan 04-03 Task 4 — IntegrationZone real tests.
// Plan 04-04 Task 4 — extended with mini-history and open-log tests.
// Sources: D-16, I-17 in 04-CONTEXT.md, PLUG-05, UI-SPEC §"SidePanel Integration zone".

import "@testing-library/jest-dom";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IntegrationZone } from "../../../src/mainview/components/IntegrationZone";
import { useEventLogStore } from "../../../src/mainview/store/eventLogStore";
import { useRoadmapStore } from "../../../src/mainview/store/roadmapStore";

beforeEach(() => {
	vi.useFakeTimers();
	useRoadmapStore.setState({ liveEventMeta: {}, liveTick: 0 });
	useEventLogStore.setState({
		rows: [],
		filter: { source: null, selectedNodeOnly: false, status: null },
		isOpen: false,
		drawerHeightPx: 300,
	});
});

afterEach(() => {
	vi.useRealTimers();
	useEventLogStore.setState({
		rows: [],
		filter: { source: null, selectedNodeOnly: false, status: null },
		isOpen: false,
		drawerHeightPx: 300,
	});
});

describe("IntegrationZone (D-16)", () => {
	it("renders — No events received when no meta for node", () => {
		render(<IntegrationZone nodeId="n1" />);
		expect(screen.getByText(/— No events received/)).toBeInTheDocument();
	});

	it("renders ● Live header when event < 30s ago", () => {
		const now = Date.now();
		vi.setSystemTime(now);
		act(() =>
			useRoadmapStore.setState({
				liveEventMeta: {
					n1: { lastEventAt: now - 5_000, source: "claude-code" },
				},
				liveTick: 1,
			}),
		);
		render(<IntegrationZone nodeId="n1" />);
		expect(screen.getByText(/● Live/)).toBeInTheDocument();
	});

	it("renders ○ Last event Xm ago when outside 30s window", () => {
		const now = Date.now();
		vi.setSystemTime(now);
		act(() =>
			useRoadmapStore.setState({
				liveEventMeta: { n1: { lastEventAt: now - 4 * 60_000 } },
				liveTick: 1,
			}),
		);
		render(<IntegrationZone nodeId="n1" />);
		expect(screen.getByText(/4m ago/)).toBeInTheDocument();
	});

	it("renders Source row with value from liveEventMeta", () => {
		const now = Date.now();
		vi.setSystemTime(now);
		act(() =>
			useRoadmapStore.setState({
				liveEventMeta: {
					n1: { lastEventAt: now - 60_000, source: "my-agent" },
				},
				liveTick: 1,
			}),
		);
		render(<IntegrationZone nodeId="n1" />);
		expect(screen.getByText("my-agent")).toBeInTheDocument();
	});

	it("renders Last event meta title when meta exists", () => {
		const now = Date.now();
		vi.setSystemTime(now);
		act(() =>
			useRoadmapStore.setState({
				liveEventMeta: {
					n1: {
						lastEventAt: now - 60_000,
						meta: { pr: 42, branch: "main" },
					},
				},
				liveTick: 1,
			}),
		);
		render(<IntegrationZone nodeId="n1" />);
		expect(screen.getByText("Last event meta")).toBeInTheDocument();
		expect(screen.getByText("pr")).toBeInTheDocument();
		expect(screen.getByText("42")).toBeInTheDocument();
	});

	it("renders No meta in last event when meta is empty", () => {
		const now = Date.now();
		vi.setSystemTime(now);
		act(() =>
			useRoadmapStore.setState({
				liveEventMeta: {
					n1: { lastEventAt: now - 60_000, meta: {} },
				},
				liveTick: 1,
			}),
		);
		render(<IntegrationZone nodeId="n1" />);
		expect(screen.getByText(/No meta in last event/)).toBeInTheDocument();
	});

	it("renders null nodeId as empty state", () => {
		render(<IntegrationZone nodeId={null} />);
		expect(screen.getByText(/— No events received/)).toBeInTheDocument();
	});

	it("mini-history: shows recent events disclosure when events exist for node (I-17)", () => {
		const now = Date.now();
		vi.setSystemTime(now);
		act(() => {
			useRoadmapStore.setState({
				liveEventMeta: {
					n1: { lastEventAt: now - 5_000, source: "test-agent" },
				},
				liveTick: 1,
			});
			useEventLogStore.getState().appendEvents([
				{
					nodeId: "n1",
					status: "in-progress",
					source: "test-agent",
					timestamp: new Date(now - 3000).toISOString(),
				},
				{
					nodeId: "n1",
					status: "done",
					source: "test-agent",
					timestamp: new Date(now - 1000).toISOString(),
				},
				{
					nodeId: "n2",
					status: "in-progress",
					source: "other",
					timestamp: new Date(now - 2000).toISOString(),
				},
			]);
		});
		render(<IntegrationZone nodeId="n1" />);
		// Disclosure button shows count of n1 events (2), not n2
		expect(screen.getByText(/Recent events \(2\)/)).toBeInTheDocument();
	});

	it("open full log: click sets drawer open and selectedNodeOnly filter (I-17)", () => {
		const now = Date.now();
		vi.setSystemTime(now);
		act(() => {
			useRoadmapStore.setState({
				liveEventMeta: { n1: { lastEventAt: now - 5_000, source: "agent" } },
				liveTick: 1,
			});
		});
		render(<IntegrationZone nodeId="n1" />);

		const openBtn = screen.getByText(/Open full log/);
		act(() => {
			fireEvent.click(openBtn);
		});

		const { isOpen, filter } = useEventLogStore.getState();
		expect(isOpen).toBe(true);
		expect(filter.selectedNodeOnly).toBe(true);
	});
});
