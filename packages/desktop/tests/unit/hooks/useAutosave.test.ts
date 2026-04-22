/** @vitest-environment jsdom */
import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RoadmapSchema } from "../../../../../packages/core/src/schema";
import { useAutosave } from "../../../src/mainview/hooks/useAutosave";
import {
	hasUnsavedEdits,
	useRoadmapStore,
} from "../../../src/mainview/store/roadmapStore";
import { resetStore } from "../../helpers/resetStore";

const NODE_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";

type SaveFileFn = (args: {
	schema: RoadmapSchema;
	filePath?: string;
}) => Promise<{ ok: true } | { ok: false; error: string }>;

const saveFileMock = vi.fn<SaveFileFn>();

vi.mock("../../../src/mainview/rpc", () => ({
	electroview: {
		rpc: {
			request: {
				saveFile: (args: Parameters<SaveFileFn>[0]) => saveFileMock(args),
			},
		},
	},
}));

function loadSchema(): void {
	const schema: RoadmapSchema = {
		version: "1.0",
		title: "T",
		nodes: [{ id: NODE_ID, title: "Root", status: "not-started" }],
	};
	useRoadmapStore.getState().loadSchema(schema, "/tmp/autosave.json");
}

async function flushMicrotasks(): Promise<void> {
	// Advance a microtask so awaited saveFile mocks settle
	await Promise.resolve();
	await Promise.resolve();
	await Promise.resolve();
}

beforeEach(() => {
	vi.restoreAllMocks();
	saveFileMock.mockReset();
	saveFileMock.mockResolvedValue({ ok: true });
	vi.useFakeTimers();
	resetStore();
	loadSchema();
});

afterEach(() => {
	vi.useRealTimers();
	resetStore();
});

describe("useAutosave — debounce timers", () => {
	it("1. structural mutation (dataKey bump) → saveFile called exactly 2000ms later", async () => {
		renderHook(() => useAutosave());
		useRoadmapStore.getState().addChild(NODE_ID);

		await vi.advanceTimersByTimeAsync(1999);
		expect(saveFileMock).not.toHaveBeenCalled();

		await vi.advanceTimersByTimeAsync(1);
		await flushMicrotasks();
		expect(saveFileMock).toHaveBeenCalledTimes(1);
	});

	it("2. two rapid dataKey bumps within 2s → ONE saveFile call at 2000ms after the LAST mutation", async () => {
		renderHook(() => useAutosave());
		useRoadmapStore.getState().addChild(NODE_ID);
		await vi.advanceTimersByTimeAsync(500);
		useRoadmapStore.getState().addChild(NODE_ID);
		await vi.advanceTimersByTimeAsync(1999);
		expect(saveFileMock).not.toHaveBeenCalled();

		await vi.advanceTimersByTimeAsync(1);
		await flushMicrotasks();
		expect(saveFileMock).toHaveBeenCalledTimes(1);
	});

	it("3. statusTick bump (in-place) → saveFile called 1000ms later", async () => {
		renderHook(() => useAutosave());
		useRoadmapStore.getState().updateNodeNotes(NODE_ID, "note");

		await vi.advanceTimersByTimeAsync(999);
		expect(saveFileMock).not.toHaveBeenCalled();

		await vi.advanceTimersByTimeAsync(1);
		await flushMicrotasks();
		expect(saveFileMock).toHaveBeenCalledTimes(1);
	});

	it("4. 30s periodic fires even without mutations", async () => {
		renderHook(() => useAutosave());

		await vi.advanceTimersByTimeAsync(29_999);
		expect(saveFileMock).not.toHaveBeenCalled();

		await vi.advanceTimersByTimeAsync(1);
		await flushMicrotasks();
		expect(saveFileMock).toHaveBeenCalledTimes(1);
	});
});

