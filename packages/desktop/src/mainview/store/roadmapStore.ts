import type { RawNodeDatum } from "react-d3-tree";
import { create } from "zustand";
import type {
	RoadmapNode,
	RoadmapSchema,
} from "../../../../../packages/core/src/schema";

/**
 * Convert a RoadmapNode to a react-d3-tree RawNodeDatum.
 * Maps title -> name and stores all custom data in attributes.
 */
export function toTreeDatum(node: RoadmapNode): RawNodeDatum {
	return {
		name: node.title,
		attributes: {
			id: node.id,
			status: node.status,
			type: node.type ?? "",
			notes: node.notes ?? "",
			createdAt: node.createdAt ?? "",
			updatedAt: node.updatedAt ?? "",
		},
		children: node.children?.map(toTreeDatum),
	};
}

/**
 * Flatten a tree of RoadmapNodes into a Map keyed by node.id.
 * Used for O(1) lookups during in-place status updates.
 */
export function buildNodeIndex(nodes: RoadmapNode[]): Map<string, RoadmapNode> {
	const index = new Map<string, RoadmapNode>();

	function walk(nodeList: RoadmapNode[]): void {
		for (const node of nodeList) {
			index.set(node.id, node);
			if (node.children) {
				walk(node.children);
			}
		}
	}

	walk(nodes);
	return index;
}

interface RoadmapState {
	// Document data
	schema: RoadmapSchema | null;
	filePath: string | null;
	treeData: RawNodeDatum | null;
	dataKey: string;
	nodeIndex: Map<string, RoadmapNode>;

	// UI state
	selectedNodeId: string | null;
	layoutOrientation: "TB" | "LR";
	isPanelPinned: boolean;

	// Actions -- structural (increment dataKey)
	loadSchema: (schema: RoadmapSchema, filePath: string) => void;
	reloadSchema: (schema: RoadmapSchema) => void;

	// Actions -- in-place (no dataKey change)
	updateNodeStatus: (nodeId: string, status: string) => void;
	setSelectedNode: (id: string | null) => void;
	setLayout: (orientation: "TB" | "LR") => void;
	getSelectedNode: () => RoadmapNode | undefined;
	getNodeCount: () => number;
}

export const useRoadmapStore = create<RoadmapState>((set, get) => ({
	// Initial state
	schema: null,
	filePath: null,
	treeData: null,
	dataKey: "0",
	nodeIndex: new Map(),
	selectedNodeId: null,
	layoutOrientation: "TB",
	isPanelPinned: false,

	loadSchema: (schema, filePath) => {
		const treeData = schema.nodes[0] ? toTreeDatum(schema.nodes[0]) : null;
		const nodeIndex = buildNodeIndex(schema.nodes);
		const nextKey = String(Number(get().dataKey) + 1);
		set({
			schema,
			filePath,
			treeData,
			nodeIndex,
			dataKey: nextKey,
		});
	},

	reloadSchema: (schema) => {
		const treeData = schema.nodes[0] ? toTreeDatum(schema.nodes[0]) : null;
		const nodeIndex = buildNodeIndex(schema.nodes);
		const nextKey = String(Number(get().dataKey) + 1);
		set({
			schema,
			treeData,
			nodeIndex,
			dataKey: nextKey,
		});
	},

	updateNodeStatus: (nodeId, status) => {
		const node = get().nodeIndex.get(nodeId);
		if (!node) return;
		// Mutate in-place -- do NOT increment dataKey or create new treeData ref.
		// This is the critical performance path per D-02: status-only updates
		// bypass react-d3-tree's deep-clone by keeping the same data reference.
		node.status = status as RoadmapNode["status"];
		set({});
	},

	setSelectedNode: (id) => {
		set({ selectedNodeId: id });
	},

	setLayout: (orientation) => {
		set({ layoutOrientation: orientation });
	},

	getSelectedNode: () => {
		const { nodeIndex, selectedNodeId } = get();
		return nodeIndex.get(selectedNodeId ?? "");
	},

	getNodeCount: () => {
		return get().nodeIndex.size;
	},
}));
