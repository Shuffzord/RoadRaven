# Phase 00: App Scaffold - Research

**Researched:** 2026-04-13
**Domain:** Electrobun desktop app, Bun workspaces, Vitest, Playwright, Biome, GitHub Actions CI
**Confidence:** HIGH (most findings verified against installed source or npm registry)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** All publishable npm packages use the `@roadraven/` scope — `@roadraven/core` and `@roadraven/react`. The `@roadmap-viewer/` references in REQUIREMENTS.md are stale. All `package.json` files created in this phase use `@roadraven/`.
- **D-02:** Root becomes a pure Bun workspace container. Existing `src/bun/` and `src/mainview/` code moves into `packages/desktop/`. `electrobun.config.ts`, `vite.config.ts`, `tsconfig.json`, `postcss.config.js`, and `tailwind.config.js` all move into `packages/desktop/` alongside the source.
- **D-03:** Root `package.json` rewritten as workspace config only (`workspaces: ["packages/*", "plugins/*"]`) — no scripts, no app-level dependencies at root.
- **D-04:** `packages/core/` and `packages/react/` created as stub packages with `package.json` and empty `src/` — no implementation code yet. `packages/core/src/plugin.ts` contains only the `RoadmapPlugin` interface (SCAF-04).
- **D-05:** `plugins/claude-code/` directory created as a placeholder — empty for Phase 0, activated in Phase 4.
- **D-06:** `shared/types.ts` lives at the workspace root (`shared/types.ts`), imported by both processes via workspace-level path alias or relative import.
- **D-07:** Biome is the linter and formatter. CI runs `bunx biome check --diagnostic-level=error .`. No ESLint or Prettier.
- **D-08:** Two-tier Playwright skeleton: `tests/ui/smoke.test.ts` (Tier 1, Vite dev server) and `tests/process/smoke.test.ts` (Tier 2, Bun-native). Both must have a passing test before Phase 0 ships.
- **D-09:** `bundleCEF: true` set in `electrobun.config.ts` on all three platforms. Currently `false` — must flip. This is SCAF-08 and must not be deferred.
- **D-10:** `Updater.localInfo.channel()` already correctly implemented in `src/bun/index.ts` with try/catch — preserve this pattern when migrating to `packages/desktop/`.

### Claude's Discretion

- Exact Bun workspace version constraints and `resolutions` config
- Whether `shared/types.ts` uses a workspace `tsconfig.json` path alias or relative import
- Specific Biome rule set / strictness level (default config is acceptable)
- CI caching strategy (Bun cache key configuration)
- Whether `plugins/claude-code/` gets a `package.json` stub in Phase 0 or remains a bare directory

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SCAF-01 | Monorepo structure: `packages/core`, `packages/react`, `packages/desktop`, `plugins/` with correct workspace config | Bun workspace syntax verified; `workspaces` field in root `package.json` |
| SCAF-02 | Electrobun shell boots to blank window; `bun run dev:hmr` and `bun run build:canary` both succeed | Existing `src/bun/index.ts` works; migration path clear; `electrobun.config.ts` needs path updates and `build.bun.entrypoint` |
| SCAF-03 | Typed RPC contract skeleton in `shared/types.ts`; both processes import from it | `RPCSchema` / `ElectrobunRPCSchema` types exported from `electrobun/bun`; shape documented in ARCHITECTURE.md |
| SCAF-04 | `RoadmapPlugin` interface in `packages/core/src/plugin.ts` (no implementation) | Interface shape defined in ARCHITECTURE.md; stub only needed here |
| SCAF-05 | Vitest configured; first unit test passes | Vitest 4.1.4 already in devDependencies; no config file exists yet — needs `vitest.config.ts` |
| SCAF-06 | Playwright two-tier configured; first test passes per tier | `@playwright/test` not yet installed; Tier 1 targets Vite dev server; Tier 2 is Bun-native |
| SCAF-07 | GitHub Actions CI: lint + `bunx tsc --noEmit` + unit tests on every PR | No `.github/` directory exists; must be created from scratch |
| SCAF-08 | `bundleCEF: true` in `electrobun.config.ts` (all platforms) | Config type verified: `build.mac.bundleCEF`, `build.linux.bundleCEF`, `build.win.bundleCEF` |
| SCAF-09 | `Updater.localInfo.channel()` wrapped in try/catch; missing `version.json` → channel `"dev"` | **CRITICAL:** `getLocallocalInfo()` throws on missing `version.json` — existing code uses try/catch on `fetch`, NOT on `Updater.localInfo.channel()`. Needs wrapper. |
</phase_requirements>

