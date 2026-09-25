/** @vitest-environment jsdom */
// v0.8.2 D3 — the filename left the footer for the top-bar DocumentChip. The
// footer keeps the Event API pill, the save indicator and the node count.
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { RoadmapSchema } from "../../../../../packages/core/src/schema";
import pkg from "../../../package.json" with { type: "json" };
import { StatusBar } from "../../../src/mainview/components/StatusBar";
import { UPDATE_PILL_TESTID } from "../../../src/mainview/lib/domContract";
import { useRoadmapStore } from "../../../src/mainview/store/roadmapStore";
import { useUpdateStore } from "../../../src/mainview/store/updateStore";
import { resetStore } from "../../helpers/resetStore";

const ROOT_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const CHILD_ID = "11111111-2222-4333-8444-555555555555";
const SCHEMA: RoadmapSchema = {
	version: "1.0",
	title: "Footer fixture",
	nodes: [
		{
			id: ROOT_ID,
			title: "Root",
			status: "not-started",
			children: [{ id: CHILD_ID, title: "Child", status: "not-started" }],
		},
	],
};

afterEach(() => {
	resetStore();
	useUpdateStore.setState({
		state: { status: "idle" },
		dismissedVersion: null,
	});
});

describe("StatusBar", () => {
	it("no longer shows the filename", () => {
		useRoadmapStore.getState().loadSchema(SCHEMA, "/tmp/footer-plan.json");
		render(<StatusBar />);

		expect(screen.queryByText("footer-plan.json")).toBeNull();
		expect(screen.queryByText(/No file loaded/)).toBeNull();
	});

	it("keeps the save indicator and the node count", () => {
		useRoadmapStore.getState().loadSchema(SCHEMA, "/tmp/footer-plan.json");
		render(<StatusBar />);

		expect(screen.getByText("Saved")).toBeTruthy();
		expect(screen.getByText("2 nodes")).toBeTruthy();
	});

	it("keeps the Event API pill on the left", () => {
		render(<StatusBar />);
		expect(screen.getByText(/Event API off/)).toBeTruthy();
	});

	it("shows the app version from packages/desktop/package.json", () => {
		render(<StatusBar />);

		const label = screen.getByText(`v${pkg.version}`);
		expect(label.getAttribute("title")).toBe(`RoadRaven ${pkg.version}`);
	});

	// v0.8.5 Phase 2: the update pill sits before the version, only when ready.
	it("has no update pill while the update state is idle", () => {
		render(<StatusBar />);
		expect(screen.queryByTestId(UPDATE_PILL_TESTID)).toBeNull();
	});

	it("shows the update pill when an update is ready", () => {
		useUpdateStore.getState().setState({ status: "ready", version: "0.8.6" });
		render(<StatusBar />);
		expect(screen.getByTestId(UPDATE_PILL_TESTID)).toBeTruthy();
	});
});
