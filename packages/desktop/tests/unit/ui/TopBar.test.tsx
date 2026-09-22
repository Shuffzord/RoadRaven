/** @vitest-environment jsdom */
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RoadmapSchema } from "../../../../../packages/core/src/schema";
import { resetStore } from "../../helpers/resetStore";

// Mock the rpc module to prevent Electroview import (the pattern every other
// renderer test in this folder uses).
vi.mock("../../../src/mainview/rpc", () => ({
	electroview: {
		rpc: {
			request: {
				saveSettings: vi.fn(() => Promise.resolve({ success: true })),
				loadSettings: vi.fn(() => Promise.resolve({ settings: {} })),
			},
		},
	},
}));

import { TopBar } from "../../../src/mainview/components/TopBar";
import { electroview } from "../../../src/mainview/rpc";
import { useEventLogStore } from "../../../src/mainview/store/eventLogStore";
import { useRoadmapStore } from "../../../src/mainview/store/roadmapStore";
import { useSetupStore } from "../../../src/mainview/store/setupStore";

// v0.8.1 Phase 5 — TopBar's first tests (.planning/v0.8.1-canvas-focus-PLAN.md
// T3). The file had NO dependency path from any test, which is exactly how the
// "Fit" button kept calling `resetView` — a hard-coded translate computed from
// window.innerWidth, not a fit at all — without anything noticing.

const ROOT_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const CHILD_ID = "11111111-2222-4333-8444-555555555555";
const OTHER_ID = "22222222-3333-4444-8555-666666666666";

const SCHEMA: RoadmapSchema = {
	version: "1.0",
	title: "TopBar fixture",
	nodes: [
		{
			id: ROOT_ID,
			title: "Root",
			status: "not-started",
			children: [
				{ id: CHILD_ID, title: "Findable", status: "not-started" },
				{ id: OTHER_ID, title: "Other", status: "not-started" },
			],
		},
	],
};

function saveSettingsMock(): ReturnType<typeof vi.fn> {
	return electroview?.rpc?.request.saveSettings as unknown as ReturnType<
		typeof vi.fn
	>;
}

function seed(filePath: string | null = "/tmp/topbar.json"): void {
	useRoadmapStore.getState().loadSchema(SCHEMA, filePath);
}

beforeEach(() => {
	resetStore();
	useEventLogStore.setState({ isOpen: false });
	saveSettingsMock().mockClear();
});

afterEach(() => {
	document.body.innerHTML = "";
	resetStore();
	vi.restoreAllMocks();
});

describe("TopBar — toolbar chrome", () => {
	// v0.8.2 D2-A / D3: the New/Open buttons became the File menu trigger and
	// the document chip sits in the centre once a document is open.
	it("renders one toolbar with the brand and the primary actions", () => {
		seed();
		render(<TopBar />);

		expect(screen.getByRole("toolbar", { name: "Main toolbar" })).toBeTruthy();
		expect(screen.getByText("RoadRaven")).toBeTruthy();
		const file = screen.getByRole("button", { name: "File" });
		expect(file.getAttribute("aria-haspopup")).toBe("menu");
		expect(screen.queryByText("New")).toBeNull();
		expect(screen.queryByText("Open")).toBeNull();
		expect(screen.getByLabelText("Current file: topbar.json")).toBeTruthy();
		expect(screen.getByText("Fit")).toBeTruthy();
		expect(screen.getByLabelText("Zoom in")).toBeTruthy();
		expect(screen.getByLabelText("Zoom out")).toBeTruthy();
	});

	it("hides the document chip while nothing is open", () => {
		render(<TopBar />);
		expect(screen.queryByLabelText(/^Current file: /)).toBeNull();
	});

	it("opens the setup wizard from the settings button", () => {
		render(<TopBar />);

		fireEvent.click(screen.getByLabelText("Setup and integrations"));

		expect(useSetupStore.getState().open).toBe(true);
		useSetupStore.setState({ open: false });
	});

	it("toggles the event log drawer", () => {
		render(<TopBar />);

		fireEvent.click(screen.getByLabelText("Toggle event log drawer"));

		expect(useEventLogStore.getState().isOpen).toBe(true);
	});
});

