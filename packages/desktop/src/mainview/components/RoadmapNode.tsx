import { memo, useEffect, useRef } from "react";
import type {
	NodeStatus,
	RoadmapNode,
	TypeConfig,
} from "../../../../../packages/core/src/schema";
import {
	STATUS_TOKENS,
	TEXT_NODE_TOKEN,
} from "../../../../../shared/themeContract";
import { isKeyboardNav } from "../hooks/useKeyboardRouter";
import type { NodeDragHandlers } from "../hooks/useNodeDrag";
import {
	CHEVRON_COLLAPSE_LABEL,
	CHEVRON_EXPAND_LABEL,
	NODE_CARD_ATTR,
	NODE_FOCUSED_ATTR,
	NODE_PROGRESS_ATTR,
	NODE_RIBBON_ATTR,
	NODE_STATUS_ATTR,
	NODE_SURFACE_ATTR,
	NODE_TYPE_CHIP_ATTR,
} from "../lib/domContract";
import { requestNodeFocus } from "../lib/focusRequest";
import { countDone, formatAge } from "../lib/nodeProgress";
import { useIsNodeLive, useRoadmapStore } from "../store/roadmapStore";

// Token names come from the shared theme contract (the linter and the
// rendered sampler read the same names). `color` is the general status ink
// (chrome, menus, dialogs — what every consumer outside this card reads);
// `card` is the ink on the card (stripe) and falls back to `color` in the
// CSS `var()` below; `fg` is the ink on the badge fill and falls back to
// `card`, then `color`; `bg` is the badge fill.
const statusTokens = (s: NodeStatus) => ({
	color: STATUS_TOKENS[s].ink,
	card: STATUS_TOKENS[s].card,
	fg: STATUS_TOKENS[s].fg,
	bg: STATUS_TOKENS[s].bg,
});

// Typed as Record<NodeStatus, ...> so the schema's status enum is the single
// source of truth — adding/removing a status in schema.ts forces this map to
// be updated, preventing the silent drift that fallow flagged.
export const STATUS_TOKEN_MAP: Record<
	NodeStatus,
	{ color: string; bg: string; card: string; fg: string }
> = {
	"not-started": statusTokens("not-started"),
	"in-progress": statusTokens("in-progress"),
	completed: statusTokens("completed"),
	blocked: statusTokens("blocked"),
};

// Node ink: a theme with light cards on dark chrome (contrast, moss) sets
// --rv-text-node; every other theme falls through to --rv-text-primary.
const NODE_INK = `var(${TEXT_NODE_TOKEN}, var(--rv-text-primary))`;

// Render a boolean as the string "true" or undefined so a `data-*` attribute
// drops out of the DOM when false. Factored out of the card body because six
// inline `x ? "true" : undefined` ternaries each count toward the component's
// cognitive complexity — a plain call does not.
function dataFlag(on: boolean | undefined): "true" | undefined {
	return on ? "true" : undefined;
}

export function formatStatus(status: string): string {
	return status
		.split("-")
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(" ");
}

// Plugin attribution glyph — small badge in the top-left of the node card,
// right of the stripe (the status ribbon owns the top-right corner).
// Lit when node.plugin.id is set OR a recent live event carried a source within
// the 30s pulse window (D-14). Known sources get a branded letter+color; unknown
// sources fall back to the first letter on slate.
const PLUGIN_GLYPH_STYLES: Record<
	string,
	{ letter: string; bg: string; label: string }
> = {
	"claude-code": {
		letter: "C",
		bg: "var(--rv-plugin-claude-code-bg)",
		label: "Claude Code",
	},
	"github-actions": {
		letter: "G",
		bg: "var(--rv-plugin-github-actions-bg)",
		label: "GitHub Actions",
	},
};

// The store slice the card's progress line and type chip read. Structural so
// the card does not need the store's private state type.
interface CardSource {
	nodeIndex: Map<string, RoadmapNode>;
	liveEventMeta: Record<string, { lastEventAt: number }>;
	schema: { typeConfig?: TypeConfig[] } | null;
}

const LIVE_WINDOW_MS = 30_000;

/**
 * The in-progress card's extra line: `n / m done` over the direct children
 * for a parent, `last event Xs ago` for a leaf inside the live window, else
 * nothing. Children come from `nodeIndex` — in-place status flips do not
 * touch treeData, so react-d3-tree's `nodeDatum.children` is stale (D-02).
 */
