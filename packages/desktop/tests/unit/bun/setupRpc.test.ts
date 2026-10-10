// v0.9 Phase 2: the plugin install / update RPCs run only the fixed lists.
import { describe, expect, it, vi } from "vitest";
import {
	PLUGIN_INSTALL_STEPS,
	PLUGIN_UPDATE_STEPS,
	type PluginCommandKind,
} from "../../../../../shared/claudePlugin";
import type { McpInstallStep } from "../../../../../shared/types";

const settings = vi.hoisted(() => ({
	loadSettings: vi.fn(() => ({})),
	saveSettings: vi.fn(),
}));
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
