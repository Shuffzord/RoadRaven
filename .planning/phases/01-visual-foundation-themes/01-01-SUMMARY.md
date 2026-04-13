---
phase: 01-visual-foundation-themes
plan: 01
subsystem: theme-system
tags: [tailwind-v4, css-tokens, theme-provider, zustand, rpc]
dependency_graph:
  requires: []
  provides: [rv-tokens, theme-store, theme-provider, rpc-module, settings-rpc]
  affects: [all-ui-components, app-shell]
tech_stack:
  added: [tailwindcss-v4, "@tailwindcss/vite", jsdom]
  patterns: [css-custom-properties, data-theme-attribute, zustand-store, electrobun-rpc]
key_files:
  created:
    - packages/desktop/src/mainview/rpc.ts
    - packages/desktop/src/mainview/store/themeStore.ts
    - packages/desktop/src/mainview/components/ThemeProvider.tsx
    - packages/desktop/src/mainview/hooks/useTheme.ts
    - packages/desktop/tests/unit/ui/tailwindSetup.test.ts
    - packages/desktop/tests/unit/ui/themeStore.test.ts
    - packages/desktop/tests/unit/ui/ThemeProvider.test.tsx
  modified:
    - packages/desktop/package.json
    - packages/desktop/vite.config.ts
    - packages/desktop/vitest.config.ts
    - packages/desktop/src/mainview/index.css
    - packages/desktop/src/mainview/main.tsx
    - packages/desktop/src/mainview/App.tsx
    - shared/types.ts
  deleted:
    - packages/desktop/postcss.config.js
    - packages/desktop/tailwind.config.js
decisions:
  - Used @vitest-environment jsdom directive per-file instead of environmentMatchGlobs due to vitest v4 not reliably matching globs
  - Wrapped matchMedia call in store initializer with optional chaining and try-catch for test environment resilience
metrics:
  duration: 334s
  completed: 2026-04-13T18:14:58Z
  tasks: 2
  files: 16
---

# Phase 01 Plan 01: Tailwind v4 + Theme Token System + ThemeProvider Summary

Migrated to Tailwind CSS v4 with @theme directive, defined 40+ --rv-* CSS custom properties across three themes (dark/light/high-contrast), and implemented ThemeProvider with Zustand store, OS preference detection, and settings persistence via Electrobun RPC.

## Task Results

| Task | Name | Commit | Tests |
|------|------|--------|-------|
| 1 | Tailwind v4 migration + complete --rv-* token definitions | 01712de | 12 pass |
| 2 | ThemeProvider + Zustand store + Electrobun RPC + settings persistence + tests | 667ef23 | 14 pass |

## What Was Built

### Task 1: Tailwind v4 Migration + Token System
- Migrated from Tailwind v3 (PostCSS + JS config) to v4 (Vite plugin + CSS-first @theme)
- Deleted postcss.config.js and tailwind.config.js
- Defined complete --rv-* token system in index.css with @theme directive mapping to Tailwind utilities
- Three theme selector blocks: `:root/[data-theme="dark"]`, `[data-theme="light"]`, `[data-theme="high-contrast"]`
- 40+ tokens per theme covering: bg surfaces (13), text (4), borders (4), accent (4), canvas (2), shadows (4), scrollbar (2), status (8)
- Global styles: focus ring, scrollbar, node status stripe, app shell grid, reduced motion, Inter font
- Added AppSettings interface and saveSettings/loadSettings RPC types to shared/types.ts
- Configured vitest with jsdom for UI tests

### Task 2: ThemeProvider + Store + RPC
- Created rpc.ts — Electroview RPC initialization (single source of truth for webview RPC)
- Created themeStore.ts — Zustand store with preference/resolvedTheme/systemResolution
- Created ThemeProvider.tsx — sets data-theme attribute, listens for OS preference changes via matchMedia, restores saved theme on mount via loadSettings RPC
- Created useTheme.ts — convenience hook exposing { theme, preference, setTheme }
- Updated main.tsx to wrap App with ThemeProvider
- Updated App.tsx with grid shell layout using token-based Tailwind classes (no hardcoded colors)
- setTheme persists via saveSettings RPC; loadSettings restores on mount

## Verification

- All 35 tests pass (bunx vitest run)
- Zero hardcoded colors in component/hook/store files (grep verified)
- All acceptance criteria met for both tasks

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] vitest environmentMatchGlobs not reliably applied**
- **Found during:** Task 2
- **Issue:** vitest v4 did not apply jsdom environment via environmentMatchGlobs glob pattern
- **Fix:** Added `// @vitest-environment jsdom` directive directly in test files
- **Files modified:** themeStore.test.ts, ThemeProvider.test.tsx

**2. [Rule 1 - Bug] window.matchMedia not available during store initialization in jsdom**
- **Found during:** Task 2
- **Issue:** Zustand store initializer called window.matchMedia before jsdom set it up
- **Fix:** Wrapped in optional chaining (`matchMedia?.()`) and try-catch fallback to "dark"
- **Files modified:** packages/desktop/src/mainview/store/themeStore.ts

## Self-Check: PASSED

All 13 created/modified files verified on disk. Both deleted files confirmed absent. Both commit hashes found in git log.
