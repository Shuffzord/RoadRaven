/** @vitest-environment jsdom */
// v0.8.2 Phase 1b — the module-level file actions: saveAs (dialog defaults,
// A6 warning, linkedFiles reset), closeFile (A2 + guard), newRoadmap (F7: no
// Save dialog), openSample (A5: untitled), revealInFolder, copyPath, and the
// linkedFiles hand-off from loadFile.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RoadmapSchema } from "../../../../../packages/core/src/schema";

const rpcMocks = vi.hoisted(() => ({
	saveFileAs: vi.fn(),
	closeFile: vi.fn(),
	newFile: vi.fn(),
	revealInFolder: vi.fn(),
	loadFile: vi.fn(),
	openFilePicker: vi.fn(),
	loadSettings: vi.fn(),
	saveSettings: vi.fn(),
}));

vi.mock("../../../src/mainview/rpc", () => ({
	electroview: { rpc: { request: rpcMocks } },
}));

import {
	closeFile,
	copyPath,
	newRoadmap,
	openRecent,
	openSample,
	revealInFolder,
	saveAs,
} from "../../../src/mainview/hooks/useFileActions";
import {
	hasUnsavedEdits,
	useRoadmapStore,
} from "../../../src/mainview/store/roadmapStore";
import { useToastStore } from "../../../src/mainview/store/toastStore";
import { resetStore } from "../../helpers/resetStore";

const NODE_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const FILE = "C:\\work\\plans\\roadmap-a.json";

function schema(title = "T"): RoadmapSchema {
	return {
		version: "1.0",
		title,
		nodes: [{ id: NODE_ID, title: "Root", status: "not-started" }],
	};
}

const writeText = vi.fn(() => Promise.resolve());

beforeEach(() => {
	resetStore();
	useToastStore.setState({ toasts: [] });
	for (const mock of Object.values(rpcMocks)) mock.mockReset();
	rpcMocks.closeFile.mockResolvedValue({ ok: true });
	rpcMocks.revealInFolder.mockResolvedValue({ ok: true });
	writeText.mockClear();
	Object.defineProperty(navigator, "clipboard", {
		value: { writeText },
		configurable: true,
	});
});

afterEach(() => {
	resetStore();
});

describe("saveAs", () => {
	it("seeds the dialog with the current file's directory and basename", async () => {
		useRoadmapStore.getState().loadSchema(schema(), FILE);
		rpcMocks.saveFileAs.mockResolvedValue({
			filePath: "C:\\work\\plans\\copy.json",
		});

		const result = await saveAs();

		expect(rpcMocks.saveFileAs).toHaveBeenCalledWith(
			expect.objectContaining({
				defaultPath: "C:\\work\\plans",
				defaultName: "roadmap-a.json",
			}),
		);
		expect(result.filePath).toBe("C:\\work\\plans\\copy.json");
		const state = useRoadmapStore.getState();
		expect(state.filePath).toBe("C:\\work\\plans\\copy.json");
		expect(state.isUntitled).toBe(false);
		expect(hasUnsavedEdits(state)).toBe(false);
	});

	it("untitled: no defaultPath, defaultName roadmap.json", async () => {
		useRoadmapStore.getState().newUntitledSchema();
		rpcMocks.saveFileAs.mockResolvedValue({ filePath: "/tmp/new.json" });

		await saveAs();

		expect(rpcMocks.saveFileAs).toHaveBeenCalledWith(
			expect.objectContaining({
				defaultPath: undefined,
				defaultName: "roadmap.json",
			}),
		);
	});

	it("A6: warns when linked files were merged in and clears linkedFiles", async () => {
		useRoadmapStore
			.getState()
			.loadSchema(schema(), FILE, ["/tmp/part-a.json", "/tmp/part-b.json"]);
		rpcMocks.saveFileAs.mockResolvedValue({
			filePath: "/tmp/single.json",
			linkedFilesNotCopied: ["/tmp/part-a.json", "/tmp/part-b.json"],
		});

		await saveAs();

		expect(useRoadmapStore.getState().linkedFiles).toEqual([]);
		const toasts = useToastStore.getState().toasts;
		expect(toasts).toHaveLength(1);
		expect(toasts[0].type).toBe("file_info");
		expect(toasts[0].detail).toContain("2 linked files");
		expect(toasts[0].detail).toContain("originals were not modified");
	});

	it("cancelled dialog leaves the store alone and shows no toast", async () => {
		useRoadmapStore.getState().loadSchema(schema(), FILE);
		rpcMocks.saveFileAs.mockResolvedValue({ filePath: null });

		const result = await saveAs();

		expect(result.filePath).toBeNull();
		expect(useRoadmapStore.getState().filePath).toBe(FILE);
		expect(useToastStore.getState().toasts).toHaveLength(0);
	});

	it("dedupes a re-entrant call while the dialog is open (WR-01)", async () => {
		useRoadmapStore.getState().loadSchema(schema(), FILE);
		let finish: ((v: { filePath: string }) => void) | undefined;
		rpcMocks.saveFileAs.mockImplementation(
			() =>
				new Promise((resolve) => {
					finish = resolve;
				}),
		);

		const first = saveAs();
		await vi.waitFor(() => expect(rpcMocks.saveFileAs).toHaveBeenCalled());
		const second = saveAs();
		finish?.({ filePath: "/tmp/once.json" });

		expect(await first).toEqual({ filePath: "/tmp/once.json" });
		expect(await second).toEqual({ filePath: "/tmp/once.json" });
		expect(rpcMocks.saveFileAs).toHaveBeenCalledTimes(1);
	});
});

