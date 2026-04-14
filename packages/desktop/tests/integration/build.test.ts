import { execSync } from "node:child_process";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("Vite build", () => {
	it("production build succeeds without errors", () => {
		// This single test catches: CSS @import ordering, import resolution,
		// top-level await compatibility, and module bundling issues.
		// It would have caught 3 of 4 runtime bugs found in Phase 01.
		const projectRoot = join(__dirname, "../..");
		const result = execSync("npx vite build", {
			cwd: projectRoot,
			encoding: "utf-8",
			timeout: 30000,
		});
		expect(result).toContain("built in");
	});
});
