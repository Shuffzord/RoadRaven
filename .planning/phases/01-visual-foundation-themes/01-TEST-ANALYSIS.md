# Phase 01 — Test Quality & Coverage Analysis

> Generated: 2026-04-14
> Test run: 59 passed, 0 failed (7 files, 2.33s)

---

## Section A: Test Inventory

| File | Tests | What it covers | Environment | Mocking strategy |
|------|-------|----------------|-------------|------------------|
| `tests/unit/smoke.test.ts` | 9 | Monorepo structure (file existence), RoadmapPlugin interface exports, bundleCEF config, RPC contract types, Updater safety pattern | node | None -- reads files from disk with `readFileSync` |
| `tests/unit/ui/tailwindSetup.test.ts` | 12 | Tailwind v4 migration (no postcss/tailwind config), Vite plugin usage, index.css token system (all 40+ tokens in 3 themes), vitest env config, shared/types RPC types | node | None -- reads files from disk with `readFileSync` |
| `tests/unit/ui/themeStore.test.ts` | 7 | Zustand theme store: defaults, setTheme, updateSystemResolution, system resolution, saveSettings RPC calls | jsdom | `vi.mock("../rpc")` -- mocks electroview.rpc.request.saveSettings/loadSettings |
| `tests/unit/ui/ThemeProvider.test.tsx` | 7 | ThemeProvider: data-theme attribute on mount/change, matchMedia listener registration/cleanup, loadSettings on mount, fallback on RPC failure | jsdom | `vi.mock("../rpc")` + mock matchMedia |
| `tests/unit/ui/components.test.tsx` | 7 | RoadmapNode: title, status badge, CSS variables. SidePanel: field labels, close button, closed width. Hardcoded color check across all component files | jsdom | `vi.mock("../rpc")` |
| `tests/unit/ui/themeOverrides.test.tsx` | 9 | buildOverrideVars: empty config, statusColors mapping, borderRadius, CSS injection prevention. ThemeOverrideProvider: scoped container, NOT on documentElement, theme switch retention | jsdom | `vi.mock("../rpc")` |
| `tests/unit/logging.test.ts` | 8 | getLogDirectory: platform-specific paths (win32, darwin, linux). settings: loadSettings/saveSettings round-trip, merge. setupBunLogging: source file string checks | node | `Object.defineProperty(process, "platform", ...)`, process.env mutation |

**Total: 59 tests across 7 files**

---

## Section B: Coverage Assessment

| Source Module | Coverage | Notes |
|---------------|----------|-------|
| `src/mainview/store/themeStore.ts` | **Well tested** | All state transitions covered, RPC call verification, system resolution logic |
| `src/mainview/components/ThemeProvider.tsx` | **Well tested** | Mount, theme switch, matchMedia, settings load/error. Missing: concurrent setTheme race condition |
| `src/mainview/components/ThemeOverrideProvider.tsx` | **Well tested** | buildOverrideVars pure function thoroughly tested including security validation |
| `src/mainview/components/RoadmapNode.tsx` | **Partially tested** | Happy path for 2 statuses. Missing: all 4 status values, formatStatus edge cases |
| `src/mainview/components/SidePanel.tsx` | **Partially tested** | Static content and close button. Missing: onClose callback invocation, open/closed transition |
| `src/mainview/components/TopBar.tsx` | **Untested** | No direct tests. Only covered by hardcoded color check |
| `src/mainview/components/Sidebar.tsx` | **Untested** | No direct tests. Only covered by hardcoded color check |
| `src/mainview/components/Canvas.tsx` | **Untested** | No direct tests. Only covered by hardcoded color check |
| `src/mainview/components/StatusBar.tsx` | **Untested** | No direct tests. Only covered by hardcoded color check |
| `src/mainview/components/ConfigPanel.tsx` | **Untested** | No direct tests. Only covered by hardcoded color check |
| `src/mainview/hooks/useTheme.ts` | **Partially tested** | Tested indirectly via ThemeProvider.test.tsx useTheme hook test (shape only) |
| `src/mainview/rpc.ts` | **Untestable in current setup** | Imports `Electroview` from `electrobun/view` at module level -- crashes outside Electrobun runtime. All tests mock this module entirely |
| `src/mainview/logging/logger.ts` | **Untested** | No tests for setupWebviewLogging, RPC log forwarding buffer/retry, or hierarchical loggers |
| `src/mainview/main.tsx` | **Untestable in current setup** | Module-level side effects (top-level await, createRoot). Would need E2E |
| `src/mainview/index.css` | **Well tested** | Token presence in all 3 theme blocks, @theme bridging, Tailwind directives all verified |
| `src/bun/logging.ts` | **Partially tested** | getLogDirectory platform paths tested. setupBunLogging only verified via string matching on source (line 100-108 in logging.test.ts) -- NOT actually executed |
| `src/bun/settings.ts` | **Well tested** | Round-trip, merge, missing file. Actual filesystem I/O tested |
| `src/bun/index.ts` | **Untestable in current setup** | Imports electrobun/bun, has top-level await, creates BrowserWindow. Would need full Electrobun runtime |
| `shared/types.ts` | **Partially tested** | String presence checks for type names. No type-level validation |

