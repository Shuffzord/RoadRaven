import { dirname, resolve as pathResolve, sep } from "node:path";
import { getLogger } from "@logtape/logtape";
import { BrowserView, BrowserWindow, Updater, Utils } from "electrobun/bun";
import type {
	RoadmapNode,
	RoadmapRPCType,
	RoadmapSchema,
} from "../../../../shared/types.ts";
// atomicWrite + splitSchemaByOwnership are consumed via saveFile.ts which owns
// the saveFile/flushPending logic. Re-exported below so external callers (and
// the Plan 04a acceptance grep) can see the persistence surface at a glance.
import { atomicWrite } from "./atomicWrite";
import { stopAllWatchers, watchFile } from "./fileWatcher";
import { bunLogger, setupBunLogging } from "./logging";
import {
	buildOwnershipMap,
	getOwnership,
	setOwnership,
	setSourceTemplate,
	splitSchemaByOwnership,
} from "./refMap";
import {
	flushPending,
	isPathWithinMainDir,
	pushDialogAllowlistPath,
	saveFileHandler,
	setCachedMainPath,
	setCachedSchema,
} from "./saveFile";

// Persistence surface re-exports — imported by Plan 04b/04c and DevHarness
export { atomicWrite, splitSchemaByOwnership };

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

/**
 * Resolve $ref nodes in a roadmap schema tree.
 * Each $ref node is replaced with the contents of the referenced file.
 * Referenced files get their own file watchers.
 *
 * Plan 03-04a: also populates the ownership map via setOwnership so saveFile
 * can split the schema back into per-file payloads without re-walking the tree.
 * Every non-$ref node is tagged with `currentOwner`; entering a $ref'd subtree
 * switches `currentOwner` to the referenced file's absolute path.
 */
async function resolveRefs(
	nodes: RoadmapNode[],
	basePath: string,
	currentOwner: string,
	watchCallback: (path: string) => void,
	visited: Set<string> = new Set(),
): Promise<RoadmapNode[]> {
	const baseDir = dirname(basePath);
	const resolved: RoadmapNode[] = [];
	for (const node of nodes) {
		if (node.$ref) {
			const refAbsPath = pathResolve(baseDir, node.$ref);
			// Guard: reject $ref paths that escape the base directory
			if (!refAbsPath.startsWith(baseDir + sep)) {
				bunLogger.error`$ref escapes base directory: ${node.$ref}`;
				resolved.push(node);
				continue;
			}
			// Guard: detect circular $ref chains
			if (visited.has(refAbsPath)) {
				bunLogger.warn`Circular $ref detected, skipping: ${node.$ref}`;
				resolved.push(node);
				continue;
			}
			visited.add(refAbsPath);
			try {
				const raw = await Bun.file(refAbsPath).text();
				const parsed = JSON.parse(raw);
				const refNodes: RoadmapNode[] = Array.isArray(parsed)
					? parsed
					: (parsed.nodes ?? [parsed]);
				watchFile(refAbsPath, watchCallback);
				// Recurse into the ref'd subtree with refAbsPath as the new owner.
				// This tags every descendant with the correct file for write-back.
				const tagged = await resolveRefs(
					refNodes,
					refAbsPath,
					refAbsPath,
					watchCallback,
					visited,
				);
				resolved.push(...tagged);
			} catch (err) {
				bunLogger.error`Failed to resolve $ref ${node.$ref}: ${String(err)}`;
				resolved.push(node);
			}
		} else {
			setOwnership(node.id, currentOwner);
			const nodeWithResolvedChildren = { ...node };
			if (node.children) {
				nodeWithResolvedChildren.children = await resolveRefs(
					node.children,
					basePath,
					currentOwner,
					watchCallback,
					visited,
				);
			}
			resolved.push(nodeWithResolvedChildren);
		}
	}
	return resolved;
}

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

						schemaData.nodes = await resolveRefs(
							originalNodes,
							filePath,
							resolvedMain,
							fileChangeCallback,
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

			// saveSettings handler
			saveSettings: ({ settings }) => {
				saveSettings(settings);
				return { success: true };
			},
			// loadSettings handler
			loadSettings: () => {
				return { settings: loadSettings() };
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

bunLogger.info("RoadRaven main process initialized");
