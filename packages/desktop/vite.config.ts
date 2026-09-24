import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { electrobunViteAliases } from "./.hutch/devkit/api/config/electrobun-vite";
import pkg from "./package.json" with { type: "json" };

// Electrobun 2.x serves its APIs from the Hutch-projected devkit, not from
// node_modules — the published package is a thin bootstrap whose exports throw
// at runtime. Without these aliases Vite bundles the throwing stubs and the
// build stays green while the app is dead on launch.
const devkitRoot = fileURLToPath(new URL("./.hutch/devkit", import.meta.url));

export default defineConfig({
	plugins: [tailwindcss(), react()],
	resolve: { alias: electrobunViteAliases(devkitRoot) },
	// App version for the renderer (src/mainview/lib/appVersion.ts); the single
	// source is package.json. Mirrored in vitest.config.ts.
	define: { __APP_VERSION__: JSON.stringify(pkg.version) },
	root: "src/mainview",
	build: {
		outDir: "../../dist",
		emptyOutDir: true,
		target: "esnext",
	},
	server: {
		port: 5173,
		strictPort: true,
	},
});
