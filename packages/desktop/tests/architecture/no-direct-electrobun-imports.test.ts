// tests/architecture/no-direct-electrobun-imports.test.ts
//
// Enforces the platform-adapter seam (Electrobun 2.x migration step 1):
// every runtime Electrobun touchpoint must live behind
// packages/desktop/src/bun/platform/** (bun side) or
// packages/desktop/src/mainview/rpc.ts (the one renderer file). Concentrating
// the imports there is what makes a future Electrobun major-version bump a
// six-file change instead of a codebase-wide hunt — in 2.x every export of
// electrobun/bun and electrobun/view resolves to a stub that throws at
// *runtime*, so a stray direct import elsewhere would build clean and fail
// silently in the packaged app.
//
// This is the plain-vitest backstop for biome.json's noRestrictedImports
// override and must not depend on Biome behaving — it scans the source tree
// directly.
//
// Fail-loud semantics: any match outside the allow-list is a hard failure,
// not a skip.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const SRC_ROOT = join(__dirname, "..", "..", "src");

// Paths (relative to src/, forward-slash) allowed to import electrobun/bun
// or electrobun/view directly — mirrors biome.json's noRestrictedImports
// override.
const ALLOWED_PATHS = [
	"bun/platform", // directory — every file under here is allowed
	"mainview/rpc.ts", // exact file
];

const ELECTROBUN_IMPORT = /from\s+["']electrobun(\/bun|\/view)?["']/;

function isAllowed(relPath: string): boolean {
	return ALLOWED_PATHS.some(
		(allowed) => relPath === allowed || relPath.startsWith(`${allowed}/`),
	);
}

function collectSourceFiles(dir: string): string[] {
	const files: string[] = [];
	for (const entry of readdirSync(dir)) {
		const full = join(dir, entry);
		if (statSync(full).isDirectory()) {
			files.push(...collectSourceFiles(full));
		} else if (/\.(ts|tsx)$/.test(entry)) {
			files.push(full);
		}
	}
	return files;
}

describe("Architecture: Electrobun imports stay behind the platform seam", () => {
	it("only the allow-listed files import from electrobun/bun or electrobun/view", () => {
		const violations: string[] = [];
		for (const file of collectSourceFiles(SRC_ROOT)) {
			const relPath = relative(SRC_ROOT, file).replace(/\\/g, "/");
			if (isAllowed(relPath)) continue;
			if (ELECTROBUN_IMPORT.test(readFileSync(file, "utf-8"))) {
				violations.push(relPath);
			}
		}
		expect(
			violations,
			`Found direct Electrobun imports outside the platform seam: ${violations.join(", ")}. ` +
				`Import "electrobun/bun" only from packages/desktop/src/bun/platform/**, ` +
				`and "electrobun/view" only from packages/desktop/src/mainview/rpc.ts.`,
		).toEqual([]);
	});
});
