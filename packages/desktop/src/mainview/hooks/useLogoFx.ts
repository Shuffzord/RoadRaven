import { type RefObject, useEffect, useRef } from "react";
import {
	isLogoFxVariant,
	LOGO_FX_EVENT,
	LOGO_FX_SOURCE,
	LOGO_FX_VARIANT,
	type LogoFxRequest,
	type LogoFxSource,
	type LogoFxVariant,
} from "../lib/logoFx/constants";
import { LOGO_FX_EFFECTS } from "../lib/logoFx/effects";
import {
	createIdleScheduler,
	type IdleScheduler,
	isEditableElement,
} from "../lib/logoFx/idle";
import {
	createLogoFxPlayer,
	type LogoFxHandle,
	type LogoFxPlayer,
} from "../lib/logoFx/player";
import { useUiStore } from "../store/uiStore";
import { useLogoFxTriggers } from "./useLogoFxTriggers";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

const reducedMotion = (): boolean =>
	window.matchMedia?.(REDUCED_MOTION_QUERY).matches === true;

const enabled = (): boolean => useUiStore.getState().logoEffectsEnabled;

const NOTHING: LogoFxHandle = {
	finished: Promise.resolve(),
	cancel: () => undefined,
};

const isSource = (value: unknown): value is LogoFxSource =>
	value === LOGO_FX_SOURCE.ACTION || value === LOGO_FX_SOURCE.IDLE;

/** The user's activity the idle scheduler holds back for. */
interface Activity {
	lastInputAt: number;
	pointerDown: boolean;
}

function createIdle(player: LogoFxPlayer, activity: Activity): IdleScheduler {
	return createIdleScheduler({
		after: (ms, fn) => {
			const handle = window.setTimeout(fn, ms);
			return () => window.clearTimeout(handle);
		},
		random: Math.random,
		active: () => enabled() && !reducedMotion(),
		conditions: () => ({
			hidden: document.hidden,
			dragging: activity.pointerDown,
			msSinceInput: performance.now() - activity.lastInputAt,
			editableFocused: isEditableElement(document.activeElement),
		}),
		play: () => {
			player.request(LOGO_FX_VARIANT.BIT_DRIFT, LOGO_FX_SOURCE.IDLE);
		},
	});
}

/**
 * Wires the player and the idle scheduler to the window. Returns the
 * teardown. Input cancels only an idle effect (D-3); the window going hidden,
 * the setting turning off and the teardown cancel any effect.
 */
function attachLogoFx(player: LogoFxPlayer): () => void {
	const activity: Activity = {
		lastInputAt: Number.NEGATIVE_INFINITY,
		pointerDown: false,
	};
	const idle = createIdle(player, activity);

	const play = (variant: LogoFxVariant, source: LogoFxSource): void => {
		// Any effect that starts pushes the next idle one back.
		if (player.request(variant, source)) idle.restart();
	};
	const onRequest = (e: Event): void => {
		// Untrusted until checked: any code can dispatch the event.
		const detail = (e as CustomEvent<Partial<LogoFxRequest> | null>).detail;
		const source = isSource(detail?.source)
			? detail.source
			: LOGO_FX_SOURCE.ACTION;
		if (isLogoFxVariant(detail?.variant)) play(detail.variant, source);
	};
	const onInput = (): void => {
		activity.lastInputAt = performance.now();
		player.cancelIdle();
	};
	const onPointerDown = (): void => {
		activity.pointerDown = true;
		onInput();
	};
	const onPointerUp = (): void => {
		activity.pointerDown = false;
	};
	const onVisibility = (): void => {
		if (document.hidden) player.cancel();
	};
	const onSettingsChange = (): void => {
		if (!enabled()) player.cancel();
		idle.restart();
	};
	const motionQuery = window.matchMedia?.(REDUCED_MOTION_QUERY);
	const unsubSettings = useUiStore.subscribe((state, prev) => {
		if (state.logoEffectsEnabled !== prev.logoEffectsEnabled) {
			onSettingsChange();
		}
	});

	window.addEventListener(LOGO_FX_EVENT, onRequest);
	window.addEventListener("pointerdown", onPointerDown, true);
	window.addEventListener("pointerup", onPointerUp, true);
	window.addEventListener("pointercancel", onPointerUp, true);
	window.addEventListener("keydown", onInput, true);
	document.addEventListener("visibilitychange", onVisibility);
	motionQuery?.addEventListener?.("change", onSettingsChange);
	idle.restart();
	return () => {
		window.removeEventListener(LOGO_FX_EVENT, onRequest);
		window.removeEventListener("pointerdown", onPointerDown, true);
		window.removeEventListener("pointerup", onPointerUp, true);
		window.removeEventListener("pointercancel", onPointerUp, true);
		window.removeEventListener("keydown", onInput, true);
		document.removeEventListener("visibilitychange", onVisibility);
		motionQuery?.removeEventListener?.("change", onSettingsChange);
		unsubSettings();
		idle.stop();
		player.cancel();
	};
}

/**
 * Plays logo effects on the canvas watermark stage: LOGO_FX_EVENT requests,
 * the app actions in LOGO_FX_TRIGGERS (useLogoFxTriggers) and the idle Bit
 * drift. Everything is DOM-only: no store writes and no state, so an effect
 * never re-renders the canvas or a node card. Silent under reduced motion
 * and with the Preferences setting off.
 *
 * Returns the ref to put on the stage element.
 */
export function useLogoFx(): RefObject<HTMLDivElement | null> {
	const stageRef = useRef<HTMLDivElement | null>(null);
	const playerRef = useRef<LogoFxPlayer | null>(null);

	useLogoFxTriggers();

	useEffect(() => {
		playerRef.current ??= createLogoFxPlayer({
			run: (variant) => {
				const stage = stageRef.current;
				return stage ? LOGO_FX_EFFECTS[variant](stage) : NOTHING;
			},
			now: () => performance.now(),
			reducedMotion,
			enabled,
		});
		return attachLogoFx(playerRef.current);
	}, []);

	return stageRef;
}
