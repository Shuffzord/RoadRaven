import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
	plugins: [react()],
	test: {
		globals: true,
		environment: "node",
		include: ["tests/unit/**/*.test.ts", "tests/unit/**/*.test.tsx"],
		environmentMatchGlobs: [["tests/unit/ui/**", "jsdom"]],
	},
});
