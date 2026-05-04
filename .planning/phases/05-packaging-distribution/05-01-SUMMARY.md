---
phase: 05-packaging-distribution
plan: 01
subsystem: scaffolding
tags: [packaging, scaffolding, requirements, validation]
requirements: [PACK-01, PACK-02, PACK-04, PACK-06]
threats: [T-05-01, T-05-04, T-05-08]
dependency-graph:
  requires:
    - "Phase 4 complete (Event API + MCP wrapper, all 6 plans landed)"
    - ".planning/phases/05-packaging-distribution/05-CONTEXT.md (D-01..D-23, R-01..R-06 locked)"
  provides:
    - "scripts/check-core-deps.ts (CI core-deps allowlist enforcer)"
    - "scripts/bump-version.ts (lockstep semver bump across 5 files)"
    - "tests/release/*.test.ts (4 release-gate scaffolds)"
    - "packages/desktop/tests/a11y/ (audit harness for Wave 4)"
    - "Updated REQUIREMENTS.md/PROJECT.md/ROADMAP.md (canonical Phase 5 scope)"
  affects:
    - "Wave 1 (05-02 NPM packages) — depends on tsup/typescript devDeps + dist/ gitignore"
    - "Wave 2 (05-03 release workflow) — depends on check-core-deps + bump-version + manifest-url test"
    - "Wave 3 (05-05 a11y audit) — depends on @axe-core/playwright + audit.spec.ts harness"
tech-stack:
  added:
    - "@axe-core/playwright@^4.11.3 (workspace root devDep)"
    - "tsup@^8.5.1 (packages/core devDep, Wave 1 ESM+.d.ts build)"
    - "typescript@^6.0.2 (packages/core devDep, pinned to match desktop)"
  patterns:
    - "describe.skipIf gating: release tests stay green when their pre-conditions are absent (artifacts/, dist/, env var)"
    - "Lockstep semver bump via bun script: regex-validated, single source of truth (D-04)"
    - "CI dependency allowlist as explicit Set: changes require PR review (T-05-04 mitigation)"
key-files:
  created:
    - "scripts/check-core-deps.ts"
    - "scripts/bump-version.ts"
    - "tests/release/installer-artifacts.test.ts"
    - "tests/release/core-exports.test.ts"
    - "tests/release/requirements-edits.test.ts"
    - "tests/release/manifest-url.test.ts"
    - "packages/desktop/tests/a11y/playwright.config.ts"
    - "packages/desktop/tests/a11y/audit.spec.ts"
  modified:
    - ".planning/REQUIREMENTS.md (PACK-01/02/04 rewrites per D-05/D-08/D-11/R-01)"
    - ".planning/PROJECT.md (Active line, Out-of-Scope deferral table, Constraints licensing)"
    - ".planning/ROADMAP.md (Phase 5 Goal, Done-when block, plan-summary lines)"
    - ".gitignore (Phase 5 build-artifact section)"
    - "package.json (root devDeps: @axe-core/playwright)"
    - "packages/core/package.json (devDeps: tsup + typescript)"
    - "packages/desktop/package.json (test:a11y script)"
    - "bun.lock (transitive deps from new devDeps)"
decisions:
  - "Out-of-Scope formatted as a sub-table (not new bullets) so grep tests can match `^|.*Description in v1.0` patterns the plan acceptance criteria specified"
  - "ROADMAP.md Phase 5 narrative summary lines (232-233) updated alongside Goal/Done-when, even though the plan only enumerated Goal/Done-when — Rule 1 fix to keep all three planning files internally consistent"
  - ".gitignore: appended explicit packages/core/dist/ + packages/desktop/artifacts/ lines (under a `# Build artifacts (Phase 5)` header) even though broader globs `dist` + `artifacts/` already match — acceptance criterion required the literal lines"
  - "Smoke-tested bump-version.ts with 99.99.99, verified all 5 files updated, then `git checkout --` reverted; smoke test left no commit footprint"
metrics:
  duration: "~22 minutes"
  tasks: 3
  files: 14 (8 created + 6 modified, plus bun.lock)
  completed: "2026-05-04"
---

