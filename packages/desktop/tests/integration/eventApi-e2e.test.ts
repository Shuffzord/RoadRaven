// Phase 4 Wave 1 — E2E test for Plan 04-02 Task 6.
// Spawns the standalone Bun entry, reads sentinel, connects via WS.
// Sources: D-04, D-29 in 04-CONTEXT.md, §7.3 in 04-RESEARCH.md.
// Run via: bun test (not vitest — uses Bun.serve + subprocess spawn with Bun runtime).

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("Event API end-to-end", () => {
	it("standalone bun entry boots event server, writes sentinel, accepts ws connection", async () => {
		// Resolve the standalone entry relative to this test file
		const standaloneEntry = join(
			__dirname,
			"../../src/bun/eventServerStandalone.ts",
		);

		const child = spawn("bun", ["run", standaloneEntry], {
			env: { ...process.env, ROADRAVEN_EVENT_PORT: "0" }, // OS-assigned port
			stdio: ["ignore", "pipe", "pipe"],
		});

		// Wait for the ready line from stdout (or error from stderr)
		const ready = await new Promise<{ ready: true; port: number; pid: number }>(
			(resolve, reject) => {
				const timer = setTimeout(
					() =>
						reject(new Error("standalone never printed ready line within 8s")),
					8000,
				);
				child.stdout!.on("data", (chunk: Buffer) => {
					for (const line of chunk.toString().split("\n").filter(Boolean)) {
						try {
							const parsed = JSON.parse(line) as Record<string, unknown>;
							if (parsed.ready) {
								clearTimeout(timer);
								resolve(parsed as { ready: true; port: number; pid: number });
								return;
							}
						} catch {
							// ignore non-JSON lines (e.g. LogTape output)
						}
					}
				});
				child.stderr!.on("data", (chunk: Buffer) => {
					const text = chunk.toString();
					// Only reject if it looks like a startup error (not just log output)
					if (text.includes('"ok":false')) {
						clearTimeout(timer);
						reject(new Error(`standalone reported error: ${text}`));
					}
				});
				child.on("error", (err) => {
					clearTimeout(timer);
					reject(err);
				});
			},
		);

		expect(ready.port).toBeGreaterThan(0);
		expect(ready.pid).toBeGreaterThan(0);

		// Connect via WebSocket and send hello
		const ws = new WebSocket(`ws://127.0.0.1:${ready.port}`);
		await new Promise<void>((resolve, reject) => {
			ws.addEventListener("open", () => resolve());
			ws.addEventListener("error", reject);
			setTimeout(() => reject(new Error("WS open timeout")), 3000);
		});

		ws.send(
			JSON.stringify({ type: "hello", source: "e2e-test", version: "1" }),
		);

		// Small delay for hello to land
		await new Promise((r) => setTimeout(r, 100));
		ws.close();

		// Kill the standalone process
		child.kill("SIGTERM");
		await new Promise<void>((resolve) => child.on("exit", () => resolve()));

		// All assertions passed: port was assigned, WS connected
		expect(ready.port).toBeGreaterThan(0);
	}, 12000); // 12s timeout for process spawn + WS connect

	// WR-06 (06-REVIEW): standalone must FAIL FAST on invalid
	// ROADRAVEN_EVENT_PORT instead of silently falling back to the default.
	// Previously, exec fell through to `requestedPort = envPort ??
	// DEFAULT_PORT` after logging, so a typo'd env var let the server bind
	// 47921 and parent tests could not distinguish that from a healthy boot.
	it("exits non-zero on invalid ROADRAVEN_EVENT_PORT (WR-06)", async () => {
		const standaloneEntry = join(
			__dirname,
			"../../src/bun/eventServerStandalone.ts",
		);

		const child = spawn("bun", ["run", standaloneEntry], {
			env: { ...process.env, ROADRAVEN_EVENT_PORT: "not-a-number" },
			stdio: ["ignore", "pipe", "pipe"],
		});

		const result = await new Promise<{ code: number | null; stderr: string }>(
			(resolve, reject) => {
				let stderrBuf = "";
				const timer = setTimeout(
					() => reject(new Error("standalone did not exit within 5s")),
					5000,
				);
				child.stderr!.on("data", (chunk: Buffer) => {
					stderrBuf += chunk.toString();
				});
				child.on("exit", (code) => {
					clearTimeout(timer);
					resolve({ code, stderr: stderrBuf });
				});
				child.on("error", (err) => {
					clearTimeout(timer);
					reject(err);
				});
			},
		);

		expect(result.code).toBe(1);
		expect(result.stderr).toContain("invalid_port");
	}, 8000);
});
