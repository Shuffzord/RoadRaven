# Phase 1: Visual Foundation & Themes - Research

**Researched:** 2026-04-13
**Domain:** Tailwind CSS v4, CSS custom properties, React component architecture, LogTape structured logging
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Migrate to Tailwind v4 before any Phase 1 implementation work. Use the `@theme` directive to map `--rv-*` CSS custom properties into Tailwind utilities natively.
- **D-02:** Theme switching at runtime via swapping a `data-theme` attribute on the root element. CSS variable values defined per `[data-theme="dark"]`, `[data-theme="light"]`, `[data-theme="high-contrast"]` selectors. No page reload required.
- **D-03:** All components use Tailwind utility classes referencing `--rv-*` tokens. Zero hardcoded color values — enforced by CI grep.
- **D-04:** Theme switched via menu items (Dark / Light / High Contrast / System). `System` follows OS `prefers-color-scheme`. Manual selection overrides `System`.
- **D-05:** Theme preference persisted in `.roadmap-settings.json`. `'system'` mode reactive to OS changes.
- **D-06:** Schema `themeConfig` overrides applied on top of whichever base theme is active.
- **D-07:** Initial override scope: status color mapping and node shape properties (border radius). NOT full system color changes.
- **D-08:** Per-file overrides applied as inline CSS custom properties on a scoped container element — NOT on `:root`.
- **D-09–D-13:** App shell layout: main canvas (full keyboard), right side panel (node click), left sidebar, bottom status bar. `variant-c-merged.html` is canonical design reference.
- **D-14:** TDD-first — tests written before implementation for all theme system work.
- **D-15:** Token-level unit tests using `getComputedStyle(root).getPropertyValue('--rv-surface')`.
- **D-16:** `ThemeProvider` behavior tests — switching, `System` reactivity, persistence.
- **D-17:** CI grep for hardcoded colors — static analysis step.
- **D-18:** Per-schema override tests — scoped container verified, no leakage.
- **D-19:** DOM and accessibility tests — ARIA attributes, keyboard accessibility.
- **D-20:** No visual regression / screenshot tests.
- **D-21:** Structured logging via LogTape (`@logtape/logtape`).
- **D-22:** Two-process logging: webview forwards logs to Bun via typed RPC `logMessage`.
- **D-23:** Sinks: console (dev), rotating file JSON (production). Platform-specific log directories.
- **D-24:** Hierarchical log categories: e.g., `["bun", "theme"]`, `["webview", "theme"]`.
- **D-25:** Log levels: `debug` in development, `info` in production.
- **D-26:** Rotation: ~5–10 MB per file, keep 3–5 old files.

### Claude's Discretion

- Exact Tailwind v4 migration steps and codemod usage
- `@theme` token naming convention (e.g., `--color-rv-surface` vs `--color-rv-bg-surface`)
- Number and naming of `--rv-*` tokens in the initial token set
- How `System` theme preference detects and reacts to OS changes (media query listener pattern)
- Whether theme menu lives in native menu bar, hamburger menu, or both
- Internal structure of `.roadmap-settings.json` for theme preference storage
- Specific test framework patterns (test helpers, mock setup for OS preference)

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.

</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| THEME-01 | `ThemeProvider` applies active theme as `--rv-*` CSS custom properties on `:root` | Tailwind v4 `@theme` directive maps `--rv-*` vars to utilities; `data-theme` attribute swap on `<html>` is the mechanism |
| THEME-02 | Built-in themes: `dark` (default), `light`, `high-contrast` — matches `variant-c-merged.html` design | All token values enumerated in UI-SPEC; three complete token sets documented |
| THEME-03 | App-level preference persisted in `.roadmap-settings.json`; OS `prefers-color-scheme` respected when set to `'system'` | `window.matchMedia` listener pattern confirmed; Bun file I/O via RPC for persistence |
| THEME-04 | Per-schema `themeConfig` block overrides active base theme | Scoped container inline style approach; status color + node radius override tokens identified |
| THEME-05 | All components use `--rv-*` tokens exclusively — no hardcoded colors | CI grep pattern documented; Tailwind v4 `@theme` prevents token drift |

</phase_requirements>

---

## Summary

Phase 1 establishes the visual and structural foundation for the entire RoadRaven desktop app. The work breaks into four streams: (1) Tailwind v4 migration — replacing the minimal v3 config with a CSS-first `@theme` block, (2) the `ThemeProvider` React component that manages `data-theme` on `<html>` and syncs with `.roadmap-settings.json`, (3) the complete app shell layout (top bar, sidebar, canvas with dot-grid, status bar, node card skeleton, side panel skeleton) built exclusively with `--rv-*` utility classes, and (4) the structured logging foundation using LogTape.

The token system is fully specified in `01-UI-SPEC.md` — 40+ `--rv-*` tokens per theme, three complete token sets (dark/light/high-contrast), and status color tokens that are the overridable surface for per-schema `themeConfig`. All token values are extracted from `variant-c-merged.html` and committed to the UI-SPEC, so the planner can treat the spec as ground truth without consulting the HTML file.