describe("useAutosave — success and failure transitions", () => {
	it("5. success → saveState='saved' and lastSavedDataKey/StatusTick updated atomically", async () => {
		renderHook(() => useAutosave());
		useRoadmapStore.getState().addChild(NODE_ID);
		const savingDataKey = useRoadmapStore.getState().dataKey;
		const savingStatusTick = useRoadmapStore.getState().statusTick;

		await vi.advanceTimersByTimeAsync(2000);
		await flushMicrotasks();

		const state = useRoadmapStore.getState();
		expect(state.saveState).toBe("saved");
		expect(state.lastSavedDataKey).toBe(savingDataKey);
		expect(state.lastSavedStatusTick).toBe(savingStatusTick);
	});

	it("6. failure (ok:false) → saveState='error-retrying', failureCount=1, 5s auto-retry scheduled, lastSavedDataKey NOT advanced", async () => {
		saveFileMock.mockResolvedValue({ ok: false, error: "disk full" });
		renderHook(() => useAutosave());
		const lastSavedBefore = useRoadmapStore.getState().lastSavedDataKey;
		useRoadmapStore.getState().addChild(NODE_ID);

		await vi.advanceTimersByTimeAsync(2000);
		await flushMicrotasks();

		const state = useRoadmapStore.getState();
		expect(state.saveState).toBe("error-retrying");
		expect(state.failureCount).toBe(1);
		expect(state.lastSavedDataKey).toBe(lastSavedBefore);
		expect(saveFileMock).toHaveBeenCalledTimes(1);

		// Auto-retry fires at 5s
		await vi.advanceTimersByTimeAsync(5000);
		await flushMicrotasks();
		expect(saveFileMock).toHaveBeenCalledTimes(2);
	});

	it("7. 2 consecutive failures → saveState='error-manual', no additional auto-retry timer", async () => {
		saveFileMock.mockResolvedValue({ ok: false, error: "err" });
		renderHook(() => useAutosave());
		useRoadmapStore.getState().addChild(NODE_ID);

		await vi.advanceTimersByTimeAsync(2000);
		await flushMicrotasks();
		// After 1st failure: error-retrying. auto-retry in 5s, which fails again.
		await vi.advanceTimersByTimeAsync(5000);
		await flushMicrotasks();

		const state = useRoadmapStore.getState();
		expect(state.saveState).toBe("error-manual");
		expect(state.failureCount).toBe(2);

		// No further timer pending: advance a long time and expect no new call
		const callsSoFar = saveFileMock.mock.calls.length;
		await vi.advanceTimersByTimeAsync(20_000);
		await flushMicrotasks();
		// Periodic 30s still pending; but we advanced less than 30s since renderHook,
		// so no periodic save yet. callsSoFar should remain unchanged here.
		expect(saveFileMock.mock.calls.length).toBe(callsSoFar);
	});

	it("8. 3 consecutive failures → saveState='error-modal'", async () => {
		saveFileMock.mockResolvedValue({ ok: false, error: "err" });
		renderHook(() => useAutosave());
		useRoadmapStore.getState().addChild(NODE_ID);

		await vi.advanceTimersByTimeAsync(2000);
		await flushMicrotasks();
		await vi.advanceTimersByTimeAsync(5000);
		await flushMicrotasks();
		// 2nd failure leaves error-manual; user-triggered retry kicks another attempt
		useRoadmapStore.getState().triggerSave();
		await flushMicrotasks();

		expect(useRoadmapStore.getState().saveState).toBe("error-modal");
		expect(useRoadmapStore.getState().failureCount).toBe(3);
	});

	it("9. success after a failure resets failureCount to 0", async () => {
		saveFileMock.mockResolvedValueOnce({ ok: false, error: "first" });
		saveFileMock.mockResolvedValue({ ok: true });
		renderHook(() => useAutosave());
		useRoadmapStore.getState().addChild(NODE_ID);

		await vi.advanceTimersByTimeAsync(2000);
		await flushMicrotasks();
		expect(useRoadmapStore.getState().failureCount).toBe(1);

		// 5s auto-retry succeeds
		await vi.advanceTimersByTimeAsync(5000);
		await flushMicrotasks();

		expect(useRoadmapStore.getState().failureCount).toBe(0);
		expect(useRoadmapStore.getState().saveState).toBe("saved");
	});

	it("10. autosavePaused flag suppresses saveFile calls", async () => {
		renderHook(() => useAutosave());
		useRoadmapStore.getState().setExternalEdit("/tmp/ext.json");
		useRoadmapStore.getState().addChild(NODE_ID);

		await vi.advanceTimersByTimeAsync(5000);
		await flushMicrotasks();
		expect(saveFileMock).not.toHaveBeenCalled();
	});

	it("11. Warning 8 derived-dirty: false after save success, true after subsequent mutation", async () => {
		renderHook(() => useAutosave());
		useRoadmapStore.getState().addChild(NODE_ID);
		await vi.advanceTimersByTimeAsync(2000);
		await flushMicrotasks();

		expect(hasUnsavedEdits(useRoadmapStore.getState())).toBe(false);

		useRoadmapStore.getState().addChild(NODE_ID);
		expect(hasUnsavedEdits(useRoadmapStore.getState())).toBe(true);
	});
});
