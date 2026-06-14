import { unlinkSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { bunLogger } from "./logging";
// Rename is isolated in its own module so unit tests can spy on the call site
// (ESM namespace from `node:fs` is not configurable for mocking).
import * as renameModule from "./renameSync";

/**
 * Error codes that are retriable during atomic rename on Windows.
 * - EPERM / EBUSY / EACCES: transient lock from antivirus or indexer scanning the tmp file
 * - EEXIST: rare Windows/network filesystem corner case where destination appears to exist
 */
const RETRIABLE_CODES = new Set(["EPERM", "EBUSY", "EACCES", "EEXIST"]);

/**
 * Exported for unit testing. Returns true if the error's `code` matches one of
 * the retriable errno codes above.
 */
export function isRetriableError(err: unknown): boolean {
	const code = (err as NodeJS.ErrnoException | null)?.code;
	return typeof code === "string" && RETRIABLE_CODES.has(code);
}

/**
 * Atomically write `content` to `targetPath`.
 *
 * Algorithm (EDIT-14):
 * 1. Write to `<dir>/.<basename>.<pid>.<ts>.tmp` via `Bun.write`.
 * 2. Rename tmp → target with `fs.renameSync` (atomic on POSIX).
 * 3. On Windows, retry the rename up to 3 times with 50ms delay when the
 *    failure code is EPERM / EBUSY / EACCES / EEXIST.
 * 4. On persistent failure, best-effort unlink the tmp file and rethrow.
 *
 * @throws the final rename error if every retry fails or the error is non-retriable.
 */
export async function atomicWrite(
	targetPath: string,
	content: string,
): Promise<void> {
	const tmpPath = join(
		dirname(targetPath),
		`.${basename(targetPath)}.${process.pid}.${Date.now()}.tmp`,
	);

	try {
		// writeFileSync is used instead of Bun.write so the module works under
		// both the Bun runtime (production) and Node.js (vitest). Bun implements
		// node:fs; Node does not implement the Bun global.
		writeFileSync(tmpPath, content, "utf-8");
	} catch (err) {
		bunLogger.error`atomicWrite failed to write tmp ${tmpPath}: ${String(err)}`;
		throw err;
	}

	const maxAttempts = process.platform === "win32" ? 3 : 1;
	let lastErr: unknown;

	for (let attempt = 1; attempt <= maxAttempts; attempt++) {
		try {
			renameModule.renameWithRetry(tmpPath, targetPath);
			return;
		} catch (err) {
			lastErr = err;
			if (!isRetriableError(err) || attempt === maxAttempts) break;
			bunLogger.warn`atomicWrite rename attempt ${attempt} failed (${String((err as NodeJS.ErrnoException).code)}); retrying in 50ms`;
			await new Promise((r) => setTimeout(r, 50));
		}
	}

	try {
		unlinkSync(tmpPath);
	} catch {
		// best effort
	}
	throw lastErr;
}
