---
phase: 05-packaging-distribution
plan: 03
subsystem: release-automation
tags: [packaging, ci-cd, github-actions, release-automation, oidc, npm-provenance, github-pages, docs-deploy]
requirements: [PACK-01, PACK-02, PACK-03, PACK-04, PACK-05]
threats: [T-05-02, T-05-04, T-05-05, T-05-07, T-05-09, T-05-10]
dependency-graph:
  requires:
    - phase: 05-packaging-distribution/05-01
      provides: "scripts/check-core-deps.ts (CI core-deps allowlist enforcer); scripts/bump-version.ts (lockstep semver bump); 4 release-test scaffolds (1 unconditional + 3 skip-gated)"
    - phase: 05-packaging-distribution/05-02
      provides: "@roadraven/core publishable as ESM + .d.ts; @roadraven/plugin-claude-code private->public flip; both packages have publishConfig.provenance:true + prepublishOnly hooks"
  provides:
    - ".github/workflows/release.yml — tag-triggered (`v*`) 6-job pipeline: build-windows ‖ build-linux → github-release ‖ publish-npm-core ‖ publish-npm-mcp; deploy-docs ← github-release"
    - ".github/workflows/ci.yml lint job — core-deps allowlist gate (D-23, T-05-04 mitigation)"
    - ".github/workflows/ci.yml NEW invariants job — requirements-edits regression gate on every PR + master push"
    - "packages/desktop/electrobun.config.ts release.baseUrl — Strategy A (GitHub Releases /latest/download) wired for auto-updater"
    - "packages/desktop/package.json build:stable + test:release scripts (mirror build:canary; release-tests-from-desktop convenience)"
    - "tests/release/requirements-edits.test.ts new W-6 assertion — locks release.yml `v*` trigger against canary broadening"
    - ".planning/phases/05-packaging-distribution/05-RELEASE-OPS.md — one-stop human checklist (npm Trusted Publishers, GH Pages source flip, dry-run, failure recovery)"
  affects:
    - "Plan 05-04 (docs site) — does NOT touch release.yml (B-2/B-3 conflict resolved); only authors docs/ content + CONTRIBUTING.md + README polish"
    - "Plan 05-05 (a11y audit) — independent of release flow; can run in parallel"
    - "Phase 5 close-out — first `v*` tag push will exercise the full pipeline; user must complete RELEASE-OPS.md sections A-C beforehand"
tech-stack:
  added:
    - "softprops/action-gh-release@v2 (release attach action)"
    - "actions/configure-pages@v5 + jekyll-build-pages@v1 + upload-pages-artifact@v3 + deploy-pages@v4 (GH Pages OIDC deploy chain)"
    - "actions/setup-node@v4 (Node 22 with registry-url for OIDC token mint — used only by npm publish jobs)"
  patterns:
    - "OIDC trusted publishing (R-03): id-token:write + npm publish --provenance, NO NPM_TOKEN secret"
    - "Per-job permission overrides: workflow scope contents:write/id-token:write; deploy-docs job downgrades contents to read and adds pages:write"
    - "Wave-0 test integration as a CI smoke step: installer-artifacts.test.ts runs IN the build-{windows,linux} jobs after `bunx electrobun build` — same test, both env modes (skip locally, assert in CI)"
    - "CLAUDE.md `npm publish` exception scoped + commented inline (Pitfall 1 trap: bunx npm publish defeats setup-node OIDC env wiring)"
    - "Defense-in-depth tag gating: workflow `on.push.tags: v*` AND deploy-docs job `if: startsWith(github.ref, 'refs/tags/v')` — protects against future workflow_dispatch additions"
key-files:
  created:
    - ".github/workflows/release.yml (6 jobs, ~190 lines)"
    - ".planning/phases/05-packaging-distribution/05-RELEASE-OPS.md"
  modified:
    - ".github/workflows/ci.yml (lint job: 1 new step; NEW invariants job; fallow still commented per D-22)"
    - "packages/desktop/electrobun.config.ts (added `release: { baseUrl }` block)"
    - "packages/desktop/package.json (added `build:stable` + `test:release` scripts; preserved all existing scripts)"
    - "tests/release/requirements-edits.test.ts (added W-6 assertion: 8 tests now, was 7)"
