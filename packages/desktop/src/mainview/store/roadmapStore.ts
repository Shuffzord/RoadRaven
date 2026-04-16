import type { RawNodeDatum } from "react-d3-tree";
import { create } from "zustand";
import type {
	RoadmapNode,
	RoadmapSchema,
} from "../../../../../packages/core/src/schema";
import { parseSubtree, refreshNodeIds, serializeSubtree } from "./clipboard";

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

// ----------------------------------------------------------------------------
// Internal helpers -- tree walking + node construction
// ----------------------------------------------------------------------------

function makeNewNode(title = "Untitled"): RoadmapNode {
	const now = new Date().toISOString();
	return {
		id: crypto.randomUUID(),
		title,
		status: "not-started",
		createdAt: now,
		updatedAt: now,
	};
}

type ParentLookup = {
	parent: RoadmapNode | null;
	parentArray: RoadmapNode[];
	index: number;
};

/**
 * Locate a node's parent-array + index (or `null` if not found).
 * For root-level targets returns { parent: null, parentArray: nodes, index }.
 */
export function findParentAndIndex(
	nodes: RoadmapNode[],
	nodeId: string,
): ParentLookup | null {
	// Check root level first
	for (let i = 0; i < nodes.length; i++) {
		if (nodes[i].id === nodeId) {
			return { parent: null, parentArray: nodes, index: i };
		}
	}
	// Recurse into children
	function walk(list: RoadmapNode[]): ParentLookup | null {
		for (const node of list) {
			if (node.children) {
				for (let i = 0; i < node.children.length; i++) {
					if (node.children[i].id === nodeId) {
						return { parent: node, parentArray: node.children, index: i };
					}
				}
				const deeper = walk(node.children);
				if (deeper) return deeper;
			}
		}
		return null;
	}
	return walk(nodes);
}

function countSubtree(node: RoadmapNode): number {
	let count = 1;
	if (node.children) {
		for (const c of node.children) count += countSubtree(c);
	}
	return count;
}

/**
 * Immutably replace the children array under a specific parent (or root-level
 * if parentId is null). Returns a new root array sharing sibling references
 * outside the mutated path.
 */
function immutablyReplaceArray(
	nodes: RoadmapNode[],
	parentId: string | null,
	mutator: (arr: RoadmapNode[]) => RoadmapNode[],
): RoadmapNode[] {
	if (parentId === null) {
		return mutator(nodes);
	}
	return nodes.map((node) => {
		if (node.id === parentId) {
			return { ...node, children: mutator(node.children ?? []) };
		}
		if (node.children) {
			const replaced = immutablyReplaceArray(node.children, parentId, mutator);
			if (replaced !== node.children) {
				return { ...node, children: replaced };
			}
		}
		return node;
	});
}

/**
 * Immutably update a specific node in the tree via updater (for renameNode).
 */
