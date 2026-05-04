// tests/release/installer-artifacts.test.ts
//
// Wave-0 scaffolding (PACK-01 / R-01 / R-02). Asserts that after
// `bunx electrobun build --env=stable` runs (locally or in CI), the
// expected artifact files exist with the names Electrobun documents.
//
// SKIPS when packages/desktop/artifacts/ does not exist (i.e. local dev
// without a fresh build). CI release workflow runs after the build, so the
// dir will exist there.
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ARTIFACTS_DIR = join(process.cwd(), "packages/desktop/artifacts");
const hasArtifacts = existsSync(ARTIFACTS_DIR);

describe.skipIf(!hasArtifacts)("Installer artifacts (PACK-01)", () => {
	it("Windows: produces stable-win-x64-RoadRaven-Setup-stable.zip", () => {
		const files = readdirSync(ARTIFACTS_DIR);
		const winInstaller = files.find((f) =>
			/^stable-win-x64-RoadRaven-Setup-stable\.zip$/.test(f),
		);
		expect(
			winInstaller,
			`Windows installer not found in ${files.join(", ")}`,
		).toBeTruthy();
	});

	it("Windows: produces stable-win-x64-update.json (manifest)", () => {
		const files = readdirSync(ARTIFACTS_DIR);
		const winManifest = files.find((f) =>
			/^stable-win-x64-update\.json$/.test(f),
		);
		expect(winManifest, `Windows update manifest not found`).toBeTruthy();
	});

	it("Linux: produces stable-linux-x64-RoadRavenSetup-stable.tar.gz (per R-01, NOT .deb)", () => {
		const files = readdirSync(ARTIFACTS_DIR);
		const linuxInstaller = files.find((f) =>
			/^stable-linux-x64-RoadRavenSetup-stable\.tar\.gz$/.test(f),
		);
		expect(
			linuxInstaller,
			`Linux installer not found in ${files.join(", ")}`,
		).toBeTruthy();

		// Assert .deb is NOT produced (R-01 guard against accidental dpkg-deb wrapping)
		const debFiles = files.filter((f) => f.endsWith(".deb"));
		expect(debFiles, `Unexpected .deb files: ${debFiles.join(", ")}`).toEqual(
			[],
		);
	});

	it("Linux: produces stable-linux-x64-update.json (manifest)", () => {
		const files = readdirSync(ARTIFACTS_DIR);
		const linuxManifest = files.find((f) =>
			/^stable-linux-x64-update\.json$/.test(f),
		);
		expect(linuxManifest, `Linux update manifest not found`).toBeTruthy();
	});
});
