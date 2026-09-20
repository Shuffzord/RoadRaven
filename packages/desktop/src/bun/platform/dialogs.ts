// Platform seam — see window.ts for the allow-listed-import rationale.
import { Utils } from "electrobun/bun";
import { bunLogger } from "../logging";
import { nativeSaveDialog } from "../saveFileDialog";

export interface OpenFileDialogOptions {
	startingFolder?: string;
	allowedFileTypes?: string;
	canChooseFiles?: boolean;
	canChooseDirectory?: boolean;
	allowsMultipleSelection?: boolean;
}

/** Wraps Utils.openFileDialog — pops the native "open" file picker. */
export async function openFileDialog(
	opts: OpenFileDialogOptions,
): Promise<string[]> {
	return Utils.openFileDialog(opts);
}

export interface SaveDialogFilter {
	name: string;
	extensions: string[];
}

export interface SaveDialogOptions {
	title: string;
	defaultPath?: string;
	defaultName?: string;
	filters: SaveDialogFilter[];
}

/**
 * Pop the native "save as" dialog and return the chosen absolute path, or
 * null if the user cancelled / the dialog failed.
 *
 * The installed Electrobun version (1.16.0) does not expose
 * Utils.saveFileDialog (tracked upstream as blackboardsh/electrobun#233).
 * We probe for it so a future Electrobun release picks up automatically;
 * otherwise fall back to nativeSaveDialog (../saveFileDialog.ts) which
 * shells out to PowerShell / osascript / zenity per platform.
 */
export async function openSaveDialog(
	opts: SaveDialogOptions,
): Promise<string | null> {
	try {
		const utilsWithSave = Utils as unknown as {
			saveFileDialog?: (opts: {
				title: string;
				filters: SaveDialogFilter[];
			}) => Promise<string | null>;
		};
		if (typeof utilsWithSave.saveFileDialog === "function") {
			return await utilsWithSave.saveFileDialog({
				title: opts.title,
				filters: opts.filters,
			});
		}
		return await nativeSaveDialog({
			title: opts.title,
			defaultPath: opts.defaultPath,
			defaultName: opts.defaultName,
			filters: opts.filters,
		});
	} catch (err) {
		bunLogger.error`saveFileAs dialog failed: ${String(err)}`;
		return null;
	}
}
