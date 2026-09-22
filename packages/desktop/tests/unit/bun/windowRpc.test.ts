// v0.8.2 file UX — setWindowTitle / revealInFolder handlers (bun/rpc/windowRpc.ts).
// The platform seams are mocked; the handlers' own logic (exists guard,
// pass-through) is what's under test.
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../src/bun/platform/shell", () => ({
	showItemInFolder: vi.fn(() => ({ ok: true })),
	openExternal: vi.fn(() => ({ ok: true })),
}));
vi.mock("../../../src/bun/platform/window", () => ({
	setMainWindowTitle: vi.fn(),
}));

import {
	openExternal,
	showItemInFolder,
} from "../../../src/bun/platform/shell";
import { setMainWindowTitle } from "../../../src/bun/platform/window";
import { createWindowRpcHandlers } from "../../../src/bun/rpc/windowRpc";

const fakeWindow = { id: 1 } as never;

describe("windowRpc handlers", () => {
	const handlers = createWindowRpcHandlers({ getMainWindow: () => fakeWindow });

	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("setWindowTitle forwards the title to the platform seam", () => {
		handlers.setWindowTitle({ title: "roadmap.json — RoadRaven" });
		expect(setMainWindowTitle).toHaveBeenCalledWith(
			fakeWindow,
			"roadmap.json — RoadRaven",
		);
	});

	it("revealInFolder returns ok:false for a missing path without touching the seam", () => {
		const missing = join(__dirname, "does-not-exist-" + Date.now() + ".json");
		expect(handlers.revealInFolder({ path: missing })).toEqual({ ok: false });
		expect(showItemInFolder).not.toHaveBeenCalled();
	});

	it("revealInFolder calls the seam for an existing path and returns its result", () => {
		expect(handlers.revealInFolder({ path: __filename })).toEqual({ ok: true });
		expect(showItemInFolder).toHaveBeenCalledWith(__filename);
	});

	// v0.8.2 Phase 4: Preferences → About links.
	it("openExternal passes an https URL to the seam and returns its result", () => {
		const url = "https://github.com/Shuffzord/RoadRaven/releases/latest";
		expect(handlers.openExternal({ url })).toEqual({ ok: true });
		expect(openExternal).toHaveBeenCalledWith(url);
	});

	it("openExternal refuses non-https schemes without touching the seam", () => {
		expect(handlers.openExternal({ url: "file:///etc/passwd" })).toEqual({
			ok: false,
		});
		expect(handlers.openExternal({ url: "javascript:alert(1)" })).toEqual({
			ok: false,
		});
		expect(handlers.openExternal({ url: "http://example.com" })).toEqual({
			ok: false,
		});
		expect(openExternal).not.toHaveBeenCalled();
	});
});
