import type { ActiveToast, ToastType } from "../store/toastStore";

interface Props {
	toast: ActiveToast;
	onDismiss: () => void;
}

/**
 * Build single-event headline string per D-23 exact copy strings.
 */
function renderSingleHeadline(
	type: ToastType,
	source: string,
	detail?: string,
): string {
	switch (type) {
		case "malformed":
			return `Invalid event from ${source}.`;
		case "unknown_node":
			return `Event for unknown node from ${source}.`;
		case "invalid_status":
			return `Unknown status '${detail ?? "?"}' from ${source}.`;
		case "disconnect":
			return `Producer ${source} disconnected.`;
	}
}

/**
 * Build single-event body string per D-23. Returns null for disconnect (no body).
 */
function renderSingleBody(type: ToastType): string | null {
	switch (type) {
		case "malformed":
			return "See event log for details.";
		case "unknown_node":
			return "Node id not found in the current roadmap.";
		case "invalid_status":
			return "Extend statusConfig in the schema to accept this status.";
		case "disconnect":
			return null;
	}
}

/**
 * Build merged-count headline per D-24. Disconnect merges are rare but covered
 * to satisfy TypeScript's exhaustive switch; no console.* per user CLAUDE.md (I-19).
 */
function renderMergedHeadline(
	type: ToastType,
	source: string,
	count: number,
): string {
	switch (type) {
		case "malformed":
			return `${count} invalid events from ${source}.`;
		case "unknown_node":
			return `${count} events for unknown nodes from ${source}.`;
		case "invalid_status":
			return `${count} events with unknown status from ${source}.`;
		case "disconnect":
			// D-23 says disconnects fire once per disconnect; this branch is
			// defensive — no console.* per user CLAUDE.md / I-19.
			return `Producer disconnect events (×${count}) from ${source}.`;
	}
}

/**
 * Build merged-count body per D-24.
 */
function renderMergedBody(type: ToastType): string | null {
	if (type === "disconnect") return null;
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
