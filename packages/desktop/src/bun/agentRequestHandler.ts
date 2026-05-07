import type { ServerWebSocket } from "bun";
import type { AgentRequest } from "./eventSchema";

type WsLike = ServerWebSocket<{
	id: string;
	source?: string;
	version?: string;
	helloAt: number | null;
	connectedAt: number;
}>;
type MainWindowLike = {
	webview: {
		rpc?: {
			request: {
				agentRequest: (params: {
					tool: string;
					args: Record<string, unknown>;
				}) => Promise<
					| { ok: true; data: unknown }
					| {
							ok: false;
							error: string;
							code: string;
							hint?: string;
							data?: unknown;
					  }
				>;
			};
		};
	};
};

/**
 * Phase 6 PLUG-AGENT-TRANSPORT-01 / SAFETY-* gate layer. RED stub — Plan 06-03 GREEN
 * fills in the gate sequence (kill-switch, path-allowlist, cross-ref, happy-path forward).
 */
export async function agentRequestHandler(
	_ws: WsLike,
	_request: AgentRequest,
	_mainWindow: MainWindowLike,
): Promise<void> {
	throw new Error("agentRequestHandler not implemented (RED scaffold)");
}
