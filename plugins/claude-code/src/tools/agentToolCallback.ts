// Shared MCP registerTool callback. The 17 net-new tools in server.ts (Plan 06-05) call
// agentToolCallback(method, wsClient) instead of duplicating the try/catch/sentinel/format
// boilerplate from the existing updateNodeStatus tool. Anti-sprawl: testing this helper ONCE
// (in this plan, test 5) covers the delegation path for all 17 callers.
type WsClientLike = {
	request<T = unknown>(
		method: string,
		params: Record<string, unknown>,
	): Promise<T>;
};

export function agentToolCallback(
	_method: string,
	_wsClient: WsClientLike,
): (_args: unknown) => Promise<{
	content: Array<{ type: "text"; text: string }>;
	isError?: boolean;
}> {
	// INTENTIONALLY UNIMPLEMENTED — RED test 5 expects this throws / returns wrong shape.
	throw new Error("agentToolCallback not implemented");
}

// marker symbol so test 5 can verify import wiring before the GREEN implementation lands
export const __PHASE_6_CALLBACK_MARKER__ = "agentToolCallback-pending";
