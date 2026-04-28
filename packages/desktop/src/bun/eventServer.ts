import type { Server, ServerWebSocket } from "bun";
import type { IntegrationEvent } from "../../../../shared/types";
import {
	type CoalescedUpdate,
	EventCoalescer,
	FLUSH_MS_DEFAULT,
} from "./eventCoalescer";
import {
	type Allowlist,
	classifyEventFrame,
	type EventFrame,
	parseIncoming,
} from "./eventSchema";
import {
	appendEventLine,
	getSidecarPath,
	synthesizeMalformedLine,
} from "./eventsLog";
import { serverLogger } from "./logging";

export { getSidecarPath };

export const DEFAULT_PORT = 47921; // D-01
export const PORT_FALLBACK_RANGE = 10; // scan +0..+9 per D-01

type WsData = {
	source?: string;
	version?: string;
	helloAt: number | null;
	connectedAt: number;
	id: string;
};

export interface EventServerHandle {
	port: number;
	server: Server<WsData>;
	stop(): Promise<void>;
	setAllowlist(nodeIds: string[], statusIds: string[]): void;
	setSidecarPath(path: string | null): void; // null = no file open (I-10 / D-12)
}

export interface StartOptions {
	requestedPort: number;
	isUserSpecified: boolean; // user override (env/settings) vs default 47921
	onFlush: (updates: CoalescedUpdate[]) => void;
	onEvent: (event: IntegrationEvent) => void; // for pushEventLog streaming to renderer
	onError: (err: {
		type: "malformed" | "unknown_node" | "invalid_status" | "disconnect";
		source: string;
		detail?: string;
	}) => void;
	onConnectionChange: (connectedCount: number) => void;
}

function isEaddrinuse(err: unknown): boolean {
	return (
		!!err &&
		typeof err === "object" &&
		(err as NodeJS.ErrnoException).code === "EADDRINUSE"
	);
}

export async function startEventServer(
	opts: StartOptions,
): Promise<
	| { ok: true; handle: EventServerHandle }
	| { ok: false; error: "in_use"; attempted: number[] }
