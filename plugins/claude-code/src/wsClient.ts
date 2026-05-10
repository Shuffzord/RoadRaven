import { readSentinel } from "./sentinel";

export const RECONNECT_DELAYS_MS = [500, 1000, 2000, 4000, 8000, 16000, 30000];
const RECONNECT_CAP_MS = 30000;
const JITTER_MAX_MS = 200;

export interface WsClientOptions {
	source: string;
	version: string;
}

export interface OutgoingEvent {
	nodeId: string;
	status: string;
	meta?: Record<string, unknown>;
}

export interface WsClient {
	send(event: OutgoingEvent): Promise<void>;
	/**
	 * Phase 6 D-15: bidirectional request/response. Correlates by id, rejects
	 * after 30s with "timed out", rejects on socket close with
	 * "WebSocket disconnected during request".
	 */
	request<T = unknown>(
		method: string,
		params: Record<string, unknown>,
	): Promise<T>;
	isConnected(): boolean;
	close(): Promise<void>;
}

interface PendingRequest {
	resolve: (value: unknown) => void;
	reject: (reason: unknown) => void;
	timer: ReturnType<typeof setTimeout>;
}

export function createWsClient(opts: WsClientOptions): WsClient {
	let ws: WebSocket | null = null;
	let connected = false;
	let stopped = false;
	let attempt = 0;
	// Phase 6 D-15: in-flight request map. Closure-scoped per client instance —
	// different createWsClient() callers do not share pending state.
	const pending = new Map<string, PendingRequest>();

	function getDelay(): number {
		const idx = Math.min(attempt, RECONNECT_DELAYS_MS.length - 1);
		const base = RECONNECT_DELAYS_MS[idx];
		const jitter = Math.random() * JITTER_MAX_MS;
		return base + jitter;
	}

	async function connectOnce(): Promise<boolean> {
		const sentinel = await readSentinel();
		if (!sentinel.ok) return false;

		return new Promise<boolean>((resolve) => {
			const socket = new WebSocket(sentinel.url);

			socket.addEventListener("open", () => {
				ws = socket;
				connected = true;
				attempt = 0;
				// hello frame: type="hello", source, version (D-27 RESEARCH §1.5)
				socket.send(
					`{"type":"hello","source":${JSON.stringify(opts.source)},"version":${JSON.stringify(opts.version)}}`,
				);
				resolve(true);
			});

			socket.addEventListener("error", () => {
				resolve(false);
			});

			// Phase 6 D-15: persistent message listener — correlates response
			// frames by id, decorates Error with code/hint/data from msg.error,
			// silently ignores everything else (this client doesn't subscribe
			// to inbound events).
			socket.addEventListener("message", (evt) => {
				try {
					const msg = JSON.parse(
						(evt as MessageEvent).data as string,
					) as Record<string, unknown>;
					if (
						msg.type === "response" &&
						typeof msg.id === "string" &&
						pending.has(msg.id)
					) {
						const entry = pending.get(msg.id);
						if (!entry) return;
						clearTimeout(entry.timer);
						pending.delete(msg.id);
						if (msg.error) {
							const errPayload = msg.error as {
								code?: string;
								message?: string;
								hint?: string;
								data?: unknown;
							};
							const err = Object.assign(
								new Error(errPayload.message ?? "Unknown error"),
								{
									code: errPayload.code,
									hint: errPayload.hint,
									data: errPayload.data,
								},
							);
							entry.reject(err);
						} else {
							entry.resolve(msg.result);
						}
					}
					// non-response messages: silently ignore
				} catch {
					// non-JSON or malformed message — ignore
				}
			});

			socket.addEventListener("close", () => {
				connected = false;
				ws = null;
				// Phase 6 D-15: reject all in-flight requests on disconnect.
				// Iterating BEFORE scheduleReconnect so a race with the next
				// connectOnce never sees a pre-disconnect entry.
				for (const [, entry] of pending) {
					clearTimeout(entry.timer);
					entry.reject(new Error("WebSocket disconnected during request"));
				}
				pending.clear();
				if (!stopped) {
					scheduleReconnect();
				}
			});
		});
	}

	function scheduleReconnect(): void {
		if (stopped) return;
		const delay = getDelay();
		attempt++;
		setTimeout(() => {
			void connectLoop();
		}, delay);
	}

	async function connectLoop(): Promise<void> {
		while (!stopped) {
			const ok = await connectOnce();
			if (ok) return;
			// connectOnce failed before connection (sentinel missing or error before open);
			// schedule retry and stop this loop iteration (scheduleReconnect re-enters)
			if (!stopped) {
				const delay = getDelay();
				attempt++;
				await new Promise((r) => setTimeout(r, delay));
			}
		}
	}

	// Kick initial connection in background
	void connectLoop();

	return {
		async send(event: OutgoingEvent): Promise<void> {
			if (!connected || ws === null) {
				throw new Error("Not connected to Roadmap Viewer Event API.");
			}
			ws.send(JSON.stringify({ ...event, source: opts.source }));
		},
		request<T = unknown>(
			method: string,
			params: Record<string, unknown>,
		): Promise<T> {
			return new Promise<T>((resolve, reject) => {
				if (!connected || ws === null) {
					reject(new Error("Not connected to Roadmap Viewer Event API."));
					return;
				}
				const id = crypto.randomUUID();
				const timer = setTimeout(() => {
					pending.delete(id);
					reject(new Error(`Agent request timed out: ${method}`));
				}, 30_000);
				pending.set(id, {
					resolve: resolve as (v: unknown) => void,
					reject,
					timer,
				});
				ws.send(JSON.stringify({ type: "request", id, method, params }));
			});
		},
		isConnected(): boolean {
			return connected;
		},
		async close(): Promise<void> {
			stopped = true;
			if (ws !== null) {
				try {
					ws.close(1000, "client closing");
				} catch {
					/* ignore */
				}
			}
		},
	};
}
