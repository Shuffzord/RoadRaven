// @vitest-environment jsdom
// v0.9.1 Phase 2 — the idle scheduler: Bit drift a random 10–60 s after the
// last effect, held back while the user is busy, never under reduced motion
// or with the setting off.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	LOGO_FX_IDLE_MAX_MS,
	LOGO_FX_IDLE_MIN_MS,
	LOGO_FX_IDLE_QUIET_MS,
	LOGO_FX_IDLE_RETRY_MS,
} from "../../../src/mainview/lib/logoFx/constants";
import {
	createIdleScheduler,
	type IdleConditions,
	isEditableElement,
} from "../../../src/mainview/lib/logoFx/idle";

const CALM: IdleConditions = {
	hidden: false,
	dragging: false,
	msSinceInput: Number.POSITIVE_INFINITY,
	editableFocused: false,
};

function setup(
	opts: { random?: number; active?: boolean; conditions?: IdleConditions } = {},
) {
	const state = {
		active: opts.active ?? true,
		conditions: opts.conditions ?? CALM,
	};
	const play = vi.fn();
	const scheduler = createIdleScheduler({
		after: (ms, fn) => {
			const handle = setTimeout(fn, ms);
			return () => clearTimeout(handle);
		},
		random: () => opts.random ?? 0,
		active: () => state.active,
		conditions: () => state.conditions,
		play,
	});
	return { state, play, scheduler };
}

beforeEach(() => {
	vi.useFakeTimers();
});

afterEach(() => {
	vi.useRealTimers();
	document.body.innerHTML = "";
});

describe("idle scheduler", () => {
	it("plays within 10–60 s of a restart (random 0 → the minimum)", () => {
		const { play, scheduler } = setup({ random: 0 });
		scheduler.restart();

		vi.advanceTimersByTime(LOGO_FX_IDLE_MIN_MS - 1);
		expect(play).not.toHaveBeenCalled();
		vi.advanceTimersByTime(1);
		expect(play).toHaveBeenCalledTimes(1);
	});

	it("plays within 10–60 s of a restart (random ~1 → the maximum)", () => {
		const { play, scheduler } = setup({ random: 0.999999 });
		scheduler.restart();

		vi.advanceTimersByTime(LOGO_FX_IDLE_MAX_MS - 1000);
		expect(play).not.toHaveBeenCalled();
		vi.advanceTimersByTime(1000);
		expect(play).toHaveBeenCalledTimes(1);
	});

	it("schedules the next play a fresh 10–60 s after one plays", () => {
		const { play, scheduler } = setup({ random: 0 });
		scheduler.restart();
		vi.advanceTimersByTime(LOGO_FX_IDLE_MIN_MS);

		vi.advanceTimersByTime(LOGO_FX_IDLE_MIN_MS);

		expect(play).toHaveBeenCalledTimes(2);
	});

	it("a restart (any effect played) pushes the next idle play back", () => {
		const { play, scheduler } = setup({ random: 0 });
		scheduler.restart();
		vi.advanceTimersByTime(LOGO_FX_IDLE_MIN_MS - 100);

		scheduler.restart();
		vi.advanceTimersByTime(LOGO_FX_IDLE_MIN_MS - 1);

		expect(play).not.toHaveBeenCalled();
	});

	it.each<[string, Partial<IdleConditions>]>([
		["the window is hidden", { hidden: true }],
		["a pointer drag is in progress", { dragging: true }],
		[
			"the last input was under 4 s ago",
			{ msSinceInput: LOGO_FX_IDLE_QUIET_MS - 1 },
		],
		["a text field has focus", { editableFocused: true }],
	])("holds back while %s, rechecking every 3 s", (_why, busy) => {
		const { state, play, scheduler } = setup({
			random: 0,
			conditions: { ...CALM, ...busy },
		});
		scheduler.restart();
		vi.advanceTimersByTime(LOGO_FX_IDLE_MIN_MS);
		expect(play).not.toHaveBeenCalled();

		vi.advanceTimersByTime(LOGO_FX_IDLE_RETRY_MS);
		expect(play).not.toHaveBeenCalled();

		state.conditions = CALM;
		vi.advanceTimersByTime(LOGO_FX_IDLE_RETRY_MS - 1);
		expect(play).not.toHaveBeenCalled();
		vi.advanceTimersByTime(1);
		expect(play).toHaveBeenCalledTimes(1);
	});

	it("plays once the last input is 4 s old", () => {
		const { play, scheduler } = setup({
			random: 0,
			conditions: { ...CALM, msSinceInput: LOGO_FX_IDLE_QUIET_MS },
		});
		scheduler.restart();

		vi.advanceTimersByTime(LOGO_FX_IDLE_MIN_MS);

		expect(play).toHaveBeenCalledTimes(1);
	});

	it("never schedules when inactive (reduced motion or disabled)", () => {
		const { play, scheduler } = setup({ active: false });
		scheduler.restart();

		vi.advanceTimersByTime(LOGO_FX_IDLE_MAX_MS * 3);

		expect(play).not.toHaveBeenCalled();
		expect(vi.getTimerCount()).toBe(0);
	});

	it("stops for good when it turns inactive before the timer fires", () => {
		const { state, play, scheduler } = setup({ random: 0 });
		scheduler.restart();
		state.active = false;

		vi.advanceTimersByTime(LOGO_FX_IDLE_MAX_MS * 3);

		expect(play).not.toHaveBeenCalled();
		expect(vi.getTimerCount()).toBe(0);
	});

	it("stop() clears the pending timer", () => {
		const { play, scheduler } = setup({ random: 0 });
		scheduler.restart();

		scheduler.stop();
		vi.advanceTimersByTime(LOGO_FX_IDLE_MAX_MS);

		expect(play).not.toHaveBeenCalled();
		expect(vi.getTimerCount()).toBe(0);
	});
});

describe("isEditableElement", () => {
	it.each([
		["input", "<input />"],
		["textarea", "<textarea></textarea>"],
		["select", "<select></select>"],
		["contenteditable", '<div contenteditable="true"></div>'],
		[
			"CodeMirror",
			'<div class="cm-editor"><div class="cm-content"></div></div>',
		],
	])("treats a focused %s as a text field", (_name, html) => {
		document.body.innerHTML = html;
		const el =
			document.body.querySelector(".cm-content") ??
			(document.body.firstElementChild as Element);

		expect(isEditableElement(el)).toBe(true);
	});

	it("ignores buttons, the body and nothing", () => {
		document.body.innerHTML = "<button></button>";

		expect(isEditableElement(document.body.firstElementChild)).toBe(false);
		expect(isEditableElement(document.body)).toBe(false);
		expect(isEditableElement(null)).toBe(false);
	});
});
