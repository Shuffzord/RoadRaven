# Contributing to RoadRaven

Thank you for considering a contribution. RoadRaven is an MIT-licensed
open-source desktop app built on Electrobun (not Electron) with Bun as the
runtime. This file covers the basics; for the deeper "how the codebase fits
together" view, see [`docs/development-guide.md`](./docs/development-guide.md).

## Local setup

Prerequisites:
- [Bun](https://bun.sh) (v1.x; pinned in CI to `latest`)
- Git

Clone + install:

```bash
git clone https://github.com/Shuffzord/RoadRaven.git
cd RoadRaven
bun install
```

Run the app in dev mode:

```bash
# Recommended: Vite HMR + Electrobun in parallel
bun run dev:hmr

# Alternative: one-shot vite build, then electrobun dev (no HMR)
bun run start
```

## Tests, types, lint, build

Run the full PR-readiness gate before opening a PR:

```bash
bun run verify
# = test + typecheck + build + lint
```

Individual commands:

```bash
bun run test                          # vitest across all workspaces
bun run --cwd packages/desktop test   # desktop package only (faster)
bun run --cwd packages/desktop typecheck  # tsc --noEmit
bunx @biomejs/biome check --diagnostic-level=error .   # lint
bunx vite build --root packages/desktop   # production build (catches CSS / import issues unit tests miss)
```

Static analysis (informational — NOT a CI gate per [Phase 5 D-22](./.planning/phases/05-packaging-distribution/05-CONTEXT.md)):

```bash
bunx fallow audit --changed-since=HEAD   # dead code / duplication / complexity scan in your diff
bunx fallow                                # full repo scan
```

Fallow output is currently signal, not a gate. Treat findings as a planning
input for refactor PRs rather than a blocking failure on each individual change.

## Documentation

The published docs site lives at https://shuffzord.github.io/RoadRaven/
and is built from the `docs/` directory by the GH Pages workflow on every
`v*` tag (see Plan 05-03 `deploy-docs` job).

- **Edit docs:** modify files under `docs/`. Keep the Just-the-Docs front
   matter (`title:`, `nav_order:`, `layout:`) intact.
- **Local preview (per checker I-1):** the docs site uses Just-the-Docs via
   Jekyll. The repository does NOT ship a `Gemfile` (the GH Pages CI job
   handles the build for published changes). To preview locally, you need
   Ruby + Bundler + a manual `Gemfile` containing:

   ```ruby
   source "https://rubygems.org"
   gem "github-pages", group: :jekyll_plugins
   gem "just-the-docs"
   ```

   Then `bundle install && bundle exec jekyll serve --source ./docs`. For
   most contributions, just push the changes — CI's deploy-docs job will
   render and publish them on the next tag.

> **Anything under `docs/` is published.** No secrets, no internal-only
> context. Treat the directory as world-readable from the moment it lands
> on `master` (the tag-gated deploy gives a final review window, but the
> source itself is public).

## Code style

- Formatter / linter: [Biome](https://biomejs.dev/) — run via
   `bunx @biomejs/biome check --write .` to auto-fix.
- TypeScript: strict mode (per `tsconfig.json`); avoid `any`.
- Tabs for indentation (matches existing files).
- File comments and code: no `console.log` unless explicitly debugging
   — use the LogTape categories in `packages/desktop/src/bun/logger.ts`.

Pre-commit hook (Husky) runs `bunx lint-staged` + `biome check` + `tsc` +
`vitest` on the staged files. If a hook fails, fix the issue and commit
again — do NOT bypass with `--no-verify`.

## Branches and PRs

- Main branch: `master`. All PRs target `master`.
- Branch naming: `gsd/phase-NN-description` for orchestrator-managed work,
   or `feat/short-description`, `fix/short-description`, `docs/short-description`
   for ad-hoc PRs.
- Commits: conventional-style is appreciated but not enforced (e.g.,
   `feat(03-01): add inline rename`, `fix(04-02): handle WebSocket EADDRINUSE`).
- PR description: clear summary + test plan + screenshots for UI changes.
   The CI gates (lint, typecheck, test, invariants) must all be green
   before review.

## Project conventions

A few rules that catch new contributors off-guard:

- **Electrobun, not Electron.** Don't import Electron APIs or look for
   `electron-builder`-style configs. See [`CLAUDE.md`](./CLAUDE.md) and
   [`docs/architecture-overview.md`](./docs/architecture-overview.md).
- **`bun` and `bunx`, not `npm`/`npx`/`yarn`/`pnpm`.** Single explicit
   exception: the release workflow uses `npm publish` (the npm CLI is the
   only registry client with first-class provenance support).
- **`@roadraven/core` zero-desktop-deps invariant.** PRs that add anything
   beyond `zod` to `packages/core/package.json` `dependencies` will fail the
   `Verify @roadraven/core dependency allowlist` CI step. Edit
   `scripts/check-core-deps.ts` ALLOWLIST in the same PR if the addition is
   intentional, and explain the addition in the PR description.
- **`--rv-*` CSS tokens only.** No hardcoded colors anywhere in component
   CSS. See [`docs/design-system.md`](./docs/design-system.md).
- **`dataKey` invariant for the tree renderer.** Only increment on
   structural mutations (add/delete/move), never on status-only updates.
   See [`docs/architecture-overview.md`](./docs/architecture-overview.md)
   for why.

## Planning artifacts

Anything under `.planning/` (`PROJECT.md`, `REQUIREMENTS.md`, `ROADMAP.md`,
`STATE.md`, phase folders) is managed by the GSD orchestrator workflow.
Contributors generally do not need to edit these files directly. If a PR
requires planning changes (e.g., adding a new `EDIT-XX` requirement),
flag this in the PR description and the maintainer will handle the edit
via the orchestrator commands.

## Reporting issues

File issues at https://github.com/Shuffzord/RoadRaven/issues. For bug
reports, include:

- OS + version (Windows 11 22H2, Ubuntu 22.04 LTS, etc.)
- RoadRaven version (visible in the status bar or About dialog)
- Steps to reproduce
- Expected vs. actual behavior
- Log file (location is shown in the app status bar)

## License

By contributing, you agree your contributions are licensed under the
project's [MIT License](./LICENSE).
