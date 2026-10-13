/**
 * v0.9.1 logo FX — the contract every caller of the background-logo effects
 * uses. Anything may ask for an effect with
 * `window.dispatchEvent(new CustomEvent(LOGO_FX_EVENT, { detail: { variant } }))`;
 * the canvas (useLogoFx) decides whether it actually plays.
 */

export const LOGO_FX_EVENT = "roadraven:logo-fx";

export const LOGO_FX_VARIANT = {
	SHIMMER: "shimmer",
	CIRCUIT_PULSE: "circuit-pulse",
	POWER_SURGE: "power-surge",
	GLITCH: "glitch",
	STATUS_AURORA: "status-aurora",
	BIT_DRIFT: "bit-drift",
} as const;

export type LogoFxVariant =
	(typeof LOGO_FX_VARIANT)[keyof typeof LOGO_FX_VARIANT];

/**
 * Who asked for an effect. An idle effect gives way to any pointer or key
 * input; an action effect plays to its end (D-3). Absent means "action".
 */
export const LOGO_FX_SOURCE = {
	ACTION: "action",
	IDLE: "idle",
} as const;

export type LogoFxSource = (typeof LOGO_FX_SOURCE)[keyof typeof LOGO_FX_SOURCE];

/** The `detail` of a LOGO_FX_EVENT. */
export interface LogoFxRequest {
	variant: LogoFxVariant;
	source?: LogoFxSource;
}

/** The app actions that can play a logo effect (see LOGO_FX_TRIGGERS). */
export const LOGO_FX_ACTION = {
	AGENT_CONNECTED: "agent-connected",
	NODE_COMPLETED: "node-completed",
	PHASE_COMPLETED: "phase-completed",
	FILE_OPENED: "file-opened",
	AGENT_BATCH: "agent-batch",
	NODE_BLOCKED: "node-blocked",
	SAVE_FAILED: "save-failed",
	IDLE: "idle",
} as const;

export type LogoFxAction = (typeof LOGO_FX_ACTION)[keyof typeof LOGO_FX_ACTION];

/** One store update that changes at least this many nodes is an agent batch. */
export const LOGO_FX_BATCH_MIN = 3;

/** The idle effect plays a random 10–60 s after the last effect. */
export const LOGO_FX_IDLE_MIN_MS = 10_000;
export const LOGO_FX_IDLE_MAX_MS = 60_000;
/** No idle effect within this long of the last pointer or key input. */
export const LOGO_FX_IDLE_QUIET_MS = 4000;
/** A suppressed idle effect looks again after this long. */
export const LOGO_FX_IDLE_RETRY_MS = 3000;

/** Preferences › Appearance checkbox (AppSettings.logoEffects). */
export const LOGO_EFFECTS_LABEL = "Animate the background logo";

/**
 * A higher number cancels a running lower one. Glitch outranks the rest; an
 * equal or lower request while one plays (or during the cooldown after it)
 * is dropped, never queued.
 */
export const LOGO_FX_PRIORITY: Record<LogoFxVariant, number> = {
	[LOGO_FX_VARIANT.SHIMMER]: 1,
	[LOGO_FX_VARIANT.CIRCUIT_PULSE]: 1,
	[LOGO_FX_VARIANT.POWER_SURGE]: 1,
	[LOGO_FX_VARIANT.STATUS_AURORA]: 1,
	[LOGO_FX_VARIANT.BIT_DRIFT]: 1,
	[LOGO_FX_VARIANT.GLITCH]: 2,
};

/** Quiet time after an effect ends (or is cancelled) before the next one. */
export const LOGO_FX_COOLDOWN_MS = 1500;

export function isLogoFxVariant(value: unknown): value is LogoFxVariant {
	return typeof value === "string" && Object.hasOwn(LOGO_FX_PRIORITY, value);
}
