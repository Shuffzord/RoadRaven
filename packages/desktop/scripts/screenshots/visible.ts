import type { RawNodeDatum } from "react-d3-tree";
import { pruneCollapsed } from "../../src/mainview/lib/collapseTree";

interface TreeNode {
	id: string;
	children?: readonly TreeNode[];
}

/** The id-only datum `pruneCollapsed` reads (`attributes.id`, `children`). */
const toDatum = (node: TreeNode): RawNodeDatum => ({
	name: node.id,
	attributes: { id: node.id },
	children: node.children?.map(toDatum),
});

const countCards = (datum: RawNodeDatum): number =>
	1 + (datum.children ?? []).reduce((sum, child) => sum + countCards(child), 0);

/**
 * Cards the canvas renders for `nodes` with `collapsedIds` folded: the app's
 * own `pruneCollapsed` over its first root, as the canvas does.
 */
export function visibleCardCount(
	nodes: readonly TreeNode[],
	collapsedIds: ReadonlySet<string>,
): number {
	return nodes[0]
		? countCards(pruneCollapsed(toDatum(nodes[0]), collapsedIds))
		: 0;
}
