/** @vitest-environment jsdom */
import { fireEvent, render, screen } from "@testing-library/react";
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DiscardChangesDialog } from "../../../src/mainview/components/DiscardChangesDialog";
import { useRoadmapStore } from "../../../src/mainview/store/roadmapStore";
import { resetStore } from "../../helpers/resetStore";

afterEach(() => {
	resetStore();
});

function open() {
	const resolve = vi.fn();
	useRoadmapStore.setState({ pendingDiscard: { resolve } });
	return resolve;
}

describe("DiscardChangesDialog (v0.8.2 A1)", () => {
	it("does not render when nothing is pending", () => {
		render(<DiscardChangesDialog />);
		expect(screen.queryByRole("dialog")).toBeNull();
	});

	it("renders the three choices and resolves the clicked one", () => {
		const resolve = open();
		render(<DiscardChangesDialog />);
		expect(screen.getByRole("dialog").textContent).toContain(
			"Save changes to this roadmap?",
		);
		act(() => {
			fireEvent.click(screen.getByRole("button", { name: /save as/i }));
		});
		expect(resolve).toHaveBeenLastCalledWith("save");
		act(() => {
			fireEvent.click(screen.getByRole("button", { name: /don't save/i }));
		});
		expect(resolve).toHaveBeenLastCalledWith("discard");
		act(() => {
			fireEvent.click(screen.getByRole("button", { name: /^cancel$/i }));
		});
		expect(resolve).toHaveBeenLastCalledWith("cancel");
	});

	it("Escape resolves cancel", () => {
		const resolve = open();
		render(<DiscardChangesDialog />);
		act(() => {
			fireEvent.keyDown(document, { key: "Escape" });
		});
		expect(resolve).toHaveBeenCalledWith("cancel");
	});

	it("initial focus is on Save As… (non-destructive default)", async () => {
		open();
		render(<DiscardChangesDialog />);
		await new Promise((r) => setTimeout(r, 50));
		expect(document.activeElement).toBe(
			screen.getByRole("button", { name: /save as/i }),
		);
	});
});
