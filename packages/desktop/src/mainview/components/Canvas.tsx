import { useCallback, useEffect, useMemo, useRef } from "react";
import type { CustomNodeElementProps, TreeLinkDatum } from "react-d3-tree";
import Tree from "react-d3-tree";
import { useShallow } from "zustand/react/shallow";
import type { NodeStatus } from "../../../../../packages/core/src/schema";
import ravenLogo from "../assets/raven-logo.svg";
import { useCanvasFocusController } from "../hooks/useCanvasFocusController";
import { useCanvasViewport } from "../hooks/useCanvasViewport";
import { useFileActions } from "../hooks/useFileActions";
import { useInlineRename } from "../hooks/useInlineRename";
import { useKeyboardRouter } from "../hooks/useKeyboardRouter";
import { useNodeDrag } from "../hooks/useNodeDrag";
import { useRecentFiles } from "../hooks/useRecentFiles";
import {
	linkClassFor,
	linkFromClassFor,
	NODE_OFFSET_ATTR,
} from "../lib/domContract";
import { togglePanelFocus } from "../lib/focusHandoff";
import { requestNodeFocus } from "../lib/focusRequest";
import { treeLayoutFor } from "../lib/layoutKnobs";
import { offsetLink, stepPath } from "../lib/linkPath";
import { listNodeCards } from "../lib/nodeCard";
import { type OffsetMap, ZERO_OFFSET } from "../lib/nodeOffsets";
import { clampZoom, computeFit, SCALE_EXTENT } from "../lib/viewportMath";
import { useFileViewStore } from "../store/fileViewStore";
import { useRoadmapStore } from "../store/roadmapStore";
import { RoadRavenContextMenu } from "./ContextMenu";
import { RoadmapNodeCard } from "./RoadmapNode";
import { SchemaErrorPanel } from "./SchemaErrorPanel";
import { WelcomeScreen } from "./WelcomeScreen";

/**
 * Roving tabindex (WAI-ARIA tree): exactly one card sits in the document tab
 * order — the focused one, or the root while nothing is focused, so Tab can
 * still get into the tree. `__rd3t.depth` is react-d3-tree's own depth, which
 * names the root without a second store read.
 */
function isTabStop(
	focusedNodeId: string | null,
	nodeId: string,
	depth: number | undefined,
): boolean {
	return focusedNodeId ? focusedNodeId === nodeId : depth === 0;
}

/** The roadmap node id react-d3-tree carries on a link endpoint. */
function linkNodeId(end: TreeLinkDatum["source"]): string {
	return end.data.attributes?.id as string;
}

/**
 * v0.8.4 Phase 3: every connector is addressable by the node it enters and
 * the node it leaves, so useNodeDrag can redraw a dragged card's links.
 */
function linkClasses(link: TreeLinkDatum): string {
	return `${linkClassFor(linkNodeId(link.target))} ${linkFromClassFor(linkNodeId(link.source))}`;
}

/**
 * react-d3-tree's `"step"` connector, drawn from each endpoint's custom
 * layout offset. With an empty map it is the library's own string.
 */
function offsetStepPathFunc(
	offsets: OffsetMap,
	orientation: "TB" | "LR",
): (link: TreeLinkDatum) => string {
	return (link) => {
		const { source, target } = offsetLink(
			link,
			{
				source: offsets[linkNodeId(link.source)] ?? ZERO_OFFSET,
				target: offsets[linkNodeId(link.target)] ?? ZERO_OFFSET,
			},
			orientation,
		);
		return stepPath(source, target, orientation);
	};
}

// v0.8.4 Phase 3 send-back: with custom layout OFF the canvas hands
// react-d3-tree exactly what Phase 2 did — the library's own "step" string,
// no pathClassFunc, and a bare foreignObject at (-120, -50) — so the
// feature costs nothing per render while it is off (orchestrator A/B:
// an always-on wrapper <g> + function pathFunc/pathClassFunc per link cost
// 1.12x arrow-nav, 1.58x rename-typing, 1.57x card-click blockedMs).
const CARD_X = -120;
const CARD_Y = -50;
const AUTO_LINK_PROPS = { pathFunc: "step" } as const;
const AUTO_PLACEMENT = { x: CARD_X, y: CARD_Y };
const autoPlacement = () => AUTO_PLACEMENT;

function customLinkProps(offsets: OffsetMap, orientation: "TB" | "LR") {
	return {
		pathFunc: offsetStepPathFunc(offsets, orientation),
		pathClassFunc: linkClasses,
	};
}

/**
 * Custom layout folds the card's offset into its foreignObject's x/y and
 * tags it NODE_OFFSET_ATTR, which is what useNodeDrag paints during a drag.
 */
