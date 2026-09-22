import { bunLogger } from "./logging";
import type { WillCloseEvent } from "./platform/window";

export const CONFIRM_CLOSE_TIMEOUT_MS = 3000;

export interface CloseGuardDeps {
	/** Ask the renderer whether the window may close (webview confirmClose). */
	confirmClose: () => Promise<{ allow: boolean }>;
	/** Close the window programmatically (platform closeMainWindow). */
	closeWindow: () => void;
	timeoutMs?: number;
}

/**
 * Window close guard (v0.8.2 A1).
 *
 * The devkit's should-close callback (sdks/main/proc/native.ts:2634-2645)
 * emits `will-close` through Node's EventEmitter and reads
 * `event.responseWasSet` / `event.response.allow` immediately after emit —
 * handlers are NOT awaited, so the renderer cannot be consulted inline.
 * Fallback path: the first will-close answers { allow: false }, asks the
 * renderer asynchronously, and on approval closes the window programmatically
 * (BrowserWindow#close → ffi closeWindow, native.ts:1534, which bypasses the
 * should-close callback). `closeApproved` covers a platform that routes that
 * close back through will-close: the second event then answers allow.
 *
 * A renderer that times out or throws is treated as allow so it can never
 * trap the user in the window.
 */
export function createCloseGuard(
	deps: CloseGuardDeps,
): (event: WillCloseEvent) => void {
	const timeoutMs = deps.timeoutMs ?? CONFIRM_CLOSE_TIMEOUT_MS;
	let closeApproved = false;
	let confirmInFlight = false;

	return (event) => {
		if (closeApproved) {
			event.response = { allow: true };
			return;
		}
		event.response = { allow: false };
		if (confirmInFlight) return;
		confirmInFlight = true;
		void confirmWithTimeout(deps.confirmClose, timeoutMs).then((allow) => {
			confirmInFlight = false;
			if (!allow) return;
			closeApproved = true;
			deps.closeWindow();
		});
	};
}

async function confirmWithTimeout(
	confirmClose: CloseGuardDeps["confirmClose"],
	timeoutMs: number,
): Promise<boolean> {
	let timer: ReturnType<typeof setTimeout> | undefined;
	const timeout = new Promise<boolean>((resolve) => {
		timer = setTimeout(() => {
			bunLogger.warn`confirmClose: renderer silent for ${timeoutMs}ms; allowing close`;
			resolve(true);
		}, timeoutMs);
	});
	const answer = confirmClose().then(
		(r) => r.allow,
		(err) => {
			bunLogger.error`confirmClose failed: ${String(err)}; allowing close`;
			return true;
		},
	);
	try {
		return await Promise.race([answer, timeout]);
	} finally {
		clearTimeout(timer);
	}
}