describe("closeFile (A2)", () => {
	it("calls the closeFile RPC and resets the store to the no-file state", async () => {
		useRoadmapStore.getState().loadSchema(schema(), FILE, ["/tmp/part.json"]);
		useRoadmapStore.getState().setSelectedNode(NODE_ID);
		useRoadmapStore.getState().setSearchQuery("Root");

		await closeFile();

		expect(rpcMocks.closeFile).toHaveBeenCalledTimes(1);
		const state = useRoadmapStore.getState();
		expect(state.schema).toBeNull();
		expect(state.treeData).toBeNull();
		expect(state.filePath).toBeNull();
		expect(state.isUntitled).toBe(false);
		expect(state.linkedFiles).toEqual([]);
		expect(state.selectedNodeId).toBeNull();
		expect(state.searchQuery).toBe("");
		expect(state.searchMatchIds).toEqual([]);
		expect(state.saveState).toBe("saved");
		expect(hasUnsavedEdits(state)).toBe(false);
	});

	it("does nothing when no file is open", async () => {
		await closeFile();
		expect(rpcMocks.closeFile).not.toHaveBeenCalled();
	});

	it("honours the guard: Cancel on the untitled prompt keeps the document", async () => {
		useRoadmapStore.getState().newUntitledSchema();
		const rootId = useRoadmapStore.getState().schema?.nodes[0].id ?? "";
		useRoadmapStore.getState().addChild(rootId);

		const closing = closeFile();
		await vi.waitFor(() =>
			expect(useRoadmapStore.getState().pendingDiscard).not.toBeNull(),
		);
		useRoadmapStore.getState().pendingDiscard?.resolve("cancel");
		await closing;

		expect(rpcMocks.closeFile).not.toHaveBeenCalled();
		expect(useRoadmapStore.getState().schema).not.toBeNull();
		expect(useRoadmapStore.getState().pendingDiscard).toBeNull();
	});

	it("honours the guard: Don't save closes without a save", async () => {
		useRoadmapStore.getState().newUntitledSchema();
		const rootId = useRoadmapStore.getState().schema?.nodes[0].id ?? "";
		useRoadmapStore.getState().addChild(rootId);

		const closing = closeFile();
		await vi.waitFor(() =>
			expect(useRoadmapStore.getState().pendingDiscard).not.toBeNull(),
		);
		useRoadmapStore.getState().pendingDiscard?.resolve("discard");
		await closing;

		expect(rpcMocks.saveFileAs).not.toHaveBeenCalled();
		expect(rpcMocks.closeFile).toHaveBeenCalledTimes(1);
		expect(useRoadmapStore.getState().schema).toBeNull();
	});
});

describe("newRoadmap (F7)", () => {
	it("creates an untitled document without popping the Save dialog", async () => {
		rpcMocks.newFile.mockResolvedValue({ data: schema("New"), filePath: null });
		const dispatched: string[] = [];
		const spy = vi
			.spyOn(window, "dispatchEvent")
			.mockImplementation((e: Event) => {
				dispatched.push(e.type);
				return true;
			});

		await newRoadmap();

		const state = useRoadmapStore.getState();
		expect(state.isUntitled).toBe(true);
		expect(state.filePath).toBeNull();
		expect(state.schema?.title).toBe("New");
		expect(rpcMocks.saveFileAs).not.toHaveBeenCalled();
		expect(dispatched).not.toContain("roadraven:trigger-save");
		spy.mockRestore();
	});

	it("flushes a dirty file-backed document first (guard)", async () => {
		useRoadmapStore.getState().loadSchema(schema(), FILE);
		useRoadmapStore.getState().addChild(NODE_ID);
		rpcMocks.newFile.mockResolvedValue({ data: schema("New"), filePath: null });
		const triggerSpy = vi
			.spyOn(useRoadmapStore.getState(), "triggerSave")
			.mockImplementation(() => {
				const s = useRoadmapStore.getState();
				useRoadmapStore.setState({
					saveState: "saved",
					lastSavedDataKey: s.dataKey,
					lastSavedStatusTick: s.statusTick,
				});
			});

		await newRoadmap();

		expect(triggerSpy).toHaveBeenCalledTimes(1);
		expect(useRoadmapStore.getState().isUntitled).toBe(true);
	});
});

