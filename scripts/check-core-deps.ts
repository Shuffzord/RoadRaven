// scripts/check-core-deps.ts
// Runs in CI as part of the lint job. Fails the job if packages/core/package.json
// declares anything outside the allowlist across `dependencies`,
// `peerDependencies`, `optionalDependencies`, or `bundledDependencies`.
//
// PACK-04 invariant: @roadraven/core has zero desktop dependencies. Checking
// only `dependencies` left an evasion vector — a contributor could relocate
// a forbidden dep to `peerDependencies` (where it's still surfaced to
// downstream consumers via npm resolution) or `optionalDependencies`
// (still installed by default) and the gate would silently green-light it.
// W-04 fix closes that loophole.
import { readFileSync } from "node:fs";

const ALLOWLIST = new Set([
	"zod",
	// Add new entries here ONLY after explicit team review. Each addition
	// expands the runtime surface that downstream consumers (the Claude Code
	// MCP wrapper, future producers) take a transitive dep on.
]);

// npm officially accepts BOTH `bundledDependencies` (canonical) and
// `bundleDependencies` (alias) — leaving either out of the allowlist scan
// preserves the same evasion vector W-04 was meant to close.
const DEP_FIELDS = [
	"dependencies",
	"peerDependencies",
	"optionalDependencies",
	"bundledDependencies",
	"bundleDependencies",
] as const;

type DepField = (typeof DEP_FIELDS)[number];
type PackageJson = {
	[K in DepField]?: K extends "bundledDependencies"
		? string[]
		: Record<string, string>;
};

const pkg = JSON.parse(
	readFileSync("packages/core/package.json", "utf8"),
) as PackageJson;

const violations: { field: DepField; name: string }[] = [];
let totalDeps = 0;

for (const field of DEP_FIELDS) {
	const raw = pkg[field];
	if (!raw) continue;
	// bundledDependencies is an array; everything else is a name->version map.
	const names = Array.isArray(raw) ? raw : Object.keys(raw);
	totalDeps += names.length;
	for (const name of names) {
		if (!ALLOWLIST.has(name)) {
			violations.push({ field, name });
		}
	}
}

if (violations.length > 0) {
	console.error(`packages/core/package.json has forbidden dependencies:`);
	for (const v of violations) {
		console.error(`  - ${v.name} (in ${v.field})`);
	}
	console.error(`Allowlist: ${[...ALLOWLIST].join(", ")}`);
	console.error(
		`If you need to add a dependency, edit ALLOWLIST in scripts/check-core-deps.ts and explain in the PR description.`,
	);
	process.exit(1);
}

console.log(
	`✓ packages/core has ${totalDeps} dependencies across ${DEP_FIELDS.join("/")}, all on the allowlist.`,
);
