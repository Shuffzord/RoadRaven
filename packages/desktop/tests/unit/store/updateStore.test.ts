// v0.8.5 Phase 2 — updateStore: the renderer's only owner of UpdateState,
// plus the per-launch "Later" dismissal and the prompt predicate (D-2).
import { beforeEach, describe, expect, it } from "vitest";
import {
	shouldPromptForUpdate,
	useUpdateStore,
} from "../../../src/mainview/store/updateStore";

beforeEach(() => {
	useUpdateStore.setState({
		state: { status: "idle" },
		dismissedVersion: null,
	});
});

describe("updateStore", () => {
	it("starts idle with nothing dismissed", () => {
		const s = useUpdateStore.getState();
		expect(s.state).toEqual({ status: "idle" });
		expect(s.dismissedVersion).toBeNull();
	});

	it("setState replaces the whole UpdateState", () => {
		useUpdateStore
			.getState()
			.setState({ status: "downloading", version: "0.8.6", progress: 40 });
		useUpdateStore.getState().setState({ status: "ready", version: "0.8.6" });
		expect(useUpdateStore.getState().state).toEqual({
			status: "ready",
			version: "0.8.6",
		});
	});

	it("dismiss records the version", () => {
		useUpdateStore.getState().dismiss("0.8.6");
		expect(useUpdateStore.getState().dismissedVersion).toBe("0.8.6");
	});
});

describe("shouldPromptForUpdate", () => {
	const available = { status: "available", version: "0.8.6" } as const;

	it("prompts for an available version that was not dismissed", () => {
		expect(shouldPromptForUpdate(available, null)).toBe(true);
	});

	it("does not prompt for the dismissed version", () => {
		expect(shouldPromptForUpdate(available, "0.8.6")).toBe(false);
	});

	it("prompts again for a newer version than the dismissed one", () => {
		expect(
			shouldPromptForUpdate({ status: "available", version: "0.8.7" }, "0.8.6"),
		).toBe(true);
	});

	it.each([
		{ status: "idle" },
		{ status: "disabled", reason: "dev" },
		{ status: "checking" },
		{ status: "up-to-date", version: "0.8.5" },
		{ status: "downloading", version: "0.8.6", progress: 10 },
		{ status: "ready", version: "0.8.6" },
		{ status: "error", message: "boom" },
	] as const)("does not prompt while $status", (state) => {
		expect(shouldPromptForUpdate(state, null)).toBe(false);
	});
});