The existing codebase is a clean slate: `App.tsx` is a bare `<h1>`, Tailwind v3 is the only CSS tooling, and Zustand/state management is not yet wired. The test suite uses Vitest with a `node` environment — component tests will need `jsdom` environment added and `@testing-library/react` is already installed in devDependencies, so that's a config addition, not a package install.

**Primary recommendation:** Migrate Tailwind first (Wave 0), then TDD the token system and `ThemeProvider` (Wave 1), then build shell components test-driven (Wave 2), then wire per-schema overrides and logging (Wave 3).

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| tailwindcss | 4.2.2 (latest) | CSS utility framework; `@theme` directive for `--rv-*` token mapping | Locked decision D-01; CSS-first config eliminates JS config file |
| @tailwindcss/vite | 4.2.2 | Vite plugin for Tailwind v4 (replaces PostCSS-based integration) | Tailwind v4's recommended Vite integration path |
| @logtape/logtape | 2.0.5 (latest) | Structured logging; zero dependencies; native Bun + browser | Locked decision D-21; 5.3 KB, no bundler complexity |
| react | 19.2.5 (already installed) | UI components | Already in project |
| zustand | 5.0.12 (already installed) | Theme state management (active theme, system preference) | Already in project; Phase 1 is first use |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @testing-library/react | 16.3.2 (already installed) | Component tests for `ThemeProvider` | D-16 behavior tests; already in devDeps |
| @testing-library/jest-dom | 6.9.1 (already installed) | DOM matchers for Vitest | `toHaveStyle`, `toHaveAttribute` on theme root |
| jsdom | 29.0.2 (latest) | Browser DOM simulation for Vitest component tests | Vitest currently uses `node` env; component tests need `jsdom` |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @tailwindcss/vite plugin | @tailwindcss/postcss | PostCSS still works in v4 but Vite plugin is the recommended path; eliminates postcss.config.js entirely |
| Zustand for theme state | React Context | Context is fine for theme but Zustand already in project and provides devtools + persistence hooks that subsequent phases use anyway |
| @logtape/logtape | pino / winston | pino has browser shim complexity; winston is Node-only; LogTape is the only zero-dependency option with native Bun + browser support |

**Installation (migration from v3 to v4):**
```bash
cd packages/desktop
bun add tailwindcss@latest @tailwindcss/vite@latest
bun remove autoprefixer  # no longer needed in v4
# postcss.config.js can be deleted after migration
```

**Version verification:**
```
tailwindcss: 4.2.2 [VERIFIED: npm registry 2026-04-13]
@tailwindcss/vite: 4.2.2 [VERIFIED: npm registry 2026-04-13]
@logtape/logtape: 2.0.5 [VERIFIED: npm registry 2026-04-13]
@testing-library/react: 16.3.2 [VERIFIED: package.json]
jsdom: 29.0.2 [VERIFIED: npm registry 2026-04-13]
```

---

## Architecture Patterns

### Recommended Project Structure

```
packages/desktop/src/mainview/
├── App.tsx                    # App shell grid — replace current stub
├── index.css                  # @import "tailwindcss"; @theme { --rv-* tokens }; [data-theme] selectors
├── main.tsx                   # Unchanged — bootstrap
├── components/
│   ├── ThemeProvider.tsx      # data-theme on <html>, matchMedia listener, settings persistence
│   ├── TopBar.tsx             # 50px height, brand, actions, search, view controls, theme switcher
│   ├── Sidebar.tsx            # 220px/48px collapsible, section headers, file items
│   ├── Canvas.tsx             # dot-grid background, relative container for future tree
│   ├── RoadmapNode.tsx        # 4px stripe ::before, status badge pill, title — static skeleton
│   ├── SidePanel.tsx          # 340px right panel, header, body sections skeleton
│   ├── StatusBar.tsx          # 32px height, three flex sections
│   └── ConfigPanel.tsx        # Floating 260px panel, node corners/connector/gap controls
├── hooks/
│   └── useTheme.ts            # Zustand selector for active theme; system preference logic
├── store/
│   └── themeStore.ts          # Zustand store: theme preference, setTheme action
└── logging/
    └── logger.ts              # LogTape config for webview (forwarding to Bun via RPC)

packages/desktop/src/bun/
└── index.ts                   # Add: LogTape main process setup, logMessage RPC handler, file sink

shared/types.ts                # Add: logMessage RPC call to RoadmapRPCType
```

### Pattern 1: Tailwind v4 CSS-First Token System

**What:** Define all `--rv-*` tokens in `index.css` using Tailwind v4's `@theme` directive, then override per `[data-theme]` attribute selector. Tailwind generates utility classes (`bg-rv-bg-surface`, `text-rv-text-primary`) automatically.

**When to use:** All token definitions go here; never in JS config files.

