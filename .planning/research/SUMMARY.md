# Research Summary: Roadmap Viewer

**Researched:** 2026-04-12
**Confidence:** MEDIUM-HIGH overall (stack findings verified from installed source; feature/architecture findings from domain knowledge and spec cross-reference; web access unavailable during research)

---

## TL;DR

Roadmap Viewer is a live-status tree editor built on Electrobun (not Electron) — a niche but functional framework whose small community requires reading source code rather than searching Stack Overflow. The core architecture (two-process model, typed RPC, Zustand store, react-d3-tree renderer) is sound and well-matched to the stack, but four problems require decisions before coding starts: undo/redo is completely absent from the spec and its omission combined with auto-flush-on-quit creates a real data-loss path; react-d3-tree deep-clones the entire tree on every data reference change, which will break the 30 fps performance gate unless the `dataKey` pattern is baked in from Phase 2; the plugin side-panel component handoff as currently specified is architecturally broken (plugins run in Bun and cannot inject React components); and `html2canvas` will produce corrupted output for SVG trees — a different export approach is needed. The biggest surprise from research is how many stated open questions were already resolved by inspecting installed packages: the Updater "bug" is not a bug, the Zod/Zustand/React 19 stack is fully compatible, and the remark/rehype ESM-only packages work cleanly in both Bun and Vite contexts.

---

## Stack Verdict

### Confirmed Choices

