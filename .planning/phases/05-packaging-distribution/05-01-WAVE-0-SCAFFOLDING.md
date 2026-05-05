---
phase: 05-packaging-distribution
plan: 01
type: execute
wave: 0
depends_on: []
files_modified:
  - .planning/REQUIREMENTS.md
  - .planning/PROJECT.md
  - .planning/ROADMAP.md
  - package.json
  - packages/core/package.json
  - packages/desktop/package.json
  - .gitignore
  - scripts/check-core-deps.ts
  - scripts/bump-version.ts
  - tests/release/installer-artifacts.test.ts
  - tests/release/core-exports.test.ts
  - tests/release/requirements-edits.test.ts
  - tests/release/manifest-url.test.ts
  - packages/desktop/tests/a11y/audit.spec.ts
  - packages/desktop/tests/a11y/playwright.config.ts
autonomous: true
requirements: [PACK-01, PACK-02, PACK-04, PACK-06]
threats: [T-05-01, T-05-04, T-05-08]
tags: [packaging, scaffolding, requirements, validation]

must_haves:
  truths:
    - "REQUIREMENTS.md PACK-01/PACK-02/PACK-04 reflect locked decisions D-05/D-08/D-11 and R-01"
    - "PROJECT.md `## Active` Packaging line + `## Out of Scope` table reflect scope reductions (no @roadraven/react, no macOS, no canary, no .deb, no signing)"
    - "Core dependency allowlist script exists and rejects anything outside { zod }"
    - "Lockstep version bump script writes all four package.json version fields plus electrobun.config.ts app.version atomically"
    - "Release-test scaffolding files exist (failing or pending) so future waves run against real assertions"
    - "@axe-core/playwright installed at workspace root and tsup + typescript installed in packages/core devDeps"
    - ".gitignore covers packages/core/dist/ and packages/desktop/artifacts/"
  artifacts:
    - path: ".planning/REQUIREMENTS.md"
      provides: "Requirement edits per D-05/D-08/D-11/R-01"
      contains: "PACK-01: Native installers: Windows `.exe` (in `.zip`) + Linux `.tar.gz` (Electrobun-native self-extracting)"
    - path: ".planning/PROJECT.md"
      provides: "Out of Scope rows for macOS-v1, canary-v1, signing-v1, react-v1, .deb-v1"
      contains: "macOS distribution in v1.0"
    - path: "scripts/check-core-deps.ts"
      provides: "CI-runnable dependency allowlist enforcement"
      contains: "ALLOWLIST"
    - path: "scripts/bump-version.ts"
      provides: "Lockstep version bump"
      contains: "packages/desktop/electrobun.config.ts"
    - path: "tests/release/installer-artifacts.test.ts"
      provides: "Wave-0 failing test for installer artifact naming"
      contains: "stable-win-x64-RoadRaven-Setup"
    - path: "tests/release/core-exports.test.ts"
      provides: "Wave-0 failing test for @roadraven/core dist/ exports"
      contains: "RoadmapSchemaSchema"
    - path: "tests/release/requirements-edits.test.ts"
      provides: "Grep test asserting REQUIREMENTS.md/PROJECT.md edits landed"
      contains: "@roadmap-viewer"
    - path: "packages/desktop/tests/a11y/audit.spec.ts"
      provides: "axe-core baseline against vite preview"
      contains: "AxeBuilder"
    - path: ".gitignore"
      provides: "Excludes generated build artifacts from VCS"
      contains: "packages/core/dist/"
  key_links:
    - from: ".github/workflows/ci.yml (next plan)"
      to: "scripts/check-core-deps.ts"
      via: "bun run scripts/check-core-deps.ts step"
      pattern: "check-core-deps"
    - from: "tests/release/requirements-edits.test.ts"
      to: ".planning/REQUIREMENTS.md, .planning/PROJECT.md"
      via: "fs.readFileSync grep assertions"
      pattern: "@roadmap-viewer"
    - from: "packages/desktop/tests/a11y/audit.spec.ts"
      to: "vite preview on port 4173"
      via: "Playwright webServer config"
      pattern: "vite preview"
---

<objective>
Land all Wave-0 scaffolding: requirement-document edits (D-05, D-08, D-11, R-01),
the lockstep version-bump script, the core dependency allowlist script, the
release/a11y test scaffolding (failing or pending), and the new dev dependencies
(`tsup`, `typescript` in `packages/core`; `@axe-core/playwright` workspace-root).

This plan has zero runtime effect on the shipped app. Its purpose is to make
sure every later wave executes against a correct REQUIREMENTS.md, can be
validated by failing tests that turn green as features land, and has the helper
scripts CI will need.

Purpose: Without this Wave 0, every later wave tests against stale requirement
text, hand-bumps versions across 5 files (Pattern 1 anti-pattern), and has no
automated way to detect when an executor reintroduces `@roadmap-viewer/`,
`.deb`, or unexpected `packages/core` dependencies.

Output:
- Edited `.planning/REQUIREMENTS.md`, `.planning/PROJECT.md`, `.planning/ROADMAP.md`
- New `scripts/check-core-deps.ts`, `scripts/bump-version.ts`
- New `tests/release/*.test.ts` files (test scaffolds — initially failing, will turn green as Waves 1-3 land)
- New `packages/desktop/tests/a11y/audit.spec.ts` + `playwright.config.ts`
- Updated `.gitignore`, `package.json`, `packages/core/package.json`, `packages/desktop/package.json`
</objective>