# Phase 5 Plan 01: Wave-0 Scaffolding Summary

Wave-0 scaffolding for packaging-distribution: REQUIREMENTS/PROJECT/ROADMAP rewritten to the locked Phase 5 scope (Windows .exe in .zip + Linux .tar.gz, stable channel only, @roadraven/core + @roadraven/plugin-claude-code publish targets, no macOS/canary/signing/.deb/@roadraven/react in v1.0). Lockstep bump-version + core-deps allowlist scripts in place; 4 release-test files (1 passing now, 3 skip-gated for Wave 1/2/post-release); a11y harness scaffolded against `vite preview`; @axe-core/playwright + tsup + typescript devDeps installed.

## What Was Built

### Task 1 — Requirement document edits (commit `80ec194`)

Three planning files rewritten so subsequent waves grep against the correct locked-decision strings.

**`.planning/REQUIREMENTS.md` — Packaging (PACK) section:**
- **PACK-01** rewritten: Windows `.exe` (in `.zip`) + Linux `.tar.gz` (Electrobun-native self-extracting). macOS `.dmg` and Linux `.deb` deferred to v1.1. Drops the "macOS `.dmg`, Windows `.exe`, Ubuntu `.deb`" three-platform line.
- **PACK-02** rewritten: stable channel only in v1.0; `release.baseUrl` resolves `{channel}-{os}-{arch}-update.json`; canary deferred to v1.1, tag pattern `v*-canary.*` reserved.
- **PACK-04** rewritten: `@roadraven/core` (pre-built ESM + `.d.ts`, only `zod` dep, CI-enforced allowlist) and `@roadraven/plugin-claude-code` published at lockstep version. `@roadraven/react` deferred to v1.1.
- PACK-03/05/06 lines unchanged.

**`.planning/PROJECT.md`:**
- `## Requirements > Active` Packaging line: rewritten to match locked scope (Windows + Linux installers, stable channel, two npm packages, GitHub Pages, CONTRIBUTING.md).
- `### Out of Scope`: appended a `### v1.0 Deferrals (Phase 5 packaging scope)` sub-table with 5 rows: macOS `.dmg`, Linux `.deb`, canary, `@roadraven/react`, code signing. Pre-existing list bullets preserved above the table.
- `## Constraints > Licensing`: drops `@roadmap-viewer/` references, names the v1.0 publish targets (`@roadraven/core` + `@roadraven/plugin-claude-code`).

