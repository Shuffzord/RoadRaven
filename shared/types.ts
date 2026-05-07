import type { IntegrationEvent } from "../packages/core/src/plugin.ts";

export type { IntegrationEvent };

/**
 * RPCSchema type from electrobun/bun. Defined here as a passthrough generic
 * because shared/ is outside the desktop package and cannot resolve electrobun.
 * The actual RPCSchema constraint is enforced at usage site in packages/desktop/.
 */
type RPCSchema<T> = T;

// -- Theme types -------------------------------------------------------------

export type ThemePreference =
	| "dark"
	| "light"
	| "high-contrast"
	| "paper"
	| "amber"
	| "contrast"
	| "slate"
	| "moss"
	| "system";

/**
 * Strict settings interface — add fields here as new phases need them.
 * Each field is optional so partial updates work via saveSettings RPC.
 */
export interface AppSettings {
	theme?: ThemePreference;
	recentFiles?: string[];
	fileSettings?: Record<string, { layout?: "TB" | "LR" }>;
	eventApi?: {
		/** User-specified WebSocket port override. When set, no auto-fallback on EADDRINUSE. */
		port?: number;
	};
	agentApi?: {
		/** RESEARCH §13 (kill-switch — Phase 6). When false, all agent mutation/read tools return code 'agent_api_disabled' before any tool dispatch. */
		enabled?: boolean;
	};
}

// -- Zod-inferred types from @roadraven/core --------------------------------
// Used internally by the RPC contract below. Consumers needing these types
// should import directly from "packages/core/src/schema" — re-exporting them
// here created two valid import paths for the same type and was flagged as
// duplicate by fallow.

import type {
	RoadmapNode,
	RoadmapSchema,
} from "../packages/core/src/schema.ts";

// -- RPC Contract -----------------------------------------------------------

/**
 * Typed RPC contract between Bun main process and webview.
 * Single source of truth -- both sides import from this file.
 * Breaking changes require updating both sides before shipping.
 */
export type RoadmapRPCType = {
	bun: RPCSchema<{
		requests: {
			loadFile: {
				params: { path: string };
				response: {
					data: RoadmapSchema | null;
					errors?: Array<{ path: string; message: string; code: string }>;
				};
			};
			saveFile: {
				params: { schema: RoadmapSchema; filePath?: string };
				response: { ok: true } | { ok: false; error: string };
			};
			exportHtml: { params: { path: string }; response: undefined };
			exportPng: { params: { path: string }; response: undefined };
			openFilePicker: {
				params: Record<string, never>;
				response: string;
			};
			resolveRef: { params: { refPath: string }; response: RoadmapNode[] };
			saveSettings: {
				params: { settings: Partial<AppSettings> };
				response: { success: boolean };
			};
			loadSettings: {
				params: Record<string, never>;
				response: { settings: AppSettings };
			};
			newFile: {
				params: Record<string, never>;
				response: { data: RoadmapSchema; filePath: null };
			};
			saveFileAs: {
				params: { schema: RoadmapSchema };
				response: { filePath: string | null };
			};
			logMessage: {
				params: {
					level: "debug" | "info" | "warning" | "error" | "fatal";
					category: string[];
					message: string;
					data?: Record<string, unknown>;
				};
				response: undefined;
			};
			setNodeAllowlist: {
				params: { nodeIds: string[]; statusIds: string[] };
				response: { ok: true };
			};
			// Renderer-pulls-on-mount path so the EventApiPill / Welcome URL line do
			// not depend on the Bun→renderer push at startup landing before the
			// bundle's RPC handlers register (the push at index.ts initial-state
			// site races bundle load and was dropped silently — UAT D-07 regression).
			getEventApiState: {
				params: Record<string, never>;
				response: {
					status: "off" | "listening" | "error";
					port: number | null;
					connectedCount: number;
					errorMessage: string | null;
				};
			};
		};
		messages: {
			nodeStatusUpdate: {
				nodeId: string;
				status: string;
				meta?: Record<string, unknown>;
			};
			integrationEvent: { source: string; event: IntegrationEvent };
			fileChanged: { path: string };
		};
	}>;
	webview: RPCSchema<{
		requests: {
			/**
			 * D-15/D-16: Phase 6 agent dispatcher. Bun's agentRequestHandler (Plan 06-03)
			 * forwards POST-gates here; the renderer's agentRpcHandler (Plan 06-04) routes
			 * the `tool` string to the appropriate roadmapStore action and returns the
			 * structured result. Keeping ONE entry (vs 17) keeps RoadmapRPCType lean.
			 *
			 * NOTE: Plan 06-01 originally placed this in bun.requests; Plan 06-03 moved it
			 * to webview.requests because Bun is the CALLER and the renderer is the
			 * HANDLER (the renderer owns the Zustand store and applies the per-tool gates).
			 */
			agentRequest: {
				params: {
					tool: string;
					args: Record<string, unknown>;
				};
				response:
					| { ok: true; data: unknown }
					| {
							ok: false;
							error: string;
							code: string;
							hint?: string;
							data?: unknown;
					  };
			};
		};
		messages: {
			pushStatusUpdate: {
				// Batched shape per D-25 — emitted by the Bun producer (Plan 04-02)
				// and consumed by the renderer handler (Plan 04-03). The legacy
				// single-node shape was removed once Plan 04-03 stabilised.
				updates: Array<{
					nodeId: string;
					status: string;
					meta?: Record<string, unknown>;
					source?: string;
					lastEventAt: number;
				}>;
			};
			pushEventLog: { events: IntegrationEvent[] };
			pushFileChanged: { path: string };
			pushOwnershipMap: { entries: Array<[string, string]> };
			pushEventApiState: {
				status: "off" | "listening" | "error";
				port: number | null;
				connectedCount: number;
				errorMessage: string | null;
			};
			pushEventApiError: {
				type: "malformed" | "unknown_node" | "invalid_status" | "disconnect";
				source: string;
				detail?: string;
			};
		};
	}>;
};