function progressText(
	s: CardSource,
	nodeId: string | undefined,
	status: NodeStatus,
): string | null {
	if (status !== "in-progress" || !nodeId) return null;
	const children = s.nodeIndex.get(nodeId)?.children ?? [];
	if (children.length > 0) {
		return `${countDone(children)} / ${children.length} done`;
	}
	const live = s.liveEventMeta[nodeId];
	if (!live) return null;
	const age = Date.now() - live.lastEventAt;
	return age < LIVE_WINDOW_MS ? `last event ${formatAge(age)}` : null;
}

/** The node's type label from `typeConfig`, the raw id when unknown, or null. */
function typeLabel(s: CardSource, nodeId: string | undefined): string | null {
	const type = nodeId ? s.nodeIndex.get(nodeId)?.type : undefined;
	if (!type) return null;
	return s.schema?.typeConfig?.find((t) => t.id === type)?.label ?? type;
}

function pluginGlyphFor(id: string): {
	letter: string;
	bg: string;
	label: string;
} {
	return (
		PLUGIN_GLYPH_STYLES[id] ?? {
			letter: id.charAt(0).toUpperCase() || "?",
			bg: "var(--rv-plugin-default-bg)",
			label: id,
		}
	);
}

interface RoadmapNodeCardProps {
	title: string;
	status: NodeStatus;
	nodeId?: string;
	isSelected?: boolean;
	isFocused?: boolean;
	/**
	 * Roving tabindex (WAI-ARIA tree): exactly one card is in the document tab
	 * order — the focused one, or the root while nothing is focused, so Tab can
	 * still get into the tree. Canvas decides; the card only renders it.
	 */
	isTabStop?: boolean;
	/** True when a node search is active and this node matches the query. */
	isSearchMatch?: boolean;
	/** True when this node is the current (camera-followed) search match. */
	isSearchCurrent?: boolean;
	/** True when a search is active and this node does NOT match (dimmed back). */
	isSearchDimmed?: boolean;
	hasChildren?: boolean;
	isCollapsed?: boolean;
	childCount?: number;
	/** v0.8.4 Phase 2 (LayoutKnobsPopover): card padding only, same font sizes. */
	density?: "comfortable" | "compact";
	onToggle?: () => void;
	onSelect?: () => void;
	onDoubleClick?: () => void;
	// Inline rename: when isRenaming is true, the title slot renders an input
	// instead of the span. Card-matched UX (option A from Plan 03-02 UAT) —
	// replaces the previous InlineRenameInput portal overlay.
	isRenaming?: boolean;
	renameValue?: string;
	onRenameChange?: (v: string) => void;
	onRenameCommit?: () => void;
	onRenameCancel?: () => void;
	/**
	 * v0.8.4 Phase 3: pointer handlers for dragging the card under custom
	 * layout, or undefined (no handlers attached) when it is off. One stable
	 * object from Canvas, so propsEqual's identity check still holds.
	 */
	drag?: NodeDragHandlers;
}

/**
 * Skip a card whose own inputs did not change (v0.8.1 large-tree perf).
 *
 * react-d3-tree rebuilds its `subscriptions` object on every Tree render, so
 * `Node.shouldComponentUpdate` is always true and `renderCustomNodeElement`
 * runs for every mounted node on every Canvas render — a pan frame, a focus
 * write or one typed character re-rendered all 1400 card bodies. The element
 * is still recreated (that is the library's business); this stops the body,
 * its store subscriptions and its DOM diff from running.
 *
 * Function props are compared by intent, not identity: `onSelect` /
 * `onDoubleClick` are fresh arrows on every Canvas render but close over
 * nothing except `nodeId`, which IS compared, and `onToggle` is
 * react-d3-tree's `Node.handleNodeToggle` — a stable instance method that
 * reads `this.props.data.__rd3t.id` when it fires, so it cannot go stale
 * either (verified in react-d3-tree 3.6.6 `lib/esm/Node/index.js`). Every
 * other prop is compared by value, including ones added later.
 */
function propsEqual(a: RoadmapNodeCardProps, b: RoadmapNodeCardProps): boolean {
	const keys = Object.keys(a) as (keyof RoadmapNodeCardProps)[];
	if (keys.length !== Object.keys(b).length) return false;
	for (const key of keys) {
		if (a[key] === b[key]) continue;
		if (typeof a[key] === "function" && typeof b[key] === "function") continue;
		return false;
	}
	return true;
}

