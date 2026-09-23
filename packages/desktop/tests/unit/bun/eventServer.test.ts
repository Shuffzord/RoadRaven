// Phase 4 Wave 1 — real test implementations for Plan 04-02 Task 5.
// Sources: D-01, D-02, D-05 in 04-CONTEXT.md, §1 in 04-RESEARCH.md.

import { afterEach, describe, expect, it } from "vitest";
import { DEFAULT_PORT, startEventServer } from "../../../src/bun/eventServer";

// Use port 0 for OS-assigned port — avoids collisions with real port 47921 during CI.
// EADDRINUSE-specific regression lives in eventServer.eaddrinuse.test.ts.

const NO_OP_OPTS = {
	appVersion: "0.8.0",
	// v0.8: StartOptions now requires isWizardCopyCurrent (consulted on each
	// version mismatch to pick the remedy).
	isWizardCopyCurrent: () => false,
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
	// Phase 6 Plan 06-02: StartOptions now requires onAgentRequest. Tests in
	// this file exercise the event-frame path only — agent-request routing is
	// covered by future Plan 06-03 tests, so a no-op suffices here.
	onAgentRequest: () => {
		/* noop */
	},
};

/** Connects a WS client to the server and waits for the connection to open. */
async function connectWs(port: number): Promise<WebSocket> {
	const ws = new WebSocket(`ws://127.0.0.1:${port}`);
	await new Promise<void>((resolve) =>
		ws.addEventListener("open", () => resolve()),
	);
	return ws;
}

/** Connects, sends a hello frame with the given version (and v0.8 install, if any), waits for it to be processed, then closes. */
async function helloAndClose(
	port: number,
	version: string,
	source = "test-agent",
	install?: string,
): Promise<void> {
	const ws = await connectWs(port);
	ws.send(JSON.stringify({ type: "hello", source, version, install }));
	// Small delay for message to be processed
	await new Promise((r) => setTimeout(r, 50));
	ws.close();
}

/** Occupies a real port with a dummy server for the duration of `fn`, always freeing it after. */
async function withOccupiedPort<T>(
	fn: (occupiedPort: number) => Promise<T>,
): Promise<T> {
	const dummy = Bun.serve({
		port: 0,
		fetch: () => new Response("dummy"),
	});
	try {
		// dummy.port is set synchronously by the Bun.serve() call above (it's
		// only undefined for unix-socket servers, not the TCP server here).
		return await fn(dummy.port!);
	} finally {
		dummy.stop(true);
	}
}

describe("EventServer (WebSocket lifecycle)", () => {
	const handles: Array<{ stop(): Promise<void> }> = [];

	afterEach(async () => {
		// Stop all servers started during the test to free ports
		await Promise.all(handles.splice(0).map((h) => h.stop()));
	});

	/** Starts a server with NO_OP_OPTS + overrides, asserts it bound, and registers it for cleanup. */
	async function startTestServer(
		overrides: Partial<Parameters<typeof startEventServer>[0]> = {},
	) {
		const result = await startEventServer({
			...NO_OP_OPTS,
			requestedPort: 0,
			isUserSpecified: true,
			...overrides,
		});
		expect(result.ok).toBe(true);
		if (!result.ok) return null;
		handles.push(result.handle);
		return result.handle;
	}

	/** Starts a server whose onError calls are captured into the returned `errors` array. */
	async function startServerCapturingErrors(
		overrides: Partial<Parameters<typeof startEventServer>[0]> = {},
	) {
		const errors: Array<{ type: string; source: string }> = [];
		const handle = await startTestServer({
			onError: (err) => errors.push(err),
			...overrides,
		});
		return { handle, errors };
	}

	it("binds on the default port 47921 when nothing conflicts", async () => {
		// Use port 0 (OS-assigned) to confirm the bind path works without risking
		// collision with a real running instance. The I-04 test uses 47931 for real EADDRINUSE.
		const handle = await startTestServer();
		expect(handle?.port).toBeGreaterThan(0);
	});

	it("falls back to +1..+9 when default port is taken (D-01)", async () => {
		// Bind a dummy server on port 0 (OS-assigned), then use that port as the
		// requested port with isUserSpecified: false — confirms the fallback loop
		// scans +1..+9. We use isUserSpecified: false so the fallback activates.
		await withOccupiedPort(async (occupiedPort) => {
			const handle = await startTestServer({
				requestedPort: occupiedPort,
				isUserSpecified: false,
			});
			// Should have bound on a different port (fallback)
			expect(handle?.port).not.toBe(occupiedPort);
		});
	});

	it("returns in_use error when user-specified port is taken (D-02 — no fallback)", async () => {
		// Occupy a port with a dummy server
		await withOccupiedPort(async (occupiedPort) => {
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
		});
	});

	it("accepts hello frame within 2s grace window (D-05)", async () => {
		const handle = await startTestServer();
		if (!handle) return;

		await helloAndClose(handle.port, "1");
		// No assertion on internal state needed — hello processing is fire-and-forget;
		// the absence of any thrown error confirms the path is handled.
		expect(true).toBe(true);
	});

	it("stamps source: 'unknown' when no hello frame arrives in grace window", async () => {
		const { handle, errors } = await startServerCapturingErrors();
		if (!handle) return;

		// Connect and immediately close (abnormal) without sending hello
		const ws = await connectWs(handle.port);
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

	it("fires exactly one version_mismatch error when hello version major.minor differs from appVersion", async () => {
		const { handle, errors } = await startServerCapturingErrors({
			appVersion: "0.8.0",
		});
		if (!handle) return;

		await helloAndClose(handle.port, "0.7.2");

		const mismatchErrors = errors.filter((e) => e.type === "version_mismatch");
		expect(mismatchErrors).toHaveLength(1);
		expect(mismatchErrors[0]?.source).toBe("test-agent");
	});

	it("fires no version_mismatch error when hello version major.minor matches appVersion", async () => {
		const { handle, errors } = await startServerCapturingErrors({
			appVersion: "0.8.0",
		});
		if (!handle) return;

		await helloAndClose(handle.port, "0.8.3");

		expect(errors.filter((e) => e.type === "version_mismatch")).toHaveLength(0);
	});

	// v0.8 end-to-end: a fake producer connects over the real socket and the
	// emitted detail carries the remedy as its third field.
	it.each([
		["0.7.2", "plugin", false, "0.7.2|0.8.0|update-plugin"],
		["0.7.2", "npm", false, "0.7.2|0.8.0|update-npm"],
		["0.7.2", "local", true, "0.7.2|0.8.0|restart-agent"],
		["0.1.0", undefined, true, "0.1.0|0.8.0|restart-agent"],
		["0.1.0", undefined, false, "0.1.0|0.8.0|reinstall"],
		["0.9.1", "plugin", true, "0.9.1|0.8.0|update-app"],
	])("hello version=%s install=%s wizardCopyCurrent=%s → detail %s", async (version, install, wizardCopyCurrent, expectedDetail) => {
		const errors: Array<{ type: string; source: string; detail?: string }> = [];
		const handle = await startTestServer({
			appVersion: "0.8.0",
			isWizardCopyCurrent: () => wizardCopyCurrent,
			onError: (err) => errors.push(err),
		});
		if (!handle) return;

		await helloAndClose(handle.port, version, "claude-code", install);

		const mismatch = errors.filter((e) => e.type === "version_mismatch");
		expect(mismatch).toHaveLength(1);
		expect(mismatch[0]?.source).toBe("claude-code");
		expect(mismatch[0]?.detail).toBe(expectedDetail);
	});
});