key-decisions:
  - "test:release script implementation: `cd ../.. && vitest run tests/release/` — chosen over plan's `vitest run --root . --dir ../../tests/release` because the latter still picked up the desktop vitest.config.ts include glob (tests/unit/**) and reported `No test files found`. The cd-then-vitest form runs from repo root where the release tests resolve `process.cwd()`-relative paths correctly. Documented as Rule 3 inline fix."
  - "W-6 disposition: chose to ADD the canary-broadening assertion to requirements-edits.test.ts (not just document risk in <assumptions>). Belt-and-suspenders — the assertion makes the v1.1 canary tag-broadening risk a live CI gate, not a tribal-knowledge invariant."
  - "Validated release.yml with actionlint (zero diagnostics) AND PyYAML (parses cleanly, 6 jobs in expected order) — no js-yaml CLI available locally. Both validators agreed."
  - "Did NOT add an Electrobun CLI cache step (RESEARCH.md Pitfall 2 polish suggestion). YAGNI for v1.0 — re-running a failed build job typically resolves the rare CDN miss; adding caching is a follow-up if it becomes a real problem in practice."
patterns-established:
  - "Tag-triggered single-pipeline release model: `v*` tag → 6 jobs in 4 sequential stages (build-platforms → release+publish-parallel → deploy-docs)"
  - "OIDC-only npm authentication: workflow declares `permissions: id-token: write`; setup-node mints the per-run OIDC token; npm publish --provenance attests the upload. No long-lived secret rotation."
  - "Single-owner workflow file (B-2/B-3 fix): release.yml is exclusively owned by Plan 05-03; Plan 05-04 commits docs content but does NOT touch release.yml"
  - "Wave-0 tests as CI smoke gates: installer-artifacts.test.ts runs in build jobs after artifacts produced; manifest-url.test.ts runs after release publishes (env var gate)"
requirements-completed: [PACK-01, PACK-02, PACK-04]
requirements-partial: [PACK-03, PACK-05]
metrics:
  duration: "~11 minutes"
  tasks: 4
  files: 5 (2 created + 3 modified, plus 1 test file augmented)
  completed: "2026-05-04"
---

# Phase 5 Plan 03: Release Workflow Summary

**Tag-triggered 6-job release pipeline now wired: Windows + Linux Electrobun installers built and attached to a GitHub Release, both npm packages published via OIDC trusted publishing (no NPM_TOKEN), GH Pages docs site deployed last. CI gains two new invariants: `packages/core` zero-desktop-deps gate (D-23) and requirements-edits regression gate (Wave-0 derivative). Plan 05-03 is the SOLE OWNER of release.yml — checker B-2/B-3 file-ownership conflict resolved.**

## Performance

- **Duration:** ~11 minutes
- **Started:** 2026-05-04T08:48:40Z (worktree branch check)
- **Completed:** 2026-05-04T08:59:47Z (final verification)
- **Tasks:** 4
- **Commits:** 4 (all task-atomic)
- **Files created:** 2 (release.yml, RELEASE-OPS.md)
- **Files modified:** 3 (ci.yml, electrobun.config.ts, packages/desktop/package.json)
- **Test file augmented:** 1 (requirements-edits.test.ts: +1 assertion → 8 tests)

## Task Commits

1. **Task 1 — release.yml + electrobun.config.ts release.baseUrl + build:stable script** — `7186fd5` (feat)
   First 5 jobs (build-windows, build-linux, github-release, publish-npm-core, publish-npm-mcp). Wave-0 installer-artifacts test wired as a smoke step in both build jobs. release.baseUrl set to `https://github.com/Shuffzord/RoadRaven/releases/latest/download` (Strategy A). build:stable mirrors build:canary; test:release added.

