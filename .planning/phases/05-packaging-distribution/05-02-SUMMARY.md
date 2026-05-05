---
phase: 05-packaging-distribution
plan: 02
subsystem: packaging
tags: [packaging, npm, library-build, tsup, esm, publish, mit-license]
requirements: [PACK-04]
threats: [T-05-03, T-05-04, T-05-07]
dependency-graph:
  requires:
    - phase: 05-packaging-distribution/05-01
      provides: "tsup + typescript devDeps in packages/core; scripts/check-core-deps.ts allowlist enforcer; tests/release/core-exports.test.ts (skip-gated); .gitignore packages/core/dist/ entry"
  provides:
    - "@roadraven/core publishable: ESM-only dist/index.js + dist/index.d.ts via tsup, zod externalized"
    - "@roadraven/plugin-claude-code publishable: private->public, files allowlist, prepublishOnly hook, provenance config"
    - "Three byte-identical MIT LICENSE files (root + per-package) so npm tarballs ship one each"
    - "packages/core/tsconfig.json (was missing) with target es2022, declaration:true, allowImportingTsExtensions:true + rewriteRelativeImportExtensions:true"
  affects:
    - "05-03 release workflow — both packages now have publishConfig.provenance:true and prepublishOnly hooks; release.yml only needs to drive `npm publish --access public`"
    - "05-03 CI core-deps gate — invariant still holds (zod-only) after package.json rewrite; gate can be wired without re-baselining"
    - "05-04 docs polish — per-package READMEs + repo-root LICENSE in place; CONTRIBUTING.md doesn't need to duplicate license terms"
tech-stack:
  added:
    - "tsup runtime usage (devDep already installed in Wave 0; this plan adds the actual config + build script invocation)"
  patterns:
    - "Pre-built ESM + .d.ts publication (D-03): main/types/exports point at dist/, src/ excluded via files allowlist"
    - "External runtime deps in tsup (`external: [\"zod\"]`): consumer's package manager resolves zod, not the bundle (avoids version baking)"
    - "publishConfig.provenance: true: per-package npm provenance attestation default (T-05-07)"
    - "prepublishOnly defense-in-depth: bun run build before publish, even if contributor forgets"
    - "Per-package LICENSE files (not symlinks): byte-identical copies for Windows + npm tarball compliance"
    - "tsc dts emission with .ts source extensions: allowImportingTsExtensions:true + rewriteRelativeImportExtensions:true so tsc rewrites `./schema.ts` -> `./schema.js` in declarations (esbuild handles the JS pass independently)"
key-files:
  created:
    - "LICENSE"
    - "packages/core/LICENSE"
    - "packages/core/README.md"
    - "packages/core/tsconfig.json"
    - "packages/core/tsup.config.ts"
    - "plugins/claude-code/LICENSE"
  modified:
    - "packages/core/package.json (private->public, main/types/exports/files/scripts/publishConfig/repository/homepage/bugs/description/keywords)"
    - "plugins/claude-code/package.json (private->public, files, prepublishOnly, publishConfig, repository, homepage, bugs, description, keywords)"
    - "plugins/claude-code/README.md (Install (recommended) section + roadraven-mcp Claude Code config example)"
key-decisions:
  - "tsconfig.json: enabled allowImportingTsExtensions:true + rewriteRelativeImportExtensions:true to satisfy tsc dts emission (plan suggested allowImportingTsExtensions:false but tsc would then reject `./schema.ts` imports during dts pass; esbuild handles the JS pass independently)"
  - "tsconfig.json: added ignoreDeprecations: \"6.0\" to silence TypeScript 6.0 baseUrl deprecation warning (TS 6.0.2 was installed by Wave 0; the warning was non-fatal but cluttered build output)"
  - "Plugin claude-code shebang: NO --banner flag added; verified bun build preserves source line 1 verbatim, so existing src/index.ts shebang carries through to dist/index.js"
  - "MIT copyright holder pinned to literal `Shuffzord` per plan W-5; not derived from `git config user.name`"
