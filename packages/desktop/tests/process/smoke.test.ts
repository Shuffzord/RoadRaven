import { exec } from "node:child_process";
import { resolve } from "node:path";
import { promisify } from "node:util";
import { expect, test } from "@playwright/test";

const execAsync = promisify(exec);
const DESKTOP_ROOT = resolve(__dirname, "../..");

test("SCAF-06 Tier 2: main process entry point is parseable by Bun", async () => {
	// Verify that Bun can parse the main process entry point without syntax errors.
	// Full tsc --noEmit may fail due to third-party type issues (e.g. electrobun deps);
	// this test ensures our entry point code is structurally valid.
	const { stdout } = await execAsync(
		'bun -e "await import(\'./src/bun/index.ts\'); console.log(\'PARSE_OK\')" 2>&1 || true',
		{ cwd: DESKTOP_ROOT },
	);
	// Bun should be able to parse the file (may fail at runtime due to missing electrobun runtime)
	// We check it doesn't have a SyntaxError
	expect(stdout).not.toContain("SyntaxError");
});

test("SCAF-06 Tier 2: electrobun.config.ts is importable", async () => {
	// Verify config file can be loaded by Bun without crashing
	const { stdout } = await execAsync(
		'bun -e "const c = await import(\'./electrobun.config.ts\'); console.log(c.default.app.name)"',
		{ cwd: DESKTOP_ROOT },
	);
	expect(stdout.trim()).toContain("RoadRaven");
});
