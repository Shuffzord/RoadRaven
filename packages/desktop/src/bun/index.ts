import { BrowserWindow, Updater, Utils } from "electrobun/bun";
import { getLogger } from "@logtape/logtape";
import { setupBunLogging, bunLogger } from "./logging";
import { loadSettings, saveSettings } from "./settings";

// Re-export the RPC type so downstream modules can import from the app entry
export type { RoadmapRPCType } from "../../../../shared/types.ts";

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

// Create the main application window
const url = await getMainViewUrl();

export const mainWindow = new BrowserWindow({
	title: "RoadRaven",
	url,
	frame: {
		width: 900,
		height: 700,
		x: 200,
		y: 200,
	},
});

// Register RPC handlers for webview communication
// logMessage handler -- receives forwarded webview logs (per D-22)
mainWindow.rpc.handle("logMessage", ({ level, category, message, data }) => {
	const logger = getLogger(category);
	logger[level](message, data ? { ...data } : undefined);
});

// saveSettings handler
mainWindow.rpc.handle("saveSettings", ({ settings }) => {
	saveSettings(settings);
	return { success: true };
});

// loadSettings handler
mainWindow.rpc.handle("loadSettings", () => {
	return { settings: loadSettings() };
});

Utils.showNotification({
	title: "RoadRaven",
	body: "RoadRaven is running.",
});

bunLogger.info("RoadRaven main process initialized");
