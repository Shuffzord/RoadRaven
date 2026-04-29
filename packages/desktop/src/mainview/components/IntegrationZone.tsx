import { useMemo, useState } from "react";
import { useEventLogStore } from "../store/eventLogStore";
import { useIsNodeLive, useRoadmapStore } from "../store/roadmapStore";

interface Props {
	nodeId: string | null;
}

/**
 * Format a past timestamp as a human-readable relative string.
 * Per UI-SPEC §"SidePanel Integration zone" copy contract:
 *   < 60s  → "just now"
 *   < 60m  → "Xm ago"
 *   < 24h  → "Xh ago"
 *   ≥ 24h  → "Xd ago"
 */
function formatRelative(lastEventAt: number): string {
	const diff = Date.now() - lastEventAt;
	if (diff < 60_000) return "just now";
	if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
	if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
	return `${Math.floor(diff / 86_400_000)}d ago`;
}

/**
 * IntegrationZone — SidePanel section showing live event state for the
 * selected node (D-16, PLUG-05). Inserted between metadata and notes.
 *
 * Mini-history rows come from eventLogStore (Plan 04-04).
 * Until Plan 04-04 ships, recent is [] and the disclosure is hidden.
 */
export function IntegrationZone({ nodeId }: Props) {
	const meta = useRoadmapStore((s) =>
		nodeId ? s.liveEventMeta[nodeId] : undefined,
	);
	const isLive = useIsNodeLive(nodeId ?? "");

	// Mini-history: last 5 events for this node from eventLogStore (I-17, Plan 04-04).
	// Select the raw rows array (stable ref — changes only on appendEvents) then
	// derive the filtered slice via useMemo to avoid creating a new array on every
	// selector call (which would trigger "getSnapshot should be cached" infinite loop).
	const allRows = useEventLogStore((s) => s.rows);
	const recent = useMemo(
		() =>
			nodeId
				? allRows
						.filter((r) => r.nodeId === nodeId)
						.slice(-5)
						.reverse()
				: [],
		[allRows, nodeId],
	);

	const [historyOpen, setHistoryOpen] = useState(false);
	const [copied, setCopied] = useState(false);

	return (
		<section className="integration-zone" style={{ marginBottom: 16 }}>
			<div
				style={{
					fontSize: 11,
					fontWeight: 600,
					textTransform: "uppercase",
					letterSpacing: "0.05em",
					color: "var(--rv-text-tertiary)",
					marginBottom: 8,
				}}
			>
				Integration
			</div>

			{/* Header line state machine (D-16) */}
			{meta === undefined && (
				<div
					className="integration-empty"
					style={{ fontSize: 13, color: "var(--rv-text-tertiary)" }}
				>
					— No events received
				</div>
			)}
			{meta !== undefined && isLive && (
				<div
					className="integration-live"
					style={{
						fontSize: 13,
						fontWeight: 600,
						color: "var(--rv-status-completed)",
						marginBottom: 8,
					}}
				>
					● Live
				</div>
			)}
			{meta !== undefined && !isLive && (
				<div
					className="integration-history"
					style={{
						fontSize: 13,
						color: "var(--rv-text-tertiary)",
						marginBottom: 8,
					}}
				>
					○ Last event {formatRelative(meta.lastEventAt)}
				</div>
			)}

			{meta !== undefined && (
				<>
					{/* Source row */}
					<div
						className="integration-source-row"
						style={{
							display: "flex",
							alignItems: "center",
							gap: 6,
							marginBottom: 8,
							fontSize: 12,
						}}
					>
						<span
							style={{ color: "var(--rv-text-tertiary)" }}
							className="integration-label"
						>
							Source
						</span>
						<span
							style={{ color: "var(--rv-text-secondary)" }}
							className="integration-value"
						>
							{meta.source ?? "—"}
						</span>
						{meta.source && (
							<button
								type="button"
								onClick={() => {
									if (!meta.source) return;
									navigator.clipboard.writeText(meta.source).then(
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
									color: "var(--rv-accent)",
									fontSize: 11,
									padding: "0 2px",
								}}
							>
								{copied ? "Copied ✓" : "Copy"}
							</button>
						)}
					</div>

					{/* Meta table */}
					<div
						className="integration-meta-title"
						style={{
							fontSize: 11,
							fontWeight: 600,
							color: "var(--rv-text-tertiary)",
							marginBottom: 4,
						}}
					>
						Last event meta
					</div>
					{(!meta.meta || Object.keys(meta.meta).length === 0) && (
						<div
							className="integration-meta-empty"
							style={{
								fontSize: 12,
								fontStyle: "italic",
								color: "var(--rv-text-tertiary)",
								marginBottom: 8,
							}}
						>
							No meta in last event
						</div>
					)}
					{meta.meta && Object.keys(meta.meta).length > 0 && (
						<table
							className="integration-meta-table"
							style={{
								width: "100%",
								fontSize: 11,
								marginBottom: 8,
								borderCollapse: "collapse",
							}}
						>
							<tbody>
								{Object.entries(meta.meta).map(([k, v]) => (
									<tr key={k}>
										<td
											style={{
												fontFamily: "ui-monospace, monospace",
												color: "var(--rv-text-tertiary)",
												paddingRight: 8,
												verticalAlign: "top",
												whiteSpace: "nowrap",
											}}
										>
											{k}
										</td>
										<td
											style={{
												fontFamily: "ui-monospace, monospace",
												color: "var(--rv-text-secondary)",
												wordBreak: "break-all",
											}}
										>
											{typeof v === "object" ? JSON.stringify(v) : String(v)}
										</td>
									</tr>
								))}
							</tbody>
						</table>
					)}

					{/* Mini-history disclosure — filled by Plan 04-04 */}
					{recent.length > 0 && (
						<div style={{ marginBottom: 8 }}>
							<button
								type="button"
								onClick={() => setHistoryOpen((o) => !o)}
								style={{
									background: "none",
									border: "none",
									cursor: "pointer",
									color: "var(--rv-text-secondary)",
									fontSize: 12,
									padding: 0,
								}}
							>
								{historyOpen ? "▾" : "▸"} Recent events ({recent.length})
							</button>
							{historyOpen && (
								<ul
									style={{ listStyle: "none", margin: "4px 0 0 0", padding: 0 }}
								>
									{recent.slice(0, 5).map((r, i) => (
										<li
											// biome-ignore lint/suspicious/noArrayIndexKey: stable ordered list
											key={i}
											style={{
												fontFamily: "ui-monospace, monospace",
												fontSize: 11,
												color: "var(--rv-text-tertiary)",
												padding: "2px 0",
											}}
										>
											{r.timestamp
												? new Date(r.timestamp).toLocaleTimeString()
												: "—"}{" "}
											{r.status} {r.source ?? "—"}
										</li>
									))}
								</ul>
							)}
						</div>
					)}

					{/* Open full log button — Plan 04-04 wires setOpen + setFilterSelectedNodeOnly */}
					<button
						type="button"
						style={{
							background: "none",
							border: "none",
							cursor: "pointer",
							color: "var(--rv-accent)",
							fontSize: 12,
							padding: 0,
						}}
						onClick={() => {
							const store = useEventLogStore.getState();
							store.setOpen(true);
							store.setFilterSelectedNodeOnly(true);
						}}
					>
						Open full log →
					</button>
				</>
			)}
		</section>
	);
}
