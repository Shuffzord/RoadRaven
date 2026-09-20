// Platform seam — see window.ts for the allow-listed-import rationale.
import Electrobun from "electrobun/bun";

/**
 * Wraps Electrobun.events.on("before-quit", handler) — the Electrobun-native
 * quit lifecycle event. Covers macOS Cmd+Q, Windows Alt+F4, Dock → Quit,
 * Linux window-close (all routed through Utils.quit which emits this event).
 * Verified API (electrobun@1.16.0):
 *   dist/api/bun/events/ApplicationEvents.ts:20-21 — beforeQuit factory
 *   dist/api/bun/events/eventEmitter.ts:43         — singleton emitter
 *   dist/api/bun/core/Utils.ts:122-148              — Utils.quit() emits + stopEventLoop
 *   dist/api/bun/index.ts:114                       — Electrobun.events singleton
 *
 * Node's own process.on("SIGTERM"|"SIGINT"|"exit") handlers are a separate,
 * Bun-native path (see index.ts) and are unaffected by this wrapper.
 */
export function onBeforeQuit(handler: () => void | Promise<void>): void {
	Electrobun.events.on("before-quit", handler);
}
