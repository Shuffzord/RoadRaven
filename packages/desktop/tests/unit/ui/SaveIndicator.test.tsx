/** @vitest-environment jsdom */
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SaveIndicator } from "../../../src/mainview/components/SaveIndicator";
import {
	type SaveState,
	useRoadmapStore,
} from "../../../src/mainview/store/roadmapStore";
import { resetStore } from "../../helpers/resetStore";

function setSaveState(state: SaveState): void {
	useRoadmapStore.setState({ saveState: state });
}

afterEach(() => {
	resetStore();
	vi.restoreAllMocks();
});

describe("SaveIndicator", () => {
	it("'saved' state renders green dot + 'Saved' label", () => {
		setSaveState("saved");
		render(<SaveIndicator />);
		expect(screen.getByText("Saved")).toBeTruthy();
	});

	it("'saving' state renders spinner + 'Saving…'", () => {
		setSaveState("saving");
		render(<SaveIndicator />);
		expect(screen.getByText("Saving…")).toBeTruthy();
	});

	it("'error-retrying' state renders error icon + 'Error saving — retrying…' (not a button)", () => {
		setSaveState("error-retrying");
		render(<SaveIndicator />);
		expect(screen.getByText("Error saving — retrying…")).toBeTruthy();
		expect(screen.queryByRole("button")).toBeNull();
	});

	it("'error-manual' state renders a button with 'Error saving — click to retry'", () => {
		setSaveState("error-manual");
		render(<SaveIndicator />);
		const btn = screen.getByRole("button", {
			name: /save failed.*click to retry/i,
		});
		expect(btn).toBeTruthy();
		expect(btn.textContent).toContain("Error saving — click to retry");
	});

	it("clicking 'error-manual' button dispatches roadraven:trigger-save event", () => {
		setSaveState("error-manual");
		const handler = vi.fn();
		window.addEventListener("roadraven:trigger-save", handler);
		render(<SaveIndicator />);
		const btn = screen.getByRole("button", {
			name: /save failed.*click to retry/i,
		});
		fireEvent.click(btn);
		expect(handler).toHaveBeenCalled();
		window.removeEventListener("roadraven:trigger-save", handler);
	});

	it("icons are aria-hidden and text label remains visible", () => {
		setSaveState("error-retrying");
		const { container } = render(<SaveIndicator />);
		const hidden = container.querySelectorAll("[aria-hidden='true']");
		expect(hidden.length).toBeGreaterThan(0);
		expect(screen.getByText("Error saving — retrying…")).toBeTruthy();
	});
});
