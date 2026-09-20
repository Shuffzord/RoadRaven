// Platform seam — see window.ts for the allow-listed-import rationale.

import type { NotificationOptions } from "electrobun/bun";
import { Utils } from "electrobun/bun";

/** Wraps Utils.showNotification — pops a native OS notification. */
export function showNotification(opts: NotificationOptions): void {
	Utils.showNotification(opts);
}
