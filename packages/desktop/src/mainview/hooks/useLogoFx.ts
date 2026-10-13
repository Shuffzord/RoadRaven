import { type RefObject, useEffect, useRef } from "react";
import {
	isLogoFxVariant,
	LOGO_FX_EVENT,
	type LogoFxRequest,
} from "../lib/logoFx/constants";
import { LOGO_FX_EFFECTS } from "../lib/logoFx/effects";
import {
	createLogoFxPlayer,
	type LogoFxHandle,
	type LogoFxPlayer,
} from "../lib/logoFx/player";

const reducedMotion = (): boolean =>
	window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;

const NOTHING: LogoFxHandle = {
	finished: Promise.resolve(),
	cancel: () => undefined,
};

/**
 * Plays LOGO_FX_EVENT requests on the canvas watermark stage. Everything is
 * DOM-only: no store writes and no state, so an effect never re-renders the
 * canvas or a node card. Any pointerdown or keydown, the window going hidden
 * and unmount all stop the running effect.
 *
 * Returns the ref to put on the stage element.
 */
export function useLogoFx(): RefObject<HTMLDivElement | null> {
	const stageRef = useRef<HTMLDivElement | null>(null);
	const playerRef = useRef<LogoFxPlayer | null>(null);

	useEffect(() => {
		playerRef.current ??= createLogoFxPlayer({
			run: (variant) => {
				const stage = stageRef.current;
				return stage ? LOGO_FX_EFFECTS[variant](stage) : NOTHING;
			},
			now: () => performance.now(),
			reducedMotion,
			// Phase 2 wires the user setting in here.
			enabled: () => true,
		});
		const player = playerRef.current;

		const onRequest = (e: Event): void => {
			// Untrusted until checked: any code can dispatch the event.
			const detail = (e as CustomEvent<Partial<LogoFxRequest> | null>).detail;
			if (isLogoFxVariant(detail?.variant)) player.request(detail.variant);
		};
		const stop = (): void => player.cancel();
		const onVisibility = (): void => {
			if (document.hidden) player.cancel();
		};

		window.addEventListener(LOGO_FX_EVENT, onRequest);
		window.addEventListener("pointerdown", stop, true);
		window.addEventListener("keydown", stop, true);
		document.addEventListener("visibilitychange", onVisibility);
		return () => {
			window.removeEventListener(LOGO_FX_EVENT, onRequest);
			window.removeEventListener("pointerdown", stop, true);
			window.removeEventListener("keydown", stop, true);
			document.removeEventListener("visibilitychange", onVisibility);
			player.cancel();
		};
	}, []);

	return stageRef;
}
