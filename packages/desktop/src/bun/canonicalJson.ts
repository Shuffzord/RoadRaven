/**
 * Canonical JSON serialization for roadmap schema files (v0.7 phase 3).
 *
 * Every schema write goes through canonicalizeSchemaJson so on-disk key order
 * is deterministic regardless of which code path (renderer save, agent RPC,
 * flushPending, $ref subtree split) produced the in-memory object — keeping
 * git diffs of roadmap JSON reviewable.
 *
 * Ordering rules:
 * - Schema root: version, revision, title, statusConfig, typeConfig, nodes —
 *   then any unknown keys alphabetically.
 * - Node objects: id, title, status, type, createdAt, updatedAt, notes,
 *   metadata, plugin, $ref, children — then any unknown keys alphabetically.
 * - statusConfig/typeConfig entries: id, label, color — then unknown
 *   alphabetically.
 * - metadata objects: keys alphabetically at every depth (agents write
 *   arbitrary keys; alpha = deterministic).
 * - Other values (plugin, themeConfig, unknown-key values) keep their
 *   existing key order — stable across load/save round-trips because
 *   JSON.parse preserves file order.
 *
 * Output: 2-space indent, LF only, trailing newline.
 */

const ROOT_KEYS = [
	"version",
	"revision",
	"title",
	"statusConfig",
	"typeConfig",
	"nodes",
] as const;

const NODE_KEYS = [
	"id",
	"title",
	"status",
	"type",
	"createdAt",
	"updatedAt",
	"notes",
	"metadata",
	"plugin",
	"$ref",
	"children",
] as const;

const CONFIG_KEYS = ["id", "label", "color"] as const;

type Rec = Record<string, unknown>;

function isRecord(value: unknown): value is Rec {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Rebuild `obj` with `known` keys first (in the given order, skipping absent
 * ones), then all remaining keys alphabetically. `mapValue` recurses into
 * context-specific values (nodes, config entries, metadata).
 */
function orderObject(
	obj: Rec,
	known: readonly string[],
	mapValue: (key: string, value: unknown) => unknown,
): Rec {
	const out = Object.create(null) as Rec;
	for (const key of known) {
		if (Object.getOwnPropertyDescriptor(obj, key)) {
			out[key] = mapValue(key, obj[key]);
		}
	}
	const rest = Object.keys(obj)
		.filter((key) => !known.includes(key))
		.sort();
	for (const key of rest) out[key] = mapValue(key, obj[key]);
	return out;
}

/** Sort object keys alphabetically at every depth (metadata subtrees). */
function sortKeysDeep(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(sortKeysDeep);
	if (!isRecord(value)) return value;
	const out = Object.create(null) as Rec;
	for (const key of Object.keys(value).sort()) {
		out[key] = sortKeysDeep(value[key]);
	}
	return out;
}

function orderNode(node: unknown): unknown {
	if (!isRecord(node)) return node;
	return orderObject(node, NODE_KEYS, (key, value) => {
		if (key === "children" && Array.isArray(value)) return value.map(orderNode);
		if (key === "metadata") return sortKeysDeep(value);
		return value;
	});
}

function orderConfigEntry(entry: unknown): unknown {
	if (!isRecord(entry)) return entry;
	return orderObject(entry, CONFIG_KEYS, (_key, value) => value);
}

function orderRoot(schema: unknown): unknown {
	if (!isRecord(schema)) return schema;
	return orderObject(schema, ROOT_KEYS, (key, value) => {
		if (key === "nodes" && Array.isArray(value)) return value.map(orderNode);
		if (
			(key === "statusConfig" || key === "typeConfig") &&
			Array.isArray(value)
		) {
			return value.map(orderConfigEntry);
		}
		return value;
	});
}

/**
 * Serialize a roadmap schema (or $ref subtree payload — same shape) to its
 * canonical on-disk form. Unknown keys are preserved, never dropped.
 */
export function canonicalizeSchemaJson(schema: unknown): string {
	return `${JSON.stringify(orderRoot(schema), null, 2)}\n`;
}
