---
created: 2026-05-05
purpose: Tracks deferred findings and follow-up work that did not gate any phase but should be revisited.
---

# Backlog

Single-source list of follow-up items deferred from phase reviews and verifications. Each entry cites the phase it came from so the trail back to the original analysis is preserved.

## Phase 5 (packaging-distribution) — verifier dispositions

These are the warnings/info items from `.planning/phases/05-packaging-distribution/05-REVIEW.md` that the Phase 5 verifier (`05-VERIFICATION.md`) recommended deferring. None block v1.0 ship.

| Code | Title | Disposition | Notes |
|------|-------|-------------|-------|
| W-01 | `release.yml` workflow-level permissions over-scoped | Defer | `contents: write` + `id-token: write` at workflow scope. Tighten to per-job least-privilege when next touching release.yml. The two npm publish jobs DO need `id-token: write`; the cleanup is splitting `contents: write` to only the `github-release` job. |
| W-03 | `bump-version.ts` regex replace uses no `g` flag | Defer | B-04's `cfgUpdated === cfg` guard catches the no-op case. The first-match-only behavior is correct for the current `electrobun.config.ts` shape (single top-level `version:` field). Anchor to `app:` block if more `version:` fields appear. |
| W-05 | `check-core-deps.ts` hard-codes relative path from cwd | Defer | CI always invokes from repo root. Local-dev convenience only — tracked here for future portability if scripts move. |
| W-07 | `useKeyboardRouter` Ctrl+C empty-focused branch leaks default browser copy | Accept / Defer | Gray-area UX nit. File a one-line clarifying comment when next touching the file. |
| W-08 | `useKeyboardRouter` `isMenuOpen` / `isModalOpen` document-wide selectors over-broad | Defer | Pre-existing pattern. Tighten to Radix `data-state="open"` when next touching the file. |
| W-09 | `Canvas.tsx` onClick deselect identity comparison breaks with portals/overlays | Defer | UX nit, not goal-blocker. |
| I-01 | `bump-version.ts` `console.log` violates global "no console.log unless asked" rule | Accept | CLI scripts are the documented exception. Inline comment if the file is touched again. |
| I-02 | `electrobun.config.ts` hard-codes `version: "0.0.1"` that drifts | Accept | `RELEASE-OPS.md` covers the bump-before-tag workflow; `bump-version.ts` writes this field. Documented; not a goal-blocker. |
| I-03 | `release.yml` `softprops/action-gh-release@v2` not pinned to SHA | Defer | Supply-chain hardening. Consider Dependabot SHA-pinning as a separate hardening pass. |

## Phase 4 (event-api) — known follow-ups

| Code | Title | Disposition | Notes |
|------|-------|-------------|-------|
| EV-CONN-01 | Producer connection count over-reports | Defer / small standalone | Per `.planning/STATE.md`: `plugins/claude-code/src/server.ts:9` opens wsClient at module top-level so each Claude Code session contributes 1 connection; `wsClient.ts:55-65` `close` handler unconditionally calls `scheduleReconnect`, racing with `connectLoop`'s while-iteration on error+close double-events. Fix scope is small. |

## Phase 3 (full editor) — known follow-up

| Code | Title | Disposition | Notes |
|------|-------|-------------|-------|
| G-01 | Subtree paste validator surfaces misleading enum/required-field error | Defer | Handled gracefully, not blocking. Investigate when next touching paste validation. |

## Phase 5 (packaging-distribution) — a11y BUG-3

| Code | Title | Disposition | Notes |
|------|-------|-------------|-------|
| BUG-3 | (See `.planning/debug/05-05-a11y-keyboard-routing.md`) | Defer to v1.1 | Documented workaround in 05-A11Y-AUDIT.md. M3 user-acceptance row in audit doc remains pending sign-off as of 2026-05-05; user signed off the broader manual checklist 2026-05-05. |
