import { resolve } from "node:path";
import { defineConfig } from "@playwright/test";

export default defineConfig({
	testDir: __dirname,
	testMatch: "cfa.spec.ts",
	workers: 1,
	retries: 0,
	timeout: 60_000,
	reporter: "list",
	outputDir: resolve(__dirname, "../../test-results/screenshots"),
	use: {
		browserName: "chromium",
		baseURL: "http://127.0.0.1:5175",
		viewport: { width: 1600, height: 1200 },
		deviceScaleFactor: 1,
		colorScheme: "dark",
		locale: "en-US",
		timezoneId: "UTC",
	},
	webServer: {
		command: "bunx vite --host 127.0.0.1 --port 5175 --strictPort",
		cwd: resolve(__dirname, "../.."),
		url: "http://127.0.0.1:5175",
		reuseExistingServer: false,
		timeout: 30_000,
	},
});
