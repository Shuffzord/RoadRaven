import { useEffect, useRef, useState } from "react";
import type { CustomNodeElementProps } from "react-d3-tree";
import Tree from "react-d3-tree";
import { useShallow } from "zustand/react/shallow";
import ravenLogo from "../assets/raven-logo.svg";
import { useRoadmapStore } from "../store/roadmapStore";
import type { NodeStatus } from "./RoadmapNode";
import { RoadmapNodeCard } from "./RoadmapNode";
import { SchemaErrorPanel } from "./SchemaErrorPanel";

export function Canvas() {
	const {
		treeData,
		dataKey,
		layoutOrientation,
		schemaErrors,
		translate,
		zoomLevel,
	} = useRoadmapStore(
		useShallow((s) => ({
			treeData: s.treeData,
			dataKey: s.dataKey,
			layoutOrientation: s.layoutOrientation,
			schemaErrors: s.schemaErrors,
			translate: s.translate,
			zoomLevel: s.zoomLevel,
		})),
	);
	const setSchemaErrors = useRoadmapStore((s) => s.setSchemaErrors);
	const setSelectedNode = useRoadmapStore((s) => s.setSelectedNode);
	const selectedNodeId = useRoadmapStore((s) => s.selectedNodeId);

	// Container ref for dimensions
	const containerRef = useRef<HTMLDivElement>(null);
	const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

	useEffect(() => {
		if (!containerRef.current) return;
		const observer = new ResizeObserver((entries) => {
			const { width, height } = entries[0].contentRect;
			setDimensions({ width, height });
		});
		observer.observe(containerRef.current);
		return () => observer.disconnect();
	}, []);

	const renderNode = ({ nodeDatum, toggleNode }: CustomNodeElementProps) => {
		const status = (nodeDatum.attributes?.status as string) ?? "not-started";
		const nodeId = nodeDatum.attributes?.id as string;
		const hasChildren = nodeDatum.children && nodeDatum.children.length > 0;
		const isCollapsed = nodeDatum.__rd3t?.collapsed;
		return (
			<foreignObject width={240} height={100} x={-120} y={-50}>
				<RoadmapNodeCard
					title={nodeDatum.name}
					status={status as NodeStatus}
					nodeId={nodeId}
					isSelected={selectedNodeId === nodeId}
					hasChildren={!!hasChildren}
					isCollapsed={!!isCollapsed}
					onToggle={toggleNode}
					onSelect={() => setSelectedNode(nodeId)}
				/>
			</foreignObject>
		);
	};

	return (
		<div
			ref={containerRef}
			className="[grid-area:canvas] bg-rv-bg-canvas relative overflow-hidden"
			role="application"
			style={{
				backgroundImage:
					"radial-gradient(circle, var(--rv-dot-grid) 1px, transparent 1px)",
				backgroundSize: "40px 40px",
			}}
			onClick={(e) => {
				// Deselect node when clicking empty canvas
				if (e.target === e.currentTarget) {
					setSelectedNode(null);
				}
			}}
			onKeyDown={(e) => {
				if (e.key === "Escape") {
					setSelectedNode(null);
				}
			}}
		>
			{/* Watermark logo -- uses CSS mask so color follows theme */}
			<div
				aria-hidden="true"
				className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] opacity-[0.04] pointer-events-none select-none bg-rv-text-primary"
				style={{
					maskImage: `url(${ravenLogo})`,
					maskSize: "contain",
					maskRepeat: "no-repeat",
					maskPosition: "center",
					WebkitMaskImage: `url(${ravenLogo})`,
					WebkitMaskSize: "contain",
					WebkitMaskRepeat: "no-repeat",
					WebkitMaskPosition: "center",
				}}
			/>

			{treeData && (
				<Tree
					data={treeData}
					dataKey={dataKey}
					orientation={layoutOrientation === "TB" ? "vertical" : "horizontal"}
					initialDepth={3}
					pathFunc="step"
					separation={{ siblings: 1.5, nonSiblings: 2.0 }}
					nodeSize={{ x: 240, y: 100 }}
					renderCustomNodeElement={renderNode}
					zoom={zoomLevel}
					enableLegacyTransitions={false}
					centeringTransitionDuration={800}
					collapsible={true}
					zoomable={true}
					draggable={true}
					translate={translate}
					dimensions={dimensions}
					pathClassFunc={() =>
						"stroke-[var(--rv-line-connector)] stroke-[1.5px] fill-none"
					}
				/>
			)}

			{schemaErrors.length > 0 && (
				<SchemaErrorPanel
					errors={schemaErrors}
					onDismiss={() => setSchemaErrors([])}
				/>
			)}
		</div>
	);
}
