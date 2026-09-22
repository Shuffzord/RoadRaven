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
