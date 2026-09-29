/** @vitest-environment jsdom */
// v0.8.5 Phase 2 (D-2) — the "update available" prompt asks before
// downloading; Later / Escape dismiss it for this launch. v0.8.7 — the same
// card follows the download to the restart offer.
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
	downloadUpdate: vi.fn(() => Promise.resolve("done")),
	pullUpdateState: vi.fn(() => Promise.resolve()),
	restartToUpdate: vi.fn(() => Promise.resolve("restarting")),
}));

vi.mock("../../../src/mainview/lib/updateActions", () => actions);

import { UpdateAvailableDialog } from "../../../src/mainview/components/UpdateAvailableDialog";
import {
	UPDATE_CLOSE_LABEL,
	UPDATE_DIALOG_TITLE_PREFIX,
	UPDATE_DOWNLOAD_LABEL,
	UPDATE_HIDE_LABEL,
	UPDATE_LATER_LABEL,
	UPDATE_PROGRESS_TESTID,
	UPDATE_RESTART_LABEL,
} from "../../../src/mainview/lib/domContract";
import { useUpdateStore } from "../../../src/mainview/store/updateStore";

const TITLE = `${UPDATE_DIALOG_TITLE_PREFIX} 0.8.6 is available`;
const DOWNLOADING_TITLE = `Downloading ${UPDATE_DIALOG_TITLE_PREFIX} 0.8.6…`;
const READY_TITLE = `${UPDATE_DIALOG_TITLE_PREFIX} 0.8.6 is ready`;

const ready: UpdateState = { status: "ready", version: "0.8.6" };
const downloading = (progress: number): UpdateState => ({
	status: "downloading",
	version: "0.8.6",
	progress,
});

function setUpdate(state: UpdateState): void {
	act(() => {
		useUpdateStore.getState().setState(state);
	});
}

function setAvailable(version = "0.8.6"): void {
	setUpdate({ status: "available", version });
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

	// v0.8.7: the card stays through the download and offers the restart.
	it("stays open while downloading with a progress bar and Hide", () => {
		render(<UpdateAvailableDialog />);
		setAvailable();
		setUpdate(downloading(42));

		expect(
			screen.getByRole("dialog", { name: DOWNLOADING_TITLE }),
		).toBeTruthy();
		expect(
			screen.getByTestId(UPDATE_PROGRESS_TESTID).getAttribute("aria-valuenow"),
		).toBe("42");
		expect(
			screen.getByRole("button", { name: UPDATE_HIDE_LABEL }),
		).toBeTruthy();
		expect(
			screen.queryByRole("button", { name: UPDATE_DOWNLOAD_LABEL }),
		).toBeNull();
		expect(useUpdateStore.getState().dismissedVersion).toBeNull();
	});

	it("shows an indeterminate bar before the first progress entry", () => {
		render(<UpdateAvailableDialog />);
		setAvailable();
		setUpdate(downloading(0));

		expect(
			screen.getByTestId(UPDATE_PROGRESS_TESTID).getAttribute("aria-valuenow"),
		).toBeNull();
	});

	it("Hide dismisses the version, and the ready phase stays hidden", () => {
		render(<UpdateAvailableDialog />);
		setAvailable();
		setUpdate(downloading(42));

		fireEvent.click(screen.getByRole("button", { name: UPDATE_HIDE_LABEL }));

		expect(useUpdateStore.getState().dismissedVersion).toBe("0.8.6");
		expect(screen.queryByRole("dialog")).toBeNull();
		setUpdate(ready);
		expect(screen.queryByRole("dialog")).toBeNull();
	});

	it("offers the restart once ready, Restart focused, and runs it", () => {
		render(<UpdateAvailableDialog />);
		setAvailable();
		setUpdate(downloading(42));
		setUpdate(ready);

		const restart = screen.getByRole("button", { name: UPDATE_RESTART_LABEL });
		expect(screen.getByRole("dialog", { name: READY_TITLE })).toBeTruthy();
		expect(document.activeElement).toBe(restart);

		fireEvent.click(restart);

		expect(actions.restartToUpdate).toHaveBeenCalledTimes(1);
	});

	it("opens in the ready phase for a bundle prepared earlier; Later dismisses", () => {
		render(<UpdateAvailableDialog />);
		setUpdate(ready);

		expect(screen.getByRole("dialog", { name: READY_TITLE })).toBeTruthy();

		fireEvent.click(screen.getByRole("button", { name: UPDATE_LATER_LABEL }));

		expect(useUpdateStore.getState().dismissedVersion).toBe("0.8.6");
		expect(screen.queryByRole("dialog")).toBeNull();
	});

	it("shows a download error for the version it showed; Close dismisses", () => {
		render(<UpdateAvailableDialog />);
		setAvailable();
		setUpdate(downloading(42));
		setUpdate({
			status: "error",
			message: "Failed to download update: HTTP 503",
		});

		expect(screen.getByRole("dialog", { name: "Update failed" })).toBeTruthy();
		expect(
			screen.getByText("Failed to download update: HTTP 503"),
		).toBeTruthy();

		fireEvent.click(screen.getByRole("button", { name: UPDATE_CLOSE_LABEL }));

		expect(useUpdateStore.getState().dismissedVersion).toBe("0.8.6");
		expect(screen.queryByRole("dialog")).toBeNull();
	});

	it("stays closed for an error before any version was shown", () => {
		render(<UpdateAvailableDialog />);
		setUpdate({
			status: "error",
			message: "Failed to check for updates: offline",
		});

		expect(screen.queryByRole("dialog")).toBeNull();
	});

	it("stays closed for an error after the version was dismissed", () => {
		render(<UpdateAvailableDialog />);
		setAvailable();
		fireEvent.click(screen.getByRole("button", { name: UPDATE_LATER_LABEL }));
		setUpdate({ status: "error", message: "boom" });

		expect(screen.queryByRole("dialog")).toBeNull();
	});
});
