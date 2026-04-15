import { useCallback, useState } from "react";
import { useRoadmapStore } from "../store/roadmapStore";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { ResizeHandle } from "./ResizeHandle";
import { formatStatus, STATUS_TOKEN_MAP } from "./RoadmapNode";

interface SidePanelProps {
	isOpen: boolean;
	onClose: () => void;
}

function formatDate(dateStr: string | undefined): string {
	if (!dateStr) return "N/A";
	try {
		const d = new Date(dateStr);
		if (Number.isNaN(d.getTime())) return "N/A";
		return d.toLocaleDateString(undefined, {
			year: "numeric",
			month: "short",
			day: "numeric",
		});
	} catch {
		return "N/A";
	}
}

export function SidePanel({ isOpen, onClose }: SidePanelProps) {
	const selectedNodeId = useRoadmapStore((s) => s.selectedNodeId);
	const nodeIndex = useRoadmapStore((s) => s.nodeIndex);
	useRoadmapStore((s) => s.statusTick); // re-render on status changes
	const selectedNode = selectedNodeId
		? nodeIndex.get(selectedNodeId)
		: undefined;
	const [width, setWidth] = useState(340);
	const [copied, setCopied] = useState(false);

	const maxWidth =
		typeof window !== "undefined" ? Math.floor(window.innerWidth * 0.5) : 480;

	const handleCopyId = useCallback(async () => {
		if (!selectedNode) return;
		await navigator.clipboard.writeText(selectedNode.id);
		setCopied(true);
		setTimeout(() => setCopied(false), 1000);
	}, [selectedNode]);

	const status = selectedNode?.status ?? "not-started";
	const tokens =
		STATUS_TOKEN_MAP[status as keyof typeof STATUS_TOKEN_MAP] ??
		STATUS_TOKEN_MAP["not-started"];

	return (
		<aside
			className="[grid-area:panel] bg-rv-bg-panel border-l border-rv-border z-[50] overflow-hidden flex flex-col relative"
			style={{
				width: isOpen ? width : 0,
				transitionProperty: "width",
				transitionDuration: "200ms",
				transitionTimingFunction: "ease-out",
				boxShadow: isOpen ? "var(--rv-shadow-panel)" : "none",
			}}
			// biome-ignore lint/a11y/noRedundantRoles: plan requires explicit role="complementary" for accessibility contract
			role="complementary"
			aria-label="Node details"
		>
			{isOpen && (
				<ResizeHandle onResize={setWidth} minWidth={320} maxWidth={maxWidth} />
			)}

			{/* Header */}
			<div className="flex items-center justify-between min-h-[52px] px-4 py-3.5 border-b border-rv-border shrink-0">
				<span className="text-[14px] font-semibold text-rv-text-primary whitespace-nowrap">
					Node Details
				</span>
				<button
					className="flex items-center justify-center w-7 h-7 rounded-[6px] text-rv-text-tertiary hover:bg-rv-bg-hover hover:text-rv-text-primary transition-colors duration-150"
					type="button"
					onClick={onClose}
					aria-label="Close panel"
				>
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
					>
						<line x1="18" y1="6" x2="6" y2="18" />
						<line x1="6" y1="6" x2="18" y2="18" />
					</svg>
				</button>
			</div>

			{/* Body */}
			<div className="flex-1 p-4 overflow-y-auto">
				{selectedNode ? (
					<>
						{/* Title */}
						<h2 className="text-[14px] font-semibold text-rv-text-primary mb-4">
							{selectedNode.title}
						</h2>

						{/* STATUS */}
						<FieldLabel>STATUS</FieldLabel>
						<div className="flex items-center gap-2 px-2.5 py-1.5 bg-rv-bg-input border border-rv-border rounded-[6px] mb-4">
							<span
								className="w-2 h-2 rounded-full"
								style={{
									backgroundColor: `var(${tokens.color})`,
								}}
							/>
							<span className="text-[12px] text-rv-text-primary">
								{formatStatus(status)}
							</span>
						</div>

						{/* TYPE */}
						<FieldLabel>TYPE</FieldLabel>
						<div className="mb-4">
							<span className="inline-block px-2.5 py-[3px] text-[11px] font-semibold rounded-[4px] bg-rv-accent-muted text-rv-accent">
								{selectedNode.type ?? "Unknown"}
							</span>
						</div>

						{/* CREATED */}
						<FieldLabel>CREATED</FieldLabel>
						<MetaRow label="Date" value={formatDate(selectedNode.createdAt)} />

						{/* UPDATED */}
						<FieldLabel>UPDATED</FieldLabel>
						<MetaRow label="Date" value={formatDate(selectedNode.updatedAt)} />

						{/* ID */}
						<FieldLabel>ID</FieldLabel>
						<div className="flex items-center gap-2 mb-4">
							<span className="text-[12px] text-rv-text-secondary font-mono">
								{selectedNode.id}
							</span>
							<button
								className="flex items-center justify-center w-5 h-5 rounded-[4px] hover:bg-rv-bg-hover hover:text-rv-accent transition-colors duration-150 text-rv-text-tertiary"
								type="button"
								aria-label={copied ? "Node ID copied" : "Copy node ID"}
								onClick={handleCopyId}
							>
								{copied ? (
									<svg
										aria-hidden="true"
										width="12"
										height="12"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										strokeWidth="2"
										strokeLinecap="round"
										strokeLinejoin="round"
									>
										<polyline points="20 6 9 17 4 12" />
									</svg>
								) : (
									<svg
										aria-hidden="true"
										width="12"
										height="12"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										strokeWidth="2"
										strokeLinecap="round"
										strokeLinejoin="round"
									>
										<rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
										<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
									</svg>
								)}
							</button>
						</div>

						{/* Divider */}
						<div className="h-px bg-rv-border my-4" />

						{/* NOTES */}
						<FieldLabel>NOTES</FieldLabel>
						{selectedNode.notes ? (
							<MarkdownRenderer content={selectedNode.notes} />
						) : (
							<p className="text-[13px] leading-[1.7] text-rv-text-tertiary">
								No notes for this node.
							</p>
						)}
					</>
				) : (
					<p className="text-[13px] text-rv-text-tertiary">
						Select a node to view details.
					</p>
				)}
			</div>
		</aside>
	);
}

function FieldLabel({ children }: { children: React.ReactNode }) {
	return (
		<div className="text-[11px] font-semibold uppercase tracking-[0.05em] text-rv-text-tertiary mb-1.5">
			{children}
		</div>
	);
}

function MetaRow({ label, value }: { label: string; value: string }) {
	return (
		<div className="flex items-center gap-2 mb-4">
			<span className="text-[12px] text-rv-text-tertiary">{label}</span>
			<span className="text-[12px] text-rv-text-secondary">{value}</span>
		</div>
	);
}
