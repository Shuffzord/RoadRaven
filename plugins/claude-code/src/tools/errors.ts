// Phase 6 D-11/D-12/D-13 — single source of truth for agent-side error codes.
// Values are STRING LITERALS, not numbers (RESEARCH §9: deviates from JSON-RPC 2.0 number codes
// in favour of agent-readable strings). Mirror MUST stay in sync with the renderer + Bun handlers.
//
// Downstream plans (06-03 agentRequestHandler, 06-04 agentRpcHandler) MUST import from this file
// rather than redeclaring the taxonomy. Test 1 in agent-contracts.test.ts pins the count at 13.
export const AGENT_ERROR_CODES = [
	"app_not_running",
	"no_file_loaded",
	"node_not_found",
	"cascade_required",
	"cannot_delete_last_root",
	"path_not_permitted",
	"cross_ref_boundary",
	"move_would_create_cycle",
	"file_read_error",
	"save_error",
	"agent_api_disabled",
	"unknown_tool",
	"internal_error",
] as const;
export type AgentErrorCode = (typeof AGENT_ERROR_CODES)[number];

/** Convenience type for structured error returns from Bun → MCP plugin layer. */
export interface AgentErrorPayload {
	code: AgentErrorCode;
	message: string;
	hint?: string;
	data?: unknown;
}
