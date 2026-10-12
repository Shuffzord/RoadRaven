import { existsSync } from "node:fs";
import { mkdir, readFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import { atomicWrite } from "./atomicWrite";
import { getUserDataDir } from "./settings";

const SENTINEL_FILENAME = "event-api.json";

export interface SentinelShape {
	port: number;
	url: string; // e.g. "ws://127.0.0.1:47921"
	startedAt: string; // ISO 8601
	pid: number;
}

export function getSentinelPath(): string {
	return join(getUserDataDir(), SENTINEL_FILENAME);
}

export async function writeSentinel(data: SentinelShape): Promise<void> {
	const dir = getUserDataDir();
	if (!existsSync(dir)) {
		await mkdir(dir, { recursive: true });
	}
	// atomicWrite writes to .tmp then renames — matches D-04 "atomically written"
	await atomicWrite(getSentinelPath(), JSON.stringify(data, null, 2));
}

// Only removes the file when it is ours: an instance still shutting down after
// the next one started must not delete the newer instance's sentinel.
export async function deleteSentinel(): Promise<void> {
	try {
		const path = getSentinelPath();
		const { pid } = JSON.parse(await readFile(path, "utf-8")) as SentinelShape;
		if (pid === process.pid) await unlink(path);
	} catch {
		// Missing, unreadable or corrupt file, or held by another process; best-effort delete
	}
}
