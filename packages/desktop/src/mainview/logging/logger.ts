import { configure, getConsoleSink, getLogger } from "@logtape/logtape";
import { electroview } from "../rpc";

// Buffer + retry for RPC log forwarding failures (D-22)
const failedLogs: Array<{
	level: string;
	category: string[];
	message: string;
	data?: Record<string, unknown>;
}> = [];
let consecutiveFailures = 0;

export async function setupWebviewLogging(): Promise<void> {
	await configure({
		sinks: {
			console: getConsoleSink(),
			rpc: (record) => {
				// Per D-22: Forward webview logs to Bun main process via typed RPC
				const payload = {
					level: record.level as
						| "debug"
						| "info"
						| "warning"
						| "error"
						| "fatal",
					category: record.category,
					message:
						typeof record.message === "string"
							? record.message
							: record.message.map((part) => String(part)).join(""),
					data: record.properties
						? { ...record.properties }
						: undefined,
				};
				electroview.rpc.request
					.logMessage(payload)
					.then(() => {
						consecutiveFailures = 0;
						// Flush any buffered logs
						while (failedLogs.length) {
							const queued = failedLogs.shift()!;
							electroview.rpc.request
								.logMessage(queued)
								.catch(() => {});
						}
					})
					.catch(() => {
						consecutiveFailures++;
						if (consecutiveFailures <= 3) {
							failedLogs.push(payload);
						} else {
							console.warn("[log-fwd-fail]", payload);
						}
					});
			},
		},
		loggers: [
			{
				category: ["webview"],
				lowestLevel: "debug",
				sinks: ["console", "rpc"],
			},
		],
	});
}

// Hierarchical category loggers per D-24
export const themeLogger = getLogger(["webview", "theme"]);
export const storeLogger = getLogger(["webview", "store"]);
export const uiLogger = getLogger(["webview", "ui"]);
