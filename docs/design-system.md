---
title: Design System
nav_order: 5
layout: default
---

# Design System

## Overview

RoadRaven uses CSS custom properties (`--rv-*` tokens) mapped to Tailwind CSS v4 utilities through the `@theme` directive. Components reference tokens exclusively through Tailwind classes -- zero hardcoded color values are allowed in component code.

Since v0.8.3 the *values* of those tokens come from theme files: one JSON file per theme, twelve required colours, everything else derived. The stylesheet no longer holds a single theme value; it holds the bridge and the global rules.

## Why This Approach

Three options were evaluated for the token system:

| Approach | Rejected because |
|----------|-----------------|
| Tailwind v3 config (`tailwind.config.js`) | Requires maintaining colors in both CSS and JS config. Dual-maintenance problem. |
| CSS-in-JS (styled-components, etc.) | Adds runtime overhead, conflicts with Tailwind utility model, harder to theme. |
| **CSS custom properties + Tailwind v4 `@theme`** | **Chosen.** Native browser performance. Full Tailwind modifier support. A theme switch is one write to `<html>`, not a React re-render. |

CSS custom properties have zero runtime cost -- the browser resolves them natively. Tailwind v4's `@theme` directive registers each token as a utility directly in CSS, so there is no JS config to keep in sync; the token *list* lives in `shared/themeContract.ts` and the token *values* in the theme files.

## The --rv-* Token Convention

All tokens use the `--rv-` prefix (short for "RoadRaven"). This prefix exists for two reasons:

1. **Namespace isolation.** Third-party CSS or future library integrations will not collide with RoadRaven tokens (and avoids clashing with Tailwind internals, which use `--tw-*`).
2. **Grepability.** You can search the entire codebase for `--rv-` to find every token reference.

### Token Categories

Tokens are organized by function. Here is the naming pattern (the authoritative list is `THEME_TOKENS` in [`shared/themeContract.ts`](../shared/themeContract.ts)):