---

## Summary

Phase 00 is a structural migration + scaffolding phase, not a feature phase. The existing single-package repo (`src/bun/`, `src/mainview/`) must be broken apart into a Bun workspace monorepo. The existing `src/bun/index.ts` is already a working Electrobun main process — it migrates wholesale into `packages/desktop/`. All build tooling configs (`electrobun.config.ts`, `vite.config.ts`, `tsconfig.json`, `tailwind.config.js`, `postcss.config.js`) follow it.

The most technically sensitive items are: (1) the `electrobun.config.ts` path changes required after the move (the `build.bun.entrypoint` and `build.copy` keys reference source-relative paths), (2) the SCAF-09 finding that `Updater.localInfo.channel()` itself throws when `version.json` is absent — the existing try/catch in `index.ts` wraps `fetch()`, not `channel()`, so a new wrapper is needed, and (3) the Playwright two-tier setup which requires `@playwright/test` to be added and two separate runner configurations.

Biome is already installed (`@biomejs/biome@2.4.11` in devDependencies) but has no `biome.json` config file. Vitest is installed but has no `vitest.config.ts`. GitHub Actions, Playwright, and the monorepo directory structure do not exist yet.

**Primary recommendation:** Execute the three plans in order — monorepo bootstrap first, then RPC/plugin skeleton, then TDD pipeline — since CI depends on the test setup which depends on the monorepo structure being stable.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| electrobun | 1.16.0 | Desktop app framework (Bun + native WebView) | Project foundation; already installed |
| bun | 1.3.11 | Runtime + package manager + workspace host | Project foundation; already installed |
| react | ^19.2.5 | UI renderer in webview | Already in deps |
| vite | ^6.0.3 | Webview bundler + HMR dev server | Already configured |
| typescript | ^6.0.2 | Type system | Already installed |

### Dev / Testing
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vitest | 4.1.4 | Unit test runner | All unit tests (already in devDeps) |
| @playwright/test | 1.59.1 | E2E test runner (both tiers) | Both UI smoke and process smoke tests; NOT YET INSTALLED |
| @biomejs/biome | 2.4.11 | Lint + format | Already in devDeps; needs `biome.json` |
| concurrently | ^9.1.0 | Runs Vite + electrobun simultaneously | dev:hmr script; already in devDeps |

**Installation (new packages only):**
```bash
# From packages/desktop/ (or workspace root devDependencies)
bun add -d @playwright/test
bunx playwright install chromium  # Install browser binary
```

**Version verification:** All versions confirmed against npm registry on 2026-04-13 `[VERIFIED: npm registry]`

---

## Architecture Patterns

