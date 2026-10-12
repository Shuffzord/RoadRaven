import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useState } from "react";
import { create } from "zustand";
import {
	commandLine,
	PLUGIN_STEPS,
	type PluginCommandKind,
} from "../../../../../shared/claudePlugin";
import type { McpInstallStep } from "../../../../../shared/types";
import { electroview } from "../rpc";
import {
	dialogButtonRowStyle,
	dialogContentStyle,
	dialogDescriptionStyle,
	dialogHelperTextStyle,
	dialogPrimaryButtonStyle,
	dialogSecondaryButtonStyle,
	dialogTitleStyle,
} from "./dialogStyles";
import { InstallLog } from "./SetupWizard";

/**
 * Plugin install / update dialog (v0.9). One button runs the fixed `claude`
 * commands in Bun (runPluginCommands) and shows each step; on failure it
 * shows the error and the commands to copy. Opened by the version-mismatch
 * toast's "Update now", or once per app version when Claude Code is here
 * without the plugin (Bun decides: getSetupStatus.offerPluginInstall).
 */

export const PLUGIN_DIALOG_COPY: Record<
	PluginCommandKind,
	{ title: string; body: string; button: string }
> = {
	install: {
		title: "Install the RoadRaven plugin for Claude Code",
		body: "Claude Code is on this computer, but the RoadRaven plugin is not. The plugin gives Claude the RoadRaven tools, skills and terminal pane. Install runs the `claude` commands that add it.",
		button: "Install",
	},
	update: {
		title: "Update the RoadRaven plugin",
		body: "Your RoadRaven plugin for Claude Code is a different version from this app. Update runs the `claude` commands that bring it up to date.",
		button: "Update",
	},
};

export const PLUGIN_RESTART_TEXT =
	"Restart Claude Code (or run /reload-plugins) to load it. If the RoadRaven tools don't connect at first, run /mcp and reconnect.";
export const PLUGIN_AUTO_UPDATE_TEXT =
	"To keep it current, switch on auto-update in Claude Code under /plugin → Marketplaces.";
const PLUGIN_FALLBACK_TEXT =
	"That didn't work. Run these in a terminal instead:";

export const usePluginDialogStore = create<{ kind: PluginCommandKind | null }>(
	() => ({ kind: null }),
);

/** Open the dialog for `kind`, or close it with null. */
export function openPluginDialog(kind: PluginCommandKind | null): void {
	usePluginDialogStore.setState({ kind });
}

interface RunResult {
	ok: boolean;
	steps: McpInstallStep[];
}

export function PluginUpdateDialog() {
	const kind = usePluginDialogStore((s) => s.kind);
	const [running, setRunning] = useState(false);
	const [result, setResult] = useState<RunResult | null>(null);

	useEffect(() => {
		electroview?.rpc?.request
			.getSetupStatus({})
			.then((s) => {
				if (s.offerPluginInstall && !usePluginDialogStore.getState().kind)
					openPluginDialog("install");
			})
			.catch(() => {
				// Bun may still be starting; the offer comes back next launch.
			});
	}, []);

	const close = () => {
		if (kind === "install") {
			electroview?.rpc?.request.dismissPluginInstall({}).catch(() => {
				// Best-effort: the offer shows once more next launch.
			});
		}
		setResult(null);
		openPluginDialog(null);
	};

	const run = async (k: PluginCommandKind) => {
		setRunning(true);
		setResult(null);
		try {
			const res = await electroview?.rpc?.request.runPluginCommands({
				kind: k,
			});
			if (res) setResult(res);
		} catch (e) {
			setResult({
				ok: false,
				steps: [
					{
						id: "rpc",
						label: PLUGIN_DIALOG_COPY[k].title,
						status: "error",
						detail: String(e),
						host: "claude",
					},
				],
			});
		} finally {
			setRunning(false);
		}
	};

	return (
		<Dialog.Root
			open={kind !== null}
			onOpenChange={(next) => {
				if (!next && !running) close();
			}}
		>
			<Dialog.Portal>
				<Dialog.Overlay className="fixed inset-0 z-[9999] bg-black/60" />
				{kind && (
					<Dialog.Content style={{ ...dialogContentStyle, width: 480 }}>
						<Dialog.Title style={dialogTitleStyle}>
							{PLUGIN_DIALOG_COPY[kind].title}
						</Dialog.Title>
						<Dialog.Description style={dialogDescriptionStyle}>
							{PLUGIN_DIALOG_COPY[kind].body}
						</Dialog.Description>
						<InstallLog result={result} />
						{result?.ok && (
							<p style={dialogDescriptionStyle}>{PLUGIN_RESTART_TEXT}</p>
						)}
						{result && !result.ok && (
							<>
								<p style={dialogDescriptionStyle}>{PLUGIN_FALLBACK_TEXT}</p>
								<CopyCommand command={commandLine(PLUGIN_STEPS[kind])} />
							</>
						)}
						<p style={dialogHelperTextStyle}>{PLUGIN_AUTO_UPDATE_TEXT}</p>
						<div style={dialogButtonRowStyle}>
							<button
								type="button"
								disabled={running}
								onClick={close}
								style={dialogSecondaryButtonStyle}
							>
								Close
							</button>
							{!result?.ok && (
								<button
									type="button"
									disabled={running}
									onClick={() => void run(kind)}
									style={dialogPrimaryButtonStyle}
								>
									{running ? "Working…" : PLUGIN_DIALOG_COPY[kind].button}
								</button>
							)}
						</div>
					</Dialog.Content>
				)}
			</Dialog.Portal>
		</Dialog.Root>
	);
}

/**
 * Monospace command with a Copy button — same navigator.clipboard path and
 * "Copied ✓" feedback as the Event API URL copy buttons. Also used by the
 * version-mismatch toast.
 */
export function CopyCommand({ command }: { command: string }) {
	const [copied, setCopied] = useState(false);
	return (
		<div
			style={{
				display: "flex",
				alignItems: "flex-start",
				gap: 6,
				marginTop: 6,
			}}
		>
			<code
				style={{
					flex: 1,
					fontFamily: "ui-monospace, monospace",
					fontSize: 11,
					color: "var(--rv-text-secondary)",
					// Commands come one per line (commandLine).
					whiteSpace: "pre-wrap",
					wordBreak: "break-all",
				}}
			>
				{command}
			</code>
			<button
				type="button"
				onClick={() => {
					navigator.clipboard.writeText(command).then(
						() => {
							setCopied(true);
							setTimeout(() => setCopied(false), 1200);
						},
						() => {
							/* clipboard denied — silent */
						},
					);
				}}
				style={{
					background: "none",
					border: "none",
					cursor: "pointer",
					color: copied ? "var(--rv-status-completed)" : "var(--rv-accent)",
					fontSize: 11,
					padding: "0 2px",
					flexShrink: 0,
				}}
			>
				{copied ? "Copied ✓" : "Copy"}
			</button>
		</div>
	);
}