| Category | Pattern | Example | Purpose |
|----------|---------|---------|---------|
| Background | `--rv-bg-*` | `--rv-bg-base`, `--rv-bg-surface`, `--rv-bg-canvas` | Surface colors for app areas |
| Node backgrounds | `--rv-bg-node*` | `--rv-bg-node`, `--rv-bg-node-hover` | Tree node card backgrounds |
| Panel backgrounds | `--rv-bg-panel`, `--rv-bg-toolbar`, `--rv-bg-statusbar`, `--rv-bg-config` | | Specific panel area backgrounds |
| Input backgrounds | `--rv-bg-input`, `--rv-bg-hover`, `--rv-bg-active`, `--rv-bg-elevated` | | Interactive element backgrounds |
| Text | `--rv-text-*` | `--rv-text-primary`, `--rv-text-secondary`, `--rv-text-tertiary` | Text color hierarchy |
| Text on accent | `--rv-text-on-accent` | | Text on accent-colored backgrounds |
| Node text | `--rv-text-node` | | Title, rename input and body on the node card (falls back to `--rv-text-primary`) |
| Border | `--rv-border*` | `--rv-border`, `--rv-border-subtle`, `--rv-border-focus`, `--rv-border-width` | Border colors and widths |
| Accent | `--rv-accent*` | `--rv-accent`, `--rv-accent-hover`, `--rv-accent-muted`, `--rv-accent-border` | Interactive element highlights |
| Status | `--rv-status-<s>` | `--rv-status-completed`, `--rv-status-blocked` | General status ink (chrome, menus, dialogs, pills) |
| Status on the card | `--rv-status-<s>-card`, `--rv-status-<s>-fg`, `--rv-status-<s>-bg` | | Stripe ink, badge text ink, badge fill -- see [Status ink roles](#status-ink-roles) |
| Canvas | `--rv-dot-grid`, `--rv-line-connector` | | Tree visualization elements |
| Rings | `--rv-pulse`, `--rv-search` | | Live-event pulse ring, search-match outline |
| Shadow | `--rv-shadow-*` | `--rv-shadow-node`, `--rv-shadow-panel`, `--rv-shadow-config` | Elevation shadows |
| Scrollbar | `--rv-scrollbar-*` | `--rv-scrollbar-track`, `--rv-scrollbar-thumb` | Custom scrollbar styling |
| Plugin glyphs | `--rv-plugin-*-bg` | `--rv-plugin-claude-code-bg` | Attribution glyph fills (brand colours, the same in every theme) |
| Shape and type | `--rv-radius-*`, `--rv-font-sans`, `--rv-font-heading` | `--rv-radius-md` | Corner radii and font stacks |

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

A theme is data: a JSON file with an `id`, a `meta` block and a `colors` map, plus optional `shape`, `fonts` and `shadows`. Twelve colours are required; every other token has a derivation rule, so a theme that sets only the twelve is complete. The eight built-ins live as JSON under [`packages/desktop/src/mainview/themes/`](../packages/desktop/src/mainview/themes/) and user themes in the user data directory, in the same format.

At runtime the pipeline is:

```
theme file (ThemeFile)
   |
   v
resolveTheme(file)          shared/themeSchema.ts -- explicit tokens + every derived one
   |
   v
applyTheme(resolved, id)    packages/desktop/src/mainview/theme/applyTheme.ts
   |                        sets every --rv-* on <html>, removes the ones the
   |                        previous theme set and this one lacks, sets data-theme
   v
Tailwind utilities repaint through the @theme bridge (no React re-render)
```

`applyTheme` is the only module allowed to write `--rv-*` on the root element or to set `data-theme` (an architecture test pins that). `data-theme` is kept only as a hook: a handful of CSS rules and the a11y tests key on it; it carries no token values any more.

`ThemeProvider` (`packages/desktop/src/mainview/components/ThemeProvider.tsx`) runs the pipeline whenever the resolved theme, the user theme list or the editor draft changes, and repaints only if the resolved token map actually differs from the last paint. `main.tsx` paints the default synchronously before the first render, so there is no flash of unstyled UI.

### Theme state

`useThemeStore` (`packages/desktop/src/mainview/store/themeStore.ts`):

```typescript
interface ThemeState {
  preference: ThemePreference;   // a theme id, or "system"
  resolvedTheme: ResolvedTheme;  // the id actually painted
  userThemes: UserThemeEntry[];  // files in <userData>/themes, valid or not
  draft: ThemeFile | null;       // the theme editor's working copy, painted while set
  setTheme: (pref: ThemePreference) => void;
  // ...
}
```

`ThemePreference` is a `string` (`shared/types.ts`): any registered id or `"system"`. `"system"` resolves to `dark` or `light` from `prefers-color-scheme` and follows OS changes live. An id nobody owns -- a user theme file that was deleted or is invalid -- paints the default (Amber) and shows one toast (`Theme 'x' not found — using Amber`); the saved preference is left untouched so restoring the file brings the theme back.

## The Eight Built-ins

Registered in [`packages/desktop/src/mainview/themes/index.ts`](../packages/desktop/src/mainview/themes/index.ts) (`BUILT_IN_THEMES`, `THEME_IDS`, `DEFAULT_THEME_ID`), in picker order:

| id | name | mode | mood |
|----|------|------|------|
| `dark` | Dark | dark | Near-black surfaces, blue accent |
| `light` | Light | light | White surfaces, deep blue accent |
| `high-contrast` | High Contrast | dark | Pure black, white borders, 2px edges |
| `paper` | Paper | light | Warm off-white, terracotta accent, serif headings |
| `amber` | Amber | dark | Warm black, phosphor amber -- **the default** |
| `contrast` | Contrast | dark | Black chrome, white cards, citron accent, sharp corners |
| `slate` | Slate | dark | Deep slate-blue, cream type, brass accent, serif headings |
| `moss` | Moss | dark | Sage canvas, cream cards, warm-gold accent |

`meta.mode` says whether the chrome is dark or light; it drives the mode-aware derivation rules and the editor's "Suggest fix" direction. Contrast and Moss are *inverted-card* themes (dark chrome, light cards), which is why they set `--rv-text-node` and the `-card` status inks explicitly.

## The Contrast Contract

Every ink-on-surface combination the app paints is a **pair** in `CONTRAST_PAIRS` (`shared/themeContract.ts`): an ink token, a surface token stack (bottom to top; layers above the first may be translucent and are composited), a minimum WCAG 2.x ratio, a tier and a `file:line` of the usage that paints it. A pair is not added without evidence.

Two tiers:

- **required** -- fails the gate. Text on its surface (WCAG 1.4.3, **4.5:1**): body, secondary and tertiary text on every surface they appear on, badge text over its fill over the card, text on accent, accent as text, the general status ink on chrome. Non-text (WCAG 1.4.11, **3:1**): the status stripe vs the card, the outline dots, the keyboard focus ring and search outline vs the canvas, the focused input border, the save-state dots. Plus the tree-connector **visibility floor at 2:1**.
- **advisory** -- reported, never gated: connectors at 3:1, card edge vs card, panel and top-bar edges, card vs canvas, and the selection outline against the card (the 2px ring sits half on the card and half on the canvas; the canvas half is required).

Two gates run on every theme, and **a theme ships with zero required failures** -- the `known-failures.json` baselines that carried the debt through v0.8.3 Phase 0-1 were burnt down and deleted, and a test pins their absence:

1. **Static token linter** -- `lintTheme(resolveTheme(file))` in `shared/contrast.ts`. Pure, no browser, runs as a vitest unit test (`tests/unit/theme/themeLint.test.ts`) in the CI `test` job. The same table is available locally:

   ```bash
   bun run theme:lint                     # every built-in
   bun run theme:lint path/to/theme.json  # one file (a user theme)
   bun run theme:lint --json              # machine-readable findings
   ```

   Exit code 1 on any required failure or an invalid file; advisory rows are printed only.

2. **Rendered sampler** -- `tests/a11y/contrast.spec.ts` (Playwright, CI job `a11y`, against the production bundle under `vite preview`). It switches each theme through the real picker and reads `getComputedStyle` of real elements -- node title, badge text over its fill, status stripes (`::before`), chevron, document chip, status bar, sidebar rows, menu items, the focus ring, outline dots, the context-menu Delete item, the save dot -- and scores them with the same registry. It catches what a token linter cannot: a CSS rule that wins over the token (the v0.8.2 Contrast title, 1.53:1 on white, was exactly that). The axe suite (`audit.spec.ts`) is kept for ARIA and structure.

The in-app editor shows the same pairs, ratios and tiers live, so CI and the editor can never disagree.

## Author a Theme in Five Minutes

1. **Preferences** (cog or `Ctrl+,`) → Theme row → **Duplicate current theme…**. Give it a name; the copy is written to your themes folder and selected. (Or press **Edit…** on any theme: a built-in is duplicated first, then the copy opens in the editor.)
2. **Open themes folder** reveals the file. The folder is `<userData>/themes/`: `%LOCALAPPDATA%\RoadRaven\themes` on Windows, `~/Library/Application Support/RoadRaven/themes` on macOS, `$XDG_CONFIG_HOME/RoadRaven/themes` (default `~/.config/RoadRaven/themes`) on Linux.
3. Edit the JSON in any editor, or use the [in-app editor](#the-editor). Every save is picked up by a directory watcher (250 ms debounce) and repainted live if that theme is active -- no restart.
4. Check it: `bun run theme:lint path/to/theme.json`, or read the badge in the picker (`N required contrast pairs fail`) and the chips in the editor.
5. **Import theme file…** copies someone else's file into the folder; share yours by sending the JSON.

A complete theme is the twelve required colours:

```json
{
  "id": "solarized",
  "meta": { "name": "Solarized", "mode": "dark", "description": "Optional", "author": "Optional" },
  "colors": {
    "bg-base": "#002b36",
    "bg-canvas": "#00252e",
    "bg-node": "#073642",
    "text-primary": "#eee8d5",
    "text-secondary": "#93a1a1",
    "border": "#0e4a5a",
    "border-focus": "#b58900",
    "accent": "#b58900",
    "status-not-started": "#93a1a1",
    "status-in-progress": "#268bd2",
    "status-completed": "#859900",
    "status-blocked": "#dc322f"
  }
}
```

Rules the file must follow (the validator names the offending key):

- `id`: lowercase letters, digits and hyphens, and it must equal the file name (`solarized.json`). It may not shadow a built-in id.
- `colors` keys are token names without the `--rv-` prefix; values are `#rrggbb` or `rgb()`/`rgba()`. Unknown keys are rejected.
- Anything you leave out is derived (table below); anything you set wins.

## The Editor

Preferences → Theme → **Edit…** opens a non-modal dialog anchored to the right; the canvas underneath stays fully interactive and **is the preview** -- every accepted change repaints the real nodes, badges, chips and menus. Built-ins are read-only, so Edit… on one first asks for a name and opens the copy.

- **Fields.** The twelve required colours first (App background, Canvas, Card, Text, Secondary text, Border, Focus border, Accent, Not started, In progress, Completed, Blocked), each a native colour swatch plus a hex field. **Advanced** expands every optional token grouped by role (Surfaces, Text, Borders, Accent, Canvas, Status -- card stripe / badge text / badge fill, Rings, Scrollbar, Plugin glyphs, Shape, Fonts, Shadows). An optional field you have not set shows its derived value greyed with a `derived` tag; **Reset to derived** removes the key from the file again.
- **Chips.** Under each colour: every contrast pair it takes part in, with the measured ratio, the minimum, and a chip -- `pass`, `warn` (an advisory pair below its minimum) or `fail` (a required pair below its minimum). The header sums it up: `N required failures · M advisory`. Where the field is the *surface* of a failing pair the chip says so and points at the ink.
- **Suggest fix.** On a failing pair whose ink is this field: steps the ink 2 % at a time toward white (dark theme) or black (light theme) until the pair passes, hue preserved; falls back to the other direction, and is disabled when neither can reach the minimum. One click applies it.
- **Hide / Peek.** **Hide** collapses the dialog to a floating pill (`Editing <name> — Show`) so you can work with the theme applied; hold the eye button, `Space` on it, or `Alt` inside the dialog to **peek** -- the dialog goes translucent while held.
- **Autosave.** Every accepted change is written to the theme file 500 ms after the last one (`Saved · just now` / `Saving…` / `Could not save: …`). There is no revert: with autosave there is never a saved version to go back to (D-10; undo is backlog). Closing flushes a pending change first and only asks (`Keep editing` / `Discard changes`) if that write failed. `Escape` closes the editor only while focus is inside it; closing reopens Preferences with focus on Edit….
- **Delete.** A user theme is deleted from the theme picker, not the editor: each "Your themes" row has a **×** after its name (`aria-label` `Delete theme <name>`, a `menuitem` of its own so the row's name stays the bare theme name), shown while the row is hovered or holds focus. Arrow keys walk the theme rows only; `Tab` from a row, or `Delete` on it, reaches the ×. It opens a confirm (`Delete theme "<name>"?` -- Delete / Cancel, landing on Cancel); Cancel or `Escape` returns focus to the row. Deleting the active theme switches to the default and persists that; a theme open in the editor closes it. The file is unlinked, not moved to the OS trash.
- What the editor does not do yet: change `meta.name` or `meta.mode` -- edit those in the file.

Source: [`packages/desktop/src/mainview/components/ThemeEditor/`](../packages/desktop/src/mainview/components/ThemeEditor/) (dialog) and [`packages/desktop/src/mainview/lib/themeEditor.ts`](../packages/desktop/src/mainview/lib/themeEditor.ts) (fields, verdicts, draft reducer).

## Theme File Format Reference

The shape is the `ThemeFile` interface and the grammars are the exported patterns in [`shared/themeSchema.ts`](../shared/themeSchema.ts); the zod validator built from them is [`packages/desktop/src/theme/themeFileSchema.ts`](../packages/desktop/src/theme/themeFileSchema.ts) (`ThemeFileSchema`), and both the renderer's registry and the Bun process's user-theme reader run every file through it before a value reaches CSS.

| Key group | Keys | Value grammar |
|-----------|------|---------------|
| `id` | -- | `^[a-z][a-z0-9-]*$` (`THEME_ID_PATTERN`) |
| `meta` | `name` (required), `mode` (`"dark"` \| `"light"`, required), `description`, `author` | strings |
| `colors` | any token in `THEME_COLOR_KEYS` (50 keys; the 12 in `REQUIRED_COLOR_KEYS` are mandatory) | `#rrggbb`, `rgb(r, g, b)` or `rgba(r, g, b, a)` (`COLOR_VALUE_PATTERN`) |
| `shape` | `border-width`, `radius-xs`, `radius-sm`, `radius-md`, `radius-lg`, `radius-xl`, `radius-pill` | `0` or `<n>px` (`PX_VALUE_PATTERN`) |
| `fonts` | `sans`, `heading` | letters, digits, spaces, quotes, commas, hyphens (`FONT_STACK_PATTERN`) |
| `shadows` | `node`, `node-hover`, `panel`, `config` | lengths, colours, `none`, `var(--rv-*)`; `url(` refused (`SHADOW_VALUE_PATTERN` + `isSafeCssValue`) |

Every grammar is closed -- no `;`, `{`, `}` or `url(` can reach the stylesheet from a user-written file.

`themeFileToTokens(file)` flattens the file into `--rv-*` names (`colors.bg-base` → `--rv-bg-base`, `shape.radius-md` → `--rv-radius-md`, `fonts.sans` → `--rv-font-sans`, `shadows.node` → `--rv-shadow-node`). `resolveTheme(file)` then fills every token the file leaves unset from `TOKEN_DERIVATIONS`, in dependency order -- a rule may read tokens filled by the rules above it. **"Derived" means exactly this**: the value is computed from the file's own colours by the rule below; it is what `applyTheme` paints and what the linter measures, so a theme is scored on what the user sees.

| Token | Derived from |
|-------|--------------|
| `--rv-text-tertiary` | `--rv-text-secondary` |
| `--rv-text-on-accent` | black or white, whichever contrasts more with `--rv-accent` |
| `--rv-text-node` | `--rv-text-primary` |
| `--rv-bg-surface` | `--rv-bg-base` mixed 4 % toward `--rv-text-primary` |
| `--rv-bg-input` | 5 % toward text |
| `--rv-bg-elevated` | dark: 9 % toward text; light: `--rv-bg-base` |
| `--rv-bg-hover` | 10 % toward text |
| `--rv-bg-active` | 16 % toward text |
| `--rv-bg-node-hover` | `--rv-bg-node` mixed 3 % toward `--rv-text-node` |
| `--rv-bg-toolbar`, `--rv-bg-panel`, `--rv-bg-config`, `--rv-bg-statusbar` | `--rv-bg-surface` |
| `--rv-border-subtle` | `--rv-border` mixed 50 % toward `--rv-bg-base` |
| `--rv-border-width` | `1px` |
| `--rv-accent-hover` | dark: accent 10 % toward white; light: 15 % toward black |
| `--rv-accent-muted` | accent at alpha 0.12 |
| `--rv-accent-border` | accent at alpha 0.30 |
| `--rv-dot-grid`, `--rv-line-connector` | `--rv-text-primary` at the smallest alpha (0.01 steps from 0.05) that reaches 2:1 over `--rv-bg-canvas` |
| `--rv-shadow-node`, `-node-hover`, `-panel`, `-config` | the Dark or Light built-in's shadow values, by `meta.mode` |
| `--rv-scrollbar-track` | `--rv-bg-input` |
| `--rv-scrollbar-thumb` | `--rv-bg-base` mixed 20 % toward text |
| `--rv-status-<s>-card` | `--rv-status-<s>` |
| `--rv-status-<s>-fg` | `--rv-status-<s>-card`, else `--rv-status-<s>` |
| `--rv-status-<s>-bg` | `--rv-status-<s>` at alpha 0.10 |
| `--rv-pulse` | `--rv-status-completed` |
| `--rv-search` | `--rv-accent` |
| `--rv-plugin-claude-code-bg`, `-github-actions-bg`, `-default-bg` | fixed brand colours (`#d97757`, `#2088ff`, `#64748b`) |
| radii, fonts | no rule -- the components' own fallbacks apply (`var(--node-radius, 8px)`, `inherit`) |

"Mixed n % toward" is a per-channel linear mix (`mix` in `shared/contrast.ts`). The three status rules are the same functions as `DERIVED_TOKENS` in the contract -- the CSS `var(--x, var(--y))` fallbacks the components read -- so the linter and the resolver cannot disagree.

## Status Ink Roles

One status colour used to carry every job -- badge text, stripe, dot, menu item -- and on a theme with white cards on black chrome that is impossible: white text on a dark badge is invisible as a stripe on a white card. Each status therefore has **three ink roles, one per surface family**, plus its fill (`STATUS_TOKENS` in `shared/themeContract.ts`):

| Token | Role | Painted on | Default |
|-------|------|------------|---------|
| `--rv-status-<s>` | **general** ink | chrome: sidebar outline dots, context-menu Delete, save-state dots, status-bar text, dialogs, toasts, pills | required |
| `--rv-status-<s>-card` | **card** ink | the 4 px status stripe on the node card | = general |
| `--rv-status-<s>-fg` | **fill** ink | badge text, badge dot, chevron text and border -- everything on the badge fill | = card, else general |
| `--rv-status-<s>-bg` | badge fill | the badge itself, over the card | general at 10 % alpha |

Six themes set only the general ink and get the rest derived. Contrast and Moss (light cards) set `-card` for a dark stripe on the white card and `-fg` where the badge fill is opaque. `RoadmapNode.tsx` reads the cascade `var(--x-fg, var(--x-card, var(--x)))` for the badge and `var(--x-card, var(--x))` for the stripe, and the registry has a required pair for each role on its surface, so a theme cannot pass with one role fixed and another broken.

## Adding a Built-in

1. Drop `src/mainview/themes/<id>.json` in the format above (the eight shipped files are the reference; `meta.description` is shown nowhere yet but is kept).
2. Register it in [`themes/index.ts`](../packages/desktop/src/mainview/themes/index.ts): import the JSON and add `parse(<id>Json)` to `BUILT_IN_THEMES` at its picker position. `THEME_IDS`, the picker, the linter, the a11y loops and `ThemePreference` all read from that array -- there is nothing else to update.
3. Run both gates: `bun run theme:lint` must report `required fails 0` for the new id, and `bunx vite build && bun run test:a11y` (from `packages/desktop`) must pass with it. Update `tests/unit/theme/themeRegistry.test.ts`, which pins the shipped ids in order.
4. No CSS change: `index.css` has no per-theme block and no colour literal outside the `@theme` bridge (a test asserts both).

## Node Card Styling

Tree node cards (`RoadmapNodeCard`) combine token-driven Tailwind classes with dynamic inline CSS custom properties. The status tokens are set via inline `style` from `STATUS_TOKEN_MAP`, which is built from the contract's `STATUS_TOKENS` so the two cannot drift:

```typescript
// RoadmapNode.tsx
const statusTokens = (s: NodeStatus) => ({
  color: STATUS_TOKENS[s].ink,   // "--rv-status-<s>"
  card: STATUS_TOKENS[s].card,   // "--rv-status-<s>-card"
  fg: STATUS_TOKENS[s].fg,       // "--rv-status-<s>-fg"
  bg: STATUS_TOKENS[s].bg,       // "--rv-status-<s>-bg"
});

export const STATUS_TOKEN_MAP: Record<
  NodeStatus,
  { color: string; bg: string; card: string; fg: string }
> = {
  "not-started": statusTokens("not-started"),
  "in-progress": statusTokens("in-progress"),
  completed: statusTokens("completed"),
  blocked: statusTokens("blocked"),
};

const NODE_INK = `var(${TEXT_NODE_TOKEN}, var(--rv-text-primary))`;
```

The card reads `--node-radius` from the theme (defaulting to `8px`), shows the selection ring with `outline outline-2 -outline-offset-1 outline-[var(--rv-accent)]`, and sets the node shadow via `var(--node-shadow, var(--rv-shadow-node))`. Title, rename input and body text use `NODE_INK`.

Status at a glance (v0.8.4):

- **Ribbon.** Every card carries a 45° band across its top-right corner, filled with the same card status ink as the stripe (`var(--rv-status-<s>-card, var(--rv-status-<s>))`), with no text. It is clipped by its own wrapper (`.node-ribbon-clip`: `overflow: hidden`, `border-radius: inherit`), never by `.node`, because the live pulse ring (`.node::after`, `inset: -3px`) and the search outline paint outside the card. The contrast registry checks it as `ribbon-<s>` (same numbers as `stripe-<s>`).
- **In Progress weight.** `.node[data-status="in-progress"]` scales the card by 1.06 around its centre and sets `--node-shadow` to a ring plus a soft drop shadow in the status ink, with the border in the same ink. It is CSS only, not an inline style. Canvas spaces siblings at `separation.siblings: 1.2` so scaled neighbours never touch.
- **Progress line.** Every card with children adds one line under the badge: `n / m done` over the direct children, whatever the card's own status. A leaf with no children shows `last event Xs ago` only while In Progress and inside the 30s live window (`lib/nodeProgress.ts`). The card reads children from `nodeIndex` under the `statusTick` subscription, because in-place status flips do not touch `treeData`.
- **Type chip.** When `node.type` is set, a chip left of the badge shows the `typeConfig` label, or the raw id when the type is unknown.
- **Card ink for secondary text.** The chip and the progress line use `NODE_INK` at a smaller size and normal weight, not `--rv-text-secondary` (chrome ink, unreadable on the light cards of Contrast and Moss) and not `opacity` (the rendered sampler reads computed colour, so faded ink would pass the gate while failing on screen). Both are sampled against the `node-title` pair.
- **Plugin glyph** sits top-left, right of the stripe, since the ribbon owns the top-right corner.

Tests and the contrast sampler pick these parts by `data-*` hooks exported from `lib/domContract.ts` (`NODE_STATUS_ATTR`, `NODE_RIBBON_ATTR`, `NODE_PROGRESS_ATTR`, `NODE_TYPE_CHIP_ATTR`), not by class names.

Source: [`packages/desktop/src/mainview/components/RoadmapNode.tsx`](../packages/desktop/src/mainview/components/RoadmapNode.tsx)

## Shared Menu, Dialog and Save-Dot Styles

Menu surfaces share one set of class strings in [`components/menuStyles.ts`](../packages/desktop/src/mainview/components/menuStyles.ts) — the canvas context menu, the top-bar File menu and the sidebar recent-row menu all read it, so a menu looks the same wherever it opens. The Discard-changes and Preferences dialogs share [`components/dialogStyles.ts`](../packages/desktop/src/mainview/components/dialogStyles.ts). The 7px save-state dot shown by both the footer `SaveIndicator` and the top-bar `DocumentChip` comes from one colour table in [`lib/saveDot.ts`](../packages/desktop/src/mainview/lib/saveDot.ts) (`saveDotClass(state)`), so the two can never disagree. Add a new menu, dialog or save-state indicator by importing from these modules rather than restating the classes.

## How to Add a New Token

1. **List it** in `THEME_TOKENS` (`shared/themeContract.ts`): `required(...)` only if every theme must set it, otherwise `optional(...)` with a rule in `TOKEN_DERIVATIONS` (`shared/themeSchema.ts`) so existing theme files stay complete. Non-colour knobs use `nonColor(...)` and a key in `SHAPE_KEYS` / `FONT_KEYS` / `SHADOW_KEYS`.

2. **Register it in the `@theme` block** of `index.css` so Tailwind generates a utility:

   ```css
   @theme {
     --color-rv-bg-newarea: var(--rv-bg-newarea);
   }
   ```

3. **Use it in components** via the Tailwind class:

   ```html
   <div class="bg-rv-bg-newarea">
   ```

4. **If it is an ink on a surface, add the pair** to `CONTRAST_PAIRS` with the `file:line` that paints it; the linter and the editor pick it up from there.

5. **Never use the raw hex value** in component code. `tests/unit/ui/components.test.tsx` fails on any hex or `rgb()` literal in a component; `tests/unit/ui/tailwindSetup.test.ts` fails on a colour literal in `index.css` outside the bridge.

## Related Documentation

- [Architecture Overview](./architecture-overview.md) -- process model, how themes fit in
- [Development Guide](./development-guide.md) -- how to add components using tokens
- Source: [`shared/themeContract.ts`](../shared/themeContract.ts) (tokens, pairs), [`shared/themeSchema.ts`](../shared/themeSchema.ts) (file format, derivation), [`packages/desktop/src/mainview/index.css`](../packages/desktop/src/mainview/index.css) (Tailwind bridge)
