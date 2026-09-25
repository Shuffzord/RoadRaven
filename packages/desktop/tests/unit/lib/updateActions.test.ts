// v0.8.5 Phase 2 — update actions: one function per user action, shared by
// the prompt, the pill and Preferences. restartToUpdate must run the unsaved
// work guard BEFORE applyUpdate (Phase 0 R3: Updater.applyUpdate bypasses the
// window will-close guard).
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { UpdateState } from "../../../../../shared/types";

const mocks = vi.hoisted(() => {
	const calls: string[] = [];
	const request = {
		getUpdateState: vi.fn(),
		checkForUpdate: vi.fn(),
		downloadUpdate: vi.fn(),
		applyUpdate: vi.fn(),
	};
	const view: { rpc: { request: typeof request } | undefined } = {
		rpc: { request },
	};
	return {
		calls,
		request,
		view,
		ensureSafeToDiscard: vi.fn(),
	};
});

vi.mock("../../../src/mainview/rpc", () => ({ electroview: mocks.view }));
vi.mock("../../../src/mainview/hooks/useFileActions", () => ({
	ensureSafeToDiscard: mocks.ensureSafeToDiscard,
}));

import {
	checkForUpdates,
	describeUpdateState,
	downloadUpdate,
	pullUpdateState,
	restartToUpdate,
} from "../../../src/mainview/lib/updateActions";
import { useUpdateStore } from "../../../src/mainview/store/updateStore";

// Same string as RESTART_CANCELLED in src/bun/updater/updateService.ts:31.
// Re-typed: importing that module pulls electrobun/bun (via
// src/bun/platform/updater.ts) into this renderer test's graph.
const RESTART_CANCELLED = "Restart was cancelled";

beforeEach(() => {
	vi.clearAllMocks();
	mocks.calls.length = 0;
	mocks.view.rpc = { request: mocks.request };
	useUpdateStore.setState({
		state: { status: "idle" },
		dismissedVersion: null,
	});
	mocks.ensureSafeToDiscard.mockImplementation(async () => {
		mocks.calls.push("guard");
		return true;
	});
	mocks.request.applyUpdate.mockImplementation(async () => {
		mocks.calls.push("apply");
		return { ok: true };
	});
});

describe("restartToUpdate", () => {
	it("runs ensureSafeToDiscard before applyUpdate", async () => {
		expect(await restartToUpdate()).toBe("restarting");
		expect(mocks.calls).toEqual(["guard", "apply"]);
	});

	it("does not call applyUpdate when the guard says no", async () => {
		mocks.ensureSafeToDiscard.mockResolvedValue(false);
		expect(await restartToUpdate()).toBe("cancelled");
		expect(mocks.request.applyUpdate).not.toHaveBeenCalled();
	});

	it("{ ok: false } puts the store in error and returns failed", async () => {
		useUpdateStore.getState().setState({ status: "ready", version: "0.8.6" });
		mocks.request.applyUpdate.mockResolvedValue({
			ok: false,
			error: RESTART_CANCELLED,
		});
		expect(await restartToUpdate()).toBe("failed");
		expect(useUpdateStore.getState().state).toEqual({
			status: "error",
			message: RESTART_CANCELLED,
		});
	});

	it("leaves the store alone on success (the process is about to quit)", async () => {
		useUpdateStore.getState().setState({ status: "ready", version: "0.8.6" });
		await restartToUpdate();
		expect(useUpdateStore.getState().state).toEqual({
			status: "ready",
			version: "0.8.6",
		});
	});

	it("ignores a second call while the guard is pending", async () => {
		let resolveGuard: (ok: boolean) => void = () => {
			// Reassigned by mockImplementation below before any call resolves.
		};
		mocks.ensureSafeToDiscard.mockImplementation(
			() =>
				new Promise<boolean>((resolve) => {
					resolveGuard = resolve;
				}),
		);

		const first = restartToUpdate();
		const second = restartToUpdate();
		expect(mocks.ensureSafeToDiscard).toHaveBeenCalledTimes(1);

		resolveGuard(true);
		const [firstResult, secondResult] = await Promise.all([first, second]);
		expect(firstResult).toBe("restarting");
		expect(secondResult).toBe(firstResult);

		// Guard resolved — a third call is a fresh invocation.
		mocks.ensureSafeToDiscard.mockResolvedValue(true);
		await restartToUpdate();
		expect(mocks.ensureSafeToDiscard).toHaveBeenCalledTimes(2);
	});
});

describe("check / download / pull", () => {
	it("checkForUpdates stores the response", async () => {
		const next: UpdateState = { status: "available", version: "0.8.6" };
		mocks.request.checkForUpdate.mockResolvedValue(next);
		expect(await checkForUpdates()).toBe("done");
		expect(mocks.request.checkForUpdate).toHaveBeenCalledWith({});
		expect(useUpdateStore.getState().state).toEqual(next);
	});

	it("downloadUpdate stores the response", async () => {
		const next: UpdateState = { status: "ready", version: "0.8.6" };
		mocks.request.downloadUpdate.mockResolvedValue(next);
		expect(await downloadUpdate()).toBe("done");
		expect(mocks.request.downloadUpdate).toHaveBeenCalledWith({});
		expect(useUpdateStore.getState().state).toEqual(next);
	});

	it("pullUpdateState seeds the store from getUpdateState", async () => {
		const next: UpdateState = { status: "available", version: "0.8.6" };
		mocks.request.getUpdateState.mockResolvedValue(next);
		await pullUpdateState();
		expect(useUpdateStore.getState().state).toEqual(next);
	});

	it("a rejected request leaves the store as it was", async () => {
		mocks.request.checkForUpdate.mockRejectedValue(new Error("rpc down"));
		mocks.request.getUpdateState.mockRejectedValue(new Error("rpc down"));
		expect(await checkForUpdates()).toBe("failed");
		await pullUpdateState();
		expect(useUpdateStore.getState().state).toEqual({ status: "idle" });
	});
});

describe("without Electrobun RPC (HMR dev server)", () => {
	it("every action returns unavailable and calls nothing", async () => {
		mocks.view.rpc = undefined;
		expect(await checkForUpdates()).toBe("unavailable");
		expect(await downloadUpdate()).toBe("unavailable");
		expect(await restartToUpdate()).toBe("unavailable");
		await pullUpdateState();
		expect(mocks.ensureSafeToDiscard).not.toHaveBeenCalled();
		expect(useUpdateStore.getState().state).toEqual({ status: "idle" });
	});
});

describe("describeUpdateState", () => {
	it.each<[UpdateState, string]>([
		[{ status: "idle" }, "Not checked yet."],
		[
			{ status: "up-to-date", version: "0.8.5" },
			"You're on the latest version.",
		],
		[{ status: "checking" }, "Checking…"],
		[{ status: "available", version: "0.8.6" }, "Version 0.8.6 is available."],
		[
			{ status: "downloading", version: "0.8.6", progress: 42.4 },
			"Downloading version 0.8.6… 42 %",
		],
		[
			{ status: "ready", version: "0.8.6" },
			"Version 0.8.6 is ready. Restart to update.",
		],
		[{ status: "error", message: "offline" }, "offline"],
		[
			{
				status: "error",
				message: "Failed to check for updates: fetch failed",
			},
			"Failed to check for updates: fetch failed",
		],
		[{ status: "error", message: RESTART_CANCELLED }, RESTART_CANCELLED],
		[
			{ status: "disabled", reason: "dev" },
			"Updates are disabled in dev builds.",
		],
	])("%o → %s", (state, text) => {
		expect(describeUpdateState(state)).toBe(text);
	});
});