2. **Task 2 — ci.yml core-deps allowlist + invariants job + W-6 assertion** — `20392c4` (feat)
   lint job gains `bun run scripts/check-core-deps.ts` step (D-23, T-05-04). New `invariants` job runs `bunx vitest run tests/release/requirements-edits.test.ts` on every PR + master push. fallow stays commented (D-22). W-6 canary-broadening assertion added to the requirements-edits test.

3. **Task 3 — RELEASE-OPS.md operational checklist** — `51478fa` (docs)
   One-stop human checklist for the irreducible setup steps the user must complete BEFORE the first `v*` tag: package-name pre-flight, npmjs.com Trusted Publishers config, GH Pages source flip to "GitHub Actions", dry-run path with v0.0.2-test.1, tag-pattern reservation table, post-release smoke checklist, failure-recovery troubleshooting.

4. **Task 4 — Append deploy-docs job to release.yml** — `44698bb` (feat)
   6th and final job. Tag-gated (`if: startsWith(github.ref, 'refs/tags/v')`), depends on `github-release`, runs the GH Pages OIDC deploy chain (configure-pages → jekyll-build-pages → upload-pages-artifact → deploy-pages). Smoke-tests the deployed site at https://shuffzord.github.io/RoadRaven/ with curl. Per checker B-2/B-3, Plan 05-04 will NOT modify this file — release.yml has a single owner.

## Job Graph (release.yml after Task 4)

```
                    push tag v*
                          │
              ┌───────────┼───────────┐
              ▼                       ▼
       build-windows           build-linux
       (windows-latest)        (ubuntu-latest)
              │                       │
              └───────────┬───────────┘
                          │
              ┌───────────┼───────────┬───────────┐
              ▼           ▼           ▼           ▼
       github-release  publish-     publish-    (parallel)
       (attach .zip +  npm-core    npm-mcp
        .tar.gz +      (--prov)    (--prov)
        manifests)
              │
              ▼
       deploy-docs
       (Pages OIDC)
              │
              ▼
       https://shuffzord.github.io/RoadRaven/
```

- **Stage 1** (parallel): `build-windows` and `build-linux` produce per-platform artifacts under `packages/desktop/artifacts/`. Each runs `bunx vitest run tests/release/installer-artifacts.test.ts` to assert filename invariants (Wave-0 test integrated).
- **Stage 2** (parallel, all need both builds): `github-release` attaches the artifacts, `publish-npm-core` publishes `@roadraven/core` to npm with provenance, `publish-npm-mcp` publishes `@roadraven/plugin-claude-code` to npm with provenance.
- **Stage 3** (sequential, needs github-release): `deploy-docs` builds the Jekyll site from `docs/` and deploys to GitHub Pages, then curl-smoke-tests the live URL.

## CI Invariants (ci.yml — 4 jobs total now)

| Job | Owner | Trigger | Purpose |
|-----|-------|---------|---------|
| `lint` | preserved + new step | PR + push to master | Biome check + **NEW** core-deps allowlist (`bun run scripts/check-core-deps.ts`) |
| `typecheck` | preserved | PR + push to master | `bunx tsc --noEmit` in packages/desktop |
| `test` | preserved | PR + push to master | `bunx vitest run` in packages/desktop |
| `invariants` | **NEW** | PR + push to master | `bunx vitest run tests/release/requirements-edits.test.ts` (8 tests including W-6 release.yml-trigger lock) |
| `fallow` | commented (D-22) | n/a | Stays commented per D-22 invariant; informational tool, not gated |

The Wave-0 test `requirements-edits.test.ts` is an **unconditional gate** that runs on every PR. Its 8 assertions enforce:
- No `@roadmap-viewer/` strings in REQUIREMENTS.md / PROJECT.md / ROADMAP.md
- PACK-01 ships Linux .tar.gz, not .deb
- PACK-02 stable channel only, not canary + stable
- PACK-04 publishes @roadraven/core + plugin-claude-code (drops @roadraven/react)
- PROJECT.md Out of Scope contains all 5 deferral rows
- **NEW (W-6):** release.yml trigger is locked to `v*` (no canary broadening)

## release.baseUrl Strategy (Strategy A → Strategy B migration path)

