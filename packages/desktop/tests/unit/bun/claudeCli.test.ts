import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	commandLine,
	PLUGIN_INSTALL_STEPS,
	PLUGIN_UPDATE_STEPS,
} from "../../../../../shared/claudePlugin";
import {
	CLI_NOT_FOUND_LABEL,
	CLI_UNSAFE_PATH_LABEL,
	type ClaudeRunner,
	claudeArgv,
	runClaude,
	runClaudeSteps,
} from "../../../src/bun/claudeCli";

const BIN = "/usr/bin/claude";
const find = () => BIN;

function ok(message = "done") {
	return {
		exitCode: 0,
		stdout: `${JSON.stringify({ outcome: "ok", message })}\n`,
		stderr: "",
		timedOut: false,
	};
}

describe("runClaudeSteps", () => {
	it("runs every step in order with the exact args", async () => {
		const runner = vi.fn<ClaudeRunner>(async () => ok());
		const steps = await runClaudeSteps(PLUGIN_INSTALL_STEPS, runner, { find });
		expect(runner.mock.calls.map((c) => c[0])).toEqual([
			[BIN, "plugin", "marketplace", "add", "Shuffzord/RoadRaven", "--json"],
			[BIN, "plugin", "install", "roadraven@roadraven", "--json"],
		]);
		expect(steps.map((s) => s.status)).toEqual(["ok", "ok"]);
		expect(steps.every((s) => s.host === "claude")).toBe(true);
	});

	it("stops at the first non-zero exit, detail from the last JSON line", async () => {
		const runner = vi.fn<ClaudeRunner>(async () => ({
			exitCode: 1,
			stdout: `noise\n${JSON.stringify({ outcome: "failed", message: "git clone failed" })}\n`,
			stderr: "✘ something",
			timedOut: false,
		}));
		const steps = await runClaudeSteps(PLUGIN_INSTALL_STEPS, runner, { find });
		expect(runner).toHaveBeenCalledTimes(1);
		expect(steps).toHaveLength(1);
		expect(steps[0].status).toBe("error");
		expect(steps[0].detail).toBe("git clone failed");
	});

	it("uses stderr when stdout is not JSON", async () => {
		const runner: ClaudeRunner = async () => ({
			exitCode: 2,
			stdout: "not json",
			stderr: "bad flag\n",
			timedOut: false,
		});
		const steps = await runClaudeSteps(PLUGIN_INSTALL_STEPS, runner, { find });
		expect(steps[0].detail).toBe("bad flag");
	});

	it("reports one not-found step when spawning throws ENOENT", async () => {
		const runner: ClaudeRunner = async () => {
			throw Object.assign(new Error("spawn claude ENOENT"), { code: "ENOENT" });
		};
		const steps = await runClaudeSteps(PLUGIN_INSTALL_STEPS, runner, { find });
		expect(steps).toHaveLength(1);
		expect(steps[0].label).toBe(CLI_NOT_FOUND_LABEL);
		expect(steps[0].status).toBe("error");
	});

	it("reports the not-found step without running anything when claude is not found", async () => {
		const runner = vi.fn<ClaudeRunner>(async () => ok());
		const steps = await runClaudeSteps(PLUGIN_INSTALL_STEPS, runner, {
			find: () => null,
		});
		expect(runner).not.toHaveBeenCalled();
		expect(steps).toHaveLength(1);
		expect(steps[0].label).toBe(CLI_NOT_FOUND_LABEL);
	});

	it("runs a .cmd through cmd.exe", async () => {
		const runner = vi.fn<ClaudeRunner>(async () => ok());
		await runClaudeSteps(PLUGIN_INSTALL_STEPS.slice(0, 1), runner, {
			find: () => "C:\\npm\\claude.cmd",
		});
		expect(runner.mock.calls[0][0]).toEqual(
			claudeArgv("C:\\npm\\claude.cmd", PLUGIN_INSTALL_STEPS[0]),
		);
		// No /s: with it cmd strips the quotes around a path with spaces.
		const spaced = "C:\\Users\\Jane Doe\\AppData\\Roaming\\npm\\claude.cmd";
		expect(claudeArgv(spaced, ["x"])).toEqual([
			"cmd.exe",
			"/d",
			"/c",
			spaced,
			"x",
		]);
		expect(claudeArgv(BIN, ["x"])).toEqual([BIN, "x"]);
	});

	// cmd.exe splits or rewrites a `/c` line at these even inside quotes
	// ("'C:\Users\Tom' is not recognized"); Windows user names may contain them.
	it.each([
		"C:\\Users\\Tom & Jerry\\AppData\\Roaming\\npm\\claude.cmd",
		"C:\\Users\\x^y\\AppData\\Roaming\\npm\\claude.cmd",
		"C:\\Users\\pct %USERNAME%\\AppData\\Roaming\\npm\\CLAUDE.BAT",
	])("does not run a shim cmd.exe would misread: %s", async (bin) => {
		const runner = vi.fn<ClaudeRunner>(async () => ok());
		const steps = await runClaudeSteps(PLUGIN_INSTALL_STEPS, runner, {
			find: () => bin,
		});
		expect(runner).not.toHaveBeenCalled();
		expect(steps).toHaveLength(1);
		expect(steps[0]).toMatchObject({
			id: "claude-cli",
			label: CLI_UNSAFE_PATH_LABEL,
			status: "error",
			host: "claude",
		});
		expect(steps[0].detail).toContain(bin);
	});

	it("still runs a native claude.exe whose path has an &", async () => {
		const runner = vi.fn<ClaudeRunner>(async () => ok());
		const bin = "C:\\Users\\Tom & Jerry\\.local\\bin\\claude.exe";
		await runClaudeSteps(PLUGIN_INSTALL_STEPS, runner, { find: () => bin });
		expect(runner).toHaveBeenCalledTimes(2);
	});

	it("gives each step only the time left and reports a killed step as timed out", async () => {
		let clock = 0;
		const runner = vi.fn<ClaudeRunner>(async (_argv, timeoutMs) => {
			clock += timeoutMs; // the step used up all the time it was given
			return { exitCode: 143, stdout: "", stderr: "", timedOut: true };
		});
		const steps = await runClaudeSteps(PLUGIN_INSTALL_STEPS, runner, {
			find,
			budgetMs: 5000,
			now: () => clock,
		});
		expect(runner).toHaveBeenCalledTimes(1);
		expect(runner.mock.calls[0][1]).toBe(5000);
		expect(steps[0].status).toBe("error");
		expect(steps[0].detail).toMatch(/timed out/i);
	});

	it("does not start a step once the deadline has passed", async () => {
		let clock = 0;
		const runner = vi.fn<ClaudeRunner>(async () => {
			clock = 6000;
			return ok();
		});
		const steps = await runClaudeSteps(PLUGIN_INSTALL_STEPS, runner, {
			find,
			budgetMs: 5000,
			now: () => clock,
		});
		expect(runner).toHaveBeenCalledTimes(1);
		expect(steps.map((s) => s.status)).toEqual(["ok", "error"]);
		expect(steps[1].detail).toMatch(/timed out/i);
	});
});

