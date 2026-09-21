import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CustomNodeElementProps } from "react-d3-tree";
import Tree from "react-d3-tree";
import { useShallow } from "zustand/react/shallow";
import type { NodeStatus } from "../../../../../packages/core/src/schema";
import ravenLogo from "../assets/raven-logo.svg";
import { useCanvasFocusController } from "../hooks/useCanvasFocusController";
import { useCanvasViewport } from "../hooks/useCanvasViewport";
import { useFileActions } from "../hooks/useFileActions";
import { OPEN_RENAME_EVENT, useInlineRename } from "../hooks/useInlineRename";
import { useKeyboardRouter } from "../hooks/useKeyboardRouter";
import { useRecentFiles } from "../hooks/useRecentFiles";
import { requestNodeFocus } from "../lib/focusRequest";
import { listNodeCards } from "../lib/nodeCard";
import { computeFit, SCALE_EXTENT } from "../lib/viewportMath";
import { useRoadmapStore } from "../store/roadmapStore";
import { RoadRavenContextMenu } from "./ContextMenu";
import { RoadmapNodeCard } from "./RoadmapNode";
import { SchemaErrorPanel } from "./SchemaErrorPanel";
import { WelcomeScreen } from "./WelcomeScreen";

/** Stop an in-flight pan animation, if any. */
function cancelPan(ref: { current: number | null }): void {
	if (ref.current !== null) {
		cancelAnimationFrame(ref.current);
		ref.current = null;
	}
}

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
	const setTranslate = useRoadmapStore((s) => s.setTranslate);
	const selectedNodeId = useRoadmapStore((s) => s.selectedNodeId);
	const focusedNodeId = useRoadmapStore((s) => s.focusedNodeId);
	const searchMatchIds = useRoadmapStore((s) => s.searchMatchIds);
	const searchCurrentIndex = useRoadmapStore((s) => s.searchCurrentIndex);

	// The canvas container: every pan/fit measurement is taken against its rect.
	const containerRef = useRef<HTMLDivElement>(null);

	// Viewport truth (RC1) — the store is the single owner; this hook keeps it
	// honest about d3 gestures without paying a full tree re-render per frame.
	const { getTransform, flushViewport, syncGesture } = useCanvasViewport();

	// Recent files for WelcomeScreen — shared with Sidebar via useRecentFiles
	const recentFiles = useRecentFiles();

	// Inline rename state
	const inlineRename = useInlineRename();

	// Target of the most recent right-click — null when opened on empty canvas.
	// Drives RoadRavenContextMenu's node-vs-canvas content switch.
	const [contextTargetId, setContextTargetId] = useState<string | null>(null);

	// Self-animated because Tree's `centeringTransitionDuration` only fires
	// on initial mount — runtime `translate` prop changes are applied instantly.
	const panAnimRef = useRef<number | null>(null);
	const animatePanTo = useCallback(
		(target: { x: number; y: number }) => {
			cancelPan(panAnimRef);
			// Programmatic pans start from the live transform, and publish it as
			// one translate+zoom write so a gesture that has not been synced yet
			// cannot be undone halfway through the animation. No-op (guarded in
			// the store) whenever the store is already up to date.
			const start = getTransform();
			flushViewport();
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
		[setTranslate, getTransform, flushViewport],
	);

	// RC10: user input wins over an in-flight animation. Capture phase so the
	// gesture is caught even though it starts on the rd3t <svg> deeper in the
	// tree, which stops propagation of its own pan/zoom events. `pointerup`
	// ends a drag, which is the earliest point the store can be made truthful
	// without paying for a re-render per gesture frame.
	useEffect(() => {
		const el = containerRef.current;
		const cancel = (): void => cancelPan(panAnimRef);
		el?.addEventListener("pointerdown", cancel, true);
		el?.addEventListener("wheel", cancel, true);
		el?.addEventListener("pointerup", flushViewport, true);
		return () => {
			el?.removeEventListener("pointerdown", cancel, true);
			el?.removeEventListener("wheel", cancel, true);
			el?.removeEventListener("pointerup", flushViewport, true);
			cancelPan(panAnimRef);
		};
	}, [flushViewport]);

	// Fit-to-view always fits the WHOLE tree (user decision D3 — the implicit
	// close-up on the focused node is gone). The box is the union of the cards
	// actually mounted, so a collapsed subtree cannot inflate it (RC5).
	// Triggered by store.fitView() via the `roadraven:fit-view` event.
	const setZoomLevel = useRoadmapStore((s) => s.setZoomLevel);
	useEffect(() => {
		const handler = () => {
			// Before the first store write, or a gesture still waiting to be
			// synced would be dropped by it and its translate lost.
			flushViewport();
			const container = containerRef.current;
			if (!container) return;
			const fit = computeFit(
				listNodeCards().map((card) => card.getBoundingClientRect()),
				container.getBoundingClientRect(),
				getTransform(),
			);
			if (!fit) return;
			setZoomLevel(fit.zoom);
			animatePanTo(fit.translate);
		};
		window.addEventListener("roadraven:fit-view", handler);
		return () => window.removeEventListener("roadraven:fit-view", handler);
	}, [animatePanTo, setZoomLevel, getTransform, flushViewport]);

	// Reveal side of every focus request: expand, wait for mount, measure, pan.
	const panBy = useCallback(
		(dx: number, dy: number) => {
			const t = getTransform();
			animatePanTo({ x: t.x + dx, y: t.y + dy });
		},
		[getTransform, animatePanTo],
	);
	useCanvasFocusController({ containerRef, panBy });

	// Search highlight derivations. Set membership drives the per-card dim /
	// outline; the current match drives the pulse + camera follow.
	const searchMatchSet = useMemo(
		() => new Set(searchMatchIds),
		[searchMatchIds],
	);
	const searchActive = searchMatchIds.length > 0;
	const searchCurrentId =
		searchCurrentIndex >= 0 && searchCurrentIndex < searchMatchIds.length
			? searchMatchIds[searchCurrentIndex]
			: null;

	// Search match follow: when the current match changes (type or Enter/F3),
	// jump to it. The controller owns expanding collapsed ancestors and waiting
	// for the card, and requestNodeFocus ignores an id that is no longer in the
	// index (a match deleted between query and follow).
	useEffect(() => {
		if (!searchCurrentId) return;
		requestNodeFocus(searchCurrentId, { align: "center", select: true });
	}, [searchCurrentId]);

	// Inline rename bridge: any caller that wants to enter rename mode on a
	// node dispatches a window CustomEvent with the node's id. Sources:
	//   - ContextMenu "Rename" item
	//   - ContextMenu Add Child / Add Sibling / Duplicate (auto-rename after
	//     create)
	//   - useKeyboardRouter F2 + creation shortcuts
	//   - MutationsPanel create buttons
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
				inlineRename.open(detail.nodeId);
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
			// RC1: the gesture is the only place d3 tells us where the camera
			// actually is. The rename input rides along inside its card, so a
			// pan/zoom needs no overlay repositioning.
			syncGesture(target.translate, target.zoom);
		},
		[syncGesture],
	);

	const renderNode = useCallback(
		({ nodeDatum, toggleNode }: CustomNodeElementProps) => {
			const status = (nodeDatum.attributes?.status as string) ?? "not-started";
			const nodeId = nodeDatum.attributes?.id as string;
			const children = nodeDatum.children ?? [];
			const hasChildren = children.length > 0;
			const isCollapsed = nodeDatum.__rd3t?.collapsed;

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
						isSearchMatch={searchMatchSet.has(nodeId)}
						isSearchCurrent={searchCurrentId === nodeId}
						isSearchDimmed={searchActive && !searchMatchSet.has(nodeId)}
						hasChildren={hasChildren}
						isCollapsed={!!isCollapsed}
						childCount={children.length}
						onToggle={toggleNode}
						onSelect={() => {
							requestNodeFocus(nodeId, { align: "nearest", select: true });
						}}
						onDoubleClick={() => {
							inlineRename.open(nodeId);
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
			searchMatchSet,
			searchCurrentId,
			searchActive,
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
							scaleExtent={SCALE_EXTENT}
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
