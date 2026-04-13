---
phase: 1
slug: visual-foundation-themes
status: needs-refresh
reviewed_at: 2026-04-13
refresh_reason: Design reference changed from phase-1.html to variant-c-merged.html after user design review
shadcn_initialized: false
preset: none
created: 2026-04-13
---

# Phase 1 — UI Design Contract

> **STATUS: NEEDS REFRESH** — Design reference changed from `phase-1.html` to `variant-c-merged.html` after user design review. Key contradictions: node corners (was sharp/0px, now rounded/8px default + configurable), depth model (was no shadows, now subtle shadows on hover), accent color (was #ffffff, now #4a9eff blue), layout (top bar now has search/new/open/view controls, sidebar is 220px collapsible to 48px icon strip). Regenerate this spec before planning.
>
> Source of truth for all `--rv-*` token values, typography, color, spacing, and copy used by ThemeProvider and app shell components.

---

## Design System

| Property | Value | Source |
|----------|-------|--------|
| Tool | none — custom `--rv-*` CSS custom property system | CONTEXT.md D-01 |
| Preset | not applicable | — |
| Component library | none — hand-authored React components using Tailwind v4 utilities | CONTEXT.md D-03 |
| Icon library | Material Symbols Outlined (variable font; `wght` 300, `FILL` 0, `GRAD` 0, `opsz` 24) | phase-1.html |
| Font — UI | Inter (weights 400, 700) | phase-1.html + design.md |
| Font — Technical | Space Grotesk (weights 400, 700) | phase-1.html + design.md |
| Styling engine | Tailwind CSS v4 with `@theme` directive; `--rv-*` tokens mapped to Tailwind utilities | CONTEXT.md D-01 |
| Token application | `data-theme` attribute on root element; values defined per `[data-theme="dark"]` / `[data-theme="light"]` / `[data-theme="high-contrast"]` selectors | CONTEXT.md D-02 |
| Theme switching | Menu items: Dark / Light / High Contrast / System; System follows OS `prefers-color-scheme` reactively | CONTEXT.md D-04 |
| Hardcoded colors | Zero — enforced by CI grep | CONTEXT.md D-03, THEME-05 |

---

## Design North Star

"The Terminal Architect" — a high-information-density professional tool environment. Draws from VS Code, JetBrains IDEs, and CAD tooling. No softness, no shadows — containment via 1px borders and tonal background shifts only. Instant discrete feedback rather than bouncy transitions.

Source: design.md §1

---

## Spacing Scale

Declared values (all multiples of 4):

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Icon gaps, status stripe width, inline padding |
| sm | 8px | Compact element padding, node interior gaps |
| md | 12px | Standard element padding (design prefers density — 12px over 16px) |
| lg | 16px | Major section padding, sidebar padding |
| xl | 24px | Layout gaps between panels |
| 2xl | 32px | Canvas outer padding |
| 3xl | 48px | Top-bar height |

Exceptions:
- **Top bar height**: 56px (`h-14` in reference) — not a multiple of 8, but matches reference exactly; use as-is
- **Status bar height**: 40px — matches reference `h-10`; use as-is
- **Node status stripe**: 4px left border (`border-l-4`) — xs token
- **Icon-only button**: 32×32px touch target — source: design.md §4
- **Canvas dot-grid**: 40px cell size — source: phase-1.html `.canvas-grid`

Source: design.md §5 ("Base Unit: 4px grid"), phase-1.html measurements

---

## Typography

| Role | Family | Size | Weight | Line Height | Transform | Usage |
|------|--------|------|--------|-------------|-----------|-------|
| Heading | Inter | 14px | 700 (Bold) | 1.2 | Uppercase, tracking-tighter | Node titles, panel section titles, top bar app name |
| Body | Inter | 13px | 400 (Regular) | 1.5 | None | Side panel content, markdown body text |
| Label | Space Grotesk | 11px | 400 (Regular) | 1.2 | Uppercase, tracking-wider | Navigation items, node type labels, sidebar nav, status bar text |
| Micro | Space Grotesk | 10px | 400 (Regular) | 1.2 | Uppercase | Node IDs, metadata keys, timestamps, section headers in side panel |

Weights in use: 400 (Regular) and 700 (Bold) — exactly 2 weights.

Source: design.md §3 — "14px Bold Uppercase tracking-tighter / 13px Regular / 11px Monospace Uppercase tracking-wider / 10px Monospace Muted"

---

## Color

### Dark Theme (Default)

| Role | Token | Value | Usage |
|------|-------|-------|-------|
| Dominant (60%) — Background Root | `--rv-bg` | `#131313` | App background, canvas, top bar |
| Secondary (30%) — Surface Container | `--rv-surface` | `#1b1b1c` | Sidebar, side panel, drawers |
| Elevated Surface | `--rv-surface-elevated` | `#2a2a2a` | Hover states, active nodes, toolbar containers |
| Surface High | `--rv-surface-high` | `#353535` | Highest elevation — tooltips, dropdowns |
| Accent (10%) — Action Primary | `--rv-text-primary` | `#ffffff` | Primary text, active icons, selected border rings |
| Text Secondary | `--rv-text-secondary` | `#c6c6c6` | Body copy, inactive labels |
| Text Muted | `--rv-text-muted` | `#858585` | Placeholder text, micro metadata |
| Border Subtle | `--rv-border` | `rgba(255,255,255,0.1)` | Standard 1px separator everywhere |
| Border Active | `--rv-border-active` | `#ffffff` | Selection rings, active tab indicators |
| Destructive | `--rv-status-blocked` | `#c74e39` | Blocked status stripe + pill; destructive action confirmation buttons |

Source: design.md §2 + phase-1.html Tailwind color definitions

### Status Colors (all themes — overridable via per-schema `themeConfig`)

| Status | Token | Value | Usage |
|--------|-------|-------|-------|
| Todo / Pending | `--rv-status-todo` | `#858585` | Left stripe, pill background |
| In Progress | `--rv-status-in-progress` | `#e2c08d` | Left stripe, pill background |
| Done | `--rv-status-done` | `#81b88b` | Left stripe, pill background |
| Blocked | `--rv-status-blocked` | `#c74e39` | Left stripe, pill background |

Source: design.md §2 "Status colors"

Note: `phase-1.html` uses Tailwind color names (`emerald-500`, `amber-400`, `zinc-600`) — the `--rv-status-*` values above are the design.md canonical values. The design.md values take precedence for production tokens.

### Light Theme Token Overrides

Light theme inverts the surface stack. Surface values are not yet finalized by the user — apply these defaults, verified against WCAG AA contrast:

| Token | Light Value |
|-------|-------------|
| `--rv-bg` | `#f5f5f5` |
| `--rv-surface` | `#ffffff` |
| `--rv-surface-elevated` | `#ebebeb` |
| `--rv-surface-high` | `#e0e0e0` |
| `--rv-text-primary` | `#131313` |
| `--rv-text-secondary` | `#444444` |
| `--rv-text-muted` | `#888888` |
| `--rv-border` | `rgba(0,0,0,0.1)` |
| `--rv-border-active` | `#131313` |

Source: default — not specified in upstream artifacts; WCAG AA compliant inversion of dark palette

### High Contrast Theme Token Overrides

| Token | High Contrast Value |
|-------|---------------------|
| `--rv-bg` | `#000000` |
| `--rv-surface` | `#0a0a0a` |
| `--rv-surface-elevated` | `#1a1a1a` |
| `--rv-surface-high` | `#2a2a2a` |
| `--rv-text-primary` | `#ffffff` |
| `--rv-text-secondary` | `#ffffff` |
| `--rv-text-muted` | `#cccccc` |
| `--rv-border` | `rgba(255,255,255,0.4)` |
| `--rv-border-active` | `#ffffff` |

Source: default — high contrast WCAG AAA intent

### Accent Reserved For

Accent (`--rv-text-primary` / `#ffffff` in dark theme) is reserved for:
1. Active node selection ring (1px border)
2. Top bar app name text
3. Active navigation item highlight
4. Primary CTA button background
5. Status pill text on colored backgrounds

Accent is NOT used for: body text, secondary labels, inactive borders, backgrounds.

---

## Component Inventory

All components must use only `--rv-*` tokens. Zero hardcoded color values.

### Top Bar (`TopBar`)
- Height: 56px (`h-14`)
- Background: `--rv-bg` (`#131313`)
- Bottom border: 1px `--rv-border`
- App name: Inter 14px Bold Uppercase tracking-widest, `--rv-text-primary`
- Primary CTA button: `--rv-text-primary` background, `--rv-bg` text, Bold, sharp corners (0px border-radius), 12px text, Uppercase tracking-tighter
- Position: fixed top, full width, z-50

### Sidebar (`Sidebar`)
- Width: 256px (`w-64`)
- Background: `--rv-surface`
- Right border: 1px `--rv-border`
- Section header: padding 16px, bottom border 1px `--rv-border`
- Nav item height: ~48px (py-3 px-4)
- Nav item active: background `--rv-surface-elevated`, `--rv-text-primary`
- Nav item inactive: `--rv-text-muted`, hover `--rv-surface`
- Nav label: Space Grotesk 11px Uppercase tracking-wider (Label role)
- Nav icon: Material Symbols Outlined 24px, same color as label

### Canvas (`Canvas`)
- Background: `--rv-bg` with dot-grid overlay
- Dot-grid: `rgba(255,255,255,0.03)` 1px lines at 40px interval
- Position: flex-1, relative, overflow-auto

### Canvas Toolbar (`CanvasToolbar`)
- Container: `--rv-surface-elevated` background, 1px `--rv-border` with 20% opacity, inline-flex
- Button active: `--rv-surface-high` background
- Button inactive: transparent, hover `--rv-surface-high`
- Button size: 32×32px
- Position: sticky top-left of canvas

### Node Component (`RoadmapNode`)
- Width: 256px (`w-64`)
- Background: `--rv-surface`
- Border: 1px `--rv-border`
- Border left stripe: 4px solid `--rv-status-{status}` (the defining visual element)
- Active/selected: 1px solid `--rv-border-active`, subtle scale 1.02x
- Node title: Space Grotesk 11px Uppercase tracking-widest
- Status pill: 9px text Bold Uppercase, background `--rv-status-{status}`, text `--rv-bg` (or `--rv-text-primary` for light status colors)
- Node ID: 9px Space Grotesk font-mono `--rv-text-muted`
- Border radius: 0px (sharp corners — "The Terminal Architect")
- Padding: 24px horizontal, 16px vertical (`px-6 py-4`)

Note: `themeConfig.statusConfig` overrides `--rv-status-*` on the scoped container element (D-07, D-08). Node shape overrides include border-radius via `themeConfig`.

### Side Panel (`SidePanel`)
- Width: 384px (`w-96`) — fixed for Phase 1 skeleton
- Background: `--rv-surface`
- Left border: 1px `--rv-border`
- Position: right-docked, absolute within main content area
- Panel header: `--rv-surface-elevated` background, Space Grotesk 10px Bold Uppercase tracking-tighter label
- Section dividers: `--rv-border` with 5% opacity (subtle)
- Inputs (Phase 1 skeleton only — not interactive yet): `#0e0e0e` background, 1px `--rv-border`, 0px border-radius
- Scroll: custom scrollbar — 4px width, `--rv-bg` track, `--rv-surface-elevated` thumb

### Status Bar (`StatusBar`)
- Height: 40px (`h-10`)
- Background: `--rv-bg` (deepest level — `#0e0e0e` in dark theme; use `--rv-bg-deepest` token if needed)
- Top border: 1px `--rv-border`
- Position: fixed bottom, full width, z-50
- Text: Space Grotesk 10px Bold Uppercase tracking-tighter
- Status indicator dot: 8px circle, animated pulse, `--rv-status-done` color for "connected"

---

## Interaction Contracts

### Theme Switching
- Trigger: menu item click (native menu bar or in-app menu — deferred to executor; both paths valid per D-04)
- Mechanism: swap `data-theme` attribute on root element
- Transition: instant (no CSS transition on color changes — "Tactile Feedback: instant discrete shifts" per design.md §1)
- System mode: attach `window.matchMedia('(prefers-color-scheme: dark)')` listener; apply `dark` or `light` theme on change
- Persistence: write `{ theme: "dark" | "light" | "high-contrast" | "system" }` to `.roadmap-settings.json` via Bun RPC

### Per-Schema Theme Override
- Trigger: schema loaded with `themeConfig` block
- Scope: applied as inline CSS custom properties on a container element wrapping the schema view, not on `:root`
- Effect: overrides `--rv-status-*` tokens and node shape properties (border-radius) for that file's view
- Override removal: when schema is unloaded, container's inline styles are cleared
- Base theme compatibility: overrides stack on top of active base theme (dark/light/high-contrast) — D-06

### Button States
- Default: as specified per component above
- Hover: background shift to `--rv-surface-elevated` (instant, no transition duration)
- Active/pressed: background shift to `--rv-surface-high`
- Focus visible: 1px `--rv-border-active` outline, 2px offset (keyboard accessibility)
- Disabled: `--rv-text-muted` text, no hover response

### Scrollbar
- Width: 4px (both axes)
- Track: `--rv-bg` (darkest surface)
- Thumb: `--rv-surface-elevated`
- Applied via `::-webkit-scrollbar` — Chromium-only (acceptable for Electrobun/CEF environment)

---

## Token Naming Convention

```
--rv-{category}-{variant}
```

Categories for Phase 1:
- `--rv-bg` — base background (deepest)
- `--rv-surface` — primary panel surface
- `--rv-surface-elevated` — hover/active states
- `--rv-surface-high` — highest elevation
- `--rv-text-primary` — primary text / accent
- `--rv-text-secondary` — body copy
- `--rv-text-muted` — placeholders / metadata
- `--rv-border` — standard separator
- `--rv-border-active` — selection / active ring
- `--rv-status-todo` — status-specific colors
- `--rv-status-in-progress`
- `--rv-status-done`
- `--rv-status-blocked`

Tailwind v4 mapping via `@theme` directive:
```css
@theme {
  --color-rv-bg: var(--rv-bg);
  --color-rv-surface: var(--rv-surface);
  /* ... etc — each --rv-* exposed as --color-rv-* for Tailwind utility generation */
}
```

Source: CONTEXT.md D-01 ("use `@theme` directive to map `--rv-*` CSS custom properties into Tailwind utilities")

---

## Copywriting Contract

| Element | Copy | Notes |
|---------|------|-------|
| Primary CTA — top bar | `LOAD FILE` | Matches phase-1.html `LOAD_FILE` label; space-separated for readability |
| App name | `ROADRAVEN` | Uppercase — matches "Terminal Architect" tone |
| Sidebar section header | System | Match reference heading style: thin font, muted |
| Nav item — viewer | `Viewer` | Uppercase in render |
| Nav item — recent files | `Recent Files` | Uppercase in render |
| Nav item — settings | `Settings` | Uppercase in render |
| Theme menu item — dark | `Dark` | Plain — no decoration |
| Theme menu item — light | `Light` | Plain |
| Theme menu item — high contrast | `High Contrast` | Plain |
| Theme menu item — system | `System` | Plain |
| Status bar — connected | `Live Feed: Connected` | Matches reference |
| Status bar — health | `System: Optimal` | Derived from reference `System Health: Optimal` — shorten for density |
| Side panel header | `Node Inspector` | Matches reference |
| Canvas toolbar — tree layout | `Tree Layout` (tooltip) | Icon-only button; tooltip required |
| Canvas toolbar — fit view | `Fit View` (tooltip) | Icon-only button; tooltip required |
| Empty state heading | Not applicable for Phase 1 | Canvas is static shell — no data in this phase |
| Error state | Not applicable for Phase 1 | No data loading in this phase |
| Destructive confirmation | Not applicable for Phase 1 | No destructive actions in this phase |

---

## Accessibility Contract

- All theme menu items: `role="menuitem"` with keyboard navigation (Up/Down/Enter/Escape)
- Icon-only buttons: `aria-label` required on every instance
- Status color: never the sole indicator — pill text label always accompanies stripe color (PACK-06)
- Focus indicators: 1px `--rv-border-active` outline, 2px offset, visible in all three themes
- `prefers-reduced-motion`: no CSS transitions are used in Phase 1 — compliant by default

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | none | not applicable — shadcn not initialized |
| third-party | none | not applicable |

No third-party component registries used in this phase. All components are hand-authored.

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS

**Approval:** pending
