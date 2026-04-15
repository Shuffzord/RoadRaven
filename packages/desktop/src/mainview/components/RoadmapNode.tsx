const STATUS_TOKEN_MAP = {
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

function formatStatus(status: string): string {
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
	hasChildren?: boolean;
	isCollapsed?: boolean;
	childCount?: number;
	onToggle?: () => void;
	onSelect?: () => void;
}

export function RoadmapNodeCard({
	title,
	status,
	nodeId,
	isSelected,
	hasChildren,
	isCollapsed,
	childCount,
	onToggle,
	onSelect,
}: RoadmapNodeCardProps) {
	const tokens = STATUS_TOKEN_MAP[status] ?? STATUS_TOKEN_MAP["not-started"];

	return (
		// biome-ignore lint/a11y/useSemanticElements: node card has internal buttons; cannot be a <button> element
		<div
			className={`node relative min-w-[180px] max-w-[220px] rounded-[var(--node-radius,8px)] border-[length:var(--rv-border-width,1px)] border-[color:var(--rv-border)] bg-[var(--rv-bg-node)] pl-4 pr-3 py-[10px] select-none transition-[box-shadow,border-color,background] duration-150 hover:bg-[var(--rv-bg-node-hover)] group ${isSelected ? "ring-1 ring-[var(--rv-accent)]" : ""}`}
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
			aria-label={nodeId ? `${title} (${nodeId})` : title}
			onClick={onSelect}
			onKeyDown={(e) => {
				if (e.key === "Enter" || e.key === " ") {
					e.preventDefault();
					onSelect?.();
				}
			}}
		>
			{/* Title */}
			<span className="block text-[13px] font-semibold leading-[1.3] text-[var(--rv-text-primary)] mb-[6px]">
				{title}
			</span>

			{/* Badge pill */}
			<span className="inline-flex items-center gap-[5px] px-2 py-[2px] rounded-[10px] text-[11px] font-semibold bg-[var(--badge-bg)] text-[var(--badge-color)]">
				<span className="w-1.5 h-1.5 rounded-full bg-[var(--badge-color)]" />
				{formatStatus(status)}
			</span>

			{/* Collapse/expand chevron */}
			{hasChildren && (
				<button
					className="absolute bottom-1 right-1 flex items-center gap-0.5 px-1.5 py-0.5 rounded-[4px] bg-[var(--rv-bg-elevated)] border border-[var(--rv-border)] text-[var(--rv-text-secondary)] hover:text-[var(--rv-text-primary)] hover:bg-[var(--rv-bg-hover)] transition-colors duration-150"
					type="button"
					aria-label={isCollapsed ? "Expand subtree" : "Collapse subtree"}
					onClick={(e) => {
						e.stopPropagation();
						onToggle?.();
					}}
				>
					<svg
						aria-hidden="true"
						width="10"
						height="10"
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
						<span className="text-[9px] font-semibold">{childCount}</span>
					)}
				</button>
			)}
		</div>
	);
}
