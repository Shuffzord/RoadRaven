---
phase: 05-packaging-distribution
plan: 03
type: execute
wave: 2
depends_on: ["05-01", "05-02"]
files_modified:
  - .github/workflows/release.yml
  - .github/workflows/ci.yml
  - packages/desktop/package.json
  - packages/desktop/electrobun.config.ts
  - .planning/phases/05-packaging-distribution/05-RELEASE-OPS.md
autonomous: true
requirements: [PACK-01, PACK-02, PACK-03, PACK-04]
threats: [T-05-02, T-05-04, T-05-05, T-05-07, T-05-09]
tags: [packaging, ci-cd, github-actions, release-automation]

must_haves:
  truths:
    - ".github/workflows/release.yml exists and triggers on `v*` tag push"
    - "Workflow builds Windows installer (.zip containing -Setup.exe) and Linux installer (.tar.gz) per R-01/R-02"
    - "Workflow publishes @roadraven/core and @roadraven/plugin-claude-code to npm with provenance via OIDC trusted publishing (R-03)"
    - "Workflow has `permissions: id-token: write, contents: write` at workflow scope (NO NPM_TOKEN secret reference anywhere)"
    - "Workflow attaches all installers + update manifests to a GitHub Release (idempotent re-runnable)"
    - "ci.yml gains a step that runs `bun run scripts/check-core-deps.ts` in the lint job (D-23)"
    - "ci.yml gains a step that runs the requirements-edits grep test on every push"
    - "packages/desktop/electrobun.config.ts gains `release.baseUrl` pointing at GitHub Releases /latest/download (Strategy A from RESEARCH.md Pattern 5)"
    - "packages/desktop/package.json gains a `build:stable` script (mirrors build:canary)"
    - "RELEASE-OPS.md exists documenting the one-time npmjs.com Trusted Publishers setup + pre-flight package-name availability check"
    - "fallow CI gate stays commented (D-22 invariant)"
  artifacts:
    - path: ".github/workflows/release.yml"
      provides: "Tag-triggered release pipeline (Windows + Linux installers + npm publish + GH Pages — Pages job in this plan; docs site CONTENT in Plan 04)"
      contains: "permissions:\\n  id-token: write"
    - path: ".github/workflows/ci.yml"
      provides: "Existing PR gate + new core-deps allowlist + requirements-edits invariants"
      contains: "scripts/check-core-deps.ts"
    - path: "packages/desktop/electrobun.config.ts"
      provides: "release.baseUrl for auto-updater"
      contains: "release:"
    - path: "packages/desktop/package.json"
      provides: "build:stable script alongside build:canary"
      contains: "\"build:stable\":"
    - path: ".planning/phases/05-packaging-distribution/05-RELEASE-OPS.md"
      provides: "One-time setup checklist for the user (npmjs.com OIDC, package name pre-flight, repo settings)"
      contains: "Trusted Publishers"
  key_links:
    - from: ".github/workflows/release.yml `publish-npm-core` job"
      to: "npmjs.com OIDC trusted publishers config"
      via: "permissions.id-token: write + npm publish --provenance"
      pattern: "id-token:\\s*write"
    - from: ".github/workflows/release.yml `build-windows` + `build-linux` jobs"
      to: "Wave-0 tests/release/installer-artifacts.test.ts"
      via: "actions/upload-artifact (artifact glob matches the test's regex assertions)"
      pattern: "stable-(win|linux)-x64"
    - from: ".github/workflows/ci.yml lint job"
      to: "scripts/check-core-deps.ts (Wave 0)"
      via: "bun run scripts/check-core-deps.ts step"
      pattern: "check-core-deps"
    - from: ".github/workflows/ci.yml NEW invariants job"
      to: "tests/release/requirements-edits.test.ts (Wave 0)"
      via: "bunx vitest run tests/release/requirements-edits.test.ts step"
      pattern: "requirements-edits"
    - from: "packages/desktop/electrobun.config.ts release.baseUrl"
      to: "GitHub Releases /latest/download/{channel}-{os}-{arch}-update.json"
      via: "Electrobun Updater HTTP poll"
      pattern: "github\\.com/Shuffzord/RoadRaven/releases/latest/download"
---

<objective>
Wire the release pipeline. After this plan ships, pushing a `v*` tag triggers a
GitHub Actions workflow that:

1. Builds Windows + Linux installers via `electrobun build --env=stable`
2. Attaches installers + auto-updater manifests to a GitHub Release
3. Publishes `@roadraven/core` and `@roadraven/plugin-claude-code` to npm with
   provenance via OIDC trusted publishing (R-03 — NO `NPM_TOKEN` secret)

This plan also lands the CI invariants: the `packages/core` zero-desktop-deps
allowlist gate (D-23) and the requirements-edits grep gate (Wave-0 derivative).

The actual GitHub Pages docs site CONTENT is built in Plan 05-04 (parallel
wave). The Pages DEPLOY JOB lives in this `release.yml` so docs ship in lockstep
with installer/npm releases.

Per CLAUDE.md: `npm publish` is the explicit single exception to the bun-only
rule, justified by first-class provenance support. The workflow comments this
exception inline so contributors don't read it as a CLAUDE.md violation.

Per D-22: the fallow CI gate stays commented.

Output:
- `.github/workflows/release.yml` (NEW) — tag-triggered, 5 jobs (build-windows, build-linux, github-release, publish-npm-core, publish-npm-mcp); deploy-docs job is added in Plan 05-04
- `.github/workflows/ci.yml` (MODIFIED) — adds 2 verification steps to the lint job
- `packages/desktop/electrobun.config.ts` (MODIFIED) — adds release.baseUrl
- `packages/desktop/package.json` (MODIFIED) — adds build:stable script
- `.planning/phases/05-packaging-distribution/05-RELEASE-OPS.md` (NEW) — operational checklist for the human
</objective>

