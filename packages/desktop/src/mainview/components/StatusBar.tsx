import { useRoadmapStore } from "../store/roadmapStore";
import { EventApiPill } from "./EventApiPill";
import { SaveIndicator } from "./SaveIndicator";

export function StatusBar() {
	const filePath = useRoadmapStore((s) => s.filePath);
	const nodeCount = useRoadmapStore((s) => s.getNodeCount());

	const fileName = filePath ? filePath.split(/[\\/]/).pop() : "No file loaded";

	return (
		<footer className="[grid-area:status] flex items-center h-[32px] bg-rv-bg-statusbar border-t border-rv-border px-3.5 text-[11px] text-rv-text-tertiary z-[100] select-none">
			{/* Left section — Event API status pill (replaces static ● Connected) */}
			<div className="flex items-center gap-2.5">
				<EventApiPill />
			</div>

			{/* Spacer */}
			<div className="flex-1" />

			{/* Center section */}
			<div className="flex items-center gap-2.5">
				<span>{fileName}</span>
			</div>

			{/* Spacer */}
			<div className="flex-1" />

			{/* Right section */}
			<div className="flex items-center gap-2.5">
				<SaveIndicator />
				<span>{nodeCount} nodes</span>
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
					className="text-rv-text-tertiary"
				>
					<polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
				</svg>
			</div>
		</footer>
	);
}
