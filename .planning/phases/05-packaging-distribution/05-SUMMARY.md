---
phase: 05-packaging-distribution
status: complete
completed: 2026-05-05
plans: 5
plans-completed: [05-01, 05-02, 05-03, 05-04, 05-05]
requirements-completed: [PACK-01, PACK-02, PACK-03, PACK-04, PACK-05, PACK-06]
---

# Phase 5: Packaging & Distribution — Summary

Native installers (Windows `.zip` + Linux `.tar.gz`), npm publishing for `@roadraven/core` + `@roadraven/plugin-claude-code` via OIDC trusted publishing with provenance, GitHub Pages docs site, accessibility audit (10/10 axe surfaces GREEN, WCAG 2.1 AA), CONTRIBUTING.md + README polish. v1.0 surface complete.

## Plan completion

| Plan | Title | Outcome |
|------|-------|---------|
| 05-01 | Wave-0 scaffolding | Requirements edits (D-05/D-08/D-11/R-01), release-test scaffolds, axe harness skeleton, `check-core-deps` + `bump-version` scripts, devDeps |
| 05-02 | npm packages | `@roadraven/core` ESM build via tsup with `.d.ts`, externalized zod (D-03), per-package LICENSE + READMEs, plugin-claude-code public flip |
| 05-03 | Release workflow | `release.yml` 6-job DAG with OIDC trusted publishing (no NPM_TOKEN), invariants gate in `ci.yml`, `RELEASE-OPS.md` runbook |
| 05-04 | Docs + CONTRIBUTING | Just-the-Docs site at `shuffzord.github.io/RoadRaven/`, plugin authoring guide quoting real source, `deploy-docs` job appended to release.yml |
| 05-05 | A11y audit | 10 axe surfaces GREEN (welcome, loaded, side-panel, ctx-menu dark, dialog, 4 themes, ctx-menu light); manual checklist signed off 2026-05-05 |

## Code review + verification closure

**Code review (`05-REVIEW.md`):** 4 BLOCKER + 9 WARNING + 6 INFO findings. All 4 blockers fixed in-phase before verifier ran.

| Blocker | Commit | Description |
|---------|--------|-------------|
| B-01 | `7e2b2f4` | Contrast theme `--rv-text-primary` `#666666` (3.66:1) → `#d1d1d1` (12.0:1) |
| B-02 | `7e2b2f4` | Light-theme `--rv-status-blocked` `#ef4444` (3.76:1) → `#c92020` (5.59:1) + light-theme ctx-menu test #7 added as regression guard |
| B-03 | `713e176` | `release.yml` tag glob tightened from `'v*'` to `v[0-9]+.[0-9]+.[0-9]+` (rejects `v*-canary.0`, `v*-rc.1`); regression-gated in `requirements-edits.test.ts` |
| B-04 | `4f7c60b` | `bump-version.ts`: validate-then-write — all targets parsed + cfg replacement verified BEFORE any write; aborts if regex no-ops; `packages/react/` removed (D-21) |

**Verifier (`05-VERIFICATION.md`) — gaps_found, score 5/6 → fixed post-audit:**

| Item | Commit | Description |
|------|--------|-------------|
| Truth #1 + W-06 | `4561092` | `installer-artifacts.test.ts` regex aligned to Electrobun's actual stable naming (`stable-{os}-x64-RoadRaven-Setup.{zip,tar.gz}`, no `-stable` suffix); platform-gated so each runner only asserts its own OS; fail-loud in CI when artifacts dir missing. README + release.yml comments updated. Filename ground-truth verified locally + against `electrobun@1.18.1 src/shared/naming.ts`. |
| W-02 | `e5d0426` | `permissions: contents: read` at `ci.yml` workflow scope (least-privilege) |
| W-04 | `e5d0426` | `check-core-deps.ts` extended to scan `peerDependencies` + `optionalDependencies` + `bundledDependencies` (closes evasion vector) |

**Deferred to backlog (`.planning/BACKLOG.md`):** W-01, W-03, W-05, W-07, W-08, W-09, I-01, I-02, I-03 + a11y BUG-3 (M3 user-acceptance row).

