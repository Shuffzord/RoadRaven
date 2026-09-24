// v0.8.2 A1 — the renderer's confirmClose handler answers Bun's will-close
// guard with ensureSafeToDiscard's verdict.
import { beforeEach, describe, expect, it, vi } from "vitest";

const captured = vi.hoisted(() => ({
	config: null as null | {
		handlers: {
			requests: {
				confirmClose: (params: Record<string, never>) => Promise<{
					allow: boolean;
				}>;
			};
		};
	},
}));

const guard = vi.hoisted(() => ({
	ensureSafeToDiscard: vi.fn<() => Promise<boolean>>(),
}));

vi.mock("electrobun/view", () => ({
	Electroview: class {
		static defineRPC(config: typeof captured.config) {
			captured.config = config;
			return config;
		}
		constructor() {
			throw new Error("outside Electrobun");
		}
	},
}));

vi.mock("../../../src/mainview/hooks/useFileActions", () => guard);

import "../../../src/mainview/rpc";

beforeEach(() => {
	guard.ensureSafeToDiscard.mockReset();
});

describe("mainview rpc — confirmClose", () => {
	it("allows the close when the guard says the document is safe to discard", async () => {
		guard.ensureSafeToDiscard.mockResolvedValue(true);
		await expect(
			captured.config?.handlers.requests.confirmClose({}),
		).resolves.toEqual({ allow: true });
		expect(guard.ensureSafeToDiscard).toHaveBeenCalledTimes(1);
	});

	it("denies the close when the guard says no (cancelled prompt, failed flush)", async () => {
		guard.ensureSafeToDiscard.mockResolvedValue(false);
		await expect(
			captured.config?.handlers.requests.confirmClose({}),
		).resolves.toEqual({ allow: false });
	});
});
