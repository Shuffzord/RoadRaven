/**
 * Load-time roadmap backups (VIEW-12, reworked in v0.7 phase 3).
 *
 * Backups used to be written as `<file>.bak.json` NEXT TO the roadmap file,
 * littering git-tracked directories. They now land in the app-data dir
 * (same root settings.json uses) under `backups/`, named
 * `<original-basename-without-.json>.<epoch-ms>.bak.json`, keeping only the
 * newest 5 per original file.
 */
import {
	existsSync,
	mkdirSync,
	readdirSync,
	unlinkSync,
	writeFileSync,
} from "node:fs";
import { basename, join } from "node:path";
import { getUserDataDir } from "./settings";

const KEEP_NEWEST = 5;

/** Resolve the backups directory. `baseDir` overrides app-data for tests. */
export function getBackupsDir(baseDir?: string): string {
	return join(baseDir ?? getUserDataDir(), "backups");
}

/**
 * Write a pre-load backup of `raw` (the roadmap file's original bytes) into
 * the app-data backups dir, then rotate old backups for the same original
 * file down to the newest 5. Returns the backup path written.
 *
 * @throws on write failure — callers log and continue (backup is best-effort).
 */
export function writeLoadBackup(
	originalPath: string,
	raw: string,
	baseDir?: string,
): string {
	const dir = getBackupsDir(baseDir);
	if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
	const stem = basename(originalPath).replace(/\.json$/, "");
	const bakPath = join(dir, `${stem}.${Date.now()}.bak.json`);
	writeFileSync(bakPath, raw, "utf-8");
	rotateBackups(dir, stem);
	return bakPath;
}

/** Delete all but the newest KEEP_NEWEST backups for `stem` in `dir`. */
function rotateBackups(dir: string, stem: string): void {
	const escaped = stem.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const pattern = new RegExp(`^${escaped}\\.(\\d+)\\.bak\\.json$`);
	const backups: Array<{ name: string; ts: number }> = [];
	for (const name of readdirSync(dir)) {
		const match = pattern.exec(name);
		if (match) backups.push({ name, ts: Number(match[1]) });
	}
	backups.sort((a, b) => b.ts - a.ts);
	for (const old of backups.slice(KEEP_NEWEST)) {
		try {
			unlinkSync(join(dir, old.name));
		} catch {
			// best effort — a locked file just survives until the next rotation
		}
	}
}
