// v0.8.5 Phase 0: RED contract for the Phase 1 update service. The real
// Electrobun Updater reads ../Resources/version.json, so electrobun/bun is
// mocked and every call goes through the platform seam into these fakes.
import { beforeEach, describe, expect, it, vi } from "vitest";

const fakeUpdater = vi.hoisted(() => ({
	channel: "stable",
	checkForUpdate: vi.fn(),
	downloadUpdate: vi.fn(),
	applyUpdate: vi.fn(),
	onStatusChange: vi.fn(),
}));

vi.mock("electrobun/bun", () => {
	const Updater = {
		localInfo: { channel: async () => fakeUpdater.channel },
		checkForUpdate: fakeUpdater.checkForUpdate,
		downloadUpdate: fakeUpdater.downloadUpdate,
		applyUpdate: fakeUpdater.applyUpdate,
		onStatusChange: fakeUpdater.onStatusChange,
	};
	return { Updater, default: { Updater } };
});

import * as seam from "../../../src/bun/platform/updater";

// Phase 1 creates this module. The path is held in a variable so neither tsc
// nor fallow resolves it before it exists; Phase 1 turns it into a static import.
const SERVICE_MODULE = "../../../src/bun/updater/updateService";

async function loadService() {
	return await import(/* @vite-ignore */ SERVICE_MODULE);
}

describe("updateService (Phase 1 contract)", () => {
	beforeEach(() => {
		fakeUpdater.channel = "stable";
		fakeUpdater.checkForUpdate.mockReset();
		fakeUpdater.downloadUpdate.mockReset();
		fakeUpdater.applyUpdate.mockReset();
		fakeUpdater.onStatusChange.mockReset();
	});

	// Phase 1: the platform seam wraps the Updater operations.
	it.fails("the platform seam exports checkForUpdate, downloadUpdate, applyUpdate, onStatusChange", () => {
		expect("checkForUpdate" in seam).toBe(true);
		expect("downloadUpdate" in seam).toBe(true);
		expect("applyUpdate" in seam).toBe(true);
		expect("onStatusChange" in seam).toBe(true);
	});

	// Phase 1: the dev channel never talks to the update server.
	it.fails("reports disabled on the dev channel and never calls checkForUpdate", async () => {
		fakeUpdater.channel = "dev";
		const { createUpdateService } = await loadService();
		const service = createUpdateService({
			flushPending: async () => undefined,
		});
		await service.check();
		expect(service.getState()).toMatchObject({ status: "disabled" });
		expect(fakeUpdater.checkForUpdate).not.toHaveBeenCalled();
	});

	// Phase 1: an available update moves the state and notifies listeners.
	it.fails("check() moves the state to available with the manifest version", async () => {
		fakeUpdater.checkForUpdate.mockResolvedValue({
			updateAvailable: true,
			updateReady: false,
			version: "9.9.9",
			hash: "abc",
			error: "",
		});
		const { createUpdateService } = await loadService();
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
	it.fails("apply() awaits flushPending before calling applyUpdate", async () => {
		const order: string[] = [];
		const flushPending = vi.fn(async () => {
			order.push("flush-start");
			await new Promise((r) => setTimeout(r, 20));
			order.push("flush-end");
		});
		fakeUpdater.applyUpdate.mockImplementation(async () => {
			order.push("apply");
		});
		const { createUpdateService } = await loadService();
		const service = createUpdateService({ flushPending });
		await service.apply();
		expect(order).toEqual(["flush-start", "flush-end", "apply"]);
	});
});
