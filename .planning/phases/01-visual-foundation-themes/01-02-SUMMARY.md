---
phase: 01-visual-foundation-themes
plan: 02
subsystem: app-shell-components
tags: [react-components, tailwind-tokens, tdd, aria, app-shell]
dependency_graph:
  requires: [rv-tokens, theme-store, theme-provider, rpc-module]
  provides: [topbar, sidebar, canvas, roadmap-node, side-panel, status-bar, config-panel, app-shell-grid]
  affects: [all-phase-2-data-wiring]
tech_stack:
  added: []
  patterns: [token-only-styling, status-token-map, css-variable-theming, grid-area-layout]
key_files:
  created:
    - packages/desktop/src/mainview/components/TopBar.tsx
    - packages/desktop/src/mainview/components/Sidebar.tsx
    - packages/desktop/src/mainview/components/Canvas.tsx
    - packages/desktop/src/mainview/components/StatusBar.tsx
    - packages/desktop/src/mainview/components/ConfigPanel.tsx
    - packages/desktop/src/mainview/components/RoadmapNode.tsx
    - packages/desktop/src/mainview/components/SidePanel.tsx
    - packages/desktop/tests/unit/ui/components.test.tsx
  modified:
    - packages/desktop/src/mainview/App.tsx
decisions:
  - Used inline style for Canvas dot-grid since Tailwind cannot generate radial-gradient utilities
  - RoadmapNode uses CSS custom properties (--node-stripe-color, --badge-color, --badge-bg) for dynamic status coloring without hardcoded values
  - SidePanel renders all field sections as static skeleton data (Phase 2 wires real data)
metrics:
  duration: 269s
  completed: 2026-04-13T18:23:18Z
  tasks: 2/3 (Task 3 is checkpoint:human-verify)
  files: 9
---

# Phase 01 Plan 02: App Shell Components Summary

Built 7 app shell components (TopBar, Sidebar, Canvas, RoadmapNode, SidePanel, StatusBar, ConfigPanel) as token-only static skeletons matching variant-c-merged.html, with 4-button theme switcher and TDD-verified status token mapping.

## Task Results

| Task | Name | Commit | Tests |
|------|------|--------|-------|
| 1 | TopBar + Sidebar + Canvas + StatusBar + ConfigPanel | a6fe022 | 0 (visual) |
| 2 | RoadmapNode + SidePanel + component tests (TDD) | c7a493f (RED), 466e496 (GREEN) | 8 pass |
| 3 | Visual verification of complete app shell | awaiting-human-verify | - |

## What Was Built

### Task 1: App Shell Components
- **TopBar**: 50px toolbar with brand (SVG + "RoadRaven"), New/Open action buttons, 220px search bar with Ctrl+F hint, Fit/Zoom controls, TB/LR layout toggle (radiogroup), 4-button theme switcher (dark/light/high-contrast/system per D-04) wired to setTheme, settings gear button. All ARIA attributes (role="toolbar", role="radiogroup", aria-checked comparing preference).
- **Sidebar**: 220px expanded / 48px collapsed with 200ms width transition. Header with Explorer title and collapse button (rotates 180deg). Recent Files and Outline sections with file items. Bottom section with Preferences and Help. role="navigation", aria-label="Sidebar navigation".
- **Canvas**: bg-rv-bg-canvas with radial-gradient dot grid (40px spacing). 3 sample RoadmapNode cards at absolute positions. SVG connector placeholder paths using var(--rv-line-connector).
- **StatusBar**: 32px footer with three-section flex layout. Left: green connection dot + "Connected". Center: "sample-roadmap.json". Right: "42 nodes" + activity icon.
- **ConfigPanel**: Floating 260px panel (absolute bottom-right) with toggle button. Canvas Options title, Node Corners (Rounded/Sharp), Connectors (Curved/Straight), Gap presets (Compact/Default/Spacious). Hidden by default via useState toggle.
- **App.tsx**: Replaced placeholder divs with actual component imports in CSS Grid layout.

### Task 2: RoadmapNode + SidePanel (TDD)
- **RoadmapNode**: STATUS_TOKEN_MAP mapping 4 statuses to --rv-status-* color/bg tokens. Root div with .node class for ::before stripe. CSS variables --node-stripe-color, --badge-color, --badge-bg set via inline style. Badge pill with 6x6 dot + capitalized text label (never color-only per PACK-06). Hover state via group pattern.
- **SidePanel**: 340px open / 0px closed with 200ms ease-out transition. Header with "Node Details" title and close button (aria-label="Close panel"). Field sections: STATUS (select display with dot), TYPE (accent badge), CREATED/UPDATED (meta rows), ID (with copy button), NOTES (with inline code styling). All labels uppercase via FieldLabel component.
- **Tests**: 8 tests covering title rendering, badge text, CSS variable assignment, field labels, aria-label, closed width, and hardcoded color grep.

## Verification

- All 34 tests pass (bunx vitest run tests/unit/ui/)
- Zero hardcoded hex/rgb/hsl colors in any component file (grep verified)
- All ARIA attributes present: role="toolbar", role="navigation", role="radiogroup", aria-label on all interactive elements
- Theme switcher has 4 buttons comparing against preference (not resolvedTheme)

## Deviations from Plan

None - plan executed exactly as written.

## Checkpoint: Task 3 (human-verify)

**Status:** awaiting-human-verify

Task 3 requires visual verification of the complete app shell with all 7 components rendered in the CSS Grid layout. The user needs to:

1. Run `cd packages/desktop && bun run hmr` to start Vite dev server
2. Open http://localhost:5173 in browser
3. Verify theme switching (dark/light/high-contrast/system) via 4 top bar buttons
4. Verify sidebar collapse animation (220px to 48px)
5. Verify config panel toggle (bottom-right button)
6. Verify 3 sample node cards with colored status stripes
7. Compare layout with `.planning/design/variant-c-merged.html`
8. Inspect DevTools to confirm all colors come from CSS custom properties

## Self-Check: PASSED

All 9 created/modified files verified on disk. All 3 commit hashes found in git log.
