#!/usr/bin/env bun
// Headless Bun entry — boots ONLY the event server. No BrowserWindow, no Electrobun.
// Used by tests/integration/eventApi-e2e.test.ts per RESEARCH §7.3.
//
// I-26: stdout/stderr IPC protocol to parent test runner. Legitimate exception to the
// no-console rule (I-19) because this headless Bun entry has no LogTape logger in scope
// and the E2E test (eventApi-e2e.test.ts) depends on line-delimited JSON on stdout/stderr.
// Use process.stdout.write / process.stderr.write to avoid the literal `console.*` ban.

import { DEFAULT_PORT, startEventServer } from "./eventServer";
import { deleteSentinel, writeSentinel } from "./sentinel";

const envPortRaw = process.env.ROADRAVEN_EVENT_PORT;
const envPortParsed = envPortRaw ? Number(envPortRaw) : null;
if (envPortRaw && (envPortParsed === null || Number.isNaN(envPortParsed))) {
	process.stderr.write(
		`${JSON.stringify({ ok: false, error: "invalid_port", value: envPortRaw })}\n`,
	);
}
const envPort =
	envPortParsed !== null && !Number.isNaN(envPortParsed) ? envPortParsed : null;
const requestedPort = envPort ?? DEFAULT_PORT;
const isUserSpecified = envPort !== null;

const result = await startEventServer({
	requestedPort,
	isUserSpecified,
	onFlush: () => {
		/* no renderer */
	},
	onEvent: () => {
		/* no renderer */
	},
	onError: () => {
		/* no renderer */
	},
	onConnectionChange: () => {
		/* no renderer */
	},
});

if (!result.ok) {
	process.stderr.write(
		`${JSON.stringify({ ok: false, error: "in_use", attempted: result.attempted })}\n`,
	);
	process.exit(1);
}

await writeSentinel({
	port: result.handle.port,
	url: `ws://127.0.0.1:${result.handle.port}`,
	startedAt: new Date().toISOString(),
	pid: process.pid,
});

// I-26: stdout IPC to parent test runner — E2E reads this ready line.
process.stdout.write(
	`${JSON.stringify({ ready: true, port: result.handle.port, pid: process.pid })}\n`,
);

const shutdown = async () => {
	await result.handle.stop();
	await deleteSentinel();
	process.exit(0);
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
