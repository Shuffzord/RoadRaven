/**
 * Undo/redo entries (v0.8.4 Phase 6) — pure, no store imports.
 *
 * Inverse operations, not snapshots: in-place mutations write into node
 * objects (D-02), so a snapshot holding node references would drift, and a
 * deep clone per edit is too expensive on a large tree. Each entry holds just
 * what it takes to run it backwards; `invert(entry)` is that backwards entry,
 * so undo and redo are one code path applied in opposite directions.
 * Subtrees are stored by reference (O(1) per edit), never cloned.
 */

import type {
	NodeStatus,
	RoadmapNode,
} from "../../../../../packages/core/src/schema";
import { isDescendantOf } from "./treeWalk";

/** How many user edits the history keeps; the oldest drops off first. */
export const HISTORY_LIMIT = 50;
/** Consecutive notes/rename edits of one node this close together are one step. */
export const COALESCE_MS = 1000;

type Stamp = { at: number };

type Placement = {
	parentId: string | null;
	index: number;
	subtree: RoadmapNode;
};

type FieldEdit<K extends string, V> = Stamp & {
	kind: K;
	nodeId: string;
	before: V;
	after: V;
};

/** Running it inserts `subtree` under `parentId` at `index`. */
type CreateEntry = Stamp & Placement & { kind: "create" };
/** Running it removes `subtree` (by id). */
type DeleteEntry = Stamp & Placement & { kind: "delete" };
/** Parent ids are null at the root level. */
type MoveEntry = Stamp & {
	kind: "move";
	nodeId: string;
	fromParentId: string | null;
	fromIndex: number;
	toParentId: string | null;
	/** Index in the target's children AFTER the node left its old place. */
	toIndex: number;
};

export type HistoryEntry =
	| CreateEntry
	| DeleteEntry
	| MoveEntry
	| FieldEdit<"rename", string>
	| FieldEdit<"status", NodeStatus>
	| FieldEdit<"type", string | undefined>
	| FieldEdit<"metadata", Record<string, unknown> | undefined>
	| FieldEdit<"notes", string | undefined>;

/** An entry before `push` stamps it. */
export type UnstampedEntry = HistoryEntry extends infer E
	? E extends HistoryEntry
		? Omit<E, "at">
		: never
	: never;

export type HistoryDirection = "undo" | "redo";

/** The entry that undoes `entry`. `invert(invert(e))` equals `e`. */
export function invert(entry: HistoryEntry): HistoryEntry {
	switch (entry.kind) {
		case "create":
			return { ...entry, kind: "delete" };
		case "delete":
			return { ...entry, kind: "create" };
		case "move":
			return {
				...entry,
				fromParentId: entry.toParentId,
				fromIndex: entry.toIndex,
				toParentId: entry.fromParentId,
				toIndex: entry.fromIndex,
			};
		default:
			return {
				...entry,
				before: entry.after,
				after: entry.before,
			} as HistoryEntry;
	}
}

/**
 * `next` folded into `prev` when both are notes (or both renames) of the same
 * node within COALESCE_MS: the earlier `before`, the newer `after` and time.
 * `null` when they stay two steps.
 */
export function coalesce(
	prev: HistoryEntry | undefined,
	next: HistoryEntry,
): HistoryEntry | null {
	if (next.kind !== "notes" && next.kind !== "rename") return null;
	if (prev?.kind !== next.kind || prev.nodeId !== next.nodeId) return null;
	if (next.at - prev.at > COALESCE_MS) return null;
	return { ...next, before: prev.before } as HistoryEntry;
}

/**
 * Whether running `entry` against the current tree still makes sense. An
 * agent or live event may have removed a node (or re-parented one) since the
 * user's edit; such an entry is skipped instead of half-applied.
 */
export function isApplicable(
	entry: HistoryEntry,
	nodeIndex: ReadonlyMap<string, RoadmapNode>,
): boolean {
	switch (entry.kind) {
		case "create":
			return (
				(entry.parentId === null || nodeIndex.has(entry.parentId)) &&
				!nodeIndex.has(entry.subtree.id)
			);
		case "delete":
			return nodeIndex.has(entry.subtree.id);
		case "move":
			return (
				nodeIndex.has(entry.nodeId) &&
				(entry.toParentId === null ||
					(nodeIndex.has(entry.toParentId) &&
						!isDescendantOf(nodeIndex, entry.nodeId, entry.toParentId)))
			);
		default:
			return nodeIndex.has(entry.nodeId);
	}
}

/**
 * The node to focus after running `entry`: the inserted node, the parent of a
 * removed one (null at root level), otherwise the node that changed.
 */
export function focusTargetOf(entry: HistoryEntry): string | null {
	if (entry.kind === "create") return entry.subtree.id;
	if (entry.kind === "delete") return entry.parentId;
	return entry.nodeId;
}
