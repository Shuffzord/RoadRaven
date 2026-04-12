# Stack Research

**Project:** Roadmap Viewer (Electrobun desktop app)
**Researched:** 2026-04-12
**Confidence:** MEDIUM — web access unavailable; findings based on installed node_modules inspection
and training data (cutoff Aug 2025). Version currency for npm packages reflects what is installed,
not necessarily what is latest on npm at time of reading.

---

## Summary

The installed stack is well-chosen and internally consistent. All locked decisions — React 19,
Zustand 5, Zod 4, CodeMirror 6, react-d3-tree 3 — are current as of the training data cutoff and
show no compatibility conflicts with each other. The most significant finding is that the installed
Electrobun version (1.16.0) already exposes `Updater.localInfo.channel()` as a real method, meaning
the "updater bug" in `src/bun/index.ts` is NOT a missing API — the call signature is correct in the
installed package. There is a separate typo in the Updater internal code (`getLocallocalInfo`) that
is an Electrobun library bug, not a user-land bug to fix. For open decisions, `html2canvas` is a
reasonable choice for PNG export but has a known SVG rendering limitation that matters specifically
for react-d3-tree (which renders SVG); `modern-screenshot` or a canvas-based capture approach
should be evaluated. TypeScript 6.0.2 is cutting-edge and not widely tested in the ecosystem — this
warrants a flag. Tailwind 3.x is installed but Tailwind 4 is now stable and has a significantly
different config model; upgrading mid-project would be painful.

---

## Current Stack Assessment

### Locked Decisions — Status

| Library | Installed Version | Current (est.) | Status | Notes |
|---------|-------------------|----------------|--------|-------|
| electrobun | 1.16.0 | ~1.16.x | CURRENT | Latest available as of research; check npm for patch releases |
| react | 19.2.5 | 19.x | CURRENT | Stable, no breaking changes expected |
| react-dom | 19.2.5 | 19.x | CURRENT | Matches react version |
| react-d3-tree | 3.6.6 | 3.6.x | CURRENT | Supports React 16–19 via peerDeps; actively maintained |
| @codemirror/view | 6.41.0 | 6.x | CURRENT | CodeMirror 6 uses rolling minor releases |
| @codemirror/state | 6.6.0 | 6.x | CURRENT | Matches view; both must track together |
| @codemirror/lang-markdown | 6.5.0 | 6.x | CURRENT | Correct for markdown editing |
| zod | 4.3.6 | 4.x | CURRENT — BREAKING | v4 is NOT backward-compatible with v3; imports changed |
| zustand | 5.0.12 | 5.x | CURRENT | v5 dropped legacy React 17 patterns; requires React 18+ (satisfied) |
| vitest | 4.1.4 | 4.x | CURRENT | v4 released 2025; configuration API changed from v2/v3 |
| vite | 6.4.2 | 6.x | CURRENT | v6 stable; Rolldown plugin API available but opt-in |
| typescript | 6.0.2 | 6.x | CUTTING EDGE — FLAG | TS 6 released mid-2025; ecosystem support incomplete (see below) |
| tailwindcss | 3.4.19 | 4.x available | OUTDATED MAJOR | v4 is stable but requires config rewrite; v3 works fine, don't upgrade mid-project |
| @vitejs/plugin-react | 4.7.0 | 4.x | CURRENT | Correct for React 19 + Vite 6 |
| uuid | 13.0.0 | 13.x | CURRENT | v13 is ESM-first; import as `import { v4 as uuidv4 } from 'uuid'` |
| @radix-ui/react-context-menu | 2.2.16 | 2.x | CURRENT | |
| @radix-ui/react-dialog | 1.1.15 | 1.x | CURRENT | |
| @radix-ui/react-dropdown-menu | 2.1.16 | 2.x | CURRENT | |
| remark | 15.0.1 | 15.x | CURRENT | ESM-only; no CJS interop |
| rehype | 13.0.2 | 13.x | CURRENT | ESM-only; matches remark major |
| fuse.js | 7.3.0 | 7.x | CURRENT | |
| playwright | NOT INSTALLED | 1.44+ | MISSING | Required for E2E; must add before scaffold step |
| @playwright/test | NOT INSTALLED | 1.44+ | MISSING | Required for E2E test runner |
| html2canvas | NOT INSTALLED | 1.4.1 | OPEN DECISION | See open decisions below |
| @uiw/react-codemirror | NOT INSTALLED | 4.x | NOT NEEDED | Raw CM6 packages are installed; React wrapper optional |

---

### Open Decisions