export const RoadmapNodeCard = memo(function RoadmapNodeCard({
	title,
	status: propStatus,
	nodeId,
	isSelected,
	isFocused,
	isTabStop,
	isSearchMatch,
	isSearchCurrent,
	isSearchDimmed,
	hasChildren,
	isCollapsed,
	childCount,
	density = "comfortable",
	onToggle,
	onSelect,
	onDoubleClick,
	isRenaming = false,
	renameValue = "",
	onRenameChange,
	onRenameCommit,
	onRenameCancel,
	drag,
}: RoadmapNodeCardProps) {
	const cardRef = useRef<HTMLDivElement>(null);
	const renameInputRef = useRef<HTMLInputElement>(null);
	useEffect(() => {
		if (isRenaming) {
			// preventScroll: `overflow-hidden` does not stop an element being
			// scrolled programmatically, and a plain focus() on a card the camera
			// has not reached yet scrolled the canvas container by the watermark's
			// overflow (P0-6a: scrollLeft 40 on an off-screen create). The
			// container is `overflow: clip` now too — both layers, per the plan.
			renameInputRef.current?.focus({ preventScroll: true });
			renameInputRef.current?.select();
		}
	}, [isRenaming]);
	// Live-status subscription (read-side of the in-place fast-path).
	//
	// `updateNodeStatus` / `updateNodeType` / `updateNodeMetadata` /
	// `updateNodeNotes` mutate `schema.nodes` in place and bump `statusTick`
	// without touching `treeData` — that's the D-02 performance contract so
	// status flips don't trigger react-d3-tree's deep-clone on every change.
	// The side-effect is that `propStatus` (sourced from the treeData snapshot
	// react-d3-tree passes to renderCustomNodeElement) goes stale. Subscribe
	// to the tick here so every in-place write re-runs this selector and the
	// card re-reads the live value from `nodeIndex`. Only the card whose node
	// actually changed returns a new string, so zustand re-renders it alone —
	// other cards' selectors return the same string and skip the update.
	//
	// Future phases (03-03 SidePanel editor, 04 Event API, v1.1 plugins) can
	// extend this by reading additional in-place fields (title, notes, type,
	// metadata) from the live node rather than introducing new dataKey bumps.
	const liveStatus = useRoadmapStore((s) => {
		void s.statusTick;
		return nodeId
			? (s.nodeIndex.get(nodeId)?.status ?? propStatus)
			: propStatus;
	});
	const status = liveStatus as NodeStatus;
	const tokens = STATUS_TOKEN_MAP[status] ?? STATUS_TOKEN_MAP["not-started"];
	// Ink on the card: the status stripe (index.css `.node::before`).
	const statusCard = `var(${tokens.card}, var(${tokens.color}))`;
	// Ink on the badge fill: badge text, badge dot, chevron text and border.
	const statusFg = `var(${tokens.fg}, ${statusCard})`;

	// Live pulse: true iff this node received an event within the last 30s (D-14/D-15).
	// Re-evaluates on every 1Hz liveTick bump from App.tsx setInterval.
	const isLive = useIsNodeLive(nodeId ?? "");

	// Plugin glyph attribution. Live source wins inside the 30s pulse window
	// (so a `meta.source` from a fresh updateNodeStatus lights the badge even
	// if node.plugin is unset). Falls back to the persistent schema slot.
	const pluginGlyph = useRoadmapStore((s) => {
		void s.statusTick;
		void s.liveTick;
		if (!nodeId) return null;
		const live = s.liveEventMeta[nodeId];
		if (
			live &&
			Date.now() - live.lastEventAt < 30_000 &&
			typeof live.source === "string"
		) {
			return live.source;
		}
		const plugin = s.nodeIndex.get(nodeId)?.plugin;
		if (
			plugin &&
			typeof plugin === "object" &&
			"id" in plugin &&
			typeof (plugin as { id: unknown }).id === "string"
		) {
			return (plugin as { id: string }).id;
		}
		return null;
	});

	// Progress line and type chip: same in-place read as the status above
	// (`updateNodeStatus` on a child and `updateNodeType` bump statusTick, not
	// dataKey). Both return a string or null, so only a changed card updates.
	const progress = useRoadmapStore((s) => {
		void s.statusTick;
		void s.liveTick;
		return progressText(s, nodeId, status);
	});
	const typeChip = useRoadmapStore((s) => {
		void s.statusTick;
		return typeLabel(s, nodeId);
	});

	return (
		<div
			ref={cardRef}
			className={`node relative min-w-[180px] max-w-[220px] rounded-[var(--node-radius,8px)] border-[length:var(--rv-border-width,1px)] border-[color:var(--rv-border)] bg-[var(--rv-bg-node)] select-none transition-[box-shadow,border-color,background] duration-150 hover:bg-[var(--rv-bg-node-hover)] group ${density === "compact" ? "pl-3 pr-2 py-[6px]" : "pl-4 pr-3 py-[10px]"} ${isSelected ? "outline outline-2 -outline-offset-1 outline-[var(--rv-accent)]" : ""}`}
			{...{
				[NODE_CARD_ATTR]: nodeId,
				[NODE_FOCUSED_ATTR]: dataFlag(isFocused),
				[NODE_SURFACE_ATTR]: "node",
				[NODE_STATUS_ATTR]: status,
			}}
			data-selected={dataFlag(isSelected)}
			data-live={dataFlag(isLive)}
			data-search-match={dataFlag(isSearchMatch)}
			data-search-current={dataFlag(isSearchCurrent)}
			data-search-dim={dataFlag(isSearchDimmed)}
			style={
				{
					// index.css sets --node-shadow on in-progress cards.
					boxShadow: "var(--node-shadow, var(--rv-shadow-node))",
					color: NODE_INK,
					"--node-stripe-color": statusCard,
					"--badge-color": statusFg,
					"--badge-bg": `var(${tokens.bg})`,
				} as React.CSSProperties
			}
			role="treeitem"
			aria-selected={isSelected}
			tabIndex={isTabStop ? 0 : -1}
			aria-label={title}
			onClick={onSelect}
			onDoubleClick={onDoubleClick}
			// onPointerDown/Move/Up/Cancel, or nothing at all when undefined.
			{...drag}
			onFocus={(e) => {
				// Focus that arrives natively — Tab into the tree, Shift+Tab back,
				// a mouse-down before the click handler runs — must not leave the
				// store behind (RC8). `focusin` bubbles, so ignore the rename
				// input's own focus.
				if (!nodeId || e.target !== e.currentTarget) return;
				// The device decides whether the camera moves too. A pointer
				// focus lands BEFORE the click handler's own `nearest` + `select`
				// request, so revealing here would be the double-pan RC3 removed;
				// it also cannot land on a card the user cannot see, because the
				// user clicked it. Keyboard focus is the opposite: Tab can put
				// focus on an off-screen card, and `overflow: clip` means the
				// browser will not scroll it into view either — so it reveals,
				// even when this card is already the logical target.
				const keyboard = isKeyboardNav();
				if (!keyboard && useRoadmapStore.getState().focusedNodeId === nodeId)
					return;
				requestNodeFocus(nodeId, { align: keyboard ? "nearest" : "none" });
			}}
			onKeyDown={(e) => {
				if (e.key === "Enter" || e.key === " ") {
					e.preventDefault();
					onSelect?.();
				}
			}}
		>
			{/* Status ribbon — a 45° band across the top-right corner in the
			   stripe's ink. Clipped by its own wrapper, never by `.node`: the
			   pulse ring (.node::after) and the search outline paint outside
			   the card. Decorative; the badge says the status in words. Divs, not
			   spans: the title stays the card's first span, which existing
			   specs and the sampler read. */}
			<div aria-hidden="true" className="node-ribbon-clip">
				<div
					className="node-ribbon"
					{...{ [NODE_RIBBON_ATTR]: "" }}
					style={{ backgroundColor: statusCard }}
				/>
			</div>

			{/* Plugin attribution glyph — top-left, right of the stripe. Hidden
			   when no plugin id is on the node and no fresh live source is in the
			   30s window. */}
			{pluginGlyph &&
				(() => {
					const g = pluginGlyphFor(pluginGlyph);
					return (
						<span
							className="absolute top-1.5 left-[10px] inline-flex items-center justify-center w-[16px] h-[16px] rounded-full text-[9px] font-bold text-white pointer-events-none select-none shadow-sm"
							style={{ background: g.bg }}
							data-plugin-id={pluginGlyph}
							role="img"
							aria-label={`Plugin: ${g.label}`}
							title={`Connected via ${g.label}`}
						>
							{g.letter}
						</span>
					);
				})()}

			{/* Title — swaps to an inline input when renaming. The input borrows
			   the span's typography + height so the card doesn't reflow; an
			   accent bottom border is the only visible affordance. Right-pad
			   keeps the first line clear of the ribbon; left-pad widens when a
			   plugin glyph is shown so the title doesn't collide. */}
			{isRenaming ? (
				<input
					ref={renameInputRef}
					type="text"
					value={renameValue}
					onChange={(e) => onRenameChange?.(e.target.value)}
					onClick={(e) => e.stopPropagation()}
					onDoubleClick={(e) => e.stopPropagation()}
					onMouseDown={(e) => e.stopPropagation()}
					onKeyDown={(e) => {
						e.stopPropagation();
						// A8: Enter and Escape hand focus back to the card, so the
						// keyboard user is never dropped on <body>. The blur path
						// below deliberately does not — a blur means the user
						// clicked somewhere else and meant it.
						if (e.key === "Enter") {
							e.preventDefault();
							onRenameCommit?.();
							cardRef.current?.focus({ preventScroll: true });
						} else if (e.key === "Escape") {
							e.preventDefault();
							onRenameCancel?.();
							cardRef.current?.focus({ preventScroll: true });
						}
					}}
					onBlur={() => onRenameCommit?.()}
					placeholder="Enter title…"
					aria-label="Rename node"
					className={`block w-full text-[13px] font-semibold leading-[1.3] mb-[6px] bg-transparent border-0 border-b-2 border-[var(--rv-accent)] outline-none px-0 py-0 pr-4 ${pluginGlyph ? "pl-4" : ""}`}
					style={{ color: NODE_INK }}
				/>
			) : (
				<span
					className={`block text-[13px] font-semibold leading-[1.3] mb-[6px] pr-4 ${pluginGlyph ? "pl-4" : ""}`}
					style={{ color: NODE_INK }}
				>
					{title}
				</span>
			)}

			{/* Type chip — card ink, smaller, on a subtle border. Card ink, not
			   --rv-text-secondary: on the light-card themes that is chrome ink. */}
			{typeChip && (
				<span
					className="inline-block align-middle max-w-[80px] truncate mr-[6px] px-[6px] py-[1px] rounded-[6px] border border-[color:var(--rv-border)] text-[10px] font-normal leading-[1.4]"
					{...{ [NODE_TYPE_CHIP_ATTR]: "" }}
					style={{ color: NODE_INK }}
				>
					{typeChip}
				</span>
			)}

			{/* Badge pill */}
			<span className="inline-flex align-middle items-center gap-[5px] px-2 py-[2px] rounded-[10px] text-[11px] font-semibold bg-[var(--badge-bg)] text-[var(--badge-color)]">
				<span className="w-1.5 h-1.5 rounded-full bg-[var(--badge-color)]" />
				{formatStatus(status)}
			</span>

			{/* Progress line — in-progress cards only (see progressText). */}
			{progress && (
				<div
					className="mt-[4px] text-[11px] font-normal leading-[1.3]"
					{...{ [NODE_PROGRESS_ATTR]: "" }}
					style={{ color: NODE_INK }}
				>
					{progress}
				</div>
			)}

			{/* Collapse/expand chevron */}
			{hasChildren && (
				<button
					className="absolute bottom-1.5 right-1.5 flex items-center gap-1 px-2 py-[3px] rounded-[6px] border transition-colors duration-150"
					type="button"
					// WAI-ARIA tree pattern (https://www.w3.org/WAI/ARIA/apg/patterns/treeview/):
					// only the treeitem itself is tabbable. Expand/collapse activates
					// via Enter or Right/Left arrow on the row, or mouse-click on this
					// chevron. Without tabIndex=-1 the chevron is in the document tab
					// cycle and Shift+Tab from a child treeitem lands here instead of
					// the parent treeitem (BUG-1, manual a11y finding 2026-05-04).
					tabIndex={-1}
					aria-label={
						isCollapsed ? CHEVRON_EXPAND_LABEL : CHEVRON_COLLAPSE_LABEL
					}
					style={{
						backgroundColor: `var(${tokens.bg})`,
						borderColor: statusFg,
						color: statusFg,
					}}
					onClick={(e) => {
						e.stopPropagation();
						onToggle?.();
					}}
				>
					<svg
						aria-hidden="true"
						width="12"
						height="12"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="2.5"
						strokeLinecap="round"
						strokeLinejoin="round"
					>
						{isCollapsed ? (
							<polyline points="9 18 15 12 9 6" />
						) : (
							<polyline points="6 9 12 15 18 9" />
						)}
					</svg>
					{childCount !== undefined && childCount > 0 && (
						<span className="text-[11px] font-bold">{childCount}</span>
					)}
				</button>
			)}
		</div>
	);
}, propsEqual);