**`.planning/ROADMAP.md`:**
- Phase 5 `**Goal:**` line: rewritten to match the v1.0 surface (Windows + Linux installers, both npm packages, docs site, a11y pass, CONTRIBUTING.md).
- Phase 5 `**Done when:**` block: 3 of 6 lines rewritten (build command + manifest URL + npm install criteria); 4th line ("packages/core has no desktop dependencies") preserved as-is per plan instruction.
- Phase 5 narrative summary lines (originally `232-233`): rewritten in lockstep so the entire Phase 5 section is internally consistent. (Plan didn't enumerate these explicitly, but acceptance criterion `grep -rn "@roadmap-viewer" .planning/{REQ,PROJ,ROAD}` requires zero matches across the three files — a Rule 1 inline fix.)

### Task 2 — Helper scripts + release test scaffolds (commit `6515066`)

**`scripts/check-core-deps.ts`** — CI-runnable allowlist. Reads `packages/core/package.json`, fails with exit 1 if any dependency falls outside `Set(["zod"])`. Today's run: `✓ packages/core has 1 dependencies, all on the allowlist.` Plan 05-03 will wire this as a step in the existing `ci.yml` lint job.

**`scripts/bump-version.ts`** — Lockstep semver bump (D-04). Validates `^\d+\.\d+\.\d+(-[a-z0-9.]+)?$`, then writes `version` into `packages/desktop/package.json`, `packages/core/package.json`, `packages/react/package.json`, `plugins/claude-code/package.json`, AND replaces `version: "..."` in `packages/desktop/electrobun.config.ts` (regex match, single occurrence). Smoke-tested with `99.99.99` → all 5 files updated correctly → reverted via `git checkout --`. Invalid input "abc" rejected with exit 1 + "Invalid version" message.

**`tests/release/requirements-edits.test.ts`** (UNCONDITIONAL — 7 cases, currently 7/7 green):
- 3 cases assert `@roadmap-viewer/` absent from REQUIREMENTS.md, PROJECT.md, ROADMAP.md.
- PACK-01 line ships Linux `.tar.gz`, not Ubuntu `.deb`.
- PACK-02 line says "stable channel only", not "canary + stable channels".
- PACK-04 line publishes `@roadraven/core` + `@roadraven/plugin-claude-code`, not `` `@roadraven/react` published ``.
- PROJECT.md Out-of-Scope contains all 5 deferral rows (macOS `.dmg`, Linux `.deb`, canary, `@roadraven/react`, code signing).

**`tests/release/installer-artifacts.test.ts`** — `describe.skipIf(!hasArtifacts)`. After `bunx electrobun build --env=stable` produces `packages/desktop/artifacts/`, asserts:
- Windows: `stable-win-x64-RoadRaven-Setup-stable.zip` present.
- Windows: `stable-win-x64-update.json` manifest present.
- Linux: `stable-linux-x64-RoadRavenSetup-stable.tar.gz` present AND zero `.deb` files (R-01 guard).
- Linux: `stable-linux-x64-update.json` manifest present.

**`tests/release/core-exports.test.ts`** — `describe.skipIf(!hasDist)`. After Wave 1 builds `packages/core/dist/`, dynamically imports the published `dist/index.js` and asserts the public exports (`RoadmapNodeSchema`, `RoadmapSchemaSchema`, `NodeStatusSchema`, `StatusConfigSchema`, `TypeConfigSchema` + `dist/index.d.ts` exists).

**`tests/release/manifest-url.test.ts`** — `describe.skipIf(!URL)` on `RR_TEST_MANIFEST_URL`. The release workflow sets the env var post-publish; the test then probes the auto-updater manifest URL (200 + valid JSON).

`bunx vitest run tests/release/` summary today: 1 file passes (7 tests), 3 files skip (7 tests skipped) → 14 total, 0 failures. Same shape `bun run verify` will see in CI.

### Task 3 — devDeps + a11y harness + .gitignore (commit `bd87f20`)

**Workspace root `package.json`:** added `@axe-core/playwright@^4.11.3` to devDependencies. After `bun install`: `node_modules/@axe-core/playwright@4.11.3` resolves at the root for the a11y suite.

**`packages/core/package.json`:** added a `devDependencies` block with `tsup@^8.5.1` + `typescript@^6.0.2`. Workspace hoisting placed both under `packages/core/node_modules/`. typescript@6.0.2 matches the desktop devDep version exactly — no transitive resolution drift across the workspace.

**`packages/desktop/tests/a11y/playwright.config.ts`** — Distinct from the existing `packages/desktop/playwright.config.ts` (UI suite on port 5173 + Vite dev). The a11y harness:
- `testMatch: "**/audit.spec.ts"` (only the a11y spec, not the UI suite).
- `webServer: "bunx vite preview --port 4173 --strictPort"` with `cwd: "../.."` (run from `packages/desktop` root).
- `fullyParallel: false`, `workers: 1` — single web server, predictable axe output.

**`packages/desktop/tests/a11y/audit.spec.ts`** — `test.skip(!hasDist, …)` so the spec is a no-op until `bun run --cwd packages/desktop build` produces `dist/`. Runs `AxeBuilder` with `withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])`, partitions findings by impact, fails only on `critical` or `serious` (D-20 pass criterion). `moderate` and `minor` findings logged via `console.warn` and tracked in `05-A11Y-AUDIT.md` (Wave 4 deliverable). Biome auto-reordered the imports during pre-commit (alphabetical) — the literal `AxeBuilder` import + impact filter both still present.

**`packages/desktop/package.json`:** added `"test:a11y": "playwright test --config=tests/a11y/playwright.config.ts"`.

**`.gitignore`:** appended a `# Build artifacts (Phase 5)` section with explicit `packages/core/dist/` and `packages/desktop/artifacts/`. Note: broader globs `dist` (line 12) and `artifacts/` (line 24) already match these paths; the explicit lines are required by the plan acceptance criteria so future readers know precisely where Phase 5 build output lands.

## Decisions Made

1. **Out-of-Scope sub-table format.** Plan acceptance criteria use grep patterns `^|.*macOS .dmg distribution in v1.0` (markdown table syntax). The existing PROJECT.md `### Out of Scope` is a bullet list. Rather than convert the entire list to a table (high blast radius, breaks the existing 14 list items' formatting), I appended a new `### v1.0 Deferrals (Phase 5 packaging scope)` sub-table after the bullet list. The 5 deferral rows are tabular; the pre-existing v1 deferrals stay as bullets.

2. **ROADMAP.md narrative-summary lines fixed in lockstep with Goal/Done-when.** The plan's <action> block enumerated only the Goal line + four Done-when lines. But ROADMAP.md also contains a 2-line narrative summary at lines 232-233 that still referenced `@roadmap-viewer/core`/`@roadmap-viewer/react` and "macOS `.dmg`, Windows `.exe`, Ubuntu `.deb`". The acceptance criterion `grep -rn "@roadmap-viewer" .planning/REQUIREMENTS.md .planning/PROJECT.md .planning/ROADMAP.md` requires 0 matches across the three files. Treated as Rule 1 (bug — file-internal inconsistency would surface in Wave 1's grep test and CI gate). Fixed inline.

3. **`.gitignore` explicit lines.** Plan acceptance criteria require literal `packages/core/dist/` and `packages/desktop/artifacts/` lines. The existing broad `dist` (line 12) and `artifacts/` (line 24) already match — but the explicit lines act as documentation: future readers know exactly where Phase 5 build output goes without grepping for the broad patterns. Appended under a clear section header.

4. **Smoke-test of bump-version reverted via `git checkout --`.** Per plan acceptance criterion: `bun scripts/bump-version.ts 99.99.99` runs, all 5 files updated to 99.99.99, then `git checkout --` reverts the changes. The script body itself is committed; only its smoke-test side effects were reverted. (Tested + verified before commit.)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] ROADMAP.md narrative summary lines (232-233) referenced stale `@roadmap-viewer/` and 3-platform shape**
- **Found during:** Task 1 verification (`grep -rn "@roadmap-viewer" .planning/ROADMAP.md` returned line 233).
- **Issue:** The plan's <action> block enumerated only the `**Goal:**` line and four `**Done when:**` lines. But ROADMAP.md also contained a 2-line narrative-summary block at lines 232-233 that listed the old stale strings (`@roadmap-viewer/core`, `@roadmap-viewer/react`, "macOS `.dmg`, Windows `.exe`, Ubuntu `.deb` native installers", "canary + stable channels"). Leaving these stale would (a) fail the plan's own acceptance criterion, (b) make the requirements-edits.test.ts grep test red despite all the named edits being applied, and (c) propagate stale strings into Wave 1's grep-based verification.
- **Fix:** Rewrote both narrative-summary lines to match the locked Phase 5 scope (Windows .exe in .zip + Linux .tar.gz, stable channel only, `@roadraven/core` + `@roadraven/plugin-claude-code`, etc.).
- **Files modified:** `.planning/ROADMAP.md` (lines 232-233 in original; now part of Phase 5 narrative summary).
- **Commit:** `80ec194`.

