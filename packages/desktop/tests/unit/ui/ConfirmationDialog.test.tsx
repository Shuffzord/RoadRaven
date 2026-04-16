/** @vitest-environment jsdom */
import { fireEvent, render, screen } from "@testing-library/react";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ConfirmationDialog } from "../../../src/mainview/components/ConfirmationDialog";
import { useRoadmapStore } from "../../../src/mainview/store/roadmapStore";
import { resetStore } from "../../helpers/resetStore";

afterEach(() => {
	resetStore();
	vi.restoreAllMocks();
});

function setPending(nodeTitle: string, deletedCount: number, nodeId = "n1") {
	useRoadmapStore.setState({
		pendingConfirmation: { nodeId, nodeTitle, deletedCount },
	});
}

describe("ConfirmationDialog", () => {
	it("does not render dialog when pendingConfirmation is null", () => {
		render(<ConfirmationDialog />);
		expect(screen.queryByRole("dialog")).toBeNull();
	});

	it("renders heading 'Delete node and 3 children?' when deletedCount === 3", () => {
		setPending("My Node", 3);
		render(<ConfirmationDialog />);
		const dialog = screen.getByRole("dialog");
		expect(dialog.textContent).toContain("Delete node and 3 children?");
	});

	it("Escape key closes dialog without calling deleteNode (onOpenChange -> cancelDelete)", () => {
		setPending("Foo", 3);
		const deleteSpy = vi.spyOn(useRoadmapStore.getState(), "deleteNode");
		render(<ConfirmationDialog />);
		act(() => {
			fireEvent.keyDown(document, { key: "Escape" });
		});
		expect(deleteSpy).not.toHaveBeenCalled();
		expect(useRoadmapStore.getState().pendingConfirmation).toBeNull();
	});

	it("Keep Node button clears pendingConfirmation without calling deleteNode", () => {
		setPending("Foo", 3);
		const deleteSpy = vi.spyOn(useRoadmapStore.getState(), "deleteNode");
		render(<ConfirmationDialog />);
		const keepBtn = screen.getByRole("button", { name: /keep node/i });
		act(() => {
			fireEvent.click(keepBtn);
		});
		expect(deleteSpy).not.toHaveBeenCalled();
		expect(useRoadmapStore.getState().pendingConfirmation).toBeNull();
	});

	it("Delete button calls confirmDelete which invokes deleteNode and clears pending", () => {
		setPending("Foo", 3, "n1");
		const confirmSpy = vi.spyOn(useRoadmapStore.getState(), "confirmDelete");
		render(<ConfirmationDialog />);
		const delBtn = screen.getByRole("button", { name: /^delete$/i });
		act(() => {
			fireEvent.click(delBtn);
		});
		expect(confirmSpy).toHaveBeenCalled();
	});

	it("initial focus is on Keep Node button (safer default)", async () => {
		setPending("Foo", 3);
		render(<ConfirmationDialog />);
		// Let effects run
		await new Promise((r) => setTimeout(r, 50));
		const keepBtn = screen.getByRole("button", { name: /keep node/i });
		expect(document.activeElement).toBe(keepBtn);
	});
});
