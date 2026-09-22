import { APP_VERSION } from "../lib/appVersion";
import { useRoadmapStore } from "../store/roadmapStore";
import { EventApiPill } from "./EventApiPill";
import { SaveIndicator } from "./SaveIndicator";

// v0.8.2 D3: the filename moved to the top-bar DocumentChip; the footer keeps
// the Event API pill, the save indicator, the node count and the app version.
export function StatusBar() {
	const nodeCount = useRoadmapStore((s) => s.getNodeCount());

	return (
		<footer className="[grid-area:status] flex items-center h-[32px] bg-rv-bg-statusbar border-t border-rv-border px-3.5 text-[11px] text-rv-text-tertiary z-[100] select-none">
			{/* Left section — Event API status pill (replaces static ● Connected) */}
			<div className="flex items-center gap-2.5">
				<EventApiPill />
			</div>

			{/* Spacers */}
			<div className="flex-1" />
			<div className="flex-1" />

			{/* Right section */}
			<div className="flex items-center gap-2.5">
				<SaveIndicator />
				<span>{nodeCount} nodes</span>
				<span
					className="text-[11px] text-rv-text-tertiary"
					title={`RoadRaven ${APP_VERSION}`}
				>
					v{APP_VERSION}
				</span>
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
