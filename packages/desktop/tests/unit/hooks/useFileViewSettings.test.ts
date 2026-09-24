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

beforeEach(() => {
	vi.clearAllMocks();
	saveSettingsMock.mockResolvedValue({ success: true });
	resetStore();
	useFileViewStore.getState().resetKnobs();
});

afterEach(() => {
	cleanup();
	resetStore();
	useFileViewStore.getState().resetKnobs();
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
					[TEST_PATH]: { layout: "LR", layoutKnobs: savedKnobs },
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
		// changes to a path nothing has ever been saved under.
		loadSettingsMock.mockResolvedValueOnce({ settings: {} });
		useRoadmapStore.getState().loadSchema(TEST_SCHEMA as never, NEW_PATH);

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
					},
				},
			},
		});
	});
});
