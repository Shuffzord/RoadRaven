import type {
	NodeStatus,
	RoadmapNode,
	RoadmapSchema,
} from "../../../../packages/core/src/schema";

const STATUSES: NodeStatus[] = [
	"not-started",
	"in-progress",
	"completed",
	"blocked",
];

/**
 * Generate a schema with approximately `totalNodes` nodes.
 * Tree structure: each node gets `childrenPerNode` children until `totalNodes` is reached.
 * Produces deterministic output for reproducible benchmarks (uses counter-based IDs).
 */
export function generateLargeSchema(
	totalNodes = 300,
	childrenPerNode = 4,
): RoadmapSchema {
	let nodeCount = 0;

	function generateNode(depth: number): RoadmapNode {
		const id = `node-${nodeCount}`;
		const node: RoadmapNode = {
			id,
			title: `Node ${nodeCount}`,
			status: STATUSES[nodeCount % STATUSES.length],
			type: depth === 0 ? "milestone" : "task",
			createdAt: "2026-01-01T00:00:00Z",
			updatedAt: "2026-04-15T00:00:00Z",
		};
		nodeCount++;

		if (nodeCount < totalNodes && depth < 6) {
			const childCount = Math.min(childrenPerNode, totalNodes - nodeCount);
			node.children = [];
			for (let i = 0; i < childCount && nodeCount < totalNodes; i++) {
				node.children.push(generateNode(depth + 1));
			}
		}

		return node;
	}

	const root = generateNode(0);

	return {
		version: "1.0",
		title: "Benchmark Schema",
		statusConfig: [
			{ id: "not-started", label: "Not Started" },
			{ id: "in-progress", label: "In Progress" },
			{ id: "completed", label: "Completed" },
			{ id: "blocked", label: "Blocked" },
		],
		nodes: [root],
	};
}

/**
 * Collect all node IDs from a schema for random access during benchmark.
 */
export function collectNodeIds(schema: RoadmapSchema): string[] {
	const ids: string[] = [];
	function walk(nodes: RoadmapNode[]) {
		for (const node of nodes) {
			ids.push(node.id);
			if (node.children) walk(node.children);
		}
	}
	walk(schema.nodes);
	return ids;
}
