import { ConfigPanel } from "./ConfigPanel";
import { RoadmapNodeCard } from "./RoadmapNode";

export function Canvas() {
	return (
		<div
			className="[grid-area:canvas] bg-rv-bg-canvas relative overflow-hidden"
			style={{
				backgroundImage:
					"radial-gradient(circle, var(--rv-dot-grid) 1px, transparent 1px)",
				backgroundSize: "40px 40px",
			}}
		>
			{/* Sample nodes to demonstrate theme tokens */}
			<div className="absolute" style={{ top: 100, left: 200 }}>
				<RoadmapNodeCard title="Setup Project" status="completed" />
			</div>
			<div className="absolute" style={{ top: 100, left: 500 }}>
				<RoadmapNodeCard title="Build Theme System" status="in-progress" />
			</div>
			<div className="absolute" style={{ top: 250, left: 350 }}>
				<RoadmapNodeCard title="Wire Data Layer" status="not-started" />
			</div>

			{/* SVG connector placeholder */}
			<svg
				aria-hidden="true"
				className="absolute inset-0 w-full h-full pointer-events-none z-[1]"
			>
				<path
					d="M 290 130 C 350 130, 400 130, 500 130"
					fill="none"
					style={{ stroke: "var(--rv-line-connector)" }}
					strokeWidth="1.5"
					strokeDasharray="6 4"
				>
					<animate
						attributeName="stroke-dashoffset"
						from="20"
						to="0"
						dur="1s"
						repeatCount="indefinite"
					/>
				</path>
				<path
					d="M 350 130 C 350 180, 350 220, 440 280"
					fill="none"
					style={{ stroke: "var(--rv-line-connector)" }}
					strokeWidth="1.5"
					strokeDasharray="6 4"
				>
					<animate
						attributeName="stroke-dashoffset"
						from="20"
						to="0"
						dur="1s"
						repeatCount="indefinite"
					/>
				</path>
			</svg>

			<ConfigPanel />
		</div>
	);
}
