// Shared MCP registerTool callback. The 17 net-new tools in server.ts (Plan 06-05) call
// agentToolCallback(method, wsClient) instead of duplicating the try/catch/sentinel/format
// boilerplate from the existing updateNodeStatus tool. Anti-sprawl: testing this helper ONCE
// (test 5 in agent-contracts.test.ts) covers the delegation path for all 17 callers.
//
// Result shape (RESEARCH §9 — same as the existing updateNodeStatus tool):
//   success                                    → { content: [{ type: "text", text: JSON.stringify(shape(result)) }] }
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
import { type RoadmapResult, shapeRoadmap } from "./shapeTree";

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

// `shape` reshapes a successful result before it is serialised (compact JSON,
// to keep tool results small); errors never reach it.
export function agentToolCallback(
	method: string,
	wsClient: WsClientLike,
	shape: (result: unknown) => unknown = (r) => r,
): (args: Record<string, unknown> | undefined) => Promise<McpResult> {
	return async (args) => {
		try {
			const result = await wsClient.request(method, args ?? {});
			return {
				content: [{ type: "text", text: JSON.stringify(shape(result)) }],
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

type NoteNode = {
	notes?: unknown;
	createdAt?: unknown;
	updatedAt?: unknown;
	children?: NoteNode[];
};

function stripNotes(nodes: NoteNode[]): void {
	for (const n of nodes) {
		delete n.notes;
		delete n.createdAt;
		delete n.updatedAt;
		if (Array.isArray(n.children)) stripNotes(n.children);
	}
}

// getRoadmap with optional `rootId`, `depth`, `hideCompleted` and `omitNotes`,
// applied in that order. All are consumed here: the app is always asked with no
// arguments (v0.9.2 D-1), so the options work with any app version.
// Errors and non-object results pass through untouched.
export function getRoadmapCallback(wsClient: WsClientLike) {
	return (args: Record<string, unknown> | undefined) => {
		const { omitNotes, hideCompleted, rootId, depth } = args ?? {};
		const opts = {
			rootId: typeof rootId === "string" ? rootId : undefined,
			depth: typeof depth === "number" ? depth : undefined,
			hideCompleted: hideCompleted === true,
		};
		return agentToolCallback("getRoadmap", wsClient, (r) => {
			const res = r as RoadmapResult | undefined;
			if (!Array.isArray(res?.schema?.nodes)) return r;
			const out = shapeRoadmap(res, opts);
			if (omitNotes === true) stripNotes(out.schema.nodes as NoteNode[]);
			return out;
		})({});
	};
}

type FoundNode = {
	node: NoteNode & { status?: unknown };
	[key: string]: unknown;
};

// findNodes: each match comes back without its subtree, so a status query that
// matches the root cannot return the whole tree. Notes, metadata and parentId stay
// unless `omitNotes` is set. A `status` list is applied here: the app is asked
// without it (v0.9.2 D-1), so both options work with any app version.
export function findNodesCallback(wsClient: WsClientLike) {
	return (args: Record<string, unknown> | undefined) => {
		const { status, omitNotes, ...forwarded } = args ?? {};
		const statuses = Array.isArray(status) ? (status as unknown[]) : undefined;
		if (!statuses && status !== undefined) forwarded.status = status;
		return agentToolCallback("findNodes", wsClient, (r) => {
			const res = r as { nodes?: FoundNode[] } | undefined;
			if (!Array.isArray(res?.nodes)) return r;
			const kept = statuses
				? res.nodes.filter((m) => statuses.includes(m.node.status))
				: res.nodes;
			return {
				...res,
				nodes: kept.map(({ node: { children: _, ...node }, ...m }) => {
					if (omitNotes === true) stripNotes([node]);
					return { ...m, node };
				}),
			};
		})(forwarded);
	};
}
