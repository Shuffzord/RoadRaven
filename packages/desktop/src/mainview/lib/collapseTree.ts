/**
 * Collapse math for the canvas (v0.8.4 Phase 4). Pure: the file-view store
 * owns the collapsed set, Canvas hands react-d3-tree the pruned tree, and
 * the library never holds collapse state of its own (RC1).
 */
import type { RawNodeDatum } from "react-d3-tree";

/** The id / children shape every roadmap node has. */
interface TreeNode {
	id: string;
	children?: readonly TreeNode[];
}

function datumId(datum: RawNodeDatum): string {
	return datum.attributes?.id as string;
}

/**
 * The tree react-d3-tree is given: every collapsed node keeps its card but
 * loses `children`, and records what it hid in `attributes.childCount`
 * (direct children) and `attributes.hasChildren`. Untouched subtrees are
 * shared, and with nothing collapsed the SAME object comes back, so an
 * unchanged set costs the tree no re-clone.
 */
export function pruneCollapsed(
	datum: RawNodeDatum,
	collapsedIds: ReadonlySet<string>,
): RawNodeDatum {
	if (collapsedIds.size === 0) return datum;
	return pruneNode(datum, collapsedIds);
}

function pruneNode(
	datum: RawNodeDatum,
	collapsedIds: ReadonlySet<string>,
): RawNodeDatum {
	const children = datum.children;
	if (!children || children.length === 0) return datum;
	if (collapsedIds.has(datumId(datum))) {
		const { children: _hidden, ...rest } = datum;
		return {
			...rest,
			attributes: {
				...datum.attributes,
				childCount: children.length,
				hasChildren: true,
			},
		};
	}
	const next = children.map((child) => pruneNode(child, collapsedIds));
	return next.every((child, i) => child === children[i])
		? datum
		: { ...datum, children: next };
}

/**
 * Direct children a rendered node has — including the ones a collapse hid,
 * which `pruneCollapsed` recorded because the node's `children` is gone.
 */
export function shownChildCount(datum: RawNodeDatum): number {
	const hidden = datum.attributes?.childCount;
	return typeof hidden === "number" ? hidden : (datum.children?.length ?? 0);
}

/** Ids of the nodes at `depth` (roots are depth 0) that have children. */
export function idsAtDepth(
	nodes: readonly TreeNode[],
	depth: number,
): string[] {
	const out: string[] = [];
	const walk = (list: readonly TreeNode[], d: number): void => {
		for (const node of list) {
			const kids = node.children ?? [];
			if (d === depth) {
				if (kids.length > 0) out.push(node.id);
			} else {
				walk(kids, d + 1);
			}
		}
	};
	walk(nodes, 0);
	return out;
}

/** Ids of every node that has children — what "Collapse all" collapses. */
export function parentIds(nodes: readonly TreeNode[]): string[] {
	const out: string[] = [];
	const walk = (list: readonly TreeNode[]): void => {
		for (const node of list) {
			if (node.children && node.children.length > 0) {
				out.push(node.id);
				walk(node.children);
			}
		}
	};
	walk(nodes);
	return out;
}

/** The ancestors on a top-down path that are collapsed and must open. */
export function ancestorsToExpand(
	pathTopDown: readonly string[],
	collapsedIds: ReadonlySet<string>,
): string[] {
	return pathTopDown.filter((id) => collapsedIds.has(id));
}
