/** @vitest-environment jsdom */
// v0.8.5 Phase 2 — the status-bar pill offers the restart once an update is
// ready; a click runs the same restart action as Preferences. v0.8.7 — it
// also reports the download in progress.
import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { UpdateState } from "../../../../../shared/types";

const actions = vi.hoisted(() => ({
	restartToUpdate: vi.fn(() => Promise.resolve("restarting")),
}));

vi.mock("../../../src/mainview/lib/updateActions", () => actions);

import { UpdatePill } from "../../../src/mainview/components/UpdatePill";
import { UPDATE_PILL_TESTID } from "../../../src/mainview/lib/domContract";
import { useUpdateStore } from "../../../src/mainview/store/updateStore";

function setUpdate(state: UpdateState): void {
	act(() => {
		useUpdateStore.getState().setState(state);
	});
}

beforeEach(() => {
	vi.clearAllMocks();
	useUpdateStore.setState({
		state: { status: "idle" },
		dismissedVersion: null,
	});
});

afterEach(() => {
	cleanup();
});

describe("UpdatePill", () => {
	it.each<UpdateState>([
		{ status: "idle" },
		{ status: "disabled", reason: "dev" },
		{ status: "checking" },
		{ status: "up-to-date", version: "0.8.5" },
		{ status: "available", version: "0.8.6" },
		{ status: "error", message: "boom" },
	])("renders nothing while $status", (state) => {
		render(<UpdatePill />);
		setUpdate(state);
		expect(screen.queryByTestId(UPDATE_PILL_TESTID)).toBeNull();
	});

	it("reports download progress without a click target", () => {
		render(<UpdatePill />);
		setUpdate({ status: "downloading", version: "0.8.6", progress: 42 });

		const pill = screen.getByTestId(UPDATE_PILL_TESTID);
		expect(pill.textContent).toBe("↓ Downloading 42%");
		expect(pill.tagName).toBe("SPAN");
		expect(pill.getAttribute("title")).toBe("Downloading version 0.8.6.");
	});

	it("stays indeterminate before the first progress entry", () => {
		render(<UpdatePill />);
		setUpdate({ status: "downloading", version: "0.8.6", progress: 0 });

		expect(screen.getByTestId(UPDATE_PILL_TESTID).textContent).toBe(
			"↓ Downloading…",
		);
	});

	it("shows for ready with the version in its tooltip", () => {
		render(<UpdatePill />);
		setUpdate({ status: "ready", version: "0.8.6" });

		const pill = screen.getByTestId(UPDATE_PILL_TESTID);
		expect(pill.textContent).toBe("● Update ready");
		expect(pill.getAttribute("title")).toBe(
			"Version 0.8.6 is downloaded. Click to restart and update.",
		);
	});

	it("click runs restartToUpdate", () => {
		render(<UpdatePill />);
		setUpdate({ status: "ready", version: "0.8.6" });

		fireEvent.click(screen.getByTestId(UPDATE_PILL_TESTID));

		expect(actions.restartToUpdate).toHaveBeenCalledTimes(1);
	});
});
