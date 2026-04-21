import * as ContextMenuPrimitive from "@radix-ui/react-context-menu";
import type { ReactNode } from "react";
import { useShallow } from "zustand/react/shallow";
import { dispatchOpenRename } from "../hooks/useInlineRename";
import { useRoadmapStore } from "../store/roadmapStore";

const DEFAULT_STATUSES: ReadonlyArray<{ id: string; label: string }> = [
	{ id: "not-started", label: "Not Started" },
	{ id: "in-progress", label: "In Progress" },
	{ id: "completed", label: "Completed" },
	{ id: "blocked", label: "Blocked" },
];

const MENU_SURFACE_CLASS =
	"min-w-[200px] max-w-[280px] py-1 bg-[var(--rv-bg-elevated)] border border-[var(--rv-border)] rounded-[8px] shadow-[var(--rv-shadow-config)] z-[9000] will-change-transform";
const ITEM_CLASS =
	"flex items-center justify-between h-[28px] px-3 text-[13px] text-[var(--rv-text-primary)] select-none cursor-default outline-none data-[highlighted]:bg-[var(--rv-accent-muted)] data-[highlighted]:text-[var(--rv-text-primary)] data-[disabled]:text-[var(--rv-text-tertiary)] data-[disabled]:pointer-events-none";
const ITEM_DESTRUCTIVE_CLASS =
	"flex items-center justify-between h-[28px] px-3 text-[13px] text-[var(--rv-status-blocked)] select-none cursor-default outline-none data-[highlighted]:bg-[var(--rv-accent-muted)]";
const HINT_CLASS = "text-[11px] text-[var(--rv-text-tertiary)] ml-4";
const SEP_CLASS = "h-px my-1 bg-[var(--rv-border-subtle)]";

interface RoadRavenContextMenuProps {
	children: ReactNode;
	/** Called on right-click with the target node id (from data-source-id); null = canvas background. */
	onOpen: (targetNodeId: string | null) => void;
	targetNodeId: string | null;
}

export function RoadRavenContextMenu({
	children,
	onOpen,
	targetNodeId,
}: RoadRavenContextMenuProps) {
	return (
		<ContextMenuPrimitive.Root
			onOpenChange={(open) => {
				if (!open) onOpen(null);
			}}
		>
			<ContextMenuPrimitive.Trigger
				asChild
				onContextMenu={(e) => {
					const el = (e.target as Element)?.closest?.(
						"[data-source-id]",
					) as HTMLElement | null;
					onOpen(el?.dataset.sourceId ?? null);
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

export function NodeMenuItems({ nodeId }: { nodeId: string }) {
	const {
		addChild,
		addSiblingAbove,
		addSiblingBelow,
		duplicateNode,
		copySubtreeToClipboard,
		pasteFromClipboard,
		moveNodeUp,
		moveNodeDown,
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
			requestDelete: s.requestDelete,
			updateNodeStatus: s.updateNodeStatus,
		})),
	);
	const canPaste = useRoadmapStore((s) => s.lastCopiedSubtree !== null);
	const schema = useRoadmapStore((s) => s.schema);

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
				onSelect={() => openRename(nodeId)}
			>
				<span>Rename</span>
				<span className={HINT_CLASS}>F2</span>
			</ContextMenuPrimitive.Item>
			<ContextMenuPrimitive.Separator className={SEP_CLASS} />
			<ContextMenuPrimitive.Item
				className={ITEM_CLASS}
				onSelect={() => autoRename(addChild(nodeId))}
			>
				<span>Add Child</span>
				<span className={HINT_CLASS}>Enter</span>
			</ContextMenuPrimitive.Item>
			<ContextMenuPrimitive.Item
				className={ITEM_CLASS}
				onSelect={() => autoRename(addSiblingAbove(nodeId))}
			>
				<span>Add Sibling Above</span>
				<span className={HINT_CLASS}>Shift+Enter</span>
			</ContextMenuPrimitive.Item>
			<ContextMenuPrimitive.Item
				className={ITEM_CLASS}
				onSelect={() => autoRename(addSiblingBelow(nodeId))}
			>
				<span>Add Sibling Below</span>
				<span className={HINT_CLASS}>Tab</span>
			</ContextMenuPrimitive.Item>
			<ContextMenuPrimitive.Separator className={SEP_CLASS} />
			<ContextMenuPrimitive.Item
				className={ITEM_CLASS}
				onSelect={() => autoRename(duplicateNode(nodeId))}
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
				<span
					className={HINT_CLASS}
					style={{ color: "var(--rv-status-blocked)", opacity: 0.6 }}
				>
					Del
				</span>
			</ContextMenuPrimitive.Item>
		</>
	);
}

export function CanvasMenuItems() {
	const { pasteFromClipboard, setLayout, resetView, addChild } =
		useRoadmapStore(
			useShallow((s) => ({
				pasteFromClipboard: s.pasteFromClipboard,
				setLayout: s.setLayout,
				resetView: s.resetView,
				addChild: s.addChild,
			})),
		);
	const layoutOrientation = useRoadmapStore((s) => s.layoutOrientation);
	const canPaste = useRoadmapStore((s) => s.lastCopiedSubtree !== null);
	const rootId = useRoadmapStore((s) => s.schema?.nodes?.[0]?.id ?? null);

	return (
		<>
			<ContextMenuPrimitive.Item
				className={ITEM_CLASS}
				disabled={!canPaste}
				onSelect={() => {
					void pasteFromClipboard(null);
				}}
			>
				<span>Paste</span>
				<span className={HINT_CLASS}>Ctrl+V</span>
			</ContextMenuPrimitive.Item>
			<ContextMenuPrimitive.Item
				className={ITEM_CLASS}
				disabled={!rootId}
				onSelect={() => {
					if (rootId) autoRename(addChild(rootId));
				}}
			>
				<span>Add Root Child</span>
				<span className={HINT_CLASS}>Enter</span>
			</ContextMenuPrimitive.Item>
			<ContextMenuPrimitive.Separator className={SEP_CLASS} />
			<ContextMenuPrimitive.Item
				className={ITEM_CLASS}
				onSelect={() => resetView()}
			>
				<span>Fit to View</span>
			</ContextMenuPrimitive.Item>
			<ContextMenuPrimitive.Item
				className={ITEM_CLASS}
				onSelect={() => setLayout(layoutOrientation === "TB" ? "LR" : "TB")}
			>
				<span>Toggle Layout</span>
			</ContextMenuPrimitive.Item>
		</>
	);
}

function openRename(nodeId: string) {
	useRoadmapStore.getState().setFocusedNode(nodeId);
	dispatchOpenRename(nodeId);
}

function autoRename(newId: string | null | undefined) {
	if (!newId) return;
	openRename(newId);
}
