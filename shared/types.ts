import type { IntegrationEvent } from "../packages/core/src/plugin.ts";
import type { ThemeFile } from "./themeSchema.ts";

export type { IntegrationEvent };

/**
 * RPCSchema type from electrobun/bun. Defined here as a passthrough generic
 * because shared/ is outside the desktop package and cannot resolve electrobun.
 * The actual RPCSchema constraint is enforced at usage site in packages/desktop/.
 */
type RPCSchema<T> = T;

// -- Theme types -------------------------------------------------------------

/**
 * A theme id (built-ins are registered in
 * packages/desktop/src/mainview/themes; user themes arrive in v0.8.3 Phase 4)
 * or `"system"`, which follows the OS colour scheme. The store maps an
 * unknown id to the default theme.
 */
export type ThemePreference = string;

/**
 * One file in `<userData>/themes` (v0.8.3 Phase 4). The Bun side validates
 * every file through ThemeFileSchema: a valid one carries `file` and its
 * required-tier contrast failure count (advisory, never blocks selection);
 * an invalid one carries `error` (the reason) and no `file`. The renderer
 * keeps the last good `file` on an entry that turned invalid, so a
 * half-saved edit never blanks the active theme.
 */
export interface UserThemeEntry {
	id: string;
	file?: ThemeFile;
	requiredFailures?: number;
	error?: string;
}

/** Outcome of a theme-file write (duplicate / import). */
export type ThemeWriteResult =
	| { ok: true; id: string }
	| { ok: false; error: string };

/** Outcome of a theme-file delete (v0.8.3 Phase 7). */
export type ThemeDeleteResult = { ok: true } | { ok: false; error: string };

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
	/** v0.8.2 A8: reopen the most recent roadmap on launch. Absent = true. */
	reopenLastFile?: boolean;
	/** v0.8.2: expanded sidebar width in px, set by dragging its right edge. */
	sidebarWidth?: number;
	/** v0.8.2: node search also matches notes (the search-box toggle). Absent = false. */
	searchInNotes?: boolean;
	/** First-run setup wizard state (v0.6). */
	setup?: {
		/** True once the user has finished or dismissed the first-run wizard. */
		completed?: boolean;
	};
}

/** One step in the MCP integration install, surfaced live in the Setup Wizard. */
/** MCP hosts the Setup Wizard can register RoadRaven with (v0.8). */
export type McpHost = "claude" | "opencode";

export interface McpInstallStep {
	id: string;
	label: string;
	status: "ok" | "error" | "skipped";
	detail?: string;
	/** Which host this step belongs to. Absent for host-independent steps
	 * (locating and copying the bundled server happen once for all hosts). */
	host?: McpHost;
}

/**
 * What the user should do about an MCP server version mismatch (v0.8). The
 * Bun process decides it; the renderer only displays it. Carried as the third
 * field of the version_mismatch toast detail: `<producer>|<app>|<remedy>`.
 */
