import { useState } from "react";
import type { MismatchRemedy } from "../../../../../shared/types";
import type { ActiveToast, ToastType } from "../store/toastStore";

interface Props {
	toast: ActiveToast;
	onDismiss: () => void;
}

interface Remedy {
	body: string;
	/** Shown in a monospace line with a Copy button. */
	command?: string;
}

const INSTALLER_BASE_URL =
	"https://raw.githubusercontent.com/Shuffzord/RoadRaven/master";

/** One-line RoadRaven installer for this platform; none exists for macOS. */
function appInstallCommand(): string | undefined {
	const ua = navigator.userAgent;
	if (ua.includes("Windows"))
		return `irm ${INSTALLER_BASE_URL}/install.ps1 | iex`;
	if (ua.includes("Linux"))
		return `curl -fsSL ${INSTALLER_BASE_URL}/install.sh | sh`;
	return undefined;
}

/** v0.8 version-mismatch remedies, keyed by the remedy the Bun process picked. */
const MISMATCH_REMEDY: Record<
	MismatchRemedy,
	(producerVersion: string, appVersion: string) => Remedy
> = {
	"update-app": (producerVersion) => ({
		body: `Update RoadRaven to ${producerVersion}.`,
		command: appInstallCommand(),
	}),
	"restart-agent": () => ({
		body: "RoadRaven updated its MCP server — restart your agent session to load it.",
	}),
	"update-plugin": () => ({
		body: "Update the RoadRaven plugin, then restart Claude Code:",
		command:
			"claude plugin marketplace update roadraven; claude plugin update roadraven@roadraven",
	}),
	"update-npm": (_producerVersion, appVersion) => ({
		body: `Re-register the MCP server at ${appVersion}, then restart your agent:`,
		command: `claude mcp remove roadraven; claude mcp add -s user roadraven -- npx -y @roadraven/mcp@${appVersion}`,
	}),
	reinstall: () => ({
		body: "Re-run the Setup Wizard and install the integration.",
	}),
};

/**
 * Remedy carried in a version_mismatch detail (`<producer>|<app>|<remedy>`),
 * or null for a detail without one (pre-remedy shape).
 */
function renderMismatchRemedy(detail?: string): Remedy | null {
	const [producerVersion = "?", appVersion = "?", remedy = ""] = (
		detail ?? ""
	).split("|");
	if (!Object.hasOwn(MISMATCH_REMEDY, remedy)) return null;
	return MISMATCH_REMEDY[remedy as MismatchRemedy](producerVersion, appVersion);
}

/**
 * Monospace command with a Copy button — same navigator.clipboard path and
 * "Copied ✓" feedback as the Event API URL copy buttons.
 */
