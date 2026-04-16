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
export const RoadmapNodeSchema = z.object({
	id: z.string().uuid(),
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
	themeConfig: z
		.object({
			statusColors: z.record(z.string(), z.string()).optional(),
			nodeRadius: z.number().optional(),
		})
		.optional(),
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
