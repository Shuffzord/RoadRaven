// tests/release/bump-version.test.ts
//
// Runs scripts/bump-version.ts against a scratch copy of the files it rewrites
// (the script resolves targets from cwd) and checks the hud pins move with it.
import { spawnSync } from "node:child_process";
import {
	cpSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "../..");
const SCRIPT = join(ROOT, "scripts/bump-version.ts");
const FILES = [
	"packages/desktop/package.json",
	"packages/core/package.json",
	"plugins/claude-code/package.json",
	"plugins/claude-code/.claude-plugin/plugin.json",
	"plugins/claude-code/.mcp.json",
	"plugins/claude-code/server.json",
	"plugins/claude-code/README.md",
	"plugins/roadraven-hud/.claude-plugin/plugin.json",
	".claude-plugin/marketplace.json",
];

describe("bump-version.ts", () => {
	let cwd: string;
	const run = (version: string) =>
		spawnSync("bun", [SCRIPT, version], { cwd, encoding: "utf8" });
	const json = (rel: string) => JSON.parse(readFileSync(join(cwd, rel), "utf8"));

	beforeEach(() => {
		cwd = mkdtempSync(join(tmpdir(), "rr-bump-test-"));
		for (const f of FILES) {
			mkdirSync(dirname(join(cwd, f)), { recursive: true });
			cpSync(join(ROOT, f), join(cwd, f));
		}
	});
	afterEach(() => rmSync(cwd, { recursive: true, force: true }));

	it("bumps the hud plugin.json and its marketplace entry", () => {
		const res = run("9.8.7");
		expect(res.status).toBe(0);
		expect(json("plugins/roadraven-hud/.claude-plugin/plugin.json").version).toBe("9.8.7");
		const plugins = json(".claude-plugin/marketplace.json").plugins;
		expect(plugins.map((p: { version: string }) => p.version)).toEqual(["9.8.7", "9.8.7"]);
	});

	it("writes nothing when the hud marketplace entry cannot be matched", () => {
		const market = join(cwd, ".claude-plugin/marketplace.json");
		const original = readFileSync(market, "utf8").replace("roadraven-hud", "renamed");
		writeFileSync(market, original);
		const res = run("9.8.7");
		expect(res.status).toBe(1);
		expect(res.stderr).toContain("hud marketplace entry");
		expect(readFileSync(market, "utf8")).toBe(original);
		expect(json("packages/core/package.json").version).not.toBe("9.8.7");
	});
});