describe("openSample (A5)", () => {
	it("marks a bundled sample as untitled with no path", async () => {
		await openSample("hello-world");

		const state = useRoadmapStore.getState();
		expect(state.schema).not.toBeNull();
		expect(state.filePath).toBeNull();
		expect(state.isUntitled).toBe(true);
	});
});

describe("openRecent — linkedFiles hand-off", () => {
	it("stores the loadFile response's linkedFiles", async () => {
		rpcMocks.loadFile.mockResolvedValue({
			data: schema("Root"),
			filePath: "/tmp/root.json",
			linkedFiles: ["/tmp/part.json"],
			errors: [],
		});

		await openRecent("/tmp/root.json");

		const state = useRoadmapStore.getState();
		expect(state.filePath).toBe("/tmp/root.json");
		expect(state.linkedFiles).toEqual(["/tmp/part.json"]);
	});
});

describe("openRecent — missing file (A4)", () => {
	beforeEach(() => {
		rpcMocks.loadSettings.mockResolvedValue({
			settings: { recentFiles: ["/tmp/gone.json", "/tmp/other.json"] },
		});
		rpcMocks.saveSettings.mockResolvedValue({ success: true });
	});

	it("toasts and drops the entry when Bun cannot read the file", async () => {
		rpcMocks.loadFile.mockResolvedValue({
			data: null,
			errors: [
				{
					path: "",
					message: "Failed to read file: ENOENT",
					code: "file_read_error",
				},
			],
		});

		await openRecent("/tmp/gone.json");

		const toasts = useToastStore.getState().toasts;
		expect(toasts).toHaveLength(1);
		expect(toasts[0].type).toBe("file_error");
		expect(toasts[0].detail).toBe("File not found — removed from Recent Files");
		expect(rpcMocks.saveSettings).toHaveBeenCalledWith({
			settings: { recentFiles: ["/tmp/other.json"] },
		});
		expect(useRoadmapStore.getState().schemaErrors[0]?.code).toBe(
			"file_read_error",
		);
	});

	it("keeps the entry for a file that exists but does not parse", async () => {
		rpcMocks.loadFile.mockResolvedValue({
			data: null,
			errors: [{ path: "", message: "bad json", code: "json_parse_error" }],
		});

		await openRecent("/tmp/gone.json");

		expect(useToastStore.getState().toasts).toHaveLength(0);
		expect(rpcMocks.saveSettings).not.toHaveBeenCalled();
	});
});

describe("revealInFolder / copyPath", () => {
	it("revealInFolder passes the open path and stays quiet on success", async () => {
		useRoadmapStore.getState().loadSchema(schema(), FILE);
		await revealInFolder();
		expect(rpcMocks.revealInFolder).toHaveBeenCalledWith({ path: FILE });
		expect(useToastStore.getState().toasts).toHaveLength(0);
	});

	it("revealInFolder toasts an error when the file is gone", async () => {
		useRoadmapStore.getState().loadSchema(schema(), FILE);
		rpcMocks.revealInFolder.mockResolvedValue({ ok: false });
		await revealInFolder();
		const toasts = useToastStore.getState().toasts;
		expect(toasts).toHaveLength(1);
		expect(toasts[0].type).toBe("file_error");
		expect(toasts[0].detail).toBe("File not found on disk.");
	});

	it("both no-op without a path", async () => {
		useRoadmapStore.getState().newUntitledSchema();
		await revealInFolder();
		await copyPath();
		expect(rpcMocks.revealInFolder).not.toHaveBeenCalled();
		expect(writeText).not.toHaveBeenCalled();
	});

	it("copyPath writes the full path to the clipboard", async () => {
		useRoadmapStore.getState().loadSchema(schema(), FILE);
		await copyPath();
		expect(writeText).toHaveBeenCalledWith(FILE);
	});
});
