---
title: Design System
nav_order: 5
layout: default
---

# Design System

## Overview

RoadRaven uses CSS custom properties (`--rv-*` tokens) mapped to Tailwind CSS v4 utilities through the `@theme` directive. Components reference tokens exclusively through Tailwind classes -- zero hardcoded color values are allowed in component code.

## Why This Approach

Three options were evaluated for the token system:

| Approach | Rejected because |
|----------|-----------------|
| Tailwind v3 config (`tailwind.config.js`) | Requires maintaining colors in both CSS and JS config. Dual-maintenance problem. |
| CSS-in-JS (styled-components, etc.) | Adds runtime overhead, conflicts with Tailwind utility model, harder to theme. |
| **CSS custom properties + Tailwind v4 `@theme`** | **Chosen.** Single source of truth in CSS. Native browser performance. Full Tailwind modifier support. |

CSS custom properties have zero runtime cost -- the browser resolves them natively, and theme switching is a single attribute swap rather than a React re-render. Tailwind v4's `@theme` directive defines tokens directly in CSS, so values live in one place (`index.css`) with no separate JS config file to keep in sync.

## The --rv-* Token Convention

All tokens use the `--rv-` prefix (short for "RoadRaven"). This prefix exists for two reasons:

1. **Namespace isolation.** Third-party CSS or future library integrations will not collide with RoadRaven tokens (and avoids clashing with Tailwind internals, which use `--tw-*`).
2. **Grepability.** You can search the entire codebase for `--rv-` to find every token reference.

### Token Categories

Tokens are organized by function. Here is the naming pattern:

| Category | Pattern | Example | Purpose |
|----------|---------|---------|---------|
| Background | `--rv-bg-*` | `--rv-bg-base`, `--rv-bg-surface`, `--rv-bg-canvas` | Surface colors for app areas |
| Node backgrounds | `--rv-bg-node*` | `--rv-bg-node`, `--rv-bg-node-hover` | Tree node card backgrounds |
| Panel backgrounds | `--rv-bg-panel`, `--rv-bg-toolbar`, `--rv-bg-statusbar` | | Specific panel area backgrounds |
| Input backgrounds | `--rv-bg-input`, `--rv-bg-hover`, `--rv-bg-elevated` | | Interactive element backgrounds |
| Text | `--rv-text-*` | `--rv-text-primary`, `--rv-text-secondary`, `--rv-text-tertiary` | Text color hierarchy |
| Text on accent | `--rv-text-on-accent` | | Text on accent-colored backgrounds |
| Border | `--rv-border*` | `--rv-border`, `--rv-border-focus`, `--rv-border-width` | Border colors and widths |
| Accent | `--rv-accent*` | `--rv-accent`, `--rv-accent-hover`, `--rv-accent-muted` | Interactive element highlights |
| Status | `--rv-status-*` | `--rv-status-completed`, `--rv-status-blocked` | Node status indicator colors |
| Status backgrounds | `--rv-status-*-bg` | `--rv-status-completed-bg`, `--rv-status-blocked-bg` | Status badge background fills |
| Canvas | `--rv-dot-grid`, `--rv-line-connector` | | Tree visualization elements |
| Shadow | `--rv-shadow-*` | `--rv-shadow-node`, `--rv-shadow-panel`, `--rv-shadow-config` | Elevation shadows |
| Scrollbar | `--rv-scrollbar-*` | `--rv-scrollbar-track`, `--rv-scrollbar-thumb` | Custom scrollbar styling |

### How Tokens Map to Tailwind Utilities

In `packages/desktop/src/mainview/index.css`, the `@theme` block bridges CSS custom properties to Tailwind:

```css
@theme {
  --color-rv-bg-base: var(--rv-bg-base);
  --color-rv-bg-surface: var(--rv-bg-surface);
  --color-rv-text-primary: var(--rv-text-primary);
  /* ... */
}
```

The `--color-` prefix is Tailwind v4's convention for registering color utilities. This enables classes like:

```html
<div class="bg-rv-bg-base text-rv-text-primary border-rv-border">
```

Source: [`packages/desktop/src/mainview/index.css`](../packages/desktop/src/mainview/index.css)

## How Themes Work

RoadRaven ships with three built-in themes: **dark** (default), **light**, and **high-contrast**.

The active theme is stored as a `data-theme` attribute on the `<html>` element. CSS selectors define token values per theme, and the browser resolves the correct values automatically via custom-property inheritance -- no JavaScript re-render on theme switch.

```css
/* Dark is the default (applied to :root and [data-theme="dark"]) */
:root,
[data-theme="dark"] {
  --rv-bg-base: #131313;
  --rv-text-primary: #e0e0e0;
  /* ... 40+ tokens */
}

[data-theme="light"] {
  --rv-bg-base: #ffffff;
  --rv-text-primary: #1a1a1a;
}

[data-theme="high-contrast"] {
  --rv-bg-base: #000000;
  --rv-text-primary: #ffffff;
  --rv-border-width: 2px;  /* thicker borders for visibility */
}
```

### Theme State Management

The `useThemeStore` Zustand store manages theme state. The key fields:

```typescript
// From packages/desktop/src/mainview/store/themeStore.ts
interface ThemeState {
  preference: ThemePreference;        // "dark" | "light" | "high-contrast" | "system"
  resolvedTheme: ResolvedTheme;       // The actual theme applied
  setTheme: (pref: ThemePreference) => void;
}
```

