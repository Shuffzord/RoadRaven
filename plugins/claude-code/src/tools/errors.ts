// Phase 6 D-11/D-12/D-13 — single source of truth for agent-side error codes.
// Values are STRING LITERALS, not numbers (RESEARCH §9: deviates from JSON-RPC 2.0 number codes
// in favour of agent-readable strings). Mirror MUST stay in sync with the renderer + Bun handlers.
export const AGENT_ERROR_CODES = [] as const; // INTENTIONALLY EMPTY — GREEN task fills with 13 codes
export type AgentErrorCode = (typeof AGENT_ERROR_CODES)[number];
