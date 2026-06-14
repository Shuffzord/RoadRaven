import { renameSync } from "node:fs";

/**
 * Thin wrapper around `node:fs.renameSync` kept in its own module so tests can
 * spy on it via `vi.spyOn(renameModule, "renameWithRetry")`. (ESM namespaces
 * for native modules like `node:fs` are not configurable, so wrapping the call
 * in a plain JS module is the cleanest route to inject a rename failure.)
 */
export function renameWithRetry(from: string, to: string): void {
	renameSync(from, to);
}
