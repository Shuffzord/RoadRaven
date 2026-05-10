#!/usr/bin/env bun
/**
 * Deterministic runner for the storytelling video.
 *
 * Spawns the @roadraven/plugin-claude-code MCP server as a child process,
 * speaks newline-delimited JSON-RPC over stdio, and plays timeline.json with
 * setTimeout-precise pacing while OBS records the desktop app.
 *
 * Operator workflow:
 *   1. Launch the RoadRaven desktop app (Event API auto-starts).
 *   2. Start OBS recording.
 *   3. Run: `bun scripts/storytelling-video/run.ts`
 *
 * No LLM is in the loop during recording — all timing is mechanical, so
 * retakes are bit-identical.
 */
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(HERE, "..", "..");
const MCP_ENTRY = join(PROJECT_ROOT, "plugins/claude-code/src/index.ts");

interface Cue {
	act: 1 | 2 | 3 | 4;
	at_ms: number;
	op: string;
	args: Record<string, unknown>;
	alias?: string;
	captureRootAlias?: string;
	narratorBeat?: string;
	comment?: string;
}
interface Timeline {
	version: string;
	totalDurationMs: number;
	cues: Cue[];
}

const timeline: Timeline = JSON.parse(
	readFileSync(join(HERE, "timeline.json"), "utf8"),
);

// ---- MCP stdio JSON-RPC client ---------------------------------------------
const proc = spawn("bun", [MCP_ENTRY], {
	stdio: ["pipe", "pipe", "inherit"],
	env: { ...process.env },
});

let nextId = 1;
const pending = new Map<
	number,
	{ resolve: (m: unknown) => void; reject: (e: Error) => void }
>();

let buffer = "";
proc.stdout.setEncoding("utf8");
proc.stdout.on("data", (chunk: string) => {
	buffer += chunk;
	let nl: number;
	// biome-ignore lint/suspicious/noAssignInExpressions: classic line-buffer drain
	while ((nl = buffer.indexOf("\n")) >= 0) {
		const line = buffer.slice(0, nl).trim();
		buffer = buffer.slice(nl + 1);
		if (!line) continue;
		try {
			const msg = JSON.parse(line) as { id?: number; result?: unknown; error?: { message: string } };
			if (msg.id != null && pending.has(msg.id)) {
				const p = pending.get(msg.id);
				if (!p) continue;
				pending.delete(msg.id);
				if (msg.error) p.reject(new Error(msg.error.message));
				else p.resolve(msg.result);
			}
		} catch {
			// Non-JSON output (server logs, etc.) — ignore.
		}
	}
});

proc.on("exit", (code) => {
	if (code !== 0 && code !== null) {
		console.error(`MCP server exited with code ${code}`);
		process.exit(code);
	}
});

function send(method: string, params: unknown, id?: number): void {
	const frame =
		id !== undefined
			? { jsonrpc: "2.0", id, method, params }
			: { jsonrpc: "2.0", method, params };
	proc.stdin.write(`${JSON.stringify(frame)}\n`);
}

function rpc<T = unknown>(method: string, params: unknown): Promise<T> {
	const id = nextId++;
	return new Promise<T>((resolve, reject) => {
		pending.set(id, {
			resolve: (m) => resolve(m as T),
			reject,
		});
		send(method, params, id);
		// 10s timeout per RPC. The desktop app should respond in <100ms; anything
		// over 1s usually means the app isn't running or the WS bridge is wedged.
		setTimeout(() => {
			if (pending.has(id)) {
				pending.delete(id);
				reject(new Error(`RPC ${method} timed out after 10s`));
			}
		}, 10_000);
	});
}

async function callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
	const result = (await rpc("tools/call", { name, arguments: args })) as {
		content?: Array<{ type: string; text: string }>;
		isError?: boolean;
	};
	if (result.isError) {
		const text = result.content?.[0]?.text ?? "(no error text)";
		throw new Error(`tool ${name} returned error: ${text}`);
	}
	const text = result.content?.[0]?.text;
	if (!text) return null;
	try {
		return JSON.parse(text);
	} catch {
		return text;
	}
}

// ---- Alias resolution ------------------------------------------------------
const aliases = new Map<string, string>();
function resolveAliases(args: Record<string, unknown>): Record<string, unknown> {
	const out: Record<string, unknown> = {};
	for (const [k, v] of Object.entries(args)) {
		if (typeof v === "string" && v.startsWith("@")) {
			const ref = v.slice(1);
			const real = aliases.get(ref);
			if (!real) throw new Error(`alias @${ref} not yet captured`);
			out[k] = real;
		} else if (v && typeof v === "object" && !Array.isArray(v)) {
			out[k] = resolveAliases(v as Record<string, unknown>);
		} else {
			out[k] = v;
		}
	}
	return out;
}

