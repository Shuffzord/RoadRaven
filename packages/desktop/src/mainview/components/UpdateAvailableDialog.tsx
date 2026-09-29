import * as Dialog from "@radix-ui/react-dialog";
import { type CSSProperties, useEffect, useRef } from "react";
import type { UpdateState } from "../../../../../shared/types";
import {
	UPDATE_CLOSE_LABEL,
	UPDATE_DIALOG_TITLE_PREFIX,
	UPDATE_DOWNLOAD_LABEL,
	UPDATE_HIDE_LABEL,
	UPDATE_LATER_LABEL,
	UPDATE_PROGRESS_TESTID,
	UPDATE_RESTART_LABEL,
} from "../lib/domContract";
import {
	downloadUpdate,
	pullUpdateState,
	restartToUpdate,
} from "../lib/updateActions";
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
 * Update card (v0.8.7; was the v0.8.5 "update available" prompt, D-2): one
 * non-modal card above the status bar that follows an update from the prompt
 * to the restart, so clicking Download no longer makes the prompt vanish
 * without a trace.
 *   - available   → "Download" / "Later"
 *   - downloading → progress bar and "Hide" (the status-bar pill carries on)
 *   - ready       → "Restart to update" / "Later"
 *   - error       → the message and "Close" — only for a version this card
 *                   showed; a failed launch check stays in Preferences
 * Later / Hide / Close / Escape dismiss the version for this launch;
 * Preferences › About and the pill still offer every action.
 *
 * Also seeds the update store once on mount: the main process's startup push
 * can race bundle load.
 */

const cardStyle: CSSProperties = {
	...dialogContentStyle,
	top: "auto",
	left: "auto",
	transform: "none",
	right: 16,
	bottom: 44,
	width: 360,
};

function versionOf(state: UpdateState): string | null {
	return state.status === "available" ||
		state.status === "downloading" ||
		state.status === "ready"
		? state.version
		: null;
}

function cardCopy(
	state: UpdateState,
	version: string | null,
): { title: string; description: string } {
	switch (state.status) {
		case "downloading":
			return {
				title: `Downloading ${UPDATE_DIALOG_TITLE_PREFIX} ${version}…`,
				description:
					state.progress > 0
						? `${Math.round(state.progress)} % downloaded.`
						: "Preparing the download…",
			};
		case "ready":
			return {
				title: `${UPDATE_DIALOG_TITLE_PREFIX} ${version} is ready`,
				description: "Restart to install it. Your work is saved first.",
			};
		case "error":
			return { title: "Update failed", description: state.message };
		default:
			return {
				title: `${UPDATE_DIALOG_TITLE_PREFIX} ${version} is available`,
				description:
					"It will be downloaded now and installed when you choose to restart.",
			};
	}
}

function dismissLabel(status: UpdateState["status"]): string {
	if (status === "downloading") return UPDATE_HIDE_LABEL;
	if (status === "error") return UPDATE_CLOSE_LABEL;
	return UPDATE_LATER_LABEL;
}

/** The one primary action for a phase (none while downloading or failed). */
function primaryAction(
	status: UpdateState["status"],
): { label: string; run: () => Promise<unknown> } | null {
	if (status === "available")
		return { label: UPDATE_DOWNLOAD_LABEL, run: downloadUpdate };
	if (status === "ready")
		return { label: UPDATE_RESTART_LABEL, run: restartToUpdate };
	return null;
}

/** Indeterminate until the first progress entry: the delta-patch path reports no bytes. */
function DownloadProgress({ progress }: { progress: number }) {
	const known = progress > 0;
	return (
		<div
			role="progressbar"
			aria-label="Download progress"
			aria-valuemin={0}
			aria-valuemax={100}
			aria-valuenow={known ? Math.round(progress) : undefined}
			data-testid={UPDATE_PROGRESS_TESTID}
			style={{
				height: 6,
				marginTop: 12,
				borderRadius: 3,
				background: "var(--rv-bg-hover)",
				overflow: "hidden",
			}}
		>
			<div
				style={{
					height: "100%",
					width: `${known ? progress : 100}%`,
					background: "var(--rv-accent)",
					opacity: known ? 1 : 0.3,
					transition: "width 200ms",
				}}
			/>
		</div>
	);
}

export function UpdateAvailableDialog() {
	const state = useUpdateStore((s) => s.state);
	const dismissedVersion = useUpdateStore((s) => s.dismissedVersion);
	const primaryRef = useRef<HTMLButtonElement>(null);
	// The version this card last showed: a download or restart error for it
	// is shown here; an error from the launch check is not.
	const shownVersionRef = useRef<string | null>(null);
	const shown = versionOf(state);
	const version = shown ?? shownVersionRef.current;
	const open =
		shouldPromptForUpdate(state, dismissedVersion) ||
		(state.status === "error" &&
			version !== null &&
			version !== dismissedVersion);
	const primary = primaryAction(state.status);
	const { title, description } = cardCopy(state, version);

	useEffect(() => {
		void pullUpdateState();
	}, []);
	useEffect(() => {
		if (shown !== null) shownVersionRef.current = shown;
	}, [shown]);
	// Download unmounts its button; give the restart offer the focus back.
	useEffect(() => {
		if (open && state.status === "ready") primaryRef.current?.focus();
	}, [open, state.status]);

	const dismiss = (): void => {
		if (version !== null) useUpdateStore.getState().dismiss(version);
	};

	return (
		<Dialog.Root
			open={open}
			modal={false}
			onOpenChange={(next) => {
				if (!next) dismiss();
			}}
		>
			<Dialog.Portal>
				<Dialog.Content
					style={cardStyle}
					onOpenAutoFocus={(e) => {
						e.preventDefault();
						primaryRef.current?.focus();
					}}
					onInteractOutside={(e) => e.preventDefault()}
				>
					<Dialog.Title style={dialogTitleStyle}>{title}</Dialog.Title>
					<Dialog.Description style={dialogDescriptionStyle}>
						{description}
					</Dialog.Description>
					{state.status === "downloading" && (
						<DownloadProgress progress={state.progress} />
					)}
					<div style={dialogButtonRowStyle}>
						<button
							type="button"
							onClick={dismiss}
							style={dialogSecondaryButtonStyle}
						>
							{dismissLabel(state.status)}
						</button>
						{primary && (
							<button
								ref={primaryRef}
								type="button"
								onClick={() => void primary.run()}
								style={dialogPrimaryButtonStyle}
							>
								{primary.label}
							</button>
						)}
					</div>
				</Dialog.Content>
			</Dialog.Portal>
		</Dialog.Root>
	);
}
