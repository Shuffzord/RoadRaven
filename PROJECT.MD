# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**Roadmap Viewer** — an Electrobun desktop app for creating, editing, and live-monitoring visual roadmap trees. Nodes map to tasks/agents; status updates arrive via WebSocket (Claude Code integration). Plain JSON data model, keyboard-first editing, markdown side panels.

> **IMPORTANT:** This is Electrobun, NOT Electron. Do not use Electron APIs, patterns, or documentation.

> **IMPORTANT:** Use `bun` and `bunx` for all package management and script execution. Do not use `npm`, `npx`, `yarn`, or `pnpm`.

## Commands

```bash
bun install           # Install dependencies — a root postinstall projects the
                      # Electrobun 2.x toolchain (Hutch/Cottontail) into a
                      # gitignored packages/desktop/.hutch/devkit; needs
                      # network on a cold cache. Windows requires Developer
                      # Mode for this step (Hutch projects the devkit via
                      # symlinks) — see CONTRIBUTING.md.
                      # A root preinstall guard (scripts/verify-package-manager.js)
                      # rejects npm/pnpm/yarn install with an explanatory error —
                      # same version-drift problem as the vitest note below,
                      # see CONTRIBUTING.md.

bun run start         # One-shot: vite build → electrobun dev (no file watching)
bun run dev           # Dev with file watching (auto-restarts bun process on changes)
bun run dev:hmr       # Dev with HMR — runs Vite dev server + electrobun concurrently (recommended)
                      # Renderer: CEF (Chromium) by default. To use WebKitGTK/WKWebView instead,
                      # create .env.local at repo root with: ROADRAVEN_RENDERER=webkit
bun run hmr           # Vite dev server only (port 5173) — used internally by dev:hmr
bun run build:canary  # Production build (canary channel)

# Tests (vitest) — ALWAYS via `bun run`, never `bunx vitest` directly.
# `bunx vitest` from workspace root pulls a different version from bun's
# global cache than the workspace-pinned one — silent version drift.
bun run test                          # Full suite across all workspaces
bun run test:desktop                  # Desktop package only (faster)
bun run test:file path/to/file.test.ts  # Single file
bun run test:typecheck                # tsc --noEmit
bun run test:typecheck:tests          # tsc over src + all test files (vitest strips types)
bun run test:coverage                 # vitest + istanbul -> packages/desktop/coverage/coverage-final.json
bun run test:e2e:ui                   # Playwright ui project (Vite dev server, single worker)
bun run test:lint                     # biome lint (matches CI)
bun run verify                        # test + typecheck + build + lint (PR-readiness)

# Linting (biome) — bunx is fine for biome (root devDep)
bunx @biomejs/biome lint packages/desktop/src/ shared/  # Lint source
bunx @biomejs/biome check --write .                      # Auto-fix
```

## Architecture

See `docs/` for detailed architecture documentation, design system guide, and developer workflow.

## Verification

Before creating a PR, ensure:
1. `bun run verify` — all tests pass
2. `bun run test:build` (or `bunx vite build` from `packages/desktop`; there is no vite config at the repo root) — production build succeeds (catches import/CSS issues that unit tests miss)
3. `bunx @biomejs/biome lint packages/desktop/src/ shared/` — no lint errors
4. `fallow audit --changed-since=HEAD` — no new dead code / duplication / complexity regressions in your diff (see below)

## Static analysis (fallow)

Fallow is a Rust-based code-quality analyzer wired in as the fourth
verification layer on top of the biome → tsc → vitest stack, enforced at
commit time (see below). Config lives at
`.fallowrc.json` (JSONC); entry points for the Electrobun main process, the
mainview HTML bootstrap, and the dev harness are declared there — without them
the tool reports App.tsx and friends as dead code.

```bash
bunx fallow                                   # Full combined scan (dead code + dupes + health)
bunx fallow audit --changed-since=HEAD        # Scoped to your uncommitted diff — fast, use during review
bunx fallow dead-code --summary               # Counts only
bunx fallow health --score --trend            # Complexity + delta vs. last snapshot
bunx fallow config                            # Print resolved config + which file loaded
bunx fallow health --coverage packages/desktop/coverage   # Exact CRAP scores (run bun run test:coverage first)
```

`.husky/pre-commit` runs `bunx fallow audit --changed-since=HEAD --fail-on-issues`,
so fallow blocks a commit that introduces dead code, duplication, or
above-threshold complexity (default gate `new-only`; inherited findings are
reported but do not block). It is not part of `bun run verify` or CI yet
(commented-out placeholder job in `.github/workflows/ci.yml`). Never bypass
it with `--no-verify` or suppression comments — fix the finding or split the
work. Known quirk: when a file goes from untested to test-reachable, an
existing complexity finding in it can change kind (`cognitive_crap` →
`cognitive`) and get reported as introduced although nothing got worse;
work around this without touching the gate by committing the source change
(plus tests that don't import that file) first, then the test that makes
the file test-reachable in a second commit. When planning refactors, use
fallow to locate complexity hotspots and circular dependencies rather than
acting on each unused-export finding in isolation.

## Electrobun-specific patterns

- Load bundled views with `views://mainview/index.html`
- Main process imports: `import { BrowserWindow, Updater } from "electrobun/bun"`
- Renderer imports: `import { Electroview } from "electrobun/view"`
- On Electrobun 2.x, the `electrobun` package is a thin bootstrapper that
  forwards every CLI invocation to Hutch (`hutch electrobun <cmd>` —
  `prepare`, `dev`, `build`, `run`, ...). `bunx electrobun prepare` /
  `dev` / `build` all resolve through it.
- The main process runs on **Cottontail**, 2.x's default main-process
  runtime (this app is Bun-compatible via Cottontail's compat layer, not
  pinned to a Bun-specific runtime).
- `packages/desktop/.hutch/devkit` is the projected toolchain Electrobun 2.x
  serves its APIs from (vite/vitest alias `electrobun/*` there; tsconfig maps
  paths into it). It's gitignored and auto-projected by `electrobun prepare`
  (run via the root `postinstall`, and implicitly by `dev`/`build`/`run`) —
  never commit it or hand-edit it.

## Electrobun documentation

- Quick start guide: https://blackboard.sh/electrobun/docs/guides/quick-start/
- Source + issues: https://github.com/blackboardsh/electrobun
- LLM-optimised API reference: https://blackboard.sh/electrobun/llms.txt
