import { Utils } from "electrobun/bun";
import type { RoadmapRPCType } from "../../../../../shared/types.ts";
import { bunLogger } from "../logging";
import { nativeSaveDialog } from "../saveFileDialog";

type BunRequests = RoadmapRPCType["bun"]["requests"];
type RpcHandler<K extends keyof BunRequests> = (
	params: BunRequests[K]["params"],
) => BunRequests[K]["response"] | Promise<BunRequests[K]["response"]>;

/**
 * Pop the native "save as" dialog and return the chosen absolute path, or
 * null if the user cancelled / the dialog failed. Used by the saveFileAs RPC
 * handler in ./fileRpc.ts (EDIT-17 File>New flow) — dialog interaction is
 * split out here so saveFileAs itself only has to handle the outcome.
 *
 * The installed Electrobun version (1.16.0) does not expose
 * Utils.saveFileDialog (tracked upstream as blackboardsh/electrobun#233).
 * We probe for it so a future Electrobun release picks up automatically;
 * otherwise fall back to nativeSaveDialog (./saveFileDialog.ts) which
 * shells out to PowerShell / osascript / zenity per platform.
 */
export async function pickSaveFilePath(): Promise<string | null> {
	try {
		const utilsWithSave = Utils as unknown as {
			saveFileDialog?: (opts: {
				title: string;
				filters: Array<{ name: string; extensions: string[] }>;
			}) => Promise<string | null>;
		};
		if (typeof utilsWithSave.saveFileDialog === "function") {
			return await utilsWithSave.saveFileDialog({
				title: "Save Roadmap",
				filters: [{ name: "JSON", extensions: ["json"] }],
			});
		}
		const { homedir } = await import("node:os");
		return await nativeSaveDialog({
			title: "Save Roadmap",
			defaultPath: homedir(),
			defaultName: "roadmap.json",
			filters: [{ name: "JSON", extensions: ["json"] }],
		});
	} catch (err) {
		bunLogger.error`saveFileAs dialog failed: ${String(err)}`;
		return null;
	}
}

export function createDialogRpcHandlers(): {
	openFilePicker: RpcHandler<"openFilePicker">;
} {
	return {
		// openFilePicker handler (Electrobun native dialog)
		openFilePicker: async () => {
			try {
				const { homedir } = await import("node:os");
				const paths = await Utils.openFileDialog({
					startingFolder: homedir(),
					allowedFileTypes: "json",
					canChooseFiles: true,
					canChooseDirectory: false,
					allowsMultipleSelection: false,
				});
				return paths?.[0] ?? "";
			} catch (err) {
				bunLogger.error`openFileDialog failed: ${String(err)}`;
				return "";
			}
		},
	};
}
