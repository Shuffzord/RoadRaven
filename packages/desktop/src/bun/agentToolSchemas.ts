// WR-01 (Phase 6 06-REVIEW): per-tool input validation on the Bun side.
//
// `AgentRequestSchema` (eventSchema.ts) only checks the WS-frame envelope —
// `params` is z.record(z.string(), z.unknown()), so any direct WS client (or
// non-Claude-Code MCP plugin) can send malformed arg shapes. The renderer
// dispatcher (agentRpcHandler.ts) then does unsafe casts (`args.nodeId as
// string`, `args.patch as Record<string, unknown | null>`, etc.). Reported
// failure modes:
//   - updateNodeMetadata({patch: 42}) → Object.entries(42) returns [], no-op
//     silently; the agent thinks the call succeeded.
//   - updateNodeMetadata({patch: null}) → TypeError → caught as internal_error
//     with no actionable code.
//   - moveNode({position: "first"}) → splice(NaN, 0, ...) silently inserts at
//     index 0 — wrong placement, no error.
//
// Fix: validate per-tool input AT THE BUN BOUNDARY before forwarding to the
// renderer. The schemas here mirror plugins/claude-code/src/tools/schemas.ts
// but use permissive node-id strings (NOT .uuid()) consistent with
// eventSchema.ts §2.1 — Phase 4 settled on permissive ids so user-authored
// schemas with non-UUID ids still load.
//
// IMPORTANT: keep these in sync with plugins/claude-code/src/tools/schemas.ts.
// If/when a shared module appears (e.g. exposed via @roadraven/core), this
// duplication should fold into it; for now the workspace-cross-dep cost is
// not worth it (the plugin publishes independently and the desktop must not
// depend on plugin internals).

import { z } from "zod";
import {
	StatusConfigSchema,
	TypeConfigSchema,
} from "../../../../packages/core/src/schema";

// ID — permissive (matches eventSchema.ts EventFrameSchema.nodeId)
const IdString = z.string().min(1);

// -- Read tools --------------------------------------------------------------

const GetNodeInputSchema = z.object({
	nodeId: IdString,
});

const FindNodesInputSchema = z.object({
	titleContains: z.string().optional(),
	status: z.string().optional(),
	type: z.string().optional(),
	metaKey: z.string().optional(),
	metaValue: z.unknown().optional(),
	parentId: IdString.optional(),
});

// -- Create tools ------------------------------------------------------------

const CreateNodeInputSchema = z.object({
	parentId: IdString,
	title: z.string().min(1).max(200),
	type: z.string().optional(),
	status: z.string().optional(),
	notes: z.string().optional(),
	metadata: z.record(z.string(), z.unknown()).optional(),
});

const CreateRoadmapInputSchema = z.object({
	title: z.string().min(1).optional(),
	statusConfig: z.array(StatusConfigSchema).optional(),
	typeConfig: z.array(TypeConfigSchema).optional(),
});

// -- Update tools ------------------------------------------------------------

const RenameNodeInputSchema = z.object({
	nodeId: IdString,
	title: z.string().min(1).max(200),
});

const UpdateNodeStatusInputSchema = z.object({
	nodeId: IdString,
	status: z.string().min(1),
	meta: z.record(z.string(), z.unknown()).optional(),
});

const UpdateNodeTypeInputSchema = z.object({
	nodeId: IdString,
	type: z.string(),
});

const UpdateNodeNotesInputSchema = z.object({
	nodeId: IdString,
	notes: z.string(),
});

// D-04 PATCH semantics: null deletes the key. patch is REQUIRED (empty object
// is allowed and is a no-op). Without z.record(...) here the renderer's
// `Object.entries(args.patch)` would crash on patch=null and silently no-op
// on patch=42 — the bugs WR-01 specifically calls out.
const UpdateNodeMetadataInputSchema = z.object({
	nodeId: IdString,
	patch: z.record(z.string(), z.unknown().nullable()),
});

const MoveNodeInputSchema = z.object({
	nodeId: IdString,
	newParentId: IdString,
	position: z.number().int().min(0).optional(),
});

// -- Delete tool -------------------------------------------------------------

const DeleteNodeInputSchema = z.object({
	nodeId: IdString,
	cascade: z.boolean().optional(),
});

// -- File-lifecycle tools ----------------------------------------------------

const SaveFileInputSchema = z.object({}).passthrough(); // no required args

const SaveFileAsInputSchema = z.object({
	path: z.string().min(1),
});

const OpenFileInputSchema = z.object({
	path: z.string().min(1),
});

// -- Schemas with no input (read tools that take no args) --------------------

const NoArgsSchema = z.object({}).passthrough();

// -- Tool registry -----------------------------------------------------------

// Map of method name → input schema. Tools missing from this map are forwarded
// to the renderer untouched (which then returns unknown_tool for unknown
// methods, or accepts no-arg calls). This conservative default keeps forward
// compatibility for tools added between plugin and desktop releases.
const TOOL_SCHEMAS: Record<string, z.ZodType> = {
	// Read
	getRoadmap: NoArgsSchema,
	getNode: GetNodeInputSchema,
	findNodes: FindNodesInputSchema,
	getStatusConfig: NoArgsSchema,
	getTypeConfig: NoArgsSchema,
	getOpenFile: NoArgsSchema,
	// Create
	createNode: CreateNodeInputSchema,
	createRoadmap: CreateRoadmapInputSchema,
	// Update
	renameNode: RenameNodeInputSchema,
	updateNodeStatus: UpdateNodeStatusInputSchema,
	updateNodeType: UpdateNodeTypeInputSchema,
	updateNodeNotes: UpdateNodeNotesInputSchema,
	updateNodeMetadata: UpdateNodeMetadataInputSchema,
	moveNode: MoveNodeInputSchema,
	// Delete
	deleteNode: DeleteNodeInputSchema,
	// File-lifecycle
	saveFile: SaveFileInputSchema,
	saveFileAs: SaveFileAsInputSchema,
	openFile: OpenFileInputSchema,
	// Viewport
	cameraFitView: NoArgsSchema,
};

export type ValidationResult =
	| { ok: true; data: Record<string, unknown> }
	| { ok: false; code: "invalid_input"; error: string; hint: string };

/**
 * Validate `params` against the schema registered for `method`. Methods not in
 * the registry are passed through unchanged (forward compatibility — see
 * comment above TOOL_SCHEMAS). On failure, returns a structured error using
 * the same shape the rest of agentRequestHandler emits.
 */
export function validateToolInput(
	method: string,
	params: Record<string, unknown>,
): ValidationResult {
	const schema = TOOL_SCHEMAS[method];
	if (!schema) {
		// Unknown method — let the renderer handle it (returns unknown_tool).
		return { ok: true, data: params };
	}
	const parsed = schema.safeParse(params);
	if (parsed.success) {
		return { ok: true, data: parsed.data as Record<string, unknown> };
	}
	const issue = parsed.error.issues[0];
	const path = issue.path.map(String).join(".");
	return {
		ok: false,
		code: "invalid_input",
		error: `Invalid input for ${method}: ${path ? `${path}: ` : ""}${issue.message}`,
		hint: "Check the tool's input schema and resend.",
	};
}
