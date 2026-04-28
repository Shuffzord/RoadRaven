import { readSentinel } from "./sentinel";

export const RECONNECT_DELAYS_MS = [500, 1000, 2000, 4000, 8000, 16000, 30000];
export const RECONNECT_CAP_MS = 30000;
export const JITTER_MAX_MS = 200;

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
	isConnected(): boolean;
	close(): Promise<void>;
}

export function createWsClient(opts: WsClientOptions): WsClient {
	let ws: WebSocket | null = null;
	let connected = false;
	let stopped = false;
	let attempt = 0;

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

			socket.addEventListener("close", () => {
				connected = false;
				ws = null;
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