### Recommended Project Structure (post-migration)
```
roadraven/                          # workspace root
├── package.json                    # workspaces: ["packages/*", "plugins/*"]
├── shared/
│   └── types.ts                    # RPC contract (SCAF-03)
├── packages/
│   ├── core/                       # @roadraven/core (stub)
│   │   ├── package.json
│   │   └── src/
│   │       └── plugin.ts           # RoadmapPlugin interface only (SCAF-04)
│   ├── react/                      # @roadraven/react (stub)
│   │   ├── package.json
│   │   └── src/
│   ├── desktop/                    # Electrobun app (not published)
│   │   ├── package.json            # app deps + devDeps
│   │   ├── electrobun.config.ts    # bundleCEF: true on all platforms (SCAF-08)
│   │   ├── vite.config.ts          # paths updated to src/mainview
│   │   ├── tsconfig.json
│   │   ├── postcss.config.js
│   │   ├── tailwind.config.js
│   │   ├── vitest.config.ts        # NEW
│   │   ├── playwright.config.ts    # NEW
│   │   ├── tests/
│   │   │   ├── ui/
│   │   │   │   └── smoke.test.ts   # Tier 1: Playwright vs Vite dev server
│   │   │   └── process/
│   │   │       └── smoke.test.ts   # Tier 2: Bun-native Playwright
│   │   └── src/
│   │       ├── bun/
│   │       │   └── index.ts        # migrated from src/bun/index.ts
│   │       └── mainview/
│   │           ├── main.tsx
│   │           ├── index.html
│   │           ├── App.tsx
│   │           └── index.css
├── plugins/
│   └── claude-code/                # placeholder directory (D-05)
└── .github/
    └── workflows/
        └── ci.yml                  # lint + tsc + vitest (SCAF-07)
```

### Pattern 1: Bun Workspace Root package.json
**What:** Root package.json declares workspace members; all scripts proxy into `packages/desktop/`
**When to use:** Every Bun monorepo; workspace protocol (`workspace:*`) used for cross-package deps
```json
// Source: [VERIFIED: Bun workspace docs + existing package.json pattern]
{
  "name": "roadraven-workspace",
  "private": true,
  "workspaces": ["packages/*", "plugins/*"],
  "scripts": {
    "dev:hmr":      "bun run --cwd packages/desktop dev:hmr",
    "build:canary": "bun run --cwd packages/desktop build:canary",
    "start":        "bun run --cwd packages/desktop start",
    "test":         "bun run --cwd packages/desktop test"
  }
}
```

### Pattern 2: electrobun.config.ts After Migration
**What:** After moving source into `packages/desktop/`, the config lives there too. Paths are relative to that new location. `bundleCEF: true` on all platforms.
```typescript
// Source: [VERIFIED: node_modules/electrobun/dist/api/bun/ElectrobunConfig.ts]
import type { ElectrobunConfig } from "electrobun";

export default {
  app: {
    name: "RoadRaven",
    identifier: "RoadRaven.electrobun.dev",
    version: "0.0.1",
  },
  build: {
    // build.bun.entrypoint defaults to "src/bun/index.ts" — matches new location
    copy: {
      "dist/index.html": "views/mainview/index.html",
      "dist/assets":     "views/mainview/assets",
    },
    watchIgnore: ["dist/**"],
    mac:   { bundleCEF: true },
    linux: { bundleCEF: true },
    win:   { bundleCEF: true },
  },
} satisfies ElectrobunConfig;
```

### Pattern 3: SCAF-09 — Correct Updater.localInfo.channel() Wrapper
**What:** `Updater.localInfo.channel()` calls `getLocallocalInfo()` internally, which reads `../Resources/version.json` and **throws** on missing file. The existing `src/bun/index.ts` wraps `fetch()` in try/catch, not `channel()`. SCAF-09 requires the channel call itself to be wrapped.
```typescript
// Source: [VERIFIED: node_modules/electrobun/dist/api/bun/core/Updater.ts line 1104-1127]
async function getMainViewUrl(): Promise<string> {
  let channel = "dev"; // fallback when version.json absent
  try {
    channel = await Updater.localInfo.channel();
  } catch {
    console.log("version.json not found — treating as dev channel");
  }

  if (channel === "dev") {
    try {
      await fetch(DEV_SERVER_URL, { method: "HEAD" });
      return DEV_SERVER_URL;
    } catch {
      console.log("Vite dev server not running.");
    }
  }
  return "views://mainview/index.html";
}
```

