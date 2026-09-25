/** @vitest-environment jsdom */
// v0.8.5 Phase 2 (D-2) — the "update available" prompt asks before
// downloading. Later / Escape dismiss it for this launch.
import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => ({
	downloadUpdate: vi.fn(() => Promise.resolve("done")),
	pullUpdateState: vi.fn(() => Promise.resolve()),
}));

vi.mock("../../../src/mainview/lib/updateActions", () => actions);

import { UpdateAvailableDialog } from "../../../src/mainview/components/UpdateAvailableDialog";
import {
	UPDATE_DIALOG_TITLE_PREFIX,
	UPDATE_DOWNLOAD_LABEL,
	UPDATE_LATER_LABEL,
} from "../../../src/mainview/lib/domContract";
import { useUpdateStore } from "../../../src/mainview/store/updateStore";

const TITLE = `${UPDATE_DIALOG_TITLE_PREFIX} 0.8.6 is available`;

function setAvailable(version = "0.8.6"): void {
	act(() => {
		useUpdateStore.getState().setState({ status: "available", version });
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

describe("UpdateAvailableDialog", () => {
	it("pulls the current update state once on mount", () => {
		render(<UpdateAvailableDialog />);
		expect(actions.pullUpdateState).toHaveBeenCalledTimes(1);
	});

	it("is closed while idle", () => {
		render(<UpdateAvailableDialog />);
		expect(screen.queryByRole("dialog")).toBeNull();
	});

	it("opens on available with a new version, Download focused", () => {
		render(<UpdateAvailableDialog />);
		setAvailable();

		expect(screen.getByRole("dialog", { name: TITLE })).toBeTruthy();
		expect(document.activeElement).toBe(
			screen.getByRole("button", { name: UPDATE_DOWNLOAD_LABEL }),
		);
	});

	it("Later dismisses the version and closes", () => {
		render(<UpdateAvailableDialog />);
		setAvailable();

		fireEvent.click(screen.getByRole("button", { name: UPDATE_LATER_LABEL }));

		expect(useUpdateStore.getState().dismissedVersion).toBe("0.8.6");
		expect(screen.queryByRole("dialog")).toBeNull();
		expect(actions.downloadUpdate).not.toHaveBeenCalled();
	});

	it("stays hidden for a dismissed version", () => {
		useUpdateStore.setState({ dismissedVersion: "0.8.6" });
		render(<UpdateAvailableDialog />);
		setAvailable();

		expect(screen.queryByRole("dialog")).toBeNull();
	});

	it("Escape dismisses like Later", () => {
		render(<UpdateAvailableDialog />);
		setAvailable();

		act(() => {
			fireEvent.keyDown(document.activeElement ?? document, { key: "Escape" });
		});

		expect(useUpdateStore.getState().dismissedVersion).toBe("0.8.6");
		expect(screen.queryByRole("dialog")).toBeNull();
	});

	it("Download calls the download action", () => {
		render(<UpdateAvailableDialog />);
		setAvailable();

		fireEvent.click(
			screen.getByRole("button", { name: UPDATE_DOWNLOAD_LABEL }),
		);

		expect(actions.downloadUpdate).toHaveBeenCalledTimes(1);
	});

	it("closes once the download starts", () => {
		render(<UpdateAvailableDialog />);
		setAvailable();
		act(() => {
			useUpdateStore
				.getState()
				.setState({ status: "downloading", version: "0.8.6", progress: 5 });
		});

		expect(screen.queryByRole("dialog")).toBeNull();
		expect(useUpdateStore.getState().dismissedVersion).toBeNull();
	});
});
