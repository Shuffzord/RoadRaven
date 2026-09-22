import type { RoadmapRPCType } from "../../../../../shared/types.ts";
import { bunLogger } from "../logging";
import { openFileDialog, openSaveDialog } from "../platform/dialogs";

type BunRequests = RoadmapRPCType["bun"]["requests"];
type RpcHandler<K extends keyof BunRequests> = (
	params: BunRequests[K]["params"],
) => BunRequests[K]["response"] | Promise<BunRequests[K]["response"]>;

/**
 * Pop the native "save as" dialog and return the chosen absolute path, or
 * null if the user cancelled / the dialog failed. Used by the saveFileAs RPC
 * handler in ./fileRpc.ts (EDIT-17 File>New flow) — dialog interaction is
 * split out here so saveFileAs itself only has to handle the outcome.
 */
export async function pickSaveFilePath(
	defaults: { defaultPath?: string; defaultName?: string } = {},
): Promise<string | null> {
	const { homedir } = await import("node:os");
	return openSaveDialog({
		title: "Save Roadmap",
		defaultPath: defaults.defaultPath ?? homedir(),
		defaultName: defaults.defaultName ?? "roadmap.json",
		filters: [{ name: "JSON", extensions: ["json"] }],
	});
}

export function createDialogRpcHandlers(): {
	openFilePicker: RpcHandler<"openFilePicker">;
} {
	return {
		// openFilePicker handler (Electrobun native dialog)
		openFilePicker: async () => {
			try {
				const { homedir } = await import("node:os");
				const paths = await openFileDialog({
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
