import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import {
	configure,
	getConsoleSink,
	getLogger,
	getStreamSink,
} from "@logtape/logtape";
import type { FileSink } from "bun";
// Rename is isolated in its own module so unit tests can spy on the call site
// (ESM namespace from `node:fs` is not configurable for mocking).
import * as renameModule from "./renameSync";

export function getLogDirectory(): string {
	// Platform-specific log directory per D-23
	const platform = process.platform;
	const home = process.env.HOME || process.env.USERPROFILE || "";
	if (platform === "win32") {
		return join(
			process.env.LOCALAPPDATA || join(home, "AppData", "Local"),
			"RoadRaven",
			"logs",
		);
	}
	if (platform === "darwin") {
		return join(home, "Library", "Logs", "RoadRaven");
	}
	// Linux
	return join(
		process.env.XDG_DATA_HOME || join(home, ".local", "share"),
		"RoadRaven",
		"logs",
	);
}

/**
 * Rotate the previous session's log to `<path>.1` before a fresh writer
 * truncates it, so a relaunch (including an auto-update restart) does not
 * erase the log of the session that just ran (Phase 0 finding: the canary
 * launch overwrote the running session's log). One generation is enough:
 * an older `.1` is overwritten. Best-effort — a failure (e.g. a read-only
 * log directory) is swallowed so logging still starts.
 */
export function rotateLogFile(logFilePath: string): void {
	if (!existsSync(logFilePath)) return;
	try {
		renameModule.renameWithRetry(logFilePath, `${logFilePath}.1`);
	} catch {
		// Best-effort rotation; logging still proceeds without it.
	}
}

export async function setupBunLogging(): Promise<void> {
	const logDir = getLogDirectory();
	if (!existsSync(logDir)) {
		mkdirSync(logDir, { recursive: true });
	}

	const logFilePath = join(logDir, "roadraven.log");
	rotateLogFile(logFilePath);

	// getStreamSink requires a Web WritableStream (not Node.js stream).
	// For Bun: use Bun.file().writer() wrapped in a WritableStream.
	let writer: FileSink | undefined;
	const fileWritable = new WritableStream({
		start() {
			writer = Bun.file(logFilePath).writer();
		},
		write(chunk) {
			writer?.write(chunk);
		},
		close() {
			writer?.flush();
		},
		abort() {
			writer?.flush();
		},
	});

	await configure({
		sinks: {
			console: getConsoleSink(),
			file: getStreamSink(fileWritable),
		},
		loggers: [
			{
				category: ["bun"],
				lowestLevel: "debug", // D-25: debug in dev, info in prod
				sinks: ["console", "file"],
			},
			{
				category: ["webview"],
				lowestLevel: "debug",
				sinks: ["file"], // forwarded webview logs go to file only
			},
		],
	});
}

export const bunLogger = getLogger(["bun"]);
export const serverLogger = getLogger(["roadraven", "events", "server"]);
