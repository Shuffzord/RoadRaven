// Platform seam — see window.ts for the allow-listed-import rationale.
import Electrobun from "electrobun/bun";

/**
 * Wraps Electrobun.events.on("before-quit", handler) — the Electrobun-native
 * quit lifecycle event. Covers macOS Cmd+Q, Windows Alt+F4, Dock → Quit,
 * Linux window-close, and (v0.8.5) Updater.applyUpdate's own quit path —
 * all routed through requestQuitApproval/quitAfterApproval, which emit this
 * event before native shutdown. Verified API (2.x devkit):
 *   .hutch/devkit/api/sdks/main/core/Utils.ts:134-190 — requestQuitApproval /
 *     quitAfterApproval / quit (emits the beforeQuit event, then calls
 *     ffi.request.quitGracefully or process.exit)
 *
 * Phase 0 R3: the emit is synchronous (Node's EventEmitter.emit) and is not
 * awaited, so an async handler registered here gets essentially no event-loop
 * time before native shutdown proceeds — see index.ts's before-quit wiring.
 *
 * Node's own process.on("SIGTERM"|"SIGINT"|"exit") handlers are a separate,
 * Bun-native path (see index.ts) and are unaffected by this wrapper.
 */
export function onBeforeQuit(handler: () => void | Promise<void>): void {
	Electrobun.events.on("before-quit", handler);
}
