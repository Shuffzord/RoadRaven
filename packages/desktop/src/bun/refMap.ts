import type { RoadmapNode, RoadmapSchema } from "../../../../shared/types";

export type FilePath = string;
export type OwnershipMap = Map<string, FilePath>;

// Module-level ownership map (singleton per Bun process)
let activeOwnership: OwnershipMap = new Map();

// The original (unresolved) main-file nodes, captured at loadFile time BEFORE
// resolveRefs expanded $ref placeholders. Used on save to rebuild the main file
// with $ref placeholders intact.
let sourceTemplate: { mainPath: FilePath; nodes: RoadmapNode[] } | null = null;

/**
 * Capture the original (pre-resolution) main-file nodes so splitSchemaByOwnership
 * can rebuild the main file with $ref placeholders restored on save.
 * Deep-cloned so later mutations to the live schema do not contaminate the template.
 */
export function setSourceTemplate(
	mainPath: FilePath,
	nodes: RoadmapNode[],
): void {
	sourceTemplate = {
		mainPath,
		nodes: structuredClone(nodes),
	};
}

export function getSourceTemplate(): typeof sourceTemplate {
	return sourceTemplate;
}

/**
 * Build a fresh ownership map rooted at `mainFilePath`. Every node in `rootNodes`
 * (and every descendant) is tagged as owned by `mainFilePath`. Ref-owned descendants
 * must be tagged separately by the loader after expanding $ref subtrees.
 */
export function buildOwnershipMap(
	rootNodes: RoadmapNode[],
	mainFilePath: FilePath,
): OwnershipMap {
	const map: OwnershipMap = new Map();
	walkAndTag(rootNodes, mainFilePath, map);
	activeOwnership = map;
	return map;
}

export function getOwnership(): OwnershipMap {
	return activeOwnership;
}

/**
 * Tag a single node's owner. Used by the loader to override descendants of a
 * $ref-owned subtree after `buildOwnershipMap` has seeded the main file's
 * ownership.
 */
export function setOwnership(nodeId: string, path: FilePath): void {
	activeOwnership.set(nodeId, path);
}

/**
 * Reset module-level state. Test-only helper.
 */
export function resetRefMap(): void {
	activeOwnership = new Map();
	sourceTemplate = null;
}

function walkAndTag(
	nodes: RoadmapNode[],
	owner: FilePath,
	map: OwnershipMap,
): void {
	for (const node of nodes) {
		map.set(node.id, owner);
		if (node.children) walkAndTag(node.children, owner, map);
	}
}

/**
 * Split a live schema into per-file payloads based on the ownership map.
 *
 * - The main file's payload reconstructs the $ref placeholders from `sourceTemplate`
 *   (so saving does not inline ref'd content into the main file).
 * - Warning 4 fix: nodes present in `sourceTemplate` but deleted from `schema` are
 *   DROPPED from the output (no silent resurrection).
 * - Each referenced file's payload contains the subtree(s) owned by that file.
 */
export function splitSchemaByOwnership(
	schema: RoadmapSchema,
	mainPath: FilePath,
	ownership: OwnershipMap,
): Map<FilePath, RoadmapSchema> {
	const result = new Map<FilePath, RoadmapSchema>();
	const template =
		sourceTemplate?.mainPath === mainPath ? sourceTemplate : null;

	// Every unique file path that owns at least one node, plus the main file
	const owners = new Set<FilePath>([mainPath, ...ownership.values()]);

	for (const path of owners) {
		if (path === mainPath) {
			const nodes = template
				? rebuildMainNodesFromTemplate(
						template.nodes,
						schema.nodes,
						ownership,
						mainPath,
					)
				: schema.nodes.filter(
						(n) => (ownership.get(n.id) ?? mainPath) === mainPath,
					);
			result.set(path, { ...schema, nodes });
		} else {
			const refNodes = collectOwnedSubtrees(schema.nodes, path, ownership);
			result.set(path, { ...schema, nodes: refNodes });
		}
	}
	return result;
}

function rebuildMainNodesFromTemplate(
	templateNodes: RoadmapNode[],
	liveNodes: RoadmapNode[],
	ownership: OwnershipMap,
	mainPath: FilePath,
): RoadmapNode[] {
	const out: RoadmapNode[] = [];
	for (const tmpl of templateNodes) {
		if (tmpl.$ref) {
			out.push({ ...tmpl });
			continue;
		}
		const live = findNodeById(liveNodes, tmpl.id);
		if (!live) continue; // Warning 4 fix: deleted-in-live drops from output
		out.push({
			...live,
			children: live.children
				? rebuildMainChildren(
						tmpl.children ?? [],
						live.children,
						ownership,
						mainPath,
					)
				: undefined,
		});
	}
	return out;
}

function rebuildMainChildren(
	templateChildren: RoadmapNode[],
	liveChildren: RoadmapNode[],
	ownership: OwnershipMap,
	mainPath: FilePath,
): RoadmapNode[] {
	const out: RoadmapNode[] = [];
	const consumedLiveIds = new Set<string>();

	// Walk the template in order, matching template ids against the live tree.
	// Preserves the $ref placeholder positions and drops deleted children.
	for (const tmpl of templateChildren) {
		if (tmpl.$ref) {
			out.push({ ...tmpl });
			continue;
		}
		const live = liveChildren.find((c) => c.id === tmpl.id);
		if (!live) continue; // Warning 4 fix
		consumedLiveIds.add(live.id);
		out.push({
			...live,
			children: live.children
				? rebuildMainChildren(
						tmpl.children ?? [],
						live.children,
						ownership,
						mainPath,
					)
				: undefined,
		});
	}

	// Append any newly-added main-file children (not in template, owned by main).
	for (const live of liveChildren) {
		if (consumedLiveIds.has(live.id)) continue;
		const owner = ownership.get(live.id) ?? mainPath;
		if (owner === mainPath) {
			out.push({
				...live,
				children: live.children
					? filterChildrenByOwner(live.children, mainPath, ownership)
					: undefined,
			});
		}
	}
	return out;
}

function collectOwnedSubtrees(
	nodes: RoadmapNode[],
	owner: FilePath,
	ownership: OwnershipMap,
): RoadmapNode[] {
	const out: RoadmapNode[] = [];
	walk(nodes);
	return out;

	function walk(arr: RoadmapNode[]) {
		for (const node of arr) {
			if (ownership.get(node.id) === owner) {
				out.push({
					...node,
					children: node.children
						? filterChildrenByOwner(node.children, owner, ownership)
						: undefined,
				});
			} else if (node.children) {
				walk(node.children);
			}
		}
	}
}

function filterChildrenByOwner(
	children: RoadmapNode[],
	owner: FilePath,
	ownership: OwnershipMap,
): RoadmapNode[] {
	return children
		.filter((c) => (ownership.get(c.id) ?? owner) === owner)
		.map((c) => ({
			...c,
			children: c.children
				? filterChildrenByOwner(c.children, owner, ownership)
				: undefined,
		}));
}

function findNodeById(nodes: RoadmapNode[], id: string): RoadmapNode | null {
	for (const node of nodes) {
		if (node.id === id) return node;
		if (node.children) {
			const found = findNodeById(node.children, id);
			if (found) return found;
		}
	}
	return null;
}
