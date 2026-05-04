---
phase: 05-packaging-distribution
plan: 04
subsystem: docs
tags: [packaging, docs, github-pages, just-the-docs, jekyll, contributing, readme, plugin-authoring]
requirements: [PACK-05]
threats: [T-05-06, T-05-10]
dependency-graph:
  requires:
    - phase: 05-packaging-distribution/05-01
      provides: "Wave-0 scaffolding (no docs files; this plan creates them all)"
    - phase: 05-packaging-distribution/05-03
      provides: "release.yml deploy-docs job already in place — this plan ONLY authors docs/ content; release.yml is single-owned by Plan 05-03"
  provides:
    - "docs/_config.yml — Just-the-Docs Jekyll config (remote_theme, dark color scheme, sidebar nav, baseurl /RoadRaven)"
    - "docs/index.md — landing page with Quick links table + v1 vs v1.1 split + npm package list"
    - "docs/plugin-authoring.md — Event API integration guide with claude-code MCP wrapper as the worked example (D-16)"
    - "Front matter on 5 existing docs (architecture-overview, development-guide, rpc-and-ipc, design-system, logging) — body content unchanged"
    - "CONTRIBUTING.md at repo root — local setup, tests, code style, project conventions, fallow-as-local-tool note (D-22), Documentation subsection with Ruby + Gemfile snippet (I-1)"
    - "README.md polished — new Install section per platform (Windows + Linux with chmod +x per W-3, SmartScreen note per D-12), Feature status table (16 rows v1.0 vs v1.1), Documentation links to GH Pages, Contributing link to CONTRIBUTING.md"
  affects:
    - "Plan 05-05 (a11y audit) — independent; can run in parallel"
    - "First v* tag push — Plan 05-03's deploy-docs job will pick up this plan's docs content and publish to https://shuffzord.github.io/RoadRaven/"
tech-stack:
  added:
    - "Just-the-Docs (Jekyll remote_theme) — docs site theme"
    - "jekyll-remote-theme plugin (declared in _config.yml; resolved by GH Pages Jekyll runtime)"
  patterns:
    - "Front-matter prepend pattern for Just-the-Docs nav: title + nav_order + layout: default — body content stays byte-identical"
    - "v1.0/v1.1 honest framing: every user-facing surface (README, index.md, plugin-authoring.md) carries the same v1 vs v1.1 split language so users get a consistent picture of what ships"
    - "README chmod +x callout cross-references RESEARCH.md Pitfall 6 inline — the rationale for each install step is traceable back to the research finding that motivated it"
    - "CONTRIBUTING.md frames .planning/ as orchestrator-managed (contributors do not edit directly) — protects the GSD workflow's invariants"
    - "Single-owner workflow file invariant respected: Plan 05-04 modifies 10 docs files but does NOT touch .github/workflows/release.yml (which is exclusively owned by Plan 05-03 per checker B-2/B-3)"
key-files:
  created:
    - "docs/_config.yml"
    - "docs/index.md"
    - "docs/plugin-authoring.md"
    - "CONTRIBUTING.md"
  modified:
    - "docs/architecture-overview.md (front matter prepended only)"
    - "docs/development-guide.md (front matter prepended only)"
    - "docs/rpc-and-ipc.md (front matter prepended only)"
    - "docs/design-system.md (front matter prepended only)"
    - "docs/logging.md (front matter prepended only)"
    - "README.md (added Install + Feature status + Documentation + Contributing sections; renamed Quick start → Quick start (development); preserved Features + Project structure + Electrobun)"