## Other in-flight work resolved during execution

- Auto-collapse on `dataKey` bump fix merged from `develop` branch (kept Phase 5 a11y wrapper, adopted develop's `initialDepth` removal)
- WAI-ARIA tree pattern fixes — chevron `tabIndex={-1}` (BUG-1), Tab handler requires `!e.shiftKey` (BUG-2). Playwright integration tests added (`tests/ui/keyboard-routing.spec.ts`) with red-then-green verification per the engineering bar set mid-phase
- Stable installer rebuilt for retest with the icon embedded (`699c26d`)
- Electrobun `1.16.0 → 1.18.1` bump kept in working tree (intentional, separate scope)

## Verification evidence

- `bun run --filter "*" test`: 471 pass (452 desktop + 19 plugin), no regressions
- `bunx vitest run tests/release/`: 12 pass, 3 skipped (Linux + manifest-url, both expected on Win)
- `bun run scripts/check-core-deps.ts`: green with new field coverage
- `bun run --cwd packages/desktop typecheck`: clean
- `bunx vite build`: production bundle clean
- `bunx @biomejs/biome lint`: only pre-existing warnings (no errors)
- Axe automated suite: 10/10 surfaces GREEN, zero critical/serious violations
- Manual a11y checklist: signed off 2026-05-05
- Local stable build produces real artifacts: `stable-win-x64-RoadRaven-Setup.zip`, `stable-win-x64-update.json`, `stable-win-x64-RoadRaven.tar.zst`

## Key decisions surfaced this phase

- **D-21 (deferred react)** — `@roadraven/react` removed from `bump-version.ts` targets. Re-add when `packages/react/` flips public.
- **D-23 (allowlist scope)** — `check-core-deps.ts` now covers all four dependency fields, not just `dependencies`.
- **Electrobun stable naming** — `buildEnvironment === "stable"` OMITS the channel suffix on bundle names. Earlier scaffolding hand-coded `*-Setup-stable.zip` / `RoadRavenSetup-stable.tar.gz` which never matched real CI artifacts. Test/README/workflow now reflect the real names.
- **Engineering bar (mid-phase course-correction)** — after a speculative `loadKey/dataKey` split broke node creation entirely (reverted at `b28cb04`), all subsequent fixes followed: hypothesis testing, integration tests written before claiming success, smaller atomic commits, never asking user to retest until agent verified locally first.

## Patterns established

- **Validate-then-write for multi-target writes**: parse all inputs + verify all replacements before any single write (B-04 in `bump-version.ts`)
- **Stable-suffix-omission convention**: when integrating with Electrobun naming, `stable` is special — produces artifacts without channel suffix
- **Platform-gated CI tests**: when test runs split across `windows-latest` and `ubuntu-latest`, gate per-platform assertions on `process.platform` so each runner only asserts what its build produced
- **Fail-loud in CI**: never `skipIf` an availability check when `process.env.CI === "true"` — masking is worse than failing
- **OIDC trusted publishing**: `id-token: write` at workflow scope + `npm publish --access public --provenance`, no `NPM_TOKEN` references
- **Dependency allowlist breadth**: enforce across `dependencies` + `peerDependencies` + `optionalDependencies` + `bundledDependencies` to close evasion vectors

## Outstanding (next phase / standalone work)

None blocking v1.0 ship. Backlog items captured in `.planning/BACKLOG.md`. Phase 4's `EV-CONN-01` (producer connection over-report) and the BUG-3 a11y deferral are independent and can ride v1.1.

## Performance

- **Plans:** 5 (4 waves; Wave 0 sequential, Waves 1–2 sequential, Wave 3 parallel)
- **Code review iterations:** 1 round (4 blockers fixed pre-verifier)
- **Verifier iterations:** 1 round (Truth #1 + W-02/W-04/W-06 fixed post-verifier)
- **Manual a11y:** 1 walkthrough on installed CEF binary, signed off 2026-05-05
- **Final commits (post-audit):** `4561092`, `e5d0426`, `e7b1500`
