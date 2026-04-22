# CLAUDE.md

@.claude/PRINCIPLES.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**Roadmap Viewer** — an Electrobun desktop app for creating, editing, and live-monitoring visual roadmap trees. Nodes map to tasks/agents; status updates arrive via WebSocket (Claude Code integration). Plain JSON data model, keyboard-first editing, markdown side panels.

> **IMPORTANT:** This is Electrobun, NOT Electron. Do not use Electron APIs, patterns, or documentation.

> **IMPORTANT:** Use `bun` and `bunx` for all package management and script execution. Do not use `npm`, `npx`, `yarn`, or `pnpm`.

## Commands

```bash
bun install           # Install dependencies

bun run start         # One-shot: vite build → electrobun dev (no file watching)
bun run dev           # Dev with file watching (auto-restarts bun process on changes)
bun run dev:hmr       # Dev with HMR — runs Vite dev server + electrobun concurrently (recommended)
bun run hmr           # Vite dev server only (port 5173) — used internally by dev:hmr
bun run build:canary  # Production build (canary channel)

# Tests (vitest)
bunx vitest           # Run all tests in watch mode
bunx vitest run       # Run once (CI)
bunx vitest run path/to/file.test.ts  # Run single test file

# Linting (biome)
bunx @biomejs/biome lint packages/desktop/src/ shared/  # Lint source
bunx @biomejs/biome check --write .                      # Auto-fix
```

## Architecture

See `.planning/ARCHITECTURE.md` for the full architecture reference (process model, RPC contract, Zustand store shape, package structure, event flow sequences).

See `docs/` for detailed architecture documentation, design system guide, and developer workflow.

## Verification

Before creating a PR, ensure:
1. `bunx vitest run` — all tests pass
2. `bunx vite build` — production build succeeds (catches import/CSS issues that unit tests miss)
3. `bunx @biomejs/biome lint packages/desktop/src/ shared/` — no lint errors
4. `bunx fallow audit --changed-since=HEAD` — no new dead code / duplication / complexity regressions in your diff (see below)

## Static analysis (fallow)

Fallow is a Rust-based code-quality analyzer wired in as an *informational* fourth
verification layer on top of the biome → tsc → vitest stack. Config lives at
`.fallowrc.json` (JSONC); entry points for the Electrobun main process, the
mainview HTML bootstrap, and the dev harness are declared there — without them
the tool reports App.tsx and friends as dead code.

```bash
bunx fallow                                   # Full combined scan (dead code + dupes + health)
bunx fallow audit --changed-since=HEAD        # Scoped to your uncommitted diff — fast, use during review
bunx fallow dead-code --summary               # Counts only
bunx fallow health --score --trend            # Complexity + delta vs. last snapshot
bunx fallow config                            # Print resolved config + which file loaded
```

Treat fallow output as a signal, not a gate — it is not currently wired into
`bun run verify`, pre-commit, or CI (commented-out placeholders exist in
`.husky/pre-commit` and `.github/workflows/ci.yml`; enable after the post-GSD
dead-code cleanup lands). When planning refactors, use it to locate complexity
hotspots and circular dependencies rather than acting on each unused-export
finding in isolation.

## Electrobun-specific patterns

- Load bundled views with `views://mainview/index.html`
- Main process imports: `import { BrowserWindow, Updater } from "electrobun/bun"`
- Renderer imports: `import { Electroview } from "electrobun/view"`

## Electrobun documentation

- Quick start guide: https://blackboard.sh/electrobun/docs/guides/quick-start/
- Source + issues: https://github.com/blackboardsh/electrobun
- LLM-optimised API reference: https://blackboard.sh/electrobun/llms.txt
