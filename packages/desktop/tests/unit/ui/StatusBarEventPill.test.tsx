// @vitest-environment jsdom
// Phase 4 Plan 04-03 Task 2 — EventApiPill real tests.
// Sources: D-06 in 04-CONTEXT.md, PLUG-01, UI-SPEC §"Status-bar pill colour state machine".

import "@testing-library/jest-dom";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EventApiPill } from "../../../src/mainview/components/EventApiPill";
import { useEventApiStore } from "../../../src/mainview/store/eventApiStore";

// Stub navigator.clipboard before each test
beforeEach(() => {
	Object.defineProperty(navigator, "clipboard", {
		value: { writeText: vi.fn().mockResolvedValue(undefined) },
		writable: true,
		configurable: true,
	});
	useEventApiStore.setState({
		status: "off",
		port: null,
		connectedCount: 0,
		errorMessage: null,
	});
	vi.useFakeTimers();
});

afterEach(() => {
	vi.useRealTimers();
	vi.restoreAllMocks();
});

describe("EventApiPill (D-06)", () => {
	it("off state renders ○ Event API off", () => {
		render(<EventApiPill />);
		expect(screen.getByText(/○ Event API off/)).toBeInTheDocument();
	});

	it("listening 0 producers renders ● :47921", () => {
		act(() =>
			useEventApiStore.setState({
				status: "listening",
				port: 47921,
				connectedCount: 0,
			}),
		);
		render(<EventApiPill />);
		expect(screen.getByText(/● :47921/)).toBeInTheDocument();
	});

	it("listening N producers renders ● :47921 · N (count)", () => {
		act(() =>
			useEventApiStore.setState({
				status: "listening",
				port: 47921,
				connectedCount: 2,
			}),
		);
		render(<EventApiPill />);
		// U+00B7 middle dot separator per UI-SPEC
		expect(screen.getByText(/● :47921 · 2/)).toBeInTheDocument();
	});

	it("error state renders ● Port :47921 in use", () => {
		act(() =>
			useEventApiStore.setState({
				status: "error",
				port: 47921,
				connectedCount: 0,
				errorMessage: "Port 47921 in use",
			}),
		);
		render(<EventApiPill />);
		expect(screen.getByText(/● Port :47921 in use/)).toBeInTheDocument();
	});

	it("click copies ws URL when idle (listening, 0 producers)", async () => {
		act(() =>
			useEventApiStore.setState({
				status: "listening",
				port: 47921,
				connectedCount: 0,
			}),
		);
		render(<EventApiPill />);
		const pill = screen.getByRole("button");
		await act(async () => {
			fireEvent.click(pill);
		});
		expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
			"ws://127.0.0.1:47921",
		);
	});

	it("shows Copied ✓ feedback for 1200ms after click", async () => {
		act(() =>
			useEventApiStore.setState({
				status: "listening",
				port: 47921,
				connectedCount: 0,
			}),
		);
		render(<EventApiPill />);
		const pill = screen.getByRole("button");
		await act(async () => {
			fireEvent.click(pill);
		});
		expect(screen.getByText(/Copied ✓/)).toBeInTheDocument();

		// Advance past 1200ms — label should revert
		act(() => vi.advanceTimersByTime(1300));
		expect(screen.queryByText(/Copied ✓/)).not.toBeInTheDocument();
	});

	it("port in label reflects dynamic port (not hardcoded 47921)", () => {
		act(() =>
			useEventApiStore.setState({
				status: "listening",
				port: 47922,
				connectedCount: 0,
			}),
		);
		render(<EventApiPill />);
		expect(screen.getByText(/● :47922/)).toBeInTheDocument();
	});

	it("connected click (listening + connectedCount > 0) opens the event log drawer (UAT-3)", async () => {
		// Reset eventLogStore + ensure drawer starts closed
		const { useEventLogStore } = await import(
			"../../../src/mainview/store/eventLogStore"
		);
		act(() =>
			useEventLogStore.setState({
				isOpen: false,
				rows: [],
				filter: { source: null, selectedNodeOnly: false, status: null },
			}),
		);
		act(() =>
			useEventApiStore.setState({
				status: "listening",
				port: 47921,
				connectedCount: 1,
			}),
		);
		render(<EventApiPill />);
		const pill = screen.getByRole("button");
		await act(async () => {
			fireEvent.click(pill);
		});
		expect(useEventLogStore.getState().isOpen).toBe(true);
		// Idle URL-copy MUST NOT have fired in the connected branch
		expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
	});
});