export type MismatchRemedy =
	| "update-app"
	| "restart-agent"
	| "update-plugin"
	| "update-npm"
	| "reinstall";

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
					filePath?: string;
					errors?: Array<{ path: string; message: string; code: string }>;
					sidecarUpdates?: Array<{
						nodeId: string;
						status: RoadmapNode["status"];
						meta?: Record<string, unknown>;
						source?: string;
						lastEventAt: number;
					}>;
					// v0.8.2 A6: absolute paths of the ownership-split companion
					// files ($ref targets) of the loaded roadmap, root excluded.
					// Empty for a single-file roadmap.
					linkedFiles?: string[];
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
				// defaultPath / defaultName seed the native dialog (the current
				// file's directory + basename); omitted = home dir + roadmap.json.
				params: {
					schema: RoadmapSchema;
					defaultPath?: string;
					defaultName?: string;
				};
				// A6: Save As writes the ROOT file only. Companion files of the
				// previously loaded roadmap are listed here (never copied) so the
				// renderer can warn.
				response: { filePath: string | null; linkedFilesNotCopied?: string[] };
			};
			// v0.8.2 file UX (Phase 1a) ------------------------------------
			setWindowTitle: { params: { title: string }; response: undefined };
			// Reveal a path in the OS file manager. ok:false when it does not
			// exist or the platform call fails.
			revealInFolder: { params: { path: string }; response: { ok: boolean } };
			// Open an https:// URL in the default browser (Preferences → About).
			// ok:false for any other scheme or when the platform call fails.
			openExternal: { params: { url: string }; response: { ok: boolean } };
			// Back to Welcome: stop file watchers and reset the Bun-side save
			// cache / ownership map / dialog allowlist (same reset as newFile).
			closeFile: { params: Record<string, never>; response: { ok: true } };
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
			// -- Setup Wizard (v0.6) ------------------------------------------
			// getSetupStatus: pulled on mount to decide whether to auto-open the
			// wizard and to seed the MCP-integration step's detected state.
			getSetupStatus: {
				params: Record<string, never>;
				response: {
					firstRun: boolean;
					claudeDetected: boolean;
					mcpServerAvailable: boolean;
					mcpInstalled: boolean;
					appVersion: string;
					// v0.8 multi-host: OpenCode is detected and registered
					// independently of Claude Code.
					openCodeDetected: boolean;
					openCodeInstalled: boolean;
					// True when the roadraven Claude Code plugin is installed —
					// the wizard then defers to it instead of registering a
					// second, duplicate server.
					pluginInstalled: boolean;
				};
			};
			// installMcpIntegration: copies the bundled MCP server into the user
			// data dir and registers it under mcpServers.roadraven in the user's
			// Claude Code config. Returns a per-step trace for the wizard to render.
			installMcpIntegration: {
				// v0.8: hosts selects which configs to write. Omitted = every
				// detected host.
				params: { hosts?: McpHost[] };
				response: {
					ok: boolean;
					steps: McpInstallStep[];
					serverPath?: string;
					configPath?: string;
				};
			};
			// completeSetup: persists setup.completed so the wizard stops auto-opening.
			completeSetup: {
				params: Record<string, never>;
				response: { ok: true };
			};
			// -- User themes (v0.8.3 Phase 4) ----------------------------------
			// The Bun process owns <userData>/themes but not the built-in
			// registry (renderer-only), so the renderer passes the ids a user
			// file may not take (`reservedIds`); a colliding file lists as
			// invalid and a colliding write is refused.
			listThemes: {
				params: { reservedIds?: string[] };
				response: { themes: UserThemeEntry[]; dir: string };
			};
			readTheme: {
				params: { id: string; reservedIds?: string[] };
				response: UserThemeEntry;
			};
			// Writes `source` under the slug of `name` (meta.name = name, author
			// unset). `source` is whatever the renderer paints — built-in or user
			// file — since Bun cannot resolve a built-in id itself.
			duplicateTheme: {
				params: { source: ThemeFile; name: string; reservedIds?: string[] };
				response: ThemeWriteResult;
			};
			// Pops the native open dialog in Bun (the renderer never supplies a
			// path) and copies the chosen file into the themes dir after
			// validation. `error: null` means the dialog was cancelled.
			importTheme: {
				params: { reservedIds?: string[] };
				response: ThemeWriteResult | { ok: false; error: null };
			};
			revealThemesFolder: {
				params: Record<string, never>;
				response: { ok: boolean };
			};
			// v0.8.3 Phase 5: the editor's autosave. Overwrites `<file.id>.json`
			// after validation; refused when no user theme of that id exists yet
			// (the editor never creates — duplicateTheme does).
			writeTheme: {
				params: { file: ThemeFile; reservedIds?: string[] };
				response: ThemeWriteResult;
			};
			// v0.8.3 Phase 7: removes `<id>.json` from the themes dir. The id is
			// pattern-checked before it becomes a path; a built-in (reserved) or
			// unknown id is refused.
			deleteTheme: {
				params: { id: string; reservedIds?: string[] };
				response: ThemeDeleteResult;
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
			// v0.8.2 A1 close guard: Bun asks the renderer whether the window may
			// close (renderer flushes autosave / prompts for untitled edits). Bun
			// treats a 3 s silence as allow so a hung renderer cannot trap the user.
			confirmClose: {
				params: Record<string, never>;
				response: { allow: boolean };
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
			pushFileChanged: { path: string; mainPath?: string };
			pushOwnershipMap: { entries: Array<[string, string]> };
			pushEventApiState: {
				status: "off" | "listening" | "error";
				port: number | null;
				connectedCount: number;
				errorMessage: string | null;
			};
			pushEventApiError: {
				type:
					| "malformed"
					| "unknown_node"
					| "invalid_status"
					| "disconnect"
					| "version_mismatch";
				source: string;
				detail?: string;
			};
			// v0.8.3 Phase 4: files in <userData>/themes changed (debounced);
			// `ids` are the basenames. The renderer re-lists and re-applies the
			// active theme if it is among them.
			pushThemesChanged: { ids: string[] };
		};
	}>;
};
