/** @vitest-environment jsdom */
// v0.8.2 — one loadSettings round-trip restores the sidebar width and the
// search "include notes" toggle on launch.
import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { loadSettingsMock } = vi.hoisted(() => ({
	loadSettingsMock: vi.fn(),
}));

vi.mock("../../../src/mainview/rpc", () => ({
	electroview: { rpc: { request: { loadSettings: loadSettingsMock } } },
}));

import { useUiSettingsHydration } from "../../../src/mainview/hooks/useUiSettingsHydration";
import { useRoadmapStore } from "../../../src/mainview/store/roadmapStore";
import {
	SIDEBAR_DEFAULT_WIDTH,
	SIDEBAR_MAX_WIDTH,
	useUiStore,
} from "../../../src/mainview/store/uiStore";
import { resetStore } from "../../helpers/resetStore";

async function hydrate(settings: Record<string, unknown>): Promise<void> {
	loadSettingsMock.mockResolvedValue({ settings });
	renderHook(() => useUiSettingsHydration());
	await vi.waitFor(() => expect(loadSettingsMock).toHaveBeenCalledTimes(1));
	await Promise.resolve();
}

beforeEach(() => {
	vi.clearAllMocks();
	resetStore();
	useUiStore.setState({ sidebarWidth: SIDEBAR_DEFAULT_WIDTH });
});

afterEach(() => {
	cleanup();
	resetStore();
	useUiStore.setState({ sidebarWidth: SIDEBAR_DEFAULT_WIDTH });
});

describe("useUiSettingsHydration — searchInNotes", () => {
	it("restores a saved true into the roadmap store", async () => {
		await hydrate({ searchInNotes: true });
		expect(useRoadmapStore.getState().searchInNotes).toBe(true);
	});

	it("leaves the default false when the key is absent", async () => {
		await hydrate({});
		expect(useRoadmapStore.getState().searchInNotes).toBe(false);
	});

	it("ignores a non-boolean value", async () => {
		await hydrate({ searchInNotes: "yes" });
		expect(useRoadmapStore.getState().searchInNotes).toBe(false);
	});
});

describe("useUiSettingsHydration — sidebarWidth", () => {
	it("restores and clamps the saved width", async () => {
		await hydrate({ sidebarWidth: 9999 });
		expect(useUiStore.getState().sidebarWidth).toBe(SIDEBAR_MAX_WIDTH);
	});

	it("ignores a non-numeric saved width", async () => {
		await hydrate({ sidebarWidth: "abc" });
		expect(useUiStore.getState().sidebarWidth).toBe(SIDEBAR_DEFAULT_WIDTH);
	});

	it("reads both preferences from the single loadSettings call", async () => {
		await hydrate({ sidebarWidth: 300, searchInNotes: true });
		expect(useUiStore.getState().sidebarWidth).toBe(300);
		expect(useRoadmapStore.getState().searchInNotes).toBe(true);
	});
});
