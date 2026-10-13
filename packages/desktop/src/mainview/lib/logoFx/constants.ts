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

/** The `detail` of a LOGO_FX_EVENT. */
export interface LogoFxRequest {
	variant: LogoFxVariant;
}

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