<execution_context>
@C:\Work\RoadRaven\.claude\get-shit-done\workflows\execute-plan.md
@C:\Work\RoadRaven\.claude\get-shit-done\templates\summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/REQUIREMENTS.md
@.planning/STATE.md
@.planning/phases/05-packaging-distribution/05-CONTEXT.md
@.planning/phases/05-packaging-distribution/05-RESEARCH.md
@.planning/phases/05-packaging-distribution/05-VALIDATION.md

<interfaces>
<!-- Existing values that scaffolding must align with -->

From packages/core/package.json (current state):
```json
{
  "name": "@roadraven/core",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "main": "src/index.ts",
  "types": "src/index.ts",
  "scripts": {},
  "dependencies": { "zod": "^4.3.6" }
}
```

From packages/core/src/index.ts (public API surface — must not change):
```typescript
export type { IntegrationEvent, RoadmapPlugin } from "./plugin.ts";
export type { NodeStatus, RoadmapNode, RoadmapSchema, StatusConfig, TypeConfig } from "./schema.ts";
export {
  NodeStatusSchema, RoadmapNodeSchema, RoadmapSchemaSchema,
  StatusConfigSchema, TypeConfigSchema,
} from "./schema.ts";
```

From packages/desktop/electrobun.config.ts (current — version field must be bumpable):
```typescript
app: { name: "RoadRaven", identifier: "RoadRaven.electrobun.dev", version: "0.0.1" }
```

From packages/desktop/playwright.config.ts (existing harness — a11y harness extends pattern):
- testDir: "./tests"
- projects: [{ name: "ui", baseURL: "http://localhost:5173" }, { name: "process" }]
- webServer: { command: "bunx vite --port 5173", url: "http://localhost:5173" }

From .planning/REQUIREMENTS.md (current PACK lines — MUST be rewritten):
- PACK-01: "Native installers: macOS `.dmg`, Windows `.exe`, Ubuntu `.deb`"
- PACK-02: "Electrobun auto-updater configured (canary + stable channels)"
- PACK-04: "npm packages `@roadmap-viewer/core` and `@roadmap-viewer/react` published"

