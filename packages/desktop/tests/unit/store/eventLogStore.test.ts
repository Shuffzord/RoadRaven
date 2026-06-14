// eventLogStore unit tests — Plan 04-04 Task 1
// Sources: D-19, D-20 in 04-CONTEXT.md, PLUG-07.

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { IntegrationEvent } from "../../../../../shared/types";
import {
	EVENT_LOG_ROW_CAP,
	getClampedHeight,
	getDistinctSources,
	getFilteredRows,
	useEventLogStore,
} from "../../../src/mainview/store/eventLogStore";

function makeEvent(
	nodeId: string,
	overrides: Partial<IntegrationEvent> = {},
): IntegrationEvent {
	return {
		nodeId,
		status: "in-progress",
		source: "test-agent",
		timestamp: new Date().toISOString(),
		...overrides,
	};
}

beforeEach(() => {
	useEventLogStore.setState({
		rows: [],
		filter: { source: null, selectedNodeOnly: false, status: null },
		isOpen: false,
		drawerHeightPx: 300,
	});
});

afterEach(() => {
	useEventLogStore.setState({
		rows: [],
		filter: { source: null, selectedNodeOnly: false, status: null },
		isOpen: false,
		drawerHeightPx: 300,
	});
});

describe("eventLogStore", () => {
	it("rows cap at 1000 (drops oldest)", () => {
		// Start with 900 rows
		const existing = Array.from({ length: 900 }, (_, i) =>
			makeEvent(`n${i}`, { timestamp: `${i}` }),
		);
		useEventLogStore.setState({ rows: existing });

		// Append 200 more — should drop oldest 100 to stay at 1000
		const newEvents = Array.from({ length: 200 }, (_, i) =>
			makeEvent(`new${i}`, { timestamp: `new${i}` }),
		);
		useEventLogStore.getState().appendEvents(newEvents);

		const { rows } = useEventLogStore.getState();
		expect(rows.length).toBe(EVENT_LOG_ROW_CAP);
		// The last 1000: from position 100 of existing (n100) through all new events
		expect(rows[0].nodeId).toBe("n100");
		expect(rows[rows.length - 1].nodeId).toBe("new199");
	});

	it("appendEvents appends in order and stays under cap", () => {
		useEventLogStore
			.getState()
			.appendEvents([makeEvent("a"), makeEvent("b"), makeEvent("c")]);
		const { rows } = useEventLogStore.getState();
		expect(rows.length).toBe(3);
		expect(rows.map((r) => r.nodeId)).toEqual(["a", "b", "c"]);
	});

	it("toggleOpen flips isOpen state", () => {
		expect(useEventLogStore.getState().isOpen).toBe(false);
		useEventLogStore.getState().toggleOpen();
		expect(useEventLogStore.getState().isOpen).toBe(true);
		useEventLogStore.getState().toggleOpen();
		expect(useEventLogStore.getState().isOpen).toBe(false);
	});

	it("clearFilters resets all filter fields", () => {
		useEventLogStore.getState().setFilterSource("claude-code");
		useEventLogStore.getState().setFilterSelectedNodeOnly(true);
		useEventLogStore.getState().setFilterStatus("done");
		useEventLogStore.getState().clearFilters();
		const { filter } = useEventLogStore.getState();
		expect(filter.source).toBeNull();
		expect(filter.selectedNodeOnly).toBe(false);
		expect(filter.status).toBeNull();
	});

	it("getClampedHeight clamps below 24px to 24", () => {
		expect(getClampedHeight(0, 1000)).toBe(24);
		expect(getClampedHeight(10, 1000)).toBe(24);
		expect(getClampedHeight(24, 1000)).toBe(24);
	});

	it("getClampedHeight clamps above 70% viewport to max", () => {
		expect(getClampedHeight(1000, 1000)).toBe(700); // 70% of 1000
		expect(getClampedHeight(800, 1000)).toBe(700);
	});

	it("getClampedHeight passes through values in valid range", () => {
		expect(getClampedHeight(300, 1000)).toBe(300);
		expect(getClampedHeight(500, 1000)).toBe(500);
	});
});

describe("filter predicate for source dropdown", () => {
	const rows = [
		makeEvent("n1", { source: "agent-a" }),
		makeEvent("n2", { source: "agent-b" }),
		makeEvent("n3", { source: "agent-a" }),
	];

	it("null source returns all rows", () => {
		const result = getFilteredRows(
			rows,
			{ source: null, selectedNodeOnly: false, status: null },
			null,
		);
		expect(result.length).toBe(3);
	});

	it("specific source filters to matching rows only", () => {
		const result = getFilteredRows(
			rows,
			{ source: "agent-a", selectedNodeOnly: false, status: null },
			null,
		);
		expect(result.length).toBe(2);
		expect(result.every((r) => r.source === "agent-a")).toBe(true);
	});

	it("source with no match returns empty array", () => {
		const result = getFilteredRows(
			rows,
			{ source: "agent-c", selectedNodeOnly: false, status: null },
			null,
		);
		expect(result.length).toBe(0);
	});
});

describe("filter predicate for selectedNodeOnly toggle", () => {
	const rows = [makeEvent("n1"), makeEvent("n2"), makeEvent("n3")];

	it("selectedNodeOnly=false returns all rows regardless of selectedNodeId", () => {
		const result = getFilteredRows(
			rows,
			{ source: null, selectedNodeOnly: false, status: null },
			"n1",
		);
		expect(result.length).toBe(3);
	});

	it("selectedNodeOnly=true with no selection returns empty (T-04-04-04)", () => {
		const result = getFilteredRows(
			rows,
			{ source: null, selectedNodeOnly: true, status: null },
			null,
		);
		expect(result.length).toBe(0);
	});

	it("selectedNodeOnly=true with selection filters to matching node", () => {
		const result = getFilteredRows(
			rows,
			{ source: null, selectedNodeOnly: true, status: null },
			"n2",
		);
		expect(result.length).toBe(1);
		expect(result[0].nodeId).toBe("n2");
	});
});

describe("filter predicate for status filter", () => {
	const rows = [
		makeEvent("n1", { status: "done" }),
		makeEvent("n2", { status: "in-progress" }),
		makeEvent("n3", { status: "done" }),
	];

	it("null status returns all rows", () => {
		const result = getFilteredRows(
			rows,
			{ source: null, selectedNodeOnly: false, status: null },
			null,
		);
		expect(result.length).toBe(3);
	});

	it("specific status filters to matching rows", () => {
		const result = getFilteredRows(
			rows,
			{ source: null, selectedNodeOnly: false, status: "done" },
			null,
		);
		expect(result.length).toBe(2);
		expect(result.every((r) => r.status === "done")).toBe(true);
	});
});

describe("getDistinctSources", () => {
	it("returns unique source values in insertion order", () => {
		const rows = [
			makeEvent("n1", { source: "agent-a" }),
			makeEvent("n2", { source: "agent-b" }),
			makeEvent("n3", { source: "agent-a" }),
			makeEvent("n4", { source: "agent-c" }),
		];
		expect(getDistinctSources(rows)).toEqual(["agent-a", "agent-b", "agent-c"]);
	});

	it("excludes rows with no source", () => {
		const rows = [
			makeEvent("n1", { source: undefined }),
			makeEvent("n2", { source: "agent-a" }),
		];
		expect(getDistinctSources(rows)).toEqual(["agent-a"]);
	});

	it("returns empty array when all sources are undefined", () => {
		const rows = [
			makeEvent("n1", { source: undefined }),
			makeEvent("n2", { source: undefined }),
		];
		expect(getDistinctSources(rows)).toEqual([]);
	});
});
