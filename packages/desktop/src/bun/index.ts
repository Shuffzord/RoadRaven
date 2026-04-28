import { resolve as pathResolve } from "node:path";
import { getLogger } from "@logtape/logtape";
import Electrobun, {
	BrowserView,
	BrowserWindow,
	Updater,
	Utils,
} from "electrobun/bun";
import type {
	RoadmapNode,
	RoadmapSchema,
} from "../../../../packages/core/src/schema.ts";
import type { RoadmapRPCType } from "../../../../shared/types.ts";
// atomicWrite + splitSchemaByOwnership are consumed via saveFile.ts which owns
// the saveFile/flushPending logic. Re-exported below so external callers (and
// the Plan 04a acceptance grep) can see the persistence surface at a glance.
import { atomicWrite } from "./atomicWrite";
import { markSelfWrite, stopAllWatchers, watchFile } from "./fileWatcher";
import { bunLogger, setupBunLogging } from "./logging";
import {
	buildOwnershipMap,
	clearOwnershipMap,
	getOwnership,
	setSourceTemplate,
	splitSchemaByOwnership,
} from "./refMap";
import { defaultReadFile, resolveRefsWithOwnership } from "./resolveRefs";
import {
	clearCachedMainPath,
	flushPending,
	isPathWithinMainDir,
	pushDialogAllowlistPath,
	saveFileHandler,
	setCachedMainPath,
	setCachedSchema,
} from "./saveFile";
import { nativeSaveDialog } from "./saveFileDialog";

// Persistence surface re-exports — imported by Plan 04b/04c
export { atomicWrite, splitSchemaByOwnership };

import {
	DEFAULT_PORT,
	type EventServerHandle,
	getSidecarPath as getEventSidecarPath,
	startEventServer,
} from "./eventServer";
import { replayEventLog } from "./eventsLog";
import { serverLogger } from "./logging";
import { deleteSentinel, writeSentinel } from "./sentinel";
import { addRecentFile, loadSettings, saveSettings } from "./settings";

// Re-export the RPC type so downstream modules can import from the app entry
export type { RoadmapRPCType };
// Re-export flushPending so Plan 04c's before-quit wiring can import it from
// the app entry rather than reaching into the saveFile module directly.
export { flushPending, pushDialogAllowlistPath };

// Initialize logging before anything else (D-21)
await setupBunLogging();
bunLogger.info("Bun process starting");

// Load settings on startup
const initialSettings = loadSettings();
bunLogger.info`Loaded settings: ${JSON.stringify(initialSettings)}`;

// Port precedence: env > settings > default (D-02)
const envPort = process.env.ROADRAVEN_EVENT_PORT
	? Number(process.env.ROADRAVEN_EVENT_PORT)
	: null;
const settingsPort = initialSettings.eventApi?.port ?? null;
const requestedPort = envPort ?? settingsPort ?? DEFAULT_PORT;
const isUserSpecified = envPort !== null || settingsPort !== null;

// eventServerHandle is declared here (before startEventServer and shutdown hooks)
// so TypeScript can see the declaration before all uses.
let eventServerHandle: EventServerHandle | null = null;

// Note: mainWindow is not yet created here. The onFlush/onEvent callbacks use
// mainWindow which is defined later in this file. This works because the callbacks
// are closures — they capture the `mainWindow` binding which will be assigned
// before any WebSocket events arrive (server binds before window is shown but
// events require a WS producer to connect after the app is visible).
//
// I-09 fix (Plan 04-03 Task 6): onError and onConnectionChange now send active
// pushEventApi* RPC messages. State vars below track current server state so
// onConnectionChange can report the correct port/status alongside the count.
let currentStatus: "off" | "listening" | "error" = "off";
let currentPort: number | null = null;
let currentErrorMessage: string | null = null;
let currentConnectedCount = 0;