// v0.8.1 Phase 5: one "Fit to View". The button used to call `resetView`,
// which set translate from window.innerWidth and zoom 0.8 — a fixed camera,
// blind to where the tree actually is. `fitView` is the bounding-box fit the
// canvas computes from the cards that are really mounted (D3).
describe("TopBar — Fit", () => {
	it("asks the store to fit the tree", () => {
		seed();
		const fitView = vi.spyOn(useRoadmapStore.getState(), "fitView");
		render(<TopBar />);

		fireEvent.click(screen.getByText("Fit"));

		expect(fitView).toHaveBeenCalledTimes(1);
	});

	it("dispatches the canvas fit event rather than writing a fixed camera", () => {
		seed();
		const events: string[] = [];
		const listener = (): void => {
			events.push("fit");
		};
		window.addEventListener("roadraven:fit-view", listener);
		render(<TopBar />);
		const before = useRoadmapStore.getState();

		fireEvent.click(screen.getByText("Fit"));
		window.removeEventListener("roadraven:fit-view", listener);

		expect(events).toEqual(["fit"]);
		// The store's own translate/zoom are untouched: the canvas measures the
		// cards and answers the event.
		expect(useRoadmapStore.getState().translate).toEqual(before.translate);
		expect(useRoadmapStore.getState().zoomLevel).toBe(before.zoomLevel);
	});
});

// v0.8.2 F6: the −/+ buttons had no handlers. They now issue the store's zoom
// request, which the Canvas fulfils about its centre (Canvas.viewport tests).
describe("TopBar — zoom buttons", () => {
	it("Zoom in / Zoom out ask the store for one step each way", () => {
		seed();
		const requestZoom = vi.spyOn(useRoadmapStore.getState(), "requestZoom");
		render(<TopBar />);

		fireEvent.click(screen.getByLabelText("Zoom in"));
		fireEvent.click(screen.getByLabelText("Zoom out"));

		expect(requestZoom.mock.calls).toEqual([["in"], ["out"]]);
	});

	it("dispatches the canvas zoom event with the direction", () => {
		seed();
		const directions: unknown[] = [];
		const listener = (e: Event): void => {
			directions.push((e as CustomEvent).detail);
		};
		window.addEventListener("roadraven:zoom", listener);
		render(<TopBar />);

		fireEvent.click(screen.getByLabelText("Zoom out"));
		window.removeEventListener("roadraven:zoom", listener);

		expect(directions).toEqual(["out"]);
	});
});

describe("TopBar — layout toggle", () => {
	it("marks the active orientation and switches on click", () => {
		seed();
		render(<TopBar />);
		const group = screen.getByRole("radiogroup", {
			name: "Tree layout direction",
		});
		const lr = screen.getByRole("button", { name: "LR" });
		expect(group).toBeTruthy();
		expect(screen.getByRole("button", { name: "TB" }).ariaPressed).toBe("true");

		fireEvent.click(lr);

		expect(useRoadmapStore.getState().layoutOrientation).toBe("LR");
		expect(lr.ariaPressed).toBe("true");
	});

	it("persists the orientation per file through the settings rpc", () => {
		seed("/tmp/topbar.json");
		render(<TopBar />);

		fireEvent.click(screen.getByRole("button", { name: "LR" }));

		expect(saveSettingsMock()).toHaveBeenCalledWith({
			settings: { fileSettings: { "/tmp/topbar.json": { layout: "LR" } } },
		});
	});

	it("does not persist anything for an unsaved roadmap", () => {
		seed(null);
		render(<TopBar />);

		fireEvent.click(screen.getByRole("button", { name: "LR" }));

		expect(useRoadmapStore.getState().layoutOrientation).toBe("LR");
		expect(saveSettingsMock()).not.toHaveBeenCalled();
	});
});

describe("TopBar — search box", () => {
	it("shows the Ctrl+F hint until something is typed, then the match counter", () => {
		seed();
		render(<TopBar />);
		expect(screen.getByText("Ctrl+F")).toBeTruthy();

		fireEvent.change(screen.getByLabelText("Search nodes"), {
			target: { value: "Findable" },
		});

		expect(useRoadmapStore.getState().searchMatchIds).toEqual([CHILD_ID]);
		expect(screen.getByRole("status").textContent).toBe("1/1");
	});

	it("Enter steps to the next match and Escape clears the query", () => {
		seed();
		render(<TopBar />);
		const input = screen.getByLabelText("Search nodes");
		// "Root" and "Other" both contain an "o" (the matcher is case-folded).
		fireEvent.change(input, { target: { value: "o" } });
		expect(useRoadmapStore.getState().searchMatchIds).toEqual([
			ROOT_ID,
			OTHER_ID,
		]);

		fireEvent.keyDown(input, { key: "Enter" });
		expect(useRoadmapStore.getState().searchCurrentIndex).toBe(1);

		fireEvent.keyDown(input, { key: "Escape" });
		expect(useRoadmapStore.getState().searchQuery).toBe("");
		expect(useRoadmapStore.getState().searchMatchIds).toEqual([]);
	});

	it("takes the caret on the roadraven:focus-search event (Ctrl+F)", () => {
		seed();
		render(<TopBar />);

		fireEvent(window, new CustomEvent("roadraven:focus-search"));

		expect(document.activeElement).toBe(screen.getByLabelText("Search nodes"));
	});
});