---

## Section C: Gap Analysis — Why Tests Missed Runtime Errors

### Gap 1: LogTape `getStreamSink` expects Web WritableStream, code originally used Node.js stream

**What happened:** The bun/logging.ts originally passed a Node.js `Writable` stream to `getStreamSink()`, which requires the Web `WritableStream` API. This crashed at runtime.

**Why tests missed it:** The test at `logging.test.ts:100-108` does NOT execute `setupBunLogging()`. It reads the source file as a string and checks for substring presence:

```
expect(loggingSource).toContain("getStreamSink");
expect(loggingSource).toContain("WritableStream");
```

This is a **file-content assertion**, not a behavioral test. It checks that the words exist in the source, not that the code runs correctly. The original code also contained "WritableStream" (as the Node.js import name), so the string check passed while the runtime behavior was wrong.

**What would catch it:** A test that actually calls `setupBunLogging()` in a Bun environment and verifies a log message can be written to the stream sink. Even a smoke test like `const stream = new WritableStream({...}); getStreamSink(stream)` would catch the type mismatch.

### Gap 2: `mainWindow.rpc.handle()` does not exist in Electrobun

**What happened:** The original code used `mainWindow.rpc.handle("saveSettings", ...)` which is an Electron pattern. Electrobun uses `BrowserView.defineRPC()` with handlers declared upfront.

**Why tests missed it:** `src/bun/index.ts` is completely untested -- it cannot be imported in vitest because it immediately executes `import { BrowserWindow } from "electrobun/bun"` and `await setupBunLogging()` at module level. Every test file that touches the renderer side mocks `../rpc` entirely, so the actual Electrobun API surface is never validated.

**What would catch it:** (1) A type-level test importing `RoadmapRPCType` and asserting the handler signatures match what Electrobun expects. (2) A Bun-based process smoke test (like `tests/process/smoke.test.ts` already does for parse-ability) that validates the RPC handler structure compiles. (3) A contract test that validates `BrowserView.defineRPC` receives the correct shape.

### Gap 3: CSS `@import` ordering

**What happened:** The `@import url(...)` for Google Fonts was placed after `@import "tailwindcss"`, causing CSS build warnings or failures because Tailwind v4 requires `@import "tailwindcss"` to be the first import.

**Why tests missed it:** `tailwindSetup.test.ts` checks that `@import "tailwindcss"` exists in the file via regex, but does NOT verify its position relative to other `@import` statements. The test at line 31-33:

```
expect(css()).toMatch(/@import\s+["']tailwindcss["']/);
```

This passes regardless of where the import appears in the file.

**What would catch it:** (1) A test that asserts `@import "tailwindcss"` appears before any other `@import` in the file (line number check). (2) A Vite build smoke test (`vite build` succeeds without warnings) -- this is the most reliable approach since CSS ordering rules are tool-specific.

### Gap 4: `electrobun/view` import crashes outside Electrobun runtime

**What happened:** `src/mainview/rpc.ts` line 1 has `import { Electroview } from "electrobun/view"` which crashes in any non-Electrobun environment (Vite dev server, vitest, Node.js).

