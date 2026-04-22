import type { IntegrationEvent } from "../packages/core/src/plugin.ts";

export type { IntegrationEvent };

/**
 * RPCSchema type from electrobun/bun. Defined here as a passthrough generic
 * because shared/ is outside the desktop package and cannot resolve electrobun.
 * The actual RPCSchema constraint is enforced at usage site in packages/desktop/.
 */
type RPCSchema<T> = T;

// -- Theme types -------------------------------------------------------------

export type ThemePreference = "dark" | "light" | "high-contrast" | "system";

/**
 * Strict settings interface — add fields here as new phases need them.
 * Each field is optional so partial updates work via saveSettings RPC.
 */
export interface AppSettings {
	theme?: ThemePreference;
	recentFiles?: string[];
	fileSettings?: Record<string, { layout?: "TB" | "LR" }>;
}

// -- Zod-inferred types from @roadraven/core --------------------------------

import type {
	NodeStatus as _NodeStatus,
	RoadmapNode as _RoadmapNode,
	RoadmapSchema as _RoadmapSchema,
	StatusConfig as _StatusConfig,
} from "../packages/core/src/schema.ts";

export type NodeStatus = _NodeStatus;
export type RoadmapNode = _RoadmapNode;
export type RoadmapSchema = _RoadmapSchema;
export type StatusConfig = _StatusConfig;

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
		requests: Record<string, never>;
		messages: {
			pushStatusUpdate: {
				nodeId: string;
				status: string;
				meta?: Record<string, unknown>;
			};
			pushEventLog: { event: IntegrationEvent };
			pushFileChanged: { path: string };
			pushOwnershipMap: { entries: Array<[string, string]> };
		};
	}>;
};
