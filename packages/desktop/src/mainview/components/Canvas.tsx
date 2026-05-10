import { useCallback, useEffect, useRef, useState } from "react";
import type { CustomNodeElementProps } from "react-d3-tree";
import Tree from "react-d3-tree";
import { useShallow } from "zustand/react/shallow";
import type { NodeStatus } from "../../../../../packages/core/src/schema";
import ravenLogo from "../assets/raven-logo.svg";
import { useFileActions } from "../hooks/useFileActions";
import { OPEN_RENAME_EVENT, useInlineRename } from "../hooks/useInlineRename";
import { useKeyboardRouter } from "../hooks/useKeyboardRouter";
import { electroview } from "../rpc";
import { useRoadmapStore } from "../store/roadmapStore";
import { RoadRavenContextMenu } from "./ContextMenu";
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

	// Self-animated because Tree's `centeringTransitionDuration` only fires
	// on initial mount — runtime `translate` prop changes are applied instantly.
	const panAnimRef = useRef<number | null>(null);
	const animatePanTo = useCallback(
		(target: { x: number; y: number }) => {
			if (panAnimRef.current !== null) {
				cancelAnimationFrame(panAnimRef.current);
				panAnimRef.current = null;
			}
			const start = {
				x: transformRef.current.x,
				y: transformRef.current.y,
			};
			const reduced =
				typeof window !== "undefined" &&
				window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
			if (reduced) {
				setTranslate(target);
				return;
			}
			const dx = target.x - start.x;
			const dy = target.y - start.y;
			const distance = Math.hypot(dx, dy);
			const duration = Math.min(900, Math.max(250, distance * 0.6));
			const startTime = performance.now();
			const ease = (t: number): number =>
				t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2;
			const step = (now: number): void => {
				const elapsed = now - startTime;
				const t = Math.min(1, elapsed / duration);
				const e = ease(t);
				setTranslate({
					x: start.x + dx * e,
					y: start.y + dy * e,
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

	// Fit-to-view: if a node is focused/selected, zoom in close on it; otherwise
	// fall back to fitting the whole tree (Act 4 pullback for the storytelling
	// video). Triggered by store.fitView() via the `roadraven:fit-view` event.
	const setZoomLevel = useRoadmapStore((s) => s.setZoomLevel);
	useEffect(() => {
		const handler = () => {
			const store = useRoadmapStore.getState();
			const targetId = store.focusedNodeId ?? store.selectedNodeId;
			const targetPos = targetId
				? nodePositionsRef.current.get(targetId)
				: null;

			if (targetPos) {
				// Close-up on a single node — zoom in tight, center the node card.
				const FOCUS_ZOOM = 1.6;
				setZoomLevel(FOCUS_ZOOM);
				animatePanTo({
					x: dimensions.width / 2 - targetPos.x * FOCUS_ZOOM,
					y: dimensions.height / 2 - targetPos.y * FOCUS_ZOOM,
				});
				return;
			}

			// Fall-through: fit the whole tree (Act 4 pullback).
			const positions = Array.from(nodePositionsRef.current.values());
			if (positions.length === 0) return;
			let minX = Number.POSITIVE_INFINITY;
			let maxX = Number.NEGATIVE_INFINITY;
			let minY = Number.POSITIVE_INFINITY;
			let maxY = Number.NEGATIVE_INFINITY;
			for (const p of positions) {
				if (p.x < minX) minX = p.x;
				if (p.x > maxX) maxX = p.x;
				if (p.y < minY) minY = p.y;
				if (p.y > maxY) maxY = p.y;
			}
			// Pad bounds for the node card extents (240×100 per nodeSize prop).
			const NODE_W = 240;
			const NODE_H = 100;
			const treeW = maxX - minX + NODE_W;
			const treeH = maxY - minY + NODE_H;
			const MARGIN = 0.85; // leave 15% breathing room
			const targetZoom = Math.min(
				1,
				Math.max(
					0.2,
					Math.min(
						(dimensions.width * MARGIN) / treeW,
						(dimensions.height * MARGIN) / treeH,
					),
				),
			);
			const treeCenterLocal = {
				x: (minX + maxX) / 2,
				y: (minY + maxY) / 2,
			};
			setZoomLevel(targetZoom);
			animatePanTo({
				x: dimensions.width / 2 - treeCenterLocal.x * targetZoom,
				y: dimensions.height / 2 - treeCenterLocal.y * targetZoom,
			});
		};
		window.addEventListener("roadraven:fit-view", handler);
		return () => window.removeEventListener("roadraven:fit-view", handler);
	}, [dimensions, animatePanTo, setZoomLevel]);

	// Pan only enough to land the node inside a comfort zone (middle 50% of
	// viewport) — recentering on every edge click whips the camera across
	// long distances and reads as jarring.
	const targetNodeId = focusedNodeId ?? selectedNodeId;
	useEffect(() => {
		if (!targetNodeId) return;
		const pos = nodePositionsRef.current.get(targetNodeId);
		if (!pos) return;
		const t = transformRef.current;
		const screenX = pos.x * t.k + t.x;
		const screenY = pos.y * t.k + t.y;
		const clamp = (v: number, lo: number, hi: number): number =>
			Math.min(hi, Math.max(lo, v));
		const zoneX = {
			min: dimensions.width * 0.25,
			max: dimensions.width * 0.75,
		};
		const zoneY = {
			min: dimensions.height * 0.25,
			max: dimensions.height * 0.75,
		};
		const targetScreenX = clamp(screenX, zoneX.min, zoneX.max);
		const targetScreenY = clamp(screenY, zoneY.min, zoneY.max);
		if (targetScreenX === screenX && targetScreenY === screenY) return;
		animatePanTo({
			x: t.x + (targetScreenX - screenX),
			y: t.y + (targetScreenY - screenY),
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
			// Defer by one frame so Radix ContextMenu's onCloseAutoFocus can
			// finish returning focus to the trigger BEFORE we focus the input.
			// Without this, menu-sourced create-then-rename races: Radix's
			// focus restore fires blur on the input, the blur handler commits
			// and closes rename. Keyboard-sourced creates have no menu to
			// close and therefore no race; the defer is a no-op for them.
			requestAnimationFrame(() => {
				inlineRename.open(
					detail.nodeId,
					0,
					0,
					{ x: 0, y: 0, k: 1 },
					{ left: 0, top: 0 },
				);
			});
		};
		window.addEventListener(OPEN_RENAME_EVENT, handler);
		return () => window.removeEventListener(OPEN_RENAME_EVENT, handler);
		// inlineRename.open is stable (useCallback with empty deps), so this effect
		// registers exactly once and is not torn down on every rename keystroke.
	}, [inlineRename.open]);

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

	const { openFile, openRecent, openSample, newRoadmap } = useFileActions();

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
						onNewRoadmap={newRoadmap}
					/>
				) : (
					// role="tree" wrapper satisfies aria-required-parent for the
					// role="treeitem" nodes inside (PACK-06 / D-20). react-d3-tree
					// renders its own SVG; this div sits between role="application"
					// and the tree items so the ARIA hierarchy is application > tree > treeitem.
					<div role="tree" aria-label="Roadmap tree" className="w-full h-full">
						<Tree
							data={treeData}
							dataKey={dataKey}
							orientation={
								layoutOrientation === "TB" ? "vertical" : "horizontal"
							}
							pathFunc="step"
							separation={{ siblings: 1, nonSiblings: 1.3 }}
							nodeSize={{ x: 240, y: 100 }}
							renderCustomNodeElement={renderNode}
							zoom={zoomLevel}
							enableLegacyTransitions={false}
							centeringTransitionDuration={800}
							collapsible={true}
							zoomable={true}
							draggable={true}
							translate={translate}
							hasInteractiveNodes={true}
							onUpdate={handleTreeUpdate}
						/>
					</div>
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
