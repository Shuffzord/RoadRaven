---
phase: 05
slug: packaging-distribution
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-03
---

# Phase 05 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Derived from `05-RESEARCH.md §"Validation Architecture"`.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.4 (existing) + Playwright 1.59.1 (existing) + `@axe-core/playwright` (Wave 0 install) |
| **Config files** | `packages/desktop/vitest.config.ts` (existing); `packages/desktop/playwright.config.ts` (existing); `packages/desktop/tests/a11y/playwright.config.ts` (NEW — Wave 0) |
| **Quick run command** | `bun run --cwd packages/desktop test` |
| **Full suite command** | `bun run verify` (test + typecheck + build + lint, root) |
| **Estimated runtime** | ~10s quick / ~60s full / ~3m a11y suite (vite preview cold start) |

---

## Sampling Rate

- **After every task commit:** Run `bun run --cwd packages/desktop test`
- **After every plan wave:** Run `bun run verify`
- **Before `/gsd-verify-work`:** Full `bun run verify` + `tests/release/*` smoke tests + `tests/a11y/audit.spec.ts` + manual a11y checklist + post-publish smoke (`bunx npm install @roadraven/core` from a clean dir, dry-run if pre-tag)
- **Max feedback latency:** 60 seconds (full suite) — well under the Nyquist target

---

## Per-Task Verification Map

> Populated by the planner during Step 8. Each task in each PLAN.md must map to a row here. Planner: ensure no run of 3 consecutive tasks lacks an automated verify step.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| _planner-fills_ | _XX_ | _N_ | _PACK-NN_ | _T-05-NN / —_ | _expected secure behavior or "N/A"_ | _unit/int/smoke_ | _command_ | _✅ / ❌ W0_ | _⬜ pending_ |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

### Reference: Phase Requirement → Test mapping (from RESEARCH.md)

| Req ID | Behavior | Test Type | Wave-0 Gap |
|--------|----------|-----------|------------|
| **PACK-01** | `electrobun build --env=stable` produces Windows installer (`{channel}-win-x64-RoadRaven-Setup-{channel}.zip` containing `-Setup.exe`) | smoke | ❌ `tests/release/installer-artifacts.test.ts` — assert artifact naming pattern after build |
| **PACK-01** | `electrobun build --env=stable` produces Linux installer (`{channel}-linux-x64-RoadRavenSetup-{channel}.tar.gz`) per R-01 (`.tar.gz`, NOT `.deb`) | smoke | ❌ same harness, linux-x64 target |
| **PACK-02** | Auto-updater `version.json` (manifest) hosted at `release.baseUrl/{channel}-{os}-{arch}-update.json` resolves to a real file | integration | ❌ `tests/release/manifest-url.test.ts` — post-release URL probe (manual smoke for v1.0; automate post-v1.0) |
| **PACK-02** | `Updater.localInfo.channel()` resolves "stable"/"dev" correctly | unit | ✅ Already covered by Phase 0 SCAF-09 regression test |
| **PACK-03** | `bundleCEF: true` on all platforms; SIGTERM handler awaits `flushPending` | unit + grep | ✅ Already true in code; add lightweight regression grep test if missing |
| **PACK-03** | Keyboard shortcuts cover all file actions (no `ApplicationMenu` dependency) | manual + grep | ❌ Wave 0 grep test (assert `ApplicationMenu` import absent) |
| **PACK-04** | `bunx npm install @roadraven/core` from a clean dir works | integration | ❌ Post-publish only — runs in a separate verify-publish workflow on tag push |
| **PACK-04** | `packages/core/package.json` dependencies within allowlist (only `zod`) | unit | ❌ `scripts/check-core-deps.ts` + ci.yml integration |
| **PACK-04** | `@roadraven/core` exports resolve in a Node ESM consumer | unit | ❌ `tests/release/core-exports.test.ts` — import-from-dist smoke |
| **PACK-05** | GitHub Pages site live at `https://shuffzord.github.io/RoadRaven/` with sidebar nav | integration | ❌ Post-deploy curl test in `deploy-docs` job |
| **PACK-05** | Plugin authoring guide's worked example (claude-code MCP wrapper) runs end-to-end | manual + integration | ✅ Phase 4 PLUG-08 acceptance test re-runs as Phase 5 audit gate |
| **PACK-06** | `@axe-core/playwright` against `vite preview` reports zero severity-blocker findings (R-04) | integration | ❌ `packages/desktop/tests/a11y/audit.spec.ts` — automated baseline |
| **PACK-06** | Manual checklist (keyboard nav through tree edits, context menu, side panel, settings drawer, save flow, theme switcher) passes | manual | Documented in `05-A11Y-AUDIT.md` |
| **All requirement edits (D-05, D-08, D-11)** | REQUIREMENTS.md and PROJECT.md edits land per R-01/R-02 reconciliation | unit | ❌ `tests/release/requirements-edits.test.ts` — grep test asserts no stale strings (`@roadmap-viewer/`, `macOS .dmg` in v1 section, `canary + stable channels`, `.deb` in v1 Linux line) |

