// tests/release/installer-artifacts.test.ts
//
// Wave-0 scaffolding (PACK-01 / R-01 / R-02). Asserts that after
// `bunx electrobun build --env=stable` runs (locally or in CI), the
// expected artifact files exist with the names Electrobun produces.
//
// Filename ground-truth (verified against electrobun@1.18.1 src/shared/naming.ts +
// local stable build output 2026-05-05): for buildEnvironment === "stable" the
// channel suffix is OMITTED. Only non-stable builds (canary/dev) get a
// trailing `-{channel}` suffix on the bundle name. So:
//   stable Windows: stable-win-x64-RoadRaven-Setup.zip   (NO -stable)
//   stable Linux:   stable-linux-x64-RoadRaven-Setup.tar.gz (NO -stable, dash kept)
// Earlier scaffolding hand-coded `*-stable.zip` / `RoadRavenSetup-stable.tar.gz`
// which would never have matched a real CI artifact (verifier truth #1).
//
// Fail-loud semantics (W-06 fix): in CI we MUST fail loud if the artifacts dir
// is missing — that means the build step never produced anything, which is
// itself a release-blocker. Locally we still skip so devs can run the broader
// suite without a 5-minute Electrobun build first.
//
// Platform gating: release.yml splits the build across build-windows (windows-latest)
// and build-linux (ubuntu-latest) runners. Each runner only produces artifacts
// for its own platform — asserting Linux files on the Windows runner (or vice
// versa) would always fail. So we run only the assertions that match the
// current process platform; CI runs the test once per OS, satisfying both sets
// across the matrix.
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ARTIFACTS_DIR = join(process.cwd(), "packages/desktop/artifacts");
const hasArtifacts = existsSync(ARTIFACTS_DIR);
const isCI = process.env.CI === "true";
const isWin = process.platform === "win32";
const isLinux = process.platform === "linux";

if (isCI && !hasArtifacts) {
	throw new Error(
		`[installer-artifacts] CI=true but ${ARTIFACTS_DIR} does not exist. ` +
			`The 'electrobun build --env=stable' step must produce this directory ` +
			`before the smoke test runs. Skipping in CI is forbidden — that masks ` +
			`real release failures (W-06).`,
	);
}

describe.skipIf(!hasArtifacts)("Installer artifacts (PACK-01)", () => {
	describe.skipIf(!isWin)("Windows", () => {
		it("produces stable-win-x64-RoadRaven-Setup.zip", () => {
			const files = readdirSync(ARTIFACTS_DIR);
			const winInstaller = files.find((f) =>
				/^stable-win-x64-RoadRaven-Setup\.zip$/.test(f),
			);
			expect(
				winInstaller,
				`Windows installer not found in ${files.join(", ")}`,
			).toBeTruthy();
		});

		it("produces stable-win-x64-update.json (manifest)", () => {
			const files = readdirSync(ARTIFACTS_DIR);
			const winManifest = files.find((f) =>
				/^stable-win-x64-update\.json$/.test(f),
			);
			expect(winManifest, `Windows update manifest not found`).toBeTruthy();
		});
	});

	describe.skipIf(!isLinux)("Linux", () => {
		it("produces stable-linux-x64-RoadRaven-Setup.tar.gz (per R-01, NOT .deb)", () => {
			const files = readdirSync(ARTIFACTS_DIR);
			const linuxInstaller = files.find((f) =>
				/^stable-linux-x64-RoadRaven-Setup\.tar\.gz$/.test(f),
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

		it("produces stable-linux-x64-update.json (manifest)", () => {
			const files = readdirSync(ARTIFACTS_DIR);
			const linuxManifest = files.find((f) =>
				/^stable-linux-x64-update\.json$/.test(f),
			);
			expect(linuxManifest, `Linux update manifest not found`).toBeTruthy();
		});
	});
});