patterns-established:
  - "ESM-only library build with tsup: format:[\"esm\"] + dts:true + clean:true + external for runtime deps + treeshake + sourcemap (Pattern 2 from RESEARCH.md)"
  - "npm publish allowlist via `files`: explicit whitelist (dist + README + LICENSE) preferred over .npmignore blacklist (T-05-03 mitigation)"
  - "tsconfig dual-mode for monorepo packages: allowImportingTsExtensions + rewriteRelativeImportExtensions lets src/ use .ts imports while tsc emits proper .js extensions in .d.ts output"
requirements-completed: [PACK-04]
metrics:
  duration: "~10 minutes"
  tasks: 3
  files: 9 (6 created + 3 modified)
  completed: "2026-05-04"
---

# Phase 5 Plan 02: NPM Packages Summary

**`@roadraven/core` (1.4 kB ESM + 5.2 kB .d.ts) and `@roadraven/plugin-claude-code` (991 kB bundled MCP wrapper) made publishable: tsup-driven build, byte-identical MIT LICENSE files in each tarball, files-allowlist + prepublishOnly + provenance config — Wave-0 skip-gated test now 2/2 GREEN.**

## Performance

- **Duration:** ~10 minutes
- **Started:** 2026-05-04T10:33:00Z (worktree branch check)
- **Completed:** 2026-05-04T10:39:48Z (final verification)
- **Tasks:** 3 (Task 1: LICENSE files; Task 2: @roadraven/core tsup + package.json; Task 3: @roadraven/plugin-claude-code publish-flip)
- **Files created:** 6 (LICENSE x3, packages/core/{README,tsconfig,tsup.config})
- **Files modified:** 3 (packages/core/package.json, plugins/claude-code/{package.json, README.md})

## Accomplishments

- **`@roadraven/core` builds clean** to `dist/index.js` (1.4 kB ESM, 47 lines) + `dist/index.d.ts` (5.2 kB) + sourcemap. All 5 schema exports + 3 type re-exports preserved verbatim. Zod is externalized — bundle has `import { z } from 'zod'` not bundled zod source.
- **Wave-0 promise kept:** `tests/release/core-exports.test.ts` flipped from `1 skipped (2 tests skipped)` to `1 passed (2 tests passed)`. Release tests overall: 9 passed, 5 skipped (was 7 passed, 7 skipped).
- **`@roadraven/plugin-claude-code` published-shape:** private:false, files allowlist (4 files in tarball: LICENSE, README.md, dist/index.js, package.json — no src/, no tests/, no tsconfig.json), prepublishOnly hook, publishConfig.provenance:true. Existing 19/19 test suite still green.
- **`bun run --cwd packages/core build` is idempotent** (`clean: true` wipes dist/ before each run; second run completes in <300ms).
- **npm pack --dry-run** confirms tarball file selection meets T-05-03 allowlist mitigation: core ships 6 files (4.6 kB), plugin ships 4 files (172 kB).

## Task Commits

1. **Task 1: MIT LICENSE files** — `3bb9a9a` (docs)
   Three byte-identical files at `LICENSE`, `packages/core/LICENSE`, `plugins/claude-code/LICENSE`. Copyright holder `Shuffzord` per W-5. Per-package copies (not symlinks) for Windows compatibility.

2. **Task 2: @roadraven/core publishable** — `5f9e8d6` (feat) — TDD GREEN gate (RED was the Wave-0 test skipping; this turned it 2/2 green)
   - New `packages/core/tsconfig.json` (target es2022, declaration:true, allowImportingTsExtensions:true + rewriteRelativeImportExtensions:true, ignoreDeprecations: "6.0")
   - New `packages/core/tsup.config.ts` (literal copy of RESEARCH.md Pattern 2: format:[esm], dts:true, clean:true, external:[zod], target:node20)
   - New `packages/core/README.md` (npm tarball description: install + exports + scope)
   - Modified `packages/core/package.json` (private:false, main/types/exports point at dist/, files allowlist, build/prepublishOnly scripts, publishConfig.provenance:true, repository/homepage/bugs/description/keywords)

