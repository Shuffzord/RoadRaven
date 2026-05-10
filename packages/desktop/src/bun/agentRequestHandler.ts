import { getLogger } from "@logtape/logtape";
import type { ServerWebSocket } from "bun";
import type { AgentRequest } from "./eventSchema";
import { getOwnership, setOwnership } from "./refMap";
import {
	getCachedMainPath,
	isPathWithinMainDir,
	pushDialogAllowlistPath,
} from "./saveFile";
import { loadSettings } from "./settings";

const agentLogger = getLogger(["roadraven", "agent"]);

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

function sendResponse(ws: WsLike, id: string, result: unknown): void {
	ws.send(JSON.stringify({ type: "response", id, result }));
}

function sendError(
	ws: WsLike,
	id: string,
	code: string,
	message: string,
	hint?: string,
	data?: unknown,
): void {
	const error: Record<string, unknown> = { code, message };
	if (hint !== undefined) error.hint = hint;
	if (data !== undefined) error.data = data;
	ws.send(JSON.stringify({ type: "response", id, error }));
}

/**
 * Phase 6 PLUG-AGENT-TRANSPORT-01 / SAFETY-01..03.
 *
 * Gate sequence (each fails fast and returns BEFORE the next):
 *   1. RESEARCH §13 kill-switch → agent_api_disabled
 *   2. D-13 path allowlist → path_not_permitted (openFile/saveFileAs only)
 *   3. RESEARCH §Risks L-08 cross-ref boundary → cross_ref_boundary (moveNode only)
 *   4. forward to renderer → renderer applies the remaining gates
 *      (no_file_loaded, node_not_found, cascade_required, move_would_create_cycle)
 *      and returns either {ok:true,data} or {ok:false,error,code,hint?,data?}.
 *
 * On any throw from the RPC bridge, log + return internal_error.
 */
export async function agentRequestHandler(
	ws: WsLike,
	request: AgentRequest,
	mainWindow: MainWindowLike,
): Promise<void> {
	const start = Date.now();

	// GATE 1 — kill-switch (RESEARCH §13 — Claude's discretion)
	const settings = loadSettings();
	if (settings.agentApi?.enabled === false) {
		agentLogger.warn`Agent request blocked by kill-switch tool=${request.method}`;
		sendError(
			ws,
			request.id,
			"agent_api_disabled",
			"Agent API is disabled in application settings.",
			"Enable it by setting agentApi.enabled = true in the app's settings.json (Windows: %LOCALAPPDATA%\\RoadRaven\\settings.json; macOS: ~/Library/Application Support/RoadRaven/settings.json; Linux: ~/.config/RoadRaven/settings.json).",
		);
		return;
	}

	// GATE 2 — path-traversal allowlist (D-13, RESEARCH §Risks L-05)
	if (request.method === "openFile" || request.method === "saveFileAs") {
		const path = (request.params as { path?: unknown }).path;
		if (typeof path !== "string" || !isPathWithinMainDir(path)) {
			agentLogger.warn`Agent path-allowlist denial tool=${request.method} path=${String(path)}`;
			sendError(
				ws,
				request.id,
				"path_not_permitted",
				"Path is outside the permitted directory.",
				"Open the target directory in the app first, or navigate to the file via the file picker.",
			);
			return;
		}
		// Allowlist the path for subsequent saveFile calls within this session
		pushDialogAllowlistPath(path);
	}

	// GATE 3 — cross-ref boundary check for moveNode (RESEARCH §Risks L-08).
	//
	// CR-03 (Phase 6 06-REVIEW): the prior `owner1 && owner2 && owner1 !== owner2`
	// guard failed OPEN for any node missing from the ownership map. Agent-created
	// nodes were never propagated to the map (setOwnership only ran during
	// loadFile / resolveRefs), so the gate silently skipped after `createNode` →
	// `moveNode`, violating Phase 3 EDIT-16. Fix: default missing entries to the
	// current main file. WR-07 follow-on: getOwnership() always returns a Map —
	// drop the impossible | undefined | null cast; if a future refactor breaks
	// the contract, fail loud rather than papering over.
	if (request.method === "moveNode") {
		const { nodeId, newParentId } = request.params as {
			nodeId?: unknown;
			newParentId?: unknown;
		};
		if (typeof nodeId === "string" && typeof newParentId === "string") {
			const ownershipMap = getOwnership();
			const cachedMain = getCachedMainPath();
			// Default to the current main file when ownership is unknown. This
			// closes the "agent created node, then moved it across boundary"
			// hole: the new node is treated as belonging to the main file, so a
			// move into a $ref-owned subtree (whose ancestors do have explicit
			// ownership) trips the gate as expected.
			const owner1 = ownershipMap.get(nodeId) ?? cachedMain;
			const owner2 = ownershipMap.get(newParentId) ?? cachedMain;
			if (owner1 && owner2 && owner1 !== owner2) {
				agentLogger.warn`Agent cross-ref move denied nodeId=${nodeId} newParentId=${newParentId} owner1=${owner1} owner2=${owner2}`;
				sendError(
					ws,
					request.id,
					"cross_ref_boundary",
					"Cannot move node across $ref file boundaries.",
					"Phase 3 EDIT-16: cross-boundary moves are blocked.",
				);
				return;
			}
		}
	}

	// GATE 4 — forward to renderer (no_file_loaded, node_not_found, cascade_required,
	//           move_would_create_cycle, cannot_delete_last_root all enforced renderer-side)
	try {
		if (!mainWindow.webview.rpc) {
			sendError(
				ws,
				request.id,
				"internal_error",
				"Renderer RPC not available.",
				"Reopen the app window.",
			);
			return;
		}
		const result = await mainWindow.webview.rpc.request.agentRequest({
			tool: request.method,
			args: request.params,
		});
		const durationMs = Date.now() - start;
		if (result.ok) {
			// CR-03 (Phase 6 06-REVIEW): record ownership for newly-created nodes
			// so the cross-ref boundary gate (above) has a valid entry for the
			// next moveNode. The new node inherits its parent's owner; if the
			// parent has no explicit ownership, fall back to the cached main
			// path (the renderer's no_file_loaded gate prevents createNode
			// when no file is loaded, so cachedMainPath is non-null here in
			// the non-test path — the null-guard below is for safety).
			if (request.method === "createNode") {
				const parentId = (request.params as { parentId?: unknown }).parentId;
				const newId = (result.data as { nodeId?: unknown } | null | undefined)
					?.nodeId;
				if (typeof parentId === "string" && typeof newId === "string") {
					const ownershipMap = getOwnership();
					const cachedMain = getCachedMainPath();
					const inherited = ownershipMap.get(parentId) ?? cachedMain;
					if (inherited) {
						setOwnership(newId, inherited);
					}
				}
			}
			agentLogger.info`Agent tool ok tool=${request.method} durationMs=${durationMs}`;
			sendResponse(ws, request.id, result.data);
		} else {
			agentLogger.warn`Agent tool error tool=${request.method} code=${result.code} durationMs=${durationMs}`;
			sendError(
				ws,
				request.id,
				result.code,
				result.error,
				result.hint,
				result.data,
			);
		}
	} catch (err) {
		agentLogger.error`Agent request internal error: ${String(err)}`;
		sendError(
			ws,
			request.id,
			"internal_error",
			"An internal error occurred.",
			"Check app logs for details.",
		);
	}
}
