// tests/release/installer-artifacts.test.ts
//
// Wave-0 scaffolding (PACK-01 / R-01 / R-02). Asserts that after
// `bunx electrobun build --env=stable` runs (locally or in CI), the
// expected artifact files exist with the names Electrobun produces.
//
// Filename ground-truth (verified against electrobun@2.0.1 —
// packages/desktop/.hutch/devkit/api/shared/naming.ts + naming.test.ts,
// the official bundling-and-distribution.mdx packaging doc reproduced in
// .planning/electrobun-2-reference.md section 4, and a real local
// `bunx electrobun build --env=stable` Windows run, 2026-09-20):
//
// Two DIFFERENT channel-prefix rules apply, per artifact type — this is
// intentional, not a bug, do not "fix" one to match the other:
//   - Installer wrapper (.zip on Windows, .tar.gz on Linux, .dmg on macOS):
//     OMITS the channel token entirely for "stable" (bare `<os>-<arch>-`
//     prefix). Non-stable channels DO get the full `<channel>-<os>-<arch>-`
//     prefix, plus a `-<channel>` suffix on the app name inside the file
//     (e.g. canary: `canary-win-x64-RoadRaven-Setup-canary.zip`).
//   - Updater triplet (`update.json`, `.tar.zst`, `.patch`): ALWAYS carries
//     the full `<channel>-<os>-<arch>-` prefix, "stable-" included, per
//     Electrobun's own back-compat note (unchanged since v1.18.1, so a 1.x
//     client can consume a 2.0 release directly without a bridge step).
// So:
//   stable Windows: win-x64-RoadRaven-Setup.zip         (installer, NO stable-)
//                   stable-win-x64-RoadRaven.tar.zst     (updater tarball)
//                   stable-win-x64-update.json            (updater manifest)
//                   stable-win-x64-<hash>.patch           (updater patch, optional — see below)
//   stable Linux:   linux-x64-RoadRaven-Setup.tar.gz     (installer, NO stable-; still .tar.gz, not .deb)
//                   stable-linux-x64-RoadRaven.tar.zst
//                   stable-linux-x64-update.json
//                   stable-linux-x64-<hash>.patch         (optional — see below)
//
// This supersedes the 1.x ground-truth this file previously recorded here
// (`stable-win-x64-RoadRaven-Setup.zip` — installer WITH the stable-
// prefix). Electrobun 2.x dropped the channel prefix from the installer
// wrapper specifically; the 1.x -> 2.x migration surfaced this as a real
// CI break (release.yml's upload glob no longer matched the new name).
//
// `.patch` is asserted only when present, not required: release.generatePatch
// defaults to true in 2.x, but per Electrobun's own docs "first release of a
// product has no predecessor, so never produces a patch regardless of the
// setting" — hard-requiring it here would fail CI on the project's actual
// first release for a reason that isn't a naming regression. release.yml
// still uploads it via glob whenever Hutch does produce one, so a patch that
// *is* produced is never silently dropped from the release.
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
		it("produces win-x64-RoadRaven-Setup.zip", () => {
			const files = readdirSync(ARTIFACTS_DIR);
			const winInstaller = files.find((f) =>
				/^win-x64-RoadRaven-Setup\.zip$/.test(f),
			);
			expect(
				winInstaller,
				`Windows installer not found in ${files.join(", ")}`,
			).toBeTruthy();
		});

		it("produces stable-win-x64-RoadRaven.tar.zst (updater tarball)", () => {
			const files = readdirSync(ARTIFACTS_DIR);
			const winTarball = files.find((f) =>
				/^stable-win-x64-RoadRaven\.tar\.zst$/.test(f),
			);
			expect(
				winTarball,
				`Windows updater tarball not found in ${files.join(", ")}`,
			).toBeTruthy();
		});

		it("produces stable-win-x64-update.json (manifest)", () => {
			const files = readdirSync(ARTIFACTS_DIR);
			const winManifest = files.find((f) =>
				/^stable-win-x64-update\.json$/.test(f),
			);
			expect(winManifest, `Windows update manifest not found`).toBeTruthy();
		});

		it("names any stable-win-x64 patch correctly when present (optional: first release has no predecessor)", () => {
			const files = readdirSync(ARTIFACTS_DIR);
			const patches = files.filter((f) => f.endsWith(".patch"));
			for (const patch of patches) {
				expect(patch).toMatch(/^stable-win-x64-[a-z0-9]+\.patch$/);
			}
		});
	});

	describe.skipIf(!isLinux)("Linux", () => {
		it("produces linux-x64-RoadRaven-Setup.tar.gz (per R-01, NOT .deb)", () => {
			const files = readdirSync(ARTIFACTS_DIR);
			const linuxInstaller = files.find((f) =>
				/^linux-x64-RoadRaven-Setup\.tar\.gz$/.test(f),
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

		it("produces stable-linux-x64-RoadRaven.tar.zst (updater tarball)", () => {
			const files = readdirSync(ARTIFACTS_DIR);
			const linuxTarball = files.find((f) =>
				/^stable-linux-x64-RoadRaven\.tar\.zst$/.test(f),
			);
			expect(
				linuxTarball,
				`Linux updater tarball not found in ${files.join(", ")}`,
			).toBeTruthy();
		});

		it("produces stable-linux-x64-update.json (manifest)", () => {
			const files = readdirSync(ARTIFACTS_DIR);
			const linuxManifest = files.find((f) =>
				/^stable-linux-x64-update\.json$/.test(f),
			);
			expect(linuxManifest, `Linux update manifest not found`).toBeTruthy();
		});

		it("names any stable-linux-x64 patch correctly when present (optional: first release has no predecessor)", () => {
			const files = readdirSync(ARTIFACTS_DIR);
			const patches = files.filter((f) => f.endsWith(".patch"));
			for (const patch of patches) {
				expect(patch).toMatch(/^stable-linux-x64-[a-z0-9]+\.patch$/);
			}
		});
	});
});
