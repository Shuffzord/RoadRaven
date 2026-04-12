# Roadmap Viewer

## What This Is

An open-source Electrobun desktop application for creating, editing, and live-monitoring visual roadmap trees from a plain JSON schema. Each node in the tree can carry markdown notes, arbitrary metadata, and live status subscriptions that reflect real-time state from external tools (CI pipelines, AI agents, scripts) via a pluggable integration system. The tool is deliberately generic — the same schema serves learning roadmaps, product plans, data pipeline maps, and task boards.

## Core Value

Nodes in the tree reflect real-time state of external systems through a pluggable integration layer — turning any JSON roadmap into a live progress dashboard without locking users into a workflow.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] App scaffold: Electrobun shell boots, monorepo structure in place (`packages/core`, `packages/react`, `packages/desktop`, `plugins/`), TDD pipeline operational (Vitest + Playwright), CI running
- [ ] Theme system: built-in `dark`, `light`, `high-contrast` themes; `--rv-*` CSS custom property tokens; per-schema `themeConfig` overrides; OS `prefers-color-scheme` fallback; app-level preference persisted in `.roadmap-settings.json`
- [ ] Read-only tree viewer: renders JSON schema via react-d3-tree; TB and LR layouts; collapse/expand; zoom/pan; status badges; file watcher; schema validation error panel; performance gate (300+ nodes, 10 updates/sec ≥ 30 fps)
- [ ] Side panel (read-only): opens on node click; shows title, status, type, timestamps, markdown notes; resizable (min 320px, max 50% viewport); pinnable on wide screens
- [ ] Full node editor: inline rename; add/delete/duplicate/move via keyboard and context menu; CodeMirror 6 markdown editor with autosave (debounced 1s); editable metadata table; atomic writes; `$ref` write-back
- [ ] Plugin integration system: generic `RoadmapPlugin` interface; transport adapters (WebSocket, Webhook, MQTT, file watcher); Claude Code reference implementation; side panel Integration zone shows generic connection status + last event + key-value state (no custom plugin UI injection); unknown plugin warning on node
- [ ] Export: self-contained HTML and 2x PNG (approach TBD — spike required; html2canvas excluded)
- [ ] Packaging: macOS `.dmg`, Windows `.exe`, Ubuntu `.deb`; Electrobun auto-updater; npm packages (`@roadmap-viewer/core`, `@roadmap-viewer/react`); plugin authoring guide; README and docs site

### Out of Scope

- User authentication or cloud sync — not a collaboration tool; complexity not justified for v1
- Real-time multi-user editing (CRDT) — out of scope for desktop-first MVP
- Mobile or web deployment — Electrobun is desktop-only; web version is a future concern
- Multi-window support — single-file focus for MVP
- Drag-and-drop node reordering — deferred to v1.1
- Schema migration tooling — migrator in `@core` is planned for v3.0; only the version field and hook point are built in v1
- Multi-file workspace (tabbed) — deferred to v1.1
- Dynamic runtime plugin loading from local `plugins/` directory — deferred to v1.1
- SQLite persistence mode — JSON file is the durability mechanism for v1
- Cross-boundary `$ref` node moves — blocked in MVP with an error; deferred to v1.1
- Custom SVG type icons — built-in icon set only for v1; custom SVG deferred to v1.1
- Undo/redo — deferred from MVP; non-leaf delete has confirmation dialog; plain JSON + git provides recovery; `.bak.json` written on file open as safety net; `$ref` + live-subscription complexity makes retrofit viable later
- Custom plugin UI injection — plugins cannot inject React components into webview; side panel Integration zone is a generic renderer only (Option A); custom plugin UI deferred to v1.1

## Context

