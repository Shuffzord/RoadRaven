// Platform seam — see window.ts for the allow-listed-import rationale.
import { Utils } from "electrobun/bun";
import { bunLogger } from "../logging";

/**
 * Wraps Utils.showItemInFolder (devkit sdks/main/core/Utils.ts:14 — fire-and-
 * forget, returns void) — reveals `path` in the OS file manager.
 */
export function showItemInFolder(path: string): { ok: boolean } {
	try {
		Utils.showItemInFolder(path);
		return { ok: true };
	} catch (err) {
		bunLogger.error`showItemInFolder failed for ${path}: ${String(err)}`;
		return { ok: false };
	}
}

/**
 * Wraps Utils.openExternal (devkit sdks/main/core/Utils.ts:35 — returns
 * whether the OS accepted the URL). The scheme allow-list lives in the
 * windowRpc handler, next to revealInFolder's exists guard.
 */
export function openExternal(url: string): { ok: boolean } {
	try {
		return { ok: Utils.openExternal(url) };
	} catch (err) {
		bunLogger.error`openExternal failed for ${url}: ${String(err)}`;
		return { ok: false };
	}
}