function customPlacement(offsets: OffsetMap, nodeId: string) {
	const { dx, dy } = offsets[nodeId] ?? ZERO_OFFSET;
	return { x: CARD_X + dx, y: CARD_Y + dy, [NODE_OFFSET_ATTR]: nodeId };
}

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

	// v0.8.4 Phase 2: per-file layout comfort knobs. Memoised on the three
	// primitives (not the knobs object) so a re-render that leaves them
	// unchanged (e.g. a status tick) does not hand <Tree> a new
	// separation/nodeSize object and force it to remount its layout.
	const { siblingGap, depthGap, density } = useFileViewStore(
		(s) => s.layoutKnobs,
	);
	const { separation, nodeSize } = useMemo(
		() => treeLayoutFor({ siblingGap, depthGap, density }, layoutOrientation),
		[siblingGap, depthGap, density, layoutOrientation],
	);

	// The canvas container: every pan/fit measurement is taken against its rect.
	const containerRef = useRef<HTMLDivElement>(null);

	// Viewport truth (RC1) — the store is the single owner; this hook keeps it
	// honest about d3 gestures without paying a full tree re-render per frame.
	const { getTransform, flushViewport, syncGesture } = useCanvasViewport();

	// v0.8.4 Phase 3: custom layout. `activeOffsets` is the current
	// orientation's map while it is on, and null while it is off — then the
	// tree gets AUTO_LINK_PROPS / AUTO_PLACEMENT and no drag handlers. Its
	// identity only changes on a toggle, a drag commit or a reset, never on a
	// focus write or keystroke. `drag` is one stable object.
	const activeOffsets = useFileViewStore((s) =>
		s.customLayout ? s.nodeOffsets[layoutOrientation] : null,
	);
	const linkProps = useMemo(
		() =>
			activeOffsets
				? customLinkProps(activeOffsets, layoutOrientation)
				: AUTO_LINK_PROPS,
		[activeOffsets, layoutOrientation],
	);
	const { drag, consumeDragClick } = useNodeDrag(() => getTransform().k);
	const cardDrag = activeOffsets ? drag : undefined;
	const placeCard = useMemo(
		() =>
			activeOffsets
				? (nodeId: string) => customPlacement(activeOffsets, nodeId)
				: autoPlacement,
		[activeOffsets],
	);

	// Recent files for WelcomeScreen — shared with Sidebar via useRecentFiles
	const recentFiles = useRecentFiles();

	// Inline rename state
	const inlineRename = useInlineRename();

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

	// v0.8.2 F6: one zoom step (×1.2 / ÷1.2) about the container centre, from
	// store.requestZoom() via `roadraven:zoom`. Translate and zoom land in one
	// write so the camera stays anchored on what the user is looking at.
	const setViewport = useRoadmapStore((s) => s.setViewport);
	useEffect(() => {
		const handler = (e: Event) => {
			flushViewport();
			const container = containerRef.current;
			if (!container) return;
			const t = getTransform();
			const direction = (e as CustomEvent<"in" | "out">).detail;
			const k = clampZoom(direction === "in" ? t.k * 1.2 : t.k / 1.2);
			if (k === t.k) return;
			const rect = container.getBoundingClientRect();
			const cx = rect.width / 2;
			const cy = rect.height / 2;
			const ratio = k / t.k;
			setViewport(
				{ x: cx - (cx - t.x) * ratio, y: cy - (cy - t.y) * ratio },
				k,
			);
		};
		window.addEventListener("roadraven:zoom", handler);
		return () => window.removeEventListener("roadraven:zoom", handler);
	}, [setViewport, getTransform, flushViewport]);

	// Reveal side of every focus request: expand, wait for mount, measure, pan.
	const panBy = useCallback(
		(dx: number, dy: number) => {
			const t = getTransform();
			animatePanTo({ x: t.x + dx, y: t.y + dy });
		},
		[getTransform, animatePanTo],
	);
	// `inlineRename.open` is a stable useCallback, so handing it over does not
	// re-register the controller on every rename keystroke.
	useCanvasFocusController({
		containerRef,
		panBy,
		openRename: inlineRename.open,
	});

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

	// Wire the keyboard router. F6 moves REAL DOM focus between the canvas and
	// the SidePanel (v0.8.1 Phase 5); it used to shuffle store ids here and
	// leave the caret wherever it already was.
	useKeyboardRouter({ inlineRename, togglePanelFocus });

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
			const rd3t = nodeDatum.__rd3t;
			const isRenaming = inlineRename.state.nodeId === nodeId;
			const placement = placeCard(nodeId);

			return (
				<foreignObject
					width={240}
					height={100}
					{...placement}
					overflow="visible"
				>
					<RoadmapNodeCard
						title={nodeDatum.name}
						status={status as NodeStatus}
						nodeId={nodeId}
						isSelected={selectedNodeId === nodeId}
						isFocused={focusedNodeId === nodeId}
						isTabStop={isTabStop(focusedNodeId, nodeId, rd3t?.depth)}
						isSearchMatch={searchMatchSet.has(nodeId)}
						isSearchCurrent={searchCurrentId === nodeId}
						isSearchDimmed={searchActive && !searchMatchSet.has(nodeId)}
						hasChildren={hasChildren}
						isCollapsed={!!rd3t?.collapsed}
						childCount={children.length}
						density={density}
						onToggle={toggleNode}
						onSelect={() => {
							// The click the browser fires after a real drag.
							if (consumeDragClick()) return;
							requestNodeFocus(nodeId, { align: "nearest", select: true });
						}}
						onDoubleClick={() => {
							inlineRename.open(nodeId);
						}}
						isRenaming={isRenaming}
						// Only the renaming card may see the draft: handing the
						// live text to all 1400 cards would change one prop on
						// every card on every keystroke and defeat their memo.
						renameValue={isRenaming ? inlineRename.state.title : ""}
						onRenameChange={inlineRename.setTitle}
						onRenameCommit={inlineRename.commit}
						onRenameCancel={inlineRename.cancel}
						drag={cardDrag}
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
			density,
			placeCard,
			cardDrag,
			consumeDragClick,
		],
	);

	return (
		<RoadRavenContextMenu>
			<div
				ref={containerRef}
				className="[grid-area:canvas] bg-rv-bg-canvas relative rv-canvas"
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
							{...linkProps}
							separation={separation}
							nodeSize={nodeSize}
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
