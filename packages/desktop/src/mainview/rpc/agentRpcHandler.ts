// Phase 6 Plan 06-04 — renderer dispatcher (RED scaffold).
// GREEN task implements the switch + gates.
export type AgentResult =
	| { ok: true; data: unknown }
	| { ok: false; error: string; code: string; hint?: string; data?: unknown };

export async function handleAgentRequest(
	_tool: string,
	_args: Record<string, unknown>,
): Promise<AgentResult> {
	throw new Error("handleAgentRequest not implemented (RED scaffold)");
}