<execution_context>
@C:\Work\RoadRaven\.claude\get-shit-done\workflows\execute-plan.md
@C:\Work\RoadRaven\.claude\get-shit-done\templates\summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/REQUIREMENTS.md
@.planning/phases/05-packaging-distribution/05-CONTEXT.md
@.planning/phases/05-packaging-distribution/05-RESEARCH.md
@.planning/phases/05-packaging-distribution/05-VALIDATION.md
@.planning/phases/05-packaging-distribution/05-01-WAVE-0-SCAFFOLDING.md
@.planning/phases/05-packaging-distribution/05-02-NPM-PACKAGES.md
@.github/workflows/ci.yml
@packages/desktop/electrobun.config.ts
@packages/desktop/package.json

<interfaces>
<!-- TARGET shape for release.yml — copy from RESEARCH.md Pattern 3 (lines 385-531) -->
<!-- Note: deploy-docs job is added by Plan 05-04 (parallel wave) — do not include it here -->

<!-- Existing ci.yml jobs (DO NOT MODIFY): -->
<!--   - lint: bunx @biomejs/biome check --diagnostic-level=error . -->
<!--   - typecheck: bunx tsc --noEmit (cwd packages/desktop) -->
<!--   - test: bunx vitest run (cwd packages/desktop) -->
<!--   - fallow: COMMENTED (D-22 invariant — leave as-is) -->

<!-- Existing electrobun.config.ts (current shape — verified 2026-05-03): -->
<!--   { app: { name, identifier, version }, build: { copy, watchIgnore, mac, linux, win } } -->
<!-- Adding: release: { baseUrl: "..." } -->

<!-- Existing packages/desktop/package.json scripts (DO NOT REMOVE): -->
<!--   start, dev, dev:hmr, dev:bun, hmr, build:canary, test, test:bun, test:file, test:e2e, typecheck, build -->
<!-- Adding: build:stable (mirrors build:canary), test:release (vitest tests/release/) -->

<!-- npm CLI version requirement: provenance needs npm >= 9.5.0 -->
<!-- actions/setup-node@v4 with node-version 22 ships npm 10+ — satisfies. -->

