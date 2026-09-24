import * as ContextMenuPrimitive from "@radix-ui/react-context-menu";
import { type ReactNode, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { parentIds } from "../lib/collapseTree";
import {
	CHEVRON_COLLAPSE_LABEL,
	CHEVRON_EXPAND_LABEL,
	COLLAPSE_ALL_LABEL,
	collapseToDepthLabel,
	EXPAND_ALL_LABEL,
	INDENT_LABEL,
	OUTDENT_LABEL,
	REDO_LABEL,
	UNDO_LABEL,
} from "../lib/domContract";
import { trackMenuFocus } from "../lib/focusHandoff";
import { requestNodeFocus } from "../lib/focusRequest";
import { getNodeCollapseState, toggleNodeCollapse } from "../lib/nodeCollapse";
import { indentTarget, outdentTarget } from "../lib/treeEdits";
import { useFileViewStore } from "../store/fileViewStore";
import { useHistoryStore } from "../store/historyStore";
import { useRoadmapStore } from "../store/roadmapStore";
import {
	HINT_CLASS,
	ITEM_CLASS,
	ITEM_DESTRUCTIVE_CLASS,
	MENU_SURFACE_CLASS,
	SEP_CLASS,
} from "./menuStyles";

const DEFAULT_STATUSES: ReadonlyArray<{ id: string; label: string }> = [
	{ id: "not-started", label: "Not Started" },
	{ id: "in-progress", label: "In Progress" },
	{ id: "completed", label: "Completed" },
	{ id: "blocked", label: "Blocked" },
];

/** "Collapse to depth N" items on the canvas-empty menu. */
const COLLAPSE_DEPTHS = [1, 2] as const;

interface RoadRavenContextMenuProps {
	children: ReactNode;
}

export function RoadRavenContextMenu({ children }: RoadRavenContextMenuProps) {
	// Target of the most recent right-click — null when opened on empty canvas.
	// Picks the node-vs-canvas content below, and nothing else needs it, so it
	// lives here. As Canvas state (until v0.8.1's perf pass) every right-click
	// re-rendered Canvas -> Tree -> every mounted card: 1400 card renders and
	// ~100 ms of React work on a large tree, to choose between two menus.
	// Children arrive as the same element reference on a state change of this
	// component, so React skips the canvas subtree entirely.
	const [targetNodeId, setTargetNodeId] = useState<string | null>(null);
	return (
		<ContextMenuPrimitive.Root
			onOpenChange={(open) => {
				if (!open) setTargetNodeId(null);
				// A menu that closes without stating a focus intent hands DOM
				// focus back to the canvas card, one frame later — see
				// lib/focusHandoff.ts for why Radix's own restore stays off.
				trackMenuFocus(open);
			}}
		>
			<ContextMenuPrimitive.Trigger
				asChild
				onContextMenu={(e) => {
					const el = (e.target as Element)?.closest?.(
						"[data-source-id]",
					) as HTMLElement | null;
					setTargetNodeId(el?.dataset.sourceId ?? null);
				}}
			>
				{children}
			</ContextMenuPrimitive.Trigger>
			<ContextMenuPrimitive.Portal>
				<ContextMenuPrimitive.Content
					className={MENU_SURFACE_CLASS}
					aria-label={targetNodeId ? "Node actions" : "Canvas actions"}
					collisionPadding={8}
					// Prevent Radix from restoring focus to the trigger (the
					// node card) when the menu closes. For create-then-rename
					// this would race the inline-rename input and blur it
					// immediately, committing the placeholder. For other
					// close paths (Escape, click outside) the user's next
					// interaction decides focus; losing the trigger-restore
					// is acceptable.
					onCloseAutoFocus={(event) => event.preventDefault()}
				>
					{targetNodeId ? (
						<NodeMenuItems nodeId={targetNodeId} />
					) : (
						<CanvasMenuItems />
					)}
				</ContextMenuPrimitive.Content>
			</ContextMenuPrimitive.Portal>
		</ContextMenuPrimitive.Root>
	);
}

function NodeMenuItems({ nodeId }: { nodeId: string }) {
	const {
		addChild,
		addSiblingAbove,
		addSiblingBelow,
		duplicateNode,
		copySubtreeToClipboard,
		pasteFromClipboard,
		moveNodeUp,
		moveNodeDown,
		indentNode,
		outdentNode,
		requestDelete,
		updateNodeStatus,
	} = useRoadmapStore(
		useShallow((s) => ({
			addChild: s.addChild,
			addSiblingAbove: s.addSiblingAbove,
			addSiblingBelow: s.addSiblingBelow,
			duplicateNode: s.duplicateNode,
			copySubtreeToClipboard: s.copySubtreeToClipboard,
			pasteFromClipboard: s.pasteFromClipboard,
			moveNodeUp: s.moveNodeUp,
			moveNodeDown: s.moveNodeDown,
			indentNode: s.indentNode,
			outdentNode: s.outdentNode,
			requestDelete: s.requestDelete,
			updateNodeStatus: s.updateNodeStatus,
		})),
	);
	const canPaste = useRoadmapStore((s) => s.lastCopiedSubtree !== null);
	const schema = useRoadmapStore((s) => s.schema);
	// v0.8.4 Phase 5: disabled exactly when the keyboard shortcut would no-op.
	const canIndent = schema
		? indentTarget(schema.nodes, nodeId) !== null
		: false;
	const canOutdent = schema
		? outdentTarget(schema.nodes, nodeId) !== null
		: false;
	// Snapshot collapse state once when the menu opens (fileViewStore owns it;
	// see lib/nodeCollapse.ts).
	const [collapse] = useState(() => getNodeCollapseState(nodeId));

	// Paste enabled when the in-memory buffer has content. System clipboard
	// is tried inside pasteFromClipboard (try/catch) — Pitfall 6.
	const statuses =
		schema?.statusConfig && schema.statusConfig.length > 0
			? schema.statusConfig
			: DEFAULT_STATUSES;

	return (
		<>
			<ContextMenuPrimitive.Item
				className={ITEM_CLASS}
				// `nearest`: renaming a node the user is looking at must not whip
				// the camera, but an off-screen one is revealed before its input
				// opens. The reveal also defers past the menu's focus trap (RC4).
				onSelect={() =>
					requestNodeFocus(nodeId, { align: "nearest", rename: true })
				}
			>
				<span>Rename</span>
				<span className={HINT_CLASS}>F2</span>
			</ContextMenuPrimitive.Item>
			<ContextMenuPrimitive.Separator className={SEP_CLASS} />
			{collapse.hasChildren && (
				<>
					<ContextMenuPrimitive.Item
						className={ITEM_CLASS}
						onSelect={() => toggleNodeCollapse(nodeId)}
					>
						<span>
							{collapse.collapsed
								? CHEVRON_EXPAND_LABEL
								: CHEVRON_COLLAPSE_LABEL}
						</span>
						<span className={HINT_CLASS}>C</span>
					</ContextMenuPrimitive.Item>
					<ContextMenuPrimitive.Separator className={SEP_CLASS} />
				</>
			)}
			<ContextMenuPrimitive.Item
				className={ITEM_CLASS}
				onSelect={() => renameNewNode(addChild(nodeId))}
			>
				<span>Add Child</span>
				<span className={HINT_CLASS}>Enter</span>
			</ContextMenuPrimitive.Item>
			<ContextMenuPrimitive.Item
				className={ITEM_CLASS}
				onSelect={() => renameNewNode(addSiblingAbove(nodeId))}
			>
				<span>Add Sibling Above</span>
				<span className={HINT_CLASS}>Shift+Enter</span>
			</ContextMenuPrimitive.Item>
			<ContextMenuPrimitive.Item
				className={ITEM_CLASS}
				onSelect={() => renameNewNode(addSiblingBelow(nodeId))}
			>
				<span>Add Sibling Below</span>
				<span className={HINT_CLASS}>Tab</span>
			</ContextMenuPrimitive.Item>
			<ContextMenuPrimitive.Separator className={SEP_CLASS} />
			<ContextMenuPrimitive.Item
				className={ITEM_CLASS}
				onSelect={() => renameNewNode(duplicateNode(nodeId))}
			>
				<span>Duplicate</span>
				<span className={HINT_CLASS}>Ctrl+D</span>
			</ContextMenuPrimitive.Item>
			<ContextMenuPrimitive.Item
				className={ITEM_CLASS}
				onSelect={() => {
					void copySubtreeToClipboard(nodeId);
				}}
			>
				<span>Copy</span>
				<span className={HINT_CLASS}>Ctrl+C</span>
			</ContextMenuPrimitive.Item>
			<ContextMenuPrimitive.Item
				className={ITEM_CLASS}
				disabled={!canPaste}
				onSelect={() => {
					void pasteFromClipboard(nodeId);
				}}
			>
				<span>Paste</span>
				<span className={HINT_CLASS}>Ctrl+V</span>
			</ContextMenuPrimitive.Item>
			<ContextMenuPrimitive.Separator className={SEP_CLASS} />
			<ContextMenuPrimitive.Item
				className={ITEM_CLASS}
				onSelect={() => moveNodeUp(nodeId)}
			>
				<span>Move Up</span>
				<span className={HINT_CLASS}>Ctrl+↑</span>
			</ContextMenuPrimitive.Item>
			<ContextMenuPrimitive.Item
				className={ITEM_CLASS}
				onSelect={() => moveNodeDown(nodeId)}
			>
				<span>Move Down</span>
				<span className={HINT_CLASS}>Ctrl+↓</span>
			</ContextMenuPrimitive.Item>
			<ContextMenuPrimitive.Item
				className={ITEM_CLASS}
				disabled={!canIndent}
				onSelect={() => indentNode(nodeId)}
			>
				<span>{INDENT_LABEL}</span>
			</ContextMenuPrimitive.Item>
			<ContextMenuPrimitive.Item
				className={ITEM_CLASS}
				disabled={!canOutdent}
				onSelect={() => outdentNode(nodeId)}
			>
				<span>{OUTDENT_LABEL}</span>
			</ContextMenuPrimitive.Item>
			<ContextMenuPrimitive.Separator className={SEP_CLASS} />
			<ContextMenuPrimitive.Sub>
				<ContextMenuPrimitive.SubTrigger className={ITEM_CLASS}>
					<span>Change Status</span>
					<svg
						width={12}
						height={12}
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth={2}
						aria-hidden="true"
					>
						<title>Open submenu</title>
						<polyline points="9 18 15 12 9 6" />
					</svg>
				</ContextMenuPrimitive.SubTrigger>
				<ContextMenuPrimitive.Portal>
					<ContextMenuPrimitive.SubContent
						className={MENU_SURFACE_CLASS}
						aria-label="Change status"
						collisionPadding={8}
					>
						{statuses.map((s) => (
							<ContextMenuPrimitive.Item
								key={s.id}
								className={ITEM_CLASS}
								onSelect={() => updateNodeStatus(nodeId, s.id)}
							>
								<span>{s.label}</span>
							</ContextMenuPrimitive.Item>
						))}
					</ContextMenuPrimitive.SubContent>
				</ContextMenuPrimitive.Portal>
			</ContextMenuPrimitive.Sub>
			<ContextMenuPrimitive.Separator className={SEP_CLASS} />
			<ContextMenuPrimitive.Item
				className={ITEM_DESTRUCTIVE_CLASS}
				style={{ color: "var(--rv-status-blocked)" }}
				onSelect={() => requestDelete(nodeId)}
			>
				<span>Delete</span>
				{/* Hint uses standard tertiary color (not red+opacity) so the
				    keyboard shortcut meets WCAG 2.1 AA contrast on menu surface (D-20). */}
				<span className={HINT_CLASS}>Del</span>
			</ContextMenuPrimitive.Item>
		</>
	);
}

function CanvasMenuItems() {
	const { pasteFromClipboard, setLayout, fitView, addChild } = useRoadmapStore(
		useShallow((s) => ({
			pasteFromClipboard: s.pasteFromClipboard,
			setLayout: s.setLayout,
			fitView: s.fitView,
			addChild: s.addChild,
		})),
	);
	const layoutOrientation = useRoadmapStore((s) => s.layoutOrientation);
	const canPaste = useRoadmapStore((s) => s.lastCopiedSubtree !== null);
	const rootId = useRoadmapStore((s) => s.schema?.nodes?.[0]?.id ?? null);
	// v0.8.4 Phase 4: tree-wide collapse. Nodes are read when the item fires,
	// so the menu itself never re-renders on an edit.
	const nodes = () => useRoadmapStore.getState().schema?.nodes ?? [];
	const view = useFileViewStore.getState;
	// v0.8.4 Phase 6: disabled exactly when Ctrl+Z / Ctrl+Y would no-op.
	const canUndo = useHistoryStore((s) => s.past.length > 0);
	const canRedo = useHistoryStore((s) => s.future.length > 0);

	return (
		<>
			<ContextMenuPrimitive.Item
				className={ITEM_CLASS}
				disabled={!canUndo}
				onSelect={() => revealHistoryStep("undo")}
			>
				<span>{UNDO_LABEL}</span>
				<span className={HINT_CLASS}>Ctrl+Z</span>
			</ContextMenuPrimitive.Item>
			<ContextMenuPrimitive.Item
				className={ITEM_CLASS}
				disabled={!canRedo}
				onSelect={() => revealHistoryStep("redo")}
			>
				<span>{REDO_LABEL}</span>
				<span className={HINT_CLASS}>Ctrl+Y</span>
			</ContextMenuPrimitive.Item>
			<ContextMenuPrimitive.Separator className={SEP_CLASS} />
			<ContextMenuPrimitive.Item
				className={ITEM_CLASS}
				disabled={!canPaste || !rootId}
				onSelect={() => {
					if (rootId) void pasteFromClipboard(rootId);
				}}
			>
				<span>Paste</span>
				<span className={HINT_CLASS}>Ctrl+V</span>
			</ContextMenuPrimitive.Item>
			<ContextMenuPrimitive.Item
				className={ITEM_CLASS}
				disabled={!rootId}
				onSelect={() => {
					if (rootId) renameNewNode(addChild(rootId));
				}}
			>
				<span>Add Root Child</span>
				<span className={HINT_CLASS}>Enter</span>
			</ContextMenuPrimitive.Item>
			<ContextMenuPrimitive.Separator className={SEP_CLASS} />
			{/* v0.8.1 D3: the bounding-box fit over the mounted cards, the same
			    command the TopBar's Fit button and MCP cameraFitView issue. */}
			<ContextMenuPrimitive.Item
				className={ITEM_CLASS}
				onSelect={() => fitView()}
			>
				<span>Fit to View</span>
			</ContextMenuPrimitive.Item>
			<ContextMenuPrimitive.Item
				className={ITEM_CLASS}
				onSelect={() => setLayout(layoutOrientation === "TB" ? "LR" : "TB")}
			>
				<span>Toggle Layout</span>
			</ContextMenuPrimitive.Item>
			<ContextMenuPrimitive.Separator className={SEP_CLASS} />
			<ContextMenuPrimitive.Item
				className={ITEM_CLASS}
				disabled={!rootId}
				onSelect={() => view().expandAll()}
			>
				<span>{EXPAND_ALL_LABEL}</span>
			</ContextMenuPrimitive.Item>
			<ContextMenuPrimitive.Item
				className={ITEM_CLASS}
				disabled={!rootId}
				onSelect={() => view().collapseAll(parentIds(nodes()))}
			>
				<span>{COLLAPSE_ALL_LABEL}</span>
			</ContextMenuPrimitive.Item>
			{COLLAPSE_DEPTHS.map((depth) => (
				<ContextMenuPrimitive.Item
					key={depth}
					className={ITEM_CLASS}
					disabled={!rootId}
					onSelect={() => view().collapseToDepth(depth, nodes())}
				>
					<span>{collapseToDepthLabel(depth)}</span>
				</ContextMenuPrimitive.Item>
			))}
		</>
	);
}

/**
 * Create-and-rename: reveal the new node in the middle of the canvas and open
 * its rename input there (RC4).
 *
 * One request replaces the old `setFocusedNode` + `roadraven:open-rename`
 * pair, which left the camera out of it entirely. `center` because a fresh
 * node is a jump-to, not a neighbour. The store returns null when it refused
 * the create (no schema, unknown parent), so the guard stays.
 */
function renameNewNode(newId: string | null | undefined) {
	if (!newId) return;
	requestNodeFocus(newId, { align: "center", rename: true });
}

/** Undo/redo, then reveal the node it touched (the store focused it). */
function revealHistoryStep(direction: "undo" | "redo") {
	const target = useRoadmapStore.getState()[direction]();
	if (target) requestNodeFocus(target, { align: "nearest", select: true });
}
