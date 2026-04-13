# Phase 1: Visual Foundation & Themes - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-13
**Phase:** 01-visual-foundation-themes
**Areas discussed:** Token architecture & Tailwind integration, App shell layout & composition, Theme persistence & switching UX, Per-schema themeConfig overrides, Testing & TDD strategy, Logging foundation

---

## Token Architecture & Tailwind Integration

Research agent spawned to investigate 5 approaches for integrating `--rv-*` CSS custom properties with Tailwind CSS.

| Option | Description | Selected |
|--------|-------------|----------|
| v3 darkMode + CSS vars | Standard v3 pattern with `darkMode: 'class'` and CSS variables | |
| Custom Tailwind plugin | Write plugin to generate utility classes from CSS custom properties | |
| Bypass Tailwind for colors | Use Tailwind for layout only, reference tokens via inline styles/custom CSS | |
| Tailwind v4 `@theme` directive | v4 native CSS variable theming with `@theme`, full modifier support | ✓ |
| Hybrid v3 `extend.colors` | Map tokens into `tailwind.config.js` as `theme.extend.colors` with `var()` refs | |

**User's choice:** Tailwind v4 `@theme` — best long-term and not too complex
**Notes:** Research showed v4.2 is stable, migration from current minimal v3 config estimated at ~30 minutes with official codemod. User prioritized long-term architecture over avoiding a migration step.

---

## App Shell Layout & Composition

| Option | Description | Selected |
|--------|-------------|----------|
| Discuss layout details now | Define exact sidebar/panel/toolbar positioning in Phase 1 context | |
| Defer to /gsd:ui-phase | Capture directional vision, detailed layout in ui-phase | ✓ |

**User's choice:** Defer to `/gsd:ui-phase` — user has a basic idea but not confident on details
**Notes:** User described directional vision: main area = tree editor, right side panel on node click, left sidebar for nav/tools/settings (may move to top bar), bottom status bar for events/system status. `phase-1.html` is a color reference, not layout source of truth.

---

## Theme Persistence & Switching UX

| Option | Description | Selected |
|--------|-------------|----------|
| Menu items | Switch themes from application menu | ✓ |
| Settings panel | Dedicated settings UI for theme selection | |
| Keyboard shortcut | Quick toggle via keyboard | |

**User's choice:** Menu items
**Notes:** Four options confirmed: Dark, Light, High Contrast, System. System follows OS preference.

---

## Per-Schema themeConfig Overrides

| Option | Description | Selected |
|--------|-------------|----------|
| Full token override (any `--rv-*` token) | Schema can override any system token | |
| Focused: status colors + node shapes | Override status color mapping and node shapes only | ✓ |
| Colors only | Only color overrides, no shape properties | |

**User's choice:** Focused scope initially — status color mapping and node shapes (border radius etc.)
**Notes:** User initially said "everything, no restrictions for power users" but revised to a simpler initial scope. System should be designed for extensibility so expanding to full overrides later is straightforward. Overrides apply on top of whichever base theme is active (not per-base-theme overrides).

---

## Testing & TDD Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Token-level unit tests | Assert CSS custom property values per theme via `getComputedStyle` | ✓ |
| `ThemeProvider` behavior tests | Switching, persistence, OS preference reactivity | ✓ |
| CI grep for hardcoded colors | Static analysis — zero hardcoded colors in component CSS | ✓ |
| Per-schema override tests | Verify overrides apply on scoped container, don't leak | ✓ |
| DOM and accessibility tests | ARIA attributes, keyboard accessibility of theme UI | ✓ |
| Snapshot / screenshot comparison | Visual regression testing across themes | |
| Computed style assertions per component | Assert exact RGB values on every component | |

**User's choice:** Token + behavior + CI grep + override + DOM/a11y tests. No snapshot or screenshot comparisons.
**Notes:** User emphasized TDD-first nature of the project. Rejected visual regression / snapshot tests as over-engineering. DOM and accessibility tests are acceptable. Natural TDD order: token assertions first, then ThemeProvider behavior, then component tests.

---

## Logging Foundation

Research agent investigated logging options for Electrobun's two-process model (Bun main + webview).

| Option | Description | Selected |
|--------|-------------|----------|
| LogTape | Zero deps, native Bun + browser, structured, 5.3 KB | ✓ |
| Pino | Fast JSON logging, needs bun-plugin-pino for Bun | |
| Winston | Broken on Bun >= 1.2.x, 17 deps | |
| Consola | Lightweight, no built-in file sink | |
| Bun console.* only | No persistence, no structure | |

**User's choice:** LogTape with RPC forwarding from webview to main process
**Notes:** Electrobun has no built-in logging API and no onConsoleMessage callback. Webview logs must forward via typed RPC. Main process owns all file I/O. User flagged logging as critical early in the project — established in Phase 1 so all subsequent phases just use it.

---

## Claude's Discretion

- Tailwind v4 migration steps and codemod usage
- Token naming convention
- Number/naming of initial `--rv-*` tokens
- OS theme detection mechanism
- Theme menu placement
- `.roadmap-settings.json` internal structure
- LogTape sink configuration details and category naming

## Deferred Ideas

None — discussion stayed within phase scope.
