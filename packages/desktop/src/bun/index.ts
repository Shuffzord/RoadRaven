import { getLogger } from "@logtape/logtape";
import { BrowserView, BrowserWindow, Updater, Utils } from "electrobun/bun";
import type { RoadmapRPCType } from "../../../../shared/types.ts";
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

// Define RPC handlers before creating the window (Electrobun pattern)
const rpc = BrowserView.defineRPC<RoadmapRPCType>({
	handlers: {
		requests: {
			// logMessage handler -- receives forwarded webview logs (per D-22)
			logMessage: ({ level, category, message, data }) => {
				const logger = getLogger(category);
				logger[level](message, data ? { ...data } : undefined);
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
