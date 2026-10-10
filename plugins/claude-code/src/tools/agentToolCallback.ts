// Shared MCP registerTool callback. The 17 net-new tools in server.ts (Plan 06-05) call
// agentToolCallback(method, wsClient) instead of duplicating the try/catch/sentinel/format
// boilerplate from the existing updateNodeStatus tool. Anti-sprawl: testing this helper ONCE
// (test 5 in agent-contracts.test.ts) covers the delegation path for all 17 callers.
//
// Result shape (RESEARCH §9 — same as the existing updateNodeStatus tool):
//   success                                    → { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] }
//   error WITH structured code+message (+hint) → { content: [Error (<code>): <msg> <hint>], isError: true }
//   error WITHOUT a code (transport failure)   → consult sentinel:
//                                                  app down → "Error (app_not_running): RoadRaven is not running…"
//                                                  app up   → falls through to internal_error formatting
//
// The sentinel branch only fires when the error has NO code field, i.e., the WS transport
// itself failed (disconnect, timeout) before reaching the structured Bun handler. Errors
// rejected through wsClient.request's `pending` map carry the structured code/hint already
// (see plugins/claude-code/src/wsClient.ts Plan 06-02), so they take the formatting path.
import { APP_NOT_RUNNING_MESSAGE, readSentinel } from "../sentinel";
import type { AgentErrorCode } from "./errors";

// Typed against AGENT_ERROR_CODES, so a renamed or removed code fails tsc.
const APP_NOT_RUNNING: AgentErrorCode = "app_not_running";

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

// Structured-error formatter (RESEARCH §9): `Error (<code>): <msg> <hint>`,
// plus — v0.7 Phase 2 — a rendered `data` line (e.g. stale_write's
// { currentRevision }, batch_validation_failed's { failures }) so the agent
// can recover without a re-read. Best-effort: a non-serializable payload just
// drops the Data suffix.
function formatStructuredError(e: {
	code: string;
	hint?: string;
	message?: string;
	data?: unknown;
}): McpResult {
	const message = e.message ?? "Unknown error";
	const hint = e.hint ? ` ${e.hint}` : "";
	let data = "";
	if (e.data !== undefined) {
		try {
			data = `\nData: ${JSON.stringify(e.data)}`;
		} catch {
			// non-serializable data — omit
		}
	}
	return {
		content: [
			{ type: "text", text: `Error (${e.code}): ${message}${hint}${data}` },
		],
		isError: true,
	};
}

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
			const e = err as {
				code?: string;
				hint?: string;
				message?: string;
				data?: unknown;
			};

			// Structured-error path: error came from the Bun handler with a known code
			// from AGENT_ERROR_CODES — format per RESEARCH §9 and return.
			if (typeof e.code === "string" && e.code.length > 0) {
				return formatStructuredError({
					code: e.code,
					message: e.message,
					hint: e.hint,
					data: e.data,
				});
			}

			// Transport-failure path: no code → distinguish app-not-running from
			// app-up-but-WS-blip via the sentinel.
			const sentinel = await readSentinel();
			if (!sentinel.ok) {
				return formatStructuredError({
					code: APP_NOT_RUNNING,
					message: APP_NOT_RUNNING_MESSAGE,
				});
			}
			const message = e.message ?? "Unknown error";
			return {
				content: [{ type: "text", text: `Error (internal_error): ${message}` }],
				isError: true,
			};
		}
	};
}

type NoteNode = { notes?: unknown; children?: NoteNode[] };

function stripNotes(nodes: NoteNode[]): void {
	for (const n of nodes) {
		delete n.notes;
		if (Array.isArray(n.children)) stripNotes(n.children);
	}
}

// getRoadmap with optional `omitNotes`: the arg is consumed here (the app never
// sees it) and notes are stripped from the successful JSON result. Errors pass
// through untouched.
export function getRoadmapCallback(wsClient: WsClientLike) {
	const base = agentToolCallback("getRoadmap", wsClient);
	return async (args: Record<string, unknown> | undefined) => {
		const { omitNotes, ...rest } = args ?? {};
		const result = await base(rest);
		if (omitNotes !== true || result.isError) return result;
		// omitNotes is only an optimisation: anything unparseable passes through.
		let parsed: { schema?: { nodes?: unknown[] } } | undefined;
		try {
			parsed = JSON.parse(result.content[0]?.text as string);
		} catch {
			return result;
		}
		stripNotes(parsed?.schema?.nodes ?? []);
		return {
			content: [
				{ type: "text" as const, text: JSON.stringify(parsed, null, 2) },
			],
		};
	};
}
