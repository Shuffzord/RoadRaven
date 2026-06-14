import { defineConfig, devices } from "@playwright/test";

// Accessibility audit harness (PACK-06, R-04).
// Drives @axe-core/playwright against `vite preview` on port 4173 — i.e.
// the production-built renderer bundle that ships in the installer's
// webview. Distinct from the main playwright.config.ts which uses port
// 5173 + Vite dev for UI feature tests.
//
// PRE-CONDITION: `bun run --cwd packages/desktop build` must produce
// packages/desktop/dist/ before this harness runs. CI release workflow
// builds first; locally run `bun run --cwd packages/desktop build` once.
export default defineConfig({
	testDir: "./",
	testMatch: "**/audit.spec.ts",
	fullyParallel: false, // single webServer; serialize for predictable axe output
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 1 : 0,
	workers: 1,
	reporter: "list",

	use: {
		...devices["Desktop Chrome"],
		baseURL: "http://localhost:4173",
	},

	webServer: {
		command: "bunx vite preview --port 4173 --strictPort",
		url: "http://localhost:4173",
		reuseExistingServer: !process.env.CI,
		timeout: 30000,
		cwd: "../..", // run from packages/desktop root
	},
});
