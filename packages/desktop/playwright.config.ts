import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
	testDir: "./tests",
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	// Single worker everywhere, not just in CI. The `ui` project contains two
	// WALL-CLOCK budget specs — context-menu-50ms.spec.ts (75ms dev ceiling on
	// a 300-node tree) and canvas-drag-perf.spec.ts — and parallel workers make
	// them measure CPU contention between browsers instead of render cost.
	// Measured on this suite: the context-menu large-tree median swings
	// 57.5-84.2ms across runs with default workers (failing the ceiling in 2 of
	// 3 runs) versus 60.0/60.2/60.5ms with one worker, all green. canvas-focus
	// already had to force itself serial for the same reason. Costs ~5s wall.
	workers: 1,
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
