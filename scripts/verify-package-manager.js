#!/usr/bin/env node
// Runs as the root `preinstall` script. Blocks `npm install` / `pnpm install`
// / `yarn install` before they can resolve dependencies with a package
// manager other than bun.
//
// Why this exists: a stray `pnpm install` once rewrote node_modules into
// pnpm's layout and resolved @biomejs/biome to 2.5.14 instead of the pinned
// 2.5.0, and the newer biome flagged a rule the pinned version didn't,
// failing the pre-commit hook for an unrelated reason. This is a
// version-drift problem, not a style preference — see PROJECT.MD.
//
// Detection: every major package manager sets npm_config_user_agent for
// lifecycle scripts, prefixed with its own name (confirmed empirically on
// bun 1.3.4, npm 11.6.2, pnpm 10.34.5, and yarn 1.22.22 on Windows):
//   bun/1.3.4 npm/? node/v24.3.0 win32 x64
//   npm/11.6.2 node/v24.12.0 win32 x64 workspaces/false
//   pnpm/10.34.5 npm/? node/v24.12.0 win32 x64
//   yarn/1.22.22 npm/? node/v24.12.0 win32 x64
// All four also run `preinstall`, so this fires regardless of which one was
// used. If the variable is missing entirely (e.g. the script is run
// directly, outside any install lifecycle), we have nothing reliable to
// check against, so we allow it rather than block on a guess.
"use strict";

const userAgent = process.env.npm_config_user_agent || "";

if (userAgent && !userAgent.startsWith("bun/")) {
	const manager = userAgent.split("/")[0] || "an unsupported package manager";
	console.error(
		`\nRoadRaven is installed with bun, not ${manager}.\n\n` +
			"Using a different package manager resolves different dependency\n" +
			"versions than the ones bun.lock pins (this has already broken the\n" +
			"pre-commit lint gate once by silently upgrading @biomejs/biome), and\n" +
			"writes a lockfile this repo doesn't track.\n\n" +
			"Run this instead:\n" +
			"  bun install\n",
	);
	process.exit(1);
}
