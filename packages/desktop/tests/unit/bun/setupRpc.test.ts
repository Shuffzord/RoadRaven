// v0.9 Phase 2: the plugin install / update RPCs run only the fixed lists.
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	PLUGIN_INSTALL_STEPS,
	PLUGIN_UPDATE_STEPS,
	type PluginCommandKind,
} from "../../../../../shared/claudePlugin";
import type { McpInstallStep } from "../../../../../shared/types";

// Every Claude config and user-data path points into a temp dir.
const sandbox = vi.hoisted(() => ({ dir: "" }));
const settings = vi.hoisted(() => ({
	loadSettings: vi.fn(() => ({})),
	saveSettings: vi.fn(),
	getUserDataDir: () => sandbox.dir,
}));
let savedConfigDir: string | undefined;
beforeEach(() => {
	sandbox.dir = mkdtempSync(join(tmpdir(), "rr-setuprpc-"));
	savedConfigDir = process.env.CLAUDE_CONFIG_DIR;
	process.env.CLAUDE_CONFIG_DIR = sandbox.dir;
});
afterEach(() => {
	if (savedConfigDir === undefined) delete process.env.CLAUDE_CONFIG_DIR;
	else process.env.CLAUDE_CONFIG_DIR = savedConfigDir;
	rmSync(sandbox.dir, { recursive: true, force: true });
});
vi.mock("../../../src/bun/settings", () => settings);
// The native dialog / shell modules pull in Electrobun's FFI, which vitest can't load.
vi.mock("../../../src/bun/platform/dialogs", () => ({}));
vi.mock("../../../src/bun/platform/shell", () => ({}));

import {
	createSetupRpcHandlers,
	shouldOfferPluginInstall,
} from "../../../src/bun/rpc/setupRpc";

const okStep: McpInstallStep = {
	id: "plugin-0",
	label: "x",
	status: "ok",
	host: "claude",
};

describe("runPluginCommands", () => {
	it("runs the fixed list for the kind", async () => {
		const run = vi.fn(async () => [okStep]);
		const h = createSetupRpcHandlers("0.9.0", run);
		expect(await h.runPluginCommands({ kind: "update" })).toEqual({
			ok: true,
			steps: [okStep],
		});
		await h.runPluginCommands({ kind: "install" });
		expect(run.mock.calls.map((c) => (c as unknown[])[0])).toEqual([
			PLUGIN_UPDATE_STEPS,
			PLUGIN_INSTALL_STEPS,
		]);
	});

	it("is not ok when a step failed", async () => {
		const run = vi.fn(async () => [{ ...okStep, status: "error" as const }]);
		const h = createSetupRpcHandlers("0.9.0", run);
		expect((await h.runPluginCommands({ kind: "update" })).ok).toBe(false);
	});

	it("rejects an unknown kind without running anything", async () => {
		const run = vi.fn(async () => [okStep]);
		const h = createSetupRpcHandlers("0.9.0", run);
		await expect(
			h.runPluginCommands({ kind: "rm -rf" as PluginCommandKind }),
		).rejects.toThrow(/unknown/i);
		await expect(
			h.runPluginCommands({ kind: "toString" as PluginCommandKind }),
		).rejects.toThrow(/unknown/i);
		expect(run).not.toHaveBeenCalled();
	});
});

describe("runPluginCommands removes the wizard's duplicate MCP entry", () => {
	const configPath = () => join(sandbox.dir, ".claude.json");
	const writeServers = (servers: Record<string, unknown>) =>
		writeFileSync(configPath(), JSON.stringify({ mcpServers: servers }));
	const readServers = () =>
		JSON.parse(readFileSync(configPath(), "utf8")).mcpServers;
	const ours = () => ({
		command: "node",
		args: [join(sandbox.dir, "mcp", "roadraven-mcp.mjs")],
	});

	it("removes our entry after a successful install and returns a dedupe step", async () => {
		writeServers({ roadraven: ours(), other: { command: "x" } });
		const h = createSetupRpcHandlers("0.9.0", async () => [okStep]);
		const res = await h.runPluginCommands({ kind: "install" });
		expect(res.ok).toBe(true);
		expect(res.steps.map((s) => [s.id, s.status])).toEqual([
			["plugin-0", "ok"],
			["dedupe", "ok"],
		]);
		expect(readServers()).toEqual({ other: { command: "x" } });
	});

	it("keeps a foreign roadraven entry and returns the skipped advice step", async () => {
		const npx = { command: "npx", args: ["-y", "@roadraven/mcp@0.9.0"] };
		writeServers({ roadraven: npx });
		const h = createSetupRpcHandlers("0.9.0", async () => [okStep]);
		const res = await h.runPluginCommands({ kind: "update" });
		expect(res.ok).toBe(true);
		const dedupe = res.steps.find((s) => s.id === "dedupe");
		expect(dedupe?.status).toBe("skipped");
		expect(dedupe?.detail).toContain("claude mcp remove roadraven");
		expect(readServers()).toEqual({ roadraven: npx });
	});

	it("leaves the entry when a plugin step failed", async () => {
		writeServers({ roadraven: ours() });
		const h = createSetupRpcHandlers("0.9.0", async () => [
			{ ...okStep, status: "error" as const },
		]);
		const res = await h.runPluginCommands({ kind: "install" });
		expect(res.steps.some((s) => s.id === "dedupe")).toBe(false);
		expect(readServers()).toEqual({ roadraven: ours() });
	});

	it("is not ok when the removal fails", async () => {
		writeFileSync(configPath(), "{ corrupt");
		const h = createSetupRpcHandlers("0.9.0", async () => [okStep]);
		const res = await h.runPluginCommands({ kind: "install" });
		expect(res.ok).toBe(false);
		expect(res.steps.at(-1)).toMatchObject({ id: "dedupe", status: "error" });
	});
});

describe("plugin install offer", () => {
	const status = { claudeDetected: true, pluginInstalled: false };
	const done = { setup: { completed: true } };

	it("offers when Claude Code has no plugin and the wizard is done", () => {
		expect(shouldOfferPluginInstall(status, done, "0.9.0")).toBe(true);
	});

	it("does not offer before the wizard, with the plugin, or without Claude Code", () => {
		expect(shouldOfferPluginInstall(status, {}, "0.9.0")).toBe(false);
		expect(
			shouldOfferPluginInstall(
				{ ...status, pluginInstalled: true },
				done,
				"0.9.0",
			),
		).toBe(false);
		expect(
			shouldOfferPluginInstall(
				{ ...status, claudeDetected: false },
				done,
				"0.9.0",
			),
		).toBe(false);
	});

	it("a dismissal holds for that app version only", () => {
		const dismissed = { ...done, pluginInstallDismissedFor: "0.9.0" };
		expect(shouldOfferPluginInstall(status, dismissed, "0.9.0")).toBe(false);
		expect(shouldOfferPluginInstall(status, dismissed, "0.9.1")).toBe(true);
	});

	it("dismissPluginInstall saves the app version", () => {
		createSetupRpcHandlers("0.9.0").dismissPluginInstall({});
		expect(settings.saveSettings).toHaveBeenCalledWith({
			pluginInstallDismissedFor: "0.9.0",
		});
	});
});
