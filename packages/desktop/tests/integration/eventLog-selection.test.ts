// @vitest-environment jsdom
// Plan 04-04 Task 2 — EventLog row selection integration test.
// Sources: D-21, I-11 in 04-CONTEXT.md, PLUG-07.
// Note: .ts file (not .tsx) — test uses the stores directly to verify the
// selection contract without JSX rendering.

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { RoadmapSchema } from "../../../../packages/core/src/schema";
import type { IntegrationEvent } from "../../../../shared/types";
import { requestNodeFocus } from "../../src/mainview/lib/focusRequest";
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

// The rows' nodes have to exist in the roadmap: a focus request for an id
// that is not in the index is ignored (an event can name a node from another
// file, or one deleted since).
const SCHEMA: RoadmapSchema = {
	version: "1.0",
	title: "Event log fixture",
	nodes: [
		{
			id: "n1",
			title: "n1",
			status: "not-started",
			children: ["n2", "n3", "n4", "n5"].map((id) => ({
				id,
				title: id,
				status: "not-started" as const,
			})),
		},
	],
};

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
	useRoadmapStore.getState().loadSchema(SCHEMA, "/tmp/event-log.json");
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
	it("row click requests a centred focus and selects synchronously (I-11; v0.8.1 RC3)", () => {
		// Seed 5 events for different nodes
		const events = ["n1", "n2", "n3", "n4", "n5"].map((id, i) =>
			makeEvent(id, i),
		);
		useEventLogStore.getState().appendEvents(events);

		// Verify events landed in store
		const { rows } = useEventLogStore.getState();
		expect(rows.length).toBe(5);

		expect(useRoadmapStore.getState().selectedNodeId).toBeNull();

		// Simulate clicking the row for n3
		const clickedRow = rows.find((r) => r.nodeId === "n3");
		expect(clickedRow).toBeDefined();

		// This is exactly the handler in EventLogDrawer's onClick. The reveal
		// half is the canvas controller's and needs no mounted Canvas here; the
		// selection contract is that it lands SYNCHRONOUSLY (it drives the
		// SidePanel).
		requestNodeFocus(clickedRow?.nodeId ?? "n3", {
			align: "center",
			select: true,
		});

		expect(useRoadmapStore.getState().selectedNodeId).toBe("n3");
		// RC3: the row also takes canvas focus, so the camera moves even when a
		// different node was focused before.
		expect(useRoadmapStore.getState().focusedNodeId).toBe("n3");
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
