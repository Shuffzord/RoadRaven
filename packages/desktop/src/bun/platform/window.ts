// Platform seam — the only place outside this directory (plus
// mainview/rpc.ts on the renderer side) that may import from "electrobun/bun"
// or "electrobun/view" (enforced by biome.json's noRestrictedImports override
// and tests/architecture/no-direct-electrobun-imports.test.ts). Concentrating
// the Electrobun touchpoints here collapses a future Electrobun major-version
// migration's blast radius to this directory.
//
// Wraps BrowserView.defineRPC and `new BrowserWindow(...)`. Callers get types
// by inference (e.g. `ReturnType<typeof createMainWindow<AppRpc>>`) instead
// of importing BrowserView/BrowserWindow themselves.

import type { ElectrobunRPCSchema } from "electrobun/bun";
import { BrowserView, BrowserWindow } from "electrobun/bun";

/**
 * Wraps BrowserView.defineRPC<Schema>({...}) — defines the bun-side RPC
 * handler table for the main window's webview.
 */
export function defineMainRpc<Schema extends ElectrobunRPCSchema>(
	config: Parameters<typeof BrowserView.defineRPC<Schema>>[0],
) {
	return BrowserView.defineRPC<Schema>(config);
}

// BrowserWindow's generic constraint (RPCWithTransport) isn't exported by
// electrobun/bun, so it's recovered here from BrowserWindow's own default
// (unparameterized) constructor signature instead of being restated by hand.
type DefaultWindowOptions = NonNullable<
	ConstructorParameters<typeof BrowserWindow>[0]
>;
type RpcInstance = NonNullable<DefaultWindowOptions["rpc"]>;

/**
 * Wraps `new BrowserWindow({...})` — creates the main application window.
 */
export function createMainWindow<Rpc extends RpcInstance>(
	opts: ConstructorParameters<typeof BrowserWindow<Rpc>>[0],
) {
	return new BrowserWindow<Rpc>(opts);
}

// The window returned by createMainWindow, without callers naming BrowserWindow.
type MainWindowLike = Pick<
	BrowserWindow<RpcInstance>,
	"setTitle" | "close" | "on"
>;

/** Wraps BrowserWindow#setTitle (devkit sdks/main/core/BrowserWindow.ts:277). */
export function setMainWindowTitle(win: MainWindowLike, title: string): void {
	win.setTitle(title);
}

/**
 * The `will-close` event as seen by a handler: only the `response` setter is
 * exposed (devkit sdks/main/events/event.ts:19-22 marks responseWasSet;
 * sdks/main/events/windowEvents.ts:16-17 types the response as {allow}).
 */
export interface WillCloseEvent {
	response: { allow: boolean };
}

/**
 * Wraps BrowserWindow#on("will-close", ...) (devkit BrowserWindow.ts:439-441).
 * The native should-close callback (devkit sdks/main/proc/native.ts:2634-2645)
 * emits this SYNCHRONOUSLY and reads `event.response.allow` right after
 * emit — the handler is not awaited, so it must set the response before
 * returning.
 */
export function onWillClose(
	win: MainWindowLike,
	handler: (event: WillCloseEvent) => void,
): void {
	win.on("will-close", handler as (event: unknown) => void);
}

/**
 * Wraps BrowserWindow#close (devkit BrowserWindow.ts:291) — closes the window
 * programmatically via ffi closeWindow (native.ts:1534), which does NOT
 * re-enter the will-close callback.
 */
export function closeMainWindow(win: MainWindowLike): void {
	win.close();
}
