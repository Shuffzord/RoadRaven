# Phase 00: App Scaffold - Context

**Gathered:** 2026-04-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Electrobun shell boots to a blank window with the monorepo structure (`packages/core`, `packages/react`, `packages/desktop`, `plugins/`), typed RPC contract skeleton, `RoadmapPlugin` interface stub, and full TDD pipeline (Vitest + Playwright two-tier) operational on CI.

Creating, editing, or rendering any roadmap data is out of scope — this phase produces a running shell, a clean workspace structure, and a green CI pipeline.

</domain>

<decisions>
## Implementation Decisions

### Package Namespace
- **D-01:** All publishable npm packages use the `@roadraven/` scope — `@roadraven/core` and `@roadraven/react`. The `@roadmap-viewer/` references in REQUIREMENTS.md are stale and should be updated. All `package.json` files created in this phase use `@roadraven/`.

### Monorepo Structure
- **D-02:** The root becomes a pure Bun workspace container. The existing `src/bun/` and `src/mainview/` code moves into `packages/desktop/`. `electrobun.config.ts`, `vite.config.ts`, `tsconfig.json`, `postcss.config.js`, and `tailwind.config.js` all move into `packages/desktop/` alongside the source.
- **D-03:** Root `package.json` is rewritten as workspace config only (`workspaces: ["packages/*", "plugins/*"]`) — no scripts, no app-level dependencies at root.
- **D-04:** `packages/core/` and `packages/react/` are created as stub packages with `package.json` and empty `src/` — no implementation code yet. `packages/core/src/plugin.ts` contains only the `RoadmapPlugin` interface (SCAF-04).
- **D-05:** `plugins/claude-code/` directory created as a placeholder — empty for Phase 0, activated in Phase 4.
- **D-06:** `shared/types.ts` lives at the workspace root (`shared/types.ts`), imported by both `packages/desktop/src/bun/` and `packages/desktop/src/mainview/` via a workspace-level path alias or relative import.

### Linter
- **D-07:** Biome is the linter and formatter. Single tool, Rust-based, zero config for TypeScript/React. CI runs `bunx biome check --diagnostic-level=error .` as the lint step. No ESLint or Prettier.

### Playwright Setup
- **D-08:** Full two-tier Playwright skeleton wired in Phase 0:
  - **Tier 1 (UI):** `tests/ui/` — Playwright against the Vite dev server with a mock RPC harness; first test: `smoke.test.ts` confirms root element renders.
  - **Tier 2 (process):** `tests/process/` — Bun-native Playwright; first test: `smoke.test.ts` confirms `BrowserWindow` creates without crashing.
  - Both tiers must have a passing test before Phase 0 ships.

### Critical From Requirements
- **D-09:** `bundleCEF: true` set in `electrobun.config.ts` from day one (currently `false` — must flip on all three platforms: mac, linux, win). This is SCAF-08 and must not be deferred.
- **D-10:** `Updater.localInfo.channel()` already correctly implemented in `src/bun/index.ts` with try/catch — preserve this as-is when migrating to `packages/desktop/`.

### Claude's Discretion
- Exact Bun workspace version constraints and `resolutions` config
- Whether `shared/types.ts` uses a workspace `tsconfig.json` path alias or relative import
- Specific Biome rule set / strictness level (default config is acceptable)
- CI caching strategy (Bun cache key configuration)
- Whether `plugins/claude-code/` gets a `package.json` stub in Phase 0 or remains a bare directory

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Scaffold Requirements
- `.planning/REQUIREMENTS.md` §Scaffold (SCAF-01 through SCAF-09) — full acceptance criteria for each scaffold requirement; SCAF-08 (`bundleCEF: true`) and SCAF-09 (Updater try/catch) are the two items with existing code implications

### Architecture
- `.planning/PROJECT.md` §Architecture — two-process model, RPC contract expectations, monorepo package roles
- `.planning/PROJECT.md` §Constraints — TDD-first constraint applies from Phase 0: tests written before implementation

### Existing Code to Migrate
- `src/bun/index.ts` — main process entry; Updater pattern already correct; migrate to `packages/desktop/src/bun/index.ts`
- `electrobun.config.ts` — `bundleCEF` must flip to `true` on all platforms; migrate to `packages/desktop/electrobun.config.ts`
- `package.json` — current deps; root becomes workspace-only; app deps move to `packages/desktop/package.json`

### Electrobun Documentation
- `https://blackboard.sh/electrobun/llms.txt` — LLM-optimised Electrobun API reference (check before any Electrobun API usage)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/bun/index.ts`: Working Electrobun main process — `BrowserWindow` creation, HMR URL detection via `Updater.localInfo.channel()`, correct dev server fallback logic. Migrate wholesale into `packages/desktop/src/bun/index.ts`.
- `src/mainview/main.tsx` + `index.html`: Minimal React bootstrap (StrictMode, createRoot). Migrate into `packages/desktop/src/mainview/`.
- `vite.config.ts`: Correctly configured for `src/mainview/` root and `dist/` output. Paths need updating after move.

### Established Patterns
- App name: "RoadRaven"; identifier: "RoadRaven.electrobun.dev" — already in `electrobun.config.ts`, keep as-is
- HMR pattern: `bun run dev:hmr` runs Vite dev server + Electrobun concurrently — preserve this in `packages/desktop/` scripts
- TypeScript: strict mode enabled (`noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`)

### Integration Points
- `shared/types.ts` is where the typed RPC contract skeleton lives — both processes import from it; must be resolvable from `packages/desktop/src/bun/` and `packages/desktop/src/mainview/`
- Bun workspace protocol (`workspace:*`) for cross-package deps (e.g., `packages/desktop` consuming `@roadraven/core`)
- GitHub Actions CI must run `bun install` at workspace root and then trigger per-package checks

### What Does NOT Exist Yet
- No `packages/` directory, no `shared/types.ts`, no `.github/workflows/`, no Playwright in devDependencies
- No `@playwright/test` — must be added to `packages/desktop/devDependencies` (or workspace root devDependencies)
- No Biome — must be added as a devDependency and configured

</code_context>

<specifics>
## Specific Ideas

- The two-tier Playwright layout should be: `tests/ui/smoke.test.ts` (Tier 1, Vite dev server) and `tests/process/smoke.test.ts` (Tier 2, Bun-native). This convention is established in Phase 0 so all subsequent phases just drop tests into the right directory.
- Root `package.json` scripts should proxy into `packages/desktop/` for the common dev commands (`dev:hmr`, `build:canary`, `start`) so contributors can still run them from the root without `cd`-ing.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 00-app-scaffold*
*Context gathered: 2026-04-12*
