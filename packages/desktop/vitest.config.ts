import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
	plugins: [react()],
	test: {
		globals: true,
		environment: "node",
		include: [
			"tests/unit/**/*.test.ts",
			"tests/unit/**/*.test.tsx",
			"tests/integration/**/*.test.ts",
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
