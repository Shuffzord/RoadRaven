// Phase 4 Wave 1 — real integration tests for Plan 04-02 Task 5.
// Sources: PLUG-01, PLUG-03, PLUG-06 in 04-CONTEXT.md, §7.2 in 04-RESEARCH.md.

import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { CoalescedUpdate } from "../../src/bun/eventCoalescer";
import { startEventServer } from "../../src/bun/eventServer";

const NO_OP = {
	onFlush: () => {},
	onEvent: () => {},
	onError: () => {},
	onConnectionChange: () => {},
};

describe("Event API integration", () => {
	const handles: Array<{ stop(): Promise<void> }> = [];

	afterEach(async () => {
		await Promise.all(handles.splice(0).map((h) => h.stop()));
	});

	it("routes events within 100ms", async () => {
		const flushes: CoalescedUpdate[][] = [];
		const result = await startEventServer({
			...NO_OP,
			requestedPort: 0,
			isUserSpecified: true,
			onFlush: (updates) => flushes.push(updates),
		});
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		handles.push(result.handle);

		// Set up allowlist so events pass classification
		result.handle.setAllowlist(["node-a", "node-b"], ["done", "in-progress"]);

		const ws = new WebSocket(`ws://127.0.0.1:${result.handle.port}`);
		await new Promise<void>((r) => ws.addEventListener("open", () => r()));

		ws.send(JSON.stringify({ type: "hello", source: "integration-test" }));
		// Send 2 events for the SAME nodeId — coalescer should LWW them into 1 update
		ws.send(JSON.stringify({ nodeId: "node-a", status: "in-progress" }));
		ws.send(JSON.stringify({ nodeId: "node-a", status: "done" }));

		// Wait up to 150ms (100ms debounce + 50ms integration slack)
		await new Promise((r) => setTimeout(r, 150));
		ws.close();

		// Should have received at least 1 flush
		expect(flushes.length).toBeGreaterThanOrEqual(1);
		// The last-write-wins: node-a should be "done"
		const allUpdates = flushes.flat();
		const nodeAUpdate = allUpdates.find((u) => u.nodeId === "node-a");
		expect(nodeAUpdate).toBeDefined();
		expect(nodeAUpdate?.status).toBe("done");
	}, 5000);

	it("producer disconnect emits one info toast per source", async () => {
		const errors: Array<{ type: string; source: string }> = [];
		const result = await startEventServer({
			...NO_OP,
			requestedPort: 0,
			isUserSpecified: true,
			onError: (err) => errors.push(err),
		});
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		handles.push(result.handle);

		const ws = new WebSocket(`ws://127.0.0.1:${result.handle.port}`);
		await new Promise<void>((r) => ws.addEventListener("open", () => r()));
		ws.send(JSON.stringify({ type: "hello", source: "producer-1" }));
		await new Promise((r) => setTimeout(r, 30));
		// Abnormal close (no close frame) — just terminate
		ws.close();
		await new Promise((r) => setTimeout(r, 100));

		const disconnectErrors = errors.filter((e) => e.type === "disconnect");
		expect(disconnectErrors).toHaveLength(1);
		expect(disconnectErrors[0].source).toBe("producer-1");
	}, 5000);

	it("malformed event appears in events.jsonl with _error", async () => {
		const tempDir = mkdtempSync(join(tmpdir(), "eventapi-test-"));
		const sidecarPath = join(tempDir, "test.events.jsonl");

		const result = await startEventServer({
			...NO_OP,
			requestedPort: 0,
			isUserSpecified: true,
		});
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		handles.push(result.handle);

		// Set the sidecar path so malformed events get logged
		result.handle.setSidecarPath(sidecarPath);

		const ws = new WebSocket(`ws://127.0.0.1:${result.handle.port}`);
		await new Promise<void>((r) => ws.addEventListener("open", () => r()));

		// Send a malformed JSON payload
		ws.send("{ broken json");
		await new Promise((r) => setTimeout(r, 100));
		ws.close();
		await new Promise((r) => setTimeout(r, 50));

		// Read the sidecar file
		const raw = readFileSync(sidecarPath, "utf-8").trim();
		expect(raw.length).toBeGreaterThan(0);
		const line = JSON.parse(raw.split("\n")[0]);
		expect(line._error).toBe("malformed");
		expect(line.nodeId).toBe("__malformed__");
	}, 5000);
});
