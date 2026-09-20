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
