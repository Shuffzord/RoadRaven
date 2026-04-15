import { dirname, resolve as pathResolve } from "node:path";
import { getLogger } from "@logtape/logtape";
import { BrowserView, BrowserWindow, Updater, Utils } from "electrobun/bun";
import type { RoadmapNode, RoadmapRPCType } from "../../../../shared/types.ts";
import { stopAllWatchers, watchFile } from "./fileWatcher";
import { bunLogger, setupBunLogging } from "./logging";
import { loadSettings, saveSettings } from "./settings";

// Re-export the RPC type so downstream modules can import from the app entry
export type { RoadmapRPCType };

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
 */
async function resolveRefs(
	nodes: RoadmapNode[],
	basePath: string,
	watchCallback: (path: string) => void,
): Promise<RoadmapNode[]> {
	const resolved: RoadmapNode[] = [];
	for (const node of nodes) {
		if (node.$ref) {
			const refAbsPath = pathResolve(dirname(basePath), node.$ref);
			try {
				const raw = await Bun.file(refAbsPath).text();
				const parsed = JSON.parse(raw);
				const refNodes: RoadmapNode[] = Array.isArray(parsed)
					? parsed
					: (parsed.nodes ?? [parsed]);
				watchFile(refAbsPath, watchCallback);
				resolved.push(...refNodes);
			} catch (err) {
				bunLogger.error`Failed to resolve $ref ${node.$ref}: ${String(err)}`;
				resolved.push(node);
			}
		} else {
			const nodeWithResolvedChildren = { ...node };
			if (node.children) {
				nodeWithResolvedChildren.children = await resolveRefs(
					node.children,
					basePath,
					watchCallback,
				);
			}
			resolved.push(nodeWithResolvedChildren);
		}
	}
	return resolved;
}

// Define RPC handlers before creating the window (Electrobun pattern)
const rpc = BrowserView.defineRPC<RoadmapRPCType>({
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

				let schemaData: RoadmapNode["children"] extends infer _
					? typeof parsed
					: never;
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
					bunLogger.info`File changed: ${changedPath}`;
					mainWindow.webview.rpc?.send.pushFileChanged({
						path: changedPath,
					});
				};

				try {
					if (
						schemaData &&
						typeof schemaData === "object" &&
						"nodes" in schemaData &&
						Array.isArray(schemaData.nodes)
					) {
						schemaData.nodes = await resolveRefs(
							schemaData.nodes as RoadmapNode[],
							filePath,
							fileChangeCallback,
						);
					}
				} catch (err) {
					bunLogger.error`Failed to resolve $ref nodes: ${String(err)}`;
				}

				// Start file watcher for the main file
				stopAllWatchers();
				watchFile(filePath, fileChangeCallback);

				return {
					data: schemaData as RoadmapRPCType["bun"]["requests"]["loadFile"]["response"]["data"],
					errors,
				};
			},

			// openFilePicker handler (Electrobun native dialog)
			openFilePicker: async () => {
				try {
					const paths = await Utils.openFileDialog({
						startingFolder: undefined,
						allowedFileTypes: "json",
						canChooseFiles: true,
						canChooseDirectory: false,
						allowsMultipleSelection: false,
					});
					// Return first selected path, or empty string if user cancelled.
					// Avoid returning null — Electrobun's RPC serializer can fail on null string responses.
					return paths?.[0] ?? "";
				} catch (err) {
					bunLogger.error`openFileDialog failed: ${String(err)}`;
					return "";
				}
			},

			// resolveRef handler
			resolveRef: async ({ refPath }) => {
				try {
					const raw = await Bun.file(refPath).text();
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
