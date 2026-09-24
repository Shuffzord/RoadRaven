// scripts/bump-version.ts
// Usage: bun scripts/bump-version.ts 1.0.0
//
// Lockstep version bump (D-04): writes the same `version` field to every
// publishable workspace package.json + the Claude Code plugin/marketplace
// files that pin the version as a literal. Run from the repo root.
//
// The desktop app itself has a single source: packages/desktop/package.json.
// electrobun.config.ts, src/bun/appVersion.ts and the renderer's
// `__APP_VERSION__` define (vite.config.ts) all read it at build/run time,
// so they hold no literal and are not targets here.
//
// Validate-then-write pattern (B-04 fix): all targets are parsed and their
// replacements verified BEFORE any file is written. If any target fails to
// parse or its replacement regex doesn't match, the script aborts with an
// actionable error and the workspace stays in its prior consistent state.
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const newVersion = process.argv[2];
if (!newVersion?.match(/^\d+\.\d+\.\d+(-[a-z0-9.]+)?$/)) {
	console.error(`Invalid version: ${newVersion}. Expected semver e.g. 1.0.0`);
	process.exit(1);
}

// Publishable packages only. @roadraven/react is deferred to v1.1 (D-21) and
// is intentionally absent from this list — re-add when packages/react/ is
// flipped from private to public-publishable.
const pkgTargets = [
	"packages/desktop/package.json",
	"packages/core/package.json",
	"plugins/claude-code/package.json",
];

// Files that embed the version as a string literal rather than a top-level
// package.json `version` field (some are JSON, matched by regex rather than
// parsed, since only one field needs updating). Each is validated (regex
// must match) before any file is written, so a renamed literal aborts the
// whole bump instead of leaving a partial state.
const textTargets = [
	{
		// Claude Code plugin manifest (W5 — plugin marketplace install path).
		path: "plugins/claude-code/.claude-plugin/plugin.json",
		regex: /"version":\s*"[^"]+"/,
		replacement: `"version": "${newVersion}"`,
		label: '"version": "..."',
	},
	{
		// Marketplace plugin entry's version (root .claude-plugin/marketplace.json).
		path: ".claude-plugin/marketplace.json",
		regex: /"version":\s*"[^"]+"/,
		replacement: `"version": "${newVersion}"`,
		label: '"version": "..." (marketplace plugin entry)',
	},
	{
		// Pinned MCP server version the plugin's npx invocation installs.
		path: "plugins/claude-code/.mcp.json",
		regex: /@roadraven\/mcp@[^"]+/,
		replacement: `@roadraven/mcp@${newVersion}`,
		label: '"@roadraven/mcp@..."',
	},
];

type ParsedPkg = { path: string; pkg: { version?: string } };

const parsedPkgs: ParsedPkg[] = pkgTargets.map((path) => {
	if (!existsSync(path)) {
		console.error(`Missing target: ${path}`);
		process.exit(1);
	}
	try {
		return { path, pkg: JSON.parse(readFileSync(path, "utf8")) };
	} catch (e) {
		console.error(`Failed to parse ${path}: ${(e as Error).message}`);
		process.exit(1);
	}
});

const preparedText = textTargets.map(({ path, regex, replacement, label }) => {
	if (!existsSync(path)) {
		console.error(`Missing target: ${path}`);
		process.exit(1);
	}
	const content = readFileSync(path, "utf8");
	if (!regex.test(content)) {
		console.error(
			`Failed to find '${label}' in ${path}. Refusing to write — partial bump would break lockstep invariant (D-04).`,
		);
		process.exit(1);
	}
	return { path, updated: content.replace(regex, replacement) };
});

for (const { path, pkg } of parsedPkgs) {
	pkg.version = newVersion;
	writeFileSync(path, `${JSON.stringify(pkg, null, "\t")}\n`);
}
for (const { path, updated } of preparedText) {
	writeFileSync(path, updated);
}

console.log(
	`Bumped ${parsedPkgs.length} package.json files + ${preparedText.length} source/config files to ${newVersion}`,
);
console.log(
	`Next: git commit -am "release: v${newVersion}" && git tag v${newVersion} && git push --follow-tags`,
);