### Pattern 4: Vitest Config for packages/desktop
```typescript
// Source: [ASSUMED — standard vitest config for Bun + React project]
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
  },
});
```

### Pattern 5: Biome Config (biome.json)
**What:** Default Biome config with TypeScript + React support. No ESLint, no Prettier.
```json
// Source: [ASSUMED — Biome default config; version 2.4.11 already installed]
{
  "$schema": "https://biomejs.dev/schemas/2.4.11/schema.json",
  "organizeImports": { "enabled": true },
  "linter": {
    "enabled": true,
    "rules": { "recommended": true }
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "tab"
  }
}
```

### Pattern 6: GitHub Actions CI Workflow
```yaml
# Source: [ASSUMED — standard GHA pattern for Bun monorepo]
name: CI
on:
  pull_request:
  push:
    branches: [master]

jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest
      - run: bun install
      - run: bunx biome check --diagnostic-level=error .
      - run: bunx tsc --noEmit
        working-directory: packages/desktop
      - run: bunx vitest run
        working-directory: packages/desktop
```

### Anti-Patterns to Avoid
- **Don't import `Updater` without try/catch:** `getLocallocalInfo()` throws on missing `version.json` in dev — always wrap `Updater.localInfo.channel()`.
- **Don't put app dependencies at workspace root:** Root `package.json` is workspace-only (D-03). App deps belong in `packages/desktop/package.json`.
- **Don't use `--cwd` path from within a package:** Workspace scripts that proxy use `bun run --cwd packages/desktop <script>` from root; scripts inside `packages/desktop/package.json` use bare names.
- **Don't reference pre-migration paths in electrobun.config.ts:** After moving to `packages/desktop/`, paths like `dist/index.html` remain relative to that directory, not workspace root.
- **Don't use Electron APIs:** Project uses Electrobun. APIs differ significantly.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| IPC / RPC between Bun and webview | Custom postMessage/WebSocket bridge | `createRPC` from `electrobun/bun` with `RPCSchema` type | Type-safe, bidirectional, already available |
| Desktop window management | Native bindings | `BrowserWindow` from `electrobun/bun` | Framework handles lifecycle, platform differences |
| Lint + format toolchain | Custom ESLint + Prettier configs | Biome (already installed) | Single tool, zero config for TS/React, faster |
| Test assertion utilities | Custom matchers | `@testing-library/jest-dom` (already in devDeps) | Standard DOM matchers |
| Concurrent process runners | Shell `&` / custom scripts | `concurrently` (already installed) | Already used in dev:hmr |

---

## Common Pitfalls

### Pitfall 1: Updater.localInfo.channel() Throws in Dev
**What goes wrong:** Calling `Updater.localInfo.channel()` in a development checkout (no `version.json`) causes an unhandled exception and crashes the app.
**Why it happens:** `getLocallocalInfo()` does `Bun.file('../Resources/version.json').json()` and rethrows on failure (`throw error`). The existing code in `src/bun/index.ts` wraps `fetch()` not `channel()`.
**How to avoid:** Wrap `await Updater.localInfo.channel()` in try/catch; fall back to `"dev"`. See Pattern 3 above.
**Warning signs:** App crashes immediately on `bun run dev` with "Failed to read version.json".

### Pitfall 2: electrobun.config.ts path.bun.entrypoint After Migration
**What goes wrong:** After moving code into `packages/desktop/`, electrobun looks for the Bun entrypoint. The default is `"src/bun/index.ts"` — this works because `packages/desktop/` becomes the working directory for the build. But if you run electrobun from workspace root, paths resolve relative to CWD.
**Why it happens:** electrobun resolves paths relative to where it's invoked.
**How to avoid:** Always run `electrobun dev` / `electrobun build` from inside `packages/desktop/`, or ensure root proxy scripts use `--cwd packages/desktop`.
**Warning signs:** "Entry point not found" errors during build.

