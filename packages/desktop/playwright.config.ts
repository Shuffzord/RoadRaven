import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
	testDir: "./tests",
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	workers: process.env.CI ? 1 : undefined,
	reporter: "html",

	projects: [
		{
			name: "ui",
			testDir: "./tests/ui",
			use: {
				...devices["Desktop Chrome"],
				baseURL: "http://localhost:5173",
			},
		},
		{
			name: "process",
			testDir: "./tests/process",
			use: {
				...devices["Desktop Chrome"],
			},
		},
	],

	webServer: {
		command: "bunx vite --port 5173",
		url: "http://localhost:5173",
		reuseExistingServer: !process.env.CI,
		timeout: 30000,
	},
});
