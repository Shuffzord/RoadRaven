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
		// roadraven-hud plugin manifest.
		path: "plugins/roadraven-hud/.claude-plugin/plugin.json",
		regex: /"version":\s*"[^"]+"/,
		replacement: `"version": "${newVersion}"`,
		label: '"version": "..." (hud plugin)',
	},
	{
		// roadraven-hud's marketplace entry: anchored on its name so the
		// roadraven entry's version is left to the target above. [\s\S] (not
		// [^}]) so nested objects such as `relevance` may sit before `version`.
		path: ".claude-plugin/marketplace.json",
		regex: /("name":\s*"roadraven-hud"[\s\S]*?"version":\s*")[^"]+"/,
		replacement: `$1${newVersion}"`,
		label: '"version": "..." (hud marketplace entry)',
	},
	{
		// Pinned MCP server version the plugin's npx invocation installs.
		path: "plugins/claude-code/.mcp.json",
		regex: /@roadraven\/mcp@[^"]+/,
		replacement: `@roadraven/mcp@${newVersion}`,
		label: '"@roadraven/mcp@..."',
	},
	{
		// MCP Registry metadata: the server version and the npm package
		// version it points at are both literals, hence the global flag.
		path: "plugins/claude-code/server.json",
		regex: /"version":\s*"[^"]+"/g,
		replacement: `"version": "${newVersion}"`,
		label: '"version": "..." (server + package)',
	},
	{
		// Plugin README pins the npx install (and init) command twice, hence the
		// global flag. Matches a version only, so a trailing backtick, quote or
		// word after the pin is left untouched.
		path: "plugins/claude-code/README.md",
		regex: /@roadraven\/mcp@\d+\.\d+\.\d+(?:-[0-9A-Za-z]+(?:\.[0-9A-Za-z]+)*)?/g,
		replacement: `@roadraven/mcp@${newVersion}`,
		label: "@roadraven/mcp@... (plugin README)",
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

// Targets sharing a file (marketplace.json) apply in sequence on the running
// result, so the later write does not discard the earlier replacement.
const pending = new Map<string, string>();
const preparedText = textTargets.map(({ path, regex, replacement, label }) => {
	if (!existsSync(path)) {
		console.error(`Missing target: ${path}`);
		process.exit(1);
	}
	const content = pending.get(path) ?? readFileSync(path, "utf8");
	if (!regex.test(content)) {
		console.error(
			`Failed to find '${label}' in ${path}. Refusing to write — partial bump would break lockstep invariant (D-04).`,
		);
		process.exit(1);
	}
	const updated = content.replace(regex, replacement);
	pending.set(path, updated);
	return { path, updated };
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