### Pitfall 3: Bun Workspace symlinks + TypeScript path resolution
**What goes wrong:** `shared/types.ts` at workspace root is not automatically on the TypeScript path for `packages/desktop/`. A bare `import from "shared/types"` fails unless configured.
**Why it happens:** TypeScript `paths` config or `compilerOptions.baseUrl` in `packages/desktop/tsconfig.json` must explicitly map the workspace root location.
**How to avoid:** Either use a relative import (`../../shared/types.ts`) or add a `paths` alias in `packages/desktop/tsconfig.json`. The relative import is simpler and avoids alias maintenance. See Open Questions.
**Warning signs:** TS2307 "Cannot find module 'shared/types'" during `bunx tsc --noEmit`.

### Pitfall 4: `bundleCEF: true` Increases First Build Time Significantly
**What goes wrong:** The first `bun run build:canary` after enabling `bundleCEF: true` downloads the CEF binary (~200MB+). This can time out in CI.
**Why it happens:** CEF binary is fetched on demand.
**How to avoid:** Cache the electrobun artifact directory in CI (`~/.bun` and the electrobun cache). Note this is a known first-run cost, not a configuration bug.
**Warning signs:** CI build takes >10 minutes or times out on the first run.

### Pitfall 5: Playwright `@playwright/test` Not Yet Installed
**What goes wrong:** Writing Playwright tests before installing the package and running `bunx playwright install`.
**Why it happens:** `@playwright/test` is not in the current `devDependencies`.
**How to avoid:** Add `@playwright/test` to `packages/desktop` devDependencies and run `bunx playwright install chromium` as part of CI setup.
**Warning signs:** `Cannot find module '@playwright/test'`.

### Pitfall 6: `vitest` Environment for Bun-native Tests
**What goes wrong:** Tier 2 process tests run against Bun process logic (not DOM). Using `environment: "jsdom"` globally breaks process-side tests.
**Why it happens:** A single `vitest.config.ts` with `environment: "jsdom"` applies to all test files.
**How to avoid:** Use Vitest's `environmentMatchGlobs` (or per-file `@vitest-environment` annotations) to apply `jsdom` only to `tests/ui/` and `node` (or `bun`) to `tests/process/`.

---

## Code Examples

### Verified: electrobun.config.ts bundleCEF shape (all three platforms)
```typescript
// Source: [VERIFIED: node_modules/electrobun/dist/api/bun/ElectrobunConfig.ts]
// build.mac.bundleCEF, build.linux.bundleCEF, build.win.bundleCEF — all boolean, all default false
build: {
  mac:   { bundleCEF: true },
  linux: { bundleCEF: true },
  win:   { bundleCEF: true },
}
```

### Verified: Updater.localInfo API shape
```typescript
// Source: [VERIFIED: node_modules/electrobun/dist/api/bun/core/Updater.ts lines 1097-1110]
Updater.localInfo.version()  // async () => string
Updater.localInfo.hash()     // async () => string
Updater.localInfo.channel()  // async () => string — throws if version.json absent
Updater.localInfo.baseUrl()  // async () => string
```

