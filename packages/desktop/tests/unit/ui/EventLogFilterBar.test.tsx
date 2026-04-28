// @vitest-environment jsdom
// Plan 04-04 Task 3 — EventLogFilterBar real tests.
// Sources: D-20 in 04-CONTEXT.md, PLUG-07.

import "@testing-library/jest-dom";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { IntegrationEvent } from "../../../../../shared/types";
import { EventLogFilterBar } from "../../../src/mainview/components/EventLogFilterBar";
import { useEventLogStore } from "../../../src/mainview/store/eventLogStore";
import { useRoadmapStore } from "../../../src/mainview/store/roadmapStore";

function makeEvent(
	nodeId: string,
	source: string,
	status = "in-progress",
): IntegrationEvent {
	return {
		nodeId,
		status,
		source,
		timestamp: new Date().toISOString(),
	};
}

beforeEach(() => {
	act(() => {
		useEventLogStore.setState({
			rows: [],
			filter: { source: null, selectedNodeOnly: false, status: null },
			isOpen: true,
			drawerHeightPx: 300,
		});
		useRoadmapStore.setState({
			selectedNodeId: null,
			schema: null,
		});
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

describe("EventLogFilterBar (D-20)", () => {
	it("source dropdown lists distinct sources from log", () => {
		act(() => {
			useEventLogStore.getState().appendEvents([
				makeEvent("n1", "agent-a"),
				makeEvent("n2", "agent-b"),
				makeEvent("n3", "agent-a"), // duplicate — should only appear once
			]);
		});
		render(<EventLogFilterBar />);

		const select = screen.getByRole("combobox", { name: /source filter/i });
		// Should have "All sources" + 2 distinct sources = 3 options total
		const options = select.querySelectorAll("option");
		expect(options.length).toBe(3);
		expect(options[0].textContent).toBe("All sources");
		expect(options[1].textContent).toBe("agent-a");
		expect(options[2].textContent).toBe("agent-b");
	});

	it("Selected node only toggle disables when no node selected", () => {
		act(() => {
			useRoadmapStore.setState({ selectedNodeId: null });
		});
		render(<EventLogFilterBar />);

		const toggle = screen.getByRole("button", { name: /selected node only/i });
		expect(toggle).toBeDisabled();
		expect(toggle).toHaveAttribute("title", "Select a node first");
	});

	it("Selected node only toggle is enabled when a node is selected", () => {
		act(() => {
			useRoadmapStore.setState({ selectedNodeId: "n1" });
		});
		render(<EventLogFilterBar />);

		const toggle = screen.getByRole("button", { name: /selected node only/i });
		expect(toggle).not.toBeDisabled();
		expect(toggle).not.toHaveAttribute("title");
	});

	it("status filter lists statusConfig entries", () => {
		act(() => {
			useRoadmapStore.setState({
				schema: {
					version: 1,
					title: "Test",
					nodes: [],
					statusConfig: [
						{ id: "not-started", label: "Not Started", color: "#aaa" },
						{ id: "in-progress", label: "In Progress", color: "#bbb" },
						{ id: "done", label: "Done", color: "#ccc" },
					],
				} as never,
			});
		});
		render(<EventLogFilterBar />);

		const select = screen.getByRole("combobox", { name: /status filter/i });
		const options = select.querySelectorAll("option");
		// "All statuses" + 3 status entries = 4 options
		expect(options.length).toBe(4);
		expect(options[0].textContent).toBe("All statuses");
		expect(options[1].textContent).toBe("not-started");
		expect(options[2].textContent).toBe("in-progress");
		expect(options[3].textContent).toBe("done");
	});

	it("Clear button visible when any filter active", () => {
		act(() => {
			useEventLogStore
				.getState()
				.appendEvents([makeEvent("n1", "claude-code")]);
			useEventLogStore.getState().setFilterSource("claude-code");
		});
		render(<EventLogFilterBar />);
		expect(screen.getByText("Clear")).toBeInTheDocument();
	});

	it("Clear button hidden when no filter active", () => {
		render(<EventLogFilterBar />);
		expect(screen.queryByText("Clear")).not.toBeInTheDocument();
	});

	it("Clear button click resets all filters", () => {
		act(() => {
			useEventLogStore
				.getState()
				.appendEvents([makeEvent("n1", "claude-code")]);
			useEventLogStore.getState().setFilterSource("claude-code");
		});
		render(<EventLogFilterBar />);

		const clearBtn = screen.getByText("Clear");
		act(() => {
			fireEvent.click(clearBtn);
		});

		const { filter } = useEventLogStore.getState();
		expect(filter.source).toBeNull();
		expect(filter.selectedNodeOnly).toBe(false);
		expect(filter.status).toBeNull();
	});
});
