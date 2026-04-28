// @vitest-environment jsdom
// Phase 4 Plan 04-03 Task 4 — IntegrationZone real tests.
// Sources: D-16 in 04-CONTEXT.md, PLUG-05, UI-SPEC §"SidePanel Integration zone".

import "@testing-library/jest-dom";
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IntegrationZone } from "../../../src/mainview/components/IntegrationZone";
import { useRoadmapStore } from "../../../src/mainview/store/roadmapStore";

beforeEach(() => {
	vi.useFakeTimers();
	useRoadmapStore.setState({ liveEventMeta: {}, liveTick: 0 });
});

afterEach(() => {
	vi.useRealTimers();
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
});
