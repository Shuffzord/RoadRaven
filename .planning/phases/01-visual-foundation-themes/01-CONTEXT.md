# Phase 1: Visual Foundation & Themes - Context

**Gathered:** 2026-04-13
**Status:** Ready for planning

<domain>
## Phase Boundary

The app shell renders the intended design with all three built-in themes switchable, using only `--rv-*` CSS custom property tokens, before any real data is wired. This phase establishes the token system, `ThemeProvider`, app shell components (top bar, sidebar, canvas, status bar, node component skeleton, side panel skeleton), and per-schema theme overrides.

Layout composition details (exact sidebar behavior, panel positioning) are deferred to `/gsd:ui-phase` — this phase ensures the components exist and are theme-token-compliant.

</domain>

<decisions>
## Implementation Decisions

### Token Architecture & Tailwind Integration
- **D-01:** Migrate to **Tailwind v4** before any Phase 1 implementation work. Use the `@theme` directive to map `--rv-*` CSS custom properties into Tailwind utilities natively. This eliminates the dual-maintenance problem (CSS + JS config) and gives full modifier support (`bg-rv-surface/50` etc.) without workarounds. The current minimal v3 config makes migration trivial (~30 min with official codemod).
- **D-02:** Theme switching at runtime via swapping a `data-theme` attribute on the root element. CSS variable values defined per `[data-theme="dark"]`, `[data-theme="light"]`, `[data-theme="high-contrast"]` selectors. No page reload required.
- **D-03:** All components use Tailwind utility classes referencing `--rv-*` tokens (e.g., `bg-rv-surface`, `text-rv-text`). Zero hardcoded color values anywhere in component CSS — enforced by CI grep.

### Theme Switching UX
- **D-04:** Theme is switched via **menu items**. Four options: `Dark`, `Light`, `High Contrast`, `System`. `System` follows the OS `prefers-color-scheme` value (maps to dark or light theme). Manual selection overrides `System`.
- **D-05:** Theme preference persisted in `.roadmap-settings.json`. When set to `'system'`, the app respects OS preference and updates reactively if the OS setting changes.

### Per-Schema `themeConfig` Overrides
- **D-06:** Schema `themeConfig` overrides are applied **on top of whichever base theme is currently active**. Switching from dark to light retains the schema's custom overrides.
- **D-07:** Initial override scope is **focused**: status color mapping (custom colors per status) and node shape properties (border radius, etc.). NOT full system color changes (surface, text, background tokens). This keeps it simple for v1 while remaining extensible — the override system should be designed so expanding to full token overrides later is straightforward.
- **D-08:** Per-file overrides applied as CSS custom property values on a scoped container element (not globally on `:root`), so they don't leak to other parts of the UI.

### App Shell Layout (Directional — detailed in ui-phase)
- **D-09:** Main area is the node/tree editor with full keyboard support.
- **D-10:** Right side panel appears on node click for detail view.
- **D-11:** Left sidebar for navigation/tools/recent files/settings — may move to top bar; not locked.
- **D-12:** Bottom status bar for external events and general system status.
- **D-13:** `phase-1.html` is a color/theme reference, not a layout source of truth. Detailed layout composition will be specified in `/gsd:ui-phase`.

### Claude's Discretion
- Exact Tailwind v4 migration steps and codemod usage
- `@theme` token naming convention (e.g., `--color-rv-surface` vs `--color-rv-bg-surface`)
- Number and naming of `--rv-*` tokens in the initial token set
- How `System` theme preference detects and reacts to OS changes (media query listener pattern)
- Whether theme menu lives in native menu bar, hamburger menu, or both
- Internal structure of `.roadmap-settings.json` for theme preference storage

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Theme Requirements
- `.planning/REQUIREMENTS.md` §Theme System (THEME-01 through THEME-05) — full acceptance criteria for each theme requirement

### Design Reference
- `.planning/design/phase-1.html` — color/theme reference (not layout source of truth); use for color palette and visual tone guidance

### Architecture & Constraints
- `.planning/PROJECT.md` §Architecture — two-process model, Electrobun patterns
- `.planning/PROJECT.md` §Constraints — TDD-first, performance requirements

### Phase 0 Context
- `.planning/phases/00-app-scaffold/00-CONTEXT.md` — monorepo structure decisions, Biome linting, package scope (`@roadraven/`)

### Tailwind v4 Migration
- Tailwind CSS v4 upgrade guide: https://tailwindcss.com/docs/upgrade-guide
- Tailwind CSS `@theme` directive docs: https://tailwindcss.com/docs/theme

### Electrobun
- Electrobun LLM API reference: https://blackboard.sh/electrobun/llms.txt

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `packages/desktop/src/mainview/App.tsx`: Bare React component (`<h1>RoadRaven</h1>`). Will be replaced with app shell layout.
- `packages/desktop/src/mainview/index.css`: Contains only Tailwind directives. Will be expanded with `--rv-*` token definitions per theme.
- `packages/desktop/src/mainview/main.tsx`: React bootstrap with StrictMode. Reuse as-is.

### Established Patterns
- Tailwind CSS v3.4.16 currently configured with PostCSS + autoprefixer. Will be migrated to v4.
- TypeScript strict mode enabled.
- Biome for linting/formatting (Phase 0 decision).

### Integration Points
- `packages/desktop/tailwind.config.js` — will be replaced by Tailwind v4 CSS-first config (`@theme` in CSS file).
- `packages/desktop/postcss.config.js` — may need updating for Tailwind v4.
- `.roadmap-settings.json` — new file for persisting theme preference (and later, other user settings).

### What Does NOT Exist Yet
- No components directory, no hooks, no state management (Zustand not yet added)
- No theme system, no CSS custom properties
- No `ThemeProvider` component
- No app shell layout components (top bar, sidebar, canvas, status bar, side panel)

</code_context>

<specifics>
## Specific Ideas

- Status color mapping in `themeConfig` should allow schemas to define custom colors per status value (e.g., "in-progress" = specific blue, "blocked" = specific red), independent of the base theme.
- Node shape overrides should include at minimum border radius customization.
- The override system should be architected for extensibility — even though v1 only supports status colors and node shapes, adding full token overrides later should not require a rewrite.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 01-visual-foundation-themes*
*Context gathered: 2026-04-13*