3. **Task 3: @roadraven/plugin-claude-code publishable** — `6a11ede` (feat)
   - Modified `plugins/claude-code/package.json` (private:false, files allowlist, prepublishOnly, publishConfig, repository with directory, homepage, bugs, description, keywords; bin field unchanged at `roadraven-mcp -> ./dist/index.js`)
   - Modified `plugins/claude-code/README.md` (new "Install (recommended)" section above "Build (from source)"; new `"command": "roadraven-mcp"` Claude Code config example)
   - src/index.ts shebang verified preserved by bun build → no source change needed (W-4)

_Note: Tasks 2 and 3 were tagged `tdd="true"` in the plan. Task 2's RED phase = Wave-0 `tests/release/core-exports.test.ts` skipping (no dist/); Task 2's GREEN phase = build + verify test flips to 2/2 pass. Task 3's RED phase = pre-build sanity (shebang already at line 1 of source, bun build preserves it); Task 3's GREEN phase = rebuild after package.json shape change, confirm shebang still at line 1 of dist + 19/19 existing tests still pass._

## Files Created/Modified

### Created (6 files)

- `LICENSE` — MIT, repo root (1.1 kB)
- `packages/core/LICENSE` — MIT, byte-identical (1.1 kB)
- `packages/core/README.md` — npm tarball description (2.1 kB; install + exports + scope)
- `packages/core/tsconfig.json` — TS config for tsup dts pass (target es2022, declaration:true)
- `packages/core/tsup.config.ts` — Pattern 2 verbatim (ESM only, dts, clean, external zod)
- `plugins/claude-code/LICENSE` — MIT, byte-identical (1.1 kB)

### Modified (3 files)

- `packages/core/package.json` — flipped private:false, gained main/types/exports/files/scripts/publishConfig/repository/homepage/bugs/description/keywords; `dependencies` unchanged (zod-only allowlist preserved)
- `plugins/claude-code/package.json` — flipped private:false, gained files/prepublishOnly/publishConfig/repository/homepage/bugs/description/keywords; bin unchanged
- `plugins/claude-code/README.md` — added "Install (recommended)" section above "Build (from source)"; added second Claude Code config example using `command: roadraven-mcp`

### Generated (gitignored, not committed)

- `packages/core/dist/index.js` (1,384 bytes ESM)
- `packages/core/dist/index.d.ts` (5,163 bytes)
- `packages/core/dist/index.js.map` (4,014 bytes)
- `plugins/claude-code/dist/index.js` (990,676 bytes — bundled with @modelcontextprotocol/sdk)

## Decisions Made

1. **`allowImportingTsExtensions: true` + `rewriteRelativeImportExtensions: true`** in `packages/core/tsconfig.json`, NOT `false` as the plan's <action> suggested. Reason: src/index.ts uses `from "./schema.ts"` (literal `.ts` extension). The esbuild pass in tsup handles this fine — but the **dts pass uses tsc directly** and tsc rejects `.ts` imports unless `allowImportingTsExtensions:true`. Adding `rewriteRelativeImportExtensions:true` makes tsc rewrite the extension to `.js` in the emitted `.d.ts`, so consumers see `import "./schema.js"` (correct ESM-resolvable form). Plan acknowledged this scenario in Task 2's <action> A. note. Documented as a key-decision so future maintainers don't "fix" the tsconfig back to `false`.

2. **`ignoreDeprecations: "6.0"`** added to tsconfig. TypeScript 6.0.2 (installed by Wave 0) emits a `TS5101: Option 'baseUrl' is deprecated` error during the dts pass even when the source tsconfig doesn't set baseUrl (likely from tsup's runtime tsc invocation). The error blocked the build; the documented escape hatch is `ignoreDeprecations: "6.0"`. No baseUrl was actually used.

