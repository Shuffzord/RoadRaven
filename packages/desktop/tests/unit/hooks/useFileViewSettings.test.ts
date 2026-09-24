/** @vitest-environment jsdom */
// v0.8.4 Phase 2 — RC3 evidence: per-file layout orientation is saved
// (TopBar.tsx) but nothing ever reads it back on open. This hook is the fix:
// on every filePath change it loads fileSettings[path] and restores the
// layout orientation + layout knobs. Modelled on
// useUiSettingsHydration.test.ts's electroview mocking pattern.
import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { loadSettingsMock, saveSettingsMock } = vi.hoisted(() => ({
	loadSettingsMock: vi.fn(),
	saveSettingsMock: vi.fn(),
}));

vi.mock("../../../src/mainview/rpc", () => ({
	electroview: {
		rpc: {
			request: {
				loadSettings: loadSettingsMock,
				saveSettings: saveSettingsMock,
			},
		},
	},
}));

import { useFileViewSettings } from "../../../src/mainview/hooks/useFileViewSettings";
import { useFileViewStore } from "../../../src/mainview/store/fileViewStore";
import { useRoadmapStore } from "../../../src/mainview/store/roadmapStore";
import { resetStore } from "../../helpers/resetStore";

const TEST_PATH = "C:/a.json";

const TEST_SCHEMA = {
	version: "1.0",
	title: "Test",
	nodes: [{ id: "root", title: "Root", status: "not-started" }],
} as const;

/**
 * v0.8.4 Phase 3: every save now carries the custom-layout keys too.
 * v0.8.4 Phase 4: ... and the collapsed ids.
 */
const NO_CUSTOM_LAYOUT = {
	customLayout: false,
	nodeOffsets: { TB: {}, LR: {} },
	collapsed: [],
};

function resetFileView(): void {
	useFileViewStore.getState().resetKnobs();
	useFileViewStore.getState().expandAll();
	useFileViewStore.setState({
		customLayout: false,
		nodeOffsets: { TB: {}, LR: {} },
	});
}

beforeEach(() => {
	vi.clearAllMocks();
	saveSettingsMock.mockResolvedValue({ success: true });
	resetStore();
	resetFileView();
});

afterEach(() => {
	cleanup();
	resetStore();
	resetFileView();
});

describe("useFileViewSettings — RC3 (orientation restore)", () => {
	it("restores a saved LR layout when the file that has it opens", async () => {
		loadSettingsMock.mockResolvedValue({
			settings: { fileSettings: { [TEST_PATH]: { layout: "LR" } } },
		});
		useRoadmapStore.getState().loadSchema(TEST_SCHEMA as never, TEST_PATH);

		renderHook(() => useFileViewSettings());
		await vi.waitFor(() => expect(loadSettingsMock).toHaveBeenCalledTimes(1));
		await vi.waitFor(() =>
			expect(useRoadmapStore.getState().layoutOrientation).toBe("LR"),
		);
	});

	it("leaves the default TB when the file was never toggled", async () => {
		loadSettingsMock.mockResolvedValue({ settings: {} });
		useRoadmapStore.getState().loadSchema(TEST_SCHEMA as never, TEST_PATH);

		renderHook(() => useFileViewSettings());
		await vi.waitFor(() => expect(loadSettingsMock).toHaveBeenCalledTimes(1));
		expect(useRoadmapStore.getState().layoutOrientation).toBe("TB");
	});

	it("restores nothing and calls loadSettings for an untitled document", () => {
		useRoadmapStore.getState().newUntitledSchema();

		renderHook(() => useFileViewSettings());
		expect(loadSettingsMock).not.toHaveBeenCalled();
	});
});

