import type { StatusConfig } from "../../../../../packages/core/src/schema";
import { getDistinctSources, useEventLogStore } from "../store/eventLogStore";
import { useRoadmapStore } from "../store/roadmapStore";
import { MenuSelect } from "./MenuSelect";

// Stable empty fallback — prevents Zustand's useSyncExternalStore from
// returning a new [] reference on every render when schema is null
// (which would trigger the "snapshot should be cached" infinite-loop warning).
const EMPTY_STATUS_CONFIG: StatusConfig[] = [];

export function EventLogFilterBar() {
	const rows = useEventLogStore((s) => s.rows);
	const filter = useEventLogStore((s) => s.filter);
	const selectedNodeId = useRoadmapStore((s) => s.selectedNodeId);
	const statusConfig = useRoadmapStore(
		(s) => s.schema?.statusConfig ?? EMPTY_STATUS_CONFIG,
	);

	const sources = getDistinctSources(rows);
	const hasActive =
		filter.source !== null || filter.selectedNodeOnly || filter.status !== null;

	return (
		<div
			style={{
				display: "flex",
				alignItems: "center",
				gap: 12,
				padding: "4px 12px",
				borderBottom: "1px solid var(--rv-border-subtle)",
				flexShrink: 0,
				flexWrap: "wrap",
			}}
		>
			{/* Filter label */}
			<span
				style={{
					fontSize: 11,
					color: "var(--rv-text-tertiary)",
					flexShrink: 0,
				}}
			>
				Filter
			</span>

			{/* Source dropdown */}
			<MenuSelect
				label="Source filter"
				value={filter.source ?? ""}
				options={[
					{ value: "", label: "All sources" },
					...sources.map((x) => ({ value: x, label: x })),
				]}
				onChange={(v) =>
					useEventLogStore.getState().setFilterSource(v === "" ? null : v)
				}
				style={{
					fontSize: 12,
					background: "var(--rv-bg-input)",
					border: "1px solid var(--rv-border)",
					borderRadius: 4,
					color:
						filter.source !== null
							? "var(--rv-text-primary)"
							: "var(--rv-text-secondary)",
					padding: "2px 4px",
				}}
			/>

			{/* Selected node toggle */}
			<button
				type="button"
				disabled={selectedNodeId === null}
				title={selectedNodeId === null ? "Select a node first" : undefined}
				onClick={() => {
					if (selectedNodeId === null) return;
					useEventLogStore
						.getState()
						.setFilterSelectedNodeOnly(!filter.selectedNodeOnly);
				}}
				style={{
					background: "none",
					border: "none",
					cursor: selectedNodeId === null ? "default" : "pointer",
					fontSize: 12,
					color:
						selectedNodeId === null
							? "var(--rv-text-tertiary)"
							: filter.selectedNodeOnly
								? "var(--rv-text-primary)"
								: "var(--rv-text-secondary)",
					padding: "2px 0",
					display: "flex",
					alignItems: "center",
					gap: 4,
				}}
				aria-pressed={filter.selectedNodeOnly}
				aria-label="Selected node only"
			>
				{filter.selectedNodeOnly ? "☑" : "☐"} Selected node only
			</button>

			{/* Status dropdown */}
			<MenuSelect
				label="Status filter"
				value={filter.status ?? ""}
				options={[
					{ value: "", label: "All statuses" },
					...statusConfig.map((sc) => ({ value: sc.id, label: sc.id })),
				]}
				onChange={(v) =>
					useEventLogStore.getState().setFilterStatus(v === "" ? null : v)
				}
				style={{
					fontSize: 12,
					background: "var(--rv-bg-input)",
					border: "1px solid var(--rv-border)",
					borderRadius: 4,
					color:
						filter.status !== null
							? "var(--rv-text-primary)"
							: "var(--rv-text-secondary)",
					padding: "2px 4px",
				}}
			/>

			{/* Clear button — visible only when any filter active */}
			{hasActive && (
				<button
					type="button"
					onClick={() => useEventLogStore.getState().clearFilters()}
					style={{
						background: "none",
						border: "none",
						cursor: "pointer",
						fontSize: 11,
						color: "var(--rv-accent)",
						padding: "2px 0",
					}}
				>
					Clear
				</button>
			)}
		</div>
	);
}
