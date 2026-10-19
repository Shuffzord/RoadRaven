import {
	LOGO_FX_IDLE_MAX_MS,
	LOGO_FX_IDLE_MIN_MS,
	LOGO_FX_IDLE_QUIET_MS,
	LOGO_FX_IDLE_RETRY_MS,
} from "./constants";

/** What the user is doing when the idle timer fires. */
export interface IdleConditions {
	hidden: boolean;
	/** A pointer is down (a pan, a card drag, a click in progress). */
	dragging: boolean;
	msSinceInput: number;
	/** An input, textarea, select, contenteditable or CodeMirror has focus. */
	editableFocused: boolean;
}

export interface IdleSchedulerDeps {
	/** Runs `fn` after `ms`; returns a function that cancels it. */
	after(ms: number, fn: () => void): () => void;
	/** A number in [0, 1). */
	random(): number;
	/** False under reduced motion or with the setting off: nothing schedules. */
	active(): boolean;
	conditions(): IdleConditions;
	play(): void;
}

export interface IdleScheduler {
	/** Start over: the next play is a fresh random delay from now. */
	restart(): void;
	stop(): void;
}

const EDITABLE =
	'input, textarea, select, [contenteditable]:not([contenteditable="false"]), .cm-editor';

export function isEditableElement(el: Element | null): boolean {
	return el?.closest(EDITABLE) != null;
}

function isBusy(c: IdleConditions): boolean {
	return (
		c.hidden ||
		c.dragging ||
		c.msSinceInput < LOGO_FX_IDLE_QUIET_MS ||
		c.editableFocused
	);
}

/**
 * Plays the idle effect a random 10–60 s after the last effect. While the
 * user is busy it looks again every 3 s instead of playing. Pure: timers,
 * randomness, the setting and the user's activity are all injected.
 */
export function createIdleScheduler(deps: IdleSchedulerDeps): IdleScheduler {
	let cancelTimer: (() => void) | null = null;

	const stop = (): void => {
		cancelTimer?.();
		cancelTimer = null;
	};

	const schedule = (ms: number): void => {
		stop();
		if (deps.active()) cancelTimer = deps.after(ms, tick);
	};

	const restart = (): void =>
		schedule(
			LOGO_FX_IDLE_MIN_MS +
				deps.random() * (LOGO_FX_IDLE_MAX_MS - LOGO_FX_IDLE_MIN_MS),
		);

	function tick(): void {
		cancelTimer = null;
		if (!deps.active()) return;
		if (isBusy(deps.conditions())) {
			schedule(LOGO_FX_IDLE_RETRY_MS);
			return;
		}
		deps.play();
		restart();
	}

	return { restart, stop };
}
