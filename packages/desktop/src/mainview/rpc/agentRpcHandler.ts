// Phase 6 Plan 06-04 — renderer dispatcher (the brain of Phase 6).
//
// Single switch on tool name routing every agent tool call to a roadmapStore
// action and writing a synthetic IntegrationEvent into the audit drawer (D-09)
// for every mutating tool. Cross-ref-boundary, kill-switch, path-allowlist
// gates run upstream in Bun (Plan 06-03).
//
// Renderer-side gates: no_file_loaded (D-06), node_not_found,
// cascade_required (D-11), cannot_delete_last_root, move_would_create_cycle,
// unknown_tool.
import { z } from "zod";
import { LIFECYCLE_NODE_ID } from "../../../../../packages/core/src/plugin";
import type {
	RoadmapNode,
	RoadmapSchema,
} from "../../../../../packages/core/src/schema";
import {
	StatusConfigSchema,
	TypeConfigSchema,
} from "../../../../../packages/core/src/schema";
import type { IntegrationEvent } from "../../../../../shared/types";

export type AgentResult =
	| { ok: true; data: unknown }
	| { ok: false; error: string; code: string; hint?: string; data?: unknown };

/**
 * Returns true when `candidateId` is in the subtree rooted at `rootNodeId`,
 * INCLUDING the root itself (a node is in its own subtree). This is the
 * reflexive form — see CR-02 in 06-REVIEW.md: the previous form excluded the
 * root and silently allowed `moveNode(X, X)` past the cycle gate, which then
 * deleted X via the store action (CR-01). Reflexive coverage closes both
 * defects in one helper.
 */
function isDescendantOf(
	rootNodeId: string,
	candidateId: string,
	nodeIndex: Map<string, RoadmapNode>,
): boolean {
	if (rootNodeId === candidateId) return true; // a node is in its own subtree
	const root = nodeIndex.get(rootNodeId);
	if (!root) return false;
	const stack: RoadmapNode[] = [...(root.children ?? [])];
	while (stack.length) {
		// biome-ignore lint/style/noNonNullAssertion: stack.length checked above
		const n = stack.pop()!;
		if (n.id === candidateId) return true;
		if (n.children) stack.push(...n.children);
	}
	return false;
}

type LogStoreState = ReturnType<
	typeof import("../store/eventLogStore").useEventLogStore.getState
>;
type RoadmapStoreState = ReturnType<
	typeof import("../store/roadmapStore").useRoadmapStore.getState
>;

// WR-05 (06-REVIEW): cap drawer-audit `meta.args` to 2KB. Without this, an
// agent (or malicious WS client) can pin ~1000 megabytes of metadata in the
// renderer by spamming `updateNodeNotes` with large payloads — the
// EVENT_LOG_ROW_CAP is 1000, but each row was unbounded in size.
//
// We mirror the eventSchema.ts META_MAX_BYTES (8KB) but use a tighter 2KB
// cap because (a) the drawer is a UI surface, not a transport buffer, and
// (b) tool args are typically much smaller than the runtime metadata events
// carry — 2KB covers create/update args comfortably and forces large notes
// payloads to be summarised.
const DRAWER_ARGS_MAX_BYTES = 2 * 1024;

function sanitizeArgsForAudit(
	args: Record<string, unknown>,
): Record<string, unknown> {
	let json: string;
	try {
		json = JSON.stringify(args);
	} catch {
		return { _truncated: true, reason: "non-serializable args" };
	}
	const byteLen = new TextEncoder().encode(json).byteLength;
	if (byteLen <= DRAWER_ARGS_MAX_BYTES) return args;
	// Pass 1: per-field replace large string values with a stub. This keeps
	// the structure (and metadata keys) intact for filter/search.
	const truncated: Record<string, unknown> = {};
	for (const [k, v] of Object.entries(args)) {
		if (typeof v === "string" && v.length > 256) {
			truncated[k] = `[truncated ${v.length} chars]`;
		} else if (
			v !== null &&
			typeof v === "object" &&
			new TextEncoder().encode(JSON.stringify(v)).byteLength > 512
		) {
			truncated[k] = "[truncated object]";
		} else {
			truncated[k] = v;
		}
	}
	truncated._truncated = true;
	truncated._originalBytes = byteLen;
	// Pass 2: if still too big, drop everything and keep just the marker.
	const finalBytes = new TextEncoder().encode(
		JSON.stringify(truncated),
	).byteLength;
	if (finalBytes > DRAWER_ARGS_MAX_BYTES) {
		return {
			_truncated: true,
			_originalBytes: byteLen,
			_reason: "args exceeded 2KB after per-field stubbing",
		};
	}
	return truncated;
}

