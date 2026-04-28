// @vitest-environment jsdom
// Phase 4 Plan 04-03 Task 5 — EventToast real tests.
// Sources: D-22, D-23, D-24 in 04-CONTEXT.md, PLUG-06, I-05.

import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EventToast } from "../../../src/mainview/components/EventToast";
import type { ActiveToast } from "../../../src/mainview/store/toastStore";

function makeToast(overrides: Partial<ActiveToast> = {}): ActiveToast {
	return {
		id: "t1",
		type: "malformed",
		source: "claude-code",
		count: 1,
		lastEventAt: Date.now(),
		...overrides,
	};
}

describe("EventToast (D-23, D-24)", () => {
	it("renders malformed toast copy per D-23", () => {
		render(<EventToast toast={makeToast()} onDismiss={vi.fn()} />);
		expect(
			screen.getByText("Invalid event from claude-code."),
		).toBeInTheDocument();
		expect(screen.getByText("See event log for details.")).toBeInTheDocument();
	});

	it("renders unknown_node toast copy per D-23", () => {
		render(
			<EventToast
				toast={makeToast({ type: "unknown_node" })}
				onDismiss={vi.fn()}
			/>,
		);
		expect(
			screen.getByText("Event for unknown node from claude-code."),
		).toBeInTheDocument();
		expect(
			screen.getByText("Node id not found in the current roadmap."),
		).toBeInTheDocument();
	});

	it("renders invalid_status toast copy per D-23", () => {
		render(
			<EventToast
				toast={makeToast({ type: "invalid_status", detail: "pending" })}
				onDismiss={vi.fn()}
			/>,
		);
		expect(
			screen.getByText("Unknown status 'pending' from claude-code."),
		).toBeInTheDocument();
		expect(
			screen.getByText(
				"Extend statusConfig in the schema to accept this status.",
			),
		).toBeInTheDocument();
	});

	it("renders disconnect info toast with no body per D-23", () => {
		render(
			<EventToast
				toast={makeToast({ type: "disconnect", source: "producer-1" })}
				onDismiss={vi.fn()}
			/>,
		);
		expect(
			screen.getByText("Producer producer-1 disconnected."),
		).toBeInTheDocument();
		// Disconnect has no body per D-23
		expect(
			screen.queryByText("See event log for details."),
		).not.toBeInTheDocument();
	});

	it("renders merged headline when count > 1 (D-24)", () => {
		render(<EventToast toast={makeToast({ count: 3 })} onDismiss={vi.fn()} />);
		expect(
			screen.getByText("3 invalid events from claude-code."),
		).toBeInTheDocument();
	});

	it("no Retry button present (D-22)", () => {
		render(<EventToast toast={makeToast()} onDismiss={vi.fn()} />);
		expect(screen.queryByText(/Retry/i)).not.toBeInTheDocument();
	});

	it("dismiss button calls onDismiss", () => {
		const onDismiss = vi.fn();
		render(<EventToast toast={makeToast()} onDismiss={onDismiss} />);
		fireEvent.click(screen.getByText("Dismiss"));
		expect(onDismiss).toHaveBeenCalledOnce();
	});
});