const eventServerResult = await startEventServer({
	requestedPort,
	isUserSpecified,
	onFlush: (updates) => {
		mainWindow.webview.rpc?.send.pushStatusUpdate({ updates });
	},
	onEvent: (event) => {
		mainWindow.webview.rpc?.send.pushEventLog({ events: [event] });
	},
	onError: (err) => {
		mainWindow.webview.rpc?.send.pushEventApiError({
			type: err.type,
			source: err.source,
			detail: err.detail,
		});
	},
	onConnectionChange: (count) => {
		currentConnectedCount = count;
		mainWindow.webview.rpc?.send.pushEventApiState({
			status: currentStatus,
			port: currentPort,
			connectedCount: count,
			errorMessage: currentErrorMessage,
		});
	},
});
if (eventServerResult.ok) {
	eventServerHandle = eventServerResult.handle;
	currentStatus = "listening";
	currentPort = eventServerHandle.port;
	currentErrorMessage = null;
	await writeSentinel({
		port: eventServerHandle.port,
		url: `ws://127.0.0.1:${eventServerHandle.port}`,
		startedAt: new Date().toISOString(),
		pid: process.pid,
	});
	serverLogger.info`event server listening on :${eventServerHandle.port}`;
} else {
	currentStatus = "error";
	currentPort = null;
	currentErrorMessage = `Failed to bind on attempted ports: ${eventServerResult.attempted.join(", ")}`;
	serverLogger.error`event server failed to bind, attempted: ${eventServerResult.attempted.join(",")}`;
}

const DEV_SERVER_PORT = 5173;
const DEV_SERVER_URL = `http://localhost:${DEV_SERVER_PORT}`;

/**
 * Determine the main view URL based on the current channel.
 * SCAF-09: Updater.localInfo.channel() throws when version.json is absent
 * (dev checkout). We catch that and default to "dev" channel.
 */
async function getMainViewUrl(): Promise<string> {
	let channel = "dev";
	try {
		channel = await Updater.localInfo.channel();
	} catch {
		// version.json not found -- treating as dev channel
	}

	if (channel === "dev") {
		try {
			await fetch(DEV_SERVER_URL, { method: "HEAD" });
			return DEV_SERVER_URL;
		} catch {
			// Vite dev server not running
		}
	}

	return "views://mainview/index.html";
}

// $ref resolution + ownership tagging lives in `./resolveRefs.ts` so the
// production loadFile handler (this file) and the test-only loadFileHandler
// in saveFile.ts share one implementation. Production passes a `watchFile`
// callback; tests omit it.

// EDIT-13 quit-flush + EDIT-18 Linux SIGTERM-flush wiring.
//
// PATH 1 — Electrobun before-quit: covers macOS Cmd+Q, Windows Alt+F4,
// Dock → Quit, Linux window-close (all routed through Utils.quit which emits
// the before-quit event). Verified API:
//   electrobun@1.16.0/dist/api/bun/events/ApplicationEvents.ts:20-21 — beforeQuit factory
//   electrobun@1.16.0/dist/api/bun/events/eventEmitter.ts:43         — singleton emitter
//   electrobun@1.16.0/dist/api/bun/core/Utils.ts:122-148              — Utils.quit() emits + stopEventLoop
//   electrobun@1.16.0/dist/api/bun/index.ts:114                       — Electrobun.events singleton
//
// CR-01 (Wave 3 review): both before-quit and the SIG* signal handlers below
// must AWAIT flushPending. Because flushPending now coalesces concurrent
// callers onto a single in-flight promise, awaiting in both paths means
// Ctrl+C in the owning shell (which fires SIGINT and triggers Utils.quit's
// before-quit emit) cannot tear an atomicWrite mid-rename — the SIGINT
// handler's process.exit(0) waits for the same promise the before-quit
// handler is awaiting.
Electrobun.events.on("before-quit", async () => {
	if (eventServerHandle) {
		await eventServerHandle.stop();
	}
	await deleteSentinel();
	await flushPending();
});

// PATH 2 — process signals: covers terminal `kill <pid>` (SIGTERM) and
// Ctrl+C in terminal (SIGINT). flushPending coalesces concurrent callers
// (CR-01) so it is safe even if both paths fire (e.g. Ctrl+C in the same
// shell that owns the Electrobun event loop) — the SIG* handler awaits the
// same in-flight promise that before-quit awaits.
process.on("SIGTERM", async () => {
	if (eventServerHandle) {
		await eventServerHandle.stop();
	}
	await deleteSentinel();
	await flushPending();
	process.exit(0);
});
process.on("SIGINT", async () => {
	if (eventServerHandle) {
		await eventServerHandle.stop();
	}
	await deleteSentinel();
	await flushPending();
	process.exit(0);
});

// Synchronous-only hook — log for audit. before-quit / SIG* are the primaries.
process.on("exit", (code) => {
	bunLogger.info`process.exit(${code}) — flush must have run via before-quit or SIG* path`;
});