When `preference` is `"system"`, the app watches `window.matchMedia("(prefers-color-scheme: dark)")` and updates automatically when the OS setting changes.

Source: [`packages/desktop/src/mainview/store/themeStore.ts`](../packages/desktop/src/mainview/store/themeStore.ts)

### ThemeProvider Component

`ThemeProvider` wraps the app and handles three responsibilities:

1. **Load persisted theme** on mount (via `loadSettings` RPC to Bun process).
2. **Apply `data-theme` attribute** to `<html>` when `resolvedTheme` changes.
3. **Listen for OS preference changes** when in `"system"` mode.

Source: [`packages/desktop/src/mainview/components/ThemeProvider.tsx`](../packages/desktop/src/mainview/components/ThemeProvider.tsx)

## Per-Schema Theme Overrides (ThemeOverrideProvider)

Individual roadmap files can customize status colors and node shapes without affecting the rest of the UI, via the `ThemeOverrideProvider` component.

Schema-level overrides must not leak to global UI elements (toolbar, status bar, etc.), so the override is applied as inline CSS custom properties on a wrapper `<div>`, not on `:root`. CSS inheritance means child elements pick up the overrides, while sibling elements outside the wrapper are unaffected.

The override scope is intentionally narrow:

- **Status colors**: Custom hex colors per status value (e.g., `"completed": "#00ff00"`)
- **Node shape**: Border radius in pixels

### Security: Input Validation

Override values are validated against strict regex patterns before being applied as CSS. This prevents CSS injection:

```typescript
// From packages/desktop/src/mainview/components/ThemeOverrideProvider.tsx
const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;   // Only 6-digit hex
const PX_VALUE_RE = /^\d+px$/;                 // Only Npx values
```

Values that fail validation are silently dropped.

### Usage Example

```tsx
<ThemeOverrideProvider themeConfig={{
  statusColors: { "completed": "#00cc66", "blocked": "#cc0000" },
  nodeShape: { borderRadius: "12px" }
}}>
  <RoadmapTree />
</ThemeOverrideProvider>
```

Source: [`packages/desktop/src/mainview/components/ThemeOverrideProvider.tsx`](../packages/desktop/src/mainview/components/ThemeOverrideProvider.tsx)

## Node Card Styling

Tree node cards (`RoadmapNodeCard`) combine token-driven Tailwind classes with dynamic inline CSS custom properties. The status color and badge background are set via inline `style` using `STATUS_TOKEN_MAP`:

```typescript
const STATUS_TOKEN_MAP = {
  "not-started": { color: "--rv-status-not-started", bg: "--rv-status-not-started-bg" },
  "in-progress": { color: "--rv-status-in-progress", bg: "--rv-status-in-progress-bg" },
  "completed":   { color: "--rv-status-completed",   bg: "--rv-status-completed-bg" },
  "blocked":     { color: "--rv-status-blocked",      bg: "--rv-status-blocked-bg" },
};
```

The card reads `--node-radius` from the theme (defaulting to `8px`), applies a selection ring via `ring-1 ring-[var(--rv-accent)]`, and sets the node shadow via `var(--rv-shadow-node)`.

Source: [`packages/desktop/src/mainview/components/RoadmapNode.tsx`](../packages/desktop/src/mainview/components/RoadmapNode.tsx)

## How to Add a New Token

1. **Define the CSS variable** in each theme block in `index.css`:

   ```css
   :root, [data-theme="dark"]    { --rv-bg-newarea: #1e1e20; }
   [data-theme="light"]          { --rv-bg-newarea: #f5f5f5; }
   [data-theme="high-contrast"]  { --rv-bg-newarea: #0a0a0a; }
   ```

2. **Register it in the `@theme` block** (same file) so Tailwind generates a utility:

   ```css
   @theme {
     --color-rv-bg-newarea: var(--rv-bg-newarea);
   }
   ```

3. **Use it in components** via the Tailwind class:

   ```html
   <div class="bg-rv-bg-newarea">
   ```

4. **Never use the raw hex value** in component code. The CI grep check enforces this.

## How to Add a New Theme

1. **Add a new CSS selector block** in `index.css` with all `--rv-*` tokens defined:

   ```css
   [data-theme="solarized"] {
     --rv-bg-base: #002b36;
     --rv-text-primary: #839496;
     /* ... define ALL tokens */
   }
   ```

2. **Update the `ThemePreference` type** in `shared/types.ts`:

   ```typescript
   export type ThemePreference = "dark" | "light" | "high-contrast" | "solarized" | "system";
   ```

3. **Update `ResolvedTheme`** in `packages/desktop/src/mainview/store/themeStore.ts`:

   ```typescript
   export type ResolvedTheme = "dark" | "light" | "high-contrast" | "solarized";
   ```

4. **Add a menu item** for the new theme in the theme selection UI.

5. **Add tests** to verify all tokens resolve correctly for the new theme.

## Related Documentation

- [Architecture Overview](./architecture-overview.md) -- process model, how themes fit in
- [Development Guide](./development-guide.md) -- how to add components using tokens
- Source: [`packages/desktop/src/mainview/index.css`](../packages/desktop/src/mainview/index.css) -- full token definitions
