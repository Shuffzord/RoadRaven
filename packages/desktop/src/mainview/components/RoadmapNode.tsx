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

type NodeStatus = keyof typeof STATUS_TOKEN_MAP;

function formatStatus(status: string): string {
	return status
		.split("-")
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(" ");
}

export function RoadmapNodeCard({
	title,
	status,
}: {
	title: string;
	status: NodeStatus;
}) {
	const tokens = STATUS_TOKEN_MAP[status];

	return (
		<div
			className="node relative min-w-[180px] max-w-[220px] rounded-[var(--node-radius,8px)] border-[length:var(--rv-border-width,1px)] border-[color:var(--rv-border)] bg-[var(--rv-bg-node)] pl-4 pr-3 py-[10px] select-none transition-[box-shadow,border-color,background] duration-150 hover:bg-[var(--rv-bg-node-hover)] group"
			style={
				{
					boxShadow: "var(--rv-shadow-node)",
					"--node-stripe-color": `var(${tokens.color})`,
					"--badge-color": `var(${tokens.color})`,
					"--badge-bg": `var(${tokens.bg})`,
				} as React.CSSProperties
			}
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
		</div>
	);
}