function extractNodeIdFromCreate(result: unknown): string | null {
	if (typeof result !== "object" || result === null) return null;
	const r = result as { nodeId?: string };
	return typeof r.nodeId === "string" ? r.nodeId : null;
}

function extractRootIdFromGetRoadmap(result: unknown): string | null {
	if (typeof result !== "object" || result === null) return null;
	const r = result as { schema?: { nodes?: Array<{ id?: string }> } };
	const nodes = r.schema?.nodes;
	if (Array.isArray(nodes) && typeof nodes[0]?.id === "string") {
		return nodes[0].id;
	}
	return null;
}

const sleep = (ms: number): Promise<void> =>
	new Promise((r) => setTimeout(r, Math.max(0, ms)));

// ---- Main playback ---------------------------------------------------------
async function main(): Promise<void> {
	// MCP initialize handshake
	console.log("[runner] initializing MCP server...");
	await rpc("initialize", {
		protocolVersion: "2024-11-05",
		capabilities: {},
		clientInfo: { name: "storytelling-video-runner", version: "0.1.0" },
	});
	send("notifications/initialized", {});

	// Wait for the plugin's WS bridge to actually connect to the desktop app
	// before t0. The plugin's connectLoop runs async in the background; firing
	// the first cue before connection lands returns "Not connected to Roadmap
	// Viewer Event API." Probe getOpenFile (a cheap no-op) up to 20× × 250ms.
	console.log("[runner] waiting for WS bridge to the desktop app...");
	let bridged = false;
	for (let i = 0; i < 20; i++) {
		try {
			await callTool("getOpenFile", {});
			bridged = true;
			break;
		} catch (err) {
			const msg = (err as Error).message;
			if (msg.includes("not running")) {
				console.error("[runner] desktop app is not running. Launch it with `bun run dev:hmr` and retry.");
				proc.kill();
				process.exit(1);
			}
			await sleep(250);
		}
	}
	if (!bridged) {
		console.error("[runner] WS bridge did not connect within 5s. Is the desktop app running with the Event API enabled?");
		proc.kill();
		process.exit(1);
	}
	console.log("[runner] bridge connected.\n");

	console.log(`[runner] playing ${timeline.cues.length} cues over ${timeline.totalDurationMs}ms\n`);
	const t0 = performance.now();

	for (const cue of timeline.cues) {
		const drift = cue.at_ms - (performance.now() - t0);
		if (drift > 0) await sleep(drift);
		const elapsed = Math.round(performance.now() - t0);
		const beat = cue.narratorBeat ? `  // "${cue.narratorBeat}"` : "";
		console.log(
			`[t+${String(elapsed).padStart(5, " ")}ms] act${cue.act} ${cue.op}(${JSON.stringify(cue.args).slice(0, 80)})${beat}`,
		);

		try {
			const args = resolveAliases(cue.args);
			const result = await callTool(cue.op, args);
			if (cue.alias) {
				const id = extractNodeIdFromCreate(result);
				if (id) aliases.set(cue.alias, id);
				else console.warn(`  [warn] cue alias ${cue.alias} requested but no nodeId in response`);
			}
			if (cue.captureRootAlias) {
				const id = extractRootIdFromGetRoadmap(result);
				if (id) aliases.set(cue.captureRootAlias, id);
				else console.warn(`  [warn] captureRootAlias ${cue.captureRootAlias} requested but no root id`);
			}
		} catch (err) {
			console.error(`  [error] ${cue.op} failed:`, (err as Error).message);
			throw err;
		}
	}

	// Hold the final frame for the rest of the budget
	const totalElapsed = performance.now() - t0;
	const remaining = timeline.totalDurationMs - totalElapsed;
	if (remaining > 0) {
		console.log(`\n[runner] final cue done at t+${Math.round(totalElapsed)}ms — holding for ${Math.round(remaining)}ms`);
		await sleep(remaining);
	}

	console.log("\n[runner] timeline complete. Stop OBS recording.");
	proc.kill();
	process.exit(0);
}

main().catch((err) => {
	console.error("[runner] fatal:", err);
	proc.kill();
	process.exit(1);
});