From .planning/PROJECT.md (current `## Active` Packaging line — MUST be rewritten):
- "Packaging: macOS `.dmg`, Windows `.exe`, Ubuntu `.deb`; Electrobun auto-updater; npm packages (`@roadmap-viewer/core`, `@roadmap-viewer/react`); plugin authoring guide; README and docs site"
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Land requirement edits in REQUIREMENTS.md, PROJECT.md, ROADMAP.md</name>

  <read_first>
    - .planning/REQUIREMENTS.md (current PACK-01..PACK-06 — being rewritten)
    - .planning/PROJECT.md (current `## Requirements > Active` Packaging line + `## Out of Scope` table)
    - .planning/ROADMAP.md (Phase 5 section — done-when criteria)
    - .planning/phases/05-packaging-distribution/05-CONTEXT.md `<reconciliation>` (R-01..R-06 — these supersede)
    - .planning/phases/05-packaging-distribution/05-CONTEXT.md `<decisions>` D-05, D-08, D-11, D-14
  </read_first>

  <files>
    .planning/REQUIREMENTS.md
    .planning/PROJECT.md
    .planning/ROADMAP.md
  </files>

  <action>
    Apply these EXACT edits. No paraphrasing — copy literally.

    **A. .planning/REQUIREMENTS.md — Packaging (PACK) section, replace lines for PACK-01, PACK-02, PACK-04:**

    Replace PACK-01 line with:
    ```
    - [ ] **PACK-01**: Native installers: Windows `.exe` (distributed inside `{channel}-win-x64-RoadRaven-Setup-{channel}.zip`) and Linux `.tar.gz` (Electrobun-native self-extracting bundle, `{channel}-linux-x64-RoadRavenSetup-{channel}.tar.gz`). macOS `.dmg` deferred to v1.1. Linux `.deb` deferred to v1.1 alongside GPG signing + apt repo.
    ```

    Replace PACK-02 line with:
    ```
    - [ ] **PACK-02**: Electrobun auto-updater configured for **stable channel only** in v1.0. `release.baseUrl` resolves the per-platform `{channel}-{os}-{arch}-update.json` manifest. Canary channel deferred to v1.1; tag pattern `v*-canary.*` reserved.
    ```

    Replace PACK-04 line with:
    ```
    - [ ] **PACK-04**: npm package `@roadraven/core` published with pre-built ESM + `.d.ts` in `dist/` and only `zod` as a runtime dependency (CI enforces dependency allowlist via `scripts/check-core-deps.ts`). `@roadraven/plugin-claude-code` also published at the same lockstep version. `@roadraven/react` deferred to v1.1 (currently a `export {};` stub; component extraction is its own phase). `react`, `react-dom`, `react-d3-tree` peer-dep externalization is moot in v1 since `@roadraven/react` is not published.
    ```

    PACK-03, PACK-05, PACK-06 lines stay unchanged.

    Also update `## Traceability` table line `| PACK-01 to PACK-06 | Phase 5 | Pending |` — leave as-is (already correct).

    **B. .planning/PROJECT.md — `## Requirements > Active` section, replace the existing Packaging line with:**
    ```
    - [ ] Packaging: Windows `.exe` (in `.zip`) + Linux `.tar.gz` (Electrobun-native self-extracting); Electrobun auto-updater (stable channel only); npm packages `@roadraven/core` and `@roadraven/plugin-claude-code` (lockstep versioned); plugin authoring guide; README polish; CONTRIBUTING.md; GitHub Pages docs site
    ```

    **C. .planning/PROJECT.md — `### Out of Scope` table, ADD these rows at the bottom (preserve existing rows):**

    Add as new table rows in the `## Requirements > Out of Scope` table:
    ```
    | macOS `.dmg` distribution in v1.0 | Apple Developer Program ($99/yr) + notarization tooling cost; deferred to v1.1 |
    | Linux `.deb` packaging in v1.0 | Electrobun-native `.tar.gz` ships instead; `.deb` wrapper deferred to v1.1 alongside GPG signing + apt repo |
    | Canary release channel in v1.0 | Stable channel only; canary deferred to v1.1 (tag pattern `v*-canary.*` reserved) |
    | `@roadraven/react` npm package in v1.0 | Currently `export {};`; React component extraction from `packages/desktop` is its own phase, deferred to v1.1+ |
    | Code signing for v1.0 (Windows Authenticode, Linux GPG, macOS notarization) | Document install warnings instead; defer signing until commercial pressure or user demand |
    ```

    **D. .planning/PROJECT.md — `## Constraints` section, replace the Licensing line:**

    Replace:
    ```
    - **Licensing:** MIT open source — published as `@roadmap-viewer/core` and `@roadmap-viewer/react` on npm
    ```

    With:
    ```
    - **Licensing:** MIT open source — `@roadraven/core` and `@roadraven/plugin-claude-code` published on npm in v1.0; `@roadraven/react` deferred to v1.1
    ```

    **E. .planning/ROADMAP.md — Phase 5 `**Goal:**` line, replace:**

    Current:
    ```
    **Goal:** Native installers build on all three platforms, and `@roadmap-viewer/core` + `@roadmap-viewer/react` are published to npm.
    ```

    Replace with:
    ```
    **Goal:** Native installers build for Windows (`.exe` in `.zip`) and Linux (`.tar.gz`), `@roadraven/core` + `@roadraven/plugin-claude-code` are published to npm at lockstep version with provenance, GitHub Pages docs site is live, and the accessibility audit pass + CONTRIBUTING.md + README polish complete the v1.0 surface.
    ```

    **F. .planning/ROADMAP.md — Phase 5 `**Done when:**` block, replace:**

    Current line: `- `bun run build:canary` produces `.dmg`, `.exe`, and `.deb` installers that install and launch cleanly`
    Replace with: `- `bun run build:stable` (or tag-triggered CI) produces Windows `.zip` containing `-Setup.exe` and Linux `.tar.gz` self-extracting bundle that install and launch cleanly`

    Current line: `- `@roadmap-viewer/core` and `@roadmap-viewer/react` install from npm in a clean project without peer-dep errors`
    Replace with: `- `@roadraven/core` and `@roadraven/plugin-claude-code` install from npm in a clean project; `@roadraven/core` exposes Zod schemas + types; `@roadraven/plugin-claude-code` runs as the `roadraven-mcp` binary`

    Current line: `- `packages/core` has no desktop dependencies (CI enforces this)`
    Leave unchanged.

    Current line: `- Auto-updater channels (canary / stable) are configured and the version channel resolves correctly`
    Replace with: `- Auto-updater stable channel manifest URL resolves to a real `{channel}-{os}-{arch}-update.json` after a tagged release; canary deferred to v1.1`
  </action>

  <verify>
    <automated>grep -c "@roadmap-viewer" .planning/REQUIREMENTS.md .planning/PROJECT.md .planning/ROADMAP.md  # MUST be 0:0:0</automated>
    <automated>grep -c "Linux \`.tar.gz\`" .planning/REQUIREMENTS.md  # MUST be >= 1</automated>
    <automated>grep -c "stable channel only" .planning/REQUIREMENTS.md  # MUST be >= 1</automated>
    <automated>grep -c "scripts/check-core-deps.ts" .planning/REQUIREMENTS.md  # MUST be >= 1</automated>
    <automated>grep -c "macOS \`.dmg\` distribution in v1.0" .planning/PROJECT.md  # MUST be >= 1</automated>
    <automated>grep -c "Linux \`.deb\` packaging in v1.0" .planning/PROJECT.md  # MUST be >= 1</automated>
  </verify>

  <acceptance_criteria>
    - .planning/REQUIREMENTS.md PACK-01 line contains the literal string "Linux `.tar.gz`" and does NOT contain "Ubuntu `.deb`" anywhere on the PACK-01 line
    - .planning/REQUIREMENTS.md PACK-02 line contains the literal string "stable channel only" and does NOT contain "canary + stable channels"
    - .planning/REQUIREMENTS.md PACK-04 line contains the literal string "@roadraven/core" and does NOT contain "@roadmap-viewer/" anywhere
    - .planning/REQUIREMENTS.md PACK-04 line contains the literal string "@roadraven/plugin-claude-code"
    - .planning/REQUIREMENTS.md PACK-04 line does NOT contain "@roadraven/react" as a publish target (may mention it as deferred)
    - .planning/PROJECT.md `## Out of Scope` table contains a row matching `^|.*macOS .dmg distribution in v1.0`
    - .planning/PROJECT.md `## Out of Scope` table contains a row matching `^|.*Linux .deb packaging in v1.0`
    - .planning/PROJECT.md `## Out of Scope` table contains a row matching `^|.*Canary release channel in v1.0`
    - .planning/PROJECT.md `## Out of Scope` table contains a row matching `^|.*@roadraven/react npm package in v1.0`
    - .planning/PROJECT.md `## Out of Scope` table contains a row matching `^|.*Code signing for v1.0`
    - .planning/PROJECT.md `## Constraints` Licensing line contains "@roadraven/core" and does NOT contain "@roadmap-viewer/"
    - .planning/ROADMAP.md Phase 5 Goal line contains "Windows (`.exe` in `.zip`)" and "Linux (`.tar.gz`)"
    - `grep -rn "@roadmap-viewer" .planning/` returns zero matches across REQUIREMENTS.md, PROJECT.md, ROADMAP.md (other history files may still contain the string — only these three are in scope)
  </acceptance_criteria>

  <done>
    All three planning files reflect the locked decisions D-05/D-08/D-11/D-14 + R-01. Every grep in `<verify>` returns the expected count. Subsequent waves can build against these requirement strings without grep-test surprises.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Create scripts/check-core-deps.ts + scripts/bump-version.ts + release-test scaffolding</name>

  <behavior>
    - check-core-deps.ts exits 0 when `packages/core/package.json` `dependencies` contains only `zod`; exits 1 when any other dep present
    - bump-version.ts called with `1.0.0` writes `version: "1.0.0"` to all four package.json files AND `electrobun.config.ts` `app.version`
    - bump-version.ts rejects invalid semver (e.g. "abc") with exit 1
    - tests/release/installer-artifacts.test.ts exists; expects glob `packages/desktop/artifacts/stable-{win-x64-RoadRaven-Setup,linux-x64-RoadRavenSetup}-stable.{zip,tar.gz}` (test SKIPS by default — only runs after a real `bunx electrobun build` produced artifacts/; uses `it.skip.if(!existsSync('packages/desktop/artifacts'))` pattern)
    - tests/release/core-exports.test.ts exists; imports from `../../packages/core/dist/index.js` and asserts the public exports present (test SKIPS if dist/ missing)
    - tests/release/requirements-edits.test.ts exists; greps `.planning/REQUIREMENTS.md` and `.planning/PROJECT.md` for stale strings — assertions: `@roadmap-viewer/` count is 0; `canary + stable channels` count is 0 in REQUIREMENTS.md; `Ubuntu \`.deb\`` count is 0 in PACK-01 line. This test runs UNCONDITIONALLY and gates the requirement edits.
    - tests/release/manifest-url.test.ts exists; SKIPS when `process.env.RR_TEST_MANIFEST_URL` is unset; otherwise curls the URL and asserts 200 + valid JSON shape
  </behavior>

  <read_first>
    - .planning/phases/05-packaging-distribution/05-RESEARCH.md `## Code Examples > scripts/check-core-deps.ts` (lines ~858-906) — copy the script body literally
    - .planning/phases/05-packaging-distribution/05-RESEARCH.md `## Architecture Patterns > Pattern 1: Lockstep Version Bumping` (lines ~255-303) — copy the bump-version.ts body literally
    - packages/core/package.json (current state — to verify allowlist behaves correctly when run today)
    - packages/desktop/electrobun.config.ts (regex target for version bump)
    - packages/desktop/vitest.config.ts (existing — to know test-runner conventions)
  </read_first>

  <files>
    scripts/check-core-deps.ts
    scripts/bump-version.ts
    tests/release/installer-artifacts.test.ts
    tests/release/core-exports.test.ts
    tests/release/requirements-edits.test.ts
    tests/release/manifest-url.test.ts
  </files>

  <action>
    **A. Create `scripts/check-core-deps.ts`** — copy this body LITERALLY from RESEARCH.md `## Code Examples > scripts/check-core-deps.ts`:

    ```typescript
    // scripts/check-core-deps.ts
    // Runs in CI as part of the lint job. Fails the job if packages/core/package.json
    // `dependencies` contains anything outside the allowlist.
    //
    // PACK-04 invariant: @roadraven/core has zero desktop dependencies.
    import { readFileSync } from "node:fs";

    const ALLOWLIST = new Set([
      "zod",
      // Add new entries here ONLY after explicit team review. Each addition
      // expands the runtime surface that downstream consumers (the Claude Code
      // MCP wrapper, future producers) take a transitive dep on.
    ]);

    const pkg = JSON.parse(
      readFileSync("packages/core/package.json", "utf8")
    ) as { dependencies?: Record<string, string> };

    const deps = Object.keys(pkg.dependencies ?? {});
    const violations = deps.filter((d) => !ALLOWLIST.has(d));

    if (violations.length > 0) {
      console.error(
        `packages/core/package.json has forbidden dependencies: ${violations.join(", ")}`
      );
      console.error(
        `Allowlist: ${[...ALLOWLIST].join(", ")}`
      );
      console.error(
        `If you need to add a dependency, edit ALLOWLIST in scripts/check-core-deps.ts and explain in the PR description.`
      );
      process.exit(1);
    }

    console.log(
      `✓ packages/core has ${deps.length} dependencies, all on the allowlist.`
    );
    ```

    **B. Create `scripts/bump-version.ts`** — copy this body LITERALLY from RESEARCH.md `## Architecture Patterns > Pattern 1`:

    ```typescript
    // scripts/bump-version.ts
    // Usage: bun scripts/bump-version.ts 1.0.0
    //
    // Lockstep version bump (D-04): writes the same `version` field to every
    // workspace package.json + the electrobun.config.ts app.version field.
    // Run from the repo root.
    import { readFileSync, writeFileSync } from "node:fs";

    const newVersion = process.argv[2];
    if (!newVersion?.match(/^\d+\.\d+\.\d+(-[a-z0-9.]+)?$/)) {
      console.error(`Invalid version: ${newVersion}. Expected semver e.g. 1.0.0`);
      process.exit(1);
    }

    const targets = [
      "packages/desktop/package.json",
      "packages/core/package.json",
      "packages/react/package.json",
      "plugins/claude-code/package.json",
    ];

    for (const path of targets) {
      const pkg = JSON.parse(readFileSync(path, "utf8")) as { version?: string };
      pkg.version = newVersion;
      writeFileSync(path, JSON.stringify(pkg, null, "\t") + "\n");
    }

    // Bump electrobun.config.ts app.version (string replace — small file, one match)
    const cfgPath = "packages/desktop/electrobun.config.ts";
    const cfg = readFileSync(cfgPath, "utf8");
    const updated = cfg.replace(
      /version:\s*"[^"]+"/,
      `version: "${newVersion}"`
    );
    writeFileSync(cfgPath, updated);

    console.log(`Bumped all packages + electrobun.config.ts to ${newVersion}`);
    console.log(`Next: git commit -am "release: v${newVersion}" && git tag v${newVersion} && git push --follow-tags`);
    ```

    **C. Create `tests/release/installer-artifacts.test.ts`** (uses vitest at root, since these are not desktop-package-internal tests). The test file body:

    ```typescript
    // tests/release/installer-artifacts.test.ts
    //
    // Wave-0 scaffolding (PACK-01 / R-01 / R-02). Asserts that after
    // `bunx electrobun build --env=stable` runs (locally or in CI), the
    // expected artifact files exist with the names Electrobun documents.
    //
    // SKIPS when packages/desktop/artifacts/ does not exist (i.e. local dev
    // without a fresh build). CI release workflow runs after the build, so the
    // dir will exist there.
    import { describe, it, expect } from "vitest";
    import { existsSync, readdirSync } from "node:fs";
    import { join } from "node:path";

    const ARTIFACTS_DIR = join(process.cwd(), "packages/desktop/artifacts");
    const hasArtifacts = existsSync(ARTIFACTS_DIR);

    describe.skipIf(!hasArtifacts)("Installer artifacts (PACK-01)", () => {
      it("Windows: produces stable-win-x64-RoadRaven-Setup-stable.zip", () => {
        const files = readdirSync(ARTIFACTS_DIR);
        const winInstaller = files.find((f) =>
          /^stable-win-x64-RoadRaven-Setup-stable\.zip$/.test(f)
        );
        expect(winInstaller, `Windows installer not found in ${files.join(", ")}`).toBeTruthy();
      });

      it("Windows: produces stable-win-x64-update.json (manifest)", () => {
        const files = readdirSync(ARTIFACTS_DIR);
        const winManifest = files.find((f) => /^stable-win-x64-update\.json$/.test(f));
        expect(winManifest, `Windows update manifest not found`).toBeTruthy();
      });

      it("Linux: produces stable-linux-x64-RoadRavenSetup-stable.tar.gz (per R-01, NOT .deb)", () => {
        const files = readdirSync(ARTIFACTS_DIR);
        const linuxInstaller = files.find((f) =>
          /^stable-linux-x64-RoadRavenSetup-stable\.tar\.gz$/.test(f)
        );
        expect(linuxInstaller, `Linux installer not found in ${files.join(", ")}`).toBeTruthy();

        // Assert .deb is NOT produced (R-01 guard against accidental dpkg-deb wrapping)
        const debFiles = files.filter((f) => f.endsWith(".deb"));
        expect(debFiles, `Unexpected .deb files: ${debFiles.join(", ")}`).toEqual([]);
      });

      it("Linux: produces stable-linux-x64-update.json (manifest)", () => {
        const files = readdirSync(ARTIFACTS_DIR);
        const linuxManifest = files.find((f) => /^stable-linux-x64-update\.json$/.test(f));
        expect(linuxManifest, `Linux update manifest not found`).toBeTruthy();
      });
    });
    ```

    **D. Create `tests/release/core-exports.test.ts`**:

    ```typescript
    // tests/release/core-exports.test.ts
    //
    // Wave-0 scaffolding (PACK-04). Asserts @roadraven/core's published shape:
    // import directly from packages/core/dist/index.js (the file npm tarball ships)
    // and verify the documented public exports are present.
    //
    // SKIPS when dist/ does not exist (i.e. before Wave 1 builds the package).
    import { describe, it, expect } from "vitest";
    import { existsSync } from "node:fs";
    import { join } from "node:path";

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
    ```

    **E. Create `tests/release/requirements-edits.test.ts`** (UNCONDITIONAL — runs always):

    ```typescript
    // tests/release/requirements-edits.test.ts
    //
    // Wave-0 scaffolding (D-05, D-08, D-11, R-01). Asserts the Phase 5
    // requirement edits landed and have not regressed. Runs in `bun run verify`
    // and CI on every push.
    import { describe, it, expect } from "vitest";
    import { readFileSync } from "node:fs";
    import { join } from "node:path";

    const REQUIREMENTS = readFileSync(
      join(process.cwd(), ".planning/REQUIREMENTS.md"),
      "utf8"
    );
    const PROJECT = readFileSync(
      join(process.cwd(), ".planning/PROJECT.md"),
      "utf8"
    );
    const ROADMAP = readFileSync(
      join(process.cwd(), ".planning/ROADMAP.md"),
      "utf8"
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
    ```

    **F. Create `tests/release/manifest-url.test.ts`** (gated on env var — runs only post-release):

    ```typescript
    // tests/release/manifest-url.test.ts
    //
    // Wave-0 scaffolding (PACK-02). Probes the auto-updater manifest URL
    // exposed via electrobun.config.ts release.baseUrl. SKIPS by default; the
    // release workflow sets RR_TEST_MANIFEST_URL after a successful release.
    //
    // Manual run: RR_TEST_MANIFEST_URL=https://github.com/Shuffzord/RoadRaven/releases/latest/download/stable-win-x64-update.json bun run --cwd . test:release
    import { describe, it, expect } from "vitest";

    const URL = process.env.RR_TEST_MANIFEST_URL;

    describe.skipIf(!URL)("Auto-updater manifest URL (PACK-02)", () => {
      it("resolves to a 200 response with valid JSON", async () => {
        const res = await fetch(URL!);
        expect(res.status, `Expected 200, got ${res.status}`).toBe(200);
        const body = (await res.json()) as Record<string, unknown>;
        // Loose shape: just assert it's an object with at least one expected field
        // (Electrobun manifest schema is undocumented — see RESEARCH.md A1)
        expect(typeof body).toBe("object");
        expect(body).not.toBeNull();
      });
    });
    ```

    Use `tabs` for indentation in test files (matches existing project style — `packages/desktop/package.json`, `tsconfig.json` all use tabs). Confirm by reading any existing test under `packages/desktop/tests/`.
  </action>

  <verify>
    <automated>bun run scripts/check-core-deps.ts  # MUST exit 0 (zod is on allowlist)</automated>
    <automated>bun scripts/bump-version.ts abc 2>&1 | grep -c "Invalid version"  # MUST be 1, then exit code is 1</automated>
    <automated>bunx vitest run tests/release/requirements-edits.test.ts  # MUST exit 0 (Task 1 already landed the edits)</automated>
    <automated>bunx vitest run tests/release/installer-artifacts.test.ts  # MUST exit 0 (skipped when artifacts/ absent)</automated>
    <automated>bunx vitest run tests/release/core-exports.test.ts  # MUST exit 0 (skipped when dist/ absent)</automated>
    <automated>bunx vitest run tests/release/manifest-url.test.ts  # MUST exit 0 (skipped when RR_TEST_MANIFEST_URL unset)</automated>
  </verify>

  <acceptance_criteria>
    - `scripts/check-core-deps.ts` file exists and contains literal string `const ALLOWLIST = new Set([` and literal string `"zod"`
    - `scripts/bump-version.ts` file exists and contains literal string `const targets = [` and literal string `"packages/desktop/electrobun.config.ts"` (or the regex replace block referencing `electrobun.config.ts`)
    - `bun run scripts/check-core-deps.ts` exits with code 0 today (because `packages/core/package.json` has only `zod` in deps)
    - `bun scripts/bump-version.ts 99.99.99` writes `"version": "99.99.99"` to all four package.json files. (After verifying, REVERT changes — `git checkout packages/desktop/package.json packages/core/package.json packages/react/package.json plugins/claude-code/package.json packages/desktop/electrobun.config.ts` — the test is destructive; treat as a smoke test)
    - `tests/release/installer-artifacts.test.ts` exists and contains literal regex string `^stable-linux-x64-RoadRavenSetup-stable\.tar\.gz$` AND assertion `debFiles).toEqual([])`
    - `tests/release/core-exports.test.ts` exists and imports from `packages/core/dist/index.js` and asserts `mod.RoadmapSchemaSchema` is defined
    - `tests/release/requirements-edits.test.ts` exists and contains 6+ `it(...)` cases asserting on REQUIREMENTS.md and PROJECT.md content
    - `tests/release/manifest-url.test.ts` exists and uses `describe.skipIf(!URL)` for env-gated execution
    - `bunx vitest run tests/release/` — installer-artifacts, core-exports, manifest-url SKIP; requirements-edits PASSES (6+ test cases, all green)
  </acceptance_criteria>

  <done>
    All scripts and test files exist. `bun run scripts/check-core-deps.ts` passes today. `bun scripts/bump-version.ts <semver>` smoke-tested and reverted. `bunx vitest run tests/release/` exits 0 with `requirements-edits.test.ts` green and the others skipped.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Install devDeps + create a11y harness scaffolding + .gitignore updates</name>

  <behavior>
    - `@axe-core/playwright@^4.11.3` present in workspace root `package.json` devDependencies
    - `tsup@^8.5.1` and `typescript@^6.0.2` present in `packages/core/package.json` devDependencies (typescript is repo-wide already; pinning per-package keeps publish consumers from a transitive resolution surprise)
    - `packages/desktop/tests/a11y/playwright.config.ts` exists with `webServer` running `bunx vite preview --port 4173 --strictPort` against `packages/desktop`
    - `packages/desktop/tests/a11y/audit.spec.ts` exists with at least one `AxeBuilder` test against the welcome screen
    - The a11y suite is a separate Playwright project so it does not conflict with the existing UI Playwright project (which uses port 5173 + Vite dev)
    - `.gitignore` excludes `packages/core/dist/` and `packages/desktop/artifacts/`
    - The a11y test SKIPS gracefully if `packages/desktop/dist/` does not exist (i.e. before `bun run --cwd packages/desktop build`)
  </behavior>

  <read_first>
    - .planning/phases/05-packaging-distribution/05-RESEARCH.md `## Architecture Patterns > Pattern 6` (lines ~664-727) — the audit.spec.ts body
    - packages/desktop/playwright.config.ts (existing — for project structure, devices, fullyParallel pattern)
    - .gitignore (current — to know what's already there; do not duplicate entries)
    - package.json (workspace root — devDependencies field)
    - packages/core/package.json (current state — devDependencies is empty/absent)
  </read_first>

  <files>
    package.json
    packages/core/package.json
    .gitignore
    packages/desktop/tests/a11y/playwright.config.ts
    packages/desktop/tests/a11y/audit.spec.ts
  </files>

  <action>
    **A. Add `@axe-core/playwright` to the WORKSPACE ROOT `package.json` devDependencies.**

    Open root `package.json`. If a `devDependencies` block exists, add `"@axe-core/playwright": "^4.11.3"`. If no `devDependencies` block exists, add one. Then run:

    ```bash
    bun install
    ```

    Confirm `node_modules/@axe-core/playwright/package.json` exists after install.

    **B. Add `tsup` + `typescript` to `packages/core/package.json` devDependencies.**

    Edit `packages/core/package.json`. Add a `devDependencies` field:

    ```json
    "devDependencies": {
      "tsup": "^8.5.1",
      "typescript": "^6.0.2"
    }
    ```

    Then `bun install` again so the workspace symlinks resolve.

    **C. Update `.gitignore`** — add lines (only if not present already):

    ```
    # Build artifacts (Phase 5)
    packages/core/dist/
    packages/desktop/artifacts/
    ```

    Read `.gitignore` first; only append the lines that are not already present. Use a clear `# Build artifacts (Phase 5)` comment as a section header.

    **D. Create `packages/desktop/tests/a11y/playwright.config.ts`:**

    ```typescript
    import { defineConfig, devices } from "@playwright/test";

    // Accessibility audit harness (PACK-06, R-04).
    // Drives @axe-core/playwright against `vite preview` on port 4173 — i.e.
    // the production-built renderer bundle that ships in the installer's
    // webview. Distinct from the main playwright.config.ts which uses port
    // 5173 + Vite dev for UI feature tests.
    //
    // PRE-CONDITION: `bun run --cwd packages/desktop build` must produce
    // packages/desktop/dist/ before this harness runs. CI release workflow
    // builds first; locally run `bun run --cwd packages/desktop build` once.
    export default defineConfig({
      testDir: "./",
      testMatch: "**/audit.spec.ts",
      fullyParallel: false, // single webServer; serialize for predictable axe output
      forbidOnly: !!process.env.CI,
      retries: process.env.CI ? 1 : 0,
      workers: 1,
      reporter: "list",

      use: {
        ...devices["Desktop Chrome"],
        baseURL: "http://localhost:4173",
      },

      webServer: {
        command: "bunx vite preview --port 4173 --strictPort",
        url: "http://localhost:4173",
        reuseExistingServer: !process.env.CI,
        timeout: 30000,
        cwd: "../..", // run from packages/desktop root
      },
    });
    ```

    **E. Create `packages/desktop/tests/a11y/audit.spec.ts`** — copy structurally from RESEARCH.md Pattern 6, adapted for current routes:

    ```typescript
    import { test, expect } from "@playwright/test";
    import AxeBuilder from "@axe-core/playwright";
    import { existsSync } from "node:fs";
    import { join } from "node:path";

    // Pre-condition: `bun run --cwd packages/desktop build` has produced
    // packages/desktop/dist/. Vite preview serves dist/ on port 4173.
    //
    // Pass criterion (D-20): zero severity-blocker findings (`critical` or `serious`
    // axe impacts). `moderate` and `minor` findings are tracked in 05-A11Y-AUDIT.md
    // but do not fail the gate.

    const DIST_DIR = join(process.cwd(), "dist");
    const hasDist = existsSync(DIST_DIR);

    test.skip(!hasDist, "packages/desktop/dist/ missing — run `bun run --cwd packages/desktop build` first");

    test.describe("Accessibility audit (production bundle)", () => {
      test("Welcome screen passes WCAG 2.1 AA (no critical/serious violations)", async ({ page }) => {
        await page.goto("/");
        // Wait for app shell to render — welcome screen has the [data-welcome] hook
        // (or fall back to body visibility if that selector doesn't exist yet).
        await page.waitForLoadState("networkidle");

        const results = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
          .analyze();

        const blockers = results.violations.filter(
          (v) => v.impact === "critical" || v.impact === "serious",
        );

        // Log moderate/minor for the audit doc, but do not fail
        const tracked = results.violations.filter(
          (v) => v.impact === "moderate" || v.impact === "minor",
        );
        if (tracked.length > 0) {
          console.warn(
            `axe: ${tracked.length} moderate/minor findings (tracked, non-blocking):`,
            tracked.map((v) => `${v.id} (${v.impact})`).join(", "),
          );
        }

        expect(
          blockers,
          `Severity-blocker accessibility violations:\n${JSON.stringify(blockers, null, 2)}`,
        ).toEqual([]);
      });
    });
    ```

    **F. Add `test:a11y` script to `packages/desktop/package.json`:**

    Add to the existing `scripts` object:
    ```json
    "test:a11y": "playwright test --config=tests/a11y/playwright.config.ts"
    ```
  </action>

  <verify>
    <automated>cat node_modules/@axe-core/playwright/package.json | grep version  # MUST print "version": "4.11.x"</automated>
    <automated>cat packages/core/package.json | grep -E "tsup|typescript"  # MUST find both in devDependencies block</automated>
    <automated>grep -c "packages/core/dist/" .gitignore  # MUST be 1</automated>
    <automated>grep -c "packages/desktop/artifacts/" .gitignore  # MUST be 1</automated>
    <automated>test -f packages/desktop/tests/a11y/playwright.config.ts && echo OK</automated>
    <automated>test -f packages/desktop/tests/a11y/audit.spec.ts && echo OK</automated>
    <automated>bun run --cwd packages/desktop test  # vitest unit tests must still pass (no regression from devDep additions)</automated>
  </verify>

  <acceptance_criteria>
    - `@axe-core/playwright` appears in workspace root `package.json` `devDependencies` with version `^4.11.3`
    - `node_modules/@axe-core/playwright/` directory exists after `bun install`
    - `packages/core/package.json` `devDependencies` contains both `tsup` (`^8.5.1`) and `typescript` (`^6.0.2`)
    - `.gitignore` contains the literal lines `packages/core/dist/` and `packages/desktop/artifacts/` (one per line, exact text)
    - `packages/desktop/tests/a11y/playwright.config.ts` exists, contains literal string `bunx vite preview --port 4173 --strictPort` and `testMatch: "**/audit.spec.ts"`
    - `packages/desktop/tests/a11y/audit.spec.ts` exists, contains literal string `AxeBuilder` and the impact filter `v.impact === "critical" || v.impact === "serious"`
    - `packages/desktop/package.json` `scripts` contains `"test:a11y": "playwright test --config=tests/a11y/playwright.config.ts"`
    - `bun run --cwd packages/desktop test` (existing vitest suite) still exits 0 — no regression
    - `bun run --cwd packages/desktop typecheck` exits 0 — no TS errors from the new files (note: a11y spec imports `@axe-core/playwright` which is at workspace root, must resolve via workspace hoisting)
  </acceptance_criteria>

  <done>
    All dev dependencies installed and resolvable. A11y harness scaffold in place but does not run automatically in `bun run verify` (Wave 3 plan wires it into a release-gate). `bunx vitest run` (existing suite) still passes. `bun run --cwd packages/desktop typecheck` clean.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Planning artifacts → CI grep tests | Stale strings in REQUIREMENTS.md/PROJECT.md silently re-introducing incorrect publish-target names (`@roadmap-viewer/`) would cascade into npm publish attempts under wrong names. Wave-0 grep test (T-05-04 mitigation) is the boundary. |
| `packages/core` dependency surface → published tarball | Adding any dep beyond `zod` expands the supply-chain surface for every downstream consumer (the Claude Code MCP wrapper, future producers). `scripts/check-core-deps.ts` is the boundary. |
| Lockstep version bump → 5 files | Hand-edit drift would publish mismatched versions (e.g., `@roadraven/core@1.0.1` referenced by `@roadraven/desktop@1.0.0`). `scripts/bump-version.ts` is the boundary. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-05-01 | Spoofing | npm scope `@roadraven/` | mitigate | Pre-flight check (Plan 05-03) confirms `@roadraven/core` and `@roadraven/plugin-claude-code` package names are unclaimed (or owned by user) BEFORE first release tag. This plan: rewrites PACK-04 to lock the canonical names in REQUIREMENTS.md so grep test (Task 2.E) catches regressions. |
| T-05-04 | Tampering | `@roadraven/core` runtime dependency surface | mitigate | `scripts/check-core-deps.ts` (Task 2.A) enforces `dependencies ⊆ {zod}`. CI integration in Plan 05-03 makes the check a PR gate. Adding any dep requires editing the ALLOWLIST set explicitly with PR review. |
| T-05-08 | Tampering | Path traversal in build output | accept | Electrobun owns the artifact paths; `packages/desktop/artifacts/` is a known-good directory. CI uses `if-no-files-found: error` (Plan 05-03) to fail loudly if Electrobun produces unexpected paths. No active mitigation needed in this scaffolding plan; the test in Task 2.C asserts on the exact expected filenames so an unexpected path would fail the assertion. |
</threat_model>

<verification>
After all three tasks land, run from repo root:

```bash
# Requirement edits
grep -rn "@roadmap-viewer" .planning/REQUIREMENTS.md .planning/PROJECT.md .planning/ROADMAP.md  # MUST be empty
grep -c "macOS \`.dmg\` distribution in v1.0" .planning/PROJECT.md  # MUST be 1

# Scripts
bun run scripts/check-core-deps.ts  # MUST exit 0 ("✓ packages/core has 1 dependencies, all on the allowlist.")
bun scripts/bump-version.ts xyz 2>&1 | grep "Invalid version"  # MUST find string

# Test scaffolding
bunx vitest run tests/release/requirements-edits.test.ts  # MUST be all green
bunx vitest run tests/release/                              # other tests skip cleanly

# Dependencies installed
test -d node_modules/@axe-core/playwright

# A11y harness present (does not run yet — needs Wave 1's build chain)
test -f packages/desktop/tests/a11y/audit.spec.ts
test -f packages/desktop/tests/a11y/playwright.config.ts

# .gitignore
grep -q "packages/core/dist/" .gitignore && grep -q "packages/desktop/artifacts/" .gitignore

# Existing tests still pass
bun run --cwd packages/desktop test  # MUST exit 0
bun run --cwd packages/desktop typecheck  # MUST exit 0
```
</verification>

<success_criteria>
- All three planning files (`REQUIREMENTS.md`, `PROJECT.md`, `ROADMAP.md`) reflect locked decisions D-05/D-08/D-11/R-01
- `tests/release/requirements-edits.test.ts` is green and runs unconditionally in `bunx vitest run`
- `scripts/check-core-deps.ts` runs locally and returns exit 0 (allowlist OK)
- `scripts/bump-version.ts` rejects invalid semver and accepts valid (smoke-tested + reverted)
- `@axe-core/playwright`, `tsup`, `typescript` installed and resolvable
- A11y harness scaffolded but does not run in main `bun run verify` chain (Wave 3 wires it)
- `.gitignore` excludes future-generated `dist/` and `artifacts/`
- `bun run --cwd packages/desktop test` (existing suite) still passes — no regression
</success_criteria>

<output>
After completion, create `.planning/phases/05-packaging-distribution/05-01-SUMMARY.md` describing:
- Which planning files were edited (REQUIREMENTS, PROJECT, ROADMAP) and the exact rewrites
- The 6 new files (2 scripts + 4 release tests) + the 2 a11y harness files
- The dev dependencies added and their versions
- The grep-test results from `<verification>`
</output>