<!-- OIDC permissions REQUIRED at workflow level: -->
<!--   permissions: { contents: write, id-token: write } -->
<!-- Without id-token: write, OIDC token mint fails with "OIDC token verification failed" -->
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create .github/workflows/release.yml + augment electrobun.config.ts + packages/desktop/package.json</name>

  <read_first>
    - .planning/phases/05-packaging-distribution/05-RESEARCH.md `## Architecture Patterns > Pattern 3` (lines ~377-549) — copy the workflow YAML LITERALLY for build-windows, build-linux, github-release, publish-npm-core, publish-npm-mcp jobs. STRIP the deploy-docs job (Plan 05-04 owns it).
    - .planning/phases/05-packaging-distribution/05-RESEARCH.md `## Architecture Patterns > Pattern 5` (lines ~618-662) — release.baseUrl strategy A (GitHub Releases /latest/download)
    - .planning/phases/05-packaging-distribution/05-RESEARCH.md `## Code Examples > packages/desktop/electrobun.config.ts (MODIFIED)` (lines ~908-935) — copy literally
    - .planning/phases/05-packaging-distribution/05-RESEARCH.md `## Code Examples > packages/desktop/package.json (MODIFIED — add build:stable)` (lines ~937-946)
    - .planning/phases/05-packaging-distribution/05-RESEARCH.md `## Common Pitfalls > Pitfall 1` (bunx npm publish trap — must use `npm publish` directly after setup-node)
    - .planning/phases/05-packaging-distribution/05-RESEARCH.md `## Common Pitfalls > Pitfall 2` (Electrobun CLI binary download on first CI run — informational, may add cache step as a polish)
    - .github/workflows/ci.yml (existing reference for setup-bun, cache, install steps)
    - packages/desktop/electrobun.config.ts (current shape — adding release block)
    - packages/desktop/package.json (current shape — adding build:stable)
  </read_first>

  <files>
    .github/workflows/release.yml
    packages/desktop/electrobun.config.ts
    packages/desktop/package.json
  </files>

  <action>
    **A. Create `.github/workflows/release.yml`** — copy LITERALLY from RESEARCH.md Pattern 3, MINUS the `deploy-docs` job (which Plan 05-04 adds). The result:

    ```yaml
    name: Release

    on:
      push:
        tags:
          - 'v*'    # Stable: v1.0.0, v1.0.1, v1.1.0
                    # (Reserved for v1.1: 'v*-canary.*' — out of scope this phase)

    # All jobs that publish or upload need explicit permissions (least-privilege).
    # id-token: write — required for npm provenance OIDC token mint (R-03)
    # contents: write — required for gh release create + asset upload
    permissions:
      contents: write
      id-token: write

    jobs:
      build-windows:
        name: Build Windows installer
        runs-on: windows-latest
        steps:
          - uses: actions/checkout@v4
          - uses: oven-sh/setup-bun@v2
            with:
              bun-version: latest
          - name: Cache bun deps
            uses: actions/cache@v4
            with:
              path: ~/.bun/install/cache
              key: ${{ runner.os }}-bun-${{ hashFiles('**/bun.lock') }}
          - name: Install workspace dependencies
            run: bun install
          - name: Build webview bundle (vite build → packages/desktop/dist)
            run: bun run --cwd packages/desktop build
          - name: Build Windows installer (stable channel)
            # Produces: packages/desktop/artifacts/stable-win-x64-RoadRaven-Setup-stable.zip
            #           packages/desktop/artifacts/stable-win-x64-update.json
            #           packages/desktop/artifacts/stable-win-x64-*.tar.zst
            run: bunx electrobun build --env=stable
            working-directory: packages/desktop
          - name: Smoke-test installer artifact naming
            # Wave-0 test from Plan 05-01 — asserts artifact names match Pattern R-02
            run: bunx vitest run tests/release/installer-artifacts.test.ts
          - name: Upload installer + update manifest
            uses: actions/upload-artifact@v4
            with:
              name: windows-installer
              path: |
                packages/desktop/artifacts/stable-win-x64-*.zip
                packages/desktop/artifacts/stable-win-x64-update.json
                packages/desktop/artifacts/stable-win-x64-*.tar.zst
              if-no-files-found: error

      build-linux:
        name: Build Linux installer
        runs-on: ubuntu-latest
        steps:
          - uses: actions/checkout@v4
          - uses: oven-sh/setup-bun@v2
            with:
              bun-version: latest
          - name: Cache bun deps
            uses: actions/cache@v4
            with:
              path: ~/.bun/install/cache
              key: ${{ runner.os }}-bun-${{ hashFiles('**/bun.lock') }}
          - name: Install workspace dependencies
            run: bun install
          - name: Build webview bundle (vite build → packages/desktop/dist)
            run: bun run --cwd packages/desktop build
          - name: Build Linux installer (stable channel)
            # Produces: packages/desktop/artifacts/stable-linux-x64-RoadRavenSetup-stable.tar.gz
            #           packages/desktop/artifacts/stable-linux-x64-update.json
            #           packages/desktop/artifacts/stable-linux-x64-*.tar.zst
            # NOTE per R-01: Electrobun ships .tar.gz, NOT .deb. Wave-0 test asserts no .deb.
            run: bunx electrobun build --env=stable
            working-directory: packages/desktop
          - name: Smoke-test installer artifact naming + .deb absence
            run: bunx vitest run tests/release/installer-artifacts.test.ts
          - name: Upload installer + update manifest
            uses: actions/upload-artifact@v4
            with:
              name: linux-installer
              path: |
                packages/desktop/artifacts/stable-linux-x64-*.tar.gz
                packages/desktop/artifacts/stable-linux-x64-update.json
                packages/desktop/artifacts/stable-linux-x64-*.tar.zst
              if-no-files-found: error

      github-release:
        name: Create GitHub Release with installers
        needs: [build-windows, build-linux]
        runs-on: ubuntu-latest
        steps:
          - uses: actions/download-artifact@v4
            with:
              path: artifacts
              merge-multiple: true
          - name: Create release and attach artifacts
            uses: softprops/action-gh-release@v2
            with:
              files: artifacts/**
              draft: false
              prerelease: false
              generate_release_notes: true
            env:
              GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      publish-npm-core:
        name: Publish @roadraven/core to npm
        needs: [build-windows, build-linux]
        runs-on: ubuntu-latest
        steps:
          - uses: actions/checkout@v4
          - uses: oven-sh/setup-bun@v2
            with:
              bun-version: latest
          - uses: actions/setup-node@v4
            with:
              node-version: '22'
              registry-url: 'https://registry.npmjs.org'
          - name: Install workspace dependencies
            run: bun install
          - name: Build @roadraven/core (tsup → dist/)
            run: bun run --cwd packages/core build
          # CLAUDE.md exception: `npm publish` is the only authorized npm CLI usage.
          # Bun's publish lacks first-class provenance support; npm CLI is the registry
          # client with mature OIDC trusted-publishing integration (R-03). Using `bunx
          # npm publish` defeats the OIDC env wiring that actions/setup-node provides
          # (RESEARCH.md Pitfall 1). Use `npm publish` directly.
          - name: Publish @roadraven/core to npm with provenance (OIDC)
            run: npm publish --access public --provenance
            working-directory: packages/core

      publish-npm-mcp:
        name: Publish @roadraven/plugin-claude-code to npm
        needs: [build-windows, build-linux]
        runs-on: ubuntu-latest
        steps:
          - uses: actions/checkout@v4
          - uses: oven-sh/setup-bun@v2
            with:
              bun-version: latest
          - uses: actions/setup-node@v4
            with:
              node-version: '22'
              registry-url: 'https://registry.npmjs.org'
          - name: Install workspace dependencies
            run: bun install
          - name: Build @roadraven/plugin-claude-code (bun build → dist/)
            run: bun run --cwd plugins/claude-code build
          # Same CLAUDE.md exception as publish-npm-core above.
          - name: Publish @roadraven/plugin-claude-code to npm with provenance (OIDC)
            run: npm publish --access public --provenance
            working-directory: plugins/claude-code
    ```

    Note the integration of the Wave-0 `installer-artifacts.test.ts` into the build jobs as a smoke-test step. This makes the Wave-0 test do real work in CI, not just sit dormant.

    **B. Modify `packages/desktop/electrobun.config.ts`** — add `release` block (preserve everything else, including the `bundleCEF` env var pattern and the `app.identifier` per R-05):

    ```typescript
    import type { ElectrobunConfig } from "electrobun";

    // Default: CEF (Chromium) on all platforms — consistent rendering, avoids WebKitGTK bugs.
    // Override locally: set ROADRAVEN_RENDERER=webkit in .env.local to use native WebKit.
    const bundleCEF = process.env.ROADRAVEN_RENDERER !== "webkit";

    export default {
    	app: {
    		name: "RoadRaven",
    		identifier: "RoadRaven.electrobun.dev",  // R-05: keep unchanged for v1.0
    		version: "0.0.1",                         // bumped per release via scripts/bump-version.ts
    	},
    	build: {
    		copy: {
    			"dist/index.html": "views/mainview/index.html",
    			"dist/assets": "views/mainview/assets",
    		},
    		watchIgnore: ["dist/**"],
    		mac: { bundleCEF },
    		linux: { bundleCEF },
    		win: { bundleCEF },
    	},
    	release: {
    		// Strategy A from RESEARCH.md Pattern 5 — GitHub Releases /latest/download
    		// always resolves to the most recent non-prerelease Release (D-10: stable only).
    		// v1.1 canary work will switch to a gh-pages-hosted manifest folder.
    		baseUrl: "https://github.com/Shuffzord/RoadRaven/releases/latest/download",
    	},
    } satisfies ElectrobunConfig;
    ```

    Use TABS for indentation (matches current file style — confirmed in current `electrobun.config.ts`).

    **C. Modify `packages/desktop/package.json`** — add `build:stable` and `test:release` scripts. Preserve all existing scripts.

    Find the existing `scripts` block and add these two entries:

    ```json
    "build:stable": "vite build && electrobun build --env=stable",
    "test:release": "vitest run --root . --dir ../../tests/release"
    ```

    Order: place `build:stable` IMMEDIATELY after `build:canary`, and `test:release` after `test:e2e`. Do not remove or modify existing scripts.

    **D. Smoke-test the new build script locally:**

    ```bash
    # Confirms the script wiring works (does not actually run electrobun build —
    # that takes minutes and downloads the Electrobun CLI binary).
    bun run --cwd packages/desktop --silent | grep -E "build:stable"
    ```

    Or just run `cat packages/desktop/package.json | grep build:stable` to confirm the line is present.
  </action>

  <verify>
    <automated>test -f .github/workflows/release.yml && echo OK</automated>
    <automated>grep -c "id-token: write" .github/workflows/release.yml  # MUST be >= 1 (workflow-level permissions)</automated>
    <automated>grep -c "NPM_TOKEN" .github/workflows/release.yml  # MUST be 0 — OIDC, no token</automated>
    <automated>grep -c "npm publish --access public --provenance" .github/workflows/release.yml  # MUST be 2 (core + mcp)</automated>
    <automated>grep -c "bunx electrobun build --env=stable" .github/workflows/release.yml  # MUST be 2 (windows + linux)</automated>
    <automated>grep -c "bunx vitest run tests/release/installer-artifacts.test.ts" .github/workflows/release.yml  # MUST be 2 (smoke-test in each build job)</automated>
    <automated>grep -c "softprops/action-gh-release@v2" .github/workflows/release.yml  # MUST be 1</automated>
    <automated>grep -c "stable-linux-x64-\*.tar.gz" .github/workflows/release.yml  # MUST be >= 1 (R-01)</automated>
    <automated>grep -c "stable-win-x64-\*.zip" .github/workflows/release.yml  # MUST be >= 1 (R-02)</automated>
    <automated>grep -c "release.baseUrl" packages/desktop/electrobun.config.ts || grep -c "baseUrl:" packages/desktop/electrobun.config.ts  # MUST be >= 1</automated>
    <automated>grep -c "github.com/Shuffzord/RoadRaven/releases/latest/download" packages/desktop/electrobun.config.ts  # MUST be 1</automated>
    <automated>grep -c "RoadRaven.electrobun.dev" packages/desktop/electrobun.config.ts  # MUST be 1 (R-05 unchanged)</automated>
    <automated>cat packages/desktop/package.json | grep -c "\"build:stable\":"  # MUST be 1</automated>
    <automated>bunx tsc --noEmit -p packages/desktop  # MUST exit 0 (electrobun.config.ts type-checks against ElectrobunConfig)</automated>
  </verify>

  <acceptance_criteria>
    - `.github/workflows/release.yml` exists at the literal path
    - `.github/workflows/release.yml` contains `on:\n  push:\n    tags:\n      - 'v*'` trigger (or equivalent YAML structure)
    - `.github/workflows/release.yml` workflow-level `permissions` block contains `id-token: write` AND `contents: write`
    - `.github/workflows/release.yml` does NOT contain the literal string `NPM_TOKEN` anywhere (R-03 — OIDC trusted publishing)
    - `.github/workflows/release.yml` does NOT contain `bunx npm publish` (Pitfall 1 — must be `npm publish` directly)
    - `.github/workflows/release.yml` contains TWO `npm publish --access public --provenance` invocations (one in publish-npm-core, one in publish-npm-mcp)
    - `.github/workflows/release.yml` `build-linux` job's upload-artifact step `path` includes `stable-linux-x64-*.tar.gz` (R-01) and does NOT include `*.deb`
    - `.github/workflows/release.yml` `build-windows` job's upload-artifact step `path` includes `stable-win-x64-*.zip` (R-02)
    - `.github/workflows/release.yml` contains a comment block referencing CLAUDE.md exception for `npm publish` (must reference "CLAUDE.md" or "npm CLI" exception)
    - `.github/workflows/release.yml` contains `if-no-files-found: error` on both upload-artifact steps (T-05-09 mitigation)
    - `.github/workflows/release.yml` contains `bunx vitest run tests/release/installer-artifacts.test.ts` step in BOTH build jobs (Wave-0 test integrated as build smoke)
    - `packages/desktop/electrobun.config.ts` contains `release: {` block with `baseUrl: "https://github.com/Shuffzord/RoadRaven/releases/latest/download"`
    - `packages/desktop/electrobun.config.ts` `app.identifier` is unchanged (`"RoadRaven.electrobun.dev"` — R-05 invariant)
    - `packages/desktop/package.json` `scripts` contains `"build:stable": "vite build && electrobun build --env=stable"` (mirrors build:canary structure)
    - `bunx tsc --noEmit` in `packages/desktop` exits 0 — `release` field accepted by `ElectrobunConfig` type
  </acceptance_criteria>

  <done>
    Release workflow exists, electrobun.config.ts has release.baseUrl, build:stable script available. Workflow does NOT yet trigger because no `v*` tag has been pushed — Plan 05-05 (or post-phase action) handles the first tag.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Augment .github/workflows/ci.yml with core-deps allowlist + requirements-edits invariants</name>

  <behavior>
    - ci.yml `lint` job gains a step that runs `bun run scripts/check-core-deps.ts` AFTER `bun install`
    - ci.yml gains a NEW job named `invariants` that runs `bunx vitest run tests/release/requirements-edits.test.ts` on every PR + push to master
    - The new `invariants` job follows the existing job pattern (setup-bun, cache, bun install, then vitest)
    - The fallow CI gate stays commented (D-22 invariant — DO NOT uncomment)
    - Existing jobs (lint, typecheck, test) are PRESERVED (no behavior changes other than the lint addition)
    - All four jobs run in parallel (no `needs:` between them — they're all PR-time gates)
    - Both new gates fail loud: `check-core-deps.ts` exit 1 fails the lint job; `requirements-edits.test.ts` failures fail the invariants job
  </behavior>

  <read_first>
    - .github/workflows/ci.yml (current state — verified Phase 4)
    - scripts/check-core-deps.ts (Wave 0 — confirm exit-code behavior)
    - tests/release/requirements-edits.test.ts (Wave 0 — confirm runs unconditionally)
    - .planning/phases/05-packaging-distribution/05-CONTEXT.md D-22 (fallow stays commented) and D-23 (allowlist required)
    - .planning/phases/05-packaging-distribution/05-RESEARCH.md `## Code Examples > scripts/check-core-deps.ts` "CI integration" snippet (lines ~900-906)
  </read_first>

  <files>
    .github/workflows/ci.yml
  </files>

  <action>
    Edit `.github/workflows/ci.yml`. PRESERVE the existing 3 jobs (lint, typecheck, test) and the commented `fallow` block. Make TWO changes:

    **A. In the `lint` job, ADD a new step AFTER `bun install` and BEFORE the existing biome step:**

    ```yaml
          - name: Verify @roadraven/core dependency allowlist (D-23, T-05-04)
            run: bun run scripts/check-core-deps.ts
    ```

    The lint job after edit looks like:

    ```yaml
      lint:
        name: Lint
        runs-on: ubuntu-latest
        steps:
          - uses: actions/checkout@v4
          - uses: oven-sh/setup-bun@v2
            with:
              bun-version: latest
          - uses: actions/cache@v4
            with:
              path: ~/.bun/install/cache
              key: ${{ runner.os }}-bun-${{ hashFiles('**/bun.lock') }}
          - run: bun install
          - name: Verify @roadraven/core dependency allowlist (D-23, T-05-04)
            run: bun run scripts/check-core-deps.ts
          - run: bunx @biomejs/biome check --diagnostic-level=error .
    ```

    **B. ADD a new job named `invariants` AFTER the `test:` job and BEFORE the commented `fallow:` block:**

    ```yaml
      invariants:
        name: Planning Invariants (PACK-01..PACK-04 edits, D-05/D-08/D-11/R-01)
        runs-on: ubuntu-latest
        steps:
          - uses: actions/checkout@v4
          - uses: oven-sh/setup-bun@v2
            with:
              bun-version: latest
          - uses: actions/cache@v4
            with:
              path: ~/.bun/install/cache
              key: ${{ runner.os }}-bun-${{ hashFiles('**/bun.lock') }}
          - run: bun install
          - name: Verify REQUIREMENTS.md / PROJECT.md / ROADMAP.md edits did not regress
            run: bunx vitest run tests/release/requirements-edits.test.ts
    ```

    Confirm the `fallow:` block remains commented (do NOT uncomment per D-22).

    **C. Verify locally before committing:**

    ```bash
    bun run scripts/check-core-deps.ts  # MUST exit 0 today
    bunx vitest run tests/release/requirements-edits.test.ts  # MUST pass today (post-Plan-01 land)
    ```
  </action>

  <verify>
    <automated>grep -c "scripts/check-core-deps.ts" .github/workflows/ci.yml  # MUST be 1 (just the new lint step)</automated>
    <automated>grep -c "tests/release/requirements-edits.test.ts" .github/workflows/ci.yml  # MUST be 1</automated>
    <automated>grep -cE "^\s*invariants:" .github/workflows/ci.yml  # MUST be 1 (new job header)</automated>
    <automated>grep -cE "^\s*#\s*fallow:" .github/workflows/ci.yml  # MUST be 1 (still commented per D-22)</automated>
    <automated>grep -cE "^\s*lint:" .github/workflows/ci.yml  # MUST be 1 (preserved)</automated>
    <automated>grep -cE "^\s*typecheck:" .github/workflows/ci.yml  # MUST be 1 (preserved)</automated>
    <automated>grep -cE "^\s*test:" .github/workflows/ci.yml  # MUST be 1 (preserved)</automated>
    <automated>bun run scripts/check-core-deps.ts  # MUST exit 0 (gate is satisfied today)</automated>
    <automated>bunx vitest run tests/release/requirements-edits.test.ts  # MUST exit 0 (gate is satisfied today)</automated>
  </verify>

  <acceptance_criteria>
    - `.github/workflows/ci.yml` `lint` job contains the literal step `run: bun run scripts/check-core-deps.ts` AFTER `bun install` and BEFORE the biome step
    - `.github/workflows/ci.yml` contains a new top-level job named `invariants:` (4 jobs total now: lint, typecheck, test, invariants)
    - `.github/workflows/ci.yml` `invariants` job contains the literal step `run: bunx vitest run tests/release/requirements-edits.test.ts`
    - `.github/workflows/ci.yml` fallow block is STILL commented out (D-22 — `^# fallow:` or `^#   fallow:` matches)
    - `.github/workflows/ci.yml` existing 3 jobs (lint, typecheck, test) preserved; no removed steps
    - Running `bun run scripts/check-core-deps.ts` locally exits 0 today (allowlist satisfied)
    - Running `bunx vitest run tests/release/requirements-edits.test.ts` locally exits 0 today (Plan 05-01 already landed the edits)
    - Running `bunx @biomejs/biome check --diagnostic-level=error .` still exits 0 (existing lint gate did not break)
  </acceptance_criteria>

  <done>
    CI now enforces both invariants on every PR + master push. Future regressions (e.g., someone adding a dep to packages/core, or someone re-introducing `@roadmap-viewer/` text) fail CI.
  </done>
</task>

<task type="auto">
  <name>Task 3: Create RELEASE-OPS.md (one-time setup checklist for the human)</name>

  <read_first>
    - .planning/phases/05-packaging-distribution/05-CONTEXT.md `<reconciliation>` R-03 (npm OIDC setup)
    - .planning/phases/05-packaging-distribution/05-RESEARCH.md `## Architecture Patterns > Pattern 3` "One-time setup the user must do at npmjs.com" (lines ~541-548)
    - .planning/phases/05-packaging-distribution/05-RESEARCH.md `## Common Pitfalls > Pitfall 4` (GitHub Pages settings flip — also a one-time human step)
  </read_first>

  <files>
    .planning/phases/05-packaging-distribution/05-RELEASE-OPS.md
  </files>

  <action>
    Create `.planning/phases/05-packaging-distribution/05-RELEASE-OPS.md` with this exact content:

    ```markdown
    # Phase 5 Release Operations Checklist

    **Audience:** The human shipping v1.0.
    **Status:** One-time setup BEFORE the first release tag is pushed.

    > Per R-03: this project uses npm OIDC trusted publishing — there is **no
    > `NPM_TOKEN` repo secret to manage**. The trade-off is a one-time setup at
    > npmjs.com (per package). Per R-04 + Pitfall 4: GitHub Pages source must be
    > flipped to "GitHub Actions" once via repo Settings.

    ---

    ## A. Pre-flight: confirm npm package names are available

    BEFORE pushing the first `v*` tag, verify the canonical names are unclaimed
    (or already owned by you on npmjs.com).

    ```bash
    # Both commands MUST return either:
    #   - 404 (package not yet published — claim it via release)
    #   - YOUR account as the owner (already published in a prior session)
    bunx npm view @roadraven/core
    bunx npm view @roadraven/plugin-claude-code
    ```

    If either name is owned by someone else: STOP. Pick a different scope or
    contact the owner BEFORE tagging — the release workflow will fail with a 403
    and you'll waste a tag burn.

    ## B. npmjs.com — Trusted Publishers config (per package, one-time)

    1. Sign in to https://www.npmjs.com.
    2. For each package (`@roadraven/core`, `@roadraven/plugin-claude-code`):
       a. Navigate to package settings → **Trusted Publishers**.
       b. **Add publisher → GitHub Actions**:
          - Repository owner: `Shuffzord`
          - Repository name: `RoadRaven`
          - Workflow filename: `release.yml`
          - Environment name: *(leave blank)*
       c. Save.
    3. The first publish for a brand-new package name must be done as a "new
       package publish" — npm requires the publisher to bootstrap the package
       record. The `publish-npm-core` and `publish-npm-mcp` workflow jobs handle
       this on the first `v*` tag push as long as the names are unclaimed (Step A).

    Reference: https://docs.npmjs.com/trusted-publishers

    ## C. GitHub Pages — flip source to "GitHub Actions" (one-time)

    Required so Plan 05-04's `pages.yml` (or the `deploy-docs` job appended to
    `release.yml`) can deploy. Without this, the Actions job runs successfully
    but `https://shuffzord.github.io/RoadRaven/` returns 404.

    1. Navigate to https://github.com/Shuffzord/RoadRaven/settings/pages
    2. Under **Build and deployment** → **Source**, select **GitHub Actions**
       (NOT "Deploy from a branch").
    3. Save. No further config needed.

    Reference: RESEARCH.md Pitfall 4.

    ## D. First release dry-run (optional but recommended)

    Before tagging `v1.0.0`, do a low-stakes dry-run with a smaller version:

    ```bash
    # 1. Bump versions to a test version
    bun scripts/bump-version.ts 0.0.2-test.1

    # 2. Commit + tag
    git add -A
    git commit -m "chore: dry-run release v0.0.2-test.1"
    git tag v0.0.2-test.1
    git push --follow-tags

    # 3. Watch the Actions tab — release.yml should run
    # 4. Verify in npmjs.com that @roadraven/core and @roadraven/plugin-claude-code
    #    appear with the test version
    # 5. If anything failed: deprecate the test version on npm
    bunx npm deprecate @roadraven/core@0.0.2-test.1 "test release"
    bunx npm deprecate @roadraven/plugin-claude-code@0.0.2-test.1 "test release"

    # 6. Bump back to the real version and tag for real
    bun scripts/bump-version.ts 1.0.0
    git add -A
    git commit -m "release: v1.0.0"
    git tag v1.0.0
    git push --follow-tags
    ```

    ## E. Tag pattern reservation

    | Pattern | Purpose | Status |
    |---------|---------|--------|
    | `v1.0.0`, `v1.0.1`, `v1.1.0` | Stable channel (this phase) | active |
    | `v*-canary.*` (e.g., `v1.1.0-canary.1`) | Canary channel | RESERVED for v1.1 |
    | `v*-test.*` (e.g., `v0.0.2-test.1`) | Pre-release dry-runs | available |

    The release workflow `on.push.tags` matches `v*`. To avoid canary tags
    accidentally going through stable in v1.0, the v1.1 canary work will narrow
    the trigger to a regex like `v[0-9]+.[0-9]+.[0-9]+` (semver-strict). For
    v1.0, we trust the human not to push canary tags.

    ## F. Post-release smoke checklist (every release)

    1. https://github.com/Shuffzord/RoadRaven/releases — release exists with the
       Windows `.zip` and Linux `.tar.gz` attached + auto-generated release notes.
    2. https://www.npmjs.com/package/@roadraven/core — new version listed with
       a "Provenance" badge.
    3. https://www.npmjs.com/package/@roadraven/plugin-claude-code — same.
    4. https://shuffzord.github.io/RoadRaven/ — site reflects the latest content
       (front-page version mention if you decide to add one).
    5. Auto-updater manifest probe (after the first stable release, set this and
       run from any clean machine):
       ```bash
       RR_TEST_MANIFEST_URL="https://github.com/Shuffzord/RoadRaven/releases/latest/download/stable-win-x64-update.json" \
         bunx vitest run tests/release/manifest-url.test.ts
       ```
       Should exit 0 with the URL responding 200 + valid JSON.

    ## G. Failure recovery

    | Failure | Recovery |
    |---------|----------|
    | npm publish fails with "package name unavailable" | Confirm Step A. Re-tag with a fresh patch version after fixing. |
    | npm publish fails with "OIDC token verification failed" | Confirm Step B for the failing package; check workflow has `permissions: id-token: write` at workflow level. |
    | `softprops/action-gh-release` fails with 403 | The workflow needs `permissions: contents: write` — confirm release.yml has it. |
    | `bunx electrobun build` fails with "Failed to download electrobun CLI" | RESEARCH.md Pitfall 2 — Electrobun CLI binary downloaded post-install on first run; if the runner can't reach `github.com/blackboardsh/electrobun/releases`, it fails. Re-run the workflow; if persistent, pin to a different Electrobun version. |
    | GH Pages deploy succeeds but site 404s | Confirm Step C (Pages source = "GitHub Actions"). |
    | Release attached but installer file missing | `if-no-files-found: error` should have failed the build job — check the build logs for "no files matching the path were found." |

    ---

    *Last updated: 2026-05-03 (initial creation, Phase 5 Plan 05-03)*
    ```
  </action>

  <verify>
    <automated>test -f .planning/phases/05-packaging-distribution/05-RELEASE-OPS.md && echo OK</automated>
    <automated>grep -c "Trusted Publishers" .planning/phases/05-packaging-distribution/05-RELEASE-OPS.md  # MUST be >= 1</automated>
    <automated>grep -c "Pre-flight" .planning/phases/05-packaging-distribution/05-RELEASE-OPS.md  # MUST be >= 1</automated>
    <automated>grep -c "shuffzord.github.io/RoadRaven" .planning/phases/05-packaging-distribution/05-RELEASE-OPS.md  # MUST be >= 1</automated>
    <automated>grep -c "bun scripts/bump-version.ts" .planning/phases/05-packaging-distribution/05-RELEASE-OPS.md  # MUST be >= 1</automated>
    <automated>grep -c "v\*-canary" .planning/phases/05-packaging-distribution/05-RELEASE-OPS.md  # MUST be >= 1 (tag reservation)</automated>
  </verify>

  <acceptance_criteria>
    - File `.planning/phases/05-packaging-distribution/05-RELEASE-OPS.md` exists
    - File contains a section heading `## A. Pre-flight: confirm npm package names are available` with a `bunx npm view @roadraven/core` command
    - File contains a section heading `## B. npmjs.com — Trusted Publishers config` referencing `Repository owner: Shuffzord` AND `Repository name: RoadRaven` AND `Workflow filename: release.yml`
    - File contains a section heading `## C. GitHub Pages — flip source to "GitHub Actions"` referencing `https://github.com/Shuffzord/RoadRaven/settings/pages`
    - File contains a section heading `## D. First release dry-run` with a step-by-step `git tag` example
    - File contains a section heading `## E. Tag pattern reservation` with a table reserving `v*-canary.*` for v1.1
    - File contains a section heading `## F. Post-release smoke checklist` with five+ verification items
    - File contains a section heading `## G. Failure recovery` with at least 5 failure-mode rows
    - File mentions `permissions: id-token: write` in failure recovery (so a future debugger knows where to look)
  </acceptance_criteria>

  <done>
    The user has a one-stop checklist for the irreducible human steps. No code is gated on this — the workflow itself just won't fully succeed until Steps A-C are done.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Tag push → CI runner | Anyone with push access to `refs/tags/v*` can trigger a release. GitHub repo permissions + branch protection are the boundary; CI itself trusts the trigger. |
| CI runner → npm registry (publish) | Without OIDC: `NPM_TOKEN` secret travels with the workflow (rotation burden, theft risk). With OIDC (R-03): per-run token minted by GitHub's OIDC provider, scoped to the specific workflow + repo + (optionally) environment. npm server-side validates the token's `iss`, `aud`, and `repository` claims against the Trusted Publishers config. |
| CI runner → GitHub Releases (asset upload) | `GITHUB_TOKEN` is auto-scoped per-workflow-run; `permissions: contents: write` is the explicit allow. Without it, `softprops/action-gh-release` fails with 403. |
| `electrobun build` output → upload-artifact step | `if-no-files-found: error` ensures unexpected output paths (e.g., from a future Electrobun version that changes naming) fail the build instead of silently uploading nothing. The Wave-0 `installer-artifacts.test.ts` step provides a second layer (asserts on the exact expected filenames). |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-05-02 | Tampering | Compromised CI publishes a malicious version | mitigate | npm provenance attestation (Pattern 3) — every published version carries a verifiable link to the GitHub Actions run that produced it. End users / package auditors can verify via `npm audit signatures` (npm 9.5.0+) that the package came from this repo's release.yml. Combined with OIDC trusted publishing, no long-lived secret exists for an attacker to steal. |
| T-05-04 | Tampering | `@roadraven/core` runtime dependency surface | mitigate | Task 2 wires `bun run scripts/check-core-deps.ts` into the lint job. Any PR adding a dep beyond `zod` fails CI before merge. |
| T-05-05 | Tampering | Auto-updater pulls a malicious manifest | accept | Manifest URL (`release.baseUrl`) is HTTPS-pinned to `github.com/Shuffzord/RoadRaven` (Task 1.B). GitHub's TLS + origin enforcement is the boundary. Code signing (D-12 deferred) would add a stronger guarantee but is explicitly out of scope per CONTEXT.md. README documents the trust model in Plan 05-04. |
| T-05-07 | Repudiation | Provenance attestation on npm | mitigate | `publishConfig.provenance: true` in both package.json files (Plan 05-02) + `npm publish --provenance` in workflow (Task 1.A). Verification on consumer side: `npm audit signatures @roadraven/core`. |
| T-05-09 | Tampering | Path traversal / unexpected filenames in `electrobun build` output | mitigate | Two layers: (1) `if-no-files-found: error` on upload-artifact; (2) Wave-0 `installer-artifacts.test.ts` asserts on the EXACT expected filenames including `debFiles).toEqual([])` to catch any accidental `.deb` production. |
</threat_model>

<verification>
After all three tasks land, run from repo root:

```bash
# Workflow syntax-validate (GitHub Actions has no offline validator that ships with gh CLI;
# this is a smoke test that the YAML parses)
node -e "const y=require('js-yaml');y.load(require('fs').readFileSync('.github/workflows/release.yml','utf8'));console.log('release.yml parses')" 2>/dev/null || echo "Install js-yaml or trust GitHub's parser to fail at push time"
node -e "const y=require('js-yaml');y.load(require('fs').readFileSync('.github/workflows/ci.yml','utf8'));console.log('ci.yml parses')" 2>/dev/null

# CI gates work locally
bun run scripts/check-core-deps.ts  # MUST exit 0
bunx vitest run tests/release/requirements-edits.test.ts  # MUST exit 0
bunx @biomejs/biome check --diagnostic-level=error .  # MUST still exit 0

# release.yml structural assertions (grep-based)
grep -c "id-token: write" .github/workflows/release.yml      # >= 1
grep -c "NPM_TOKEN" .github/workflows/release.yml            # 0
grep -c "npm publish --access public --provenance" .github/workflows/release.yml  # 2
grep -c "if-no-files-found: error" .github/workflows/release.yml                   # 2

# electrobun.config.ts changes
grep -c "release:" packages/desktop/electrobun.config.ts  # >= 1
grep -c "github.com/Shuffzord/RoadRaven/releases/latest/download" packages/desktop/electrobun.config.ts  # 1
bunx tsc --noEmit -p packages/desktop  # MUST exit 0

# build:stable script exists
cat packages/desktop/package.json | grep '"build:stable"'

# Release ops doc exists
test -f .planning/phases/05-packaging-distribution/05-RELEASE-OPS.md
```

**Manual verification (one-time, NOT automatable):**
- The user must complete Steps A-C in `05-RELEASE-OPS.md` (npm Trusted Publishers + GH Pages source flip + package name pre-flight) BEFORE the first `v*` tag is pushed. The workflow file alone does not handle these UI-only steps.
</verification>

<success_criteria>
- `.github/workflows/release.yml` exists, parses, and has correct OIDC + provenance + per-platform structure
- `.github/workflows/ci.yml` enforces core-deps allowlist and requirements-edits invariants on every PR
- `packages/desktop/electrobun.config.ts` has `release.baseUrl` pointing at GitHub Releases /latest/download
- `packages/desktop/package.json` has `build:stable` and `test:release` scripts
- `05-RELEASE-OPS.md` documents every irreducible human step
- All existing tests + lints still pass (no regression from added invariants)
- Wave-0 tests (`installer-artifacts.test.ts`, `requirements-edits.test.ts`) integrated into CI gates
</success_criteria>

<output>
After completion, create `.planning/phases/05-packaging-distribution/05-03-SUMMARY.md` describing:
- The release workflow shape (job graph: build-windows ‖ build-linux → github-release ‖ publish-npm-core ‖ publish-npm-mcp)
- Why deploy-docs is NOT in this plan (deferred to Plan 05-04 parallel wave)
- The two new CI invariants and how they interact with Wave-0 tests
- The release.baseUrl strategy (A from Pattern 5) and the v1.1 migration path (Strategy B for canary)
- Any deviations from RESEARCH.md Pattern 3 (e.g., Bun cache step added, Wave-0 test integrated as a smoke step)
</output>
