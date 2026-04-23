import type { ElectrobunConfig } from "electrobun";

// Default: CEF (Chromium) on all platforms — consistent rendering, avoids WebKitGTK bugs.
// Override locally: set ROADRAVEN_RENDERER=webkit in .env.local to use native WebKit.
const bundleCEF = process.env.ROADRAVEN_RENDERER !== "webkit";

export default {
	app: {
		name: "RoadRaven",
		identifier: "RoadRaven.electrobun.dev",
		version: "0.0.1",
	},
	build: {
		copy: {
			"dist/index.html": "views/mainview/index.html",
			"dist/assets": "views/mainview/assets",
		},
		watchIgnore: ["dist/**"],
		mac: { bundleCEF },
		linux: { bundleCEF },
		win: { bundleCEF },
	},
} satisfies ElectrobunConfig;
