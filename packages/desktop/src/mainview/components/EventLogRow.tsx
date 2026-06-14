import { memo } from "react";
import type { EventLogRow as EventLogRowType } from "../store/eventLogStore";
import { formatStatus, STATUS_TOKEN_MAP } from "./RoadmapNode";

interface Props {
	row: EventLogRowType;
	isSelected: boolean;
	expanded: boolean;
	onClick: () => void;
	onToggleExpand: () => void;
}

/** Format a past timestamp as a short relative string (e.g. "3s ago"). */
function formatRelativeShort(timestamp: string | undefined): string {
	if (!timestamp) return "—";
	const diff = Date.now() - new Date(timestamp).getTime();
	if (diff < 1_000) return "just now";
	if (diff < 60_000) return `${Math.floor(diff / 1_000)}s ago`;
	if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
	if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
	return `${Math.floor(diff / 86_400_000)}d ago`;
}

/** Get status badge color token pair — neutral fallback for unknown/error cases. */
function getStatusTokens(
	status: string,
	error: string | undefined,
): { color: string; bg: string } {
	if (error === "unknown_node") {
		return {
			color: "--rv-text-tertiary",
			bg: "--rv-bg-elevated",
		};
	}
	const known = STATUS_TOKEN_MAP[status as keyof typeof STATUS_TOKEN_MAP];
	if (known) return known;
	return { color: "--rv-text-secondary", bg: "--rv-bg-elevated" };
}

function StatusBadge({ status, error }: { status: string; error?: string }) {
	const tokens = getStatusTokens(status, error);
	const label =
		error === "unknown_node"
			? "unknown"
			: error === "invalid_status"
				? status
				: formatStatus(status);
	const labelColor =
		error === "invalid_status"
			? "var(--rv-status-blocked)"
			: `var(${tokens.color})`;

	return (
		<span
			style={{
				display: "inline-flex",
				alignItems: "center",
				gap: 3,
				padding: "1px 6px",
				borderRadius: 10,
				fontSize: 10,
				fontWeight: 600,
				background: `var(${tokens.bg})`,
				color: labelColor,
				maxWidth: 80,
				overflow: "hidden",
				textOverflow: "ellipsis",
				whiteSpace: "nowrap",
			}}
		>
			<span
				style={{
					width: 5,
					height: 5,
					borderRadius: "50%",
					background: labelColor,
					flexShrink: 0,
				}}
			/>
			{label}
		</span>
	);
}

function MetaPreview({ meta }: { meta?: Record<string, unknown> }) {
	if (!meta) return <span style={{ color: "var(--rv-text-tertiary)" }}>—</span>;
	const entries = Object.entries(meta).slice(0, 2);
	if (entries.length === 0)
		return <span style={{ color: "var(--rv-text-tertiary)" }}>—</span>;
	const preview = entries
		.map(([k, v]) => {
			const val = String(typeof v === "object" ? JSON.stringify(v) : v);
			return `${k}=${val.length > 30 ? `${val.slice(0, 30)}…` : val}`;
		})
		.join(", ");
	const full = preview.length > 60 ? `${preview.slice(0, 60)}…` : preview;
	return (
		<span
			style={{
				fontFamily: "ui-monospace, monospace",
				fontSize: 10,
				color: "var(--rv-text-secondary)",
			}}
		>
			{full}
		</span>
	);
}

export const EventLogRow = memo(function EventLogRow({
	row,
	isSelected,
	expanded,
	onClick,
	onToggleExpand,
}: Props) {
	const hasError = Boolean(row._error);
	const nodeIdShort =
		row.nodeId.length > 8 ? `${row.nodeId.slice(0, 8)}…` : row.nodeId;

	return (
		<div>
			{/* Main row — <button> for keyboard accessibility; styled as a row. */}
			<li
				style={{
					display: "flex",
					alignItems: "center",
					height: 32,
					paddingLeft: hasError ? 8 : 12,
					paddingRight: 12,
					cursor: "pointer",
					background: isSelected
						? "var(--rv-accent-muted)"
						: "var(--rv-bg-panel)",
					borderLeft: hasError
						? "4px solid var(--rv-status-blocked)"
						: isSelected
							? "2px solid var(--rv-accent)"
							: "none",
					boxSizing: "border-box",
					listStyle: "none",
					margin: 0,
				}}
				onClick={onClick}
				onDoubleClick={onToggleExpand}
				onKeyDown={(e) => {
					if (e.key === "Enter" || e.key === " ") {
						e.preventDefault();
						onClick();
					}
				}}
			>
				{/* Timestamp */}
				<span
					title={row.timestamp ?? ""}
					style={{
						width: 72,
						flexShrink: 0,
						fontSize: 10,
						color: "var(--rv-text-tertiary)",
						fontVariantNumeric: "tabular-nums",
						overflow: "hidden",
						textOverflow: "ellipsis",
						whiteSpace: "nowrap",
					}}
				>
					{formatRelativeShort(row.timestamp)}
				</span>

				{/* nodeId */}
				<span
					title={row.nodeId}
					style={{
						width: 88,
						flexShrink: 0,
						fontSize: 10,
						fontFamily: "ui-monospace, monospace",
						color: hasError
							? "var(--rv-status-blocked)"
							: "var(--rv-text-primary)",
						overflow: "hidden",
						textOverflow: "ellipsis",
						whiteSpace: "nowrap",
					}}
				>
					{nodeIdShort}
				</span>

				{/* Status badge */}
				<span
					style={{
						width: 84,
						flexShrink: 0,
						overflow: "hidden",
					}}
				>
					<StatusBadge status={row.status} error={row._error} />
				</span>

				{/* Source */}
				<span
					style={{
						width: 96,
						flexShrink: 0,
						fontSize: 10,
						color: "var(--rv-text-secondary)",
						overflow: "hidden",
						textOverflow: "ellipsis",
						whiteSpace: "nowrap",
					}}
				>
					{row.source ?? "—"}
				</span>

				{/* Meta preview */}
				<span
					style={{
						flex: 1,
						overflow: "hidden",
						textOverflow: "ellipsis",
						whiteSpace: "nowrap",
						minWidth: 0,
					}}
				>
					<MetaPreview meta={row.meta} />
				</span>

				{/* Expand chevron */}
				<button
					type="button"
					onClick={(e) => {
						e.stopPropagation();
						onToggleExpand();
					}}
					style={{
						width: 16,
						flexShrink: 0,
						fontSize: 10,
						color: "var(--rv-text-tertiary)",
						background: "none",
						border: "none",
						cursor: "pointer",
						padding: 0,
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
					}}
					aria-label={expanded ? "Collapse row" : "Expand row"}
				>
					{expanded ? "▾" : "▸"}
				</button>
			</li>

			{/* Expanded JSON block */}
			{expanded && (
				<div
					style={{
						paddingLeft: 12,
						paddingRight: 12,
						paddingTop: 4,
						paddingBottom: 4,
						background: "var(--rv-bg-elevated)",
						fontFamily: "ui-monospace, monospace",
						fontSize: 11,
						color: "var(--rv-text-secondary)",
						whiteSpace: "pre-wrap",
						wordBreak: "break-all",
					}}
				>
					{JSON.stringify(row.meta ?? {}, null, 2)}
				</div>
			)}
		</div>
	);
});
