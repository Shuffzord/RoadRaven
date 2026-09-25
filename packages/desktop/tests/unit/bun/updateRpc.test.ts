// v0.8.5 Phase 1: the update RPC handlers only delegate to the service and
// forward its state — the service is the sole owner of UpdateState.
import { describe, expect, it, vi } from "vitest";
import { createUpdateRpcHandlers } from "../../../src/bun/rpc/updateRpc";
import type {
	UpdateService,
	UpdateState,
} from "../../../src/bun/updater/updateService";

function fakeService(initial: UpdateState) {
	let state = initial;
	const service = {
		getState: vi.fn(() => state),
		onStateChange: vi.fn(() => () => undefined),
		check: vi.fn(async () => {
			state = { status: "available", version: "9.9.9" };
			return state;
		}),
		download: vi.fn(async () => {
			state = { status: "ready", version: "9.9.9" };
			return state;
		}),
		apply: vi.fn(async () => undefined),
		scheduleLaunchCheck: vi.fn(() => () => undefined),
		setState(next: UpdateState) {
			state = next;
		},
	} satisfies UpdateService & { setState(next: UpdateState): void };
	return service;
}

describe("createUpdateRpcHandlers", () => {
	it("getUpdateState returns the service state", async () => {
		const service = fakeService({ status: "up-to-date", version: "0.8.5" });
		const handlers = createUpdateRpcHandlers({ service });
		expect(await handlers.getUpdateState({})).toEqual({
			status: "up-to-date",
			version: "0.8.5",
		});
		expect(service.getState).toHaveBeenCalled();
	});

	it("checkForUpdate delegates to check() and returns its state", async () => {
		const service = fakeService({ status: "idle" });
		const handlers = createUpdateRpcHandlers({ service });
		expect(await handlers.checkForUpdate({})).toEqual({
			status: "available",
			version: "9.9.9",
		});
		expect(service.check).toHaveBeenCalledTimes(1);
	});

	it("downloadUpdate delegates to download() and returns its state", async () => {
		const service = fakeService({ status: "available", version: "9.9.9" });
		const handlers = createUpdateRpcHandlers({ service });
		expect(await handlers.downloadUpdate({})).toEqual({
			status: "ready",
			version: "9.9.9",
		});
		expect(service.download).toHaveBeenCalledTimes(1);
	});

	it("applyUpdate returns ok:true when the service does not end in error", async () => {
		const service = fakeService({ status: "ready", version: "9.9.9" });
		const handlers = createUpdateRpcHandlers({ service });
		expect(await handlers.applyUpdate({})).toEqual({ ok: true });
		expect(service.apply).toHaveBeenCalledTimes(1);
	});

	it("applyUpdate returns ok:false with the message when the service ends in error", async () => {
		const service = fakeService({ status: "ready", version: "9.9.9" });
		service.apply.mockImplementation(async () => {
			service.setState({ status: "error", message: "Restart was cancelled" });
		});
		const handlers = createUpdateRpcHandlers({ service });
		expect(await handlers.applyUpdate({})).toEqual({
			ok: false,
			error: "Restart was cancelled",
		});
	});
});
