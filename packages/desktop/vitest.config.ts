import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import { electrobunViteAliases } from "./.hutch/devkit/api/config/electrobun-vite";

// Vitest reads this file, not vite.config.ts, so the devkit aliases must be
// declared here too. Without them any test that transitively imports
// electrobun/bun or electrobun/view loads the published package's stub, which
// throws "Electrobun 2.x APIs come from the Hutch devkit, not node_modules".
const devkitRoot = fileURLToPath(new URL("./.hutch/devkit", import.meta.url));

export default defineConfig({
	plugins: [react()],
	resolve: { alias: electrobunViteAliases(devkitRoot) },
	test: {
		globals: true,
		environment: "node",
		include: [
			"tests/unit/**/*.test.ts",
			"tests/unit/**/*.test.tsx",
			"tests/integration/**/*.test.ts",
			"tests/architecture/**/*.test.ts",
		],
		// Exclude files that use Bun-native APIs (Bun.serve, Bun.WebSocket).
		// These run via `bun test` in the test:bun script — see package.json.
		exclude: [
			"**/node_modules/**",
			"**/.git/**",
			"tests/unit/bun/eventServer.test.ts",
			"tests/unit/bun/eventServer.eaddrinuse.test.ts",
			"tests/integration/eventApi.test.ts",
			"tests/integration/eventApi-e2e.test.ts",
		],
		environmentMatchGlobs: [["tests/unit/ui/**/*.test.{ts,tsx}", "jsdom"]],
		benchmark: {
			include: ["tests/bench/**/*.bench.ts"],
			environment: "node",
		},
	},
});