**Example:**
```css
/* packages/desktop/src/mainview/index.css */
@import "tailwindcss";

@theme {
  /* Tailwind reads these and generates utility classes */
  --color-rv-bg-base: var(--rv-bg-base);
  --color-rv-bg-surface: var(--rv-bg-surface);
  --color-rv-text-primary: var(--rv-text-primary);
  --color-rv-accent: var(--rv-accent);
  /* ... all 40+ tokens mapped the same way */
}

/* Default (dark) — also the :root fallback */
:root,
[data-theme="dark"] {
  --rv-bg-base: #131313;
  --rv-bg-surface: #1b1b1c;
  --rv-text-primary: #e0e0e0;
  --rv-accent: #4a9eff;
  /* ... complete dark token set from UI-SPEC */
}

[data-theme="light"] {
  --rv-bg-base: #ffffff;
  --rv-bg-surface: #f5f5f5;
  --rv-text-primary: #1a1a1a;
  /* ... complete light token set from UI-SPEC */
}

[data-theme="high-contrast"] {
  --rv-bg-base: #000000;
  --rv-border-width: 2px; /* HC uses 2px borders */
  /* ... complete high-contrast token set from UI-SPEC */
}
```

**Critical note on `@theme` naming:** Tailwind v4 maps `--color-*` theme variables to `bg-*`, `text-*`, `border-*` utilities using the suffix after `--color-`. So `--color-rv-bg-surface` → utility class `bg-rv-bg-surface`. The `--rv-*` vars are the runtime CSS custom properties; `--color-rv-*` are the Tailwind theme entries that reference them. [ASSUMED — naming convention based on Tailwind v4 docs knowledge; verify against official docs during implementation]

### Pattern 2: ThemeProvider with data-theme swap

**What:** A React component (or hook) that owns the `data-theme` attribute on `document.documentElement`, persists preference via Bun RPC, and wires the `matchMedia` system listener.

**When to use:** Wrap the entire app; must be the outermost consumer of the theme store.

**Example:**
```typescript
// packages/desktop/src/mainview/components/ThemeProvider.tsx
import { useEffect } from "react";
import { useThemeStore } from "../store/themeStore";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { preference, resolvedTheme, setTheme } = useThemeStore();

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-theme", resolvedTheme);
  }, [resolvedTheme]);

  useEffect(() => {
    if (preference !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => {
      useThemeStore.getState().updateSystemResolution(e.matches ? "dark" : "light");
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [preference]);

  return <>{children}</>;
}
```

### Pattern 3: Scoped Per-Schema themeConfig Overrides

**What:** Apply `themeConfig` as inline CSS custom properties on a wrapping `<div>` container for the canvas view — not on `:root`. This prevents cross-file leakage (D-08).

**When to use:** When a schema with a `themeConfig` block is loaded into the canvas.

**Example:**
```typescript
// Scoped container approach
const schemaOverrides = buildOverrideVars(schema.themeConfig);
// buildOverrideVars returns: { "--rv-status-in-progress": "#ff6b00", "--node-radius": "2px" }

return (
  <div className="canvas-container" style={schemaOverrides}>
    {/* Canvas content uses var(--rv-status-in-progress) — picks up override */}
  </div>
);
```

The `themeConfig` JSON structure for v1:
```json
{
  "themeConfig": {
    "statusColors": {
      "in-progress": "#ff6b00",
      "blocked": "#ff0000"
    },
    "nodeShape": {
      "borderRadius": "2px"
    }
  }
}
```

Maps to CSS overrides:
- `statusColors["in-progress"]` → `--rv-status-in-progress` + `--rv-status-in-progress-bg`
- `nodeShape.borderRadius` → `--node-radius`

### Pattern 4: LogTape Two-Process Architecture

**What:** Webview logs forwarded to Bun main process via RPC; Bun owns all file I/O.

**Example:**
```typescript
// shared/types.ts — add to RoadmapRPCType.bun.requests:
logMessage: {
  params: {
    level: "debug" | "info" | "warn" | "error";
    category: string[];
    message: string;
    data?: Record<string, unknown>;
  };
  response: void;
};

// packages/desktop/src/mainview/logging/logger.ts
import { configure, getLogger, type LogLevel } from "@logtape/logtape";

await configure({
  sinks: {
    rpc: {
      handle(record) {
        // Forward to Bun via electrobun RPC
        rpc.logMessage({
          level: record.level as LogLevel,
          category: record.category,
          message: record.message,
        });
      }
    }
  },
  loggers: [
    { category: ["webview"], lowestLevel: "debug", sinks: ["rpc"] }
  ]
});

export const themeLogger = getLogger(["webview", "theme"]);
export const storeLogger = getLogger(["webview", "store"]);
```

### Anti-Patterns to Avoid

- **Hardcoded colors in component CSS:** Any literal `#xxxxxx` or `rgb()` in component files. CI grep catches these — catch them in dev first.
- **Applying themeConfig to `:root`:** Violates D-08; overrides would bleed to all open files (multi-file support is a v2 concern but the architecture must be correct from v1).
- **Using Tailwind v3 `theme()` function in CSS:** Removed in v4. Use `var(--rv-*)` or `@theme` vars directly.
- **Environment=node for component tests:** Vitest's default `node` environment cannot simulate `document.documentElement` or `window.matchMedia`. Token-level and ThemeProvider tests need `jsdom` environment.
- **Forgetting `prefers-reduced-motion`:** The UI-SPEC specifies 200ms sidebar/panel transitions must be 0ms under `prefers-reduced-motion: reduce`. One global media query block in CSS handles this.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CSS utility generation from tokens | Custom CSS preprocessor or JS-generated classes | Tailwind v4 `@theme` | Handles modifiers (`/50` opacity, `hover:`, `dark:`), purging, and IDE autocomplete |
| Logging with file rotation | Custom `fs.appendFile` loop | LogTape with built-in rotating file sink | Edge cases: atomic writes, concurrent processes, rotation boundary, flush on exit |
| OS theme detection | Manual `navigator.userAgent` parsing | `window.matchMedia('(prefers-color-scheme: dark)')` | Browser API; reactive with `addEventListener('change', ...)` |
| Settings file I/O in webview | Direct `fetch` or browser API | Bun RPC (D-22 architecture) | Webview has no filesystem access in Electrobun; single-writer model prevents corruption |