**Why tests missed it:** Every single test file that imports any module depending on rpc.ts uses `vi.mock("../../../src/mainview/rpc", ...)` to replace it entirely. The mock is hoisted above the import, so the real module is never loaded. The tests work perfectly in isolation but tell us nothing about whether the import resolves in production.

**What would catch it:** (1) A Vite build test that runs `vite build` and checks for import resolution errors. (2) An integration test that loads the webview entry point without mocking. (3) The existing `tests/ui/smoke.test.ts` Playwright test (requires running Vite dev server) would catch this, but it uses Playwright which is not run as part of the standard `bunx vitest run` command.

---

## Section D: Flaky Test Risk

### 1. Timing-dependent tests

- **ThemeProvider.test.tsx:131,149** — Uses `await new Promise((r) => setTimeout(r, 10))` to wait for async `loadSettings` RPC. If the mock resolves slower than 10ms (unlikely but possible under load), the assertion would fail. These are the `"calls loadSettings on mount"` and `"uses default 'dark' when loadSettings RPC fails"` tests.
- **ThemeProvider.test.tsx:98** — `matchMedia` listener registration test depends on React effect timing after setState.

### 2. Filesystem-dependent tests

- **tailwindSetup.test.ts (all tests)** — Reads actual source files from disk using `readFileSync` with `__dirname`-relative paths. Will break if file locations change or during parallel test runs that modify files.
- **components.test.tsx:81-99** — Hardcoded color check reads all `.tsx` files from `src/mainview/components/` directory. Uses `fs.readdirSync` which can be affected by new files being added. Explicitly excludes `ThemeOverrideProvider.tsx` (line 87) -- any new component with legitimate hex colors would break this test.
- **logging.test.ts:46-96** — Settings tests write to `process.cwd()/.roadmap-settings.json`. Concurrent test runs in the same directory would conflict. Cleanup uses `try { unlinkSync } catch {}` which silently ignores failures.

### 3. Process-level mutation

- **logging.test.ts:10-41** — Mutates `process.platform` via `Object.defineProperty` and `process.env`. The `afterEach` cleanup restores originals, but if a test throws before cleanup, subsequent tests run with wrong platform. Module re-imports via `await import()` rely on Vitest module cache behavior.

### 4. Module-level side effects

- **themeStore.ts:17-26** — The store's `systemResolution` initial value reads `window.matchMedia` at module evaluation time. In jsdom tests, the mock must be set up before the module loads, but Vitest hoists `vi.mock` calls. If test ordering changes, the initial value could differ.

---

## Section E: Recommendations

### Critical — Would catch the class of bugs already found

| # | Test | What it catches | Effort |
|---|------|----------------|--------|
| C1 | **Vite build smoke test**: Run `vite build` in a test and assert exit code 0, no error output | CSS import ordering, import resolution failures (electrobun/view), Tailwind config issues, TypeScript compilation errors | Medium -- needs CI-compatible test runner, ~30s build time |
| C2 | **CSS import order assertion**: Assert `@import "tailwindcss"` line number < any `@import url(...)` line number in index.css | CSS ordering bugs that Tailwind v4 is strict about | Small -- pure string parsing test |
| C3 | **setupBunLogging execution test**: Actually call `setupBunLogging()` in Bun (not vitest), verify a log message writes to the file | WritableStream type mismatches, LogTape configuration errors, file permission issues | Medium -- needs Bun-specific test runner or subprocess |
| C4 | **RPC contract type test**: Import `RoadmapRPCType` and verify handler keys match what `BrowserView.defineRPC` / `Electroview.defineRPC` expect | RPC handler shape mismatches, missing handlers, wrong method names | Small -- type-level test using `satisfies` or conditional types |

### Important — Coverage gaps for core functionality

| # | Test | What it catches | Effort |
|---|------|----------------|--------|
| I1 | **TopBar render test**: Smoke render, theme switcher button clicks call setTheme, search input present | Rendering crashes, broken theme switching UI | Small |
| I2 | **Sidebar render test**: Collapsed/expanded states, collapse button toggle | Width transition logic, collapsed state rendering | Small |
| I3 | **Canvas render test**: Renders RoadmapNode children, SVG connectors present | Composition issues between Canvas and RoadmapNode | Small |
| I4 | **StatusBar render test**: Connected indicator, file name, node count | Static rendering crashes | Small |
| I5 | **ConfigPanel render test**: Toggle open/close, option group selection | State management, conditional rendering | Small |
| I6 | **setupWebviewLogging test**: RPC forwarding buffer/retry logic, consecutive failure cap, flush after success | Log forwarding failures silently dropping logs, buffer overflow | Medium |
| I7 | **RoadmapNode all-status test**: Render with each of 4 statuses, verify formatStatus output | Missing status handling, formatting edge cases | Small |

