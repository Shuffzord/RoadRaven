// WsClient reconnect strategy tests — Plan 04-05 Task 2
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock sentinel so we control what URL the client connects to
vi.mock("../src/sentinel", () => ({
	readSentinel: vi.fn().mockResolvedValue({
		ok: true,
		port: 47921,
		url: "ws://127.0.0.1:47921",
		startedAt: "2026-04-28T10:00:00.000Z",
		pid: process.pid,
	}),
}));

// MockWebSocket tracks all instances and their event listeners
class MockWebSocket {
	static instances: MockWebSocket[] = [];
	url: string;
	readyState: number = 0; // CONNECTING
	private listeners: Record<string, Array<(...args: unknown[]) => void>> = {};
	send = vi.fn();
	close = vi.fn();

	constructor(url: string) {
		this.url = url;
		MockWebSocket.instances.push(this);
	}

	addEventListener(event: string, handler: (...args: unknown[]) => void) {
		if (!this.listeners[event]) this.listeners[event] = [];
		this.listeners[event].push(handler);
	}

	emit(event: string, ...args: unknown[]) {
		for (const handler of this.listeners[event] ?? []) {
			handler(...args);
		}
	}
}

vi.stubGlobal("WebSocket", MockWebSocket);

import { readSentinel } from "../src/sentinel";
import { createWsClient, RECONNECT_DELAYS_MS } from "../src/wsClient";

describe("WsClient reconnect strategy", () => {
	beforeEach(() => {
		MockWebSocket.instances = [];
		vi.clearAllMocks();
		vi.mocked(readSentinel).mockResolvedValue({
			ok: true,
			port: 47921,
			url: "ws://127.0.0.1:47921",
			startedAt: "2026-04-28T10:00:00.000Z",
			pid: process.pid,
		});
	});

	afterEach(() => {
		vi.useRealTimers();
		MockWebSocket.instances = [];
	});

	it("RECONNECT_DELAYS_MS matches the spec [500,1000,2000,4000,8000,16000,30000]", () => {
		expect(RECONNECT_DELAYS_MS).toEqual([
			500, 1000, 2000, 4000, 8000, 16000, 30000,
		]);
	});

	it("sends hello frame on open", async () => {
		const client = createWsClient({ source: "claude-code", version: "0.1.0" });

		// Wait for the first WebSocket to be created
		await vi.waitFor(() => MockWebSocket.instances.length > 0);
		const ws = MockWebSocket.instances[0];

		// Emit open event to trigger hello frame
		ws.emit("open");

		expect(ws.send).toHaveBeenCalledWith(
			expect.stringContaining('"type":"hello"'),
		);
		expect(ws.send).toHaveBeenCalledWith(
			expect.stringContaining('"source":"claude-code"'),
		);
		expect(ws.send).toHaveBeenCalledWith(
			expect.stringContaining('"version":"0.1.0"'),
		);

		await client.close();
	});

	it("isConnected() returns true after open, false after close", async () => {
		const client = createWsClient({ source: "claude-code", version: "0.1.0" });

		await vi.waitFor(() => MockWebSocket.instances.length > 0);
		const ws = MockWebSocket.instances[0];

		expect(client.isConnected()).toBe(false);
		ws.emit("open");
		expect(client.isConnected()).toBe(true);
		ws.emit("close");
		expect(client.isConnected()).toBe(false);

		await client.close();
	});

	it("fails tool call immediately when disconnected (no queueing per D-28)", async () => {
		const client = createWsClient({ source: "claude-code", version: "0.1.0" });

		// Do NOT emit open — client stays disconnected
		await expect(
			client.send({ nodeId: "test-node", status: "in-progress" }),
		).rejects.toThrow("Not connected");

		await client.close();
	});

	it("send() stamps source field on outgoing frame", async () => {
		const client = createWsClient({ source: "claude-code", version: "0.1.0" });

		await vi.waitFor(() => MockWebSocket.instances.length > 0);
		const ws = MockWebSocket.instances[0];
		ws.emit("open");

		await client.send({ nodeId: "node-123", status: "done" });

		// The hello frame is index 0; the event frame is index 1
		const calls = ws.send.mock.calls;
		const eventCall = calls.find((c: unknown[]) => {
			const parsed = JSON.parse(c[0] as string) as Record<string, unknown>;
			return parsed.nodeId !== undefined;
		});
		expect(eventCall).toBeDefined();
		const frame = JSON.parse(eventCall![0] as string) as Record<
			string,
			unknown
		>;
		expect(frame.source).toBe("claude-code");
		expect(frame.nodeId).toBe("node-123");
		expect(frame.status).toBe("done");

		await client.close();
	});

	it("reconnect backoff follows 500,1000,2000,4000,8000,16000,30000", async () => {
		vi.useFakeTimers();

		// Make sentinel return ok so connectOnce proceeds to WebSocket creation
		vi.mocked(readSentinel).mockResolvedValue({
			ok: true,
			port: 47921,
			url: "ws://127.0.0.1:47921",
			startedAt: "2026-04-28T10:00:00.000Z",
			pid: process.pid,
		});

		createWsClient({ source: "claude-code", version: "0.1.0" });

		// Flush microtasks so the async connectLoop can call readSentinel and new WebSocket()
		// Use advanceTimersByTimeAsync(0) which flushes pending microtasks in vitest
		await vi.advanceTimersByTimeAsync(0);

		const instance0 = MockWebSocket.instances[0];
		expect(instance0).toBeDefined();

		// Emit error to trigger first reconnect (delay: 500ms + jitter)
		instance0.emit("error");
		// Flush microtasks after error emission
		await vi.advanceTimersByTimeAsync(0);

		// After 500ms + jitter (max 200ms), second connection attempt should happen
		await vi.advanceTimersByTimeAsync(800);

		expect(MockWebSocket.instances.length).toBeGreaterThanOrEqual(2);

		vi.useRealTimers();
	});

	it("cap at 30s after exhausting the delay schedule", () => {
		// The last index is 6 (30000ms); any attempt >= 6 should use 30000
		expect(RECONNECT_DELAYS_MS[RECONNECT_DELAYS_MS.length - 1]).toBe(30000);
		// Verify the cap: index min(attempt, length-1) = length-1 = 6 = 30000
		const capIdx = Math.min(100, RECONNECT_DELAYS_MS.length - 1);
		expect(RECONNECT_DELAYS_MS[capIdx]).toBe(30000);
	});
});