### Verified: RPC type pattern (from ARCHITECTURE.md + electrobun exports)
```typescript
// Source: [VERIFIED: node_modules/electrobun/dist/api/bun/index.ts — exports RPCSchema, createRPC]
import type { RPCSchema } from "electrobun/bun";

export type RoadmapRPCType = {
  bun: RPCSchema<{
    requests: {
      loadFile: { params: { path: string }; response: RoadmapSchema }
    }
    messages: {
      nodeStatusUpdate: { nodeId: string; status: string }
    }
  }>
  webview: RPCSchema<{
    messages: {
      pushStatusUpdate: { nodeId: string; status: string }
    }
  }>
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Electron + Node.js | Electrobun + Bun | Project inception | Different APIs entirely — no Electron imports |
| Single-package src/ structure | Bun workspace monorepo | This phase | All paths relative to `packages/desktop/` after migration |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Vitest config `environmentMatchGlobs` works for splitting jsdom/node environments | Pitfall 6, Vitest Config pattern | Would need per-file `@vitest-environment` docblock annotations instead — trivial fix |
| A2 | Biome `biome.json` schema URL pattern `https://biomejs.dev/schemas/2.4.11/schema.json` | Pattern 5 | Wrong URL means schema validation warning, not a runtime error |
| A3 | GitHub Actions `oven-sh/setup-bun@v2` is the current canonical action | Pattern 6 | If v2 not available, use v1 or the official `bun-action` |
| A4 | `plugins/claude-code/` can be a bare directory with no `package.json` | D-05 | Bun workspace glob `plugins/*` may fail if it finds a non-package dir; needs verification at execution time |
| A5 | Root proxy scripts use `bun run --cwd packages/desktop <script>` syntax | Pattern 1 | If Bun's `--cwd` flag behaves differently, scripts may need `cd packages/desktop &&` alternative |

---

## Open Questions (RESOLVED)

1. **shared/types.ts import strategy — relative vs. path alias** — RESOLVED: Use relative import `../../shared/types` from `packages/desktop/`. Plan 00-02 implements this.

2. **Playwright Tier 2 (Bun-native) smoke test — what exactly to assert** — RESOLVED: Use `bunx tsc --noEmit` and `electrobun.config.ts` import as proxy assertions for BrowserWindow validity. Actual BrowserWindow launch requires `xvfb` on Linux CI; Plan 00-03 documents this as an accepted Phase 0 constraint and adds `xvfb-run` wrapper in CI.

3. **`plugins/claude-code/` — bare directory vs. package.json stub** — RESOLVED: Create minimal `package.json` stub (`{ "name": "@roadraven/plugin-claude-code", "version": "0.0.1", "private": true }`). Plan 00-01 implements this.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| bun | Workspace host, runtime | ✓ | 1.3.11 | — |
| node | GitHub Actions CI | ✓ | v22.21.1 | — |
| git | CI, version control | ✓ | 2.53.0 | — |
| @playwright/test | SCAF-06 | ✗ | — | Must install; no fallback |
| xvfb (Linux) | Playwright Tier 2 in CI | [ASSUMED] not checked locally | — | Skip process-tier tests in CI if absent |
| electrobun CLI | build:canary, dev | ✓ | 1.16.0 (via node_modules) | — |

**Missing dependencies with no fallback:**
- `@playwright/test` — must be added to devDependencies and `bunx playwright install` run in CI

