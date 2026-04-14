import { configure, getConsoleSink, getLogger } from "@logtape/logtape";

// RPC log forwarding: on failure, buffer up to 3 entries for one retry
// on next success. After 3 consecutive failures, entries are dropped
// to console.warn to avoid unbounded memory growth. (D-22)
const failedLogs: Array<{
	level: string;
	category: string[];
	message: string;
	data?: Record<string, unknown>;
}> = [];
let consecutiveFailures = 0;

export async function setupWebviewLogging(): Promise<void> {
	// Lazy-import rpc to avoid crashing when electrobun/view is unavailable
	// (e.g. during Vite HMR dev server outside Electrobun runtime)
	let rpcSend: ((payload: Record<string, unknown>) => Promise<void>) | null =
		null;
	try {
		const { electroview } = await import("../rpc");
		if (electroview) {
			rpcSend = (payload) =>
				electroview.rpc?.request.logMessage(payload as never) ??
				Promise.resolve();
		}
	} catch {
		// electrobun/view not available — RPC forwarding disabled, console-only
	}

	await configure({
		sinks: {
			console: getConsoleSink(),
			rpc: (record) => {
				if (!rpcSend) return;
				// Per D-22: Forward webview logs to Bun main process via typed RPC
				const payload = {
					level: record.level as
						| "debug"
						| "info"
						| "warning"
						| "error"
						| "fatal",
					category: [...record.category],
					message:
						typeof record.message === "string"
							? record.message
							: record.message.map((part) => String(part)).join(""),
					data: record.properties ? { ...record.properties } : undefined,
				};
				rpcSend(payload)
					.then(() => {
						consecutiveFailures = 0;
						// Flush any buffered logs
						while (failedLogs.length) {
							const queued = failedLogs.shift();
							if (!queued) break;
							rpcSend?.(queued).catch((retryErr) => {
								console.warn("[log-fwd-retry-fail]", retryErr);
							});
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
