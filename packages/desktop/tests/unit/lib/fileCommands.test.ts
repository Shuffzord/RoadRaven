// v0.8.2 A3 — fileCommands registry: enablement per document state, the
// per-platform shortcut labels, and that every verb routes to the shared
// useFileActions function (one definition per verb).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RoadmapSchema } from "../../../../../packages/core/src/schema";

const actions = vi.hoisted(() => ({
	newRoadmap: vi.fn(() => Promise.resolve()),
	openFile: vi.fn(() => Promise.resolve()),
	openRecent: vi.fn((_path: string) => Promise.resolve()),
	save: vi.fn(() => Promise.resolve()),
	saveAs: vi.fn(() => Promise.resolve({ filePath: null })),
	closeFile: vi.fn(() => Promise.resolve()),
	revealInFolder: vi.fn(() => Promise.resolve()),
	copyPath: vi.fn(() => Promise.resolve()),
}));

vi.mock("../../../src/mainview/hooks/useFileActions", () => actions);

import {
	type FileCommandId,
	fileCommands,
	formatShortcut,
	getFileCommand,
	isMacPlatform,
} from "../../../src/mainview/lib/fileCommands";
import { useRoadmapStore } from "../../../src/mainview/store/roadmapStore";
import { resetStore } from "../../helpers/resetStore";

const NODE_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const SCHEMA: RoadmapSchema = {
	version: "1.0",
	title: "T",
	nodes: [{ id: NODE_ID, title: "Root", status: "not-started" }],
};

function enabledIds(): FileCommandId[] {
	const state = useRoadmapStore.getState();
	return fileCommands.filter((c) => c.isEnabled(state)).map((c) => c.id);
}

beforeEach(() => {
	resetStore();
	vi.clearAllMocks();
});

afterEach(() => {
	resetStore();
});

describe("fileCommands — enablement", () => {
	it("no schema: only new / open / openRecent are enabled", () => {
		expect(enabledIds()).toEqual(["new", "open", "openRecent"]);
	});

	it("untitled document: save / saveAs / closeFile join; path verbs stay off", () => {
		useRoadmapStore.getState().newUntitledSchema();
		expect(enabledIds()).toEqual([
			"new",
			"open",
			"openRecent",
			"save",
			"saveAs",
			"closeFile",
		]);
	});

	it("file-backed document: every verb is enabled", () => {
		useRoadmapStore.getState().loadSchema(SCHEMA, "/tmp/plan.json");
		expect(enabledIds()).toEqual(fileCommands.map((c) => c.id));
	});
});

describe("fileCommands — run routes to the shared action", () => {
	it.each([
		["new", "newRoadmap"],
		["open", "openFile"],
		["save", "save"],
		["saveAs", "saveAs"],
		["closeFile", "closeFile"],
		["revealInFolder", "revealInFolder"],
		["copyPath", "copyPath"],
	] as const)("%s → useFileActions.%s", async (id, fn) => {
		await getFileCommand(id).run();
		expect(actions[fn]).toHaveBeenCalledTimes(1);
	});

	it("openRecent passes the path through and no-ops without one", async () => {
		await getFileCommand("openRecent").run("/tmp/recent.json");
		expect(actions.openRecent).toHaveBeenCalledWith("/tmp/recent.json");
		await getFileCommand("openRecent").run();
		expect(actions.openRecent).toHaveBeenCalledTimes(1);
	});

	it("getFileCommand throws on an unknown id", () => {
		expect(() => getFileCommand("nope" as FileCommandId)).toThrow(
			/Unknown file command/,
		);
	});
});

describe("fileCommands — shortcut labels", () => {
	it("spells modifiers out on Windows / Linux", () => {
		expect(formatShortcut("S", {}, false)).toBe("Ctrl+S");
		expect(formatShortcut("S", { shift: true }, false)).toBe("Ctrl+Shift+S");
	});

	it("uses ⌘ / ⇧ glyphs on macOS", () => {
		expect(formatShortcut("S", {}, true)).toBe("⌘S");
		expect(formatShortcut("S", { shift: true }, true)).toBe("⇧⌘S");
	});

	it("isMacPlatform reads platform first, then the user agent", () => {
		expect(isMacPlatform({ platform: "MacIntel" })).toBe(true);
		expect(isMacPlatform({ platform: "Win32" })).toBe(false);
		expect(
			isMacPlatform({
				platform: "",
				userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)",
			}),
		).toBe(true);
		expect(isMacPlatform({})).toBe(false);
	});

	it("registry entries carry a display shortcut for the keyboard verbs only", () => {
		const withShortcut = fileCommands
			.filter((c) => c.shortcut)
			.map((c) => c.id);
		expect(withShortcut).toEqual(["new", "open", "save", "saveAs"]);
	});
});