function immutablyUpdateNode(
	nodes: RoadmapNode[],
	nodeId: string,
	updater: (n: RoadmapNode) => RoadmapNode,
): RoadmapNode[] {
	return nodes.map((node) => {
		if (node.id === nodeId) {
			return updater(node);
		}
		if (node.children) {
			const replaced = immutablyUpdateNode(node.children, nodeId, updater);
			if (replaced !== node.children) {
				return { ...node, children: replaced };
			}
		}
		return node;
	});
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
	focusedNodeId: string | null;
	layoutOrientation: "TB" | "LR";
	isPanelPinned: boolean;

	// Viewport state for Fit View
	translate: { x: number; y: number };
	zoomLevel: number;

	// Schema validation errors
	schemaErrors: Array<{ path: string; message: string; code: string }>;

	// Status change counter — incremented on updateNodeStatus to trigger re-renders
	statusTick: number;

	// Pending delete confirmation (non-leaf delete)
	pendingConfirmation: {
		nodeId: string;
		nodeTitle: string;
		deletedCount: number;
	} | null;

	// In-memory clipboard buffer fallback (A2)
	lastCopiedSubtree: RoadmapNode | null;

	// Actions -- structural (increment dataKey)
	loadSchema: (schema: RoadmapSchema, filePath: string) => void;
	reloadSchema: (schema: RoadmapSchema) => void;
	addChild: (parentId: string, title?: string) => string | null;
	addSiblingAbove: (nodeId: string) => string | null;
	addSiblingBelow: (nodeId: string) => string | null;
	deleteNode: (nodeId: string) => { deletedCount: number };
	requestDelete: (nodeId: string) => void;
	confirmDelete: () => void;
	cancelDelete: () => void;
	duplicateNode: (nodeId: string) => string | null;
	moveNodeUp: (nodeId: string) => void;
	moveNodeDown: (nodeId: string) => void;
	renameNode: (nodeId: string, title: string) => void;

	// Actions -- in-place (no dataKey change)
	updateNodeStatus: (nodeId: string, status: string) => void;
	updateNodeType: (nodeId: string, type: string) => void;
	updateNodeMetadata: (
		nodeId: string,
		metadata: Record<string, unknown>,
	) => void;
	updateNodeNotes: (nodeId: string, notes: string) => void;
	setSelectedNode: (id: string | null) => void;
	setFocusedNode: (id: string | null) => void;
	setLayout: (orientation: "TB" | "LR") => void;
	getSelectedNode: () => RoadmapNode | undefined;
	getNodeCount: () => number;

	// Clipboard actions
	copySubtreeToClipboard: (nodeId: string) => Promise<void>;
	pasteFromClipboard: (parentId: string | null) => Promise<string | null>;

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
	focusedNodeId: null as string | null,
	layoutOrientation: "TB" as const,
	isPanelPinned: false,
	translate: { x: 400, y: 50 },
	zoomLevel: 0.8,
	schemaErrors: [] as Array<{ path: string; message: string; code: string }>,
	statusTick: 0,
	pendingConfirmation: null as {
		nodeId: string;
		nodeTitle: string;
		deletedCount: number;
	} | null,
	lastCopiedSubtree: null as RoadmapNode | null,
};

