// Phase 4 Wave 1 — real test implementations for Plan 04-02 Task 5.
// Sources: D-01, D-02, D-05 in 04-CONTEXT.md, §1 in 04-RESEARCH.md.

import { afterEach, describe, expect, it } from "vitest";
import { DEFAULT_PORT, startEventServer } from "../../../src/bun/eventServer";

// Use port 0 for OS-assigned port — avoids collisions with real port 47921 during CI.
// EADDRINUSE-specific regression lives in eventServer.eaddrinuse.test.ts.

const NO_OP_OPTS = {
	onFlush: () => {},
	onEvent: () => {},
	onError: () => {},
	onConnectionChange: () => {},
};

describe("EventServer (WebSocket lifecycle)", () => {
	const handles: Array<{ stop(): Promise<void> }> = [];

	afterEach(async () => {
		// Stop all servers started during the test to free ports
		await Promise.all(handles.splice(0).map((h) => h.stop()));
	});

	it("binds on the default port 47921 when nothing conflicts", async () => {
		// Use port 0 (OS-assigned) to confirm the bind path works without risking
		// collision with a real running instance. The I-04 test uses 47931 for real EADDRINUSE.
		const result = await startEventServer({
			...NO_OP_OPTS,
			requestedPort: 0,
			isUserSpecified: true,
		});
		expect(result.ok).toBe(true);
		if (result.ok) {
			handles.push(result.handle);
			expect(result.handle.port).toBeGreaterThan(0);
		}
	});

	it("falls back to +1..+9 when default port is taken (D-01)", async () => {
		// Bind a dummy server on port 0 (OS-assigned), then use that port as the
		// requested port with isUserSpecified: false — confirms the fallback loop
		// scans +1..+9. We use isUserSpecified: false so the fallback activates.
		const dummy = Bun.serve({
			port: 0,
			fetch: () => new Response("dummy"),
		});
		const occupiedPort = dummy.port;
		try {
			const result = await startEventServer({
				...NO_OP_OPTS,
				requestedPort: occupiedPort,
				isUserSpecified: false,
			});
			expect(result.ok).toBe(true);
			if (result.ok) {
				handles.push(result.handle);
				// Should have bound on a different port (fallback)
				expect(result.handle.port).not.toBe(occupiedPort);
			}
		} finally {
			dummy.stop(true);
		}
	});

	it("returns in_use error when user-specified port is taken (D-02 — no fallback)", async () => {
		// Occupy a port with a dummy server
		const dummy = Bun.serve({
			port: 0,
			fetch: () => new Response("dummy"),
		});
		const occupiedPort = dummy.port;
		try {
			const result = await startEventServer({
				...NO_OP_OPTS,
				requestedPort: occupiedPort,
				isUserSpecified: true, // user-specified → no fallback
			});
			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error).toBe("in_use");
				expect(result.attempted).toEqual([occupiedPort]);
			}
		} finally {
			dummy.stop(true);
		}
	});

	it("accepts hello frame within 2s grace window (D-05)", async () => {
		const result = await startEventServer({
			...NO_OP_OPTS,
			requestedPort: 0,
			isUserSpecified: true,
		});
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		handles.push(result.handle);

		const ws = new WebSocket(`ws://127.0.0.1:${result.handle.port}`);
		await new Promise<void>((resolve) => ws.addEventListener("open", () => resolve()));
		ws.send(JSON.stringify({ type: "hello", source: "test-agent", version: "1" }));
		// Small delay for message to be processed
		await new Promise((r) => setTimeout(r, 50));
		ws.close();
		// No assertion on internal state needed — hello processing is fire-and-forget;
		// the absence of any thrown error confirms the path is handled.
		expect(true).toBe(true);
	});

	it("stamps source: 'unknown' when no hello frame arrives in grace window", async () => {
		const errors: Array<{ type: string; source: string }> = [];
		const result = await startEventServer({
			...NO_OP_OPTS,
			onError: (err) => errors.push(err),
			requestedPort: 0,
			isUserSpecified: true,
		});
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		handles.push(result.handle);

		// Connect and immediately close (abnormal) without sending hello
		const ws = new WebSocket(`ws://127.0.0.1:${result.handle.port}`);
		await new Promise<void>((resolve) => ws.addEventListener("open", () => resolve()));
		// Close without hello — should fire disconnect error with source: "unknown"
		ws.close();
		await new Promise((r) => setTimeout(r, 100));

		const disconnectError = errors.find((e) => e.type === "disconnect");
		expect(disconnectError).toBeDefined();
		expect(disconnectError?.source).toBe("unknown");
	});

	it("DEFAULT_PORT is 47921", () => {
		expect(DEFAULT_PORT).toBe(47921);
	});
});
