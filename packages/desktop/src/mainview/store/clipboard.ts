import type { RoadmapNode } from "../../../../../packages/core/src/schema";

/**
 * Magic string that gates clipboard parse — any paste whose JSON envelope is
 * missing this exact magic is rejected as untrusted / foreign content.
 */
export const CLIPBOARD_MAGIC = "roadraven:subtree:v1" as const;

export interface ClipboardEnvelope {
	magic: typeof CLIPBOARD_MAGIC;
	node: RoadmapNode;
}

/**
 * Serialize a subtree to a JSON envelope string suitable for navigator.clipboard.writeText.
 */
export function serializeSubtree(node: RoadmapNode): string {
	const envelope: ClipboardEnvelope = { magic: CLIPBOARD_MAGIC, node };
	return JSON.stringify(envelope);
}

/**
 * Parse a clipboard string back to a RoadmapNode. Returns null if:
 * - Not valid JSON
 * - Missing or mismatched magic string (T-03.01-01 mitigation)
 * - Missing required node shape (id + title strings)
 *
 * The deep shape is NOT validated here — the full Zod pass happens at save time.
 */
export function parseSubtree(raw: string): RoadmapNode | null {
	try {
		const parsed = JSON.parse(raw) as unknown;
		if (typeof parsed !== "object" || parsed === null) return null;
		const envelope = parsed as ClipboardEnvelope;
		if (envelope.magic !== CLIPBOARD_MAGIC) return null;
		if (
			!envelope.node ||
			typeof envelope.node.id !== "string" ||
			typeof envelope.node.title !== "string"
		) {
			return null;
		}
		return envelope.node;
	} catch {
		return null;
	}
}

/**
 * Deep-clone a subtree while assigning a fresh `crypto.randomUUID()` to every
 * node and resetting createdAt/updatedAt. Preserves all other fields.
 *
 * Used for duplicateNode + pasteFromClipboard.
 */
export function refreshNodeIds(node: RoadmapNode): RoadmapNode {
	const now = new Date().toISOString();
	const cloned: RoadmapNode = {
		...node,
		id: crypto.randomUUID(),
		createdAt: now,
		updatedAt: now,
		children: node.children?.map(refreshNodeIds),
	};
	return cloned;
}