// v0.8.4 Phase 2 — the write side. This replaces TopBar.test.tsx's
// "persists the orientation per file through the settings rpc": TopBar no
// longer calls saveSettings itself (see report, "Existing tests changed").
describe("useFileViewSettings — write-back", () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	it("does not call saveSettings merely from restoring the saved layout on open", async () => {
		loadSettingsMock.mockResolvedValue({
			settings: { fileSettings: { [TEST_PATH]: { layout: "LR" } } },
		});
		useRoadmapStore.getState().loadSchema(TEST_SCHEMA as never, TEST_PATH);

		renderHook(() => useFileViewSettings());
		// Same synchronous .then() callback sets `hydrated = true`, so this is
		// also proof the guard is already armed.
		await vi.waitFor(() =>
			expect(useRoadmapStore.getState().layoutOrientation).toBe("LR"),
		);

		vi.useFakeTimers();
		await vi.advanceTimersByTimeAsync(300);
		expect(saveSettingsMock).not.toHaveBeenCalled();
	});

	it("persists a later layout change, debounced, merged with the current knobs", async () => {
		const savedKnobs = {
			siblingGap: 1.6,
			depthGap: 1.0,
			density: "comfortable",
		};
		loadSettingsMock.mockResolvedValue({
			settings: { fileSettings: { [TEST_PATH]: { layoutKnobs: savedKnobs } } },
		});
		useRoadmapStore.getState().loadSchema(TEST_SCHEMA as never, TEST_PATH);

		renderHook(() => useFileViewSettings());
		await vi.waitFor(() =>
			expect(useFileViewStore.getState().layoutKnobs.siblingGap).toBe(1.6),
		);

		vi.useFakeTimers();
		useRoadmapStore.getState().setLayout("LR");
		await vi.advanceTimersByTimeAsync(300);

		expect(saveSettingsMock).toHaveBeenCalledWith({
			settings: {
				fileSettings: {
					[TEST_PATH]: {
						layout: "LR",
						layoutKnobs: savedKnobs,
						...NO_CUSTOM_LAYOUT,
					},
				},
			},
		});
	});

	it("persists a knob change the same way, merged with the just-hydrated knobs", async () => {
		// depthGap 1.3 (not the field under test) is the observable proof that
		// hydration finished before setKnob runs.
		loadSettingsMock.mockResolvedValue({
			settings: {
				fileSettings: {
					[TEST_PATH]: {
						layoutKnobs: {
							siblingGap: 1.1,
							depthGap: 1.3,
							density: "comfortable",
						},
					},
				},
			},
		});
		useRoadmapStore.getState().loadSchema(TEST_SCHEMA as never, TEST_PATH);

		renderHook(() => useFileViewSettings());
		await vi.waitFor(() =>
			expect(useFileViewStore.getState().layoutKnobs.depthGap).toBe(1.3),
		);

		vi.useFakeTimers();
		useFileViewStore.getState().setKnob("siblingGap", 1.7);
		await vi.advanceTimersByTimeAsync(300);

		expect(saveSettingsMock).toHaveBeenCalledWith({
			settings: {
				fileSettings: {
					[TEST_PATH]: {
						layout: "TB",
						layoutKnobs: {
							siblingGap: 1.7,
							depthGap: 1.3,
							density: "comfortable",
						},
						...NO_CUSTOM_LAYOUT,
					},
				},
			},
		});
	});
});

// v0.8.4 Phase 2 review send-back — "no stored settings for this path" was
// being treated as "reset": Save As of an open file, the first save of an
// untitled document, or any brand-new file has no fileSettings[path] entry
// yet, and hydrate(undefined) snapped the in-memory knobs back to defaults,
// discarding whatever the user had on screen. Orientation already got this
// right (setLayout is only called when a saved value exists); knobs must
// match.
describe("useFileViewSettings — no stored settings for the new path", () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	it("keeps the current in-memory knobs (Save As / first save / brand-new file), then persists a later change under the new path", async () => {
		const NEW_PATH = "C:/b.json";

		loadSettingsMock.mockResolvedValueOnce({
			settings: {
				fileSettings: {
					[TEST_PATH]: {
						layoutKnobs: { siblingGap: 1.8, depthGap: 1.6, density: "compact" },
					},
				},
			},
		});
		useRoadmapStore.getState().loadSchema(TEST_SCHEMA as never, TEST_PATH);
		renderHook(() => useFileViewSettings());
		await vi.waitFor(() =>
			expect(useFileViewStore.getState().layoutKnobs.siblingGap).toBe(1.8),
		);

		// Save As (or the first save of a previously-untitled doc): filePath
		// changes to a path nothing has ever been saved under. Phase 4: the
		// way the app does it (useFileActions / useAutosave) — filePath only,
		// the SAME schema; a loadSchema here would be opening another file.
		loadSettingsMock.mockResolvedValueOnce({ settings: {} });
		useRoadmapStore.setState({ filePath: NEW_PATH });

		await vi.waitFor(() => expect(loadSettingsMock).toHaveBeenCalledTimes(2));
		// Flush the second load's .then() microtask chain via a real macrotask
		// (fake timers are not enabled yet), so the assertion below cannot pass
		// merely because the callback hasn't run yet.
		await new Promise((resolve) => setTimeout(resolve, 0));

		expect(useFileViewStore.getState().layoutKnobs).toEqual({
			siblingGap: 1.8,
			depthGap: 1.6,
			density: "compact",
		});

		// A later edit must still persist, keyed on the NEW path.
		vi.useFakeTimers();
		useFileViewStore.getState().setKnob("siblingGap", 1.9);
		await vi.advanceTimersByTimeAsync(300);

		expect(saveSettingsMock).toHaveBeenCalledWith({
			settings: {
				fileSettings: {
					[NEW_PATH]: {
						layout: "TB",
						layoutKnobs: { siblingGap: 1.9, depthGap: 1.6, density: "compact" },
						...NO_CUSTOM_LAYOUT,
					},
				},
			},
		});
	});
});

