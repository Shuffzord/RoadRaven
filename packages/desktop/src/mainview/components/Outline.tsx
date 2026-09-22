import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RoadmapNode } from "../../../../../packages/core/src/schema";
import { requestNodeFocus } from "../lib/focusRequest";
import { useRoadmapStore } from "../store/roadmapStore";
import { STATUS_TOKEN_MAP } from "./RoadmapNode";

/**
 * Sidebar Navigator (v0.8.2 Phase 3b): a flat, indented outline of the open
 * roadmap. Row click selects the node and asks the canvas to reveal it via
 * the same focus request the event log uses. Expand/collapse here is local
 * UI state and is independent of the canvas's own collapse (D-2).
 */

export interface OutlineRowData {
	node: RoadmapNode;
	depth: number;
}

/** Pre-order DFS over every root, pruning subtrees listed in `collapsedIds`. */
export function flattenOutline(
	nodes: RoadmapNode[],
	collapsedIds: ReadonlySet<string>,
	depth = 0,
): OutlineRowData[] {
	const out: OutlineRowData[] = [];
	for (const node of nodes) {
		out.push({ node, depth });
		if (node.children?.length && !collapsedIds.has(node.id)) {
			out.push(...flattenOutline(node.children, collapsedIds, depth + 1));
		}
	}
	return out;
}

const FALLBACK_DOT_TOKEN = "--rv-text-tertiary";

export function Outline({ collapsed }: { collapsed: boolean }) {
	// `schema.nodes` identity changes only on structural edits (dataKey), not
	// on status ticks, so the row list is rebuilt only when the tree changes.
	const nodes = useRoadmapStore((s) => s.schema?.nodes ?? null);
	const selectedNodeId = useRoadmapStore((s) => s.selectedNodeId);
	const [collapsedIds, setCollapsedIds] = useState<ReadonlySet<string>>(
		() => new Set(),
	);

	const rows = useMemo(
		() => (nodes ? flattenOutline(nodes, collapsedIds) : []),
		[nodes, collapsedIds],
	);

	const toggle = useCallback((id: string) => {
		setCollapsedIds((prev) => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	}, []);

	if (collapsed) return null;
	if (!nodes) {
		return (
			<div className="text-[12px] text-rv-text-tertiary px-3.5 py-[5px]">
				No roadmap open
			</div>
		);
	}

	return (
		<div
			role="tree"
			aria-label="Roadmap outline"
			data-outline-tree
			className="flex-1 min-h-0 overflow-y-auto"
		>
			{rows.map(({ node, depth }) => (
				<OutlineRow
					key={node.id}
					node={node}
					depth={depth}
					isSelected={node.id === selectedNodeId}
					hasChildren={!!node.children?.length}
					isCollapsed={collapsedIds.has(node.id)}
					onToggle={toggle}
				/>
			))}
		</div>
	);
}

interface OutlineRowProps {
	node: RoadmapNode;
	depth: number;
	isSelected: boolean;
	hasChildren: boolean;
	isCollapsed: boolean;
	onToggle: (id: string) => void;
}

const OutlineRow = memo(function OutlineRow({
	node,
	depth,
	isSelected,
	hasChildren,
	isCollapsed,
	onToggle,
}: OutlineRowProps) {
	// Status edits mutate the node in place and bump statusTick (D-02); this
	// selector returns a primitive, so only the row whose status changed
	// re-renders.
	const status = useRoadmapStore(
		(s) => s.nodeIndex.get(node.id)?.status ?? node.status,
	);
	const dotToken = STATUS_TOKEN_MAP[status]?.color ?? FALLBACK_DOT_TOKEN;
	const rowRef = useRef<HTMLButtonElement>(null);

	useEffect(() => {
		if (isSelected) rowRef.current?.scrollIntoView({ block: "nearest" });
	}, [isSelected]);

	return (
		<button
			ref={rowRef}
			type="button"
			role="treeitem"
			aria-selected={isSelected}
			aria-expanded={hasChildren ? !isCollapsed : undefined}
			aria-level={depth + 1}
			title={node.title}
			className={`flex items-center w-full gap-1.5 pr-2 py-[5px] text-[12px] text-left transition-colors duration-150 ${
				isSelected
					? "bg-rv-bg-hover text-rv-text-primary"
					: "text-rv-text-secondary hover:bg-rv-bg-hover hover:text-rv-text-primary"
			}`}
			style={{ paddingLeft: 14 + depth * 12 }}
			onClick={(e) => {
				// The chevron is a plain span inside the row button (a nested
				// <button> is invalid HTML), so the row handler tells the two
				// apart: a chevron click only toggles, it never selects.
				if ((e.target as Element).closest("[data-outline-chevron]")) {
					onToggle(node.id);
					return;
				}
				requestNodeFocus(node.id, { align: "center", select: true });
			}}
		>
			{hasChildren ? (
				<span
					data-outline-chevron
					className="flex items-center justify-center w-[14px] h-[14px] shrink-0 text-rv-text-tertiary"
				>
					<svg
						aria-hidden="true"
						width="10"
						height="10"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="2"
						strokeLinecap="round"
						strokeLinejoin="round"
						className={`transition-transform duration-150 ${isCollapsed ? "" : "rotate-90"}`}
					>
						<polyline points="9 18 15 12 9 6" />
					</svg>
				</span>
			) : (
				<span className="w-[14px] shrink-0" />
			)}
			<span
				aria-hidden="true"
				className="w-[7px] h-[7px] rounded-full shrink-0"
				style={{ backgroundColor: `var(${dotToken})` }}
			/>
			<span className="truncate">{node.title}</span>
		</button>
	);
});
