// v0.8.5 update service. Phase 0 wrote the first four cases as the RED
// contract; Phase 1 flipped them. The real Electrobun Updater reads
// ../Resources/version.json, so electrobun/bun is mocked and every call goes
// through the platform seam into these fakes.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fakeUpdater = vi.hoisted(() => ({
	channel: "stable",
	checkForUpdate: vi.fn(),
	downloadUpdate: vi.fn(),
	applyUpdate: vi.fn(),
	onStatusChange: vi.fn(),
	updateInfo: vi.fn(),
}));

const fakeLog = vi.hoisted(() => ({
	debug: vi.fn(),
	info: vi.fn(),
	warn: vi.fn(),
	error: vi.fn(),
}));

vi.mock("electrobun/bun", () => {
	const Updater = {
		localInfo: { channel: async () => fakeUpdater.channel },
		checkForUpdate: fakeUpdater.checkForUpdate,
		downloadUpdate: fakeUpdater.downloadUpdate,
		applyUpdate: fakeUpdater.applyUpdate,
		onStatusChange: fakeUpdater.onStatusChange,
		updateInfo: fakeUpdater.updateInfo,
	};
	return { Updater, default: { Updater } };
});

vi.mock("../../../src/bun/logging", () => ({
	bunLogger: { getChild: () => fakeLog },
}));

import type { UpdateStatusEntry } from "../../../src/bun/platform/updater";
import * as seam from "../../../src/bun/platform/updater";
import {
	createUpdateService,
	RESTART_CANCELLED,
	reduceStatusEntry,
	type UpdateState,
} from "../../../src/bun/updater/updateService";

const noFlush = async () => undefined;

function entry(
	status: UpdateStatusEntry["status"],
	details?: UpdateStatusEntry["details"],
	message: string = status,
): UpdateStatusEntry {
	return { status, message, timestamp: 0, details };
}

/** The status callback the service registered on the seam. */
function emitStatus(e: UpdateStatusEntry): void {
	const cb = fakeUpdater.onStatusChange.mock.calls[0]?.[0];
	cb(e);
}

function available(version = "9.9.9") {
	return {
		updateAvailable: true,
		updateReady: false,
		version,
		hash: "abc",
		error: "",
	};
}

describe("updateService (Phase 1 contract)", () => {
	beforeEach(() => {
		fakeUpdater.channel = "stable";
		fakeUpdater.checkForUpdate.mockReset();
		fakeUpdater.downloadUpdate.mockReset();
		fakeUpdater.applyUpdate.mockReset();
		fakeUpdater.onStatusChange.mockReset();
		fakeUpdater.updateInfo.mockReset();
		for (const fn of Object.values(fakeLog)) fn.mockReset();
	});

	// Phase 1: the platform seam wraps the Updater operations.
	it("the platform seam exports checkForUpdate, downloadUpdate, applyUpdate, onStatusChange", () => {
		expect("checkForUpdate" in seam).toBe(true);
		expect("downloadUpdate" in seam).toBe(true);
		expect("applyUpdate" in seam).toBe(true);
		expect("onStatusChange" in seam).toBe(true);
	});

	// Phase 1: the dev channel never talks to the update server.
	it("reports disabled on the dev channel and never calls checkForUpdate", async () => {
		fakeUpdater.channel = "dev";
		const service = createUpdateService({
			flushPending: async () => undefined,
		});
		await service.check();
		expect(service.getState()).toMatchObject({ status: "disabled" });
		expect(fakeUpdater.checkForUpdate).not.toHaveBeenCalled();
	});

	// Phase 1: an available update moves the state and notifies listeners.
	it("check() moves the state to available with the manifest version", async () => {
		fakeUpdater.checkForUpdate.mockResolvedValue({
			updateAvailable: true,
			updateReady: false,
			version: "9.9.9",
			hash: "abc",
			error: "",
		});
		const service = createUpdateService({
			flushPending: async () => undefined,
		});
		const listener = vi.fn();
		service.onStateChange(listener);
		await service.check();
		expect(service.getState()).toMatchObject({
			status: "available",
			version: "9.9.9",
		});
		expect(listener).toHaveBeenCalledWith(
			expect.objectContaining({ status: "available", version: "9.9.9" }),
		);
	});

	// Phase 1: pending saves are flushed before the updater quits the app.
	it("apply() awaits flushPending before calling applyUpdate", async () => {
		const order: string[] = [];
		const flushPending = vi.fn(async () => {
			order.push("flush-start");
			await new Promise((r) => setTimeout(r, 20));
			order.push("flush-end");
		});
		fakeUpdater.applyUpdate.mockImplementation(async () => {
			order.push("apply");
		});
		const service = createUpdateService({ flushPending });
		await service.apply();
		expect(order).toEqual(["flush-start", "flush-end", "apply"]);
	});
});

