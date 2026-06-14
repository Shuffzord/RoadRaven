/** @vitest-environment jsdom */
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// rpc imports Electroview which throws outside Electrobun; stub to HMR-null mode.
vi.mock("../../../src/mainview/rpc", () => ({
	electroview: null,
}));

const openRecent = vi.fn();
vi.mock("../../../src/mainview/hooks/useFileActions", () => ({
	useFileActions: () => ({ openRecent }),
}));

// useRecentFiles is overridden per-test via the mock below.
const recentFilesMock = vi.fn<[], string[]>(() => []);
vi.mock("../../../src/mainview/hooks/useRecentFiles", () => ({
	useRecentFiles: () => recentFilesMock(),
}));

import { Sidebar } from "../../../src/mainview/components/Sidebar";

afterEach(() => {
	vi.clearAllMocks();
	recentFilesMock.mockReturnValue([]);
});

describe("Sidebar — Recent Files", () => {
	it("shows 'No recent files' placeholder when list is empty", () => {
		recentFilesMock.mockReturnValue([]);
		render(<Sidebar />);
		expect(screen.getByText("No recent files")).toBeTruthy();
	});

	it("renders basenames and uses full path as tooltip", () => {
		recentFilesMock.mockReturnValue([
			"/path/to/roadmap.json",
			"C:\\work\\plan.json",
		]);
		render(<Sidebar />);
		const item = screen.getByText("roadmap.json");
		expect(item).toBeTruthy();
		expect(item.closest("button")?.getAttribute("title")).toBe(
			"/path/to/roadmap.json",
		);
		expect(screen.getByText("plan.json")).toBeTruthy();
	});

	it("calls openRecent with the full path when a recent file is clicked", () => {
		recentFilesMock.mockReturnValue(["/path/to/roadmap.json"]);
		render(<Sidebar />);
		fireEvent.click(screen.getByText("roadmap.json"));
		expect(openRecent).toHaveBeenCalledWith("/path/to/roadmap.json");
	});
});

describe("Sidebar — Preferences / Help dialogs", () => {
	it("opens the Preferences dialog with stay-tuned copy", () => {
		render(<Sidebar />);
		expect(screen.queryByRole("dialog")).toBeNull();
		fireEvent.click(screen.getByText("Preferences"));
		const dialog = screen.getByRole("dialog");
		expect(dialog.textContent).toContain("Preferences");
		expect(dialog.textContent).toContain("Nothing here yet — stay tuned.");
	});

	it("opens the Help dialog with stay-tuned copy", () => {
		render(<Sidebar />);
		fireEvent.click(screen.getByText("Help"));
		const dialog = screen.getByRole("dialog");
		expect(dialog.textContent).toContain("Help");
		expect(dialog.textContent).toContain("Nothing here yet — stay tuned.");
	});

	it("closes the dialog via the Close button", () => {
		render(<Sidebar />);
		fireEvent.click(screen.getByText("Preferences"));
		expect(screen.getByRole("dialog")).toBeTruthy();
		fireEvent.click(screen.getByText("Close"));
		expect(screen.queryByRole("dialog")).toBeNull();
	});
});