/**
 * Mark a node as recently touched by an agent so the in-canvas live pulse +
 * plugin glyph fire for ANY agent-driven mutation, not just updateNodeStatus.
 * Source defaults to "claude-code" (this plugin's identity) but is overridden
 * by `args.meta.source` when the caller specifies it (e.g., the storytelling
 * runner sets "github-actions" on Tier-2-style mutations).
 */
function recordAgentLive(
	nodeId: string,
	args: Record<string, unknown>,
	store: RoadmapStoreState,
): void {
	const meta = (args.meta ?? {}) as Record<string, unknown>;
	const source = typeof meta.source === "string" ? meta.source : "claude-code";
	store.recordLiveSource(nodeId, source, meta);
}

function appendAgentDrawerEvent(
	tool: string,
	nodeId: string,
	args: Record<string, unknown>,
	store: RoadmapStoreState,
	eventLogStore: LogStoreState,
): void {
	const node =
		nodeId === LIFECYCLE_NODE_ID ? null : store.nodeIndex.get(nodeId);
	const event: IntegrationEvent = {
		nodeId,
		status: node?.status ?? "unknown",
		source: "claude-code",
		timestamp: new Date().toISOString(),
		meta: {
			tool,
			args: sanitizeArgsForAudit(args),
			label: `Claude → ${tool}`,
		},
	};
	eventLogStore.appendEvents([event]);
}

interface FindNodesFilter {
	titleContains?: string;
	status?: string;
	type?: string;
	metaKey?: string;
	metaValue?: unknown;
	parentId?: string;
}

function matchesFilter(
	node: RoadmapNode,
	parentId: string | null,
	filter: FindNodesFilter,
): boolean {
	if (filter.titleContains !== undefined) {
		if (!node.title.toLowerCase().includes(filter.titleContains.toLowerCase()))
			return false;
	}
	if (filter.status !== undefined && node.status !== filter.status)
		return false;
	if (filter.type !== undefined && node.type !== filter.type) return false;
	if (filter.parentId !== undefined && parentId !== filter.parentId)
		return false;
	if (filter.metaKey !== undefined) {
		const v = node.metadata?.[filter.metaKey];
		if (filter.metaValue !== undefined && v !== filter.metaValue) return false;
		if (filter.metaValue === undefined && v === undefined) return false;
	}
	return true;
}

function walkNodes(
	nodes: RoadmapNode[],
	parentId: string | null,
	visit: (n: RoadmapNode, parentId: string | null) => void,
): void {
	for (const n of nodes) {
		visit(n, parentId);
		if (n.children) walkNodes(n.children, n.id, visit);
	}
}

/**
 * D-07 live overlay helper. Phase 4's applyEventBatch (roadmapStore.ts ~840) ALREADY
 * mutates `node.status` in place when an event lands, so the in-memory tree carries
 * the merged value. This helper re-asserts the invariant and is the single place we
 * document "merged status wins within the 30s window" for read tools.
 *
 * Returns the node unchanged when:
 *   - liveEventMeta has no entry for this nodeId, OR
 *   - the entry's lastEventAt is older than 30 seconds (live window expired).
 *
 * Returns the node as-is otherwise (the in-place applyEventBatch mutation already
 * applied the overlay; nothing more to do — but downstream code can rely on the
 * fact that THIS function ran and the value is correct per D-07).
 */
function mergeLiveStatus(
	node: RoadmapNode,
	liveEventMeta: Record<
		string,
		{ lastEventAt: number; source?: string; meta?: Record<string, unknown> }
	>,
): RoadmapNode {
	const live = liveEventMeta[node.id];
	const LIVE_WINDOW_MS = 30_000;
	if (!live || Date.now() - live.lastEventAt > LIVE_WINDOW_MS) return node;
	// Phase 4 already mutated node.status in place; return node unchanged.
	// (The function exists to make the D-07 contract explicit at the read tool boundary.)
	return node;
}

