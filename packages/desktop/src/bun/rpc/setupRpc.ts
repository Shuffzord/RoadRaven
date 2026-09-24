import type { RoadmapRPCType } from "../../../../../shared/types.ts";
import { bunLogger } from "../logging";
import { getSetupStatus, installMcpIntegration } from "../mcpInstaller";
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

export function createSetupRpcHandlers(appVersion: string): {
	getSetupStatus: RpcHandler<"getSetupStatus">;
	installMcpIntegration: RpcHandler<"installMcpIntegration">;
	completeSetup: RpcHandler<"completeSetup">;
} {
	return {
		// getSetupStatus: renderer pulls this on mount to decide whether to
		// auto-open the first-run wizard and to seed the MCP step's state.
		getSetupStatus: () => {
			return getSetupStatus(appVersion, loadSettings());
		},
		// installMcpIntegration: copy the bundled MCP server into the user
		// data dir and register it in the selected hosts' configs.
		installMcpIntegration: ({ hosts }) => {
			const result = installMcpIntegration(hosts);
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