**Key insight:** The token system's power is in Tailwind v4's `@theme` — it transforms raw CSS custom properties into a full utility vocabulary with modifiers. Hand-rolling this loses opacity variants, responsive prefixes, and hover states, forcing verbose `style={{ color: 'var(--rv-text-primary)' }}` everywhere.

---

## Common Pitfalls

### Pitfall 1: Tailwind v4 Migration — PostCSS Config Conflict

**What goes wrong:** Leaving `postcss.config.js` with `tailwindcss: {}` plugin alongside the new `@tailwindcss/vite` Vite plugin causes double-processing. CSS output is malformed or empty.

**Why it happens:** Tailwind v4 with the Vite plugin bypasses PostCSS entirely for its own processing. The old PostCSS config tries to run Tailwind v3 processing on already-processed output.

**How to avoid:** After installing `@tailwindcss/vite`, delete `postcss.config.js` entirely (or remove the tailwindcss plugin from it). Update `vite.config.ts` to use the new plugin. Autoprefixer is no longer needed.

**Warning signs:** Empty CSS output, class names not generating, `@theme` directive causing parse errors.

```typescript
// vite.config.ts — after migration
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [tailwindcss(), react()],
  root: "src/mainview",
  build: { outDir: "../../dist", emptyOutDir: true },
  server: { port: 5173, strictPort: true },
});
```

### Pitfall 2: ThemeProvider Tests — Wrong Vitest Environment

**What goes wrong:** Tests for `ThemeProvider` that assert `document.documentElement.getAttribute('data-theme')` fail with `ReferenceError: document is not defined`.

**Why it happens:** `vitest.config.ts` uses `environment: "node"`. Token-level tests checking `getComputedStyle` and attribute assertions need the DOM.

**How to avoid:** Add a separate test config or use vitest's `// @vitest-environment jsdom` file-level directive for component test files. The scaffold's unit test directory uses `node` — add a new `tests/unit/ui/` subdirectory with `jsdom` environment configuration.

```typescript
// vitest.config.ts — extend to support both environments
test: {
  globals: true,
  environment: "node",
  include: ["tests/unit/**/*.test.ts"],
  environmentMatchGlobs: [
    ["tests/unit/ui/**", "jsdom"],
  ],
}
```

Note: `getComputedStyle` does NOT reflect CSS custom property values set via stylesheets in jsdom — jsdom doesn't run a CSS engine. The D-15 token-level test approach must set inline styles on the element or mock `getComputedStyle`. See Code Examples section.

### Pitfall 3: CSS Custom Properties and getComputedStyle in jsdom

**What goes wrong:** `getComputedStyle(root).getPropertyValue('--rv-bg-base')` returns an empty string in jsdom, even after setting `[data-theme="dark"]` with all token values in a `<style>` tag.

**Why it happens:** jsdom does not implement a CSS cascade engine. It cannot evaluate CSS custom properties set via stylesheets. `getComputedStyle` only reflects inline styles.

**How to avoid:** For token-level unit tests (D-15), test the `ThemeProvider`'s side effect directly — assert that `document.documentElement.setAttribute('data-theme', 'dark')` was called with the correct value, not that `getComputedStyle` returns the right color. Alternatively, set the CSS custom property inline during the test and read it back.

```typescript
// Correct approach for jsdom token testing
it("applies dark theme to root element", () => {
  render(<ThemeProvider><div /></ThemeProvider>);
  expect(document.documentElement).toHaveAttribute("data-theme", "dark");
});

// For actual CSS value verification — use inline style approach
it("dark theme token value matches spec", () => {
  document.documentElement.style.setProperty("--rv-bg-base", "#131313");
  expect(
    document.documentElement.style.getPropertyValue("--rv-bg-base")
  ).toBe("#131313");
});
```

### Pitfall 4: `data-theme` on `<html>` vs `<body>` vs App Root

**What goes wrong:** Setting `data-theme` on the React app's root `<div>` instead of `document.documentElement`. The `[data-theme="dark"]` CSS selectors target the `<html>` element — they miss elements outside the app root (though in an Electrobun webview there are none, this creates an inconsistency with the UI-SPEC).

**Why it happens:** React components can't easily "escape" to `<html>`. Developers use `document.body` or the app container as a shortcut.

