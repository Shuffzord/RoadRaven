/** @vitest-environment jsdom */
// v0.8.2 A1 — ensureSafeToDiscard: the one guard in front of New / Open /
// Open Recent / Close File / window close.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RoadmapSchema } from "../../../../../packages/core/src/schema";

const rpcMocks = vi.hoisted(() => ({ saveFileAs: vi.fn() }));

vi.mock("../../../src/mainview/rpc", () => ({
	electroview: { rpc: { request: rpcMocks } },
}));

import {
	ensureSafeToDiscard,
	FLUSH_TIMEOUT_MS,
} from "../../../src/mainview/hooks/useFileActions";
import { useRoadmapStore } from "../../../src/mainview/store/roadmapStore";
import { resetStore } from "../../helpers/resetStore";

const NODE_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const SCHEMA: RoadmapSchema = {
	version: "1.0",
	title: "T",
	nodes: [{ id: NODE_ID, title: "Root", status: "not-started" }],
};

function loadDirtyFile(): void {
	useRoadmapStore.getState().loadSchema(SCHEMA, "/tmp/plan.json");
	useRoadmapStore.getState().addChild(NODE_ID);
}

function loadDirtyUntitled(): void {
	useRoadmapStore.getState().newUntitledSchema();
	const rootId = useRoadmapStore.getState().schema?.nodes[0].id ?? "";
	useRoadmapStore.getState().addChild(rootId);
}

/** Stand in for useAutosave: the flush lands `after` ms later. */
function stubFlush(
	outcome: "saved" | "error-manual" | "never",
	after = 0,
): ReturnType<typeof vi.spyOn> {
	return vi
		.spyOn(useRoadmapStore.getState(), "triggerSave")
		.mockImplementation(() => {
			if (outcome === "never") return;
			setTimeout(() => {
				useRoadmapStore.getState().setSaveState("saving");
				const s = useRoadmapStore.getState();
				if (outcome === "saved") {
					useRoadmapStore.setState({
						saveState: "saved",
						lastSavedDataKey: s.dataKey,
						lastSavedStatusTick: s.statusTick,
					});
				} else {
					useRoadmapStore.setState({ saveState: "error-manual" });
				}
			}, after);
		});
}

beforeEach(() => {
	vi.useFakeTimers();
	resetStore();
	rpcMocks.saveFileAs.mockReset();
});

afterEach(() => {
	vi.useRealTimers();
	vi.restoreAllMocks();
	resetStore();
});

describe("ensureSafeToDiscard — trivially safe", () => {
	it("no schema → true", async () => {
		await expect(ensureSafeToDiscard()).resolves.toBe(true);
	});

	it("untitled without edits → true, no prompt", async () => {
		useRoadmapStore.getState().newUntitledSchema();
		await expect(ensureSafeToDiscard()).resolves.toBe(true);
		expect(useRoadmapStore.getState().pendingDiscard).toBeNull();
	});

	it("file-backed and clean → true without touching autosave", async () => {
		useRoadmapStore.getState().loadSchema(SCHEMA, "/tmp/plan.json");
		// zustand's set() copies an earlier spy into later state objects, so
		// spyOn can hand back a mock with historical calls — clear it first.
		const spy = vi.spyOn(useRoadmapStore.getState(), "triggerSave");
		spy.mockClear();
		await expect(ensureSafeToDiscard()).resolves.toBe(true);
		expect(spy).not.toHaveBeenCalled();
	});
});

describe("ensureSafeToDiscard — file-backed with edits (flush and wait)", () => {
	it("resolves true once the autosave reports saved and clean", async () => {
		loadDirtyFile();
		const spy = stubFlush("saved", 100);
		const guard = ensureSafeToDiscard();
		await vi.advanceTimersByTimeAsync(100);
		await expect(guard).resolves.toBe(true);
		expect(spy).toHaveBeenCalledTimes(1);
	});

	it("resolves false when the flush ends in an error state", async () => {
		loadDirtyFile();
		stubFlush("error-manual", 100);
		const guard = ensureSafeToDiscard();
		await vi.advanceTimersByTimeAsync(100);
		await expect(guard).resolves.toBe(false);
	});

	it("resolves false after the bounded wait when nothing lands", async () => {
		loadDirtyFile();
		stubFlush("never");
		const guard = ensureSafeToDiscard();
		await vi.advanceTimersByTimeAsync(FLUSH_TIMEOUT_MS - 1);
		let settled = false;
		void guard.then(() => {
			settled = true;
		});
		await Promise.resolve();
		expect(settled).toBe(false);
		await vi.advanceTimersByTimeAsync(1);
		await expect(guard).resolves.toBe(false);
	});

	it("resolves false at once while autosave is paused (external edit pending)", async () => {
		loadDirtyFile();
		useRoadmapStore.getState().setExternalEdit("/tmp/plan.json");
		const spy = vi.spyOn(useRoadmapStore.getState(), "triggerSave");
		spy.mockClear();
		await expect(ensureSafeToDiscard()).resolves.toBe(false);
		expect(spy).not.toHaveBeenCalled();
	});
});

describe("ensureSafeToDiscard — untitled with edits (prompt)", () => {
	async function answer(choice: "save" | "discard" | "cancel") {
		const guard = ensureSafeToDiscard();
		await vi.waitFor(() =>
			expect(useRoadmapStore.getState().pendingDiscard).not.toBeNull(),
		);
		useRoadmapStore.getState().pendingDiscard?.resolve(choice);
		return guard;
	}

	it("Cancel → false and the prompt is cleared", async () => {
		loadDirtyUntitled();
		await expect(answer("cancel")).resolves.toBe(false);
		expect(useRoadmapStore.getState().pendingDiscard).toBeNull();
		expect(rpcMocks.saveFileAs).not.toHaveBeenCalled();
	});

	it("Don't save → true without a Save As", async () => {
		loadDirtyUntitled();
		await expect(answer("discard")).resolves.toBe(true);
		expect(rpcMocks.saveFileAs).not.toHaveBeenCalled();
	});

	it("Save As… → true only when a path came back", async () => {
		loadDirtyUntitled();
		rpcMocks.saveFileAs.mockResolvedValue({ filePath: "/tmp/saved.json" });
		await expect(answer("save")).resolves.toBe(true);
		expect(useRoadmapStore.getState().filePath).toBe("/tmp/saved.json");
		expect(useRoadmapStore.getState().isUntitled).toBe(false);
	});

	it("Save As… cancelled in the native dialog → false", async () => {
		loadDirtyUntitled();
		rpcMocks.saveFileAs.mockResolvedValue({ filePath: null });
		await expect(answer("save")).resolves.toBe(false);
		expect(useRoadmapStore.getState().isUntitled).toBe(true);
	});

	it("a second guard while the prompt is open resolves false instead of stacking", async () => {
		loadDirtyUntitled();
		const first = ensureSafeToDiscard();
		await vi.waitFor(() =>
			expect(useRoadmapStore.getState().pendingDiscard).not.toBeNull(),
		);
		await expect(ensureSafeToDiscard()).resolves.toBe(false);
		useRoadmapStore.getState().pendingDiscard?.resolve("cancel");
		await expect(first).resolves.toBe(false);
	});
});
