// roadraven-notify — one-shot status push for Claude Code hooks (v0.7 Phase 5).
// Hooks must never hang: hard ~2s budget, silent on success, single-line stderr
// on failure. Exit codes: 0 delivered, 1 app not reachable, 2 malformed args.
import { readSentinel } from "./sentinel";

export const DEFAULT_SOURCE = "claude-code-hook";
export const TOTAL_TIMEOUT_MS = 2000;
const DEFAULT_PORT = 47921; // mirrors eventServer DEFAULT_PORT (D-01)
const PORT_FALLBACK_RANGE = 10; // scan +0..+9, mirrors eventServer
const PROBE_TIMEOUT_MS = 500;
const MIN_SEND_BUDGET_MS = 250;

export const USAGE =
	"Usage: roadraven-notify <nodeId> <status> [--meta k=v ...] [--source name]";

export interface NotifyArgs {
	nodeId: string;
	status: string;
	source: string;
	meta?: Record<string, string>;
}

export type ParseResult =
	| { ok: true; args: NotifyArgs }
	| { ok: false; error: string };

interface ParseAcc {
	positional: string[];
	source: string;
	meta?: Record<string, string>;
}

/** Apply one `--meta k=v` pair to the accumulator. Returns an error or null. */
function applyMeta(acc: ParseAcc, kv: string | undefined): string | null {
	const eq = kv ? kv.indexOf("=") : -1;
	if (!kv || eq < 1) return "--meta requires a k=v argument";
	acc.meta = acc.meta ?? {};
	acc.meta[kv.slice(0, eq)] = kv.slice(eq + 1);
	return null;
}

/** Apply one flag + its value to the accumulator. Returns an error or null. */
function applyFlag(
	acc: ParseAcc,
	flag: string,
	value: string | undefined,
): string | null {
	if (flag === "--meta") return applyMeta(acc, value);
	if (flag === "--source") {
		if (!value) return "--source requires a name";
		acc.source = value;
		return null;
	}
	return `Unknown flag: ${flag}`;
}

export function parseNotifyArgs(argv: string[]): ParseResult {
	const acc: ParseAcc = { positional: [], source: DEFAULT_SOURCE };
	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		if (arg.startsWith("--")) {
			const error = applyFlag(acc, arg, argv[++i]);
			if (error) return { ok: false, error };
		} else {
			acc.positional.push(arg);
		}
	}
	if (acc.positional.length !== 2) {
		return { ok: false, error: "Expected exactly <nodeId> <status>" };
	}
	return {
		ok: true,
		args: {
			nodeId: acc.positional[0],
			status: acc.positional[1],
			source: acc.source,
			meta: acc.meta,
		},
	};
}

/** Hello frame first, then the event frame — same shapes wsClient.ts sends. */
export function buildFrames(args: NotifyArgs): {
	hello: string;
	event: string;
} {
	const hello = JSON.stringify({ type: "hello", source: args.source });
	const event = JSON.stringify({
		nodeId: args.nodeId,
		status: args.status,
		source: args.source,
		...(args.meta ? { meta: args.meta } : {}),
	});
	return { hello, event };
}

/** GET / on a candidate port; the Event API answers {service:"roadraven-event-api"}. */
async function probePort(port: number): Promise<string | null> {
	try {
		const res = await fetch(`http://127.0.0.1:${port}/`, {
			signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
		});
		const body = (await res.json()) as { service?: string };
		if (body.service === "roadraven-event-api") {
			return `ws://127.0.0.1:${port}`;
		}
	} catch {
		// port closed or not the Event API — not a candidate
	}
	return null;
}

/**
 * Sentinel first (single attempt — no retry backoff inside the 2s hook budget);
 * if missing/stale, probe ports 47921..47930 in parallel and take the lowest hit.
 */
export async function resolveEventApiUrl(): Promise<string | null> {
	const sentinel = await readSentinel({ maxAttempts: 1 });
	if (sentinel.ok) return sentinel.url;
	const probes = await Promise.all(
		Array.from({ length: PORT_FALLBACK_RANGE }, (_, i) =>
			probePort(DEFAULT_PORT + i),
		),
	);
	return probes.find((url) => url !== null) ?? null;
}

/** Open WS, send hello then event, close 1000. Resolves once the socket closes. */
export function sendFrames(
	url: string,
	frames: { hello: string; event: string },
	timeoutMs: number,
): Promise<void> {
	return new Promise((resolve, reject) => {
		const ws = new WebSocket(url);
		const timer = setTimeout(() => {
			try {
				ws.close();
			} catch {
				// already closed
			}
			reject(new Error("timed out"));
		}, timeoutMs);
		ws.addEventListener("open", () => {
			ws.send(frames.hello);
			ws.send(frames.event);
			ws.close(1000, "done");
		});
		ws.addEventListener("close", () => {
			clearTimeout(timer);
			resolve();
		});
		ws.addEventListener("error", () => {
			clearTimeout(timer);
			reject(new Error("connection failed"));
		});
	});
}

export async function runNotify(argv: string[]): Promise<number> {
	const parsed = parseNotifyArgs(argv);
	if (!parsed.ok) {
		process.stderr.write(`roadraven-notify: ${parsed.error}\n${USAGE}\n`);
		return 2;
	}
	const deadline = Date.now() + TOTAL_TIMEOUT_MS;
	try {
		const url = await resolveEventApiUrl();
		if (url === null) throw new Error("not reachable");
		const remaining = Math.max(deadline - Date.now(), MIN_SEND_BUDGET_MS);
		await sendFrames(url, buildFrames(parsed.args), remaining);
		return 0;
	} catch {
		process.stderr.write(
			"roadraven-notify: RoadRaven is not reachable — status not delivered.\n",
		);
		return 1;
	}
}
