import { defineConfig } from "tsup";

export default defineConfig({
	entry: ["src/index.ts"],
	format: ["esm"], // ESM only — Node ESM consumers are the target
	dts: true, // Emit .d.ts
	clean: true, // Wipe dist/ before each build
	sourcemap: true,
	target: "node20", // Match the project's Node baseline (Bun is fine with ES2022+)
	external: ["zod"], // Zod is a peer-style runtime dep — keep external
	outDir: "dist",
	splitting: false, // Single-entry; no code splitting needed
	treeshake: true,
});
