---
phase: 00-app-scaffold
reviewed: 2026-04-13T00:00:00Z
depth: standard
files_reviewed: 26
files_reviewed_list:
  - .github/workflows/ci.yml
  - .gitignore
  - biome.json
  - package.json
  - packages/core/package.json
  - packages/core/src/index.ts
  - packages/core/src/plugin.ts
  - packages/desktop/electrobun.config.ts
  - packages/desktop/package.json
  - packages/desktop/playwright.config.ts
  - packages/desktop/postcss.config.js
  - packages/desktop/src/bun/index.ts
  - packages/desktop/src/mainview/App.tsx
  - packages/desktop/src/mainview/index.css
  - packages/desktop/src/mainview/index.html
  - packages/desktop/src/mainview/main.tsx
  - packages/desktop/tailwind.config.js
  - packages/desktop/tests/process/smoke.test.ts
  - packages/desktop/tests/ui/smoke.test.ts
  - packages/desktop/tests/unit/smoke.test.ts
  - packages/desktop/tsconfig.json
  - packages/desktop/vite.config.ts
  - packages/desktop/vitest.config.ts
  - packages/react/package.json
  - packages/react/src/index.ts
  - plugins/claude-code/package.json
  - shared/types.ts
findings:
  critical: 0
  warning: 4
  info: 3
  total: 7
status: issues_found
---

# Phase 0: Code Review Report

**Reviewed:** 2026-04-13T00:00:00Z
**Depth:** standard
**Files Reviewed:** 26
**Status:** issues_found

## Summary

This is the initial scaffold for the RoadRaven Electrobun desktop app monorepo. The structure is well-organized with clear package boundaries, proper Electrobun patterns (not Electron), typed RPC contracts, and a solid CI pipeline. The codebase is small and mostly boilerplate at this stage. Issues found are minor -- primarily a type-check-breaking unused variable, a duplicated interface that will diverge, and a CI job that silently swallows test failures.

## Warnings

### WR-01: Unused state in App.tsx will fail TypeScript strict checks

**File:** `packages/desktop/src/mainview/App.tsx:4`
**Issue:** `count` and `setCount` are declared via `useState(0)` but never used. The tsconfig has `noUnusedLocals: true`, so `bunx tsc --noEmit` in CI will fail on this file once it is included in the compilation scope.
**Fix:**
```tsx
function App() {
	return (
		<div className="App">
			<h1>RoadRaven</h1>
			<div className="card"></div>
		</div>
	);
}
```

### WR-02: Duplicate IntegrationEvent interface will diverge

**File:** `shared/types.ts:22-27` and `packages/core/src/plugin.ts:5-11`
**Issue:** `IntegrationEvent` is defined identically in both files. As the project evolves, one copy will be updated and the other forgotten, causing silent type mismatches at integration boundaries. The core package should be the single source of truth, and `shared/types.ts` should import from it.
**Fix:** In `shared/types.ts`, replace the local definition with a re-export:
```ts
import type { IntegrationEvent } from "@roadraven/core";
export type { IntegrationEvent };
```
Note: this requires `shared/` to be able to resolve `@roadraven/core`. If that is not feasible at this stage, add a `// TODO: deduplicate with @roadraven/core IntegrationEvent` comment to both locations so the duplication is tracked.

### WR-03: CI e2e job silently swallows process test failures

**File:** `.github/workflows/ci.yml:58`
**Issue:** The line `xvfb-run bunx playwright test --project=process || echo "Process tests skipped (no display)"` means any failure in process tests (not just display-related ones) is silently ignored. A real regression in process tests would pass CI.
**Fix:** Either remove the `|| echo` fallback and let the step fail (preferred), or use `continue-on-error: true` at the step level so the failure is visible in the CI UI but non-blocking:
```yaml
      - run: xvfb-run bunx playwright test --project=process
        working-directory: packages/desktop
        continue-on-error: true
```

### WR-04: Non-null assertion on getElementById without fallback

**File:** `packages/desktop/src/mainview/main.tsx:6`
**Issue:** `document.getElementById("root")!` uses a non-null assertion. If the element is missing (e.g., HTML template mismatch), `createRoot` receives `null` and throws an opaque runtime error. A guard with a clear error message is safer.
**Fix:**
```tsx
const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("Root element #root not found in DOM");
createRoot(rootEl).render(
	<StrictMode>
		<App />
	</StrictMode>,
);
```

## Info

### IN-01: HTML title does not match application name

**File:** `packages/desktop/src/mainview/index.html:5`
**Issue:** The `<title>` tag says "React + Tailwind + Vite" -- a leftover from the Vite template. Should be "RoadRaven" to match the app name.
**Fix:**
```html
<title>RoadRaven</title>
```

### IN-02: shared/ directory not in workspace config

**File:** `package.json:4`
**Issue:** The root `workspaces` field lists `["packages/*", "plugins/*"]` but `shared/` is not a workspace. The desktop package imports from `shared/types.ts` via a relative path (`../../../../shared/types.ts`), which works but means `shared/` is invisible to workspace tooling (dependency resolution, scripts). This is acceptable for a single-file shared directory but will not scale.
**Fix:** No immediate action needed. When `shared/` grows beyond a single file, consider making it a proper workspace package (`@roadraven/shared`) or merging it into `@roadraven/core`.

### IN-03: Unused import of useState in App.tsx

**File:** `packages/desktop/src/mainview/App.tsx:1`
**Issue:** `useState` is imported but will be unused once WR-01 is fixed.
**Fix:** Remove the import when removing the unused state:
```tsx
function App() {
```

---

_Reviewed: 2026-04-13T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
