import { readFile } from "node:fs/promises";
import { getSentinelPath } from "./userData";

export interface SentinelData {
	port: number;
	url: string;
	startedAt: string;
	pid: number;
}

const DEFAULT_RETRY_MS = 500;
const DEFAULT_MAX_ATTEMPTS = 6; // 3s total per RESEARCH §6.4

const ERROR_NOT_RUNNING =
	"Roadmap Viewer is not running. Start the app and retry.";

/**
 * Check if a process is alive using signal 0 (POSIX + Windows Node docs confirm).
 * Uses node:* APIs only — zero Bun.* calls (Pitfall 8).
 */
export function isPidAlive(pid: number): boolean {
	try {
		// Signal 0 = liveness probe; POSIX + Windows (Node docs confirm)
		process.kill(pid, 0);
		return true;
	} catch {
		return false;
	}
}

/**
 * Read the sentinel file written by the RoadRaven desktop app at startup.
 * Retries up to maxAttempts times with retryMs backoff (3s total with defaults).
 * Returns ok:false if the file is missing, unparseable, or the pid is dead.
 */
export async function readSentinel(opts?: {
	retryMs?: number;
	maxAttempts?: number;
}): Promise<
	| { ok: true; port: number; url: string; startedAt: string; pid: number }
	| { ok: false; error: string }
> {
	const retryMs = opts?.retryMs ?? DEFAULT_RETRY_MS;
	const maxAttempts = opts?.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;

	for (let i = 0; i < maxAttempts; i++) {
		try {
			const raw = await readFile(getSentinelPath(), "utf-8");
			const parsed = JSON.parse(raw) as SentinelData;
			if (!isPidAlive(parsed.pid)) {
				// PID dead → orphaned sentinel; treat as not running
				return { ok: false, error: ERROR_NOT_RUNNING };
			}
			return { ok: true, ...parsed };
		} catch {
			// File missing or JSON bad; retry
			if (i < maxAttempts - 1) {
				await new Promise((r) => setTimeout(r, retryMs));
			}
		}
	}
	return { ok: false, error: ERROR_NOT_RUNNING };
}
