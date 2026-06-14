import { z } from "zod";

export const META_MAX_BYTES = 8 * 1024; // RESEARCH §4.1 cap

const HelloFrameSchema = z.object({
	type: z.literal("hello"),
	source: z.string().min(1).max(64),
	version: z.string().optional(),
});

const EventFrameSchema = z.object({
	nodeId: z.string().min(1), // permissive — NOT .uuid() per RESEARCH §2.1
	status: z.string().min(1).max(64),
	meta: z
		.record(z.string(), z.unknown())
		.optional()
		.refine(
			(v) =>
				v === undefined ||
				new TextEncoder().encode(JSON.stringify(v)).byteLength <=
					META_MAX_BYTES,
			{
				message: "meta exceeds 8KB",
			},
		),
	source: z.string().max(64).optional(),
});

/**
 * Phase 6 D-15: Bidirectional WS request envelope from the Phase 4 plugin.
 * Routed by eventServer.ts message handler to opts.onAgentRequest BEFORE the
 * 100ms EventCoalescer (RESEARCH §Debounce-Bypass — agent reads/writes never
 * participate in the event-batching path).
 */
export const AgentRequestSchema = z.object({
	type: z.literal("request"),
	id: z.string().min(1),
	method: z.string().min(1),
	params: z.record(z.string(), z.unknown()),
});

export type AgentRequest = z.infer<typeof AgentRequestSchema>;

const IncomingFrameSchema = z.union([
	HelloFrameSchema,
	AgentRequestSchema,
	EventFrameSchema,
]);

export type HelloFrame = z.infer<typeof HelloFrameSchema>;
export type EventFrame = z.infer<typeof EventFrameSchema>;
export type ErrorClass = "malformed" | "unknown_node" | "invalid_status";

export type Allowlist = {
	nodeIds: Set<string>;
	statusIds: Set<string>;
};

export function classifyEventFrame(
	parsed: EventFrame,
	allowlist: Allowlist,
): { ok: true } | { ok: false; error: ErrorClass } {
	if (!allowlist.nodeIds.has(parsed.nodeId)) {
		return { ok: false, error: "unknown_node" };
	}
	if (!allowlist.statusIds.has(parsed.status)) {
		return { ok: false, error: "invalid_status" };
	}
	return { ok: true };
}

export function parseIncoming(
	raw: string,
):
	| { ok: true; frame: HelloFrame | AgentRequest | EventFrame }
	| { ok: false; error: "malformed" } {
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		return { ok: false, error: "malformed" };
	}
	const result = IncomingFrameSchema.safeParse(parsed);
	if (!result.success) return { ok: false, error: "malformed" };
	return { ok: true, frame: result.data };
}
