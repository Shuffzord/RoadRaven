import type { RoadmapRPCType } from "../../../../../shared/types.ts";
import { bunLogger } from "../logging";
import { getSetupStatus, installMcpIntegration } from "../mcpInstaller";
import { loadSettings, saveSettings } from "../settings";

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
