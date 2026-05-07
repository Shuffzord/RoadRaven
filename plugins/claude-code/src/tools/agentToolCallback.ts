// Shared MCP registerTool callback. The 17 net-new tools in server.ts (Plan 06-05) call
// agentToolCallback(method, wsClient) instead of duplicating the try/catch/sentinel/format
// boilerplate from the existing updateNodeStatus tool. Anti-sprawl: testing this helper ONCE
// (test 5 in agent-contracts.test.ts) covers the delegation path for all 17 callers.
//
// Result shape (RESEARCH §9 — same as the existing updateNodeStatus tool):
//   success                                    → { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] }
//   error WITH structured code+message (+hint) → { content: [Error (<code>): <msg> <hint>], isError: true }
//   error WITHOUT a code (transport failure)   → consult sentinel:
//                                                  app down → "Roadmap Viewer is not running…"
//                                                  app up   → falls through to internal_error formatting
//
// The sentinel branch only fires when the error has NO code field, i.e., the WS transport
// itself failed (disconnect, timeout) before reaching the structured Bun handler. Errors
// rejected through wsClient.request's `pending` map carry the structured code/hint already
// (see plugins/claude-code/src/wsClient.ts Plan 06-02), so they take the formatting path.
import { readSentinel } from "../sentinel";

// Non-generic on purpose — agentToolCallback never narrows the result type
// (it serializes whatever comes back through JSON.stringify), and the looser
// signature lets test stubs pass without restating the generic.
type WsClientLike = {
	request(method: string, params: Record<string, unknown>): Promise<unknown>;
};

type McpResult = {
	content: Array<{ type: "text"; text: string }>;
	isError?: boolean;
};

export function agentToolCallback(
	method: string,
	wsClient: WsClientLike,
): (args: Record<string, unknown> | undefined) => Promise<McpResult> {
	return async (args) => {
		try {
			const result = await wsClient.request(method, args ?? {});
			return {
				content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
			};
		} catch (err: unknown) {
			const e = err as { code?: string; hint?: string; message?: string };

			// Structured-error path: error came from the Bun handler with a known code
			// from AGENT_ERROR_CODES — format per RESEARCH §9 and return.
			if (typeof e.code === "string" && e.code.length > 0) {
				const message = e.message ?? "Unknown error";
				const hint = e.hint ? ` ${e.hint}` : "";
				return {
					content: [
						{ type: "text", text: `Error (${e.code}): ${message}${hint}` },
					],
					isError: true,
				};
			}

			// Transport-failure path: no code → distinguish app-not-running from
			// app-up-but-WS-blip via the sentinel.
			const sentinel = await readSentinel();
			if (!sentinel.ok) {
				return {
					content: [
						{
							type: "text",
							text: "Roadmap Viewer is not running. Start the app and retry.",
						},
					],
					isError: true,
				};
			}
			const message = e.message ?? "Unknown error";
			return {
				content: [{ type: "text", text: `Error (internal_error): ${message}` }],
				isError: true,
			};
		}
	};
}
