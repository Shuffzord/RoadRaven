import { useState } from "react";
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

	// NOTE: recentEvents hook lands in Plan 04-04 via eventLogStore; returns []
	// when unwired. Plan 04-04 will replace this stub with useRecentEventsForNode.
	const recent: Array<{ t: string; status: string; source?: string }> = []; // Plan 04-04 fills this

	const [historyOpen, setHistoryOpen] = useState(false);

	return (
		<section
			className="integration-zone"
			style={{ marginBottom: 16 }}
		>
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
					style={{ fontSize: 13, color: "var(--rv-text-tertiary)", marginBottom: 8 }}
				>
					○ Last event {formatRelative(meta.lastEventAt)}
				</div>
			)}

			{meta !== undefined && (
				<>
					{/* Source row */}
					<div
						className="integration-source-row"
						style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, fontSize: 12 }}
					>
						<span style={{ color: "var(--rv-text-tertiary)" }} className="integration-label">Source</span>
						<span style={{ color: "var(--rv-text-secondary)" }} className="integration-value">
							{meta.source ?? "—"}
						</span>
						{meta.source && (
							<button
								type="button"
								onClick={() => {
									if (meta.source) navigator.clipboard.writeText(meta.source);
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
								Copy
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
							style={{ fontSize: 12, fontStyle: "italic", color: "var(--rv-text-tertiary)", marginBottom: 8 }}
						>
							No meta in last event
						</div>
					)}
					{meta.meta && Object.keys(meta.meta).length > 0 && (
						<table
							className="integration-meta-table"
							style={{ width: "100%", fontSize: 11, marginBottom: 8, borderCollapse: "collapse" }}
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
								<ul style={{ listStyle: "none", margin: "4px 0 0 0", padding: 0 }}>
									{recent.slice(0, 5).map((r, i) => (
										<li
											// biome-ignore lint/suspicious/noArrayIndexKey: stable ordered list
											key={i}
											style={{ fontFamily: "ui-monospace, monospace", fontSize: 11, color: "var(--rv-text-tertiary)", padding: "2px 0" }}
										>
											{new Date(r.t).toLocaleTimeString()} {r.status} {r.source ?? "—"}
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
							/* TODO Plan 04-04: useEventLogStore.getState().setOpen(true) + setFilterSelectedNodeOnly(true) */
						}}
					>
						Open full log →
					</button>
				</>
			)}
		</section>
	);
}
