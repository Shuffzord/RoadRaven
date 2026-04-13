import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const WORKSPACE_ROOT = resolve(__dirname, "../../../..");
const DESKTOP_ROOT = resolve(__dirname, "../..");

describe("SCAF-01: Monorepo structure", () => {
	const requiredPackages = [
		"packages/core/package.json",
		"packages/react/package.json",
		"packages/desktop/package.json",
		"plugins/claude-code/package.json",
	];

	for (const pkg of requiredPackages) {
		it(`${pkg} exists`, () => {
			expect(existsSync(join(WORKSPACE_ROOT, pkg))).toBe(true);
		});
	}

	it("root package.json has workspaces field", () => {
		const root = JSON.parse(
			readFileSync(join(WORKSPACE_ROOT, "package.json"), "utf-8"),
		);
		expect(root.workspaces).toContain("packages/*");
		expect(root.workspaces).toContain("plugins/*");
	});
});

describe("SCAF-04: RoadmapPlugin interface", () => {
	it("packages/core/src/plugin.ts exports RoadmapPlugin interface", () => {
		const content = readFileSync(
			join(WORKSPACE_ROOT, "packages/core/src/plugin.ts"),
			"utf-8",
		);
		expect(content).toContain("export interface RoadmapPlugin");
		expect(content).toContain("connect(nodeId:");
		expect(content).toContain("disconnect(nodeId:");
		expect(content).toContain('on(event: "status"');
		expect(content).toContain('off(event: "status"');
	});
});

describe("SCAF-08: bundleCEF configuration", () => {
	it("electrobun.config.ts has bundleCEF: true for all platforms", () => {
		const content = readFileSync(
			join(DESKTOP_ROOT, "electrobun.config.ts"),
			"utf-8",
		);
		// Must have bundleCEF: true and NOT bundleCEF: false
		const trueMatches = content.match(/bundleCEF:\s*true/g);
		const falseMatches = content.match(/bundleCEF:\s*false/g);
		expect(trueMatches).toHaveLength(3); // mac, linux, win
		expect(falseMatches).toBeNull();
	});
});

describe("SCAF-03: RPC contract", () => {
	it("shared/types.ts exports RoadmapRPCType", () => {
		const content = readFileSync(
			join(WORKSPACE_ROOT, "shared/types.ts"),
			"utf-8",
		);
		expect(content).toContain("export type RoadmapRPCType");
		expect(content).toContain("loadFile");
		expect(content).toContain("pushStatusUpdate");
	});
});

describe("SCAF-09: Updater safety", () => {
	it("index.ts wraps Updater.localInfo.channel() in try/catch", () => {
		const content = readFileSync(
			join(DESKTOP_ROOT, "src/bun/index.ts"),
			"utf-8",
		);
		// Must have the safe pattern: let channel = "dev" then try { channel = await ... }
		expect(content).toContain('let channel = "dev"');
		expect(content).toContain("Updater.localInfo.channel()");
		// Must NOT have the unsafe pattern: const channel = await Updater.localInfo.channel()
		expect(content).not.toMatch(
			/const channel\s*=\s*await\s+Updater\.localInfo\.channel\(\)/,
		);
	});
});
