import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useRef } from "react";
import {
	UPDATE_DIALOG_TITLE_PREFIX,
	UPDATE_DOWNLOAD_LABEL,
	UPDATE_LATER_LABEL,
} from "../lib/domContract";
import { downloadUpdate, pullUpdateState } from "../lib/updateActions";
import { shouldPromptForUpdate, useUpdateStore } from "../store/updateStore";
import {
	dialogButtonRowStyle,
	dialogContentStyle,
	dialogDescriptionStyle,
	dialogPrimaryButtonStyle,
	dialogSecondaryButtonStyle,
	dialogTitleStyle,
} from "./dialogStyles";

/**
 * "Update available" prompt (v0.8.5, D-2): the launch check found a newer
 * version; ask before downloading. Restart stays a separate user choice
 * (Preferences › About, status-bar pill).
 *   - "Download" → start the download; the dialog closes as the state moves
 *     to downloading
 *   - "Later" / Escape / overlay click → no prompt for this version until the
 *     next launch (Preferences still offers it)
 * Initial focus: Download.
 *
 * Also seeds the update store once on mount: the main process's startup push
 * can race bundle load.
 */
export function UpdateAvailableDialog() {
	const state = useUpdateStore((s) => s.state);
	const dismissedVersion = useUpdateStore((s) => s.dismissedVersion);
	const downloadRef = useRef<HTMLButtonElement>(null);
	const open = shouldPromptForUpdate(state, dismissedVersion);
	const version = state.status === "available" ? state.version : "";

	useEffect(() => {
		void pullUpdateState();
	}, []);

	const later = (): void => useUpdateStore.getState().dismiss(version);

	return (
		<Dialog.Root
			open={open}
			onOpenChange={(next) => {
				if (!next) later();
			}}
		>
			<Dialog.Portal>
				<Dialog.Overlay className="fixed inset-0 z-[9999] bg-black/60" />
				<Dialog.Content
					aria-modal="true"
					style={dialogContentStyle}
					onOpenAutoFocus={(e) => {
						e.preventDefault();
						downloadRef.current?.focus();
					}}
				>
					<Dialog.Title style={dialogTitleStyle}>
						{`${UPDATE_DIALOG_TITLE_PREFIX} ${version} is available`}
					</Dialog.Title>
					<Dialog.Description style={dialogDescriptionStyle}>
						It will be downloaded now and installed when you choose to restart.
					</Dialog.Description>
					<div style={dialogButtonRowStyle}>
						<button
							type="button"
							onClick={later}
							style={dialogSecondaryButtonStyle}
						>
							{UPDATE_LATER_LABEL}
						</button>
						<button
							ref={downloadRef}
							type="button"
							onClick={() => void downloadUpdate()}
							style={dialogPrimaryButtonStyle}
						>
							{UPDATE_DOWNLOAD_LABEL}
						</button>
					</div>
				</Dialog.Content>
			</Dialog.Portal>
		</Dialog.Root>
	);
}