export const useRoadmapStore = create<RoadmapState>((set, get) => {
	/**
	 * Apply a structural mutation to schema.nodes: rebuild nodeIndex + treeData,
	 * bump dataKey. All mutations that change tree structure call this.
	 */
	function bumpStructural(
		nextNodes: RoadmapNode[],
		options?: { preserveNodeIndex?: boolean },
	): void {
		const currentSchema = get().schema;
		if (!currentSchema) return;
		const treeData = nextNodes[0] ? toTreeDatum(nextNodes[0]) : null;
		const nextKey = String(Number(get().dataKey) + 1);
		if (options?.preserveNodeIndex) {
			set({
				schema: { ...currentSchema, nodes: nextNodes },
				treeData,
				dataKey: nextKey,
			});
		} else {
			set({
				schema: { ...currentSchema, nodes: nextNodes },
				treeData,
				dataKey: nextKey,
				nodeIndex: buildNodeIndex(nextNodes),
			});
		}
	}

	return {
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
				focusedNodeId: null,
				pendingConfirmation: null,
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
				focusedNodeId: null,
				pendingConfirmation: null,
			});
		},

		// --- Structural mutations ------------------------------------------------

		addChild: (parentId, title) => {
			const schema = get().schema;
			if (!schema) return null;
			const nodes = schema.nodes;
			const found = findParentAndIndex(nodes, parentId);
			if (!found) return null;
			const newNode = makeNewNode(title);
			const nextNodes = immutablyReplaceArray(nodes, parentId, (children) => [
				...children,
				newNode,
			]);
			bumpStructural(nextNodes);
			return newNode.id;
		},

		addSiblingAbove: (nodeId) => {
			const schema = get().schema;
			if (!schema) return null;
			const nodes = schema.nodes;
			const found = findParentAndIndex(nodes, nodeId);
			if (!found) return null;
			const newNode = makeNewNode();
			const parentId = found.parent ? found.parent.id : null;
			const nextNodes = immutablyReplaceArray(nodes, parentId, (arr) => {
				const copy = [...arr];
				copy.splice(found.index, 0, newNode);
				return copy;
			});
			bumpStructural(nextNodes);
			return newNode.id;
		},

		addSiblingBelow: (nodeId) => {
			const schema = get().schema;
			if (!schema) return null;
			const nodes = schema.nodes;
			const found = findParentAndIndex(nodes, nodeId);
			if (!found) return null;
			const newNode = makeNewNode();
			const parentId = found.parent ? found.parent.id : null;
			const nextNodes = immutablyReplaceArray(nodes, parentId, (arr) => {
				const copy = [...arr];
				copy.splice(found.index + 1, 0, newNode);
				return copy;
			});
			bumpStructural(nextNodes);
			return newNode.id;
		},

		deleteNode: (nodeId) => {
			const schema = get().schema;
			if (!schema) return { deletedCount: 0 };
			const nodes = schema.nodes;
			const found = findParentAndIndex(nodes, nodeId);
			if (!found) return { deletedCount: 0 };
			const target = found.parentArray[found.index];
			// No-op when deleting the last remaining root node
			if (!found.parent && nodes.length === 1) {
				return { deletedCount: 0 };
			}
			const deletedCount = countSubtree(target);
			const parentId = found.parent ? found.parent.id : null;
			const nextNodes = immutablyReplaceArray(nodes, parentId, (arr) => {
				const copy = [...arr];
				copy.splice(found.index, 1);
				return copy;
			});
			// Track selection/focus clearing — evaluated BEFORE bumpStructural mutates state
			const prev = get();
			const clearSel = prev.selectedNodeId === nodeId;
			const clearFocus = prev.focusedNodeId === nodeId;
			bumpStructural(nextNodes);
			if (clearSel || clearFocus) {
				set({
					selectedNodeId: clearSel ? null : prev.selectedNodeId,
					focusedNodeId: clearFocus ? null : prev.focusedNodeId,
				});
			}
			return { deletedCount };
		},

		requestDelete: (nodeId) => {
			const node = get().nodeIndex.get(nodeId);
			if (!node) return;
			const childCount = node.children?.length ?? 0;
			if (childCount === 0) {
				get().deleteNode(nodeId);
				return;
			}
			set({
				pendingConfirmation: {
					nodeId,
					nodeTitle: node.title,
					deletedCount: countSubtree(node),
				},
			});
		},

		confirmDelete: () => {
			const pending = get().pendingConfirmation;
			if (!pending) return;
			get().deleteNode(pending.nodeId);
			set({ pendingConfirmation: null });
		},

		cancelDelete: () => {
			set({ pendingConfirmation: null });
		},

		duplicateNode: (nodeId) => {
			const schema = get().schema;
			if (!schema) return null;
			const nodes = schema.nodes;
			const found = findParentAndIndex(nodes, nodeId);
			if (!found) return null;
			const source = found.parentArray[found.index];
			const clone = refreshNodeIds(source);
			const parentId = found.parent ? found.parent.id : null;
			const nextNodes = immutablyReplaceArray(nodes, parentId, (arr) => {
				const copy = [...arr];
				copy.splice(found.index + 1, 0, clone);
				return copy;
			});
			bumpStructural(nextNodes);
			return clone.id;
		},

		moveNodeUp: (nodeId) => {
			const schema = get().schema;
			if (!schema) return;
			const nodes = schema.nodes;
			const found = findParentAndIndex(nodes, nodeId);
			if (!found || found.index === 0) return;
			// Mutate parentArray IN PLACE — preserves nodeIndex entries
			// (they reference the same parent/child node objects) while
			// making .children order reflect the swap.
			const arr = found.parentArray;
			const tmp = arr[found.index - 1];
			arr[found.index - 1] = arr[found.index];
			arr[found.index] = tmp;
			// Bump dataKey + rebuild treeData so react-d3-tree re-renders,
			// but keep the same nodeIndex Map instance.
			bumpStructural(nodes, { preserveNodeIndex: true });
		},

		moveNodeDown: (nodeId) => {
			const schema = get().schema;
			if (!schema) return;
			const nodes = schema.nodes;
			const found = findParentAndIndex(nodes, nodeId);
			if (!found) return;
			const len = found.parentArray.length;
			if (found.index >= len - 1) return;
			const arr = found.parentArray;
			const tmp = arr[found.index + 1];
			arr[found.index + 1] = arr[found.index];
			arr[found.index] = tmp;
			bumpStructural(nodes, { preserveNodeIndex: true });
		},

		renameNode: (nodeId, title) => {
			const trimmed = title.trim();
			if (!trimmed) return;
			const schema = get().schema;
			if (!schema) return;
			const now = new Date().toISOString();
			const nextNodes = immutablyUpdateNode(schema.nodes, nodeId, (n) => ({
				...n,
				title: trimmed,
				updatedAt: now,
			}));
			bumpStructural(nextNodes);
		},

		// --- In-place mutations --------------------------------------------------

		updateNodeStatus: (nodeId, status) => {
			const node = get().nodeIndex.get(nodeId);
			if (!node) return;
			if (node.status === status) return;
			// Mutate in-place -- do NOT increment dataKey or create new treeData ref.
			// This is the critical performance path per D-02: status-only updates
			// bypass react-d3-tree's deep-clone by keeping the same data reference.
			node.status = status as RoadmapNode["status"];
			set({ statusTick: get().statusTick + 1 });
		},

		updateNodeType: (nodeId, type) => {
			const node = get().nodeIndex.get(nodeId);
			if (!node) return;
			node.type = type;
			node.updatedAt = new Date().toISOString();
			set({ statusTick: get().statusTick + 1 });
		},

		updateNodeMetadata: (nodeId, metadata) => {
			const node = get().nodeIndex.get(nodeId);
			if (!node) return;
			node.metadata = metadata;
			node.updatedAt = new Date().toISOString();
			set({ statusTick: get().statusTick + 1 });
		},

		updateNodeNotes: (nodeId, notes) => {
			const node = get().nodeIndex.get(nodeId);
			if (!node) return;
			node.notes = notes;
			node.updatedAt = new Date().toISOString();
			set({ statusTick: get().statusTick + 1 });
		},

		setSelectedNode: (id) => {
			set({ selectedNodeId: id });
		},

		setFocusedNode: (id) => {
			set({ focusedNodeId: id });
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

		// --- Clipboard -----------------------------------------------------------

		copySubtreeToClipboard: async (nodeId) => {
			const node = get().nodeIndex.get(nodeId);
			if (!node) return;
			const serialized = serializeSubtree(node);
			// Always store in-memory (A2 fallback)
			set({ lastCopiedSubtree: node });
			// Best-effort clipboard write
			try {
				await navigator.clipboard.writeText(serialized);
			} catch {
				// CEF may deny writeText in some builds; in-memory buffer covers us.
			}
		},

		pasteFromClipboard: async (parentId) => {
			let subtree: RoadmapNode | null = null;
			// Try clipboard.readText first
			try {
				const text = await navigator.clipboard.readText();
				subtree = parseSubtree(text);
			} catch {
				// readText denied — fall back to in-memory buffer
			}
			if (!subtree) {
				subtree = get().lastCopiedSubtree;
			}
			if (!subtree) return null;
			const fresh = refreshNodeIds(subtree);
			const schema = get().schema;
			if (!schema) return null;
			// Insert into parent (or as root sibling if parentId null)
			const nextNodes = immutablyReplaceArray(
				schema.nodes,
				parentId,
				(children) => [...children, fresh],
			);
			bumpStructural(nextNodes);
			return fresh.id;
		},

		// --- Viewport ------------------------------------------------------------

		resetView: () => {
			// Center the root node in the canvas area.
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
	};
});
