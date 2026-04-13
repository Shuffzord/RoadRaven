---
phase: 0
slug: app-scaffold
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-13
---

# Phase 0 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest + Playwright |
| **Config file** | `vitest.config.ts` (Wave 0 installs) |
| **Quick run command** | `bunx vitest run` |
| **Full suite command** | `bunx vitest run && bunx playwright test` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `bunx vitest run`
- **After every plan wave:** Run `bunx vitest run && bunx playwright test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 00-01-01 | 01 | 1 | SCAF-01 | — | N/A | integration | `bun install && echo OK` | ❌ W0 | ⬜ pending |
| 00-01-02 | 01 | 1 | SCAF-02 | — | N/A | integration | `bun run build:canary && echo OK` | ❌ W0 | ⬜ pending |
| 00-01-03 | 01 | 1 | SCAF-08 | — | N/A | unit | `grep -r "bundleCEF: true" electrobun.config.ts` | ❌ W0 | ⬜ pending |
| 00-02-01 | 02 | 1 | SCAF-03 | — | N/A | unit | `bunx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 00-02-02 | 02 | 1 | SCAF-09 | — | N/A | unit | `bunx vitest run packages/desktop/src/bun/index.test.ts` | ❌ W0 | ⬜ pending |
| 00-03-01 | 03 | 2 | SCAF-04 | — | N/A | unit | `bunx vitest run` | ❌ W0 | ⬜ pending |
| 00-03-02 | 03 | 2 | SCAF-05 | — | N/A | e2e | `bunx playwright test` | ❌ W0 | ⬜ pending |
| 00-03-03 | 03 | 2 | SCAF-06 | — | N/A | ci | `gh workflow run ci.yml` | ❌ W0 | ⬜ pending |
| 00-03-04 | 03 | 2 | SCAF-07 | — | N/A | lint | `bunx biome check .` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/desktop/src/bun/index.test.ts` — stub for SCAF-09 (Updater try/catch)
- [ ] `vitest.config.ts` — vitest configuration at workspace root
- [ ] `playwright.config.ts` — Playwright config at workspace root
- [ ] `.github/workflows/ci.yml` — CI pipeline for SCAF-06/SCAF-07

*All tests start as stubs; passing green is required before wave completes.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `bun run dev` opens blank window | SCAF-01 | Requires desktop display | Run `bun run dev`, confirm Electrobun window appears |
| First Playwright test passes locally | SCAF-05 | Requires display / Xvfb in CI | Run `bunx playwright test`, confirm window launch test passes |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