// Define RPC handlers before creating the window (Electrobun pattern)
const rpc = BrowserView.defineRPC<RoadmapRPCType>({
	maxRequestTime: 120_000, // 2 min — native file dialogs block until user picks a file
	handlers: {
		requests: {
			// logMessage handler -- receives forwarded webview logs (per D-22)
			logMessage: ({ level, category, message, data }) => {
				const logger = getLogger(category);
				logger[level](message, data ? { ...data } : undefined);
			},

			// loadFile handler with Zod validation + error propagation + .bak.json backup
			loadFile: async ({ path: filePath }) => {
				const { RoadmapSchemaSchema } = await import(
					"../../../../packages/core/src/schema"
				);

				let raw: string;
				try {
					raw = await Bun.file(filePath).text();
				} catch (err) {
					bunLogger.error`Failed to read file ${filePath}: ${String(err)}`;
					return {
						data: null,
						errors: [
							{
								path: "",
								message: `Failed to read file: ${String(err)}`,
								code: "file_read_error",
							},
						],
					};
				}

				// Write .bak.json backup (VIEW-12)
				const bakPath = filePath.replace(/\.json$/, ".bak.json");
				try {
					await Bun.write(bakPath, raw);
					bunLogger.info`Backup written to ${bakPath}`;
				} catch (err) {
					bunLogger.error`Failed to write backup: ${String(err)}`;
				}

				// Parse JSON
				let parsed: unknown;
				try {
					parsed = JSON.parse(raw);
				} catch (err) {
					return {
						data: null,
						errors: [
							{
								path: "",
								message: `Invalid JSON: ${String(err)}`,
								code: "json_parse_error",
							},
						],
					};
				}

				// Validate with Zod
				const result = RoadmapSchemaSchema.safeParse(parsed);

				let schemaData: unknown;
				let errors: Array<{ path: string; message: string; code: string }> = [];

				if (!result.success) {
					errors = result.error.issues.map((issue) => ({
						path: issue.path.map(String).join("/"),
						message: issue.message,
						code: String(issue.code),
					}));
					// Return raw parsed data for partial rendering + errors for error panel
					schemaData = parsed;
				} else {
					schemaData = result.data;
				}

				// Resolve $ref nodes
				const fileChangeCallback = (changedPath: string) => {
					if (changedPath.endsWith(".bak.json")) return;
					bunLogger.info`File changed: ${changedPath}`;
					mainWindow.webview.rpc?.send.pushFileChanged({
						path: changedPath,
					});
				};

				// Stop existing watchers before resolveRefs sets up new $ref watchers
				stopAllWatchers();

				const resolvedMain = pathResolve(filePath);

				try {
					if (
						schemaData &&
						typeof schemaData === "object" &&
						"nodes" in schemaData &&
						Array.isArray(schemaData.nodes)
					) {
						const originalNodes = schemaData.nodes as RoadmapNode[];
						// EDIT-16: capture the pre-resolution main-file nodes so
						// splitSchemaByOwnership can restore $ref placeholders on save.
						setSourceTemplate(resolvedMain, originalNodes);
						// Seed the ownership map rooted at the main file before expansion;
						// resolveRefs then overlays per-ref descendants via setOwnership.
						buildOwnershipMap(
							originalNodes.filter((n) => !n.$ref),
							resolvedMain,
						);

						schemaData.nodes = await resolveRefsWithOwnership(
							originalNodes,
							filePath,
							resolvedMain,
							{
								readFile: defaultReadFile,
								onWatch: (path) => watchFile(path, fileChangeCallback),
							},
						);
					}
				} catch (err) {
					bunLogger.error`Failed to resolve $ref nodes: ${String(err)}`;
				}

				// Start file watcher for the main file
				watchFile(filePath, fileChangeCallback);

				// Track recent file
				addRecentFile(filePath);

				// Cache for saveFile / flushPending (path-traversal allowlist)
				setCachedMainPath(resolvedMain);
				if (schemaData && typeof schemaData === "object") {
					setCachedSchema(schemaData as RoadmapSchema);
				}

				// Push ownership map to webview for optimistic cross-boundary detection
				try {
					mainWindow.webview.rpc?.send.pushOwnershipMap({
						entries: [...getOwnership().entries()],
					});
				} catch (err) {
					bunLogger.error`pushOwnershipMap failed: ${String(err)}`;
				}

				// Sidecar hydrate: set sidecar path + replay last-event-per-nodeId overlay
				// I-12 fix: property-access form per Electrobun defineRPC pattern
				const sidecarPath = getEventSidecarPath(filePath);
				eventServerHandle?.setSidecarPath(sidecarPath);
				try {
					const { overlay, events } = await replayEventLog(sidecarPath);
					if (overlay.size > 0) {
						mainWindow.webview.rpc?.send.pushStatusUpdate({
							updates: Array.from(overlay.values()).map((v) => ({
								nodeId: v.nodeId,
								status: v.status,
								meta: v.meta,
								source: v.source,
								lastEventAt: v.lastEventAt,
							})),
						});
					}
					if (events.length > 0) {
						mainWindow.webview.rpc?.send.pushEventLog({ events });
					}
				} catch (err) {
					bunLogger.error`sidecar replay failed for ${filePath}: ${String(err)}`;
				}

				return {
					data: schemaData as RoadmapRPCType["bun"]["requests"]["loadFile"]["response"]["data"],
					errors,
				};
			},

			// saveFile handler — atomic write with path-traversal session allowlist
			// (T-03.04-01; see dialogAllowlist in saveFile.ts) and Zod pre-write
			// validation (T-03.04-07). Shared logic lives in saveFile.ts.
			saveFile: async ({ schema, filePath }) => {
				return saveFileHandler({ schema, filePath });
			},

			// openFilePicker handler (Electrobun native dialog)
			openFilePicker: async () => {
				try {
					const { homedir } = await import("node:os");
					const paths = await Utils.openFileDialog({
						startingFolder: homedir(),
						allowedFileTypes: "json",
						canChooseFiles: true,
						canChooseDirectory: false,
						allowsMultipleSelection: false,
					});
					return paths?.[0] ?? "";
				} catch (err) {
					bunLogger.error`openFileDialog failed: ${String(err)}`;
					return "";
				}
			},

			// resolveRef handler — allowlisted to the currently-loaded main
			// file's directory. A crafted roadmap JSON with a $ref pointing
			// outside baseDir is a data-exfiltration primitive; same guard
			// lives in resolveRefs for the load path.
			resolveRef: async ({ refPath }) => {
				const absPath = pathResolve(refPath);
				if (!isPathWithinMainDir(absPath)) {
					bunLogger.error`resolveRef rejected: ${refPath} escapes main-file directory`;
					return [];
				}
				try {
					const raw = await Bun.file(absPath).text();
					const parsed = JSON.parse(raw);
					const nodes: RoadmapNode[] = Array.isArray(parsed)
						? parsed
						: (parsed.nodes ?? [parsed]);
					return nodes;
				} catch (err) {
					bunLogger.error`Failed to resolve ref ${refPath}: ${String(err)}`;
					return [];
				}
			},

			// setNodeAllowlist handler — routes to the event server's classification allowlist
			setNodeAllowlist: ({ nodeIds, statusIds }) => {
				eventServerHandle?.setAllowlist(nodeIds, statusIds);
				return { ok: true as const };
			},

			// getEventApiState handler — renderer pulls current state on mount.
			// The Bun-side push at startup races bundle load and is dropped silently
			// if the renderer's RPC handlers haven't registered yet (UAT D-07
			// regression: pill / welcome URL line stuck at "off").
			getEventApiState: () => {
				return {
					status: currentStatus,
					port: currentPort,
					connectedCount: currentConnectedCount,
					errorMessage: currentErrorMessage,
				};
			},

			// saveSettings handler
			saveSettings: ({ settings }) => {
				saveSettings(settings);
				return { success: true };
			},
			// loadSettings handler
			loadSettings: () => {
				return { settings: loadSettings() };
			},

			// newFile handler (EDIT-17): produce a fresh in-memory schema with a
			// single root node. No disk write happens here — autosave will fire
			// saveFileAs on the first mutation flush; the user picks a path then.
			//
			// Bun-side cache reset: the cached main path is cleared so a stray
			// saveFile({schema}) (no filePath) call does NOT silently overwrite
			// the previously loaded file. The ownership map is replaced with an
			// empty map (no $refs in a fresh tree).
			newFile: async () => {
				const rootId = crypto.randomUUID();
				const now = new Date().toISOString();
				const schema: RoadmapSchema = {
					version: "1.0",
					title: "Untitled Roadmap",
					statusConfig: [
						{ id: "not-started", label: "Not Started" },
						{ id: "in-progress", label: "In Progress" },
						{ id: "completed", label: "Completed" },
						{ id: "blocked", label: "Blocked" },
					],
					nodes: [
						{
							id: rootId,
							title: "Untitled",
							status: "not-started",
							createdAt: now,
							updatedAt: now,
						},
					],
				};
				// I-10 / D-12: no disk path means no sidecar — stop appending events to any
				// previously-loaded file's .events.jsonl. The event server continues to receive
				// events; they just don't get logged to a sidecar until the user picks a path.
				eventServerHandle?.setSidecarPath(null);
				setCachedSchema(schema);
				clearCachedMainPath();
				// WR-03 (Wave 3 review): use clearOwnershipMap() instead of
				// buildOwnershipMap([], "") so we don't leave a "" → [] ghost
				// entry that other code paths could later read. saveFileAs
				// rebuilds the map with the chosen path on first write.
				clearOwnershipMap();
				bunLogger.info`newFile: created in-memory Untitled Roadmap`;
				return { data: schema, filePath: null };
			},

			// saveFileAs handler (EDIT-17): pop a native dialog and run the
			// initial atomic write. Side effects on success:
			//   - dialogAllowlist gains the chosen path (so subsequent saveFile
			//     calls without an explicit filePath are accepted)
			//   - cachedMainPath / cachedSchema updated for flushPending
			//   - ownership map seeded with the schema's nodes (no $refs yet)
			//
			// The installed Electrobun version (1.16.0) does not expose
			// Utils.saveFileDialog (tracked upstream as blackboardsh/electrobun#233).
			// We probe for it so a future Electrobun release picks up automatically;
			// otherwise fall back to nativeSaveDialog (./saveFileDialog.ts) which
			// shells out to PowerShell / osascript / zenity per platform.
			saveFileAs: async ({ schema }) => {
				const { RoadmapSchemaSchema } = await import(
					"../../../../packages/core/src/schema"
				);

				let chosenPath: string | null = null;
				try {
					const utilsWithSave = Utils as unknown as {
						saveFileDialog?: (opts: {
							title: string;
							filters: Array<{ name: string; extensions: string[] }>;
						}) => Promise<string | null>;
					};
					if (typeof utilsWithSave.saveFileDialog === "function") {
						chosenPath = await utilsWithSave.saveFileDialog({
							title: "Save Roadmap",
							filters: [{ name: "JSON", extensions: ["json"] }],
						});
					} else {
						const { homedir } = await import("node:os");
						chosenPath = await nativeSaveDialog({
							title: "Save Roadmap",
							defaultPath: homedir(),
							defaultName: "roadmap.json",
							filters: [{ name: "JSON", extensions: ["json"] }],
						});
					}
				} catch (err) {
					bunLogger.error`saveFileAs dialog failed: ${String(err)}`;
					return { filePath: null };
				}
				if (!chosenPath) return { filePath: null }; // user cancelled

				const resolved = pathResolve(chosenPath);

				// Pre-write Zod validation (T-03.04-07 — same trust-boundary
				// guard saveFile uses).
				const parsed = RoadmapSchemaSchema.safeParse(schema);
				if (!parsed.success) {
					const issue = parsed.error.issues[0];
					bunLogger.warn`saveFileAs: schema validation failed: ${issue.path.map(String).join(".")}: ${issue.message}`;
					return { filePath: null };
				}

				try {
					await atomicWrite(resolved, JSON.stringify(schema, null, 2));
					markSelfWrite(resolved);
					pushDialogAllowlistPath(resolved);
					setCachedSchema(schema);
					setCachedMainPath(resolved);
					// Fresh schema → all nodes owned by the new main file.
					buildOwnershipMap(schema.nodes, resolved);
					setSourceTemplate(resolved, schema.nodes);
					addRecentFile(resolved);
					// I-10 / D-12: the new disk path is now the sidecar target.
					eventServerHandle?.setSidecarPath(getEventSidecarPath(resolved));
					bunLogger.info`saveFileAs wrote ${resolved}`;
					return { filePath: resolved };
				} catch (err) {
					bunLogger.error`saveFileAs write failed: ${String(err)}`;
					return { filePath: null };
				}
			},
		},
		messages: {},
	},
});

// Create the main application window
const url = await getMainViewUrl();

export const mainWindow = new BrowserWindow({
	title: "RoadRaven",
	url,
	rpc,
	frame: {
		width: 900,
		height: 700,
		x: 200,
		y: 200,
	},
});

Utils.showNotification({
	title: "RoadRaven",
	body: "RoadRaven is running.",
});

// I-09 fix: push initial event server state to the renderer immediately after
// the window is created so EventApiPill reflects the correct colour on first render.
// connectedCount is 0 at startup — no producer can have connected yet.
mainWindow.webview.rpc?.send.pushEventApiState({
	status: currentStatus,
	port: currentPort,
	connectedCount: 0,
	errorMessage: currentErrorMessage,
});

bunLogger.info("RoadRaven main process initialized");