describe("reduceStatusEntry", () => {
	const downloading: UpdateState = {
		status: "downloading",
		version: "1.2.3",
		progress: 40,
	};

	it.each([
		[
			"download-progress sets progress and keeps version",
			downloading,
			entry("download-progress", { progress: 55 }),
			{ status: "downloading", version: "1.2.3", progress: 55 },
		],
		[
			"download-progress clamps above 100",
			downloading,
			entry("download-progress", { progress: 140 }),
			{ status: "downloading", version: "1.2.3", progress: 100 },
		],
		[
			"download-progress clamps below 0",
			downloading,
			entry("download-progress", { progress: -5 }),
			{ status: "downloading", version: "1.2.3", progress: 0 },
		],
		[
			"download-progress without a value keeps the last one",
			downloading,
			entry("download-progress"),
			downloading,
		],
		[
			"download-progress from available starts downloading",
			{ status: "available", version: "1.2.3" },
			entry("download-progress", { progress: 3 }),
			{ status: "downloading", version: "1.2.3", progress: 3 },
		],
		[
			"download-progress outside a download is ignored",
			{ status: "idle" },
			entry("download-progress", { progress: 3 }),
			{ status: "idle" },
		],
		[
			"download-complete moves to ready",
			downloading,
			entry("download-complete"),
			{ status: "ready", version: "1.2.3" },
		],
		[
			"download-complete outside a download is ignored",
			{ status: "up-to-date", version: "1.0.0" },
			entry("download-complete"),
			{ status: "up-to-date", version: "1.0.0" },
		],
		[
			"error moves to error with the entry message",
			downloading,
			entry("error", undefined, "boom"),
			{ status: "error", message: "boom" },
		],
		[
			"idle (before-quit veto) moves to error",
			{ status: "ready", version: "1.2.3" },
			entry("idle"),
			{ status: "error", message: RESTART_CANCELLED },
		],
		[
			"patch-not-found leaves progress alone",
			downloading,
			entry("patch-not-found"),
			downloading,
		],
		[
			"decompressing leaves the state alone",
			downloading,
			entry("decompressing"),
			downloading,
		],
	] as Array<
		[string, UpdateState, UpdateStatusEntry, UpdateState]
	>)("%s", (_name, state, e, expected) => {
		expect(reduceStatusEntry(state, e)).toEqual(expected);
	});
});