| Decision | Recommendation | Confidence | Rationale |
|----------|----------------|------------|-----------|
| PNG export library | `modern-screenshot` over `html2canvas` | MEDIUM | html2canvas does not render SVG content reliably — react-d3-tree renders the entire tree as SVG. `modern-screenshot` (based on `dom-to-image-more`) handles SVG elements and has active maintenance as of 2025. Alternative: call `canvas.toDataURL()` directly on the d3-tree canvas if react-d3-tree exposes a canvas ref. |
| E2E test runner | `@playwright/test` | HIGH | Already specified in SPEC. Not yet installed. Add to devDependencies at scaffold step. Electrobun apps launch as native processes; Playwright must spawn the built app binary and use `page.evaluate()` — it cannot use Electron-style `app` APIs. |
| SQLite event log | Deferred (per PROJECT.md) | HIGH | PROJECT.md explicitly defers SQLite to post-v1. For the in-app event log (US-07), an in-memory array with a bounded ring buffer (e.g., last 1000 entries) sent to the webview via RPC is sufficient for v1. No SQLite adapter needed. |
| Markdown render (side panel read-only) | `remark` + `rehype` already installed | HIGH | remark 15 + rehype 13 are the correct ESM-only pipeline for server-side markdown processing. In the Bun process, use this pipeline. In the webview renderer, use the same pipeline bundled via Vite. No additional markdown library needed. |
| CodeMirror React wrapper | Use raw CM6 packages (already installed) | HIGH | @uiw/react-codemirror is a convenience wrapper — it adds an abstraction layer over the same packages already installed. Manage EditorView lifecycle directly in a React ref; this is well-documented and avoids a wrapper dependency. |
| Monorepo tooling | Bun workspaces (built-in) | HIGH | Bun has native workspace support. No need for Turborepo, Nx, or Lerna for a 3-package monorepo. Add `workspaces: ["packages/*", "plugins/*"]` to root package.json. |
| State serialization (RPC) | JSON over WebSocket (built-in to Electrobun RPC) | HIGH | Electrobun's `createRPC` / `defineElectrobunRPC` already handles WebSocket transport. Do not add a separate IPC library. |

---

## Electrobun Ecosystem

### Maturity

Electrobun is a small, actively developed framework by Blackboard Technologies Inc. It is NOT
production-hardened at the level of Electron or Tauri. As of 1.16.0, the core APIs — `BrowserWindow`,
`createRPC`, `Updater`, `ApplicationMenu`, `ContextMenu`, `Tray`, `Socket` — are all present and
functional. The framework uses CEF (Chromium Embedded Framework) for the webview, giving strong
cross-platform rendering consistency.

The framework is notably small: the dependency tree in the published npm package is minimal, and the
codebase is directly inspectable. This is a double-edged sword — you can read exactly what APIs do,
but community resources (Stack Overflow, GitHub issue answers, blog posts) are sparse.

### Known API Issues Found During Inspection

**Updater API — `getLocallocalInfo` typo (library-internal bug):**
The Electrobun `Updater.ts` source has a typo: the internal async method is named
`getLocallocalInfo` (double "local") at line 1112. This is an internal method; the public API
`Updater.localInfo.channel()` at line 1105 calls through to it and works correctly. The bug
documented in memory (`src/bun/index.ts` calls `Updater.localInfo.channel()`) is therefore NOT a
missing method — `Updater.localInfo.channel()` DOES EXIST as an async function in 1.16.0. The
memory note recommends replacing it with `const localInfo = await Updater.getLocalInfo()` — but
`getLocalInfo()` does NOT exist; the actual method is `getLocallocalInfo()` (the typo). Use the
`Updater.localInfo.channel()` form which works correctly.

**Fix for `src/bun/index.ts`:**
The current code `await Updater.localInfo.channel()` is CORRECT for v1.16.0. Do not change it.
The memory note about "Updater.getLocalInfo()" appears to reference a non-existent method name.

**Linux — `ApplicationMenu` not supported:**
Confirmed in PROJECT.md. All actions must be reachable via keyboard shortcuts and toolbar buttons.
Do not use `ApplicationMenu` in any code path that runs on Linux.

**Linux — `bundleCEF: true`:**
Required in `electrobun.config.ts` for Linux packaging. CEF is not pre-installed on Linux.

**RPC transport:**
Electrobun uses WebSocket on `ws://localhost:{dynamic_port}` with per-webview AES-GCM encryption.
This is intentional; do not treat it as insecure. The port is injected as
`window.__electrobunRpcSocketPort` by the preload script. Do not hardcode port numbers.

**`views://` protocol:**
Bundled views must be loaded via `views://mainview/index.html`, not `file://`. This is already
correct in `src/bun/index.ts`.

### Community and Support