key-decisions:
  - "Substituted the plan's emoji checkmarks (✅/❌) in the README Feature status table with words (available/deferred/planned) — CLAUDE.md global rule prohibits emojis in files unless explicitly requested. The deviation does not lose information; column semantics are clearer with plain words anyway."
  - "Omitted the `logo: /assets/logo.png` line from the RESEARCH.md Pattern 4 _config.yml example — the repo has no logo asset. Documented as a planned future addition, not a v1 requirement."
  - "Prepended front matter to existing docs by editing the first heading line (e.g., '# Architecture Overview' → '---\\ntitle: ...\\n---\\n\\n# Architecture Overview'). Single-Edit per file; 6-line diff each. Verified body content via `head -5` plus `sed -n '7p'` showing the original heading is intact at line 7."
  - "Plugin-authoring.md worked example flesh-out used representative ~10-line snippets from the actual plugins/claude-code/src/ files (sentinel.ts retry loop, wsClient.ts open handler with hello frame, server.ts Zod tool registration, index.ts 2-line entry). The reader can fork the wrapper as a template — exactly the affordance D-16 mandates."
patterns-established:
  - "Just-the-Docs nav order: index (1) → architecture-overview (2) → development-guide (3) → rpc-and-ipc (4) → design-system (5) → logging (6) → plugin-authoring (7). Future docs slot in by claiming the next nav_order value."
  - "Per-platform install instructions in README live under sub-headings (### Windows, ### Linux, ### npm packages) so users can jump directly to their target. The npm packages subsection serves both library consumers and Event Producer authors."
  - "CONTRIBUTING.md Documentation subsection is the single canonical location for the 'how to preview docs locally' answer — Ruby + Bundler + manual Gemfile. The repo deliberately does not ship a Gemfile (CI handles published builds)."
requirements-completed: [PACK-05]
metrics:
  duration: "~14 minutes"
  tasks: 4
  files: 10
  completed: "2026-05-04"
---

# Phase 5 Plan 04: Docs Site + CONTRIBUTING + README Polish Summary

**Just-the-Docs site fully wired (config + landing page + 7-page sidebar nav with front matter); docs/plugin-authoring.md walks Event Producer authors through the claude-code MCP wrapper as a worked example; CONTRIBUTING.md gives one-stop contributor onboarding with explicit Ruby+Gemfile path for local docs preview; README polished with per-platform install (Linux chmod +x step traceable to RESEARCH.md Pitfall 6, Windows SmartScreen warning per D-12), v1.0 vs v1.1 feature-status table, and links to docs site + CONTRIBUTING.md. release.yml NOT touched (B-2/B-3 invariant respected — Plan 05-03 sole owner).**

## Performance