This plan wires **Strategy A** for v1.0:
```typescript
release: {
  baseUrl: "https://github.com/Shuffzord/RoadRaven/releases/latest/download",
}
```

Auto-updater polls `${baseUrl}/{channel}-{os}-{arch}-update.json`. GitHub's `/releases/latest/download/` URL pattern always resolves to the most recent non-prerelease Release — exactly matches D-10 (stable channel only in v1.0).

**v1.1 migration to Strategy B:** When canary lands, the auto-updater needs two distinct manifest URLs (one for stable, one for canary). Strategy A only resolves to the latest stable, so canary builds need a second hosting path. Strategy B (gh-pages branch with `manifests/{channel}-{os}-{arch}-update.json`) is the planned successor. The migration touches `electrobun.config.ts` only — auto-updater code is unchanged.

## Decisions Made

1. **`test:release` script form: `cd ../.. && vitest run tests/release/`** (not the plan's `vitest run --root . --dir ../../tests/release`). The plan-suggested form ran inside `packages/desktop` and vitest still picked up the desktop `vitest.config.ts` `include: tests/unit/**` glob — result: "No test files found, exiting with code 1." The `cd-then-vitest` form invokes vitest from the repo root where no `vitest.config.*` exists, so vitest auto-discovers `tests/release/*.test.ts` correctly. Tests then resolve `process.cwd()`-relative paths (REQUIREMENTS.md, PROJECT.md, ROADMAP.md) from the repo root as designed.

2. **W-6 canary-broadening assertion: ADDED to requirements-edits.test.ts.** The plan offered a binary: either add the assertion OR document the risk in `<assumptions>`. I chose to add the assertion. Reason: the assertion converts a tribal-knowledge invariant ("don't broaden the v* trigger to v*-canary.* until v1.1 wires a separate workflow") into a live CI gate. Cost is one new test (~10 lines); benefit is the v1.1 canary work cannot accidentally regress. The plan's `<assumptions>` block can stay as-is (it documents the same risk for human readers).

3. **No Electrobun CLI cache step added (Pitfall 2 polish skipped).** RESEARCH.md flags that `bunx electrobun` downloads its CLI binary from GitHub Releases on first run, which can fail if GitHub is briefly unreachable. The polish would add an `actions/cache@v4` step keyed on the Electrobun version. YAGNI for v1.0 — re-running a failed build job typically resolves the rare CDN miss. Add caching if it becomes a real problem in practice.

4. **Did NOT change `app.identifier` (R-05 invariant respected).** electrobun.config.ts retains `RoadRaven.electrobun.dev`. Only added the new `release` block.

5. **Validated release.yml with two parsers + actionlint.** Local environment had neither `js-yaml` (the plan's suggested validator) nor `node yaml` package, but did have Python 3 + PyYAML (parses correctly: 6 jobs in expected order) and `actionlint` from winget (zero diagnostics on both ci.yml and release.yml). Both validators agreed. The grep-based assertions in the plan covered structural invariants exhaustively.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocker] test:release script as written returned "No test files found"**
- **Found during:** Task 1 verification (`bun run --cwd packages/desktop test:release`)
- **Issue:** The plan's `"test:release": "vitest run --root . --dir ../../tests/release"` runs vitest from `packages/desktop`. The `--root .` flag pins root to `packages/desktop`, but vitest still loads `packages/desktop/vitest.config.ts` and applies its `include: ["tests/unit/**", ...]` glob. The `--dir ../../tests/release` is then ignored by the include filter. Result: vitest exits 1 with "No test files found, exiting with code 1."
- **Fix:** Changed the script to `"test:release": "cd ../.. && vitest run tests/release/"`. The cd-then-vitest form runs from the repo root where no vitest.config.* exists, so vitest auto-discovers `tests/release/*.test.ts` and runs all 4 files (4 files, 8 passed + 7 skipped).
- **Files modified:** `packages/desktop/package.json` (single line in scripts block)
- **Verification:** `bun run --cwd packages/desktop test:release` → 1 passed file + 3 skipped files (8 + 7 tests).
- **Committed in:** `7186fd5` (Task 1 commit, same edit set)

**2. [Rule 3 - Blocker] Worktree provisioned without node_modules**
- **Found during:** Task 1 typecheck (`bunx tsc --noEmit -p packages/desktop`)
- **Issue:** New worktree had no installed dependencies; `bunx tsc` resolved to `C:\Work\RoadRaven\node_modules\typescript\bin\tsc` (the main repo's node_modules) which doesn't exist there either, and definitely not in the worktree.
- **Fix:** Ran `bun install` in the worktree (1169 packages installed in 2.95s). After install, tsc resolves to `packages/desktop/node_modules/.bin/tsc` (workspace-aware install).
- **Files modified:** none (transient install — bun.lock unchanged)
- **Verification:** `cd packages/desktop && ./node_modules/.bin/tsc --noEmit` exits 0
- **Committed in:** N/A (no file diff produced)

### Out of Scope (deferred — not fixed)

- **Pre-commit `fallow` info hook reports `@tailwindcss/vite` as test-only-but-in-dependencies on every commit.** Pre-existing finding from before Phase 5 (the desktop package's dep declaration); not caused by Plan 05-03 changes. Per CLAUDE.md fallow is informational only and not gated. Out of plan scope.

- **act + react testing-library "not wrapped in act(...)" warnings during pre-commit vitest run.** Pre-existing test infrastructure noise from prior phases (ContextMenu, ConfirmationDialog, SaveIndicator suites). All 452 desktop tests still pass; warnings are stderr noise from React strict-mode test rendering. Out of plan scope.

---

**Total deviations:** 2 auto-fixed (2 Rule-3 blockers — both toolchain mechanics, neither altered the planned shape of release.yml, ci.yml, or RELEASE-OPS.md)

**Impact on plan:** Both deviations were environment / wiring issues (worktree provisioning, vitest CLI flag interpretation), not scope changes. All `must_haves.truths` were satisfied without renegotiation. The W-6 disposition was a pre-authorized choice within the plan's offered binary, not a deviation.

## Authentication Gates

None occurred. All work was filesystem + bun install + bunx vitest invocations. The release workflow itself depends on authentication (npm OIDC, GitHub Pages OIDC, GITHUB_TOKEN), but those are exercised at the time of the first `v*` tag push — not during this plan's execution. The user must complete RELEASE-OPS.md sections A-C (npm Trusted Publishers + GH Pages source flip) before the first tag.

## Verification Results

```
$ test -f .github/workflows/release.yml && echo OK
OK

$ grep -c "id-token: write" .github/workflows/release.yml
3   (1 comment + workflow-level + deploy-docs job-level)

$ grep -c "NPM_TOKEN" .github/workflows/release.yml
0

$ grep -c "npm publish --access public --provenance" .github/workflows/release.yml
2   (publish-npm-core + publish-npm-mcp)

$ grep -c "bunx electrobun build --env=stable" .github/workflows/release.yml
2   (build-windows + build-linux)

$ grep -c "bunx vitest run tests/release/installer-artifacts.test.ts" .github/workflows/release.yml
2   (Wave-0 smoke step in each build job)

$ grep -c "softprops/action-gh-release@v2" .github/workflows/release.yml
1

$ grep -c "if-no-files-found: error" .github/workflows/release.yml
2   (T-05-09 mitigation on both upload-artifact steps)

$ grep -c "deploy-docs:" .github/workflows/release.yml
1   (Task 4)

$ grep -c "actions/deploy-pages@v4" .github/workflows/release.yml
1

$ grep -c "if: startsWith(github.ref, 'refs/tags/v')" .github/workflows/release.yml
1   (B-2 acceptance criterion)

$ grep -c "needs: \[github-release\]" .github/workflows/release.yml
1   (deploy-docs sequenced after release publish)

$ grep -c "bunx npm publish" .github/workflows/release.yml
0   (Pitfall 1 trap avoided)

$ grep -c "CLAUDE.md" .github/workflows/release.yml
2   (publish-npm-core + publish-npm-mcp exception comments)

$ python -c "import yaml; data = yaml.safe_load(open('.github/workflows/release.yml')); print('jobs:', list(data['jobs'].keys()))"
jobs: ['build-windows', 'build-linux', 'github-release', 'publish-npm-core', 'publish-npm-mcp', 'deploy-docs']

$ actionlint .github/workflows/release.yml
(no output — clean)

$ actionlint .github/workflows/ci.yml
(no output — clean)

$ grep -c "release:" packages/desktop/electrobun.config.ts
1

$ grep -c "github.com/Shuffzord/RoadRaven/releases/latest/download" packages/desktop/electrobun.config.ts
1

$ grep -c "RoadRaven.electrobun.dev" packages/desktop/electrobun.config.ts
1   (R-05 unchanged)

$ grep -c '"build:stable":' packages/desktop/package.json
1

$ grep -c '"test:release":' packages/desktop/package.json
1

$ cd packages/desktop && ./node_modules/.bin/tsc --noEmit
exit 0   (release block accepted by ElectrobunConfig type)

$ grep -c "scripts/check-core-deps.ts" .github/workflows/ci.yml
1   (new lint step)

$ grep -c "tests/release/requirements-edits.test.ts" .github/workflows/ci.yml
1   (new invariants job step)

$ grep -cE "^\s*invariants:" .github/workflows/ci.yml
1   (new job — 4 jobs total now: lint, typecheck, test, invariants)

$ grep -cE "^\s*#\s*fallow:" .github/workflows/ci.yml
1   (still commented per D-22)

$ test -f .planning/phases/05-packaging-distribution/05-RELEASE-OPS.md && echo OK
OK

$ bun run scripts/check-core-deps.ts
✓ packages/core has 1 dependencies, all on the allowlist.   exit 0

$ bunx vitest run tests/release/
Test Files  1 passed | 3 skipped (4)
     Tests  8 passed | 7 skipped (15)   ← was 7 passed | 7 skipped (14) — W-6 added the 8th passing test

$ bunx vitest run tests/release/requirements-edits.test.ts
Test Files  1 passed (1)
     Tests  8 passed (8)
```

All `must_haves.truths` from plan frontmatter satisfied:

1. ✓ `.github/workflows/release.yml` exists, triggers on `v*` tag push.
2. ✓ Workflow builds Windows installer (`stable-win-x64-*.zip`) and Linux installer (`stable-linux-x64-*.tar.gz`) per R-01/R-02.
3. ✓ Workflow publishes `@roadraven/core` and `@roadraven/plugin-claude-code` with `--provenance` via OIDC trusted publishing (R-03).
4. ✓ Workflow has `permissions: id-token: write, contents: write` at workflow scope; NO `NPM_TOKEN` reference anywhere.
5. ✓ Workflow attaches all installers + manifests to a GitHub Release (`softprops/action-gh-release@v2`, idempotent re-runnable via tag re-push).
6. ✓ Workflow contains `deploy-docs` job gated on `if: startsWith(github.ref, 'refs/tags/v')` that deploys GH Pages after the GitHub Release succeeds.
7. ✓ ci.yml lint job runs `bun run scripts/check-core-deps.ts` (D-23).
8. ✓ ci.yml `invariants` job runs `bunx vitest run tests/release/requirements-edits.test.ts` on every push.
9. ✓ packages/desktop/electrobun.config.ts has `release.baseUrl: "https://github.com/Shuffzord/RoadRaven/releases/latest/download"` (Strategy A from Pattern 5).
10. ✓ packages/desktop/package.json has `build:stable` script mirroring `build:canary`.
11. ✓ RELEASE-OPS.md exists documenting one-time npmjs.com Trusted Publishers setup + pre-flight + GH Pages source flip + dry-run path.
12. ✓ fallow CI gate stays commented (D-22 invariant).
13. ✓ release.yml is the SINGLE OWNER for the workflow file — Plan 05-04 will own docs/ content only.

## Threat Mitigation Status

| Threat ID | Disposition | Status |
|-----------|-------------|--------|
| T-05-02 (Tampering: malicious published version) | mitigate | ✓ Wired — `npm publish --provenance` attests every release; consumers verify via `npm audit signatures @roadraven/core` |
| T-05-04 (Tampering: @roadraven/core dep surface) | mitigate | ✓ Wired — `bun run scripts/check-core-deps.ts` is now a CI lint-job step; PR adding any non-zod dep fails CI |
| T-05-05 (Tampering: malicious manifest URL) | accept | release.baseUrl is HTTPS-pinned to github.com/Shuffzord; documented in CONTEXT, README disclosure deferred to Plan 05-04 |
| T-05-07 (Repudiation: provenance attestation) | mitigate | ✓ Wired — `--provenance` flag on both publish jobs + `publishConfig.provenance: true` in package.json (Plan 05-02) |
| T-05-09 (Tampering: unexpected installer filenames) | mitigate | ✓ Wired — two layers: (a) `if-no-files-found: error` on both upload-artifact steps; (b) `installer-artifacts.test.ts` smoke step asserts exact filenames + zero `.deb` files |
| T-05-10 (InfoDisclosure: docs site leak) | mitigate | ✓ Workflow side wired (tag-gated deploy provides review window); CONTRIBUTING.md docs/ disclosure note deferred to Plan 05-04 |

## Threat Flags

No new threat surface introduced. The release workflow exposes (a) npm registry interaction (already in threat model T-05-02/-07), (b) GitHub Releases API interaction (covered by GITHUB_TOKEN scope), (c) GitHub Pages deployment (covered by Pages OIDC + tag gate). All within plan's `<threat_model>`.

## Self-Check: PASSED

Created files (all verified present via `test -f`):
- ✓ `.github/workflows/release.yml`
- ✓ `.planning/phases/05-packaging-distribution/05-RELEASE-OPS.md`

Modified files (all verified via `git diff --name-status 16bd836..HEAD`):
- ✓ `.github/workflows/ci.yml`
- ✓ `packages/desktop/electrobun.config.ts`
- ✓ `packages/desktop/package.json`
- ✓ `tests/release/requirements-edits.test.ts`

Commits (all verified in `git log --oneline`):
- ✓ `7186fd5` feat(05-03): add release workflow + release.baseUrl + build:stable script
- ✓ `20392c4` feat(05-03): wire CI invariants for core-deps allowlist + planning edits
- ✓ `51478fa` docs(05-03): add RELEASE-OPS.md operational checklist for v1.0 release
- ✓ `44698bb` feat(05-03): append deploy-docs job to release.yml (B-2/B-3 consolidation)

No missing items. No unexpected file deletions.

## Next Phase Readiness

Wave 3 + 4 (Plans 05-04 docs site, 05-05 a11y audit) can proceed:

- **Plan 05-04 (docs site + CONTRIBUTING.md + README polish):** Free to author `docs/_config.yml`, `docs/plugin-authoring.md`, `CONTRIBUTING.md`, README polish, per-package READMEs. **Does NOT touch `.github/workflows/release.yml`** — the deploy-docs job is already in place from this plan (B-2/B-3 conflict resolved). Plan 05-04's content will be picked up by the existing deploy-docs job on the first `v*` tag push.

- **Plan 05-05 (a11y audit):** Independent of release flow. Wave-0 already scaffolded `packages/desktop/tests/a11y/playwright.config.ts` + `audit.spec.ts`. The audit can run against `vite preview` regardless of CI workflow state.

**Phase 5 close-out (after all plans merge):** The user must complete `05-RELEASE-OPS.md` sections A-C (npm Trusted Publishers config + GH Pages source flip + package-name pre-flight) BEFORE pushing the first `v*` tag. The release workflow will fail loud on the first tag push if these are missing (publish job → 403 OIDC token verification failed; deploy-docs job → site 404).

No blockers. No outstanding deferred items from this plan.

---
*Phase: 05-packaging-distribution*
*Plan: 03 — Release Workflow*
*Completed: 2026-05-04*