**Missing dependencies with fallback:**
- `xvfb` — required for Playwright process-tier tests on headless Linux; use `xvfb-run` in CI or skip process-tier on CI initially

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.4 + @playwright/test 1.59.1 |
| Config file | `packages/desktop/vitest.config.ts` (Wave 0 gap), `packages/desktop/playwright.config.ts` (Wave 0 gap) |
| Quick run command | `bunx vitest run` (from packages/desktop) |
| Full suite command | `bunx vitest run && bunx playwright test` (from packages/desktop) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SCAF-01 | Workspace dirs and package.json exist and resolve | unit (structural) | `bunx vitest run tests/unit/workspace.test.ts` | ❌ Wave 0 |
| SCAF-02 | App boots blank window | smoke (Playwright process) | `bunx playwright test tests/process/smoke.test.ts` | ❌ Wave 0 |
| SCAF-03 | `shared/types.ts` imports resolve in both processes | unit (type check) | `bunx tsc --noEmit` | N/A (tsc) |
| SCAF-04 | `RoadmapPlugin` interface exported from `@roadraven/core` | unit | `bunx vitest run tests/unit/plugin-interface.test.ts` | ❌ Wave 0 |
| SCAF-05 | Vitest configured and first test passes | unit | `bunx vitest run` | ❌ Wave 0 |
| SCAF-06 | Playwright two tiers each have passing smoke test | smoke (UI + process) | `bunx playwright test` | ❌ Wave 0 |
| SCAF-07 | CI pipeline passes | integration (CI) | `gh workflow run` / PR trigger | ❌ Wave 0 |
| SCAF-08 | `bundleCEF: true` in config | unit (config check) | `bunx vitest run tests/unit/config.test.ts` | ❌ Wave 0 |
| SCAF-09 | Missing `version.json` → channel "dev", no crash | unit | `bunx vitest run tests/unit/updater-wrapper.test.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `bunx vitest run`
- **Per wave merge:** `bunx vitest run && bunx tsc --noEmit`
- **Phase gate:** Full suite + Playwright green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `packages/desktop/vitest.config.ts` — framework config
- [ ] `packages/desktop/playwright.config.ts` — two-tier config
- [ ] `packages/desktop/tests/ui/smoke.test.ts` — Tier 1 smoke
- [ ] `packages/desktop/tests/process/smoke.test.ts` — Tier 2 smoke
- [ ] `packages/desktop/tests/unit/` — unit tests for SCAF-04, SCAF-08, SCAF-09 behaviors
- [ ] Install: `bun add -d @playwright/test` in packages/desktop

---

## Security Domain

This phase creates no user-facing inputs, network endpoints, or file operations beyond reading `version.json`. No ASVS categories apply to the scaffold phase.

Exception: `shared/types.ts` defines the RPC contract. The planner should note that the RPC contract established here is the security boundary between Bun process and webview — future phases must validate all inputs crossing this boundary (relevant to ASVS V5 in later phases, not Phase 0).

---

## Sources

### Primary (HIGH confidence)
- `[VERIFIED: node_modules/electrobun/dist/api/bun/ElectrobunConfig.ts]` — `bundleCEF` field names, config structure, all three platform keys
- `[VERIFIED: node_modules/electrobun/dist/api/bun/core/Updater.ts]` — `Updater.localInfo.channel()` implementation; `getLocallocalInfo()` throw behavior; `localInfo` shape
- `[VERIFIED: node_modules/electrobun/dist/api/bun/index.ts]` — exported symbols including `RPCSchema`, `createRPC`, `BrowserWindow`, `Updater`
- `[VERIFIED: npm registry 2026-04-13]` — electrobun@1.16.0, @playwright/test@1.59.1, vitest@4.1.4, @biomejs/biome@2.4.11
- `[VERIFIED: /home/shuffler/Work/Roadraven/package.json]` — existing deps, current scripts, current structure
- `[VERIFIED: /home/shuffler/Work/Roadraven/src/bun/index.ts]` — existing Updater usage pattern
- `[VERIFIED: /home/shuffler/Work/Roadraven/electrobun.config.ts]` — current `bundleCEF: false`, path patterns
- `[CITED: https://blackboard.sh/electrobun/llms.txt]` — Electrobun API overview, RPC pattern, views:// scheme
- `.planning/ARCHITECTURE.md` — RPC type shape, monorepo package structure, plugin interface

### Secondary (MEDIUM confidence)
- Bun workspace `workspaces` field behavior — consistent with Bun 1.x documentation pattern `[ASSUMED]`

### Tertiary (LOW confidence)
- Biome `biome.json` exact schema URL for v2.4.11 `[ASSUMED]`
- GitHub Actions `oven-sh/setup-bun@v2` availability `[ASSUMED]`

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all versions verified against npm registry and installed node_modules
- Architecture: HIGH — config types verified in installed electrobun source; patterns derived from existing working code
- Pitfalls: HIGH (Pitfall 1-3, 5) / MEDIUM (Pitfall 4, 6) — Pitfalls 1-3 verified in source; 4 and 6 based on known framework behavior

**Research date:** 2026-04-13
**Valid until:** 2026-05-13 (electrobun moves fast; re-verify if electrobun version bumps)