// v0.8.4 Phase 3 — custom layout persists next to the knobs, per file, and
// hydrates only what was stored (same guard as the knobs above).
describe("useFileViewSettings — custom layout", () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	const SAVED_OFFSETS = {
		TB: { root: { dx: 12, dy: -4 } },
		LR: { root: { dx: 3, dy: 9 } },
	};

	it("restores customLayout and nodeOffsets for the file that has them", async () => {
		loadSettingsMock.mockResolvedValue({
			settings: {
				fileSettings: {
					[TEST_PATH]: { customLayout: true, nodeOffsets: SAVED_OFFSETS },
				},
			},
		});
		useRoadmapStore.getState().loadSchema(TEST_SCHEMA as never, TEST_PATH);

		renderHook(() => useFileViewSettings());
		await vi.waitFor(() =>
			expect(useFileViewStore.getState().customLayout).toBe(true),
		);
		expect(useFileViewStore.getState().nodeOffsets).toEqual(SAVED_OFFSETS);
	});

	it("drops garbage offsets from a hand-edited settings file", async () => {
		loadSettingsMock.mockResolvedValue({
			settings: {
				fileSettings: {
					[TEST_PATH]: {
						customLayout: true,
						nodeOffsets: { TB: { root: { dx: "x", dy: 1 } }, LR: 5 },
					},
				},
			},
		});
		useRoadmapStore.getState().loadSchema(TEST_SCHEMA as never, TEST_PATH);

		renderHook(() => useFileViewSettings());
		await vi.waitFor(() =>
			expect(useFileViewStore.getState().customLayout).toBe(true),
		);
		expect(useFileViewStore.getState().nodeOffsets).toEqual({ TB: {}, LR: {} });
	});

	it("keeps the on-screen custom layout when nothing is stored for the path", async () => {
		useFileViewStore.setState({
			customLayout: true,
			nodeOffsets: { TB: { root: { dx: 1, dy: 2 } }, LR: {} },
		});
		loadSettingsMock.mockResolvedValue({ settings: {} });
		useRoadmapStore.getState().loadSchema(TEST_SCHEMA as never, TEST_PATH);

		renderHook(() => useFileViewSettings());
		await vi.waitFor(() => expect(loadSettingsMock).toHaveBeenCalledTimes(1));
		await new Promise((resolve) => setTimeout(resolve, 0));

		expect(useFileViewStore.getState().customLayout).toBe(true);
		expect(useFileViewStore.getState().nodeOffsets.TB.root).toEqual({
			dx: 1,
			dy: 2,
		});
	});

	it("persists a moved card and the switch together with layout and knobs (round trip)", async () => {
		loadSettingsMock.mockResolvedValue({ settings: {} });
		useRoadmapStore.getState().loadSchema(TEST_SCHEMA as never, TEST_PATH);
		renderHook(() => useFileViewSettings());
		await vi.waitFor(() => expect(loadSettingsMock).toHaveBeenCalledTimes(1));
		await new Promise((resolve) => setTimeout(resolve, 0));

		vi.useFakeTimers();
		useFileViewStore.getState().setCustomLayout(true);
		useFileViewStore.getState().setNodeOffset("TB", "root", { dx: 30, dy: 40 });
		await vi.advanceTimersByTimeAsync(300);

		expect(saveSettingsMock).toHaveBeenCalledTimes(1);
		const saved =
			saveSettingsMock.mock.calls[0][0].settings.fileSettings[TEST_PATH];
		expect(saved).toEqual({
			layout: "TB",
			layoutKnobs: { siblingGap: 1.1, depthGap: 1.0, density: "comfortable" },
			customLayout: true,
			nodeOffsets: { TB: { root: { dx: 30, dy: 40 } }, LR: {} },
			collapsed: [],
		});

		// Round trip: the saved value, loaded into a fresh session, restores
		// the same view state.
		vi.useRealTimers();
		cleanup();
		resetFileView();
		loadSettingsMock.mockResolvedValue({
			settings: { fileSettings: { [TEST_PATH]: saved } },
		});
		renderHook(() => useFileViewSettings());
		await vi.waitFor(() =>
			expect(useFileViewStore.getState().customLayout).toBe(true),
		);
		expect(useFileViewStore.getState().nodeOffsets).toEqual(saved.nodeOffsets);
	});

	it("persists an unchecked switch without forgetting the offsets", async () => {
		loadSettingsMock.mockResolvedValue({
			settings: {
				fileSettings: {
					[TEST_PATH]: { customLayout: true, nodeOffsets: SAVED_OFFSETS },
				},
			},
		});
		useRoadmapStore.getState().loadSchema(TEST_SCHEMA as never, TEST_PATH);
		renderHook(() => useFileViewSettings());
		await vi.waitFor(() =>
			expect(useFileViewStore.getState().customLayout).toBe(true),
		);

		vi.useFakeTimers();
		useFileViewStore.getState().setCustomLayout(false);
		await vi.advanceTimersByTimeAsync(300);

		const saved =
			saveSettingsMock.mock.calls[0][0].settings.fileSettings[TEST_PATH];
		expect(saved.customLayout).toBe(false);
		expect(saved.nodeOffsets).toEqual(SAVED_OFFSETS);
	});

	it("persists nothing for an untitled document", async () => {
		useRoadmapStore.getState().newUntitledSchema();
		renderHook(() => useFileViewSettings());

		vi.useFakeTimers();
		useFileViewStore.getState().setCustomLayout(true);
		useFileViewStore.getState().setNodeOffset("TB", "root", { dx: 1, dy: 1 });
		await vi.advanceTimersByTimeAsync(300);

		expect(saveSettingsMock).not.toHaveBeenCalled();
	});
});