- **Stack:** Electrobun (NOT Electron), Bun runtime, React, TypeScript, Vitest, Playwright, react-d3-tree, CodeMirror 6, Zod, Zustand
- **Architecture:** Strict two-process model enforced by Electrobun. Bun main process handles all file I/O, validation, pub/sub adapters, native menus, and auto-updater. Webview runs the React app. All cross-process calls go through a typed RPC contract in `shared/types.ts`.
- **Data model:** Nested JSON schema (not flat+parent-IDs). Node IDs are UUIDs v4. User-defined `statusConfig` and `typeConfig`. Split-file support via `$ref`. Version field reserved for future migration system.
- **Tree renderer:** react-d3-tree (chosen over React Flow for strict-tree design, built-in collapse/expand, better performance at 1000+ nodes, smaller bundle). Inline rename uses a floating HTML `<input>` positioned over SVG nodes via `getBoundingClientRect()`.
- **Save behavior:** Debounced 2s write, 30s periodic autosave, flush on `before-quit` Electrobun event. Atomic writes via `.tmp` then rename. No explicit Save button. No unsaved-changes confirmation.
- **Plugin integration:** Requires dedicated research phase before implementation. Must cover: plugin interface contract, transport adapters, security/isolation model, Bun-to-webview side panel handoff, static vs. dynamic loading.
- **Linux packaging:** `bundleCEF: true` required in `electrobun.config.ts`. `ApplicationMenu` not supported — all actions must be reachable via keyboard shortcuts and toolbar buttons.
- **PNG export:** html2canvas excluded (broken SVG support); approach TBD — spike required before Phase 4. Candidates: direct SVG serialization to canvas (no dependency), or `modern-screenshot`. Blob sent to Bun via RPC for file write regardless.
- **react-d3-tree performance:** Must use `dataKey` prop from first render. Only increment `dataKey` on structural mutations (add/delete/move). Status-only updates go in-place via Zustand shallow selectors — never change the data reference. Required to pass 30 fps gate at 300+ nodes.
- **Updater API:** `Updater.localInfo.channel()` in `src/bun/index.ts` is correct for Electrobun 1.16.0. Prior note about `Updater.getLocalInfo()` was wrong — that method does not exist. Wrap in try/catch; treat missing `version.json` as channel `"dev"`. Do not change this call.
- **Safety net on file open:** Write `.bak.json` on every file open (one line). Compensates for no undo/redo in MVP.

## Constraints

- **Tech stack:** Electrobun + Bun + React + TypeScript — no Electron APIs or patterns
- **TDD-first:** Tests are written before implementation; no step begins until prior step's acceptance tests are green
- **Performance:** 300+ visible nodes + 10 simulated `updateNode()` calls/sec must maintain ≥ 30 fps; validated before Phase 1 ships
- **Licensing:** MIT open source — published as `@roadmap-viewer/core` and `@roadmap-viewer/react` on npm
- **Security:** All integration adapters bind to `127.0.0.1` by default; no external ports opened without explicit user config

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Electrobun (not Electron) | Bun runtime, modern architecture, Electrobun is the designated framework | — Pending |
| Nested JSON schema (not flat) | Human-readable, maps directly to tree renderer, clean git diffs | — Pending |
| UUIDs for node IDs | Stable across renames; subscriptions and plugin bindings depend on IDs never changing | — Pending |
| react-d3-tree over React Flow | Purpose-built for strict trees; built-in collapse/expand; better perf at scale | — Pending |
| Plugin system (not hardcoded Claude Code) | Generic interface enables any integration; Claude Code is reference impl only | — Pending |
| Research phase required for plugin system | Integration design (transport, isolation, handoff) is complex enough to warrant dedicated research before any code | — Pending |
| Monorepo with `packages/core`, `packages/react`, `packages/desktop` | Core and React packages are publishable to npm independently from the desktop app | — Pending |
| No undo/redo in MVP | Non-leaf delete has confirmation; file is plain JSON recoverable via git; `.bak.json` on open is the safety net; `$ref` + live-subscription tracking makes it non-trivial to retrofit — but not impossible | — Pending |
| Plugin side panel = generic state renderer (Option A) | Plugins run in Bun and cannot inject React components into webview; plugins emit serialisable state objects; webview renders generic key-value + event log | — Pending |
| html2canvas excluded for PNG export | Broken SVG support with react-d3-tree output; approach decision deferred to Phase 4 spike | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-12 after research review — undo/redo deferred, plugin side panel locked to Option A, PNG export deferred, dataKey pattern added, Updater API clarified*