describe("updateService", () => {
	beforeEach(() => {
		fakeUpdater.channel = "stable";
		fakeUpdater.checkForUpdate.mockReset();
		fakeUpdater.downloadUpdate.mockReset();
		fakeUpdater.applyUpdate.mockReset();
		fakeUpdater.onStatusChange.mockReset();
		fakeUpdater.updateInfo.mockReset();
		for (const fn of Object.values(fakeLog)) fn.mockReset();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("starts idle and registers one status callback at creation", async () => {
		const service = createUpdateService({ flushPending: noFlush });
		expect(service.getState()).toEqual({ status: "idle" });
		fakeUpdater.checkForUpdate.mockResolvedValue(available());
		await service.check();
		await service.check();
		expect(fakeUpdater.onStatusChange).toHaveBeenCalledTimes(1);
	});

	it("treats any channel other than canary/stable as disabled", async () => {
		fakeUpdater.channel = "beta";
		const service = createUpdateService({ flushPending: noFlush });
		expect(await service.check()).toEqual({
			status: "disabled",
			reason: "dev",
		});
		expect(fakeUpdater.checkForUpdate).not.toHaveBeenCalled();
	});

	it("check() on canary passes through checking and ends up-to-date with the current version", async () => {
		fakeUpdater.channel = "canary";
		fakeUpdater.checkForUpdate.mockResolvedValue({
			...available("0.8.5"),
			updateAvailable: false,
		});
		const service = createUpdateService({ flushPending: noFlush });
		const seen: string[] = [];
		service.onStateChange((s) => seen.push(s.status));
		expect(await service.check()).toEqual({
			status: "up-to-date",
			version: "0.8.5",
		});
		expect(seen).toEqual(["checking", "up-to-date"]);
	});

	it("check() maps a non-empty UpdateInfo.error to error", async () => {
		fakeUpdater.checkForUpdate.mockResolvedValue({
			...available(""),
			updateAvailable: false,
			error: "Failed to check for updates: HTTP 404",
		});
		const service = createUpdateService({ flushPending: noFlush });
		expect(await service.check()).toEqual({
			status: "error",
			message: "Failed to check for updates: HTTP 404",
		});
		expect(fakeLog.warn).toHaveBeenCalled();
	});

	it("check() maps a thrown fetch error to error, logs at warn and does not throw", async () => {
		fakeUpdater.checkForUpdate.mockRejectedValue(new TypeError("fetch failed"));
		const service = createUpdateService({ flushPending: noFlush });
		await expect(service.check()).resolves.toEqual({
			status: "error",
			message: "Failed to check for updates: fetch failed",
		});
		expect(fakeLog.warn).toHaveBeenCalledTimes(1);
	});

	it("logs every state transition at info", async () => {
		fakeUpdater.checkForUpdate.mockResolvedValue(available());
		const service = createUpdateService({ flushPending: noFlush });
		await service.check();
		expect(fakeLog.info).toHaveBeenCalledTimes(2); // idle->checking, checking->available
	});

	it("concurrent check() calls share one seam call", async () => {
		let resolve: (v: unknown) => void = () => undefined;
		fakeUpdater.checkForUpdate.mockReturnValue(
			new Promise((r) => {
				resolve = r;
			}),
		);
		const service = createUpdateService({ flushPending: noFlush });
		const a = service.check();
		const b = service.check();
		await vi.waitFor(() =>
			expect(fakeUpdater.checkForUpdate).toHaveBeenCalledTimes(1),
		);
		resolve(available());
		expect(await a).toEqual(await b);
		expect(fakeUpdater.checkForUpdate).toHaveBeenCalledTimes(1);
		// A later call starts a fresh check.
		await service.check();
		expect(fakeUpdater.checkForUpdate).toHaveBeenCalledTimes(2);
	});

	it("download() from idle is a no-op", async () => {
		const service = createUpdateService({ flushPending: noFlush });
		expect(await service.download()).toEqual({ status: "idle" });
		expect(fakeUpdater.downloadUpdate).not.toHaveBeenCalled();
	});

	it("download() goes available -> downloading (progress) -> ready from status entries", async () => {
		fakeUpdater.checkForUpdate.mockResolvedValue(available("0.8.6"));
		fakeUpdater.downloadUpdate.mockImplementation(async () => {
			emitStatus(entry("download-starting"));
			emitStatus(entry("patch-not-found"));
			emitStatus(entry("download-progress", { progress: 50 }));
			emitStatus(entry("download-complete"));
		});
		const service = createUpdateService({ flushPending: noFlush });
		await service.check();
		const seen: UpdateState[] = [];
		service.onStateChange((s) => seen.push(s));
		expect(await service.download()).toEqual({
			status: "ready",
			version: "0.8.6",
		});
		expect(seen).toEqual([
			{ status: "downloading", version: "0.8.6", progress: 0 },
			{ status: "downloading", version: "0.8.6", progress: 50 },
			{ status: "ready", version: "0.8.6" },
		]);
		expect(fakeUpdater.updateInfo).not.toHaveBeenCalled();
	});

	it("download() ends in error on an error status entry", async () => {
		fakeUpdater.checkForUpdate.mockResolvedValue(available());
		fakeUpdater.downloadUpdate.mockImplementation(async () => {
			emitStatus(entry("error", undefined, "disk full"));
		});
		const service = createUpdateService({ flushPending: noFlush });
		await service.check();
		expect(await service.download()).toEqual({
			status: "error",
			message: "disk full",
		});
	});

	it("download() maps a thrown error to error", async () => {
		fakeUpdater.checkForUpdate.mockResolvedValue(available());
		fakeUpdater.downloadUpdate.mockRejectedValue(new Error("network down"));
		const service = createUpdateService({ flushPending: noFlush });
		await service.check();
		expect(await service.download()).toEqual({
			status: "error",
			message: "network down",
		});
	});

	it("download() settles from updateInfo when no final status entry arrived", async () => {
		fakeUpdater.checkForUpdate.mockResolvedValue(available("0.8.6"));
		fakeUpdater.downloadUpdate.mockResolvedValue(undefined);
		fakeUpdater.updateInfo.mockReturnValue({
			...available("0.8.6"),
			updateReady: true,
		});
		const service = createUpdateService({ flushPending: noFlush });
		await service.check();
		expect(await service.download()).toEqual({
			status: "ready",
			version: "0.8.6",
		});

		fakeUpdater.updateInfo.mockReturnValue(available("0.8.6"));
		const other = createUpdateService({ flushPending: noFlush });
		await other.check();
		expect(await other.download()).toEqual({
			status: "error",
			message: "Download did not complete",
		});
	});

	it("check() while downloading or ready leaves the state alone", async () => {
		fakeUpdater.checkForUpdate.mockResolvedValue(available("0.8.6"));
		fakeUpdater.downloadUpdate.mockImplementation(async () => {
			emitStatus(entry("download-complete"));
		});
		const service = createUpdateService({ flushPending: noFlush });
		await service.check();
		await service.download();
		expect(await service.check()).toEqual({
			status: "ready",
			version: "0.8.6",
		});
		expect(fakeUpdater.checkForUpdate).toHaveBeenCalledTimes(1);
	});

	it("apply() with a vetoed restart ends in error", async () => {
		fakeUpdater.applyUpdate.mockImplementation(async () => {
			emitStatus(
				entry(
					"idle",
					undefined,
					"Update restart was cancelled by a before-quit handler",
				),
			);
		});
		const service = createUpdateService({ flushPending: noFlush });
		await service.apply();
		expect(service.getState()).toEqual({
			status: "error",
			message: RESTART_CANCELLED,
		});
	});

	it("apply() does not call applyUpdate when flushPending throws", async () => {
		const service = createUpdateService({
			flushPending: async () => {
				throw new Error("save failed");
			},
		});
		await service.apply();
		expect(fakeUpdater.applyUpdate).not.toHaveBeenCalled();
		expect(service.getState()).toEqual({
			status: "error",
			message: "save failed",
		});
	});

	it("onStateChange returns an unsubscribe function", async () => {
		fakeUpdater.checkForUpdate.mockResolvedValue(available());
		const service = createUpdateService({ flushPending: noFlush });
		const listener = vi.fn();
		const off = service.onStateChange(listener);
		off();
		await service.check();
		expect(listener).not.toHaveBeenCalled();
	});

	it("scheduleLaunchCheck with enabled:false never calls the seam", async () => {
		vi.useFakeTimers();
		const service = createUpdateService({ flushPending: noFlush });
		service.scheduleLaunchCheck({ enabled: false, delayMs: 10_000 })();
		await vi.advanceTimersByTimeAsync(60_000);
		expect(fakeUpdater.checkForUpdate).not.toHaveBeenCalled();
		expect(service.getState()).toEqual({ status: "idle" });
	});

	it("scheduleLaunchCheck with enabled:true checks once after the delay", async () => {
		vi.useFakeTimers();
		fakeUpdater.checkForUpdate.mockResolvedValue(available());
		const service = createUpdateService({ flushPending: noFlush });
		service.scheduleLaunchCheck({ enabled: true, delayMs: 10_000 });
		await vi.advanceTimersByTimeAsync(9_999);
		expect(fakeUpdater.checkForUpdate).not.toHaveBeenCalled();
		await vi.advanceTimersByTimeAsync(60_000);
		expect(fakeUpdater.checkForUpdate).toHaveBeenCalledTimes(1);
		expect(service.getState()).toMatchObject({ status: "available" });
	});

	it("scheduleLaunchCheck's cancel function prevents the check", async () => {
		vi.useFakeTimers();
		const service = createUpdateService({ flushPending: noFlush });
		const cancel = service.scheduleLaunchCheck({
			enabled: true,
			delayMs: 10_000,
		});
		cancel();
		await vi.advanceTimersByTimeAsync(60_000);
		expect(fakeUpdater.checkForUpdate).not.toHaveBeenCalled();
	});
});