- GitHub: https://github.com/blackboardsh/electrobun
- Documentation: https://blackboard.sh/electrobun/docs/
- LLM-optimised reference: https://blackboard.sh/electrobun/llms.txt
- Community: Small. Expect to read source code rather than find answered Stack Overflow questions.
- Issues: Check GitHub issues before implementing any non-trivial feature (file dialogs, tray
  behavior, updater edge cases). The framework is young enough that issues may be open bugs.

### Version Cadence

Electrobun uses patch-level releases frequently. 1.16.0 was the version at install time. Pin to an
exact version in package.json (already done: `"electrobun": "1.16.0"`) and review the changelog
before upgrading. Do not use `^` semver range for Electrobun.

---

## Compatibility Notes

### TypeScript 6.0.2 — HIGH RISK FLAG

TypeScript 6 was released mid-2025 and is cutting-edge. Key concerns:

1. **`@types/react` and `@types/react-dom`** — installed at 19.x, which should be compatible, but
   TypeScript 6 strict mode may surface type errors in third-party libraries that haven't been
   updated.
2. **Vitest 4** — Vitest 4 is designed for modern tooling but was released targeting TypeScript 5.x.
   Type inference in test files may behave differently. Watch for issues with `vi.mock()` inference.
3. **Vite 6 + TypeScript 6** — Vite 6 bundles its own TypeScript transform via `@vitejs/plugin-react`
   (Babel/SWC) and does not use `tsc` for transpilation. TypeScript 6 only affects `tsc` type
   checking, not the Vite build output. This means the build will succeed even if `tsc --noEmit`
   produces errors.
4. **Recommendation:** Add `"strict": true` to `tsconfig.json` and run `bunx tsc --noEmit` as part
   of CI from day one. Catch type regressions early before they accumulate.

### Zod 4 — Breaking Change Alert

Zod 4 (installed: 4.3.6) is NOT backward-compatible with Zod 3. Breaking changes:

- Import path changed: use `import { z } from 'zod'` (same) but several internal types moved
- `z.ZodType` → `z.ZodTypeAny` for generic type constraints in some patterns
- `superRefine` callback signature changed
- `z.infer<>` still works identically
- Error formatting API changed: `ZodError.format()` output shape is different

Since no existing Zod schemas exist in the codebase yet, this is not a migration issue — write
directly to Zod 4 patterns from the start.

### Zustand 5 + React 19

Zustand 5 peer-depends on `react >= 18.0.0`. React 19 satisfies this. The `useSyncExternalStore`
pattern used internally by Zustand 5 is fully compatible with React 19's concurrent rendering.
No issues expected.

### remark 15 + rehype 13 — ESM-Only

Both are ESM-only packages. In the Bun main process, this is fine (Bun supports ESM natively).
In the Vite-bundled webview, this is also fine (Vite handles ESM). Do NOT use `require()` with
these packages.

### react-d3-tree 3.6.6 + React 19

peerDependencies declare `"react": "16.x || 17.x || 18.x || 19.x"` — explicit React 19 support.
No compatibility issues.

### CodeMirror 6 — Missing Packages for Full Editor

The installed CM6 packages cover the markdown language extension and core view/state. For a
complete editor implementation, additional `@codemirror/*` packages are already installed:
`autocomplete`, `lang-css`, `lang-html`, `lang-javascript`, `language`, `lint`. These were likely
installed as transitive dependencies. For the markdown editor specifically, also consider:

- `@codemirror/commands` — keyboard shortcut bindings (Enter, Tab, Backspace behaviors). Check
  if installed: `ls node_modules/@codemirror/commands`
- `@codemirror/theme-one-dark` — if you want a bundled dark theme as a starting point (optional;
  the project uses CSS custom properties, so a custom CM6 theme is preferred)

The React integration for CodeMirror 6 requires managing `EditorView` in a `useRef` + `useEffect`
pattern. No React-specific CM6 wrapper package is installed or needed.

### Playwright — Not Installed

Playwright (`@playwright/test`) is specified in the testing strategy but is not in `package.json`
and not installed. Add it at scaffold time:

```bash
bun add -D @playwright/test
bunx playwright install --with-deps chromium
```

Note: Testing an Electrobun app with Playwright requires launching the compiled app binary and
connecting to it. Playwright cannot inject into the Electrobun main process (no CDP access to the
Bun side). E2E tests operate purely from the user's perspective: launch app, interact via webview
UI, assert DOM state. This is the correct approach.

### Tailwind 3 vs 4

