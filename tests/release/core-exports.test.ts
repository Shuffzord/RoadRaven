// tests/release/core-exports.test.ts
//
// Wave-0 scaffolding (PACK-04). Asserts @roadraven/core's published shape:
// import directly from packages/core/dist/index.js (the file npm tarball ships)
// and verify the documented public exports are present.
//
// SKIPS when dist/ does not exist (i.e. before Wave 1 builds the package).
import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const DIST_PATH = join(process.cwd(), "packages/core/dist/index.js");
const hasDist = existsSync(DIST_PATH);

describe.skipIf(!hasDist)("@roadraven/core public exports (PACK-04)", () => {
	it("exports the documented schemas + types from dist/index.js", async () => {
		// Use file:// URL to avoid bundler resolution
		const mod = await import(/* @vite-ignore */ `file://${DIST_PATH}`);
		// Schemas (runtime exports)
		expect(mod.RoadmapNodeSchema).toBeDefined();
		expect(mod.RoadmapSchemaSchema).toBeDefined();
		expect(mod.NodeStatusSchema).toBeDefined();
		expect(mod.StatusConfigSchema).toBeDefined();
		expect(mod.TypeConfigSchema).toBeDefined();
		// Verify zod schemas are zod instances (have .parse method)
		expect(typeof mod.RoadmapNodeSchema.parse).toBe("function");
	});

	it("dist/index.d.ts exists for TS consumers", () => {
		const dtsPath = join(process.cwd(), "packages/core/dist/index.d.ts");
		expect(existsSync(dtsPath), `Expected dist/index.d.ts to exist`).toBe(true);
	});
});
