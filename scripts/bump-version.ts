// scripts/bump-version.ts
// Usage: bun scripts/bump-version.ts 1.0.0
//
// Lockstep version bump (D-04): writes the same `version` field to every
// publishable workspace package.json + the electrobun.config.ts app.version
// field. Run from the repo root.
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

const cfgPath = "packages/desktop/electrobun.config.ts";
const cfgRegex = /version:\s*"[^"]+"/;

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

if (!existsSync(cfgPath)) {
	console.error(`Missing target: ${cfgPath}`);
	process.exit(1);
}
const cfg = readFileSync(cfgPath, "utf8");
const cfgUpdated = cfg.replace(cfgRegex, `version: "${newVersion}"`);
if (cfgUpdated === cfg) {
	console.error(
		`Failed to find 'version: "..."' in ${cfgPath}. Refusing to write — partial bump would break lockstep invariant (D-04).`,
	);
	process.exit(1);
}

for (const { path, pkg } of parsedPkgs) {
	pkg.version = newVersion;
	writeFileSync(path, `${JSON.stringify(pkg, null, "\t")}\n`);
}
writeFileSync(cfgPath, cfgUpdated);

console.log(`Bumped ${parsedPkgs.length} package.json files + ${cfgPath} to ${newVersion}`);
console.log(
	`Next: git commit -am "release: v${newVersion}" && git tag v${newVersion} && git push --follow-tags`,
);
