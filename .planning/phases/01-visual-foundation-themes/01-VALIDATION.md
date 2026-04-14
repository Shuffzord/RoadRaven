---
phase: 1
slug: visual-foundation-themes
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-13
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 3.1.1 |
| **Config file** | `packages/desktop/vitest.config.ts` |
| **Quick run command** | `bunx vitest run` |
| **Full suite command** | `bunx vitest run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `bunx vitest run`
- **After every plan wave:** Run `bunx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 1 | THEME-01 | — | N/A | unit | `bunx vitest run` | ❌ W0 | ⬜ pending |
| 01-01-02 | 01 | 1 | THEME-02 | — | N/A | unit | `bunx vitest run` | ❌ W0 | ⬜ pending |
| 01-01-03 | 01 | 1 | THEME-03 | — | N/A | unit | `bunx vitest run` | ❌ W0 | ⬜ pending |
| 01-02-01 | 02 | 2 | THEME-05 | — | N/A | unit | `bunx vitest run` | ❌ W0 | ⬜ pending |
| 01-03-01 | 03 | 3 | THEME-04 | T-01-01 | CSS injection whitelist on themeConfig color values | unit | `bunx vitest run` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `jsdom` — install for component test environment
- [ ] `vitest.config.ts` — add `environmentMatchGlobs` for UI test files
- [ ] Test stubs for ThemeProvider, token assertions, component rendering

*Existing vitest infrastructure covers framework needs; jsdom is the only addition.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Visual match to variant-c-merged.html | THEME-02 | Visual comparison | Open app, compare side-by-side with design reference |
| OS prefers-color-scheme reactive update | THEME-03 | Requires OS setting change | Change OS dark/light mode, verify app follows |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
