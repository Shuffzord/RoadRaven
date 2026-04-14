import { useState } from "react";

export function ConfigPanel() {
	const [open, setOpen] = useState(false);
	const [nodeCorners, setNodeCorners] = useState<"rounded" | "sharp">(
		"rounded",
	);
	const [connector, setConnector] = useState<"curved" | "straight">("curved");
	const [gap, setGap] = useState<"compact" | "default" | "spacious">("default");

	return (
		<>
			{/* Panel */}
			{open && (
				<div
					className="absolute bottom-[60px] right-[16px] w-[260px] bg-rv-bg-config border border-rv-border rounded-[10px] p-4 z-[30]"
					style={{ boxShadow: "var(--rv-shadow-config)" }}
				>
					{/* Title */}
					<div className="flex items-center gap-2 mb-4">
						<svg
							aria-hidden="true"
							width="14"
							height="14"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="2"
							strokeLinecap="round"
							strokeLinejoin="round"
							className="text-rv-text-tertiary"
						>
							<circle cx="12" cy="12" r="3" />
							<path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09" />
						</svg>
						<span className="text-[12px] font-semibold text-rv-text-primary">
							Canvas Options
						</span>
					</div>

					{/* Node Corners */}
					<OptionGroup
						label="Node Corners"
						options={[
							{ value: "rounded", label: "Rounded" },
							{ value: "sharp", label: "Sharp" },
						]}
						active={nodeCorners}
						onChange={(v) => setNodeCorners(v as "rounded" | "sharp")}
					/>

					{/* Connector Style */}
					<OptionGroup
						label="Connectors"
						options={[
							{ value: "curved", label: "Curved" },
							{ value: "straight", label: "Straight" },
						]}
						active={connector}
						onChange={(v) => setConnector(v as "curved" | "straight")}
					/>

					{/* Gap Presets */}
					<div className="mb-2">
						<div className="text-[11px] font-semibold uppercase tracking-[0.04em] text-rv-text-tertiary mb-2">
							Gap
						</div>
						<div className="flex gap-1.5">
							{(["compact", "default", "spacious"] as const).map((g) => (
								<button
									key={g}
									className={`flex-1 text-[11px] font-semibold rounded-[6px] py-1.5 border transition duration-150 ${
										gap === g
											? "bg-rv-accent-muted text-rv-accent border-rv-accent-border"
											: "bg-rv-bg-input text-rv-text-tertiary border-rv-border hover:text-rv-text-secondary"
									}`}
									type="button"
									onClick={() => setGap(g)}
								>
									{g.charAt(0).toUpperCase() + g.slice(1)}
								</button>
							))}
						</div>
					</div>
				</div>
			)}

			{/* Toggle button */}
			<button
				className="absolute bottom-[16px] right-[16px] flex items-center justify-center w-[36px] h-[36px] rounded-lg bg-rv-bg-elevated border border-rv-border text-rv-text-tertiary hover:bg-rv-bg-hover hover:text-rv-text-primary z-[30] transition-all duration-150"
				style={{ boxShadow: "var(--rv-shadow-node)" }}
				type="button"
				onClick={() => setOpen(!open)}
				aria-label="Toggle canvas options"
			>
				<svg
					aria-hidden="true"
					width="16"
					height="16"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					strokeWidth="2"
					strokeLinecap="round"
					strokeLinejoin="round"
				>
					<line x1="4" y1="21" x2="4" y2="14" />
					<line x1="4" y1="10" x2="4" y2="3" />
					<line x1="12" y1="21" x2="12" y2="12" />
					<line x1="12" y1="8" x2="12" y2="3" />
					<line x1="20" y1="21" x2="20" y2="16" />
					<line x1="20" y1="12" x2="20" y2="3" />
					<line x1="1" y1="14" x2="7" y2="14" />
					<line x1="9" y1="8" x2="15" y2="8" />
					<line x1="17" y1="16" x2="23" y2="16" />
				</svg>
			</button>
		</>
	);
}

function OptionGroup({
	label,
	options,
	active,
	onChange,
}: {
	label: string;
	options: { value: string; label: string }[];
	active: string;
	onChange: (value: string) => void;
}) {
	return (
		<div className="mb-3">
			<div className="text-[11px] font-semibold uppercase tracking-[0.04em] text-rv-text-tertiary mb-2">
				{label}
			</div>
			<div className="flex bg-rv-bg-input border border-rv-border rounded-[6px] overflow-hidden">
				{options.map((opt) => (
					<button
						key={opt.value}
						className={`flex-1 text-[11px] font-semibold py-1.5 transition duration-150 ${
							active === opt.value
								? "bg-rv-accent-muted text-rv-accent"
								: "text-rv-text-tertiary hover:text-rv-text-secondary"
						}`}
						type="button"
						onClick={() => onChange(opt.value)}
					>
						{opt.label}
					</button>
				))}
			</div>
		</div>
	);
}