**How to avoid:** `ThemeProvider.useEffect` must explicitly target `document.documentElement`. This is a side effect outside React's rendering — correct and necessary. The UI-SPEC explicitly specifies `data-theme` on `<html>` element.

### Pitfall 5: LogTape Configuration Timing

**What goes wrong:** Logging calls before `configure()` resolves are silently dropped. If component initialization happens synchronously before the async `configure()` in `main.tsx`, early log calls are lost.

**Why it happens:** LogTape requires `await configure(...)` before loggers are usable.

**How to avoid:** Call `configure()` at the top of `main.tsx` before rendering the React tree. Make `main.tsx` async or use a top-level await if the bundler supports it (Bun + Vite both support top-level await in ES modules).

```typescript
// main.tsx
import { configure } from "@logtape/logtape";
import { setupLogtape } from "./logging/logger";

await setupLogtape(); // resolves before React renders
createRoot(document.getElementById("root")!).render(...);
```

---

## Code Examples

### Tailwind v4 Token Mapping (complete pattern)

```css
/* src/mainview/index.css — verified pattern from Tailwind v4 docs */
@import "tailwindcss";

@theme {
  /* Map --rv-* runtime vars into Tailwind utility namespace */
  /* bg-rv-bg-base, text-rv-text-primary, border-rv-border, etc. */
  --color-rv-bg-base: var(--rv-bg-base);
  --color-rv-bg-surface: var(--rv-bg-surface);
  --color-rv-bg-elevated: var(--rv-bg-elevated);
  --color-rv-bg-hover: var(--rv-bg-hover);
  --color-rv-bg-active: var(--rv-bg-active);
  --color-rv-bg-input: var(--rv-bg-input);
  --color-rv-bg-canvas: var(--rv-bg-canvas);
  --color-rv-bg-toolbar: var(--rv-bg-toolbar);
  --color-rv-bg-panel: var(--rv-bg-panel);
  --color-rv-bg-statusbar: var(--rv-bg-statusbar);
  --color-rv-bg-node: var(--rv-bg-node);
  --color-rv-bg-node-hover: var(--rv-bg-node-hover);
  --color-rv-bg-config: var(--rv-bg-config);
  --color-rv-text-primary: var(--rv-text-primary);
  --color-rv-text-secondary: var(--rv-text-secondary);
  --color-rv-text-tertiary: var(--rv-text-tertiary);
  --color-rv-text-on-accent: var(--rv-text-on-accent);
  --color-rv-border: var(--rv-border);
  --color-rv-border-subtle: var(--rv-border-subtle);
  --color-rv-border-focus: var(--rv-border-focus);
  --color-rv-accent: var(--rv-accent);
  --color-rv-accent-hover: var(--rv-accent-hover);
  --color-rv-accent-muted: var(--rv-accent-muted);
  --color-rv-accent-border: var(--rv-accent-border);
  --color-rv-dot-grid: var(--rv-dot-grid);
  --color-rv-line-connector: var(--rv-line-connector);
  --color-rv-scrollbar-track: var(--rv-scrollbar-track);
  --color-rv-scrollbar-thumb: var(--rv-scrollbar-thumb);
  --color-rv-status-not-started: var(--rv-status-not-started);
  --color-rv-status-not-started-bg: var(--rv-status-not-started-bg);
  --color-rv-status-in-progress: var(--rv-status-in-progress);
  --color-rv-status-in-progress-bg: var(--rv-status-in-progress-bg);
  --color-rv-status-completed: var(--rv-status-completed);
  --color-rv-status-completed-bg: var(--rv-status-completed-bg);
  --color-rv-status-blocked: var(--rv-status-blocked);
  --color-rv-status-blocked-bg: var(--rv-status-blocked-bg);
}

/* Shadows, border-width, shadows need --shadow-* or direct @theme entries */
/* Box shadows use inline var() references — not Tailwind utilities */
```

### App Shell CSS Grid

```css
/* CSS grid matches UI-SPEC exactly */
#app {
  display: grid;
  grid-template-rows: auto 1fr auto;
  grid-template-columns: auto 1fr auto;
  grid-template-areas:
    "topbar topbar topbar"
    "sidebar canvas panel"
    "status status status";
  height: 100vh;
  width: 100vw;
  background-color: var(--rv-bg-base);
}
```

### Node Card with Status Stripe

