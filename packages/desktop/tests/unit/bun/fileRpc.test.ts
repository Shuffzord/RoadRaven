// v0.8.2 file UX — production file RPC handlers (bun/rpc/fileRpc.ts):
//   - loadFile reports linkedFiles (ownership-split companions, root excluded)
//   - closeFile stops watchers and resets the file session like newFile
//   - saveFileAs seeds the dialog and reports linkedFilesNotCopied (A6)
//
// Outbound boundaries (disk backups, settings, watchers, native dialog,
// atomic write) are mocked; refMap / saveFile session state stays real so
// the reset semantics are exercised end to end.
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../src/bun/backups", () => ({
	writeLoadBackup: vi.fn(() => "/tmp/ignored.bak.json"),
}));
vi.mock("../../../src/bun/settings", () => ({
	addRecentFile: vi.fn(),
}));
vi.mock("../../../src/bun/fileWatcher", () => ({
	watchFile: vi.fn(),
	stopAllWatchers: vi.fn(),
	markSelfWrite: vi.fn(),
}));
vi.mock("../../../src/bun/rpc/dialogRpc", () => ({
	pickSaveFilePath: vi.fn(async () => null),
}));
vi.mock("../../../src/bun/atomicWrite", () => ({
	atomicWrite: vi.fn(async () => undefined),
}));

import { atomicWrite } from "../../../src/bun/atomicWrite";
import { stopAllWatchers } from "../../../src/bun/fileWatcher";
import { getOwnership, resetRefMap } from "../../../src/bun/refMap";
import { pickSaveFilePath } from "../../../src/bun/rpc/dialogRpc";
import { createFileRpcHandlers } from "../../../src/bun/rpc/fileRpc";
import {
	getCachedMainPath,
	__resetSaveFileModuleForTests as resetSaveFile,
} from "../../../src/bun/saveFile";

// linked-root.json carries a full-shape $ref node (id/title/status + $ref),
// the way the ownership-split samples (samples/cfa-l1-roadmap.json) do —
// production loadFile Zod-validates BEFORE expanding $refs, so the bare
// { "$ref" } node in roadmap-with-refs.json is rejected on this path.
const FIXTURES = resolve(__dirname, "..", "..", "fixtures");
const MULTI_ROOT = join(FIXTURES, "linked-root.json");
const MULTI_PART = join(FIXTURES, "linked-part.json");
const SINGLE_ROOT = join(FIXTURES, "basic-schema.json");

function makeCtx() {
	const eventServerHandle = { setSidecarPath: vi.fn() };
	const mainWindow = {
		webview: {
			rpc: { send: { pushOwnershipMap: vi.fn(), pushEventLog: vi.fn() } },
		},
	};
	return {
		eventServerHandle,
		ctx: {
			getMainWindow: () => mainWindow as never,
			getEventServerHandle: () => eventServerHandle as never,
		},
	};
}

describe("fileRpc handlers (v0.8.2)", () => {
	beforeEach(() => {
		resetSaveFile();
		resetRefMap();
	});
	afterEach(() => {
		vi.clearAllMocks();
	});

	it("loadFile lists the $ref companion files as linkedFiles, root excluded", async () => {
		const { ctx } = makeCtx();
		const result = await createFileRpcHandlers(ctx).loadFile({
			path: MULTI_ROOT,
		});
		expect(result.data).not.toBeNull();
		expect(result.filePath).toBe(resolve(MULTI_ROOT));
		expect(result.linkedFiles).toEqual([resolve(MULTI_PART)]);
	});

	it("loadFile returns an empty linkedFiles for a single-file roadmap", async () => {
		const { ctx } = makeCtx();
		const result = await createFileRpcHandlers(ctx).loadFile({
			path: SINGLE_ROOT,
		});
		expect(result.data).not.toBeNull();
		expect(result.linkedFiles).toEqual([]);
	});

	it("closeFile stops watchers and resets the file session", async () => {
		const { ctx, eventServerHandle } = makeCtx();
		const handlers = createFileRpcHandlers(ctx);
		await handlers.loadFile({ path: MULTI_ROOT });
		expect(getCachedMainPath()).toBe(resolve(MULTI_ROOT));
		expect(getOwnership().size).toBeGreaterThan(0);

		expect(handlers.closeFile({})).toEqual({ ok: true });

		expect(stopAllWatchers).toHaveBeenCalled();
		expect(getCachedMainPath()).toBeNull();
		expect(getOwnership().size).toBe(0);
		expect(eventServerHandle.setSidecarPath).toHaveBeenLastCalledWith(null);
	});

	it("saveFileAs seeds the dialog with defaultPath/defaultName", async () => {
		const { ctx } = makeCtx();
		const handlers = createFileRpcHandlers(ctx);
		const loaded = await handlers.loadFile({ path: SINGLE_ROOT });
		if (!loaded.data) throw new Error("fixture failed to load");

		const result = await handlers.saveFileAs({
			schema: loaded.data,
			defaultPath: "C:/roadmaps",
			defaultName: "my-roadmap.json",
		});

		expect(pickSaveFilePath).toHaveBeenCalledWith({
			defaultPath: "C:/roadmaps",
			defaultName: "my-roadmap.json",
		});
		expect(result).toEqual({ filePath: null }); // dialog mock: cancelled
		expect(atomicWrite).not.toHaveBeenCalled();
	});

	it("saveFileAs writes the root only and reports linkedFilesNotCopied (A6)", async () => {
		const { ctx } = makeCtx();
		const handlers = createFileRpcHandlers(ctx);
		const loaded = await handlers.loadFile({ path: MULTI_ROOT });
		if (!loaded.data) throw new Error("fixture failed to load");

		const target = join(FIXTURES, "copy-of-roadmap.json");
		vi.mocked(pickSaveFilePath).mockResolvedValueOnce(target);

		const result = await handlers.saveFileAs({ schema: loaded.data });

		expect(result.filePath).toBe(resolve(target));
		expect(result.linkedFilesNotCopied).toEqual([resolve(MULTI_PART)]);
		expect(atomicWrite).toHaveBeenCalledTimes(1);
		expect(vi.mocked(atomicWrite).mock.calls[0][0]).toBe(resolve(target));
		// The new root owns every node now — no companions carried over.
		expect(new Set(getOwnership().values())).toEqual(
			new Set([resolve(target)]),
		);
	});
});