function walkAndMerge(
	root: RoadmapNode,
	liveEventMeta: Record<
		string,
		{ lastEventAt: number; source?: string; meta?: Record<string, unknown> }
	>,
): RoadmapNode {
	const merged = mergeLiveStatus(root, liveEventMeta);
	if (!merged.children?.length) return merged;
	return {
		...merged,
		children: merged.children.map((c) => walkAndMerge(c, liveEventMeta)),
	};
}

function buildAncestorIds(
	schema: { nodes: RoadmapNode[] },
	targetId: string,
): { parentId: string | null; ancestorIds: string[] } {
	const path: string[] = [];
	function dfs(arr: RoadmapNode[], trail: string[]): boolean {
		for (const n of arr) {
			if (n.id === targetId) {
				path.push(...trail);
				return true;
			}
			if (n.children && dfs(n.children, [...trail, n.id])) return true;
		}
		return false;
	}
	dfs(schema.nodes, []);
	return {
		parentId: path.length > 0 ? path[path.length - 1] : null,
		ancestorIds: path,
	};
}

type BatchUpdateItem = {
	nodeId: string;
	status?: string;
	notes?: string;
	metadata?: Record<string, unknown | null>;
};

/**
 * v0.7 Phase 2 — atomic batch write (`updateNodes`). Validates EVERY item
 * first (all-or-nothing: any failure rejects the whole batch with a per-item
 * `{index, nodeId, code}` report and NOTHING is applied), then applies via ONE
 * store action so revision and statusTick each bump exactly once per batch.
 */
function handleUpdateNodesBatch(
	args: Record<string, unknown>,
	schema: RoadmapSchema,
	store: RoadmapStoreState,
	roadmapStore: typeof import("../store/roadmapStore").useRoadmapStore,
	eventLog: LogStoreState,
): AgentResult {
	const updates = args.updates as BatchUpdateItem[];
	// Only enforce status ids when the schema declares a statusConfig —
	// config-less files accept any status, matching the single-item
	// updateNodeStatus path.
	const statusIds = new Set((schema.statusConfig ?? []).map((s) => s.id));
	const failures: Array<{ index: number; nodeId: string; code: string }> = [];
	updates.forEach((u, index) => {
		if (!store.nodeIndex.get(u.nodeId)) {
			failures.push({ index, nodeId: u.nodeId, code: "node_not_found" });
		} else if (
			u.status !== undefined &&
			statusIds.size > 0 &&
			!statusIds.has(u.status)
		) {
			failures.push({ index, nodeId: u.nodeId, code: "invalid_status" });
		}
	});
	if (failures.length > 0) {
		return {
			ok: false,
			error: `Batch rejected: ${failures.length} of ${updates.length} item(s) failed validation. Nothing was applied.`,
			code: "batch_validation_failed",
			hint: "Fix the listed items and resend the whole batch.",
			data: { failures },
		};
	}
	// Resolve metadata PATCH semantics (D-04: null deletes the key, unlisted
	// keys preserved) against the current tree BEFORE the single batch apply.
	const resolved = updates.map((u) => ({
		nodeId: u.nodeId,
		status: u.status,
		notes: u.notes,
		metadata:
			u.metadata === undefined
				? undefined
				: mergeMetadataPatch(
						store.nodeIndex.get(u.nodeId)?.metadata,
						u.metadata,
					),
	}));
	store.updateNodesBatch(resolved);
	// Live pulse for every touched node in ONE setState — recordAgentLive/
	// recordLiveSource bumps statusTick per call, which would break the
	// "statusTick bumps once per batch" contract (updateNodesBatch already
	// bumped it, so the pulse re-render is covered).
	const lastEventAt = Date.now();
	roadmapStore.setState((s) => {
		const nextLive = { ...s.liveEventMeta };
		for (const u of updates) {
			nextLive[u.nodeId] = { lastEventAt, source: "claude-code" };
		}
		return { liveEventMeta: nextLive };
	});
	// Per-item drawer audit (D-09) — same surfacing as the single
	// updateNodeStatus path, one event per batch item.
	for (const u of updates) {
		appendAgentDrawerEvent(
			"updateNodes",
			u.nodeId,
			u as unknown as Record<string, unknown>,
			store,
			eventLog,
		);
	}
	return {
		ok: true,
		data: {
			updated: updates.length,
			// Final revision AFTER the single batch bump — agents chain the next
			// expectedRevision from here without a re-read.
			revision: schema.revision ?? 1,
		},
	};
}

