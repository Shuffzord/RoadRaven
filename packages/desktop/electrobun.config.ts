import type { ElectrobunConfig } from "electrobun";
import pkg from "./package.json" with { type: "json" };

// Linux/macOS default: bundled CEF (Chromium) — WebKitGTK renders the app incorrectly.
// Windows default: the system WebView2 (itself Chromium), so no CEF bundle and a
// much smaller installer.
// Override in .env.local: ROADRAVEN_RENDERER=cef bundles CEF, =webkit uses the
// system webview (WebKitGTK / WKWebView / WebView2).
const renderer = process.env.ROADRAVEN_RENDERER;
const bundleCEF = renderer !== "webkit";
const bundleCEFWin = renderer === "cef";

// Local update UAT builds: ROADRAVEN_UPDATE_BASE_URL points the packaged app's
// updater at a local static server (e.g. http://127.0.0.1:8765) and skips the
// delta-patch fetch against the real previous release. Unset for real releases.
const updateBaseUrl = process.env.ROADRAVEN_UPDATE_BASE_URL;

export default {
	app: {
		name: "RoadRaven",
		identifier: "io.github.shuffzord.roadraven",
		// Single source of the desktop app version (also read by src/bun/appVersion.ts
		// and the `__APP_VERSION__` Vite define). Bump it in package.json.
		version: pkg.version,
	},
	build: {
		// Cottontail is Electrobun 2.x's default main-process runtime and ships a
		// Bun compatibility layer (runtime_modules/bun: file-io, http-server-runtime).
		// It covers what this main process needs — Bun.serve in eventServer.ts,
		// Bun.file, Bun.write, import.meta.dir — so we stay on the framework
		// default rather than pinning "bun" and carrying the divergence.
		// Verified by launching the app and exercising the Event API, including
		// the EADDRINUSE port-fallback path that depends on Bun.serve throwing
		// synchronously (I-04 in eventServer.ts).
		mainProcess: "cottontail",
		copy: {
			"dist/index.html": "views/mainview/index.html",
			"dist/assets": "views/mainview/assets",
			// MCP server bundle (v0.6) — built by `bun run build:mcp` into
			// assets/mcp/index.js, shipped so the Setup Wizard can install the
			// Claude Code integration. Resolved at runtime by mcpInstaller.ts.
			"assets/mcp/index.js": "mcp/index.js",
		},
		watchIgnore: ["dist/**"],
		mac: { bundleCEF },
		linux: { bundleCEF, icon: "assets/icon.png" },
		win: { bundleCEF: bundleCEFWin, icon: "assets/icon.ico" },
	},
	release: updateBaseUrl
		? { baseUrl: updateBaseUrl, generatePatch: false }
		: {
				// Strategy A from RESEARCH.md Pattern 5 — GitHub Releases /latest/download
				// always resolves to the most recent non-prerelease Release (D-10: stable only).
				// v1.1 canary work will switch to a gh-pages-hosted manifest folder.
				baseUrl:
					"https://github.com/Shuffzord/RoadRaven/releases/latest/download",
			},
} satisfies ElectrobunConfig;
