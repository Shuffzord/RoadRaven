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
		environmentMatchGlobs: [["tests/unit/ui/**/*.test.{ts,tsx}", "jsdom"]],
	},
});
