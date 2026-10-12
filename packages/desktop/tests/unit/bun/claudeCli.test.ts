import { afterEach, describe, expect, it, vi } from "vitest";
import {
	commandLine,
	PLUGIN_INSTALL_STEPS,
	PLUGIN_UPDATE_STEPS,
} from "../../../../../shared/claudePlugin";
import {
	CLI_NOT_FOUND_LABEL,
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
			"claude plugin marketplace update roadraven; claude plugin update roadraven@roadraven; claude plugin install roadraven@roadraven; claude plugin update roadraven-hud@roadraven",
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
			kill: vi.fn(),
		};
		const pending = runClaude([BIN], 1000, () => proc);
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
			kill: vi.fn(),
		};
		const pending = runClaude([BIN], 1000, () => proc);
		await vi.advanceTimersByTimeAsync(10_000);
		const res = await pending;
		expect(res.timedOut).toBe(true);
		expect(proc.kill).toHaveBeenCalledWith("SIGKILL");
	});

	it("reads the output of a normal run", async () => {
		const text = (s: string) =>
			new Response(s).body as ReadableStream<Uint8Array>;
		const res = await runClaude([BIN], 1000, () => ({
			stdout: text("out"),
			stderr: text("err"),
			exited: Promise.resolve(0),
			signalCode: null,
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
