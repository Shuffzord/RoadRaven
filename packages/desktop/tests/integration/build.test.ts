import { execSync } from "node:child_process";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("Vite build", () => {
	it("production build succeeds without errors", { timeout: 60_000 }, () => {
		// This single test catches: CSS @import ordering, import resolution,
		// top-level await compatibility, and module bundling issues.
		// It would have caught 3 of 4 runtime bugs found in Phase 01.
		const projectRoot = join(__dirname, "../..");
		const result = execSync("bunx vite build", {
			cwd: projectRoot,
			encoding: "utf-8",
			timeout: 55_000,
		});
		expect(result).toContain("built in");
	});
});