Tailwind 3.4.19 is installed. Tailwind 4 has a fundamentally different configuration model (no
`tailwind.config.js`; uses CSS `@import "tailwindcss"` instead). Upgrading mid-project is a
significant refactor. Stay on Tailwind 3 for the entire v1 build. Plan a Tailwind 4 migration for
v2 if desired.

---

## Recommendations

### Immediate (Scaffold Step)

1. **Fix the Updater call — do NOT change it.** The current `await Updater.localInfo.channel()`
   call in `src/bun/index.ts` is correct for Electrobun 1.16.0. The memory note recommending
   `Updater.getLocalInfo()` references a method that does not exist. Leave the existing call.

2. **Add Playwright.** Add `@playwright/test` to devDependencies before writing any E2E tests.
   Add `bunx playwright install --with-deps chromium` to CI setup steps.

3. **Pin Electrobun exactly.** Already done (`"electrobun": "1.16.0"`). Do not change to `^`.
   Check https://github.com/blackboardsh/electrobun/releases for patch releases before each
   phase, but upgrade deliberately.

4. **Add `@codemirror/commands`.** Verify it is installed (`ls node_modules/@codemirror/commands`).
   If not, add it — keyboard behavior in the markdown editor depends on it.

5. **Configure Bun workspaces.** Add to root `package.json`:
   ```json
   "workspaces": ["packages/*", "plugins/*"]
   ```
   Then create `packages/core/package.json`, `packages/react/package.json`,
   `packages/desktop/package.json` with appropriate `name` fields (`@roadmap-viewer/core` etc.).

### PNG Export Decision

Do NOT use `html2canvas` for react-d3-tree output. html2canvas rasterizes DOM elements but has
poor SVG support — it will produce a blank or corrupted image for SVG trees.

**Recommended approach:** `modern-screenshot` (npm: `modern-screenshot`). It uses the
`foreignObject` + `canvas` technique with proper SVG serialization. Alternatively, since
react-d3-tree renders into an SVG element, serialize the SVG directly:

```typescript
// In the webview:
const svg = document.querySelector('.rd3t-tree-container svg');
const serialized = new XMLSerializer().serializeToString(svg);
const blob = new Blob([serialized], { type: 'image/svg+xml' });
// Convert to PNG via canvas at 2x resolution
const img = new Image();
img.src = URL.createObjectURL(blob);
img.onload = () => {
  const canvas = document.createElement('canvas');
  canvas.width = svg.clientWidth * 2;
  canvas.height = svg.clientHeight * 2;
  canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
  canvas.toBlob(blob => { /* send to Bun via RPC */ }, 'image/png');
};
```

This approach requires no additional dependencies and is more reliable than html2canvas for SVG
content. Evaluate at implementation time; the pure SVG serialization path is the first choice.

### TypeScript Configuration

Configure `tsconfig.json` with:
- `"strict": true`
- `"target": "ESNext"`
- `"module": "ESNext"`
- `"moduleResolution": "bundler"` (for Vite compatibility)
- `"jsx": "react-jsx"` (React 17+ transform; no `import React` needed)

Run `bunx tsc --noEmit` in CI even though Vite does not use it for compilation. Type safety is
enforced at check time, not build time.

### Event Log (In-Memory, No SQLite)

For the plugin integration event log (US-07), implement a bounded ring buffer in the Bun process:
```typescript
const MAX_LOG_ENTRIES = 1000;
const eventLog: EventLogEntry[] = [];
function appendEvent(entry: EventLogEntry) {
  eventLog.push(entry);
  if (eventLog.length > MAX_LOG_ENTRIES) eventLog.shift();
}
```
Expose via RPC as `getEventLog()` and `subscribeToEvents()`. No SQLite needed for v1. This
matches the PROJECT.md deferral of SQLite persistence.

---

## Sources

All findings derived from:
- Direct inspection of installed `node_modules/` packages (version numbers, peer deps, API surface)
- `/home/shuffler/Work/Roadraven/package.json` (installed dependency versions)
- `/home/shuffler/Work/Roadraven/node_modules/electrobun/dist/api/bun/core/Updater.ts` (API shape)
- `/home/shuffler/Work/Roadraven/node_modules/electrobun/dist/api/bun/index.ts` (exported API)
- `/home/shuffler/Work/Roadraven/node_modules/electrobun/dist/api/browser/index.ts` (webview API)
- `/home/shuffler/Work/Roadraven/.planning/PROJECT.md` (project context and decisions)
- `/home/shuffler/Work/Roadraven/.planning/SPEC.md` (requirements and architecture)
- `/home/shuffler/.claude/projects/.../memory/project_updater_bug.md` (known bug context)
- Training data (cutoff Aug 2025) — LOW confidence for version currency claims
- Web access: UNAVAILABLE during this research session
