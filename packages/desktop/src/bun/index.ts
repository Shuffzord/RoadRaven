import { getLogger } from "@logtape/logtape";
import type { RoadmapRPCType } from "../../../../shared/types.ts";
// atomicWrite + splitSchemaByOwnership are consumed via saveFile.ts which owns
// the saveFile/flushPending logic. Re-exported below so external callers (and
// the Plan 04a acceptance grep) can see the persistence surface at a glance.
import { agentRequestHandler } from "./agentRequestHandler";
import { atomicWrite } from "./atomicWrite";
import { bunLogger, setupBunLogging } from "./logging";
import { splitSchemaByOwnership } from "./refMap";
import { flushPending, pushDialogAllowlistPath } from "./saveFile";

// Persistence surface re-exports — imported by Plan 04b/04c
export { atomicWrite, splitSchemaByOwnership };

import {
	DEFAULT_PORT,
	type EventServerHandle,
	startEventServer,
} from "./eventServer";
import { serverLogger } from "./logging";
import { onBeforeQuit } from "./platform/lifecycle";
import { showNotification } from "./platform/notifications";
import { getReleaseChannel } from "./platform/updater";
import { createMainWindow, defineMainRpc } from "./platform/window";
import { createDialogRpcHandlers } from "./rpc/dialogRpc";
import { createEventApiRpcHandlers } from "./rpc/eventApiRpc";
import {
	type AppRpc,
	createFileRpcHandlers,
	type MainWindow,
} from "./rpc/fileRpc";
import { createSetupRpcHandlers } from "./rpc/setupRpc";
import { deleteSentinel, writeSentinel } from "./sentinel";
import { loadSettings, saveSettings } from "./settings";

// App version shown in the Setup Wizard. scripts/bump-version.ts rewrites this
// literal (alongside the package.json + electrobun.config.ts versions) so it
// stays in lockstep — do not edit by hand.
const APP_VERSION = "0.8.0";

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
const envPortRaw = process.env.ROADRAVEN_EVENT_PORT;
const envPortParsed = envPortRaw ? Number(envPortRaw) : null;
if (envPortRaw && (envPortParsed === null || Number.isNaN(envPortParsed))) {
	bunLogger.warn`ROADRAVEN_EVENT_PORT="${envPortRaw}" is not a number; ignoring`;
}
const envPort =
	envPortParsed !== null && !Number.isNaN(envPortParsed) ? envPortParsed : null;
const settingsPort = initialSettings.eventApi?.port ?? null;
const requestedPort = envPort ?? settingsPort ?? DEFAULT_PORT;
const isUserSpecified = envPort !== null || settingsPort !== null;

// eventServerHandle is declared here (before startEventServer and shutdown hooks)
// so TypeScript can see the declaration before all uses.
let eventServerHandle: EventServerHandle | null = null;

// mainWindow is declared here (before startEventServer, the RPC table, and the
// shutdown hooks) so every callback/handler below can close over it by
// reference. It is not created until further down this file — that's fine
// because none of these closures run until after the window exists (the
// event server binds and the RPC handlers register before the window is
// shown, but events/RPC calls require a producer/renderer that arrives
// later).
let mainWindow: MainWindow;

// Note: mainWindow is not yet created here. The callbacks below close over the
// binding and are assigned it later in this file.
//
// They must therefore guard it. The event server binds BEFORE the window
// exists, and a producer can connect in that gap — an MCP server already
// running from a previous session reconnects on a loop and will hit the port
// the instant it opens. This previously crashed the main process with
// "undefined is not an object (evaluating 'mainWindow.webview')". These pushes
// are fire-and-forget renderer notifications, so dropping them before the
// window exists is correct: there is nothing to render into yet.
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
	// v0.8: the server compares this against the version in each producer's
	// hello frame so an MCP server installed independently of the app (npm /
	// Claude Code plugin) cannot drift silently.
	appVersion: APP_VERSION,
	onFlush: (updates) => {
		mainWindow?.webview.rpc?.send.pushStatusUpdate({ updates });
	},
	onEvent: (event) => {
		mainWindow?.webview.rpc?.send.pushEventLog({ events: [event] });
	},
	onError: (err) => {
		mainWindow?.webview.rpc?.send.pushEventApiError({
			type: err.type,
			source: err.source,
			detail: err.detail,
		});
	},
	onConnectionChange: (count) => {
		currentConnectedCount = count;
		mainWindow?.webview.rpc?.send.pushEventApiState({
			status: currentStatus,
			port: currentPort,
			connectedCount: count,
			errorMessage: currentErrorMessage,
		});
	},
	// Phase 6 Plan 06-03 — agentRequestHandler runs the gate sequence
	// (kill-switch → path-allowlist → cross-ref boundary) BEFORE forwarding to
	// the renderer's agentRpcHandler (Plan 06-04). The mainWindow binding is
	// captured by closure; same pattern as onFlush/onEvent/onError above.
	onAgentRequest: (ws, request) => {
		// Unlike the pushes above, an agent request expects a reply, so it cannot
		// be silently dropped — but it cannot be served before the renderer
		// exists either. Ignoring it here lets the caller's request time out and
		// retry, which is what it already does when the app is not running.
		if (!mainWindow) return;
		void agentRequestHandler(ws, request, mainWindow);
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
	const channel = await getReleaseChannel();

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
onBeforeQuit(async () => {
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
const rpc = defineMainRpc<RoadmapRPCType>({
	maxRequestTime: 120_000, // 2 min — native file dialogs block until user picks a file
	handlers: {
		requests: {
			// logMessage handler -- receives forwarded webview logs (per D-22)
			logMessage: ({ level, category, message, data }) => {
				const logger = getLogger(category);
				logger[level](message, data ? { ...data } : undefined);
			},

			...createFileRpcHandlers({
				getMainWindow: () => mainWindow,
				getEventServerHandle: () => eventServerHandle,
			}),

			...createDialogRpcHandlers(),

			...createEventApiRpcHandlers({
				getEventServerHandle: () => eventServerHandle,
				getState: () => ({
					status: currentStatus,
					port: currentPort,
					connectedCount: currentConnectedCount,
					errorMessage: currentErrorMessage,
				}),
			}),

			// saveSettings handler
			saveSettings: ({ settings }) => {
				saveSettings(settings);
				return { success: true };
			},
			// loadSettings handler
			loadSettings: () => {
				return { settings: loadSettings() };
			},

			...createSetupRpcHandlers(APP_VERSION),
		},
		messages: {},
	},
});

// Create the main application window
const url = await getMainViewUrl();

mainWindow = createMainWindow<AppRpc>({
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

export { mainWindow };

showNotification({
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