**2. [Rule 3 - Blocker] `bun install` in worktree was a prerequisite for Tasks 2 and 3 verifications**
- **Found during:** First commit attempt — the worktree was provisioned without `node_modules/`. Pre-commit husky hook attempted to run vitest configs and failed with `Cannot find module '@vitejs/plugin-react'`. The commit still landed because lint-staged found no matching staged files, but Tasks 2 and 3 verifications (`bunx vitest run tests/release/`, `bun run --cwd packages/desktop test`) would not have been runnable without `bun install`.
- **Fix:** Ran `bun install` in the worktree before Task 2 verification. 1105 packages installed in ~3.8s.
- **Files modified:** none (transient install, cleaned up by `bun install` rerun in Task 3 with the new devDeps).
- **Commit:** Folded into Task 2 (`6515066`) and Task 3 (`bd87f20`) since both touched `bun.lock` after their devDeps were added.

### Out of Scope (deferred — not fixed)

- **fallow `Test-only production dependencies` warning on `@tailwindcss/vite`** — fallow's pre-commit info hook reports `@tailwindcss/vite` as test-only-but-in-dependencies. This is a pre-existing finding from before Phase 5 (the desktop package's dep declaration); not caused by Wave-0 changes. Per CLAUDE.md `fallow` is informational only and not gated. Out of Plan 05-01 scope.