| Library | Version | Status | Note |
|---------|---------|--------|------|
| electrobun | 1.16.0 | Locked — pin exactly | Do not use `^`; check changelog before any upgrade |
| react | 19.2.5 | Current, stable | Fully compatible with Zustand 5 and react-d3-tree 3.x |
| react-d3-tree | 3.6.6 | Current | Explicit React 19 support; `dataKey` prop is critical for performance |
| zustand | 5.0.12 | Current | Uses `useSyncExternalStore`; concurrent-safe with React 19 |
| zod | 4.3.6 | Current — BREAKING vs. v3 | Write to Zod 4 patterns from scratch; don't copy v3 examples |
| @codemirror/* | 6.x | Current | Manage `EditorView` via `useRef` + `useEffect`; no React wrapper needed |
| vite | 6.4.2 | Current | — |
| vitest | 4.1.4 | Current | v4 config API differs from v2/v3 |
| typescript | 6.0.2 | CUTTING EDGE — flag | Ecosystem support incomplete; enforce `bunx tsc --noEmit` in CI from day one |
| tailwindcss | 3.4.19 | Behind major | Stay on v3 for all of v1; Tailwind 4 config model is incompatible |
| remark + rehype | 15 + 13 | Current | ESM-only; no additional markdown library needed |

### Open Decisions Requiring Resolution Before Implementation

| Decision | Recommendation | Phase |
|----------|----------------|-------|
| PNG export library | Do NOT use html2canvas — SVG rendering is broken for react-d3-tree output. Use direct SVG serialization to canvas or `modern-screenshot`. | Spike before Phase 4 |
| E2E testing strategy | Two tiers: Playwright against Vite dev server with mock RPC (UI behavior), plus Bun-native integration tests for Bun-side logic. Do not attempt to drive native Electrobun binary via Playwright for v1. | Prerequisite |
| Playwright | Not installed. Add `@playwright/test` to devDependencies at scaffold. | Prerequisite |
| `@codemirror/commands` | Verify installed; add if missing — keyboard behavior in the markdown editor depends on it. | Prerequisite |

### Version Flags

- **TypeScript 6.0.2:** Vite does not use `tsc` for compilation, so build succeeds even with type errors. The `bunx tsc --noEmit` CI step is the only gate. Add it immediately.
- **Updater API:** `await Updater.localInfo.channel()` in `src/bun/index.ts` is CORRECT for 1.16.0. A prior note recommending `Updater.getLocalInfo()` references a method that does not exist. Do not change this call. Wrap in try/catch; treat missing `version.json` as channel `"dev"`.

---

## Must-Have Features (Table Stakes)

| Feature | Spec Status | Action Needed |
|---------|------------|---------------|
| Collapse / expand subtrees | Present | None |
| Zoom and pan canvas | Present | None |
| Inline status badge on nodes | Present | None |
| Autosave + atomic writes | Present | None |
| Schema validation error panel | Present | None |
| Context menu for all operations | Present | None |
| Keyboard-first editing (Tab/Enter/F2) | Present | None |
| Performance gate (300 nodes, 10 fps) | Present | Must be enforced at Phase 2 |
| **Undo / Redo** | **MISSING** | **Data-loss blocker — add to Phase 2 scope** |
| **Copy / Paste nodes** | **MISSING** | Add to Phase 2; Ctrl+C/V with JSON clipboard format |
| **Arrow-key tree navigation** | Partial | Tab/Enter present; directional focus nav missing |
| **File > New (empty canvas)** | Not specified | Add to Phase 1 or Phase 2 |
| **Recent files list** | Not specified | Low-cost addition via `.roadmap-settings.json` |

---

## Key Differentiators

| Feature | Why It Matters | Build Risk |
|---------|---------------|------------|
| Live node status from external systems | No desktop tree editor does real-time status. Core moat. | Plugin system complexity (Phase 4 research gate) |
| Plain JSON + git-friendly format | Pure win for developer users. | Low |
| Zero-opinion status/type system | Works for CI pipelines, task boards, learning roadmaps equally. | Risk of overwhelming new users; strong default schema mitigates |
| `$ref` split-file support | Unique in the category. | Cross-boundary moves blocked in MVP; error message must be actionable |
| Embeddable npm packages | `@roadmap-viewer/core` and `@roadmap-viewer/react` make this a platform. | Package boundary discipline must be enforced from Phase 1 |

---

## Critical Risks

### Risk 1 — react-d3-tree Full-Tree Deep Clone on Every Update (CRITICAL)

react-d3-tree calls `clone(nextProps.data)` in `getDerivedStateFromProps` whenever the `data` prop reference changes and `dataKey` is absent or changed. At 300 nodes + 10 live updates/second = 6,000+ object allocations/second. This will break the 30 fps gate.

**Mitigation:** Use `dataKey` to gate cloning. Increment it only on structural changes (add/delete/move). Use in-place updates and `useShallow` Zustand selectors for status-only changes.

**Phase:** Phase 2 — non-negotiable before shipping.

---

### Risk 2 — Undo/Redo Absent + Auto-Flush-on-Quit = Data Loss Path (HIGH)

No undo, no unsaved-changes confirmation, flush-on-`before-quit`. A misplaced Delete on a 100-node subtree has zero recovery path.

**Mitigation:** Command-pattern undo stack in Zustand, capped at 50 entries. Must be designed at Phase 2 start — retrofitting is architecturally painful.

**Phase:** Phase 2 — must be in initial design.

---

### Risk 3 — Plugin Side-Panel Component Handoff is Architecturally Broken (HIGH)

The spec's `sidePanel.component: string` implies plugins can register React components. Plugins run in Bun and have no access to the webview's React tree.

**Mitigation (MVP):** Plugins emit serialisable `pluginState` objects. A single generic `PluginStatePanel` in the webview renders whatever the plugin emits. No dynamic component loading.

**Phase:** Phase 4 research gate — must be locked before any plugin implementation.

---

### Risk 4 — PNG Export via html2canvas Will Fail for SVG Trees (HIGH)

html2canvas does not render SVG reliably. react-d3-tree renders entirely as SVG. A 300-node tree at 2x can also take 5–10 seconds, exceeding the default 5s RPC timeout.

**Mitigation:** Direct SVG serialization: `XMLSerializer.serializeToString(svgElement)` → canvas draw → `canvas.toDataURL('image/png')`. Raise `maxRequestTime` for `exportPng` to at least 15s.

**Phase:** Phase 4 — spike before committing to any approach.

---

### Risk 5 — Linux Platform Gaps Compound (MEDIUM-HIGH)

Three Linux issues: (1) `ContextMenu.showContextMenu()` is a no-op — right-click actions unreachable; (2) `bundleCEF: false` is the current config default causing CSS/SVG inconsistencies; (3) `before-quit` may not fire for SIGTERM on Linux.

**Mitigation:** Custom webview-rendered context menu for Linux. Set `bundleCEF: true` at Prerequisite. Register `process.on('SIGTERM', flushWriteQueue)`.

**Phase:** Prerequisite (bundleCEF) + Phase 3 (context menu) + throughout.

---

## Phase Implications

| Phase | Research Flag | Key Actions Before Coding |
|-------|--------------|--------------------------|
| Prerequisite | LOW | `bundleCEF: true`; Updater try/catch; Playwright install; monorepo workspace setup; `tsc --noEmit` in CI |
| Phase 1: App Scaffold + Themes | LOW | Establish `packages/core/src/theme.ts` stub; add `recentFiles` to settings schema; add `File > New` |
| Phase 2: Viewer + Editor | MEDIUM | `dataKey` pattern + undo stack design before any component work; performance gate before shipping |
| Phase 3: Side Panel + Plugins | HIGH | Dedicated `/gsd-research-phase` required; webhook lifecycle, plugin side-panel Option A, Linux context menu |
| Phase 4: Export + Packaging | LOW/MEDIUM | PNG spike first; peer-dep discipline; Linux `.deb` testing |

---

## Open Questions

| Question | Priority |
|----------|----------|
| Undo/redo in scope for Phase 2? (data-loss blocker) | HIGH |
| Plugin side-panel: confirm serialisable `pluginState` approach for MVP | HIGH |
| Webhook server lifecycle: port config, start/stop, user communication of URL | HIGH |
| PNG export: SVG serialization vs `modern-screenshot` | MEDIUM |
| Empty state / onboarding UX for first-time user | MEDIUM |
| `$ref` write-back: parent file or referenced file? | MEDIUM |
