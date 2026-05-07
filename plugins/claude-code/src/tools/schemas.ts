// Zod input schemas for non-trivial agent tools. Each schema is referenced by
// exactly one server.registerTool call in plugins/claude-code/src/server.ts (Plan 06-05)
// and validated again on the Bun-side renderer dispatcher (Plan 06-04).
//
// Design notes:
// - nodeId fields use z.string().uuid() to match RoadmapNodeSchema.id (RESEARCH §11).
// - status / type fields use z.string().min(1) NOT a fixed enum — Phase 4 D-26 enables
//   user-defined statuses; agents must accept whatever the loaded schema allows.
// - Cycle detection / cross-$ref / cascade gates live in the handler, not Zod (the
//   schema only checks the input shape, not the live tree state).
import { z } from "zod";
import {
	StatusConfigSchema,
	TypeConfigSchema,
} from "../../../../packages/core/src/schema";

// -- Read tools (only non-trivial input shapes get a schema) ------------------

export const GetNodeInputSchema = z.object({
	nodeId: z.string().uuid().describe("UUID of the target node"),
});

// D-03: AND-combined structured filter. Case-insensitive titleContains is enforced
// in the handler (Zod can't represent the predicate). All fields optional; an empty
// filter matches every node.
export const FindNodesInputSchema = z.object({
	titleContains: z
		.string()
		.optional()
		.describe("Case-insensitive substring against node.title"),
	status: z.string().optional(),
	type: z.string().optional(),
	metaKey: z.string().optional(),
	metaValue: z.unknown().optional(),
	parentId: z.string().uuid().optional(),
});

// -- Create tools -------------------------------------------------------------

// D-01: createNode — every tail field optional. parentId + title are the only requirements.
export const CreateNodeInputSchema = z.object({
	parentId: z.string().uuid().describe("UUID of the parent node"),
	title: z.string().min(1).max(200).describe("Node title"),
	type: z.string().optional().describe("Node type id"),
	status: z
		.string()
		.optional()
		.describe("Status id — defaults to first statusConfig entry"),
	notes: z.string().optional(),
	metadata: z.record(z.string(), z.unknown()).optional(),
});

// D-01: createRoadmap mirrors File > New (newUntitledSchema). Reuses the existing
// StatusConfig / TypeConfig zod schemas for downstream parse compatibility.
export const CreateRoadmapInputSchema = z.object({
	title: z.string().min(1).optional(),
	statusConfig: z.array(StatusConfigSchema).optional(),
	typeConfig: z.array(TypeConfigSchema).optional(),
});

// -- Update tools -------------------------------------------------------------

export const RenameNodeInputSchema = z.object({
	nodeId: z.string().uuid(),
	title: z.string().min(1).max(200),
});

export const UpdateNodeTypeInputSchema = z.object({
	nodeId: z.string().uuid(),
	type: z.string(),
});

export const UpdateNodeNotesInputSchema = z.object({
	nodeId: z.string().uuid(),
	notes: z.string(),
});

// D-04: PATCH semantics — null value deletes that key from node.metadata.
// patch is REQUIRED (cannot be undefined); empty object is allowed (no-op).
// Zod v4 z.record() requires explicit key+value types (Phase 2 D-26 lesson).
export const UpdateNodeMetadataInputSchema = z.object({
	nodeId: z.string().uuid(),
	patch: z.record(z.string(), z.unknown().nullable()),
});

// D-01: moveNode with optional position. Cycle and cross-$ref-boundary checks
// live in agentRequestHandler / agentRpcHandler — Zod only checks input shape.
export const MoveNodeInputSchema = z.object({
	nodeId: z.string().uuid(),
	newParentId: z.string().uuid(),
	position: z.number().int().min(0).optional(),
});

// -- Delete tool --------------------------------------------------------------

// D-11: deleteNode cascade gate. Optional boolean; missing/false on a non-leaf
// returns code='cascade_required' from the handler (NOT the schema).
export const DeleteNodeInputSchema = z.object({
	nodeId: z.string().uuid(),
	cascade: z.boolean().optional(),
});

// -- File-lifecycle tools (D-13: path is the security-sensitive surface) -----

export const SaveFileAsInputSchema = z.object({
	path: z.string().min(1),
});

export const OpenFileInputSchema = z.object({
	path: z.string().min(1),
});