describe("plugin commands", () => {
	it("the update also updates the HUD, which `plugin update roadraven` skips", () => {
		expect(commandLine(PLUGIN_UPDATE_STEPS)).toBe(
			[
				"claude plugin marketplace update roadraven",
				"claude plugin update roadraven@roadraven",
				"claude plugin install roadraven@roadraven",
				"claude plugin update roadraven-hud@roadraven",
			].join("\n"),
		);
	});

	// cmd.exe does not split `a; b`; one command per line pastes into cmd,
	// PowerShell and bash alike.
	it("puts one command per line", () => {
		expect(commandLine(PLUGIN_INSTALL_STEPS)).toBe(
			"claude plugin marketplace add Shuffzord/RoadRaven\nclaude plugin install roadraven@roadraven",
		);
	});
});

describe("runClaude", () => {
	// A stream nobody closes: a grandchild still holding the pipe.
	const openPipe = () => new ReadableStream<Uint8Array>({});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("returns after a timeout even when the pipes stay open", async () => {
		vi.useFakeTimers();
		const proc = {
			stdout: openPipe(),
			stderr: openPipe(),
			exited: Promise.resolve(143),
			signalCode: "SIGTERM",
			pid: 1234,
			kill: vi.fn(),
		};
		const pending = runClaude([BIN], 1000, () => proc, null);
		await vi.advanceTimersByTimeAsync(10_000);
		const res = await pending;
		expect(res.timedOut).toBe(true);
		expect(res.exitCode).toBe(143);
	});

	it("kills and returns when the child never exits", async () => {
		vi.useFakeTimers();
		const proc = {
			stdout: openPipe(),
			stderr: openPipe(),
			exited: new Promise<number>(() => {
				// never exits
			}),
			signalCode: null,
			pid: 1234,
			kill: vi.fn(),
		};
		const pending = runClaude([BIN], 1000, () => proc, null);
		await vi.advanceTimersByTimeAsync(10_000);
		const res = await pending;
		expect(res.timedOut).toBe(true);
		expect(proc.kill).toHaveBeenCalledWith("SIGKILL");
	});

	it("with a tree kill, kills the tree at the deadline instead of a spawn timeout", async () => {
		vi.useFakeTimers();
		let exit: (code: number) => void = () => {
			// set below
		};
		const proc = {
			stdout: openPipe(),
			stderr: openPipe(),
			exited: new Promise<number>((resolve) => {
				exit = resolve;
			}),
			signalCode: null,
			pid: 4321,
			kill: vi.fn(),
		};
		const spawn = vi.fn((_argv: string[], _opts: { timeout?: number }) => proc);
		const killTree = vi.fn(() => exit(1)); // taskkill /F: exit code 1, no signal
		const pending = runClaude([BIN], 1000, spawn, killTree);
		await vi.advanceTimersByTimeAsync(999);
		expect(killTree).not.toHaveBeenCalled();
		await vi.advanceTimersByTimeAsync(10_000);
		const res = await pending;
		expect(spawn.mock.calls[0][1].timeout).toBeUndefined();
		expect(killTree).toHaveBeenCalledWith(4321);
		expect(res.timedOut).toBe(true);
		expect(proc.kill).not.toHaveBeenCalled();
	});

	it("with a tree kill, a run that ends in time is not killed", async () => {
		const killTree = vi.fn();
		const text = (s: string) =>
			new Response(s).body as ReadableStream<Uint8Array>;
		const res = await runClaude(
			[BIN],
			1000,
			() => ({
				stdout: text("out"),
				stderr: text(""),
				exited: Promise.resolve(0),
				signalCode: null,
				pid: 1,
				kill: vi.fn(),
			}),
			killTree,
		);
		expect(res.timedOut).toBe(false);
		expect(killTree).not.toHaveBeenCalled();
	});

	it("reads the output of a normal run", async () => {
		const text = (s: string) =>
			new Response(s).body as ReadableStream<Uint8Array>;
		const res = await runClaude([BIN], 1000, () => ({
			stdout: text("out"),
			stderr: text("err"),
			exited: Promise.resolve(0),
			signalCode: null,
			pid: 1,
			kill: vi.fn(),
		}));
		expect(res).toEqual({
			exitCode: 0,
			stdout: "out",
			stderr: "err",
			timedOut: false,
		});
	});
});

