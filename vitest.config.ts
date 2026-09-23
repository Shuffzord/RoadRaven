import { defineConfig } from "vitest/config";

// Root-level test entry point. `bunx vitest run` invoked from the repo root
// (as .husky/pre-commit and packages/desktop's `test:release` script do) has
// no config to scope discovery on its own, so without this file Vitest's
// default recursive glob also picks up
// packages/desktop/.hutch/devkit/**/*.test.* — Electrobun 2.x's gitignored,
// postinstall-projected devkit, which ships its own macOS/Zig-only test
// files that ENOENT on platforms where those sources aren't materialised.
//
// Listing each real suite as its own project (referencing its existing
// vitest.config.ts, so include/exclude globs stay defined in one place)
// constrains root discovery to our own tests instead of excluding the
// devkit by pattern.
export default defineConfig({
	test: {
		projects: [
			"packages/desktop/vitest.config.ts",
			"plugins/claude-code/vitest.config.ts",
			"tests/release/vitest.config.ts",
		],
	},
});
