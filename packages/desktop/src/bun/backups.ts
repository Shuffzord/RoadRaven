/**
 * Load-time roadmap backups (VIEW-12, reworked in v0.7 phase 3).
 *
 * Backups used to be written as `<file>.bak.json` NEXT TO the roadmap file,
 * littering git-tracked directories. They now land in the app-data dir
 * (same root settings.json uses) under `backups/`, named
 * `<stem>.<source-hash>.<order>.<uuid>.bak.json`, keeping only the newest 5
 * per normalized absolute source path.
 */
import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
import { basename, join, normalize, resolve } from "node:path";
import * as renameModule from "./renameSync";
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
	mkdirSync(dir, { recursive: true });
	const stem = basename(originalPath).replace(/\.json$/, "");
	const sourceId = sourceIdentity(originalPath);
	const order = nextBackupOrder(dir, stem, sourceId);
	const bakPath = join(
		dir,
		`${stem}.${sourceId}.${order}.${randomUUID()}.bak.json`,
	);
	const tmpPath = join(
		dir,
		`.${basename(bakPath)}.${process.pid}.${randomUUID()}.tmp`,
	);
	try {
		writeFileSync(tmpPath, raw, { encoding: "utf-8", flag: "wx" });
		renameModule.renameWithRetry(tmpPath, bakPath);
	} catch (err) {
		try {
			unlinkSync(tmpPath);
		} catch {
			// best effort when the temp file was never created or is already gone
		}
		throw err;
	}
	rotateBackups(dir, stem, sourceId);
	return bakPath;
}

function sourceIdentity(originalPath: string): string {
	let sourcePath = normalize(resolve(originalPath));
	if (process.platform === "win32") sourcePath = sourcePath.toLowerCase();
	return createHash("sha256").update(sourcePath).digest("hex");
}

function completedBackupPattern(stem: string, sourceId: string): RegExp {
	const escaped = stem.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	return new RegExp(
		`^${escaped}\\.${sourceId}\\.(\\d+)\\.([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\\.bak\\.json$`,
	);
}

function nextBackupOrder(dir: string, stem: string, sourceId: string): bigint {
	const pattern = completedBackupPattern(stem, sourceId);
	let newest = 0n;
	for (const name of readdirSync(dir)) {
		const match = pattern.exec(name);
		if (match) {
			const order = BigInt(match[1]);
			if (order > newest) newest = order;
		}
	}
	const now = BigInt(Date.now());
	return now > newest ? now : newest + 1n;
}

/** Delete all but the newest KEEP_NEWEST completed backups for this source. */
function rotateBackups(dir: string, stem: string, sourceId: string): void {
	const pattern = completedBackupPattern(stem, sourceId);
	const backups: Array<{ name: string; order: bigint }> = [];
	for (const name of readdirSync(dir)) {
		const match = pattern.exec(name);
		if (match) backups.push({ name, order: BigInt(match[1]) });
	}
	backups.sort((a, b) => {
		if (a.order !== b.order) return a.order > b.order ? -1 : 1;
		return b.name.localeCompare(a.name);
	});
	for (const old of backups.slice(KEEP_NEWEST)) {
		try {
			unlinkSync(join(dir, old.name));
		} catch {
			// best effort — a locked file just survives until the next rotation
		}
	}
}