describe("runClaude on Windows, real processes", () => {
	const fixtures = join(__dirname, "../../fixtures/claude-shim");
	let dir = "";
	let pid = 0;

	const alive = (p: number) => {
		try {
			process.kill(p, 0);
			return true;
		} catch {
			return false;
		}
	};

	afterEach(() => {
		if (pid && alive(pid)) process.kill(pid); // RED run: do not leave it behind
		if (dir) rmSync(dir, { recursive: true, force: true });
	});

	// An npm shim runs the real `claude` as a child of cmd.exe. A timed-out
	// step must not leave that child running: it would go on to write
	// ~/.claude.json while the wizard's fallback writes it too.
	it.runIf(process.platform === "win32")(
		"a timed-out .cmd step leaves no process behind",
		async () => {
			dir = mkdtempSync(join(tmpdir(), "rr-claude-shim-"));
			const pidFile = join(dir, "grandchild.pid");
			const resultFile = join(dir, "result.json");
			spawnSync(
				"bun",
				[
					join(fixtures, "run-claude.ts"),
					join(fixtures, "claude.cmd"),
					"1500",
					resultFile,
				],
				{
					env: { ...process.env, RR_SHIM_PID_FILE: pidFile },
					stdio: "ignore",
					timeout: 7000,
				},
			);
			expect(JSON.parse(readFileSync(resultFile, "utf-8")).timedOut).toBe(true);
			pid = Number(readFileSync(pidFile, "utf-8"));
			expect(pid).toBeGreaterThan(0);
			const until = Date.now() + 3000;
			while (alive(pid) && Date.now() < until) {
				await new Promise((r) => setTimeout(r, 50));
			}
			expect(alive(pid)).toBe(false);
		},
		15_000,
	);
});
