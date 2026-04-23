import { existsSync } from "node:fs";
import { mkdir, unlink } from "node:fs/promises";
import { join } from "node:path";
import { atomicWrite } from "./atomicWrite";
import { getUserDataDir } from "./settings";

export const SENTINEL_FILENAME = "event-api.json";

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

export async function deleteSentinel(): Promise<void> {
	try {
		await unlink(getSentinelPath());
	} catch {
		// File may not exist (never bound) or be held by another process; best-effort delete
	}
}