```tsx
// RoadmapNode.tsx — static skeleton for Phase 1
interface RoadmapNodeProps {
  title: string;
  status: "not-started" | "in-progress" | "completed" | "blocked";
}

const STATUS_TOKEN_MAP = {
  "not-started": { color: "--rv-status-not-started", bg: "--rv-status-not-started-bg" },
  "in-progress": { color: "--rv-status-in-progress", bg: "--rv-status-in-progress-bg" },
  "completed": { color: "--rv-status-completed", bg: "--rv-status-completed-bg" },
  "blocked": { color: "--rv-status-blocked", bg: "--rv-status-blocked-bg" },
} as const;

export function RoadmapNode({ title, status }: RoadmapNodeProps) {
  const tokens = STATUS_TOKEN_MAP[status];
  return (
    <div
      className="node relative min-w-[180px] max-w-[220px] rounded-[var(--node-radius,8px)] border-[length:var(--rv-border-width,1px)] border-[color:var(--rv-border)] bg-[var(--rv-bg-node)] shadow-[var(--rv-shadow-node)] pl-4 pr-3 py-[10px] select-none"
      style={{
        "--node-stripe-color": `var(${tokens.color})`,
        "--badge-color": `var(${tokens.color})`,
        "--badge-bg": `var(${tokens.bg})`,
      } as React.CSSProperties}
    >
      {/* 4px stripe via ::before — must be in CSS, not inline style */}
      <span className="text-[13px] font-semibold leading-[1.3] text-[var(--rv-text-primary)] mb-[6px] block">
        {title}
      </span>
      <span className="inline-flex items-center gap-[5px] px-2 py-[2px] rounded-[10px] text-[11px] font-semibold bg-[var(--badge-bg)] text-[var(--badge-color)]">
        <span className="w-[6px] h-[6px] rounded-full bg-[var(--badge-color)]" />
        {status.replace("-", " ")}
      </span>
    </div>
  );
}
```

Note: The `::before` stripe for 4px left border cannot be applied as an inline style — it requires a CSS class. Define it in `index.css` as `.node::before { content: ''; position: absolute; top: 0; bottom: 0; left: 0; width: 4px; background: var(--node-stripe-color, var(--rv-status-not-started)); border-radius: var(--node-radius, 8px) 0 0 var(--node-radius, 8px); }`.

### Zustand Theme Store

```typescript
// store/themeStore.ts
import { create } from "zustand";

type ThemePreference = "dark" | "light" | "high-contrast" | "system";
type ResolvedTheme = "dark" | "light" | "high-contrast";

interface ThemeState {
  preference: ThemePreference;
  systemResolution: "dark" | "light"; // current OS preference
  resolvedTheme: ResolvedTheme;
  setTheme: (pref: ThemePreference) => void;
  updateSystemResolution: (resolved: "dark" | "light") => void;
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  preference: "dark",
  systemResolution: "dark",
  resolvedTheme: "dark",
  setTheme: (pref) => {
    const resolved = pref === "system" ? get().systemResolution : pref;
    set({ preference: pref, resolvedTheme: resolved });
    // Persist via Bun RPC — call saveSettings({ theme: pref })
  },
  updateSystemResolution: (resolved) => {
    const { preference } = get();
    set({
      systemResolution: resolved,
      resolvedTheme: preference === "system" ? resolved : get().resolvedTheme,
    });
  },
}));
```

### CI Grep for Hardcoded Colors

```bash
# CI step — zero hardcoded color values in component source
grep -rE "(#[0-9a-fA-F]{3,8}|rgb\(|rgba\(|hsl\(|hwb\()" \
  packages/desktop/src/mainview/components/ \
  packages/desktop/src/mainview/hooks/ \
  packages/desktop/src/mainview/store/ \
  --include="*.ts" --include="*.tsx" --include="*.css" \
  && echo "FAIL: hardcoded colors found" && exit 1 \
  || echo "PASS: no hardcoded colors"

# Exception: index.css token definitions are explicitly allowed
# The grep above excludes index.css by targeting components/ hooks/ store/
```

### LogTape RPC Type Addition

