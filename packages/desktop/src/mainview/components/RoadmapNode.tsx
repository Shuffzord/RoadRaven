import { useEffect, useRef } from "react";
import { useRoadmapStore } from "../store/roadmapStore";

export const STATUS_TOKEN_MAP = {
	"not-started": {
		color: "--rv-status-not-started",
		bg: "--rv-status-not-started-bg",
	},
	"in-progress": {
		color: "--rv-status-in-progress",
		bg: "--rv-status-in-progress-bg",
	},
	completed: { color: "--rv-status-completed", bg: "--rv-status-completed-bg" },
	blocked: { color: "--rv-status-blocked", bg: "--rv-status-blocked-bg" },
} as const;

export type NodeStatus = keyof typeof STATUS_TOKEN_MAP;

export function formatStatus(status: string): string {
	return status
		.split("-")
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(" ");
}

interface RoadmapNodeCardProps {
	title: string;
	status: NodeStatus;
	nodeId?: string;
	isSelected?: boolean;
	isFocused?: boolean;
	hasChildren?: boolean;
	isCollapsed?: boolean;
	childCount?: number;
	onToggle?: () => void;
	onSelect?: () => void;
	onDoubleClick?: () => void;
	// Inline rename: when isRenaming is true, the title slot renders an input
	// instead of the span. Card-matched UX (option A from Plan 03-02 UAT) —
	// replaces the previous InlineRenameInput portal overlay.
	isRenaming?: boolean;
	renameValue?: string;
	onRenameChange?: (v: string) => void;
	onRenameCommit?: () => void;
	onRenameCancel?: () => void;
}

export function RoadmapNodeCard({
	title,
	status: propStatus,
	nodeId,
	isSelected,
	isFocused,
	hasChildren,
	isCollapsed,
	childCount,
	onToggle,
	onSelect,
	onDoubleClick,
	isRenaming = false,
	renameValue = "",
	onRenameChange,
	onRenameCommit,
	onRenameCancel,
}: RoadmapNodeCardProps) {
	const renameInputRef = useRef<HTMLInputElement>(null);
	useEffect(() => {
		if (isRenaming) {
			renameInputRef.current?.focus();
			renameInputRef.current?.select();
		}
	}, [isRenaming]);
	// Live-status subscription (read-side of the in-place fast-path).
	//
	// `updateNodeStatus` / `updateNodeType` / `updateNodeMetadata` /
	// `updateNodeNotes` mutate `schema.nodes` in place and bump `statusTick`
	// without touching `treeData` — that's the D-02 performance contract so
	// status flips don't trigger react-d3-tree's deep-clone on every change.
	// The side-effect is that `propStatus` (sourced from the treeData snapshot
	// react-d3-tree passes to renderCustomNodeElement) goes stale. Subscribe
	// to the tick here so every in-place write re-runs this selector and the
	// card re-reads the live value from `nodeIndex`. Only the card whose node
	// actually changed returns a new string, so zustand re-renders it alone —
	// other cards' selectors return the same string and skip the update.
	//
	// Future phases (03-03 SidePanel editor, 04 Event API, v1.1 plugins) can
	// extend this by reading additional in-place fields (title, notes, type,
	// metadata) from the live node rather than introducing new dataKey bumps.
	const liveStatus = useRoadmapStore((s) => {
		void s.statusTick;
		return nodeId
			? (s.nodeIndex.get(nodeId)?.status ?? propStatus)
			: propStatus;
	});
	const status = liveStatus as NodeStatus;
	const tokens = STATUS_TOKEN_MAP[status] ?? STATUS_TOKEN_MAP["not-started"];

	return (
		// biome-ignore lint/a11y/useSemanticElements: node card has internal buttons; cannot be a <button> element
		<div
			className={`node relative min-w-[180px] max-w-[220px] rounded-[var(--node-radius,8px)] border-[length:var(--rv-border-width,1px)] border-[color:var(--rv-border)] bg-[var(--rv-bg-node)] pl-4 pr-3 py-[10px] select-none transition-[box-shadow,border-color,background] duration-150 hover:bg-[var(--rv-bg-node-hover)] group ${isSelected ? "outline outline-2 -outline-offset-1 outline-[var(--rv-accent)]" : ""}`}
			data-source-id={nodeId}
			data-selected={isSelected ? "true" : undefined}
			data-focused={isFocused ? "true" : undefined}
			style={
				{
					boxShadow: "var(--rv-shadow-node)",
					"--node-stripe-color": `var(${tokens.color})`,
					"--badge-color": `var(${tokens.color})`,
					"--badge-bg": `var(${tokens.bg})`,
				} as React.CSSProperties
			}
			role="button"
			tabIndex={0}
			aria-label={title}
			onClick={onSelect}
			onDoubleClick={onDoubleClick}
			onKeyDown={(e) => {
				if (e.key === "Enter" || e.key === " ") {
					e.preventDefault();
					onSelect?.();
				}
			}}
		>
			{/* Title — swaps to an inline input when renaming. The input borrows
			   the span's typography + height so the card doesn't reflow; an
			   accent bottom border is the only visible affordance. */}
			{isRenaming ? (
				<input
					ref={renameInputRef}
					type="text"
					value={renameValue}
					onChange={(e) => onRenameChange?.(e.target.value)}
					onClick={(e) => e.stopPropagation()}
					onDoubleClick={(e) => e.stopPropagation()}
					onMouseDown={(e) => e.stopPropagation()}
					onKeyDown={(e) => {
						e.stopPropagation();
						if (e.key === "Enter") {
							e.preventDefault();
							onRenameCommit?.();
						} else if (e.key === "Escape") {
							e.preventDefault();
							onRenameCancel?.();
						}
					}}
					onBlur={() => onRenameCommit?.()}
					placeholder="Enter title…"
					aria-label="Rename node"
					className="block w-full text-[13px] font-semibold leading-[1.3] text-[var(--rv-text-primary)] mb-[6px] bg-transparent border-0 border-b-2 border-[var(--rv-accent)] outline-none px-0 py-0"
				/>
			) : (
				<span className="block text-[13px] font-semibold leading-[1.3] text-[var(--rv-text-primary)] mb-[6px]">
					{title}
				</span>
			)}

			{/* Badge pill */}
			<span className="inline-flex items-center gap-[5px] px-2 py-[2px] rounded-[10px] text-[11px] font-semibold bg-[var(--badge-bg)] text-[var(--badge-color)]">
				<span className="w-1.5 h-1.5 rounded-full bg-[var(--badge-color)]" />
				{formatStatus(status)}
			</span>

			{/* Collapse/expand chevron */}
			{hasChildren && (
				<button
					className="absolute bottom-1.5 right-1.5 flex items-center gap-1 px-2 py-[3px] rounded-[6px] border transition-colors duration-150"
					type="button"
					aria-label={isCollapsed ? "Expand subtree" : "Collapse subtree"}
					style={{
						backgroundColor: `var(${tokens.bg})`,
						borderColor: `var(${tokens.color})`,
						color: `var(${tokens.color})`,
					}}
					onClick={(e) => {
						e.stopPropagation();
						onToggle?.();
					}}
				>
					<svg
						aria-hidden="true"
						width="12"
						height="12"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="2.5"
						strokeLinecap="round"
						strokeLinejoin="round"
					>
						{isCollapsed ? (
							<polyline points="9 18 15 12 9 6" />
						) : (
							<polyline points="6 9 12 15 18 9" />
						)}
					</svg>
					{childCount !== undefined && childCount > 0 && (
						<span className="text-[11px] font-bold">{childCount}</span>
					)}
				</button>
			)}
		</div>
	);
}
