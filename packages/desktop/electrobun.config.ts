import type { ElectrobunConfig } from "electrobun";

const bundleCEF = process.env.CI === "true";

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
