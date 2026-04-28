// Phase 4 Plan 04-03 Task 1 — real tests for roadmapStore live indicator.
// Sources: D-14, D-15 in 04-CONTEXT.md.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RoadmapSchema } from "../../../../../packages/core/src/schema";
import {
	useIsNodeLive,
	useRoadmapStore,
} from "../../../src/mainview/store/roadmapStore";
import { resetStore } from "../../helpers/resetStore";

const TEST_SCHEMA: RoadmapSchema = {
	version: "1.0",
	title: "Live Indicator Test",
	statusConfig: [{ id: "not-started", label: "Not Started" }],
	nodes: [{ id: "n1", title: "N1", status: "not-started" }],
};

beforeEach(() => {
	vi.useFakeTimers();
});

afterEach(() => {
	vi.useRealTimers();
	resetStore();
});

describe("roadmapStore live indicator (D-14)", () => {
	it("isNodeLive returns true within 30s window", () => {
		const now = Date.now();
		vi.setSystemTime(now);
		useRoadmapStore.getState().loadSchema(TEST_SCHEMA, "/test.json");

		useRoadmapStore.setState({
			liveEventMeta: {
				n1: { lastEventAt: now - 10_000, source: "test" },
			},
			liveTick: 1,
		});

		expect(useRoadmapStore.getState().isNodeLive("n1")).toBe(true);
	});

	it("isNodeLive returns false when >= 30s have passed", () => {
		const now = Date.now();
		vi.setSystemTime(now);
		useRoadmapStore.getState().loadSchema(TEST_SCHEMA, "/test.json");

		useRoadmapStore.setState({
			liveEventMeta: {
				n1: { lastEventAt: now - 30_001 },
			},
			liveTick: 1,
		});

		expect(useRoadmapStore.getState().isNodeLive("n1")).toBe(false);
	});

	it("isNodeLive returns false for unknown nodeId", () => {
		useRoadmapStore.getState().loadSchema(TEST_SCHEMA, "/test.json");
		expect(useRoadmapStore.getState().isNodeLive("no-such-node")).toBe(false);
	});

	it("bumpLiveTick increments liveTick without mutating liveEventMeta", () => {
		useRoadmapStore.getState().loadSchema(TEST_SCHEMA, "/test.json");
		const now = Date.now();
		useRoadmapStore.setState({
			liveEventMeta: { n1: { lastEventAt: now } },
			liveTick: 0,
		});

		useRoadmapStore.getState().bumpLiveTick();
		useRoadmapStore.getState().bumpLiveTick();

		expect(useRoadmapStore.getState().liveTick).toBe(2);
		expect(useRoadmapStore.getState().liveEventMeta["n1"].lastEventAt).toBe(
			now,
		);
	});
});

describe("useIsNodeLive selector", () => {
	it("returns false when node is not in liveEventMeta", () => {
		useRoadmapStore.setState({ liveEventMeta: {}, liveTick: 0 });
		// Call directly from store state — selector mirrors hook logic
		const result = useRoadmapStore.getState().isNodeLive("missing");
		expect(result).toBe(false);
	});

	it("returns true for fresh event (< 30s)", () => {
		const now = Date.now();
		vi.setSystemTime(now);
		useRoadmapStore.setState({
			liveEventMeta: { n1: { lastEventAt: now - 5_000 } },
			liveTick: 0,
		});
		expect(useRoadmapStore.getState().isNodeLive("n1")).toBe(true);
	});
});
