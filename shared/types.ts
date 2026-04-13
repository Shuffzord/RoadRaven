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
	// Phase 2 adds: layout?: 'TB' | 'LR';
	// Phase 2 adds: recentFiles?: string[];
}

// -- Placeholder types (filled in Phase 2 with Zod schemas) ----------------

/** Placeholder -- full Zod-validated schema defined in @roadraven/core Phase 2 */
export interface RoadmapSchema {
	version: string;
	title: string;
	nodes: RoadmapNode[];
}

/** Placeholder -- full node type defined in @roadraven/core Phase 2 */
export interface RoadmapNode {
	id: string;
	title: string;
	status: string;
	children?: RoadmapNode[];
}

// -- RPC Contract -----------------------------------------------------------

/**
 * Typed RPC contract between Bun main process and webview.
 * Single source of truth -- both sides import from this file.
 * Breaking changes require updating both sides before shipping.
 */
export type RoadmapRPCType = {
	bun: RPCSchema<{
		requests: {
			loadFile: { params: { path: string }; response: RoadmapSchema };
			saveFile: { params: { schema: RoadmapSchema }; response: void };
			exportHtml: { params: { path: string }; response: void };
			exportPng: { params: { path: string }; response: void };
			openFilePicker: {
				params: Record<string, never>;
				response: string | null;
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
			logMessage: {
				params: {
					level: "debug" | "info" | "warning" | "error" | "fatal";
					category: string[];
					message: string;
					data?: Record<string, unknown>;
				};
				response: void;
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
		messages: {
			pushStatusUpdate: {
				nodeId: string;
				status: string;
				meta?: Record<string, unknown>;
			};
			pushEventLog: { event: IntegrationEvent };
			pushFileChanged: { path: string };
		};
	}>;
};
