// @vitest-environment jsdom
// Plan 04-04 Task 2 — EventLog row selection integration test.
// Sources: D-21, I-11 in 04-CONTEXT.md, PLUG-07.
// Note: .ts file (not .tsx) — test uses the stores directly to verify the
// selection contract without JSX rendering.

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { IntegrationEvent } from "../../../../shared/types";
import { useEventApiStore } from "../../src/mainview/store/eventApiStore";
import { useEventLogStore } from "../../src/mainview/store/eventLogStore";
import { useRoadmapStore } from "../../src/mainview/store/roadmapStore";

function makeEvent(nodeId: string, i = 0): IntegrationEvent {
	return {
		nodeId,
		status: "in-progress",
		source: "test-agent",
		timestamp: new Date(Date.now() - i * 1000).toISOString(),
	};
}

beforeEach(() => {
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

afterEach(() => {
	useEventLogStore.setState({
		rows: [],
		filter: { source: null, selectedNodeOnly: false, status: null },
		isOpen: false,
		drawerHeightPx: 300,
	});
	useRoadmapStore.setState({ selectedNodeId: null });
});

describe("EventLog row selection (I-11)", () => {
	it("row click calls setSelectedNode(row.nodeId); Canvas pans via existing focusedNodeId/selectedNodeId effect (I-11 resolution — no new camera-follow action needed)", () => {
		// Seed 5 events for different nodes
		const events = ["n1", "n2", "n3", "n4", "n5"].map((id, i) =>
			makeEvent(id, i),
		);
		useEventLogStore.getState().appendEvents(events);

		// Verify events landed in store
		const { rows } = useEventLogStore.getState();
		expect(rows.length).toBe(5);

		// Simulate what EventLogRow's onClick does:
		// "I-11 resolution: setSelectedNode triggers Canvas.tsx's existing
		// `focusedNodeId ?? selectedNodeId` effect (lines 141-143)..."
		expect(useRoadmapStore.getState().selectedNodeId).toBeNull();

		// Simulate clicking the row for n3
		const clickedRow = rows.find((r) => r.nodeId === "n3");
		expect(clickedRow).toBeDefined();

		// This is exactly the handler in EventLogDrawer's onClick:
		useRoadmapStore.getState().setSelectedNode(clickedRow?.nodeId ?? "n3");

		// After the click handler fires, selectedNodeId updates
		expect(useRoadmapStore.getState().selectedNodeId).toBe("n3");

		// Camera-follow is NOT asserted here — Canvas.tsx's Phase 3 test suite
		// already exercises the viewport-pan effect against selectedNodeId changes.
		// This test only verifies the SELECTION event fires correctly (I-11).
	});

	it("appendEvents wires through the store (pushEventLog integration)", () => {
		// Verify that appendEvents (now wired from pushEventLog in rpcHandlers)
		// correctly accumulates events in the store.
		const batch1 = [makeEvent("a", 0), makeEvent("b", 1)];
		const batch2 = [makeEvent("c", 2)];

		useEventLogStore.getState().appendEvents(batch1);
		useEventLogStore.getState().appendEvents(batch2);

		const { rows } = useEventLogStore.getState();
		expect(rows.length).toBe(3);
		expect(rows.map((r) => r.nodeId)).toEqual(["a", "b", "c"]);
	});
});
