// Zod input schemas for non-trivial agent tools. Each schema is referenced by
// exactly one server.registerTool call in plugins/claude-code/src/server.ts (Plan 06-05)
// and validated again on the Bun-side renderer dispatcher (Plan 06-04).
//
// Design notes:
// - nodeId fields use z.string().min(1) — permissive, matching Phase 4
//   eventSchema.ts and Bun-side agentToolSchemas.ts (RESEARCH §2.1). Phase 6
//   06-01 originally used .uuid() per RESEARCH §11, but that conflicts with
//   the Phase 4 decision and creates a strict pre-filter at the plugin
//   boundary that the Bun side intentionally does NOT mirror. Keeping the
//   plugin and Bun schemas in sync prevents the agent from getting a cryptic
//   Zod error before the Bun gate layer — and is what agentToolSchemas.ts:22
//   asks for explicitly ("IMPORTANT: keep these in sync").
// - status / type fields use z.string().min(1) NOT a fixed enum — Phase 4 D-26 enables
//   user-defined statuses; agents must accept whatever the loaded schema allows.
// - Cycle detection / cross-$ref / cascade gates live in the handler, not Zod (the
//   schema only checks the input shape, not the live tree state).
import { z } from "zod";
import {
	StatusConfigSchema,
	TypeConfigSchema,
} from "../../../../packages/core/src/schema";

// Permissive node-id string (NOT .uuid()) — RESEARCH §2.1, Phase 4 settled on
// permissive ids so user-authored schemas with non-UUID ids still load and
// fire events. Any UUID format check belongs at the on-disk schema layer
// (RoadmapNodeSchema), not the agent boundary.
const IdString = z.string().min(1);

// v0.7 CONC-01: optimistic-concurrency guard accepted by every write tool.
// Optional — omitted keeps pre-v0.7 last-writer-wins behavior. On mismatch the
// desktop returns stale_write with data.currentRevision.
const ExpectedRevision = z
	.number()
	.int()
	.min(1)
	.optional()
	.describe(
		"Revision from your last getRoadmap/getNode read. If the roadmap changed since, the write fails with stale_write instead of clobbering.",
	);

// -- Read tools (only non-trivial input shapes get a schema) ------------------

export const GetNodeInputSchema = z.object({
	nodeId: IdString.describe("ID of the target node"),
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
	parentId: IdString.optional(),
});

// -- Create tools -------------------------------------------------------------

// D-01: createNode — every tail field optional. parentId + title are the only requirements.
export const CreateNodeInputSchema = z.object({
	parentId: IdString.describe("ID of the parent node"),
	title: z.string().min(1).max(200).describe("Node title"),
	type: z.string().optional().describe("Node type id"),
	status: z
		.string()
		.optional()
		.describe("Status id — defaults to first statusConfig entry"),
	notes: z.string().optional(),
	metadata: z.record(z.string(), z.unknown()).optional(),
	expectedRevision: ExpectedRevision,
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
	nodeId: IdString,
	title: z.string().min(1).max(200),
	expectedRevision: ExpectedRevision,
});

export const UpdateNodeTypeInputSchema = z.object({
	nodeId: IdString,
	type: z.string(),
	expectedRevision: ExpectedRevision,
});

export const UpdateNodeNotesInputSchema = z.object({
	nodeId: IdString,
	notes: z.string(),
	expectedRevision: ExpectedRevision,
});

// D-04: PATCH semantics — null value deletes that key from node.metadata.
// patch is REQUIRED (cannot be undefined); empty object is allowed (no-op).
// Zod v4 z.record() requires explicit key+value types (Phase 2 D-26 lesson).
export const UpdateNodeMetadataInputSchema = z.object({
	nodeId: IdString,
	patch: z.record(z.string(), z.unknown().nullable()),
	expectedRevision: ExpectedRevision,
});

// D-01: moveNode with optional position. Cycle and cross-$ref-boundary checks
// live in agentRequestHandler / agentRpcHandler — Zod only checks input shape.
export const MoveNodeInputSchema = z.object({
	nodeId: IdString,
	newParentId: IdString,
	position: z.number().int().min(0).optional(),
	expectedRevision: ExpectedRevision,
});

// -- Delete tool --------------------------------------------------------------

// D-11: deleteNode cascade gate. Optional boolean; missing/false on a non-leaf
// returns code='cascade_required' from the handler (NOT the schema).
export const DeleteNodeInputSchema = z.object({
	nodeId: IdString,
	cascade: z.boolean().optional(),
	expectedRevision: ExpectedRevision,
});

// -- File-lifecycle tools (D-13: path is the security-sensitive surface) -----

export const SaveFileAsInputSchema = z.object({
	path: z.string().min(1),
});

export const OpenFileInputSchema = z.object({
	path: z.string().min(1),
});
