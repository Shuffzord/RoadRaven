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

	// Viewport state for Fit View
	translate: { x: number; y: number };
	zoomLevel: number;

	// Schema validation errors
	schemaErrors: Array<{ path: string; message: string; code: string }>;

	// Status change counter — incremented on updateNodeStatus to trigger re-renders
	statusTick: number;

	// Actions -- structural (increment dataKey)
	loadSchema: (schema: RoadmapSchema, filePath: string) => void;
	reloadSchema: (schema: RoadmapSchema) => void;

	// Actions -- in-place (no dataKey change)
	updateNodeStatus: (nodeId: string, status: string) => void;
	setSelectedNode: (id: string | null) => void;
	setLayout: (orientation: "TB" | "LR") => void;
	getSelectedNode: () => RoadmapNode | undefined;
	getNodeCount: () => number;

	// Viewport actions
	resetView: () => void;
	setTranslate: (translate: { x: number; y: number }) => void;
	setZoomLevel: (zoom: number) => void;

	// Schema error actions
	setSchemaErrors: (
		errors: Array<{ path: string; message: string; code: string }>,
	) => void;
}

export const INITIAL_STATE = {
	schema: null as RoadmapSchema | null,
	filePath: null as string | null,
	treeData: null as RawNodeDatum | null,
	dataKey: "0",
	nodeIndex: new Map<string, RoadmapNode>(),
	selectedNodeId: null as string | null,
	layoutOrientation: "TB" as const,
	isPanelPinned: false,
	translate: { x: 400, y: 50 },
	zoomLevel: 0.8,
	schemaErrors: [] as Array<{ path: string; message: string; code: string }>,
	statusTick: 0,
};

export const useRoadmapStore = create<RoadmapState>((set, get) => ({
	...INITIAL_STATE,

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
			statusTick: 0,
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
			statusTick: 0,
		});
	},

	updateNodeStatus: (nodeId, status) => {
		const node = get().nodeIndex.get(nodeId);
		if (!node) return;
		if (node.status === status) return;
		// Mutate in-place -- do NOT increment dataKey or create new treeData ref.
		// This is the critical performance path per D-02: status-only updates
		// bypass react-d3-tree's deep-clone by keeping the same data reference.
		// NOTE: Canvas.tsx currently reads status from treeData.attributes (stale copy).
		// Phase 3 must update renderCustomNode to read from nodeIndex + statusTick.
		node.status = status as RoadmapNode["status"];
		set({ statusTick: get().statusTick + 1 });
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

	resetView: () => {
		// Center the root node in the canvas area.
		// Canvas occupies the area after the sidebar (~40px) and below the topbar (~50px).
		const canvasWidth =
			typeof window !== "undefined" ? window.innerWidth - 40 : 800;
		const canvasHeight =
			typeof window !== "undefined" ? window.innerHeight - 50 - 26 : 600;
		set({
			translate: { x: canvasWidth / 2, y: canvasHeight / 3 },
			zoomLevel: 0.8,
		});
	},

	setTranslate: (translate) => set({ translate }),

	setZoomLevel: (zoom) => set({ zoomLevel: zoom }),

	setSchemaErrors: (errors) => set({ schemaErrors: errors }),
}));