---

## Wave 0 Requirements

Wave 0 is a pre-implementation pass that lands test scaffolds + the requirement edits themselves so subsequent waves work against correct REQUIREMENTS.md/PROJECT.md.

- [ ] `packages/desktop/tests/a11y/audit.spec.ts` — automated baseline against `vite preview`
- [ ] `packages/desktop/tests/a11y/playwright.config.ts` — `webServer: { command: "bunx vite preview", port: 4173 }` (or extend existing config)
- [ ] `tests/release/installer-artifacts.test.ts` — assert `electrobun build` outputs match expected naming pattern
- [ ] `tests/release/core-exports.test.ts` — import-from-dist smoke
- [ ] `tests/release/requirements-edits.test.ts` — grep test asserting REQUIREMENTS.md/PROJECT.md edits landed
- [ ] `tests/release/manifest-url.test.ts` — auto-updater manifest URL probe (post-release, may be skip-by-default until first tag)
- [ ] `scripts/check-core-deps.ts` — CI-runnable allowlist script (allows only `zod`)
- [ ] `scripts/bump-version.ts` — lockstep version bump script (writes all `package.json` `version` fields + `electrobun.config.ts` `app.version` from a single source-of-truth value)
- [ ] `.github/workflows/release.yml` — release workflow itself (not a test, but Wave-0 shaped — without it, Waves 1–4 can't validate end-to-end)
- [ ] `docs/_config.yml` — Jekyll config (Just-the-Docs `remote_theme`, sidebar nav)
- [ ] Add Just-the-Docs front matter to existing `docs/*.md` files (`title`, `nav_order`, optional `parent`) — no content rewrite
- [ ] Add `@axe-core/playwright@4.11.3` to workspace devDependencies
- [ ] Add `tsup@8.5.1` + `typescript` to `packages/core` devDependencies

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Production CEF rendering of `--rv-*` tokens, Radix ARIA, focus rings | PACK-06 | Audit harness runs against `vite preview` (R-04), not the CEF-bundled binary. Visual + keyboard spot-check on the installed app catches any CEF-only divergence. | After Wave 2 ships an installer, install on Windows + Linux, walk every interaction (tree edits → context menu → side panel → settings drawer → save flow → theme switcher including high-contrast). Document in `05-A11Y-AUDIT.md`. |
| First-run UX on Windows (SmartScreen warning + bypass flow) | PACK-01, README D-12 | SmartScreen reputation can't be tested in CI; only a real Windows machine with no prior install reproduces it. | Download the published `.zip` from the GitHub Release, extract, double-click `RoadRaven-Setup.exe`, follow "More info → Run anyway." Document with screenshot in README. |
| First-run UX on Linux (`.tar.gz` extract → `./RoadRavenSetup`) | PACK-01 R-01 | Self-extracting tarball flow is documented in README; needs a clean machine to verify the documented steps actually work. | On a clean Ubuntu LTS VM, download `.tar.gz`, `tar -xzf`, run `./RoadRavenSetup`, confirm app launches. Document in README. |
| GitHub Pages site visual check | PACK-05 | Curl test confirms HTTP 200 + body contains "RoadRaven" but doesn't catch broken navigation/styling. | After `deploy-pages` runs, visit `https://shuffzord.github.io/RoadRaven/` in a browser, click every sidebar link, confirm layout renders. |
| npm provenance attestation visible on the npm registry page | PACK-04 R-03 | npm UI rendering — not assertable from CLI. | After first publish, visit `https://www.npmjs.com/package/@roadraven/core` and confirm "Provenance" badge with link to the GitHub Actions run. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags in CI invocations
- [ ] Feedback latency < 60s for the per-task loop
- [ ] `nyquist_compliant: true` set in frontmatter (planner sets after coverage check)

**Approval:** pending
