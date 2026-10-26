// getRoadmap tree shaping (v0.9.2 D-1, D-4, D-5): pure functions over the app's
// plain result, so `rootId`, `depth` and `hideCompleted` work with any app
// version. Nothing here does I/O; getRoadmapCallback composes them.
import type { AgentErrorPayload } from "./errors";

type TreeNode = {
	id?: unknown;
	title?: unknown;
	status?: unknown;
	type?: unknown;
	children?: TreeNode[];
	[key: string]: unknown;
};

type Stub = {
	id: unknown;
	title: unknown;
	status: unknown;
	type?: unknown;
	childCount: number;
};

export type RoadmapResult = {
	schema: { nodes: TreeNode[]; [key: string]: unknown };
	[key: string]: unknown;
};

type ShapeOptions = {
	rootId?: string;
	depth?: number;
	hideCompleted?: boolean;
};

// One line per node: enough to count done/total and to ask for it with rootId.
function toStub(n: TreeNode): Stub {
	const { id, title, status, type } = n;
	return {
		id,
		title,
		status,
		...(type === undefined ? {} : { type }),
		childCount: n.children?.length ?? 0,
	};
}

// D-4: only a node whose whole subtree is completed may become a stub.
function allCompleted(n: TreeNode): boolean {
	return n.status === "completed" && (n.children ?? []).every(allCompleted);
}

type Found = { node: TreeNode; ancestorIds: unknown[] };

function locate(
	nodes: TreeNode[],
	id: string,
	path: unknown[],
): Found | undefined {
	for (const n of nodes) {
		if (n.id === id) return { node: n, ancestorIds: path };
		const hit = locate(n.children ?? [], id, [...path, n.id]);
		if (hit) return hit;
	}
	return undefined;
}

// Throws the structured error agentToolCallback formats as `Error (node_not_found): …`.
function findSubtree(nodes: TreeNode[], id: string): Found {
	const hit = locate(nodes, id, []);
	if (hit) return hit;
	const error: AgentErrorPayload = {
		code: "node_not_found",
		message: `No node with id "${id}" in the loaded roadmap.`,
		hint: "Call getRoadmap without rootId (or findNodes) to see the node ids.",
	};
	throw error;
}

// `depth` counts levels of children below `nodes` (undefined = no cut).
// hideCompleted is judged on the uncut node, so an open descendant below the
// cut still keeps its completed ancestors expanded (D-4).
function shapeNodes(
	nodes: TreeNode[],
	depth: number | undefined,
	hideCompleted: boolean,
): Array<TreeNode | Stub> {
	return nodes.map((n) =>
		hideCompleted && allCompleted(n)
			? toStub(n)
			: expand(n, depth, hideCompleted),
	);
}

function expand(
	n: TreeNode,
	depth: number | undefined,
	hideCompleted: boolean,
): TreeNode {
	if (!Array.isArray(n.children)) return n;
	const children =
		depth === 0
			? n.children.map(toStub)
			: shapeNodes(
					n.children,
					depth === undefined ? undefined : depth - 1,
					hideCompleted,
				);
	return { ...n, children };
}

const withNodes = (r: RoadmapResult, nodes: Array<TreeNode | Stub>) => ({
	...r,
	schema: { ...r.schema, nodes },
});

// rootId first, then depth and hideCompleted; every other field passes through.
// With no option set the result object itself comes back.
export function shapeRoadmap(
	r: RoadmapResult,
	{ rootId, depth, hideCompleted = false }: ShapeOptions,
): RoadmapResult {
	if (rootId !== undefined) {
		// The rootId node is always expanded; only its descendants can be stubs.
		const { node, ancestorIds } = findSubtree(r.schema.nodes, rootId);
		return {
			...withNodes(r, [expand(node, depth, hideCompleted)]),
			rootId,
			ancestorIds,
		};
	}
	if (depth === undefined && !hideCompleted) return r;
	return withNodes(r, shapeNodes(r.schema.nodes, depth, hideCompleted));
}
