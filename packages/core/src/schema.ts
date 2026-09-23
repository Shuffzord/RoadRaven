import { z } from "zod";

/**
 * Valid node status values.
 * Used for both schema validation and TypeScript union type.
 */
export const NodeStatusSchema = z.enum([
	"not-started",
	"in-progress",
	"completed",
	"blocked",
]);

/**
 * Status configuration entry — user-defined label + optional color.
 */
export const StatusConfigSchema = z.object({
	id: z.string(),
	label: z.string(),
	color: z.string().optional(),
});

/**
 * Type configuration entry — user-defined node type label.
 */
export const TypeConfigSchema = z.object({
	id: z.string(),
	label: z.string(),
});

/**
 * Single roadmap node with recursive children via Zod v4 getter pattern.
 * Uses `get children()` for lazy recursive reference (Pitfall 6 avoided: import from "zod" not "zod/v4").
 */
// v0.7 Phase 4: node ids are UUIDs or caller-supplied slugs (agent-created,
// identity-stable across recreation). One regex covers both — UUIDs are hex +
// hyphens, 36 chars ≤ 64. Must stay in sync with CallerNodeId in
// agentToolSchemas.ts and the plugin's schemas.ts; the save/load gates
// (saveFileHandler, loadFile) validate against THIS schema, so a stricter id
// here than at the tool layer makes slug-id nodes unsaveable.
export const NodeIdSchema = z
	.string()
	.regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/);

export const RoadmapNodeSchema = z.object({
	id: NodeIdSchema,
	title: z.string().min(1),
	status: NodeStatusSchema,
	type: z.string().optional(),
	notes: z.string().optional(),
	createdAt: z.string().datetime().optional(),
	updatedAt: z.string().datetime().optional(),
	metadata: z.record(z.string(), z.unknown()).optional(),
	plugin: z.unknown().optional(),
	subscribe: z.unknown().optional(),
	get children() {
		return z.array(RoadmapNodeSchema).optional();
	},
	$ref: z.string().optional(),
});

/**
 * Top-level roadmap schema — the shape of a `.roadmap.json` file.
 */
export const RoadmapSchemaSchema = z.object({
	version: z.string(),
	title: z.string(),
	// Persisted document mutation counter. Files written before v0.7 may omit it;
	// the desktop store keeps its agent optimistic-lock token separately.
	revision: z.number().int().min(1).optional(),
	// Deprecated (v0.8.3 Phase 4, A3): per-file theme overrides never shipped —
	// `statusConfig[].color` is the per-status colour, themes are user files.
	// Kept as an opaque optional key so a file written with one still parses
	// and round-trips; nothing reads it.
	themeConfig: z.unknown().optional(),
	statusConfig: z.array(StatusConfigSchema).optional(),
	typeConfig: z.array(TypeConfigSchema).optional(),
	nodes: z.array(RoadmapNodeSchema),
});

// Inferred TypeScript types from Zod schemas
export type RoadmapNode = z.infer<typeof RoadmapNodeSchema>;
export type RoadmapSchema = z.infer<typeof RoadmapSchemaSchema>;
export type NodeStatus = z.infer<typeof NodeStatusSchema>;
export type StatusConfig = z.infer<typeof StatusConfigSchema>;
export type TypeConfig = z.infer<typeof TypeConfigSchema>;
