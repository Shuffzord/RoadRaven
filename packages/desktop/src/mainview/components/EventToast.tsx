import type { ActiveToast, ToastType } from "../store/toastStore";

interface Props {
	toast: ActiveToast;
	onDismiss: () => void;
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
	const body = isMerged
		? renderMergedBody(toast.type)
		: renderSingleBody(toast.type);
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