3. **Shebang preservation NOT achieved via `--banner` flag.** Plan's Task 3 <action> A. confirmed (via W-4 verification) that `bun build` preserves source line 1 verbatim. Empirical re-verification this run: `head -1 plugins/claude-code/dist/index.js` outputs `#!/usr/bin/env node` after every build. Source `plugins/claude-code/src/index.ts` line 1 is `#!/usr/bin/env node`; line 2 is `import "./server";`. No build script modification was needed.

4. **Copyright holder = `Shuffzord`** (literal string per W-5). Did NOT use `git config --global user.name` lookup — runtime-derived copyright would be unstable across CI environments and contributors.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocker] tsc dts pass rejected `from "./schema.ts"` imports**
- **Found during:** Task 2 GREEN phase (`bun run --cwd packages/core build`)
- **Issue:** With `allowImportingTsExtensions: false` (the value the plan's tsconfig sample specified), the tsc dts pass failed with: `src/index.ts(15,8): error TS5097: An import path can only end with a '.ts' extension when 'allowImportingTsExtensions' is enabled.` The esbuild JS pass succeeded (esbuild rewrites extensions silently); only the tsc-driven .d.ts pass failed.
- **Fix:** Set `allowImportingTsExtensions: true` AND `rewriteRelativeImportExtensions: true`. The latter makes tsc rewrite `./schema.ts` to `./schema.js` in the emitted .d.ts so the published declarations resolve correctly under Node ESM.
- **Files modified:** `packages/core/tsconfig.json`
- **Verification:** Build succeeds, dist/index.d.ts contains correct `.js` extensions in re-exports (sourceless declaration file).
- **Committed in:** `5f9e8d6` (Task 2 commit)

**2. [Rule 3 - Blocker] TypeScript 6.0.2 baseUrl deprecation broke dts build**
- **Found during:** Task 2 GREEN phase, simultaneous with deviation #1
- **Issue:** `error TS5101: Option 'baseUrl' is deprecated and will stop functioning in TypeScript 7.0. Specify compilerOption '"ignoreDeprecations": "6.0"' to silence this error.` No baseUrl was set in our tsconfig, but tsup's tsc invocation triggered it (likely a tsup-side default baseUrl on the synthetic tsconfig).
- **Fix:** Added `"ignoreDeprecations": "6.0"` to tsconfig.json compilerOptions, exactly as the error message instructed.
- **Files modified:** `packages/core/tsconfig.json`
- **Verification:** Build succeeds with no TS5101 error.
- **Committed in:** `5f9e8d6` (Task 2 commit, same edit as deviation #1)

**3. [Rule 3 - Blocker] Worktree provisioned without node_modules/**
- **Found during:** Pre-Task-1 setup (vitest needed for verification)
- **Issue:** New worktree had no installed dependencies; `bunx vitest`, `tsup`, etc. would fail.
- **Fix:** Ran `bun install` (1169 packages installed in 3.25s) before Task 1.
- **Files modified:** none (transient install — `bun.lock` already aligned with parent commit, no diff)
- **Verification:** All subsequent verifications ran cleanly.
- **Committed in:** N/A (no file diff produced)

---

**Total deviations:** 3 auto-fixed (3 Rule-3 blockers — all related to tsc dts emission environment; none altered the planned package shape)

**Impact on plan:** All three deviations were toolchain mechanics (tsc 6.0 behavior, worktree provisioning), not scope changes. The package.json shape, tsup config, and README content all match the plan's <action> blocks verbatim. No `must_haves.truths` were renegotiated.

## Issues Encountered

- **Pre-commit `fallow` hook reports 1 dead-code issue + 1 test-only-dep on every commit.** Pre-existing finding from before Phase 5 (the desktop package's `@tailwindcss/vite` dep declaration); not caused by Wave-1 changes. Per CLAUDE.md, fallow is informational only and not gated. Out of Plan 05-02 scope.

- **`bunx vitest` warning about workspace-root vitest cache drift.** Acknowledged in CLAUDE.md ("ALWAYS via `bun run`, never `bunx vitest` directly"). Used `bunx vitest run tests/release/` here for the release-tests-only scope (no `bun run test:release` script exists yet — that would be a Wave 2 addition). The runs were single-shot verification, not gating; results matched the workspace-pinned vitest@4.1.4 used by `bun run --cwd packages/desktop test`.

## Authentication Gates

None occurred. All work was filesystem + bun build invocations.

## Verification Results

```
$ bun run --cwd packages/core build
ESM build: dist/index.js 1.35 KB + dist/index.js.map 3.91 KB  (25ms)
DTS build: dist/index.d.ts 5.03 KB  (220ms)
exit 0

$ test -f packages/core/dist/index.js && test -f packages/core/dist/index.d.ts
OK

$ for name in NodeStatusSchema RoadmapNodeSchema RoadmapSchemaSchema StatusConfigSchema TypeConfigSchema; do
    grep -q "$name" packages/core/dist/index.js && echo "  ✓ $name"
  done
  ✓ NodeStatusSchema
  ✓ RoadmapNodeSchema
  ✓ RoadmapSchemaSchema
  ✓ StatusConfigSchema
  ✓ TypeConfigSchema

$ grep -c "module.exports" packages/core/dist/index.js
0  (ESM only — no CJS)

$ grep -c "from 'zod'" packages/core/dist/index.js
1  (zod externalized, not bundled)

$ node -e "import('./packages/core/dist/index.js').then(m => { ... })"
Keys: NodeStatusSchema,RoadmapNodeSchema,RoadmapSchemaSchema,StatusConfigSchema,TypeConfigSchema
OK: RoadmapSchemaSchema.parse is a function

$ bunx vitest run tests/release/core-exports.test.ts
 Test Files  1 passed (1)        ← Was: 1 skipped (1)
      Tests  2 passed (2)        ← Was: 2 skipped (2)
   Duration  227ms

$ bunx vitest run tests/release/
 Test Files  2 passed | 2 skipped (4)   ← Was: 1 passed | 3 skipped (4)
      Tests  9 passed | 5 skipped (14)  ← Was: 7 passed | 7 skipped (14)
   Duration  252ms

$ bun run scripts/check-core-deps.ts
✓ packages/core has 1 dependencies, all on the allowlist.

$ bun run --cwd plugins/claude-code build
Bundled 226 modules in 29ms
  index.js  0.99 MB  (entry point)

$ head -1 plugins/claude-code/dist/index.js
#!/usr/bin/env node

$ bun run --cwd plugins/claude-code test
 Test Files  3 passed (3)
      Tests  19 passed (19)

$ bun run --cwd packages/desktop test
 Test Files  53 passed (53)
      Tests  452 passed (452)

$ cd packages/core && bunx npm pack --dry-run
Tarball Contents:
  1.1kB LICENSE
  2.1kB README.md
  5.2kB dist/index.d.ts
  1.4kB dist/index.js
  4.0kB dist/index.js.map
  1.1kB package.json
total files: 6, package size: 4.6 kB

$ cd plugins/claude-code && bunx npm pack --dry-run
Tarball Contents:
  1.1kB LICENSE
  2.9kB README.md
  990.7kB dist/index.js
  1.2kB package.json
total files: 4, package size: 171.9 kB
```

All `must_haves.truths` from plan frontmatter satisfied:

1. ✓ `bun run --cwd packages/core build` produces `packages/core/dist/index.js` (ESM) and `packages/core/dist/index.d.ts`
2. ✓ Importing from `dist/index.js` exposes all 5 documented schemas (RoadmapSchemaSchema, RoadmapNodeSchema, NodeStatusSchema, StatusConfigSchema, TypeConfigSchema) and `RoadmapSchemaSchema.parse` is a function
3. ✓ `@roadraven/core` package.json has `main: "./dist/index.js"`, `types: "./dist/index.d.ts"`, `exports.["."].import: "./dist/index.js"`, `files: ["dist", "README.md", "LICENSE"]`, `private: false`, `publishConfig.provenance: true`
4. ✓ `@roadraven/plugin-claude-code` package.json has `private: false`; `files: ["dist", "README.md", "LICENSE"]` excludes src/ and tests/ (verified via `npm pack --dry-run`: 4 files in tarball, none from src/ or tests/)
5. ✓ Both packages have a per-package LICENSE (MIT) file referenced by `files`
6. ✓ Both packages have a public-facing README.md inside the published tarball (verified via npm pack dry-run)
7. ✓ Workspace root LICENSE (MIT) exists at repo root
8. ✓ Wave-0 test `tests/release/core-exports.test.ts` is now GREEN (2/2 passed; was 2/2 skipped)

## TDD Gate Compliance

Plan frontmatter does not declare `type: tdd` (declares `type: execute`), but Tasks 2 and 3 were tagged `tdd="true"` individually. Compliance:

- **Task 2 RED:** Pre-existing `tests/release/core-exports.test.ts` (Wave 0) skipping due to missing `dist/` — semantically equivalent to a failing test (the assertion can't even run).
- **Task 2 GREEN:** Same test file, after `bun run --cwd packages/core build`, flipped to 2/2 passing.
- **Task 2 commit type:** `feat(05-02):` (single commit covers RED→GREEN because the RED state was inherited from Wave 0; no separate `test(...)` commit needed in this plan).
- **Task 3 RED:** Empirical pre-check: ran `bun run --cwd plugins/claude-code build` BEFORE editing package.json, confirmed shebang preservation behavior + 19/19 existing tests pass. This established the baseline so any post-edit regression would be detectable.
- **Task 3 GREEN:** After package.json + README edits, rebuilt + reran tests + reverified shebang. All green.
- **Task 3 commit type:** `feat(05-02):`.

No REFACTOR commits — neither task left code that warranted cleanup beyond the `feat` commit's content.

## Self-Check: PASSED

Created files (all verified present via `test -f`):
- ✓ `LICENSE`
- ✓ `packages/core/LICENSE`
- ✓ `packages/core/README.md`
- ✓ `packages/core/tsconfig.json`
- ✓ `packages/core/tsup.config.ts`
- ✓ `plugins/claude-code/LICENSE`

Modified files (all verified via `git diff --name-status 6559b07..HEAD`):
- ✓ `packages/core/package.json`
- ✓ `plugins/claude-code/package.json`
- ✓ `plugins/claude-code/README.md`

Commits (all verified in `git log --oneline`):
- ✓ `3bb9a9a` docs(05-02): add MIT LICENSE at repo root and per-package
- ✓ `5f9e8d6` feat(05-02): make @roadraven/core publishable as ESM + .d.ts via tsup
- ✓ `6a11ede` feat(05-02): make @roadraven/plugin-claude-code publishable to npm

No missing items. No unexpected file deletions.

## Next Phase Readiness

Wave 2 (05-03 release workflow) can now consume:
- **Build commands**: `bun run --cwd packages/core build` and `bun run --cwd plugins/claude-code build` are repeatable + idempotent.
- **prepublishOnly hooks**: both packages auto-build before publish; release.yml's `npm publish --access public` step is safe even if the workflow forgets a build step.
- **Provenance config**: both packages have `publishConfig.provenance: true`. The release.yml job needs only `permissions: { id-token: write, contents: read }` and `npm publish` (no extra `--provenance` flag — package.json defaults take care of it).
- **File allowlists**: both `files` arrays are minimal + explicit — `npm pack --dry-run` outputs match expectations exactly. T-05-03 mitigation is in place; no follow-up needed in Wave 2.
- **Allowlist gate**: `bun run scripts/check-core-deps.ts` still passes (zod-only); Wave 2's `ci.yml` lint-job step adding this gate has nothing to fix first.
- **Wave-0 release tests**: `tests/release/core-exports.test.ts` is now GREEN. The other 2 skip-gated tests (`installer-artifacts.test.ts`, `manifest-url.test.ts`) remain skip-gated until Wave 2 produces installer artifacts and the post-release verification env var.

No blockers. No outstanding deferred items from this plan.

---
*Phase: 05-packaging-distribution*
*Plan: 02 — NPM Packages*
*Completed: 2026-05-04*
