import { useCallback, useEffect, useRef, useState } from "react";
import type { CustomNodeElementProps } from "react-d3-tree";
import Tree from "react-d3-tree";
import { useShallow } from "zustand/react/shallow";
import ravenLogo from "../assets/raven-logo.svg";
import { useFileActions } from "../hooks/useFileActions";
import { useInlineRename } from "../hooks/useInlineRename";
import { useKeyboardRouter } from "../hooks/useKeyboardRouter";
import { electroview } from "../rpc";
import { useRoadmapStore } from "../store/roadmapStore";
import { RoadRavenContextMenu } from "./ContextMenu";
import type { NodeStatus } from "./RoadmapNode";
import { RoadmapNodeCard } from "./RoadmapNode";
import { SchemaErrorPanel } from "./SchemaErrorPanel";
import { WelcomeScreen } from "./WelcomeScreen";

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
	const setFocusedNode = useRoadmapStore((s) => s.setFocusedNode);
	const setTranslate = useRoadmapStore((s) => s.setTranslate);
	const selectedNodeId = useRoadmapStore((s) => s.selectedNodeId);
	const focusedNodeId = useRoadmapStore((s) => s.focusedNodeId);

	// Container ref for dimensions + getBoundingClientRect for rename math
	const containerRef = useRef<HTMLDivElement>(null);
	const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

	// Track the current Tree transform (zoom + pan) via onUpdate
	const transformRef = useRef<{ x: number; y: number; k: number }>({
		x: 0,
		y: 0,
		k: 1,
	});

	// Cache node positions (in react-d3-tree local coords) keyed by nodeId
	const nodePositionsRef = useRef<Map<string, { x: number; y: number }>>(
		new Map(),
	);

	// Recent files state for WelcomeScreen
	const [recentFiles, setRecentFiles] = useState<string[]>([]);

	// Inline rename state
	const inlineRename = useInlineRename();

	// Target of the most recent right-click — null when opened on empty canvas.
	// Drives RoadRavenContextMenu's node-vs-canvas content switch.
	const [contextTargetId, setContextTargetId] = useState<string | null>(null);

	// Load recent files on mount
	useEffect(() => {
		if (electroview?.rpc) {
			electroview.rpc.request
				.loadSettings({})
				.then((result) => {
					setRecentFiles(result.settings.recentFiles ?? []);
				})
				.catch(() => {
					// Settings load failed; leave empty
				});
		}
	}, []);

	useEffect(() => {
		if (!containerRef.current) return;
		const observer = new ResizeObserver((entries) => {
			const { width, height } = entries[0].contentRect;
			setDimensions({ width, height });
		});
		observer.observe(containerRef.current);
		return () => observer.disconnect();
	}, []);

	// Pan-animation state. `centeringTransitionDuration` on <Tree> only runs
	// for the initial mount — runtime `translate` prop changes are applied
	// instantly. So we interpolate translate ourselves via requestAnimationFrame
	// with a cubic-ease so the camera-follow feels smooth.
	const panAnimRef = useRef<number | null>(null);
	const animatePanTo = useCallback(
		(target: { x: number; y: number }, duration = 500) => {
			if (panAnimRef.current !== null) {
				cancelAnimationFrame(panAnimRef.current);
				panAnimRef.current = null;
			}
			const start = {
				x: transformRef.current.x,
				y: transformRef.current.y,
			};
			const startTime = performance.now();
			// Cubic ease-out — matches Material "standard" feel, fast start,
			// gentle settle. Easy to swap for cubic-bezier or spring later.
			const ease = (t: number): number => 1 - (1 - t) ** 3;
			const step = (now: number): void => {
				const elapsed = now - startTime;
				const t = Math.min(1, elapsed / duration);
				const e = ease(t);
				setTranslate({
					x: start.x + (target.x - start.x) * e,
					y: start.y + (target.y - start.y) * e,
				});
				if (t < 1) {
					panAnimRef.current = requestAnimationFrame(step);
				} else {
					panAnimRef.current = null;
				}
			};
			panAnimRef.current = requestAnimationFrame(step);
		},
		[setTranslate],
	);
	useEffect(() => {
		return () => {
			if (panAnimRef.current !== null) {
				cancelAnimationFrame(panAnimRef.current);
			}
		};
	}, []);

	// Camera-follow: when the focused (arrow-nav) or selected (click/space)
	// node is outside the viewport, pan so it comes into view. Uses the
	// rAF-animated panner above so the motion feels smooth; only triggers
	// when genuinely off-screen so manual panning isn't fought.
	const targetNodeId = focusedNodeId ?? selectedNodeId;
	useEffect(() => {
		if (!targetNodeId) return;
		const pos = nodePositionsRef.current.get(targetNodeId);
		if (!pos) return;
		const t = transformRef.current;
		const screenX = pos.x * t.k + t.x;
		const screenY = pos.y * t.k + t.y;
		const margin = 100;
		const inView =
			screenX > margin &&
			screenX < dimensions.width - margin &&
			screenY > margin &&
			screenY < dimensions.height - margin;
		if (inView) return;
		animatePanTo({
			x: dimensions.width / 2 - pos.x * t.k,
			y: dimensions.height / 2 - pos.y * t.k,
		});
	}, [targetNodeId, dimensions, animatePanTo]);

	// Inline rename bridge: any caller that wants to enter rename mode on a
	// node dispatches a window CustomEvent with the node's id. Sources:
	//   - ContextMenu "Rename" item
	//   - ContextMenu Add Child / Add Sibling / Duplicate (auto-rename after
	//     create)
	//   - useKeyboardRouter F2 + creation shortcuts
	//   - MutationsPanel create buttons
	// With card-matched rename, the position args to inlineRename.open are
	// unused (the input renders inside the card itself), but the hook still
	// accepts them — passing zeros avoids changing the hook's public API.
	useEffect(() => {
		const handler = (e: Event) => {
			const detail = (e as CustomEvent<{ nodeId: string }>).detail;
			if (!detail?.nodeId) return;
			inlineRename.open(
				detail.nodeId,
				0,
				0,
				{ x: 0, y: 0, k: 1 },
				{ left: 0, top: 0 },
			);
		};
		window.addEventListener("roadraven:open-rename", handler);
		return () => window.removeEventListener("roadraven:open-rename", handler);
	}, [inlineRename]);

	// Wire the keyboard router
	useKeyboardRouter({
		inlineRename,
		getTransform: () => transformRef.current,
		getContainerRect: () => {
			const rect = containerRef.current?.getBoundingClientRect();
			return { left: rect?.left ?? 0, top: rect?.top ?? 0 };
		},
		getNodePosition: (nodeId: string) =>
			nodePositionsRef.current.get(nodeId) ?? null,
		togglePanelFocus: () => {
			// Placeholder — Plan 03 implements panel-focus handoff. For now, move
			// focus between selected node (panel) and focused node (canvas).
			const store = useRoadmapStore.getState();
			if (store.selectedNodeId && !store.focusedNodeId) {
				store.setFocusedNode(store.selectedNodeId);
			} else if (store.focusedNodeId) {
				store.setSelectedNode(store.focusedNodeId);
			}
		},
	});

	const { openFile, openRecent, openSample } = useFileActions();

	const handleTreeUpdate = useCallback(
		(target: {
			node: unknown;
			zoom: number;
			translate: { x: number; y: number };
		}) => {
			transformRef.current = {
				x: target.translate.x,
				y: target.translate.y,
				k: target.zoom,
			};
			// When a rename is open, keep the input anchored to the node as the user pans/zooms
			if (inlineRename.state.nodeId) {
				const pos = nodePositionsRef.current.get(inlineRename.state.nodeId);
				const rect = containerRef.current?.getBoundingClientRect();
				if (pos && rect) {
					inlineRename.updateForTransform(pos.x, pos.y, transformRef.current, {
						left: rect.left,
						top: rect.top,
					});
				}
			}
		},
		[inlineRename],
	);

	const renderNode = useCallback(
		({ nodeDatum, toggleNode, hierarchyPointNode }: CustomNodeElementProps) => {
			const status = (nodeDatum.attributes?.status as string) ?? "not-started";
			const nodeId = nodeDatum.attributes?.id as string;
			const children = nodeDatum.children ?? [];
			const hasChildren = children.length > 0;
			const isCollapsed = nodeDatum.__rd3t?.collapsed;

			// Record current local position for this node so the keyboard router
			// can locate it for inline-rename positioning.
			if (nodeId && hierarchyPointNode) {
				nodePositionsRef.current.set(nodeId, {
					x: hierarchyPointNode.x,
					y: hierarchyPointNode.y,
				});
			}

			return (
				<foreignObject
					width={240}
					height={100}
					x={-120}
					y={-50}
					overflow="visible"
				>
					<RoadmapNodeCard
						title={nodeDatum.name}
						status={status as NodeStatus}
						nodeId={nodeId}
						isSelected={selectedNodeId === nodeId}
						isFocused={focusedNodeId === nodeId}
						hasChildren={hasChildren}
						isCollapsed={!!isCollapsed}
						childCount={children.length}
						onToggle={toggleNode}
						onSelect={() => {
							setSelectedNode(nodeId);
							setFocusedNode(nodeId);
						}}
						onDoubleClick={() => {
							const pos = nodePositionsRef.current.get(nodeId);
							const rect = containerRef.current?.getBoundingClientRect();
							if (pos && rect) {
								inlineRename.open(nodeId, pos.x, pos.y, transformRef.current, {
									left: rect.left,
									top: rect.top,
								});
							}
						}}
						isRenaming={inlineRename.state.nodeId === nodeId}
						renameValue={inlineRename.state.title}
						onRenameChange={inlineRename.setTitle}
						onRenameCommit={inlineRename.commit}
						onRenameCancel={inlineRename.cancel}
					/>
				</foreignObject>
			);
		},
		[
			selectedNodeId,
			focusedNodeId,
			setSelectedNode,
			setFocusedNode,
			inlineRename,
		],
	);

	return (
		<RoadRavenContextMenu
			onOpen={setContextTargetId}
			targetNodeId={contextTargetId}
		>
			<div
				ref={containerRef}
				className="[grid-area:canvas] bg-rv-bg-canvas relative overflow-hidden"
				role="application"
				// biome-ignore lint/a11y/noNoninteractiveTabindex: role="application" is an interactive ARIA widget — must be focusable so Escape/onKeyDown reaches the canvas.
				tabIndex={0}
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

				{treeData === null ? (
					<WelcomeScreen
						recentFiles={recentFiles}
						onOpenFile={openFile}
						onOpenRecent={openRecent}
						onOpenSample={openSample}
					/>
				) : (
					<Tree
						data={treeData}
						dataKey={dataKey}
						orientation={layoutOrientation === "TB" ? "vertical" : "horizontal"}
						pathFunc="step"
						separation={{ siblings: 1.5, nonSiblings: 2.0 }}
						nodeSize={{ x: 240, y: 100 }}
						renderCustomNodeElement={renderNode}
						zoom={zoomLevel}
						enableLegacyTransitions={false}
						centeringTransitionDuration={50800}
						collapsible={true}
						zoomable={true}
						draggable={true}
						translate={translate}
						dimensions={dimensions}
						hasInteractiveNodes={true}
						onUpdate={handleTreeUpdate}
					/>
				)}

				{/* Inline rename renders inside RoadmapNodeCard (card-matched UX).
				    useInlineRename still owns open/commit/cancel state; the
				    card reads it via props. */}

				{schemaErrors.length > 0 && (
					<SchemaErrorPanel
						errors={schemaErrors}
						onDismiss={() => setSchemaErrors([])}
					/>
				)}
			</div>
		</RoadRavenContextMenu>
	);
}