### Nice to have — Additional edge cases

| # | Test | What it catches | Effort |
|---|------|----------------|--------|
| N1 | **ThemeProvider concurrent setTheme**: Rapid theme switching (dark->light->dark) | Race conditions in state + RPC | Small |
| N2 | **Settings file corruption**: Load settings from malformed JSON | Crash on corrupt settings file (currently caught by try/catch but untested) | Small |
| N3 | **ThemeOverrideProvider with many overrides**: 100+ status colors | Performance degradation, inline style limits | Small |
| N4 | **SidePanel onClose callback**: Verify onClose fires when close button clicked | Broken callback wiring | Small |
| N5 | **Hardcoded color check expansion**: Include .ts files (not just .tsx), check CSS files for non-token direct color usage | Color token discipline as codebase grows | Small |

---

## Section F: Integration Test Strategy

### Tier 1: Vite Build Smoke (highest value, catches most of the found bugs)

Run `vite build` as a test step. This single test catches:
- CSS `@import` ordering violations
- Import resolution failures (`electrobun/view` outside runtime)
- TypeScript errors that vitest misses (different tsconfig)
- Tailwind v4 configuration issues
- Missing dependencies

**Implementation:** A test in `tests/integration/build.test.ts` using `child_process.exec("bunx vite build")`. Asserts exit code 0, no `ERROR` in stderr. Estimated runtime: 5-15s.

### Tier 2: RPC Contract Validation

Create a shared test that imports `RoadmapRPCType` and validates:
- Every request type in `bun.requests` has a corresponding handler in `src/bun/index.ts`
- Every request used by `electroview.rpc.request.*` in renderer code exists in `bun.requests`
- Parameter/response types are consistent

**Implementation:** Type-level test using TypeScript conditional types + a runtime test that reads handler keys from both sides. This prevents the `rpc.handle()` class of bugs where the API pattern itself is wrong.

### Tier 3: Component Render Smoke with Actual CSS

Current jsdom tests render components but Tailwind classes are not processed -- no actual CSS is applied. A test that:
1. Builds the CSS via Tailwind
2. Injects it into jsdom
3. Renders components and checks computed styles

This would catch broken Tailwind utility classes (e.g., `bg-rv-bg-base` not resolving because `@theme` is misconfigured).

**Implementation:** Medium-large effort. Requires PostCSS/Tailwind processing in test setup. Consider using Playwright component testing instead for true CSS validation.

### Tier 4: Playwright E2E (existing but disconnected)

The project already has `tests/ui/smoke.test.ts` and `tests/process/smoke.test.ts` using Playwright. These are NOT included in the `bunx vitest run` test suite. Integrating them into CI would provide:
- Real browser rendering validation
- Electrobun runtime behavior (if an Electrobun test harness exists)
- Full CSS cascade verification

**Priority order: Tier 1 > Tier 2 > Tier 4 > Tier 3**

Tier 1 alone would have caught 3 of the 4 runtime bugs found in this phase.

---

## Appendix: Test Run Output

```
RUN  v4.1.4 C:/Work/RoadRaven/packages/desktop

 tests/unit/smoke.test.ts (9 tests)
 tests/unit/ui/tailwindSetup.test.ts (12 tests)
 tests/unit/logging.test.ts (8 tests)
 tests/unit/ui/themeStore.test.ts (7 tests)
 tests/unit/ui/themeOverrides.test.tsx (9 tests)
 tests/unit/ui/components.test.tsx (7 tests)
 tests/unit/ui/ThemeProvider.test.tsx (7 tests)

 Test Files  7 passed (7)
      Tests  59 passed (59)
   Start at  10:19:57
   Duration  2.33s (transform 216ms, setup 0ms, import 851ms, tests 165ms, environment 7.61s)
```
