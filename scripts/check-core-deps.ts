// scripts/check-core-deps.ts
// Runs in CI as part of the lint job. Fails the job if packages/core/package.json
// `dependencies` contains anything outside the allowlist.
//
// PACK-04 invariant: @roadraven/core has zero desktop dependencies.
import { readFileSync } from "node:fs";

const ALLOWLIST = new Set([
	"zod",
	// Add new entries here ONLY after explicit team review. Each addition
	// expands the runtime surface that downstream consumers (the Claude Code
	// MCP wrapper, future producers) take a transitive dep on.
]);

const pkg = JSON.parse(
	readFileSync("packages/core/package.json", "utf8"),
) as { dependencies?: Record<string, string> };

const deps = Object.keys(pkg.dependencies ?? {});
const violations = deps.filter((d) => !ALLOWLIST.has(d));

if (violations.length > 0) {
	console.error(
		`packages/core/package.json has forbidden dependencies: ${violations.join(", ")}`,
	);
	console.error(`Allowlist: ${[...ALLOWLIST].join(", ")}`);
	console.error(
		`If you need to add a dependency, edit ALLOWLIST in scripts/check-core-deps.ts and explain in the PR description.`,
	);
	process.exit(1);
}

console.log(
	`✓ packages/core has ${deps.length} dependencies, all on the allowlist.`,
);
