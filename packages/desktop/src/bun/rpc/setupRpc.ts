import { PLUGIN_STEPS } from "../../../../../shared/claudePlugin.ts";
import type {
	AppSettings,
	RoadmapRPCType,
} from "../../../../../shared/types.ts";
import { runClaudeSteps } from "../claudeCli";
import { bunLogger } from "../logging";
import {
	getSetupStatus,
	installMcpIntegration,
	removeWizardMcpEntry,
} from "../mcpInstaller";
import { openFileDialog } from "../platform/dialogs";
import { loadSettings, saveSettings } from "../settings";
import {
	deleteUserTheme,
	duplicateTheme,
	getThemesDir,
	importThemeFile,
	listUserThemes,
	readUserTheme,
	revealThemesFolder,
	updateUserTheme,
} from "../themes";

type BunRequests = RoadmapRPCType["bun"]["requests"];
type RpcHandler<K extends keyof BunRequests> = (
	params: BunRequests[K]["params"],
) => BunRequests[K]["response"] | Promise<BunRequests[K]["response"]>;

// -- Setup Wizard (v0.6) --------------------------------------------

/** v0.9: offer the plugin install once the wizard is done, once per app version. */
export function shouldOfferPluginInstall(
	status: { claudeDetected: boolean; pluginInstalled: boolean },
	settings: AppSettings,
	appVersion: string,
): boolean {
	return (
		status.claudeDetected &&
		!status.pluginInstalled &&
		settings.setup?.completed === true &&
		settings.pluginInstallDismissedFor !== appVersion
	);
}

export function createSetupRpcHandlers(
	appVersion: string,
	runSteps: typeof runClaudeSteps = runClaudeSteps,
): {
	getSetupStatus: RpcHandler<"getSetupStatus">;
	installMcpIntegration: RpcHandler<"installMcpIntegration">;
	completeSetup: RpcHandler<"completeSetup">;
	runPluginCommands: RpcHandler<"runPluginCommands">;
	dismissPluginInstall: RpcHandler<"dismissPluginInstall">;
} {
	return {
		// getSetupStatus: renderer pulls this on mount to decide whether to
		// auto-open the first-run wizard and to seed the MCP step's state.
		getSetupStatus: () => {
			const settings = loadSettings();
			const status = getSetupStatus(appVersion, settings);
			return {
				...status,
				offerPluginInstall: shouldOfferPluginInstall(
					status,
					settings,
					appVersion,
				),
			};
		},
		// runPluginCommands: the plugin dialog's button. Only the fixed lists
		// in shared/claudePlugin.ts run; the renderer never sends a command.
		runPluginCommands: async ({ kind }) => {
			if (!Object.hasOwn(PLUGIN_STEPS, kind)) {
				throw new Error(`unknown plugin command kind: ${String(kind)}`);
			}
			const steps = await runSteps(PLUGIN_STEPS[kind]);
			// The plugin now brings the MCP server: drop the wizard's own entry.
			if (steps.length > 0 && steps.every((s) => s.status !== "error")) {
				const dedupe = removeWizardMcpEntry();
				if (dedupe) steps.push(dedupe);
			}
			const failed = steps.find((s) => s.status === "error");
			if (failed) {
				bunLogger.warn`Plugin ${kind} failed at '${failed.label}': ${failed.detail}`;
			}
			return { ok: !failed, steps };
		},
		// dismissPluginInstall: the user closed the install offer.
		dismissPluginInstall: () => {
			saveSettings({ pluginInstallDismissedFor: appVersion });
			return { ok: true as const };
		},
		// installMcpIntegration: copy the bundled MCP server into the user
		// data dir and register it in the selected hosts' configs (Claude
		// Code: install the plugin via the `claude` CLI, entry as fallback).
		installMcpIntegration: async ({ hosts }) => {
			const result = await installMcpIntegration(hosts);
			if (result.ok) {
				bunLogger.info`MCP integration installed: server=${result.serverPath} config=${result.configPath}`;
			} else {
				const failed = result.steps.find((s) => s.status === "error");
				bunLogger.warn`MCP integration install failed at step '${failed?.id}': ${failed?.detail}`;
			}
			return result;
		},
		// completeSetup: persist that the first-run wizard is done so it stops
		// auto-opening on subsequent launches.
		completeSetup: () => {
			saveSettings({ setup: { completed: true } });
			return { ok: true as const };
		},
	};
}

// -- User themes (v0.8.3 Phase 4) ------------------------------------------
//
// The renderer never hands Bun a path to write: duplicate writes under the
// slug of a name, import copies whatever the native dialog returned, reveal
// opens the fixed themes dir. `reservedIds` are the built-in ids, which only
// the renderer's registry knows.

export function createThemeRpcHandlers(): {
	listThemes: RpcHandler<"listThemes">;
	readTheme: RpcHandler<"readTheme">;
	duplicateTheme: RpcHandler<"duplicateTheme">;
	importTheme: RpcHandler<"importTheme">;
	revealThemesFolder: RpcHandler<"revealThemesFolder">;
	writeTheme: RpcHandler<"writeTheme">;
	deleteTheme: RpcHandler<"deleteTheme">;
} {
	return {
		listThemes: ({ reservedIds }) => ({
			themes: listUserThemes({ reservedIds }),
			dir: getThemesDir(),
		}),
		readTheme: ({ id, reservedIds }) => readUserTheme(id, { reservedIds }),
		duplicateTheme: ({ source, name, reservedIds }) =>
			duplicateTheme(source, name, { reservedIds }),
		importTheme: async ({ reservedIds }) => {
			let paths: string[];
			try {
				const { homedir } = await import("node:os");
				paths = await openFileDialog({
					startingFolder: homedir(),
					allowedFileTypes: "json",
					canChooseFiles: true,
					canChooseDirectory: false,
					allowsMultipleSelection: false,
				});
			} catch (err) {
				bunLogger.error`importTheme: openFileDialog failed: ${String(err)}`;
				return { ok: false, error: "could not open the file dialog" };
			}
			const chosen = paths?.[0];
			if (!chosen) return { ok: false, error: null };
			return importThemeFile(chosen, { reservedIds });
		},
		revealThemesFolder: () => revealThemesFolder(),
		// v0.8.3 Phase 5: the editor's autosave — overwrite an existing user
		// theme only; a built-in (reserved) or unknown id is refused.
		writeTheme: ({ file, reservedIds }) =>
			updateUserTheme(file, { reservedIds }),
		// v0.8.3 Phase 7: the picker's delete — a user theme only.
		deleteTheme: ({ id, reservedIds }) => deleteUserTheme(id, { reservedIds }),
	};
}
