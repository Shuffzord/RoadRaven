// Phase 6 Plan 06-02 — wsClient.request transport contract.
// 3 tests, anti-sprawl: each test pins ONE protocol behavior. Adding a fourth
// case (e.g., "out-of-order responses") would test framework guarantees, not our code.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/sentinel", () => ({
	readSentinel: vi.fn().mockResolvedValue({
		ok: true,
		port: 47921,
		url: "ws://127.0.0.1:47921",
		startedAt: "2026-05-05T10:00:00.000Z",
		pid: process.pid,
	}),
}));

class MockWebSocket {
	static instances: MockWebSocket[] = [];
	url: string;
	readyState = 0;
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
		for (const h of this.listeners[event] ?? []) h(...args);
	}
}
vi.stubGlobal("WebSocket", MockWebSocket);

import { createWsClient } from "../src/wsClient";

describe("WsClient.request transport (Phase 6 D-15)", () => {
	beforeEach(() => {
		MockWebSocket.instances = [];
		vi.clearAllMocks();
	});
	afterEach(async () => {
		vi.useRealTimers();
		MockWebSocket.instances = [];
	});

	it("resolves when a matching {type:'response', id, result} message arrives", async () => {
		const client = createWsClient({ source: "claude-code", version: "0.1.0" });
		await vi.waitFor(() => MockWebSocket.instances.length > 0);
		const ws = MockWebSocket.instances[0];
		ws.emit("open");

		const promise = client.request<{ ok: boolean }>("getRoadmap", {});

		// Extract the id of the request the client just sent
		const lastSent = ws.send.mock.calls.at(-1)?.[0] as string;
		const sent = JSON.parse(lastSent) as {
			type: string;
			id: string;
			method: string;
		};
		expect(sent.type).toBe("request");
		expect(sent.method).toBe("getRoadmap");
		expect(typeof sent.id).toBe("string");

		// Simulate Bun reply
		ws.emit("message", {
			data: JSON.stringify({
				type: "response",
				id: sent.id,
				result: { ok: true },
			}),
		});

		await expect(promise).resolves.toEqual({ ok: true });
		await client.close();
	});

	it("rejects with a timeout error after 30s of no response", async () => {
		vi.useFakeTimers();
		const client = createWsClient({ source: "claude-code", version: "0.1.0" });
		// Allow connectLoop microtasks to schedule the WebSocket
		await vi.advanceTimersByTimeAsync(0);
		await vi.waitFor(() => MockWebSocket.instances.length > 0);
		const ws = MockWebSocket.instances[0];
		ws.emit("open");

		const promise = client.request("getRoadmap", {});
		// Attach a no-op rejection handler synchronously so Node does not flag
		// the rejection as "handled asynchronously" (PromiseRejectionHandledWarning)
		// when the test awaits expect(...).rejects.toThrow after the timer fires.
		const assertion = expect(promise).rejects.toThrow(/timed out/i);

		await vi.advanceTimersByTimeAsync(30_001);
		await assertion;

		vi.useRealTimers();
		await client.close();
	});

	it("rejects all pending requests with 'WebSocket disconnected during request' on close", async () => {
		const client = createWsClient({ source: "claude-code", version: "0.1.0" });
		await vi.waitFor(() => MockWebSocket.instances.length > 0);
		const ws = MockWebSocket.instances[0];
		ws.emit("open");

		const p1 = client.request("getRoadmap", {});
		const p2 = client.request("getNode", { nodeId: "x" });

		// Simulate WS close — wsClient must reject both pending entries
		ws.emit("close");

		await expect(p1).rejects.toThrow(/disconnected during request/i);
		await expect(p2).rejects.toThrow(/disconnected during request/i);
		await client.close();
	});
});
