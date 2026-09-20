import type { ElectrobunConfig } from "electrobun";

// Default: CEF (Chromium) on all platforms — consistent rendering, avoids WebKitGTK bugs.
// Override locally: set ROADRAVEN_RENDERER=webkit in .env.local to use native WebKit.
const bundleCEF = process.env.ROADRAVEN_RENDERER !== "webkit";

export default {
	app: {
		name: "RoadRaven",
		identifier: "RoadRaven.electrobun.dev",
		version: "0.8.0",
	},
	build: {
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
		win: { bundleCEF, icon: "assets/icon.ico" },
	},
	release: {
		// Strategy A from RESEARCH.md Pattern 5 — GitHub Releases /latest/download
		// always resolves to the most recent non-prerelease Release (D-10: stable only).
		// v1.1 canary work will switch to a gh-pages-hosted manifest folder.
		baseUrl: "https://github.com/Shuffzord/RoadRaven/releases/latest/download",
	},
} satisfies ElectrobunConfig;
