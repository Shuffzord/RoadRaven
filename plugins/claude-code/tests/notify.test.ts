// roadraven-notify CLI — v0.7 Phase 5. Covers arg parsing (exit-2 semantics via
// the parse function, not process.exit), frame construction, discovery fallback,
// and the send flow against the MockWebSocket pattern from wsClient.test.ts.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/sentinel", () => ({
	readSentinel: vi.fn().mockResolvedValue({
		ok: true,
		port: 47921,
		url: "ws://127.0.0.1:47921",
		startedAt: "2026-07-19T10:00:00.000Z",
		pid: process.pid,
	}),
}));

// Factory-style WS mock (intentionally not the class-based clone from
// wsClient.test.ts — fallow's clone detection gates the pre-commit diff).
type Handler = (...args: unknown[]) => void;
interface FakeWs {
	url: string;
	send: ReturnType<typeof vi.fn>;
	close: ReturnType<typeof vi.fn>;
	addEventListener(event: string, handler: Handler): void;
	emit(event: string, ...args: unknown[]): void;
}
const wsInstances: FakeWs[] = [];
function fakeWebSocket(url: string): FakeWs {
	const listeners: Record<string, Handler[]> = {};
	const ws: FakeWs = {
		url,
		send: vi.fn(),
		close: vi.fn(),
		addEventListener: (event, handler) => {
			if (!listeners[event]) listeners[event] = [];
			listeners[event].push(handler);
		},
		emit: (event, ...args) => {
			for (const h of listeners[event] ?? []) h(...args);
		},
	};
	wsInstances.push(ws);
	return ws;
}
vi.stubGlobal("WebSocket", fakeWebSocket);

import {
	buildFrames,
	DEFAULT_SOURCE,
	parseNotifyArgs,
	resolveEventApiUrl,
	sendFrames,
} from "../src/notifyCli";
import { readSentinel } from "../src/sentinel";

describe("parseNotifyArgs", () => {
	it("parses nodeId + status with default source", () => {
		const result = parseNotifyArgs(["node-1", "done"]);
		expect(result).toEqual({
			ok: true,
			args: {
				nodeId: "node-1",
				status: "done",
				source: DEFAULT_SOURCE,
				meta: undefined,
			},
		});
	});

	it("accumulates repeated --meta k=v pairs", () => {
		const result = parseNotifyArgs([
			"node-1",
			"done",
			"--meta",
			"branch=main",
			"--meta",
			"commit=abc123",
		]);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.args.meta).toEqual({ branch: "main", commit: "abc123" });
		}
	});

	it("splits meta on the first '=' only", () => {
		const result = parseNotifyArgs(["n", "s", "--meta", "msg=a=b"]);
		expect(result.ok && result.args.meta).toEqual({ msg: "a=b" });
	});

	it("--source overrides the default", () => {
		const result = parseNotifyArgs(["n", "s", "--source", "my-hook"]);
		expect(result.ok && result.args.source).toBe("my-hook");
	});

	it("rejects missing positionals, bad meta, and unknown flags (exit-2 semantics)", () => {
		expect(parseNotifyArgs(["only-one"]).ok).toBe(false);
		expect(parseNotifyArgs(["a", "b", "c"]).ok).toBe(false);
		expect(parseNotifyArgs(["n", "s", "--meta"]).ok).toBe(false);
		expect(parseNotifyArgs(["n", "s", "--meta", "novalue"]).ok).toBe(false);
		expect(parseNotifyArgs(["n", "s", "--source"]).ok).toBe(false);
		expect(parseNotifyArgs(["n", "s", "--bogus"]).ok).toBe(false);
	});
});

describe("buildFrames", () => {
	it("builds hello then event with source stamped, meta omitted when absent", () => {
		const { hello, event } = buildFrames({
			nodeId: "node-1",
			status: "done",
			source: DEFAULT_SOURCE,
		});
		expect(JSON.parse(hello)).toEqual({
			type: "hello",
			source: "claude-code-hook",
		});
		const parsed = JSON.parse(event) as Record<string, unknown>;
		expect(parsed).toEqual({
			nodeId: "node-1",
			status: "done",
			source: "claude-code-hook",
		});
		expect("type" in parsed).toBe(false);
	});

	it("includes meta and overridden source when provided", () => {
		const { hello, event } = buildFrames({
			nodeId: "n",
			status: "s",
			source: "custom",
			meta: { branch: "main" },
		});
		expect(JSON.parse(hello).source).toBe("custom");
		expect(JSON.parse(event)).toEqual({
			nodeId: "n",
			status: "s",
			source: "custom",
			meta: { branch: "main" },
		});
	});
});

describe("resolveEventApiUrl", () => {
	const realFetch = globalThis.fetch;

	afterEach(() => {
		globalThis.fetch = realFetch;
	});

	it("returns the sentinel URL when the sentinel resolves", async () => {
		vi.mocked(readSentinel).mockResolvedValueOnce({
			ok: true,
			port: 47925,
			url: "ws://127.0.0.1:47925",
			startedAt: "2026-07-19T10:00:00.000Z",
			pid: process.pid,
		});
		await expect(resolveEventApiUrl()).resolves.toBe("ws://127.0.0.1:47925");
	});

	it("falls back to port scanning when the sentinel is missing", async () => {
		vi.mocked(readSentinel).mockResolvedValueOnce({
			ok: false,
			error: "not running",
		});
		globalThis.fetch = vi.fn(async (url: unknown) => {
			if (String(url).includes(":47923/")) {
				return {
					json: async () => ({ service: "roadraven-event-api", ok: true }),
				} as Response;
			}
			throw new Error("ECONNREFUSED");
		}) as typeof fetch;
		await expect(resolveEventApiUrl()).resolves.toBe("ws://127.0.0.1:47923");
	});

	it("returns null when nothing answers", async () => {
		vi.mocked(readSentinel).mockResolvedValueOnce({
			ok: false,
			error: "not running",
		});
		globalThis.fetch = vi.fn(async () => {
			throw new Error("ECONNREFUSED");
		}) as typeof fetch;
		await expect(resolveEventApiUrl()).resolves.toBeNull();
	});
});

describe("sendFrames", () => {
	beforeEach(() => {
		wsInstances.length = 0;
	});

	it("sends hello first, then the event frame, then closes 1000", async () => {
		const frames = buildFrames({
			nodeId: "node-1",
			status: "done",
			source: DEFAULT_SOURCE,
		});
		const promise = sendFrames("ws://127.0.0.1:47921", frames, 2000);
		const ws = wsInstances[0];
		ws.emit("open");

		expect(ws.send).toHaveBeenNthCalledWith(1, frames.hello);
		expect(ws.send).toHaveBeenNthCalledWith(2, frames.event);
		expect(ws.close).toHaveBeenCalledWith(1000, "done");

		ws.emit("close");
		await expect(promise).resolves.toBeUndefined();
	});

	it("rejects when the server is unreachable (error event)", async () => {
		const frames = buildFrames({ nodeId: "n", status: "s", source: "x" });
		const promise = sendFrames("ws://127.0.0.1:47921", frames, 2000);
		wsInstances[0].emit("error");
		await expect(promise).rejects.toThrow("connection failed");
	});

	it("rejects within the timeout when the socket never opens", async () => {
		const frames = buildFrames({ nodeId: "n", status: "s", source: "x" });
		await expect(
			sendFrames("ws://127.0.0.1:47921", frames, 50),
		).rejects.toThrow("timed out");
	});
});