// v0.8.4 Phase 4 — collapse state persists per file next to the other view
// keys, and a different file never inherits the previous file's view state.
describe("useFileViewSettings — collapse and file change", () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	const OTHER_PATH = "C:/other.json";
	const TREE_SCHEMA = {
		version: "1.0",
		title: "Tree",
		nodes: [
			{
				id: "root",
				title: "Root",
				status: "not-started",
				children: [
					{
						id: "a",
						title: "A",
						status: "not-started",
						children: [{ id: "a1", title: "A1", status: "not-started" }],
					},
				],
			},
		],
	} as const;
	const collapsed = () => [...useFileViewStore.getState().collapsedIds].sort();
	/** Let a pending loadSettings().then() run (fake timers not enabled). */
	const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

	it("restores the collapsed ids stored for the file", async () => {
		loadSettingsMock.mockResolvedValue({
			settings: { fileSettings: { [TEST_PATH]: { collapsed: ["a"] } } },
		});
		useRoadmapStore.getState().loadSchema(TREE_SCHEMA as never, TEST_PATH);
		renderHook(() => useFileViewSettings());
		await vi.waitFor(() => expect(collapsed()).toEqual(["a"]));
	});

	it("keeps the on-screen collapsed set when the path has an entry without it", async () => {
		useFileViewStore.getState().setCollapsed("a", true);
		loadSettingsMock.mockResolvedValue({
			settings: { fileSettings: { [TEST_PATH]: { layout: "LR" } } },
		});
		useRoadmapStore.getState().loadSchema(TREE_SCHEMA as never, TEST_PATH);
		renderHook(() => useFileViewSettings());
		await vi.waitFor(() =>
			expect(useRoadmapStore.getState().layoutOrientation).toBe("LR"),
		);
		expect(collapsed()).toEqual(["a"]);
	});

	it("persists a collapse, debounced, and it round-trips", async () => {
		loadSettingsMock.mockResolvedValue({ settings: {} });
		useRoadmapStore.getState().loadSchema(TREE_SCHEMA as never, TEST_PATH);
		renderHook(() => useFileViewSettings());
		await vi.waitFor(() => expect(loadSettingsMock).toHaveBeenCalledTimes(1));
		await settle();

		vi.useFakeTimers();
		useFileViewStore.getState().toggleCollapsed("a");
		await vi.advanceTimersByTimeAsync(300);
		const saved =
			saveSettingsMock.mock.calls[0][0].settings.fileSettings[TEST_PATH];
		expect(saved.collapsed).toEqual(["a"]);

		vi.useRealTimers();
		cleanup();
		resetFileView();
		loadSettingsMock.mockResolvedValue({
			settings: { fileSettings: { [TEST_PATH]: saved } },
		});
		renderHook(() => useFileViewSettings());
		await vi.waitFor(() => expect(collapsed()).toEqual(["a"]));
	});

	it("drops ids that are no longer in the file at save time", async () => {
		loadSettingsMock.mockResolvedValue({
			settings: { fileSettings: { [TEST_PATH]: { collapsed: ["gone", "a"] } } },
		});
		useRoadmapStore.getState().loadSchema(TREE_SCHEMA as never, TEST_PATH);
		renderHook(() => useFileViewSettings());
		// Hydrate keeps them all.
		await vi.waitFor(() => expect(collapsed()).toEqual(["a", "gone"]));

		vi.useFakeTimers();
		useFileViewStore.getState().setCollapsed("root", true);
		await vi.advanceTimersByTimeAsync(300);
		const saved =
			saveSettingsMock.mock.calls[0][0].settings.fileSettings[TEST_PATH];
		expect([...saved.collapsed].sort()).toEqual(["a", "root"]);
	});

	it("opening a different file resets view state before applying what it stores", async () => {
		loadSettingsMock.mockResolvedValue({
			settings: {
				fileSettings: {
					[TEST_PATH]: {
						layoutKnobs: { siblingGap: 1.8, depthGap: 1.6, density: "compact" },
						customLayout: true,
						nodeOffsets: { TB: { root: { dx: 1, dy: 2 } } },
						collapsed: ["a"],
					},
					[OTHER_PATH]: { collapsed: ["root"] },
				},
			},
		});
		useRoadmapStore.getState().loadSchema(TREE_SCHEMA as never, TEST_PATH);
		renderHook(() => useFileViewSettings());
		await vi.waitFor(() => expect(collapsed()).toEqual(["a"]));
		expect(useFileViewStore.getState().customLayout).toBe(true);

		// Open: a NEW schema object arrives together with the new path.
		useRoadmapStore.getState().loadSchema(TREE_SCHEMA as never, OTHER_PATH);
		// Reset happens inside that store write, before any hydrate.
		expect(collapsed()).toEqual([]);
		expect(useFileViewStore.getState().layoutKnobs).toEqual({
			siblingGap: 1.1,
			depthGap: 1.0,
			density: "comfortable",
		});
		expect(useFileViewStore.getState().customLayout).toBe(false);
		expect(useFileViewStore.getState().nodeOffsets).toEqual({ TB: {}, LR: {} });

		await vi.waitFor(() => expect(collapsed()).toEqual(["root"]));
	});

	it("opening a file with nothing stored starts fully expanded", async () => {
		loadSettingsMock.mockResolvedValueOnce({
			settings: { fileSettings: { [TEST_PATH]: { collapsed: ["a"] } } },
		});
		useRoadmapStore.getState().loadSchema(TREE_SCHEMA as never, TEST_PATH);
		renderHook(() => useFileViewSettings());
		await vi.waitFor(() => expect(collapsed()).toEqual(["a"]));

		loadSettingsMock.mockResolvedValueOnce({ settings: {} });
		useRoadmapStore.getState().loadSchema(TREE_SCHEMA as never, OTHER_PATH);
		await vi.waitFor(() => expect(loadSettingsMock).toHaveBeenCalledTimes(2));
		await settle();
		expect(collapsed()).toEqual([]);
	});

	it("Save As (same schema, new path) keeps the on-screen view state", async () => {
		loadSettingsMock.mockResolvedValueOnce({
			settings: {
				fileSettings: {
					[TEST_PATH]: { customLayout: true, collapsed: ["a"] },
				},
			},
		});
		useRoadmapStore.getState().loadSchema(TREE_SCHEMA as never, TEST_PATH);
		renderHook(() => useFileViewSettings());
		await vi.waitFor(() => expect(collapsed()).toEqual(["a"]));

		loadSettingsMock.mockResolvedValueOnce({ settings: {} });
		useRoadmapStore.setState({ filePath: OTHER_PATH });
		await vi.waitFor(() => expect(loadSettingsMock).toHaveBeenCalledTimes(2));
		await settle();

		expect(collapsed()).toEqual(["a"]);
		expect(useFileViewStore.getState().customLayout).toBe(true);
	});
});
