# Design System

> Last updated: 2026-04-14 | Phase: 01-visual-foundation-themes

## Overview

RoadRaven uses CSS custom properties (`--rv-*` tokens) mapped to Tailwind CSS v4 utilities through the `@theme` directive. Components reference tokens exclusively through Tailwind classes -- zero hardcoded color values are allowed in component code.

## Why This Approach

> **Why CSS custom properties instead of CSS-in-JS:** CSS custom properties have zero runtime cost -- the browser's style engine resolves them natively. CSS-in-JS libraries (styled-components, Emotion) add JavaScript overhead on every render, conflict with Tailwind's utility model, and make theme switching require React re-renders. With CSS custom properties, theme switching is a single attribute swap and the browser does the rest. *(Decision D-01.)*

> **Why Tailwind v4 `@theme` instead of v3 config:** Tailwind v4's `@theme` directive defines tokens directly in CSS, eliminating the dual-maintenance problem of keeping colors in both a CSS file and a `tailwind.config.js` file. There is no JS config file at all -- tokens are real CSS properties, PostCSS dependency is eliminated, and the Vite plugin replaces the PostCSS integration entirely. *(Decision D-01; see 01-RESEARCH.md -- Pattern 1.)*

Three options were evaluated for the token system:

| Approach | Rejected because |
|----------|-----------------|
| Tailwind v3 config (`tailwind.config.js`) | Requires maintaining colors in both CSS and JS config. Dual-maintenance problem. |
| CSS-in-JS (styled-components, etc.) | Adds runtime overhead, conflicts with Tailwind utility model, harder to theme. |
| **CSS custom properties + Tailwind v4 `@theme`** | **Chosen.** Single source of truth in CSS. Native browser performance. Full Tailwind modifier support. |

Tailwind v4 introduced the `@theme` directive, which lets you define design tokens directly in CSS. This means the token values live in one place (`index.css`), and Tailwind generates utility classes from them automatically.

## The --rv-* Token Convention

> **Why the `--rv-*` prefix:** Namespace isolation prevents collisions with Tailwind internals (which use `--tw-*`) and any third-party CSS libraries. The prefix also makes tokens grep-friendly -- searching for `--rv-` finds every token definition and reference across the entire codebase. Without a prefix, generic names like `--bg-base` could clash with library internals or future dependencies. *(Decision D-03.)*

All tokens use the `--rv-` prefix (short for "RoadRaven"). This prefix exists for two reasons:

1. **Namespace isolation.** Third-party CSS or future library integrations will not collide with RoadRaven tokens.
2. **Grepability.** You can search the entire codebase for `--rv-` to find every token reference.

### Token Categories

Tokens are organized by function. Here is the naming pattern:

| Category | Pattern | Example | Purpose |
|----------|---------|---------|---------|
| Background | `--rv-bg-*` | `--rv-bg-base`, `--rv-bg-surface` | Surface colors for app areas |
| Text | `--rv-text-*` | `--rv-text-primary`, `--rv-text-secondary` | Text color hierarchy |
| Border | `--rv-border*` | `--rv-border`, `--rv-border-focus` | Border and outline colors |
| Accent | `--rv-accent*` | `--rv-accent`, `--rv-accent-hover` | Interactive element highlights |
| Status | `--rv-status-*` | `--rv-status-completed`, `--rv-status-blocked` | Node status indicators |
| Canvas | `--rv-dot-grid`, `--rv-line-connector` | | Tree visualization elements |
| Shadow | `--rv-shadow-*` | `--rv-shadow-node`, `--rv-shadow-panel` | Elevation shadows |
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

### Three Built-in Themes

RoadRaven ships with three themes: **dark** (default), **light**, and **high-contrast**.

### The Mechanism

> **Why `data-theme` attribute on `<html>`:** CSS-only theming means no JavaScript re-render on theme switch. The attribute is inherited by all children through CSS custom property inheritance, so every component picks up new token values instantly. Alternatives like React Context would require re-rendering the entire tree on theme change. *(Decision D-02.)*

1. The active theme is stored as a `data-theme` attribute on the `<html>` element.
2. CSS selectors define token values per theme.
3. The browser resolves the correct values automatically.

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
  /* ... */
}

[data-theme="high-contrast"] {
  --rv-bg-base: #000000;
  --rv-text-primary: #ffffff;
  --rv-border-width: 2px;  /* thicker borders for visibility */
  /* ... */
}
```

### Theme State Management

The `useThemeStore` Zustand store manages theme state:

```typescript
// From packages/desktop/src/mainview/store/themeStore.ts
interface ThemeState {
  preference: ThemePreference;        // "dark" | "light" | "high-contrast" | "system"
  systemResolution: "dark" | "light"; // What the OS prefers
  resolvedTheme: ResolvedTheme;       // The actual theme applied
  setTheme: (pref: ThemePreference) => void;
  updateSystemResolution: (resolved: "dark" | "light") => void;
}
```

When `preference` is `"system"`, the app watches `window.matchMedia("(prefers-color-scheme: dark)")` and updates automatically when the OS setting changes.

Source: [`packages/desktop/src/mainview/store/themeStore.ts`](../packages/desktop/src/mainview/store/themeStore.ts)

### ThemeProvider Component

`ThemeProvider` wraps the entire app and handles three responsibilities:

1. **Load persisted theme** on mount (via `loadSettings` RPC to Bun process).
2. **Apply `data-theme` attribute** to `<html>` when `resolvedTheme` changes.
3. **Listen for OS preference changes** when in `"system"` mode.

Source: [`packages/desktop/src/mainview/components/ThemeProvider.tsx`](../packages/desktop/src/mainview/components/ThemeProvider.tsx)

## Per-Schema Theme Overrides (ThemeOverrideProvider)

Individual roadmap files can customize status colors and node shapes without affecting the rest of the UI. This is the `ThemeOverrideProvider` component.

### Why a Scoped Provider

> **Why scoped `ThemeOverrideProvider` instead of global overrides:** Applying overrides on `:root` would leak custom status colors into the toolbar, status bar, and any other global UI elements. With a scoped wrapper `<div>`, multiple schemas could theoretically have different overrides simultaneously (e.g., in a future tabbed view), and the overrides compose naturally with whichever base theme is active. The scoped approach also prevents cross-schema leakage if the app later supports multi-file workspaces. *(Decision D-08; extensibility noted in D-07.)*

Schema-level overrides must not leak to global UI elements (toolbar, status bar, etc.). The override is applied as inline CSS custom properties on a wrapper `<div>`, not on `:root`. CSS inheritance means child elements pick up the overrides, but sibling elements outside the wrapper are unaffected.

### What Can Be Overridden

In Phase 1, the override scope is intentionally narrow:

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
