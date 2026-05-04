// scripts/bump-version.ts
// Usage: bun scripts/bump-version.ts 1.0.0
//
// Lockstep version bump (D-04): writes the same `version` field to every
// workspace package.json + the electrobun.config.ts app.version field.
// Run from the repo root.
import { readFileSync, writeFileSync } from "node:fs";

const newVersion = process.argv[2];
if (!newVersion?.match(/^\d+\.\d+\.\d+(-[a-z0-9.]+)?$/)) {
	console.error(`Invalid version: ${newVersion}. Expected semver e.g. 1.0.0`);
	process.exit(1);
}

const targets = [
	"packages/desktop/package.json",
	"packages/core/package.json",
	"packages/react/package.json",
	"plugins/claude-code/package.json",
];

for (const path of targets) {
	const pkg = JSON.parse(readFileSync(path, "utf8")) as { version?: string };
	pkg.version = newVersion;
	writeFileSync(path, `${JSON.stringify(pkg, null, "\t")}\n`);
}

// Bump electrobun.config.ts app.version (string replace — small file, one match)
const cfgPath = "packages/desktop/electrobun.config.ts";
const cfg = readFileSync(cfgPath, "utf8");
const updated = cfg.replace(/version:\s*"[^"]+"/, `version: "${newVersion}"`);
writeFileSync(cfgPath, updated);

console.log(`Bumped all packages + electrobun.config.ts to ${newVersion}`);
console.log(
	`Next: git commit -am "release: v${newVersion}" && git tag v${newVersion} && git push --follow-tags`,
);