- **Duration:** ~14 minutes
- **Started:** 2026-05-04 (worktree branch check, post-rebase to base 4e4474e)
- **Tasks:** 4
- **Files created:** 4 (docs/_config.yml, docs/index.md, docs/plugin-authoring.md, CONTRIBUTING.md)
- **Files modified:** 6 (5 existing docs/*.md with front-matter only, README.md polished)
- **Total files in plan:** 10 (matches `files_modified` frontmatter exactly — no extras, no missing)

## Accomplishments

- Just-the-Docs site can render the moment Plan 05-03's deploy-docs job fires on the first `v*` tag push — no further docs-side work needed.
- Plugin authoring guide gives a new Event Producer author everything needed to ship a working producer: contract type, sentinel discovery, reconnection strategy, error categories, and a reference walkthrough they can fork.
- CONTRIBUTING.md unblocks the most common new-contributor friction (Ruby/Gemfile question) with a copy-paste-ready snippet, while making fallow's "informational only" status explicit per D-22.
- README's Linux install instructions include `chmod +x` AND the rationale (RESEARCH.md Pitfall 6 cross-reference) — preventing the most common silent install failure on Linux.
- README's SmartScreen paragraph is honest about why v1.0 ships unsigned and explicit about the v1.1 deferral path.

## Task Commits

Each task was committed atomically:

1. **Task 1: docs/_config.yml + docs/index.md + front matter on 5 existing docs** — `18eb8ad` (feat)
2. **Task 2: docs/plugin-authoring.md (Event API guide with claude-code worked example)** — `274e954` (feat)
3. **Task 3a: CONTRIBUTING.md at repo root (D-17, I-1)** — `8dceab8` (feat)
4. **Task 3b: README.md polish (Install + Feature status + Documentation + Contributing; D-12, D-18, W-3)** — `8d6984f` (feat)

## Files Created/Modified

### Created
- `docs/_config.yml` — Just-the-Docs Jekyll config (remote_theme, dark color scheme, search, sidebar nav, baseurl /RoadRaven, GitHub + npm aux links). NO `logo:` line per documented decision (no asset in repo).
- `docs/index.md` — landing page (nav_order: 1) with Quick links table (7 destinations), "What's in v1" / "What's NOT in v1" lists, and npm package links.
- `docs/plugin-authoring.md` — Event API authoring guide (nav_order: 7) with: contract section (JSON + TypeScript with `IntegrationEvent` from `@roadraven/core`), sentinel discovery section with per-OS userData paths table, worked example walking through plugins/claude-code/ src files (sentinel.ts retry loop, wsClient.ts open handler, server.ts Zod schema registration, index.ts 2-line entry), Errors table mapping 4 conditions to toast strings + `_error` log markers, Reconnection strategy with backoff cap of 30s, "What's NOT in v1" section explicit about `plugin`/`subscribe` being parsed-but-not-acted-on.
- `CONTRIBUTING.md` (repo root) — Local setup, Tests/types/lint/build with `bun run verify` as PR gate, Static analysis (fallow framed as informational), Documentation (Ruby + Bundler + manual Gemfile snippet per I-1, with explicit "repository does NOT ship a Gemfile" line), Code style (Biome + LogTape over console.log + tabs), Branches and PRs, Project conventions (Electrobun-not-Electron, bun-not-npm with npm publish exception, @roadraven/core allowlist, --rv-* tokens, dataKey invariant), Planning artifacts (`.planning/` is orchestrator-managed), Reporting issues, License.

### Modified
- `docs/architecture-overview.md` — 6-line front-matter prepend (`title: Architecture Overview`, `nav_order: 2`). Body byte-identical.
- `docs/development-guide.md` — 6-line front-matter prepend (`nav_order: 3`). Body unchanged.
- `docs/rpc-and-ipc.md` — 6-line front-matter prepend (`nav_order: 4`). Body unchanged.
- `docs/design-system.md` — 6-line front-matter prepend (`nav_order: 5`). Body unchanged.
- `docs/logging.md` — 6-line front-matter prepend (`nav_order: 6`). Body unchanged.
- `README.md` — Inserted 4 new sections after the existing tagline (`> Built on Electrobun...`) and before the existing `## Features` heading: `## Install` (Windows .zip → .exe with SmartScreen path, Linux .tar.gz with chmod +x and Pitfall 6 cross-reference, npm packages), `## Feature status` (16-row v1.0/v1.1 table), `## Documentation` (links to GH Pages + 6 sub-pages), `## Contributing` (link to CONTRIBUTING.md). Renamed existing `## Quick start` → `## Quick start (development)`. Preserved existing `## Features`, `## Project structure`, `## Electrobun` sections unchanged.

## Decisions Made

1. **Emoji substitution in README Feature status table.** The plan called for `✅` (checkmark) and `❌` (cross) emojis in the v1.0/v1.1 table cells. CLAUDE.md global directive forbids emojis in files unless explicitly requested. Substituted with plain words: "available" (was ✅), "deferred" (was ❌ in v1.0 column), "planned" (was ✅ in v1.1 column). Information preserved; arguably clearer for screen readers and grep. Tracked as Rule 2 (CLAUDE.md takes precedence over plan instructions).

2. **Omitted `logo:` line from _config.yml.** RESEARCH.md Pattern 4 includes `logo: /assets/logo.png`. The repo has no `assets/logo.png`. Including the line would either 404 in the rendered site or require shipping a placeholder asset. Omitted for now; can be added in a follow-up when a logo lands. The plan explicitly authorized this deviation in Task 1 action note.

3. **Front-matter prepend mechanic.** Used Edit tool to replace the first heading line `# X` with `---\ntitle: X\nnav_order: N\nlayout: default\n---\n\n# X`. Single Edit per file, 6-line diff each. Alternative would have been to read full file content and Write it back — much heavier and risks invisible whitespace drift. The Edit-replace-first-line approach is the right tool for "prepend a small block."

4. **Plugin authoring guide snippets are real, not pseudocode.** Read plugins/claude-code/src/sentinel.ts, wsClient.ts, server.ts, index.ts during execution and quoted the exact retry loop, the exact `RECONNECT_DELAYS_MS` constant, the exact server.registerTool shape, and the exact 2-line index.ts. Future readers who fork the wrapper will see code that matches the file they're forking.

5. **CONTRIBUTING.md adds an unsolicited "anything under docs/ is published" callout.** Threat model T-05-10 (Information Disclosure: sensitive content in docs/) listed CONTRIBUTING.md note as a mitigation. The threat register implied a callout was wanted; added one paragraph framed as a security note, not as a primary instruction. Documented here as a Rule 2 addition (security-relevant; mentioned in the plan's threat-model section but not listed as a literal acceptance criterion).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - CLAUDE.md precedence] Replaced emoji checkmarks/crosses in README Feature status table with plain words**
- **Found during:** Task 3b (README polish)
- **Issue:** Plan called for ✅/❌ in feature-status table cells; CLAUDE.md (global user instructions) prohibits emojis in files.
- **Fix:** Substituted "available" / "deferred" / "planned" for the symbol cells. Information preserved; semantics arguably clearer for grep + screen readers.
- **Files modified:** README.md (16-row table)
- **Verification:** `grep -c "available\|deferred\|planned" README.md` shows the replacement words present in the table; no `✅` or `❌` characters remain.
- **Committed in:** `8d6984f` (Task 3b)

**2. [Rule 2 - Threat mitigation] Added "anything under docs/ is published" security callout in CONTRIBUTING.md Documentation section**
- **Found during:** Task 3a (CONTRIBUTING.md drafting)
- **Issue:** Threat T-05-10 in the plan's `<threat_model>` lists "CONTRIBUTING.md Documentation note: 'Anything under `docs/` is published — no secrets, no internal-only context.'" as the mitigation. The literal acceptance criteria did not require this callout, but the threat register treated it as the mitigation surface.
- **Fix:** Added a one-paragraph blockquote callout at the end of the Documentation subsection making the public-from-master invariant explicit.
- **Files modified:** CONTRIBUTING.md (Documentation section)
- **Verification:** `grep -q "Anything under" CONTRIBUTING.md` succeeds.
- **Committed in:** `8dceab8` (Task 3a)

### Out of Scope (deferred — not fixed)

- **Pre-commit hook environment errors.** The worktree was provisioned without `node_modules` at the workspace root, causing `bunx tsc` and `bunx vitest` (invoked by lint-staged in the husky pre-commit hook) to fail with `Cannot find module` errors during each commit. Per Wave 2's documented Rule-3 environmental fix, these are transient (resolved by `bun install` if persistent). The commits all succeeded — the errors are stderr noise from a hook step that found no staged files matching its globs (lint-staged correctly reported "no staged files matching configured tasks"). Not caused by Plan 05-04 changes.

- **Pre-commit fallow info hook reports `@tailwindcss/vite` as test-only-but-in-dependencies on every commit.** Pre-existing finding from before Phase 5; carried forward from Wave 2's same observation. Per CLAUDE.md fallow is informational only and not gated. Out of plan scope.

---

**Total deviations:** 2 auto-fixed (both Rule 2 — one CLAUDE.md precedence, one threat-mitigation completeness)

**Impact on plan:** Both deviations are additive (preserve plan intent + add a small refinement). No `must_haves.truths` were renegotiated. The literal Task 3b acceptance criteria do not mention emojis specifically — they require the cells be present and the rows be present, both satisfied. The literal Task 3a acceptance criteria do not require the docs-publication callout — but the threat model implied it as a mitigation surface, and the additive callout is consistent with all other plan content.

## Issues Encountered

None functionally — every commit landed cleanly. The lint-staged + tsc + vitest pre-commit hook errors (described under Out of Scope above) are environment plumbing, not test failures: lint-staged found no staged files matching its globs (correct — this plan's edits are docs/*.md, CONTRIBUTING.md, README.md, and the husky config doesn't match those for tsc/vitest). The error messages are misleading but inert.

## Authentication Gates

None occurred. All work was filesystem reads + writes + git commits within the worktree.

## Verification Results

```
$ test -f docs/_config.yml && echo OK
OK

$ test -f docs/index.md && echo OK
OK

$ test -f docs/plugin-authoring.md && echo OK
OK

$ test -f CONTRIBUTING.md && echo OK
OK

$ for f in architecture-overview development-guide rpc-and-ipc design-system logging; do
    head -5 docs/$f.md | grep -q "title:" && echo "OK: $f"
  done
OK: architecture-overview
OK: development-guide
OK: rpc-and-ipc
OK: design-system
OK: logging

$ grep -c "remote_theme: just-the-docs/just-the-docs" docs/_config.yml
1

$ grep -c "baseurl: /RoadRaven" docs/_config.yml
1

$ grep -c "title: Home" docs/index.md
1

$ grep -c "IntegrationEvent" docs/plugin-authoring.md
4

$ grep -c "plugins/claude-code" docs/plugin-authoring.md
5

$ grep -c "@roadraven/core" docs/plugin-authoring.md
6

$ grep -c "@roadraven/plugin-claude-code" docs/plugin-authoring.md
3

$ grep -c "v1.1" docs/plugin-authoring.md
7

$ grep -c "event-api.json" docs/plugin-authoring.md
3

$ grep -c "bun install" CONTRIBUTING.md
1

$ grep -c "bun run verify" CONTRIBUTING.md
1

$ grep -c "bunx fallow audit --changed-since=HEAD" CONTRIBUTING.md
1

$ grep -c "Electrobun, not Electron" CONTRIBUTING.md
1

$ grep -c "scripts/check-core-deps.ts" CONTRIBUTING.md
1

$ grep -c "## Documentation" CONTRIBUTING.md
1

$ grep -c "Ruby + Bundler" CONTRIBUTING.md
1

$ grep -c 'gem "just-the-docs"' CONTRIBUTING.md
1

$ grep -c "## Install" README.md
1

$ grep -c "RoadRaven-Setup.exe" README.md
1

$ grep -c "tar -xzf stable-linux-x64-RoadRavenSetup-stable.tar.gz" README.md
1

$ grep -c "chmod +x ./RoadRavenSetup" README.md
1

$ grep -c "RoadRavenSetup-stable" README.md
3

$ grep -c "SmartScreen" README.md
1

$ grep -c "## Feature status" README.md
1

$ grep -c "shuffzord.github.io/RoadRaven" README.md
8

$ grep -c "CONTRIBUTING.md" README.md
1

$ grep -c "More info" README.md
1

$ grep -c "Run anyway" README.md
1

$ grep -c "adjust if extracted name differs" README.md
1

$ grep -c "RESEARCH.md Pitfall 6" README.md
2

$ grep -c "## Quick start (development)" README.md
1

$ git diff --name-only 4e4474e..HEAD | grep -c '\.github/workflows/release.yml'
0   (B-2/B-3 invariant — release.yml NOT touched)

$ grep -c "deploy-docs:" .github/workflows/release.yml
1   (Plan 05-03's deploy-docs job still in place; will pick up this plan's docs content)

$ grep -cE "^\s*#\s*fallow:" .github/workflows/ci.yml
1   (D-22 invariant — fallow CI gate still commented)

$ git log --oneline 4e4474e..HEAD
8d6984f feat(05-04): polish README with install + feature-status + docs links (D-12, D-18, W-3)
8dceab8 feat(05-04): add CONTRIBUTING.md at repo root (D-17, I-1)
274e954 feat(05-04): add Event API plugin authoring guide (D-16)
18eb8ad feat(05-04): add Just-the-Docs config + landing page + front matter
```

All `must_haves.truths` from plan frontmatter satisfied:

1. ✓ `docs/_config.yml` exists with Just-the-Docs `remote_theme` + sidebar nav configuration.
2. ✓ Existing `docs/*.md` files have Just-the-Docs front matter (title, nav_order); content NOT rewritten — body byte-identical (only +6 lines per file).
3. ✓ `docs/index.md` exists as landing page (nav_order: 1).
4. ✓ `docs/plugin-authoring.md` exists covering Event API integration with the claude-code MCP wrapper as the worked example (D-16).
5. ✓ `CONTRIBUTING.md` at repo root covers local setup, tests, code style, branch/PR conventions, fallow-as-local-tool note (D-22), Documentation subsection (per checker I-1) noting Ruby + manual Gemfile.
6. ✓ `README.md` gains per-platform install (R-01 Linux .tar.gz with chmod +x per W-3, R-02 Windows .zip→-Setup.exe with SmartScreen note D-12), feature-status block, Contributing section, link to published docs site.
7. ✓ Fallow IS NOT enabled in CI (D-22 — placeholder remains commented from Plan 05-03).
8. ✓ Plan 05-04 does NOT modify `.github/workflows/release.yml` (per checker B-2/B-3 — Plan 05-03 is sole owner; deploy-docs job belongs there).

## Threat Mitigation Status

| Threat ID | Disposition | Status |
|-----------|-------------|--------|
| T-05-06 (Repudiation: unsigned .exe runs without warning) | accept (per D-12) | ✓ README "Windows" install section explicitly documents the SmartScreen warning + bypass path AND the v1.0-unsigned reason + v1.1 deferral. |
| T-05-10 (InfoDisclosure: sensitive content in docs/) | mitigate | ✓ CONTRIBUTING.md Documentation section gains an explicit "Anything under docs/ is published — no secrets, no internal-only context" callout. The tag-gated deploy job (Plan 05-03) provides the final review window. |

## Threat Flags

No new threat surface introduced. This plan only authors documentation and contributor guidance; no code, no networked surfaces, no auth boundaries touched. All affected surfaces are within existing threat model.

## Self-Check: PASSED

Created files (verified via `test -f`):
- ✓ `docs/_config.yml`
- ✓ `docs/index.md`
- ✓ `docs/plugin-authoring.md`
- ✓ `CONTRIBUTING.md`

Modified files (verified via `git diff --name-status 4e4474e..HEAD`):
- ✓ `docs/architecture-overview.md`
- ✓ `docs/development-guide.md`
- ✓ `docs/rpc-and-ipc.md`
- ✓ `docs/design-system.md`
- ✓ `docs/logging.md`
- ✓ `README.md`

Commits (verified in `git log --oneline`):
- ✓ `18eb8ad` Task 1
- ✓ `274e954` Task 2
- ✓ `8dceab8` Task 3a
- ✓ `8d6984f` Task 3b

No missing items. No unexpected file deletions. release.yml unchanged (B-2/B-3 invariant respected).

## User Setup Required

None — no external service configuration required for this plan. The Phase 5 close-out user setup (npm Trusted Publishers, GH Pages source flip) is documented in `05-RELEASE-OPS.md` from Plan 05-03; this plan does not introduce any new manual steps.

## Next Phase Readiness

Plan 05-04 is the last Wave 3 plan; Wave 4 (Plan 05-05 a11y audit) is independent and can run in parallel.

After all Phase 5 plans merge, the user must complete `05-RELEASE-OPS.md` sections A-C (npm Trusted Publishers config + GH Pages source flip + package-name pre-flight) BEFORE pushing the first `v*` tag. The release workflow's deploy-docs job will then pick up this plan's `docs/` content and publish to https://shuffzord.github.io/RoadRaven/.

No blockers. No outstanding deferred items from this plan that could affect downstream work.

---
*Phase: 05-packaging-distribution*
*Plan: 04 — Docs Site + CONTRIBUTING + README Polish*
*Completed: 2026-05-04*