## Authentication Gates

None occurred. All work was filesystem + npm install + vitest.

## Verification Results

```
$ grep -rn "@roadmap-viewer" .planning/REQUIREMENTS.md .planning/PROJECT.md .planning/ROADMAP.md
(empty — 0 matches)

$ grep -c "macOS \`.dmg\` distribution in v1.0" .planning/PROJECT.md
1

$ bun run scripts/check-core-deps.ts
✓ packages/core has 1 dependencies, all on the allowlist.

$ bun scripts/bump-version.ts xyz 2>&1 | grep -c "Invalid version"
1   (exit code 1 confirmed)

$ bunx vitest run tests/release/requirements-edits.test.ts
 Test Files  1 passed (1)
      Tests  7 passed (7)
   Duration  184ms

$ bunx vitest run tests/release/
 Test Files  1 passed | 3 skipped (4)
      Tests  7 passed | 7 skipped (14)
   Duration  207ms

$ test -d node_modules/@axe-core/playwright && echo OK
OK

$ test -f packages/desktop/tests/a11y/audit.spec.ts && test -f packages/desktop/tests/a11y/playwright.config.ts && echo OK
OK

$ grep -q "packages/core/dist/" .gitignore && grep -q "packages/desktop/artifacts/" .gitignore && echo OK
OK

$ bun run --cwd packages/desktop test
 Test Files  53 passed (53)
      Tests  452 passed (452)
   Duration  7.65s

$ bun run --cwd packages/desktop typecheck
$ tsc --noEmit
(no output — clean)
```

All `must_haves.truths` from plan frontmatter satisfied:
1. ✓ REQUIREMENTS.md PACK-01/PACK-02/PACK-04 reflect locked decisions D-05/D-08/D-11 and R-01.
2. ✓ PROJECT.md `## Active` Packaging line + `### v1.0 Deferrals` table reflect scope reductions (no @roadraven/react, no macOS, no canary, no .deb, no signing).
3. ✓ Core dependency allowlist script exists and rejects anything outside { zod }.
4. ✓ Lockstep version bump script writes all four package.json `version` fields plus `electrobun.config.ts` `app.version` atomically (smoke-tested with 99.99.99 → reverted).
5. ✓ Release-test scaffolding files exist; requirements-edits unconditional + 7/7 green; installer-artifacts/core-exports/manifest-url skip-gated and skip cleanly.
6. ✓ `@axe-core/playwright@4.11.3` at workspace root; `tsup@8.5.1` + `typescript@6.0.2` in `packages/core` devDeps.
7. ✓ `.gitignore` covers `packages/core/dist/` and `packages/desktop/artifacts/` (explicit lines added).

## Self-Check: PASSED

Created files (all verified present):
- ✓ `scripts/check-core-deps.ts`
- ✓ `scripts/bump-version.ts`
- ✓ `tests/release/installer-artifacts.test.ts`
- ✓ `tests/release/core-exports.test.ts`
- ✓ `tests/release/requirements-edits.test.ts`
- ✓ `tests/release/manifest-url.test.ts`
- ✓ `packages/desktop/tests/a11y/playwright.config.ts`
- ✓ `packages/desktop/tests/a11y/audit.spec.ts`

Commits (all verified in `git log --oneline -5`):
- ✓ `80ec194` docs(05-01): rewrite PACK-01/02/04 + PROJECT scope per D-05/D-08/D-11/R-01
- ✓ `6515066` test(05-01): add release-test scaffolds + check-core-deps + bump-version scripts
- ✓ `bd87f20` chore(05-01): add a11y harness + Phase 5 devDeps + .gitignore artifacts

No missing items.
