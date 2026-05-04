// tests/release/requirements-edits.test.ts
//
// Wave-0 scaffolding (D-05, D-08, D-11, R-01). Asserts the Phase 5
// requirement edits landed and have not regressed. Runs in `bun run verify`
// and CI on every push.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REQUIREMENTS = readFileSync(
	join(process.cwd(), ".planning/REQUIREMENTS.md"),
	"utf8",
);
const PROJECT = readFileSync(
	join(process.cwd(), ".planning/PROJECT.md"),
	"utf8",
);
const ROADMAP = readFileSync(
	join(process.cwd(), ".planning/ROADMAP.md"),
	"utf8",
);

describe("REQUIREMENTS.md / PROJECT.md / ROADMAP.md edits (D-05, D-08, D-11, R-01)", () => {
	it("REQUIREMENTS.md does not contain @roadmap-viewer/ (D-05)", () => {
		expect(REQUIREMENTS).not.toMatch(/@roadmap-viewer\//);
	});

	it("PROJECT.md does not contain @roadmap-viewer/ (D-05)", () => {
		expect(PROJECT).not.toMatch(/@roadmap-viewer\//);
	});

	it("ROADMAP.md does not contain @roadmap-viewer/ (D-05)", () => {
		expect(ROADMAP).not.toMatch(/@roadmap-viewer\//);
	});

	it("REQUIREMENTS.md PACK-01 ships Linux .tar.gz, not .deb (R-01)", () => {
		const pack01Match = REQUIREMENTS.match(/^- \[[ x]\] \*\*PACK-01\*\*:.*$/m);
		expect(pack01Match, "PACK-01 line not found").toBeTruthy();
		expect(pack01Match![0]).toMatch(/Linux\s+`\.tar\.gz`/);
		expect(pack01Match![0]).not.toMatch(/Ubuntu\s+`\.deb`/);
	});

	it("REQUIREMENTS.md PACK-02 stable channel only, not canary + stable (D-11)", () => {
		const pack02Match = REQUIREMENTS.match(/^- \[[ x]\] \*\*PACK-02\*\*:.*$/m);
		expect(pack02Match, "PACK-02 line not found").toBeTruthy();
		expect(pack02Match![0]).toMatch(/stable channel only/);
		expect(pack02Match![0]).not.toMatch(/canary \+ stable channels/);
	});

	it("REQUIREMENTS.md PACK-04 publishes @roadraven/core + plugin-claude-code, drops @roadraven/react (D-01, D-05)", () => {
		const pack04Match = REQUIREMENTS.match(/^- \[[ x]\] \*\*PACK-04\*\*:.*$/m);
		expect(pack04Match, "PACK-04 line not found").toBeTruthy();
		expect(pack04Match![0]).toMatch(/@roadraven\/core/);
		expect(pack04Match![0]).toMatch(/@roadraven\/plugin-claude-code/);
		// @roadraven/react may be mentioned as deferred — only assert it is NOT in the publish list
		expect(pack04Match![0]).not.toMatch(/`@roadraven\/react` published/);
	});

	it("PROJECT.md Out of Scope table includes the 5 deferral rows (D-08, D-11, D-14, R-01)", () => {
		expect(PROJECT).toMatch(/macOS\s+`?\.dmg`?\s+distribution in v1\.0/);
		expect(PROJECT).toMatch(/Linux\s+`?\.deb`?\s+packaging in v1\.0/);
		expect(PROJECT).toMatch(/Canary release channel in v1\.0/);
		expect(PROJECT).toMatch(/@roadraven\/react.*npm package in v1\.0/);
		expect(PROJECT).toMatch(/Code signing for v1\.0/);
	});
});
