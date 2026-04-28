// Phase 4 Wave 1 — dedicated EADDRINUSE regression test (I-04 coverage).
// Uses a real bound port to exercise both sync-throw and async-surface paths.
// Sources: I-04 in 04-RESEARCH.md, D-01, D-02 in 04-CONTEXT.md.

import type { Server } from "bun";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
	PORT_FALLBACK_RANGE,
	startEventServer,
} from "../../../src/bun/eventServer";

// TEST_PORT is far from DEFAULT_PORT 47921's +0..+9 range to avoid real-app collisions.
const TEST_PORT = 47931;

describe("eventServer EADDRINUSE regression (I-04)", () => {
	let blockingServer: Server;
	let eventHandle: Awaited<ReturnType<typeof startEventServer>> | null = null;

	beforeAll(() => {
		// Occupy TEST_PORT via a plain Bun.serve — this forces startEventServer to
		// see EADDRINUSE. Works for both sync-throw (current Bun behavior) and
		// async-surface modes (covered by the implementation's belt-and-braces
		// try/catch + error handler).
		blockingServer = Bun.serve({
			port: TEST_PORT,
			fetch: () => new Response("blocker"),
		});
	});

	afterAll(async () => {
		blockingServer.stop(true);
		if (eventHandle?.ok) await eventHandle.handle.stop();
	});

	it("falls back to port X+1 when port X is bound by a fixture (isUserSpecified=false)", async () => {
		eventHandle = await startEventServer({
			requestedPort: TEST_PORT,
			isUserSpecified: false,
			onFlush: () => {
				/* noop */
			},
			onEvent: () => {
				/* noop */
			},
			onError: () => {
				/* noop */
			},
			onConnectionChange: () => {
				/* noop */
			},
		});
		expect(eventHandle.ok).toBe(true);
		if (eventHandle.ok) {
			// Should have fallen back to TEST_PORT + 1
			expect(eventHandle.handle.port).toBe(TEST_PORT + 1);
		}
	});

	it("returns in_use error when user-specified port X is bound (no fallback — D-02)", async () => {
		const result = await startEventServer({
			requestedPort: TEST_PORT,
			isUserSpecified: true,
			onFlush: () => {
				/* noop */
			},
			onEvent: () => {
				/* noop */
			},
			onError: () => {
				/* noop */
			},
			onConnectionChange: () => {
				/* noop */
			},
		});
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error).toBe("in_use");
			expect(result.attempted).toEqual([TEST_PORT]);
		}
	});

	it("PORT_FALLBACK_RANGE covers +0..+9 (10 candidates)", () => {
		expect(PORT_FALLBACK_RANGE).toBe(10);
	});
});
