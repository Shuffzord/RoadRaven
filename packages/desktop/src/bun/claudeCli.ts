// claudeCli.ts — runs `claude` CLI commands (the plugin install / update steps
// in shared/claudePlugin.ts) and turns each into a wizard log step.
//
// The runner is a parameter with a default so tests never spawn a process.

import { existsSync } from "node:fs";
import { join } from "node:path";
import {
	type ClaudeCommand,
	commandLine,
} from "../../../../shared/claudePlugin";
import type { McpInstallStep } from "../../../../shared/types";

export interface ClaudeRunResult {
	exitCode: number;
	stdout: string;
	stderr: string;
	/** True when the process was killed for running past its time. */
	timedOut: boolean;
}

/** Runs one full argv (binary first) and is killed after `timeoutMs`. */
export type ClaudeRunner = (
	argv: string[],
	timeoutMs: number,
) => Promise<ClaudeRunResult>;

export const CLI_NOT_FOUND_LABEL = "Claude Code CLI not found";

/** All steps together must finish inside the 120 s RPC limit. */
const DEFAULT_BUDGET_MS = 100_000;

/** The slice of `Bun.spawn` runClaude uses; a parameter so tests can fake it. */
type SpawnClaude = (
	argv: string[],
	opts: {
		stdin: "ignore";
		stdout: "pipe";
		stderr: "pipe";
		env: typeof process.env;
		timeout: number;
	},
) => {
	stdout: ReadableStream<Uint8Array>;
	stderr: ReadableStream<Uint8Array>;
	exited: Promise<number>;
	signalCode: string | null;
	kill(signal?: string | number): void;
};

/** Default runner: no stdin, the app's env (CLAUDE_CONFIG_DIR included). */
export async function runClaude(
	argv: string[],
	timeoutMs: number,
	spawn: SpawnClaude = (cmd, opts) => Bun.spawn(cmd, opts),
): Promise<ClaudeRunResult> {
	const proc = spawn(argv, {
		stdin: "ignore",
		stdout: "pipe",
		stderr: "pipe",
		env: process.env,
		timeout: timeoutMs,
	});
	const output = Promise.all([
		new Response(proc.stdout).text(),
		new Response(proc.stderr).text(),
	]);
	// `timeout` sends SIGTERM; this backstop covers a child that ignores it.
	const exitCode = await within(proc.exited, timeoutMs + PIPE_GRACE_MS, null);
	if (exitCode === null) proc.kill("SIGKILL");
	// A grandchild can keep the pipes open after the child is gone.
	const [stdout, stderr] = await within(output, PIPE_GRACE_MS, ["", ""]);
	return {
		exitCode: exitCode ?? -1,
		stdout,
		stderr,
		timedOut: exitCode === null || proc.signalCode !== null,
	};
}

/** How long to wait on the pipes once the child has exited (or been killed). */
const PIPE_GRACE_MS = 2_000;

/** `promise`, or `fallback` once `ms` have passed. */
function within<T, F>(
	promise: Promise<T>,
	ms: number,
	fallback: F,
): Promise<T | F> {
	let timer: ReturnType<typeof setTimeout> | undefined;
	const late = new Promise<F>((resolve) => {
		timer = setTimeout(resolve, ms, fallback);
	});
	return Promise.race([promise, late]).finally(() => clearTimeout(timer));
}

/** Where `claude` usually lives when a GUI launch has a short PATH. */
function claudeCandidates(): string[] {
	const home = process.env.HOME || process.env.USERPROFILE || "";
	const list = [
		join(home, ".local", "bin", "claude"),
		join(home, ".claude", "local", "claude"),
		"/opt/homebrew/bin/claude",
		"/usr/local/bin/claude",
	];
	if (process.env.USERPROFILE) {
		list.push(join(process.env.USERPROFILE, ".local", "bin", "claude.exe"));
	}
	if (process.env.APPDATA) {
		list.push(join(process.env.APPDATA, "npm", "claude.cmd"));
	}
	return list;
}

/** The `claude` binary: PATH first, then the usual install locations. */
export function findClaude(): string | null {
	return Bun.which("claude") ?? claudeCandidates().find(existsSync) ?? null;
}

/** Full argv for one command; `.cmd` / `.bat` shims need cmd.exe. */
export function claudeArgv(bin: string, args: ClaudeCommand): string[] {
	if (/\.(cmd|bat)$/i.test(bin))
		return ["cmd.exe", "/d", "/s", "/c", bin, ...args];
	return [bin, ...args];
}

function notFoundStep(): McpInstallStep {
	return {
		id: "claude-cli",
		label: CLI_NOT_FOUND_LABEL,
		status: "error",
		detail: "RoadRaven could not find the `claude` command on this computer.",
		host: "claude",
	};
}

/** The `message` of the last stdout line (`--json` output), else stderr. */
function resultDetail(res: ClaudeRunResult): string {
	const last = res.stdout.trim().split("\n").pop() ?? "";
	try {
		const message = (JSON.parse(last) as { message?: unknown }).message;
		if (typeof message === "string") return message;
	} catch {
		// Not JSON — fall through to stderr.
	}
	return res.stderr.trim() || `exit code ${res.exitCode}`;
}

function toStep(
	args: ClaudeCommand,
	index: number,
	status: McpInstallStep["status"],
	detail: string,
): McpInstallStep {
	return {
		id: `plugin-${index}`,
		label: commandLine([args]),
		status,
		detail,
		host: "claude",
	};
}

const timedOut = (budgetMs: number) =>
	`Timed out after ${Math.round(budgetMs / 1000)} s`;

/** One command as a step; null means the binary could not be spawned (ENOENT). */
async function runOne(
	bin: string,
	args: ClaudeCommand,
	i: number,
	remaining: number,
	runner: ClaudeRunner,
	budgetMs: number,
): Promise<McpInstallStep | null> {
	if (remaining <= 0) return toStep(args, i, "error", timedOut(budgetMs));
	try {
		const res = await runner(claudeArgv(bin, args), remaining);
		if (res.timedOut) return toStep(args, i, "error", timedOut(budgetMs));
		const status = res.exitCode === 0 ? "ok" : "error";
		return toStep(args, i, status, resultDetail(res));
	} catch (e) {
		if ((e as { code?: unknown }).code === "ENOENT") return null;
		return toStep(args, i, "error", String(e));
	}
}

/**
 * Run the commands in order, one log step each, stopping at the first
 * failure. A missing CLI is one "not found" step. All steps share one
 * deadline; a step still running at the deadline is killed.
 */
export async function runClaudeSteps(
	steps: readonly ClaudeCommand[],
	runner: ClaudeRunner = runClaude,
	opts: {
		find?: () => string | null;
		budgetMs?: number;
		now?: () => number;
	} = {},
): Promise<McpInstallStep[]> {
	const {
		find = findClaude,
		budgetMs = DEFAULT_BUDGET_MS,
		now = Date.now,
	} = opts;
	const bin = find();
	if (!bin) return [notFoundStep()];
	const deadline = now() + budgetMs;
	const out: McpInstallStep[] = [];
	for (const [i, args] of steps.entries()) {
		const step = await runOne(bin, args, i, deadline - now(), runner, budgetMs);
		if (step === null) return [...out, notFoundStep()];
		out.push(step);
		if (step.status === "error") break;
	}
	return out;
}