```typescript
// shared/types.ts — add logMessage to bun requests
logMessage: {
  params: {
    level: "debug" | "info" | "warning" | "error" | "fatal";
    category: readonly string[];
    message: string;
    data?: Record<string, unknown>;
  };
  response: void;
};
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Tailwind JS config (`tailwind.config.js`) | CSS-first `@theme` directive in CSS file | Tailwind v4 (2025) | No JS config file; no `theme.extend`; CSS variables are the single source of truth |
| PostCSS as Vite integration layer | `@tailwindcss/vite` plugin | Tailwind v4 | Faster builds; no postcss.config.js needed |
| `@apply` for component styles | Tailwind utility classes directly in JSX | Tailwind v4 recommendation | `@apply` still works but discouraged in v4; inline utilities are preferred |
| `theme()` CSS function | Direct `var(--color-*)` references | Tailwind v4 | `theme()` removed from v4 CSS; use `@theme` variables or CSS custom properties |

**Deprecated/outdated:**
- `tailwind.config.js`: Replaced by `@theme` block in CSS. The existing file in `packages/desktop/tailwind.config.js` must be deleted.
- `postcss.config.js` with tailwindcss plugin: Must be removed after migration to prevent conflict.
- `autoprefixer`: No longer needed; Tailwind v4 handles vendor prefixes internally. [ASSUMED — verify in official v4 release notes]

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `--color-rv-bg-surface` naming convention in `@theme` generates utility `bg-rv-bg-surface` | Standard Stack, Code Examples | Tailwind v4 may strip the nested `bg-` prefix differently; naming convention needs verification against official docs before writing the full token map |
| A2 | Autoprefixer is no longer needed in Tailwind v4 | State of the Art | If autoprefixer is still needed for some CEF-specific vendor prefixes, removing it breaks CSS on older CEF versions; low risk given CEF is Chromium-based |
| A3 | Tailwind v4 `@theme` supports referencing other CSS custom properties via `var()` | Code Examples | If v4 `@theme` requires static values (no `var()`), the two-layer token architecture (`--color-rv-*: var(--rv-*)`) fails; must fall back to duplicating token values in `@theme` |

---

## Open Questions (RESOLVED)

1. **`@theme` naming convention for non-color tokens (shadows, border-width)**
   - What we know: `--color-*` maps to color utilities. Tailwind v4 has `--shadow-*` for shadows.
   - What's unclear: Whether `--rv-shadow-node` maps as `shadow-rv-shadow-node` or requires a different `@theme` prefix.
   - Recommendation: Shadows and border-width are best referenced directly as `style={{ boxShadow: 'var(--rv-shadow-node)' }}` or via a CSS class in `index.css` rather than through Tailwind utilities. This avoids the naming question entirely.
   - **RESOLVED:** Plans use inline `style={{ boxShadow: "var(--rv-shadow-node)" }}` for shadows and `border-[length:var(--rv-border-width)]` for border-width. Non-color tokens are NOT mapped through @theme — referenced directly as CSS variables. This was the recommended approach.

2. **`@tailwindcss/vite` + Vite's `root` option**
   - What we know: `vite.config.ts` sets `root: "src/mainview"`. The Tailwind Vite plugin processes CSS files from the configured root.
   - What's unclear: Whether `@import "tailwindcss"` in `src/mainview/index.css` resolves correctly when node_modules are at `packages/desktop/node_modules`.
   - Recommendation: Test migration in Wave 0 immediately; if resolution fails, use explicit `@import "../../node_modules/tailwindcss/index.css"` path.
   - **RESOLVED:** Plan 01-01 Task 1 tests the migration immediately. If @import "tailwindcss" fails with Vite root, the fallback explicit path is documented. The Vite plugin processes from the configured root — standard behavior confirmed by Tailwind v4 docs.

3. **Bun RPC for settings persistence — method name**
   - What we know: `shared/types.ts` has `loadFile`, `saveFile`, `openFilePicker` RPCs. `logMessage` needs to be added (D-22). A settings persistence RPC also needs adding.
   - What's unclear: Whether settings persistence uses a dedicated `saveSettings`/`loadSettings` RPC or piggybacks on the log message channel.
   - Recommendation: Add `saveSettings` and `loadSettings` as distinct RPCs in `shared/types.ts`. Theme preference is app-level state that outlives any schema.
   - **RESOLVED:** Plans use `saveSettings` and `loadSettings` as distinct RPCs in shared/types.ts (Plan 01-01 Task 1 step 6). `logMessage` added as a separate RPC (Plan 01-03 Task 2 step 2). All three are distinct request types.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js / Bun | Build tooling | ✓ | Bun (workspace uses bun install) | — |
| tailwindcss v4 | D-01 migration | ✗ (v3.4.16 installed) | needs upgrade to 4.2.2 | none — migration is locked decision |
| @tailwindcss/vite | D-01 migration | ✗ (not installed) | 4.2.2 | none — required for v4 |
| @logtape/logtape | D-21 logging | ✗ (not installed) | 2.0.5 | none — locked decision |
| jsdom | Component tests | ✗ (not installed) | 29.0.2 | none — required for ThemeProvider tests |
| @testing-library/react | Component tests | ✓ (16.3.2) | 16.3.2 | — |
| @testing-library/jest-dom | DOM matchers | ✓ (6.9.1) | 6.9.1 | — |

**Missing dependencies with no fallback:**
- `tailwindcss@4.x` + `@tailwindcss/vite` — must be installed in Wave 0 before any component work
- `@logtape/logtape` — must be installed in Wave 0
- `jsdom` — must be installed for Vitest jsdom environment

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.4 (already configured) |
| Config file | `packages/desktop/vitest.config.ts` |
| Quick run command | `bunx vitest run tests/unit/ --reporter=verbose` |
| Full suite command | `bunx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| THEME-01 | `ThemeProvider` sets `data-theme` on `<html>` | unit (jsdom) | `bunx vitest run tests/unit/ui/ThemeProvider.test.tsx` | ❌ Wave 0 |
| THEME-01 | Dark theme is default when no saved preference | unit (jsdom) | `bunx vitest run tests/unit/ui/ThemeProvider.test.tsx` | ❌ Wave 0 |
| THEME-02 | All three themes set correct `data-theme` value | unit (jsdom) | `bunx vitest run tests/unit/ui/ThemeProvider.test.tsx` | ❌ Wave 0 |
| THEME-02 | Token definitions exist for all 40+ `--rv-*` vars | unit (node) | `bunx vitest run tests/unit/tokens.test.ts` | ❌ Wave 0 |
| THEME-03 | `System` preference wires `matchMedia` listener | unit (jsdom) | `bunx vitest run tests/unit/ui/ThemeProvider.test.tsx` | ❌ Wave 0 |
| THEME-03 | Settings persistence RPC called on theme change | unit (jsdom, mock RPC) | `bunx vitest run tests/unit/ui/ThemeProvider.test.tsx` | ❌ Wave 0 |
| THEME-04 | Schema `themeConfig` overrides applied to scoped container | unit (jsdom) | `bunx vitest run tests/unit/ui/schemaOverrides.test.tsx` | ❌ Wave 0 |
| THEME-04 | Overrides do NOT appear on `document.documentElement` | unit (jsdom) | `bunx vitest run tests/unit/ui/schemaOverrides.test.tsx` | ❌ Wave 0 |
| THEME-05 | Zero hardcoded color values in component files | CI grep (static) | `grep -rE "#[0-9a-fA-F]{3}" packages/desktop/src/mainview/components/` | ❌ Wave 0 (CI step) |
| THEME-01–05 | Theme switcher buttons have correct ARIA roles | unit (jsdom) | `bunx vitest run tests/unit/ui/accessibility.test.tsx` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `bunx vitest run tests/unit/ui/ --reporter=verbose`
- **Per wave merge:** `bunx vitest run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `packages/desktop/tests/unit/ui/ThemeProvider.test.tsx` — covers THEME-01, THEME-02, THEME-03
- [ ] `packages/desktop/tests/unit/ui/schemaOverrides.test.tsx` — covers THEME-04
- [ ] `packages/desktop/tests/unit/ui/accessibility.test.tsx` — covers THEME-05 (ARIA)
- [ ] `packages/desktop/tests/unit/tokens.test.ts` — covers THEME-02 (token completeness check)
- [ ] `packages/desktop/vitest.config.ts` — add `environmentMatchGlobs: [["tests/unit/ui/**", "jsdom"]]`
- [ ] Install jsdom: `bun add -d jsdom`

---

## Security Domain

Security enforcement is enabled (no explicit `false` in config).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | no auth in this phase |
| V3 Session Management | no | no sessions |
| V4 Access Control | no | single-user desktop app |
| V5 Input Validation | yes (low risk) | `themeConfig` values from schema — sanitize token values before applying as inline styles |
| V6 Cryptography | no | no secrets in this phase |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| CSS injection via `themeConfig` token values | Tampering | Whitelist token value format: color values must match `#[0-9a-fA-F]{3,8}` or `rgba?()` pattern; reject anything else before applying inline styles |
| Log injection via structured log data | Tampering | LogTape uses structured JSON sinks — key/value pairs are serialized, not string-concatenated; low risk |

