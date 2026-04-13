import {
	configure,
	getConsoleSink,
	getLogger,
	getStreamSink,
} from "@logtape/logtape";
import { join } from "node:path";
import { existsSync, mkdirSync, createWriteStream } from "node:fs";

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

export async function setupBunLogging(): Promise<void> {
	const logDir = getLogDirectory();
	if (!existsSync(logDir)) {
		mkdirSync(logDir, { recursive: true });
	}

	const logFilePath = join(logDir, "roadraven.log");

	// LogTape 2.0.5 does not provide getFileSink or getRotatingFileSink.
	// Using getStreamSink with a Node.js WriteStream as fallback.
	// Manual rotation deferred to Phase 2 enhancement.
	const fileStream = createWriteStream(logFilePath, {
		flags: "a",
		encoding: "utf-8",
	});

	await configure({
		sinks: {
			console: getConsoleSink(),
			file: getStreamSink(fileStream),
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
export const themeLogger = getLogger(["bun", "theme"]);
export const settingsLogger = getLogger(["bun", "settings"]);