function CopyCommand({ command }: { command: string }) {
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

/** D-23 exact single-event headline strings, keyed by toast type. */
const SINGLE_HEADLINE: Record<
	ToastType,
	(source: string, detail?: string) => string
> = {
	malformed: (source) => `Invalid event from ${source}.`,
	unknown_node: (source) => `Event for unknown node from ${source}.`,
	invalid_status: (source, detail) =>
		`Unknown status '${detail ?? "?"}' from ${source}.`,
	disconnect: (source) => `Producer ${source} disconnected.`,
	version_mismatch: (_source, detail) => {
		const [producerVersion, appVersion] = (detail ?? "").split("|");
		return `MCP server version ${producerVersion ?? "?"} does not match RoadRaven ${appVersion ?? "?"}.`;
	},
};

/**
 * Build single-event headline string per D-23 exact copy strings.
 */
function renderSingleHeadline(
	type: ToastType,
	source: string,
	detail?: string,
): string {
	return SINGLE_HEADLINE[type](source, detail);
}

/** D-23 exact single-event body strings, keyed by toast type. null for disconnect (no body). */
const SINGLE_BODY: Record<ToastType, string | null> = {
	malformed: "See event log for details.",
	unknown_node: "Node id not found in the current roadmap.",
	invalid_status: "Extend statusConfig in the schema to accept this status.",
	disconnect: null,
	version_mismatch: "Update the RoadRaven plugin or the app.",
};

/**
 * Build single-event body string per D-23. Returns null for disconnect (no body).
 */
function renderSingleBody(type: ToastType): string | null {
	return SINGLE_BODY[type];
}

/**
 * D-24 exact merged-count headline strings, keyed by toast type. Disconnect
 * merges are rare but covered to satisfy TypeScript's exhaustive Record; no
 * console.* per user CLAUDE.md (I-19).
 */
const MERGED_HEADLINE: Record<
	ToastType,
	(source: string, count: number) => string
> = {
	malformed: (source, count) => `${count} invalid events from ${source}.`,
	unknown_node: (source, count) =>
		`${count} events for unknown nodes from ${source}.`,
	invalid_status: (source, count) =>
		`${count} events with unknown status from ${source}.`,
	// D-23 says disconnects fire once per disconnect; this branch is
	// defensive — no console.* per user CLAUDE.md / I-19.
	disconnect: (source, count) =>
		`Producer disconnect events (×${count}) from ${source}.`,
	version_mismatch: (source, count) =>
		`${count} version mismatches from ${source}.`,
};

/**
 * Build merged-count headline per D-24.
 */
function renderMergedHeadline(
	type: ToastType,
	source: string,
	count: number,
): string {
	return MERGED_HEADLINE[type](source, count);
}

/**
 * Build merged-count body per D-24.
 */
function renderMergedBody(type: ToastType): string | null {
	if (type === "disconnect") return null;
	if (type === "version_mismatch")
		return "Update the RoadRaven plugin or the app.";
	return "See event log for details.";
}

/**
 * EventToast — renders a single error/info toast with exact D-23 copy strings.
 * Body renderers are split per I-05 (renderSingleBody / renderMergedBody).
 * Disconnect toasts use an info stripe (grey); all others use an error stripe (red).
 * No Retry button per D-22.
 */
export function EventToast({ toast, onDismiss }: Props) {
	const isMerged = toast.count > 1;
	const headline = isMerged
		? renderMergedHeadline(toast.type, toast.source, toast.count)
		: renderSingleHeadline(toast.type, toast.source, toast.detail);
	// v0.8: a version_mismatch toast (single or merged) shows the remedy the
	// app picked, from the latest detail.
	const remedy =
		toast.type === "version_mismatch"
			? renderMismatchRemedy(toast.detail)
			: null;
	const body =
		remedy?.body ??
		(isMerged ? renderMergedBody(toast.type) : renderSingleBody(toast.type));
	const isInfo = toast.type === "disconnect";
	const stripe = isInfo
		? "var(--rv-text-tertiary)"
		: "var(--rv-status-blocked)";

	return (
		<div
			role="alert"
			style={{
				position: "relative",
				background: "var(--rv-bg-surface)",
				border: "1px solid var(--rv-border)",
				borderLeft: `4px solid ${stripe}`,
				borderRadius: 8,
				padding: "12px 16px",
				boxShadow: "var(--rv-shadow-config)",
				zIndex: 9000,
				display: "flex",
				alignItems: "flex-start",
				gap: 12,
				minWidth: 280,
				maxWidth: 360,
			}}
		>
			<div style={{ flex: 1 }}>
				<div
					style={{
						fontSize: 12,
						fontWeight: 600,
						color: "var(--rv-text-primary)",
						marginBottom: body ? 4 : 0,
					}}
				>
					{headline}
				</div>
				{body && (
					<div style={{ fontSize: 11, color: "var(--rv-text-tertiary)" }}>
						{body}
					</div>
				)}
				{remedy?.command && <CopyCommand command={remedy.command} />}
			</div>
			<button
				type="button"
				onClick={onDismiss}
				style={{
					background: "none",
					border: "none",
					cursor: "pointer",
					color: "var(--rv-accent)",
					fontSize: 11,
					padding: "0 2px",
					flexShrink: 0,
					alignSelf: "flex-start",
				}}
			>
				Dismiss
			</button>
		</div>
	);
}
