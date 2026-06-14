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
bun run test                              # vitest across all workspaces
bun run --cwd packages/desktop test       # desktop package only (faster)
bun run --cwd packages/desktop typecheck  # tsc --noEmit
bun run test:lint                         # biome lint
bun run test:build                        # production build (catches CSS / import issues unit tests miss)
```

Static analysis (informational — not a CI gate):

```bash
bunx fallow audit --changed-since=HEAD   # dead code / duplication / complexity scan in your diff
bunx fallow                                # full repo scan
```

Fallow output is currently signal, not a gate. Treat findings as a planning
input for refactor PRs rather than a blocking failure on each individual change.

## Documentation

Documentation lives in the [`docs/`](./docs/) directory as Markdown. For now,
read it directly on GitHub — the files render in the repo.

A GitHub Pages site (Just-the-Docs / Jekyll, configured via `docs/_config.yml`)
is set up but not published yet. It will go live at
https://shuffzord.github.io/RoadRaven/ once the first release tag is pushed (the
release workflow has a `deploy-docs` job). Until then, browse the Markdown in
`docs/`.

- **Edit docs:** modify files under `docs/`. Keep the Just-the-Docs front
  matter (`title:`, `nav_order:`, `layout:`) intact.
- **Local preview:** a local preview needs Ruby + Bundler + a manual `Gemfile`;
  most contributors can just edit the Markdown and let CI render it.

> **Everything under `docs/` is published and world-readable.** No secrets, no
> internal-only context — treat the directory as public the moment it lands on
> `master`.

## Code style

- Formatter / linter: [Biome](https://biomejs.dev/) — run via
  `bunx @biomejs/biome check --write .` to auto-fix.
- TypeScript: strict mode (per `tsconfig.json`); avoid `any`.
- Tabs for indentation (matches existing files).
- File comments and code: no `console.log` unless explicitly debugging
  — use the LogTape categories in `packages/desktop/src/bun/logging.ts`.

Pre-commit hook (Husky) runs `bunx lint-staged` + `biome check` + `tsc` +
`vitest` on the staged files. If a hook fails, fix the issue and commit
again — do NOT bypass with `--no-verify`.

## Branches and PRs

- Main branch: `master`. All PRs target `master`.
- Branch naming: `feat/short-description`, `fix/short-description`, or
  `docs/short-description`.
- Commits: conventional-style is appreciated but not enforced (e.g.,
  `feat(editor): add inline rename`, `fix(event-api): handle WebSocket EADDRINUSE`).
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
  `Verify @roadraven/core dependency allowlist` CI step. Edit the
  `scripts/check-core-deps.ts` allowlist in the same PR if the addition is
  intentional, and explain it in the PR description.
- **`--rv-*` CSS tokens only.** No hardcoded colors anywhere in component
  CSS. See [`docs/design-system.md`](./docs/design-system.md).
- **`dataKey` invariant for the tree renderer.** Only increment on
  structural mutations (add/delete/move), never on status-only updates.
  See [`docs/architecture-overview.md`](./docs/architecture-overview.md)
  for why.

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