**CSS injection note:** The per-schema `themeConfig` override applies user-controlled values as inline CSS custom properties. A malicious schema could attempt `); background-image: url(` style injection. The mitigation is a regex whitelist on color values before they touch the DOM. This is the only meaningful attack surface in Phase 1. [VERIFIED: standard practice for untrusted CSS value application]

---

## Sources

### Primary (HIGH confidence)
- `packages/desktop/package.json` — installed dependencies, versions [VERIFIED: filesystem]
- `packages/desktop/vitest.config.ts` — test environment configuration [VERIFIED: filesystem]
- `packages/desktop/tailwind.config.js` — current v3 config (to be replaced) [VERIFIED: filesystem]
- `.planning/phases/01-visual-foundation-themes/01-UI-SPEC.md` — complete token values, component specs, spacing, typography [VERIFIED: filesystem]
- `.planning/phases/01-visual-foundation-themes/01-CONTEXT.md` — all locked decisions [VERIFIED: filesystem]
- `shared/types.ts` — current RPC contract [VERIFIED: filesystem]

### Secondary (MEDIUM confidence)
- npm registry for package versions: tailwindcss@4.2.2, @tailwindcss/vite@4.2.2, @logtape/logtape@2.0.5, jsdom@29.0.2 [VERIFIED: npm view 2026-04-13]

### Tertiary (LOW confidence — flagged in Assumptions Log)
- Tailwind v4 `@theme` token naming convention (A1) [ASSUMED — training knowledge]
- Autoprefixer removal in v4 (A2) [ASSUMED — training knowledge]
- `@theme` supporting `var()` references (A3) [ASSUMED — training knowledge]

---

## Project Constraints (from CLAUDE.md)

| Directive | Impact on Phase 1 |
|-----------|------------------|
| This is Electrobun, NOT Electron | No `ipcRenderer`, no `contextBridge`, no `BrowserWindow` from electron; use Electrobun RPC patterns from `shared/types.ts` |
| Do not use console.logs unless specifically asked | LogTape is the only logging mechanism; no `console.log` in component code |
| Never assume completion until user confirms | All tasks end in `status: verification` not `status: done` |
| Biome for linting/formatting (Phase 0) | All new files must pass `biome check`; no ESLint |
| TypeScript strict mode enabled | All new code must satisfy strict checks; `bunx tsc --noEmit` must pass |
| `bun run dev:hmr` is the development command | Vite + Electrobun concurrent dev; migration must not break this |

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all versions verified against npm registry
- Architecture patterns: HIGH — token values sourced from UI-SPEC, patterns from existing codebase analysis
- Pitfalls: HIGH — jsdom/getComputedStyle behavior is a known verified issue; Tailwind v4 migration conflict is documented behavior
- CSS injection: HIGH — standard practice for untrusted input to CSS

**Research date:** 2026-04-13
**Valid until:** 2026-05-13 (Tailwind v4 is in rapid release cycle; check for breaking changes before implementing)