> {
	const allowlist: Allowlist = { nodeIds: new Set(), statusIds: new Set() };
	let sidecarPath: string | null = null;
	const connections = new Set<ServerWebSocket<WsData>>();
	const coalescer = new EventCoalescer(FLUSH_MS_DEFAULT, opts.onFlush);

	const candidates = opts.isUserSpecified
		? [opts.requestedPort]
		: Array.from(
				{ length: PORT_FALLBACK_RANGE },
				(_, i) => opts.requestedPort + i,
			);

	let server: Server<WsData> | null = null;
	let boundPort = -1;
	const attempted: number[] = [];

	for (const port of candidates) {
		attempted.push(port);
		try {
			// I-04 belt-and-braces #1: SYNCHRONOUS try/catch around Bun.serve (RESEARCH Pitfall 1)
			server = Bun.serve<WsData>({
				hostname: "127.0.0.1", // D-03 localhost boundary
				port,
				// I-04 belt-and-braces #2: async error handler for Bun versions that
				// surface EADDRINUSE asynchronously rather than via sync throw.
				error(err: Error) {
					if (isEaddrinuse(err)) {
						serverLogger.warn`Bun.serve async EADDRINUSE on :${port}: ${err.message}`;
					} else {
						serverLogger.error`Bun.serve error on :${port}: ${err.message}`;
					}
					return new Response("internal error", { status: 500 });
				},
				fetch(req, srv) {
					const url = new URL(req.url);
					if (
						url.pathname === "/" &&
						req.method === "GET" &&
						req.headers.get("upgrade") !== "websocket"
					) {
						return Response.json({ service: "roadraven-event-api", ok: true });
					}
					const ok = srv.upgrade(req, {
						data: {
							helloAt: null,
							connectedAt: Date.now(),
							id: crypto.randomUUID(),
						} satisfies WsData,
					});
					if (ok) return;
					return new Response("Upgrade required", { status: 426 });
				},
				websocket: {
					open(ws) {
						connections.add(ws);
						opts.onConnectionChange(connections.size);
						serverLogger.info`WS connection opened id=${ws.data.id}`;
					},
					async message(ws, raw) {
						const text =
							typeof raw === "string"
								? raw
								: new TextDecoder().decode(raw as unknown as ArrayBuffer);
						const parseResult = parseIncoming(text);

						if (!parseResult.ok) {
							// Malformed — synthesize log line, fire error, do NOT close connection
							const source = ws.data.source ?? "unknown";
							const line = synthesizeMalformedLine(text, source);
							if (sidecarPath) {
								await appendEventLine(sidecarPath, line);
							}
							opts.onEvent({
								nodeId: line.nodeId,
								status: line.status,
								source,
								timestamp: line.t,
								_error: "malformed",
								meta: line.meta,
							});
							opts.onError({
								type: "malformed",
								source,
								detail: text.slice(0, 120),
							});
							return;
						}

						const frame = parseResult.frame;

						if ("type" in frame && frame.type === "hello") {
							ws.data.source = frame.source;
							ws.data.version = frame.version;
							ws.data.helloAt = Date.now();
							serverLogger.info`Hello frame from source=${frame.source} version=${frame.version ?? "unset"}`;
							return;
						}

						// Event frame: source from frame field, ws.data (hello), or "unknown"
						const eventFrame = frame as EventFrame;
						const source = eventFrame.source ?? ws.data.source ?? "unknown";
						const t = new Date().toISOString();
						const classification = classifyEventFrame(eventFrame, allowlist);

						const logLine = {
							t,
							nodeId: eventFrame.nodeId,
							status: eventFrame.status,
							source,
							meta: eventFrame.meta,
							_error: classification.ok ? undefined : classification.error,
						};

						// RESEARCH §3.3: append to log BEFORE coalescer.enqueue
						if (sidecarPath) {
							await appendEventLine(sidecarPath, logLine);
						}

						// Push event to drawer hydrate stream regardless of _error
						opts.onEvent({
							nodeId: eventFrame.nodeId,
							status: eventFrame.status,
							source,
							meta: eventFrame.meta,
							timestamp: t,
							_error: classification.ok ? undefined : classification.error,
						});

						if (!classification.ok) {
							opts.onError({
								type: classification.error,
								source,
								detail: eventFrame.nodeId,
							});
							return;
						}

						// Happy path: enqueue into coalescer
						coalescer.enqueue({
							nodeId: eventFrame.nodeId,
							status: eventFrame.status,
							meta: eventFrame.meta,
							source,
							lastEventAt: new Date(t).getTime(),
						});
					},
					close(ws) {
						const source = ws.data.source ?? "unknown";
						connections.delete(ws);
						opts.onConnectionChange(connections.size);
						opts.onError({ type: "disconnect", source });
						serverLogger.info`WS connection closed source=${source}`;
					},
					drain() {
						/* backpressure — noop v1 */
					},
				},
			});
			boundPort = server.port ?? port; // Use server.port (actual OS-assigned when port=0); fallback to requested port
			serverLogger.info`Event server bound on :${boundPort}`;
			break;
		} catch (err) {
			if (isEaddrinuse(err)) {
				serverLogger.info`Port ${port} in use, trying next`;
				continue;
			}
			throw err;
		}
	}

	if (server === null) {
		return { ok: false, error: "in_use", attempted };
	}

	// Capture server in a const for use in the handle closure (TypeScript narrowing)
	const boundServer = server;

	const handle: EventServerHandle = {
		port: boundPort,
		server: boundServer,
		async stop() {
			// Broadcast 1001 Going Away per RESEARCH §1.2
			for (const ws of connections) {
				try {
					ws.close(1001, "Going Away");
				} catch {
					// ignore individual close errors
				}
			}
			coalescer.flushNow(); // RESEARCH Pitfall 4 — drain before stop
			// Graceful with 500ms timeout then force
			const gracefulStop = boundServer.stop();
			const timeout = new Promise<void>((resolve) => setTimeout(resolve, 500));
			await Promise.race([gracefulStop, timeout]);
			await boundServer.stop(true);
			serverLogger.info`Event server stopped`;
		},
		setAllowlist(nodeIds, statusIds) {
			allowlist.nodeIds = new Set(nodeIds);
			allowlist.statusIds = new Set(statusIds);
		},
		setSidecarPath(path) {
			sidecarPath = path;
		},
	};

	return { ok: true, handle };
}
