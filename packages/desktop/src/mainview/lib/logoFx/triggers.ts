import {
	LOGO_FX_ACTION,
	LOGO_FX_BATCH_MIN,
	LOGO_FX_VARIANT,
	type LogoFxAction,
	type LogoFxVariant,
} from "./constants";

/**
 * Which effect each app action plays (D-1). Change the mapping here; nothing
 * else names a variant for an action.
 */
export const LOGO_FX_TRIGGERS: Record<LogoFxAction, LogoFxVariant> = {
	[LOGO_FX_ACTION.AGENT_CONNECTED]: LOGO_FX_VARIANT.CIRCUIT_PULSE,
	[LOGO_FX_ACTION.NODE_COMPLETED]: LOGO_FX_VARIANT.SHIMMER,
	[LOGO_FX_ACTION.PHASE_COMPLETED]: LOGO_FX_VARIANT.STATUS_AURORA,
	[LOGO_FX_ACTION.FILE_OPENED]: LOGO_FX_VARIANT.POWER_SURGE,
	[LOGO_FX_ACTION.AGENT_BATCH]: LOGO_FX_VARIANT.POWER_SURGE,
	[LOGO_FX_ACTION.NODE_BLOCKED]: LOGO_FX_VARIANT.GLITCH,
	[LOGO_FX_ACTION.SAVE_FAILED]: LOGO_FX_VARIANT.GLITCH,
	[LOGO_FX_ACTION.IDLE]: LOGO_FX_VARIANT.BIT_DRIFT,
};

/**
 * The order one update's actions are reported in, most specific first. Only
 * the first one is played (equal-priority effects never queue).
 */
const PRECEDENCE: readonly LogoFxAction[] = [
	LOGO_FX_ACTION.FILE_OPENED,
	LOGO_FX_ACTION.SAVE_FAILED,
	LOGO_FX_ACTION.NODE_BLOCKED,
	LOGO_FX_ACTION.PHASE_COMPLETED,
	LOGO_FX_ACTION.AGENT_BATCH,
	LOGO_FX_ACTION.AGENT_CONNECTED,
	LOGO_FX_ACTION.NODE_COMPLETED,
];

/** What a node looked like when the snapshot was taken. */
export interface NodeFacts {
	status: string;
	updatedAt?: string;
	parentId: string | null;
	childIds: readonly string[];
}

/**
 * The store slices the triggers compare. Statuses are copied because the
 * store edits node objects in place.
 */
export interface LogoFxSnapshot {
	nodes: ReadonlyMap<string, NodeFacts>;
	/** Bumped by every load or reload; a change resets the status baseline. */
	baseline: number;
	/** Bumped by every loadSchema of a file on disk. */
	opened: number;
	saveState: string;
	connectedCount: number;
}

/** The parts of a roadmap node the triggers read. */
interface TreeNode {
	id: string;
	status: string;
	updatedAt?: string;
	children?: readonly TreeNode[];
}

/** O(n) copy of every node's status, updatedAt and place in the tree. */
export function snapshotNodes(
	roots: readonly TreeNode[],
): Map<string, NodeFacts> {
	const out = new Map<string, NodeFacts>();
	const walk = (list: readonly TreeNode[], parentId: string | null) => {
		for (const node of list) {
			const children = node.children ?? [];
			out.set(node.id, {
				status: node.status,
				updatedAt: node.updatedAt,
				parentId,
				childIds: children.map((c) => c.id),
			});
			walk(children, node.id);
		}
	};
	walk(roots, null);
	return out;
}

/** The roadmap store fields that tell a load apart from an edit. */
export interface LoadSignals {
	nodeIndex: unknown;
	dataKey: string;
	lastSavedDataKey: string;
	statusTick: number;
	liveEventMeta: unknown;
	filePath: string | null;
}

/**
 * "open" for a loadSchema of a file on disk, "reload" for any other load
 * (reloadSchema, a new untitled roadmap, a sample), null for an edit. A load
 * swaps the node index and starts clean (dataKey saved, statusTick 0); only
 * loadSchema also replaces the live-event map.
 */
export function classifyLoad(
	prev: LoadSignals,
	next: LoadSignals,
): "open" | "reload" | null {
	const fresh =
		next.nodeIndex !== prev.nodeIndex &&
		next.dataKey === next.lastSavedDataKey &&
		next.statusTick === 0;
	if (!fresh) return null;
	const opened =
		next.liveEventMeta !== prev.liveEventMeta && next.filePath !== null;
	return opened ? "open" : "reload";
}

const isSaveError = (state: string): boolean => state.startsWith("error-");

function allChildrenCompleted(
	nodes: ReadonlyMap<string, NodeFacts>,
	parentId: string | null,
): boolean {
	const parent = parentId === null ? undefined : nodes.get(parentId);
	if (!parent) return false;
	return parent.childIds.every((id) => nodes.get(id)?.status === "completed");
}

/** The action a node's status change performs, if any. */
function statusAction(
	nodes: ReadonlyMap<string, NodeFacts>,
	before: NodeFacts,
	node: NodeFacts,
): LogoFxAction | null {
	if (before.status === node.status) return null;
	if (node.status === "blocked") return LOGO_FX_ACTION.NODE_BLOCKED;
	if (node.status !== "completed") return null;
	return allChildrenCompleted(nodes, node.parentId)
		? LOGO_FX_ACTION.PHASE_COMPLETED
		: LOGO_FX_ACTION.NODE_COMPLETED;
}

const isChanged = (before: NodeFacts, node: NodeFacts): boolean =>
	before.status !== node.status || before.updatedAt !== node.updatedAt;

/** [before, after] for each node in both snapshots that changed. O(n). */
function changedNodes(
	prev: LogoFxSnapshot,
	next: LogoFxSnapshot,
): Array<[NodeFacts, NodeFacts]> {
	const out: Array<[NodeFacts, NodeFacts]> = [];
	for (const [id, node] of next.nodes) {
		const before = prev.nodes.get(id);
		if (before && isChanged(before, node)) out.push([before, node]);
	}
	return out;
}

/** Status changes and batch size between two snapshots of the same tree. */
function nodeActions(
	prev: LogoFxSnapshot,
	next: LogoFxSnapshot,
	found: Set<LogoFxAction>,
): void {
	if (prev.nodes === next.nodes || prev.baseline !== next.baseline) return;
	const changed = changedNodes(prev, next);
	for (const [before, node] of changed) {
		const action = statusAction(next.nodes, before, node);
		if (action) found.add(action);
	}
	if (changed.length >= LOGO_FX_BATCH_MIN) {
		found.add(LOGO_FX_ACTION.AGENT_BATCH);
	}
}

/**
 * The app actions one store update performed, most specific first. A load
 * reports only file-opened: the statuses it brings are a new baseline, not
 * completions.
 */
export function detectActions(
	prev: LogoFxSnapshot,
	next: LogoFxSnapshot,
): LogoFxAction[] {
	if (next.opened !== prev.opened) return [LOGO_FX_ACTION.FILE_OPENED];
	const found = new Set<LogoFxAction>();
	nodeActions(prev, next, found);
	if (isSaveError(next.saveState) && !isSaveError(prev.saveState)) {
		found.add(LOGO_FX_ACTION.SAVE_FAILED);
	}
	if (next.connectedCount > prev.connectedCount) {
		found.add(LOGO_FX_ACTION.AGENT_CONNECTED);
	}
	return PRECEDENCE.filter((action) => found.has(action));
}
