import { describe, expect, it, vi } from "vitest";
import {
	commandLine,
	PLUGIN_INSTALL_STEPS,
	PLUGIN_UPDATE_STEPS,
} from "../../../../../shared/claudePlugin";
import {
	CLI_NOT_FOUND_LABEL,
	type ClaudeRunner,
	claudeArgv,
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
		expect(claudeArgv("C:\\npm\\claude.cmd", ["x"])).toEqual([
			"cmd.exe",
			"/d",
			"/s",
			"/c",
			"C:\\npm\\claude.cmd",
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