/** D-04 shallow PATCH merge: null value deletes that key, unlisted preserved. */
function mergeMetadataPatch(
	current: Record<string, unknown> | undefined,
	patch: Record<string, unknown | null>,
): Record<string, unknown> {
	const next: Record<string, unknown> = { ...(current ?? {}) };
	for (const [k, v] of Object.entries(patch)) {
		if (v === null) delete next[k];
		else next[k] = v;
	}
	return next;
}

/**
 * Phase 6 PLUG-AGENT-* — renderer dispatcher.
 *
 * Gates: no_file_loaded (except createRoadmap, getOpenFile, openFile),
 *        node_not_found, cascade_required, cannot_delete_last_root,
 *        move_would_create_cycle, unknown_tool.
 *
 * Cross-ref-boundary, kill-switch, path-allowlist live in Bun (Plan 06-03).
 *
 * Drawer audit (D-09) emits IntegrationEvent for every mutating tool.
 */
export async function handleAgentRequest(
	tool: string,
	args: Record<string, unknown>,
): Promise<AgentResult> {
	const { useRoadmapStore, hasUnsavedEdits } = await import(
		"../store/roadmapStore"
	);
	const { useEventLogStore } = await import("../store/eventLogStore");
	const store = useRoadmapStore.getState();
	const eventLog = useEventLogStore.getState();
	const schema = store.schema;

	// Tools that don't require a loaded schema. openFile MUST be here (v0.7
	// Phase 4 dogfood fix): with no schema loaded, no_file_loaded's hint says
	// "call openFile(path)" — gating openFile itself behind the schema made
	// that recovery path a deadlock.
	const SCHEMA_OPTIONAL = new Set(["createRoadmap", "getOpenFile", "openFile"]);
	if (!schema && !SCHEMA_OPTIONAL.has(tool)) {
		return {
			ok: false,
			error: "No roadmap file is loaded.",
			code: "no_file_loaded",
			hint: "Open a roadmap or call openFile(path).",
		};
	}

	// v0.7 CONC-01: optimistic concurrency. Write tools may carry
	// expectedRevision (captured from a prior getRoadmap/getNode); a mismatch
	// means the tree changed since that read, so fail loudly instead of writing
	// on a stale picture. Omitted expectedRevision keeps pre-v0.7 behavior.
	// Enforced here (not Bun-side) because the renderer owns the live schema —
	// same reason no_file_loaded / node_not_found live here.
	const WRITE_TOOLS = new Set([
		"createNode",
		"deleteNode",
		"moveNode",
		"renameNode",
		"updateNodeStatus",
		"updateNodeType",
		"updateNodeMetadata",
		"updateNodeNotes",
		"updateNodes",
	]);
	if (WRITE_TOOLS.has(tool) && typeof args.expectedRevision === "number") {
		const currentRevision = schema?.revision ?? 1;
		if (args.expectedRevision !== currentRevision) {
			return {
				ok: false,
				error: "Roadmap changed since your last read.",
				code: "stale_write",
				hint: "Call getRoadmap for the current revision and replay your change.",
				data: { currentRevision },
			};
		}
	}

	// D-07 live overlay snapshot — reused by getRoadmap, getNode, findNodes.
	const liveEventMeta = store.liveEventMeta;

	switch (tool) {
		// -------- READ TOOLS (D-01, D-07 live-overlay merge) --------
		case "getRoadmap": {
			// D-07: walk the tree and apply live overlay (overlay wins within 30s window).
			//
			// WR-09 (06-REVIEW): mergeLiveStatus is a no-op (Phase 4's
			// applyEventBatch already mutated node.status in place). When no
			// live overlay entries exist we can skip the full top-down clone
			// entirely and return schema.nodes directly. The clone runs only
			// when liveEventMeta has at least one entry — same correctness as
			// before, materially less garbage on every getRoadmap call.
			//
			// biome-ignore lint/style/noNonNullAssertion: schema null-checked above
			const safeSchema = schema!;
			const hasLiveOverlay = Object.keys(liveEventMeta).length > 0;
			const mergedNodes = hasLiveOverlay
				? safeSchema.nodes.map((n) => walkAndMerge(n, liveEventMeta))
				: safeSchema.nodes;
			const mergedSchema = { ...safeSchema, nodes: mergedNodes };
			return {
				ok: true,
				data: {
					schema: mergedSchema,
					filePath: store.filePath,
					isUntitled: store.isUntitled,
					// v0.7 CONC-01: top-level echo so agents can pass it back as
					// expectedRevision without digging into schema.
					revision: safeSchema.revision ?? 1,
				},
			};
		}

		case "getNode": {
			const nodeId = args.nodeId as string;
			const node = store.nodeIndex.get(nodeId);
			if (!node) {
				return {
					ok: false,
					error: `Node '${nodeId}' not found.`,
					code: "node_not_found",
					hint: "Call getRoadmap or findNodes to discover node IDs.",
				};
			}
			// D-07: return the merged node (overlay wins within 30s window).
			const merged = mergeLiveStatus(node, liveEventMeta);
			// biome-ignore lint/style/noNonNullAssertion: schema null-checked above
			const ancestry = buildAncestorIds(schema!, nodeId);
			return {
				ok: true,
				data: {
					node: merged,
					parentId: ancestry.parentId,
					ancestorIds: ancestry.ancestorIds,
					// v0.7 CONC-01: see getRoadmap above.
					// biome-ignore lint/style/noNonNullAssertion: schema null-checked above
					revision: schema!.revision ?? 1,
				},
			};
		}

		case "findNodes": {
			const filter = args as FindNodesFilter;
			const out: Array<{ node: RoadmapNode; parentId: string | null }> = [];
			// D-07: filter operates on merged statuses (Phase 4 already mutated node.status in place;
			// mergeLiveStatus is a no-op on the actual data but documents the contract).
			// biome-ignore lint/style/noNonNullAssertion: schema null-checked above
			walkNodes(schema!.nodes, null, (n, parentId) => {
				const mergedNode = mergeLiveStatus(n, liveEventMeta);
				if (matchesFilter(mergedNode, parentId, filter))
					out.push({ node: mergedNode, parentId });
			});
			return { ok: true, data: { nodes: out } };
		}

		case "getStatusConfig":
			// biome-ignore lint/style/noNonNullAssertion: schema null-checked above
			return { ok: true, data: { statusConfig: schema!.statusConfig ?? [] } };

		case "getTypeConfig":
			// biome-ignore lint/style/noNonNullAssertion: schema null-checked above
			return { ok: true, data: { typeConfig: schema!.typeConfig ?? [] } };

		case "getOpenFile":
			return {
				ok: true,
				data: {
					filePath: store.filePath,
					isUntitled: store.isUntitled,
					title: schema?.title ?? null,
					nodeCount: store.nodeIndex.size,
				},
			};

		// -------- CREATE TOOLS --------
		case "createNode": {
			const parentId = args.parentId as string;
			const title = args.title as string;
			// v0.7 Phase 4: optional caller-supplied id (format validated by the
			// Bun gate). Keeps node identity stable across delete/recreate.
			const requestedId = typeof args.id === "string" ? args.id : undefined;
			if (requestedId !== undefined && store.nodeIndex.has(requestedId)) {
				return {
					ok: false,
					error: `A node with id '${requestedId}' already exists.`,
					code: "duplicate_id",
					hint: "Pick a different id, or omit id to auto-generate one.",
				};
			}
			const newId = store.addChild(parentId, title, requestedId);
			if (!newId) {
				return {
					ok: false,
					error: `Parent node '${parentId}' not found.`,
					code: "node_not_found",
				};
			}
			if (typeof args.status === "string")
				store.updateNodeStatus(newId, args.status);
			if (typeof args.type === "string") store.updateNodeType(newId, args.type);
			if (typeof args.notes === "string")
				store.updateNodeNotes(newId, args.notes);
			if (args.metadata && typeof args.metadata === "object") {
				store.updateNodeMetadata(
					newId,
					args.metadata as Record<string, unknown>,
				);
			}
			recordAgentLive(newId, args, store);
			appendAgentDrawerEvent("createNode", newId, args, store, eventLog);
			return { ok: true, data: { nodeId: newId } };
		}

		case "createRoadmap": {
			store.newUntitledSchema();
			// Optional title/configs override after creation.
			//
			// WR-03 (06-REVIEW): apply overrides via useRoadmapStore.setState
			// (immutable spread) instead of mutating post.schema directly.
			// The previous form mutated the same object reference Zustand
			// holds, so subscribers were not notified — drawer audit + any UI
			// bound to schema.title would not re-render until something else
			// triggered a state update.
			//
			// Also Zod-validates statusConfig / typeConfig before accepting
			// them — the prior `as typeof ...` cast let malformed configs
			// (missing required `id`/`label`) through, breaking subsequent
			// operations that assume well-formed entries.
			const updates: {
				title?: string;
				statusConfig?: z.infer<typeof StatusConfigSchema>[];
				typeConfig?: z.infer<typeof TypeConfigSchema>[];
			} = {};
			if (typeof args.title === "string") updates.title = args.title;
			if (Array.isArray(args.statusConfig)) {
				const parsed = z.array(StatusConfigSchema).safeParse(args.statusConfig);
				if (!parsed.success) {
					return {
						ok: false,
						error: `Invalid statusConfig: ${parsed.error.issues[0].message}`,
						code: "invalid_input",
						hint: "Each entry must have id and label.",
					};
				}
				updates.statusConfig = parsed.data;
			}
			if (Array.isArray(args.typeConfig)) {
				const parsed = z.array(TypeConfigSchema).safeParse(args.typeConfig);
				if (!parsed.success) {
					return {
						ok: false,
						error: `Invalid typeConfig: ${parsed.error.issues[0].message}`,
						code: "invalid_input",
						hint: "Each entry must have id and label.",
					};
				}
				updates.typeConfig = parsed.data;
			}
			if (Object.keys(updates).length > 0) {
				useRoadmapStore.setState((s) => ({
					schema: s.schema ? { ...s.schema, ...updates } : s.schema,
				}));
			}
			const post = useRoadmapStore.getState();
			appendAgentDrawerEvent(
				"createRoadmap",
				LIFECYCLE_NODE_ID,
				args,
				post,
				eventLog,
			);
			return {
				ok: true,
				data: { schema: post.schema, isUntitled: true },
			};
		}

		// -------- UPDATE TOOLS --------
		case "renameNode": {
			const nodeId = args.nodeId as string;
			if (!store.nodeIndex.get(nodeId)) {
				return {
					ok: false,
					error: `Node '${nodeId}' not found.`,
					code: "node_not_found",
				};
			}
			store.renameNode(nodeId, args.title as string);
			recordAgentLive(nodeId, args, store);
			appendAgentDrawerEvent("renameNode", nodeId, args, store, eventLog);
			return { ok: true, data: { ok: true } };
		}

		case "updateNodeStatus": {
			const nodeId = args.nodeId as string;
			if (!store.nodeIndex.get(nodeId)) {
				return {
					ok: false,
					error: `Node '${nodeId}' not found.`,
					code: "node_not_found",
				};
			}
			store.updateNodeStatus(nodeId, args.status as string);
			recordAgentLive(nodeId, args, store);
			appendAgentDrawerEvent("updateNodeStatus", nodeId, args, store, eventLog);
			return { ok: true, data: { ok: true } };
		}

		case "updateNodeType": {
			const nodeId = args.nodeId as string;
			if (!store.nodeIndex.get(nodeId)) {
				return {
					ok: false,
					error: `Node '${nodeId}' not found.`,
					code: "node_not_found",
				};
			}
			store.updateNodeType(nodeId, args.type as string);
			recordAgentLive(nodeId, args, store);
			appendAgentDrawerEvent("updateNodeType", nodeId, args, store, eventLog);
			return { ok: true, data: { ok: true } };
		}

		case "updateNodeNotes": {
			const nodeId = args.nodeId as string;
			if (!store.nodeIndex.get(nodeId)) {
				return {
					ok: false,
					error: `Node '${nodeId}' not found.`,
					code: "node_not_found",
				};
			}
			const notes = args.notes as string;
			// v0.7 Phase 4: mode "append" joins existing notes + blank line + new
			// text; empty/absent existing notes fall through to a plain set.
			const existing = store.nodeIndex.get(nodeId)?.notes;
			const next =
				args.mode === "append" && existing ? `${existing}\n\n${notes}` : notes;
			store.updateNodeNotes(nodeId, next);
			recordAgentLive(nodeId, args, store);
			appendAgentDrawerEvent("updateNodeNotes", nodeId, args, store, eventLog);
			return { ok: true, data: { ok: true } };
		}

		// D-04: PATCH semantics — null=delete, unlisted preserved.
		case "updateNodeMetadata": {
			const nodeId = args.nodeId as string;
			const node = store.nodeIndex.get(nodeId);
			if (!node) {
				return {
					ok: false,
					error: `Node '${nodeId}' not found.`,
					code: "node_not_found",
				};
			}
			const patch = args.patch as Record<string, unknown | null>;
			const current = node.metadata ?? {};
			const next: Record<string, unknown> = { ...current };
			for (const [k, v] of Object.entries(patch)) {
				if (v === null) delete next[k];
				else next[k] = v;
			}
			store.updateNodeMetadata(nodeId, next);
			recordAgentLive(nodeId, args, store);
			appendAgentDrawerEvent(
				"updateNodeMetadata",
				nodeId,
				args,
				store,
				eventLog,
			);
			return { ok: true, data: { metadata: next } };
		}

		// v0.7 Phase 2 — atomic batch write (extracted to keep this dispatcher's
		// complexity flat; see handleUpdateNodesBatch above the dispatcher).
		case "updateNodes":
			// biome-ignore lint/style/noNonNullAssertion: schema null-checked above
			return handleUpdateNodesBatch(
				args,
				schema!,
				store,
				useRoadmapStore,
				eventLog,
			);

		case "moveNode": {
			const nodeId = args.nodeId as string;
			const newParentId = args.newParentId as string;
			// CR-01 (06-REVIEW): explicit self-move short-circuit BEFORE the store
			// call. Without this, moveNode({nodeId: X, newParentId: X}) silently
			// deleted node X (the store removes the node first, then can't find a
			// parent to insert under). Reflexive isDescendantOf (CR-02) catches the
			// same case below; this guard is defense-in-depth and produces a
			// clearer error path.
			if (nodeId === newParentId) {
				return {
					ok: false,
					error: "Cannot move a node onto itself.",
					code: "move_would_create_cycle",
				};
			}
			if (!store.nodeIndex.get(nodeId)) {
				return {
					ok: false,
					error: `Node '${nodeId}' not found.`,
					code: "node_not_found",
				};
			}
			if (!store.nodeIndex.get(newParentId)) {
				return {
					ok: false,
					error: `Parent node '${newParentId}' not found.`,
					code: "node_not_found",
				};
			}
			if (isDescendantOf(nodeId, newParentId, store.nodeIndex)) {
				return {
					ok: false,
					error: "Cannot move a node into its own subtree.",
					code: "move_would_create_cycle",
				};
			}
			store.moveNode(nodeId, newParentId, args.position as number | undefined);
			recordAgentLive(nodeId, args, store);
			appendAgentDrawerEvent("moveNode", nodeId, args, store, eventLog);
			return { ok: true, data: { ok: true } };
		}

		// -------- DELETE TOOL --------
		case "deleteNode": {
			const nodeId = args.nodeId as string;
			const cascade = args.cascade === true;
			const node = store.nodeIndex.get(nodeId);
			if (!node) {
				return {
					ok: false,
					error: `Node '${nodeId}' not found.`,
					code: "node_not_found",
				};
			}
			const childCount = node.children?.length ?? 0;
			// Last-root check: nodeId is a top-level node AND there's only one
			// biome-ignore lint/style/noNonNullAssertion: schema null-checked above
			const isTopLevel = schema!.nodes.some((n) => n.id === nodeId);
			// biome-ignore lint/style/noNonNullAssertion: schema null-checked above
			if (isTopLevel && schema!.nodes.length === 1) {
				return {
					ok: false,
					error: "Cannot delete the last root node.",
					code: "cannot_delete_last_root",
					hint: "Add a sibling root node first, or close the file.",
				};
			}
			if (childCount > 0 && !cascade) {
				return {
					ok: false,
					error: `Node has ${childCount} children. Pass cascade:true to delete subtree.`,
					code: "cascade_required",
					data: { childCount },
				};
			}
			const result = store.deleteNode(nodeId);
			appendAgentDrawerEvent("deleteNode", nodeId, args, store, eventLog);
			return { ok: true, data: { deletedCount: result.deletedCount } };
		}

		// -------- FILE-LIFECYCLE TOOLS --------
		case "saveFile": {
			// Phase 3 EDIT-13 — triggerSave forces the autosave debouncer to flush.
			store.triggerSave();
			appendAgentDrawerEvent(
				"saveFile",
				LIFECYCLE_NODE_ID,
				args,
				store,
				eventLog,
			);
			return { ok: true, data: { ok: true } };
		}

		case "saveFileAs": {
			// Path-allowlist already passed (Plan 06-03 Bun gate). Delegate to existing Phase 3 RPC.
			// Cycle agentRpcHandler → rpc → agentRpcHandler is broken at runtime by this
			// dynamic import(); flagged by fallow's static graph only.
			const { electroview } = await import("../rpc");
			if (!electroview?.rpc) {
				return {
					ok: false,
					error: "Renderer RPC not ready.",
					code: "internal_error",
				};
			}
			if (!schema) {
				return {
					ok: false,
					error: "No schema to save.",
					code: "no_file_loaded",
				};
			}
			// Phase 3's saveFileAs uses the native save dialog; for agent calls the path
			// is supplied. v1 wires through the existing dialog-based RPC; if a path-driven
			// saveFileAs is added later (v1.1) the agent can use it directly.
			const out = await electroview.rpc.request.saveFileAs({ schema });
			appendAgentDrawerEvent(
				"saveFileAs",
				LIFECYCLE_NODE_ID,
				args,
				store,
				eventLog,
			);
			if (!out.filePath) {
				return {
					ok: false,
					error: "User cancelled save dialog.",
					code: "save_error",
					hint: "saveFileAs in v1 always opens a native dialog; the args.path argument is not used. The user picks the path interactively. Do not retry with the same path — instead surface the cancellation to the user, or call saveFile to write to the currently loaded path.",
				};
			}
			return { ok: true, data: { filePath: out.filePath } };
		}

		case "openFile": {
			const path = args.path as string;
			// D-12: auto-flush pending autosave before opening. If hasUnsavedEdits is true,
			// synchronously trigger a save and wait for saveState === 'saved' (or a 5s timeout)
			// before invoking electroview.rpc.request.loadFile.
			//
			// WR-04 (06-REVIEW): catch the timeout here and return a structured
			// `autosave_timeout` error rather than letting the throw bubble up
			// to agentRequestHandler's outer try/catch (which would emit the
			// generic `internal_error`). The agent needs to know the previous
			// file may not be saved so it can call saveFile and retry.
			// schema guard: openFile is SCHEMA_OPTIONAL (v0.7 Phase 4) — with no
			// schema loaded there is nothing to flush, and waiting on an autosave
			// that can never fire would time out.
			if (schema && hasUnsavedEdits(useRoadmapStore.getState())) {
				useRoadmapStore.getState().triggerSave();
				try {
					await new Promise<void>((resolve, reject) => {
						const t = setTimeout(() => {
							unsub();
							reject(new Error("autosave timeout"));
						}, 5000);
						const unsub = useRoadmapStore.subscribe((s) => {
							if (s.saveState === "saved") {
								clearTimeout(t);
								unsub();
								resolve();
							}
						});
						// Edge case: triggerSave was synchronous (test stub) and saveState is already
						// 'saved' by the time we subscribe. Check once after subscribing.
						if (useRoadmapStore.getState().saveState === "saved") {
							clearTimeout(t);
							unsub();
							resolve();
						}
					});
				} catch (err) {
					return {
						ok: false,
						error:
							"Autosave did not complete within 5s. Previous file may be unsaved.",
						code: "autosave_timeout",
						hint: "Call saveFile manually before retrying openFile.",
						data: { detail: String(err) },
					};
				}
			}

			const { electroview } = await import("../rpc");
			if (!electroview?.rpc) {
				return {
					ok: false,
					error: "Renderer RPC not ready.",
					code: "internal_error",
				};
			}
			const out = await electroview.rpc.request.loadFile({ path });
			appendAgentDrawerEvent(
				"openFile",
				LIFECYCLE_NODE_ID,
				args,
				store,
				eventLog,
			);
			if (!out.data) {
				return {
					ok: false,
					error: "Failed to read file.",
					code: "file_read_error",
					data: { errors: out.errors },
				};
			}
			return { ok: true, data: { filePath: path, schema: out.data } };
		}

		// -------- VIEWPORT TOOLS --------
		case "cameraFitView": {
			// No node target — viewport-only. Schema-required gate already
			// passed above (SCHEMA_OPTIONAL excludes this tool, so a roadmap
			// must be loaded for the bounding box to mean anything).
			store.fitView();
			appendAgentDrawerEvent(
				"cameraFitView",
				LIFECYCLE_NODE_ID,
				args,
				store,
				eventLog,
			);
			return { ok: true, data: { ok: true } };
		}

		// -------- DEFAULT --------
		default:
			return {
				ok: false,
				error: `Unknown agent tool: '${tool}'.`,
				code: "unknown_tool",
				hint: "Update the plugin to a version that matches the app.",
			};
	}
}
