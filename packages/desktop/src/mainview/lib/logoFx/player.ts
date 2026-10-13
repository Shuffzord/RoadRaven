import {
	LOGO_FX_COOLDOWN_MS,
	LOGO_FX_PRIORITY,
	LOGO_FX_SOURCE,
	type LogoFxSource,
	type LogoFxVariant,
} from "./constants";

/** A playing effect. `finished` settles (never rejects) when it ends or is cancelled. */
export interface LogoFxHandle {
	finished: Promise<void>;
	cancel(): void;
}

export interface LogoFxPlayerDeps {
	/** Starts the effect on the stage. */
	run(variant: LogoFxVariant): LogoFxHandle;
	now(): number;
	reducedMotion(): boolean;
	enabled(): boolean;
}

export interface LogoFxPlayer {
	/**
	 * Plays `variant` if the rules allow it; true when it started. `source`
	 * defaults to "action".
	 */
	request(variant: LogoFxVariant, source?: LogoFxSource): boolean;
	/** Stops the running effect, if any; the cooldown starts now. */
	cancel(): void;
	/** Stops the running effect only when the idle timer started it (D-3). */
	cancelIdle(): void;
	current(): LogoFxVariant | null;
}

interface Run {
	variant: LogoFxVariant;
	source: LogoFxSource;
	handle: LogoFxHandle;
}

/**
 * Decides which logo effect plays — one at a time, a higher priority
 * pre-empting a lower one, nothing during the cooldown after an effect, and
 * nothing at all under reduced motion or when disabled. Pure: no DOM, no
 * React; the effect itself and the clock are injected.
 */
export function createLogoFxPlayer(deps: LogoFxPlayerDeps): LogoFxPlayer {
	let running: Run | null = null;
	let last: { variant: LogoFxVariant; endedAt: number } | null = null;

	const end = (run: Run): void => {
		if (running !== run) return;
		running = null;
		last = { variant: run.variant, endedAt: deps.now() };
	};

	/** The effect a new request has to outrank, or null when the stage is free. */
	const blocker = (): LogoFxVariant | null => {
		if (running) return running.variant;
		if (last && deps.now() < last.endedAt + LOGO_FX_COOLDOWN_MS) {
			return last.variant;
		}
		return null;
	};

	const cancel = (): void => {
		const run = running;
		if (!run) return;
		end(run);
		run.handle.cancel();
	};

	return {
		request(variant, source = LOGO_FX_SOURCE.ACTION) {
			if (!deps.enabled() || deps.reducedMotion()) return false;
			const other = blocker();
			if (other && LOGO_FX_PRIORITY[variant] <= LOGO_FX_PRIORITY[other]) {
				return false;
			}
			cancel();
			const run: Run = { variant, source, handle: deps.run(variant) };
			running = run;
			run.handle.finished.then(() => end(run));
			return true;
		},
		cancel,
		cancelIdle() {
			if (running?.source === LOGO_FX_SOURCE.IDLE) cancel();
		},
		current: () => running?.variant ?? null,
	};
}
