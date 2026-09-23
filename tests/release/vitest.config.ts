import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// The release tests' only config: listed as a project by the root
// vitest.config.ts, and passed directly with `--config` by CI jobs that install
// with `bun install --ignore-scripts` (ci.yml's Windows install.ps1 job) — the
// root config also loads packages/desktop/vitest.config.ts, which imports the
// Electrobun devkit that only the skipped postinstall projects.
//
// `root` is the repo root either way: as a project it would otherwise default
// to this file's directory.
export default defineConfig({
	test: {
		name: "release",
		root: fileURLToPath(new URL("../..", import.meta.url)),
		environment: "node",
		include: ["tests/release/**/*.test.ts"],
	},
});
