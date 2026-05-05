# RoadRaven

A keyboard-first desktop editor for visual roadmap trees. Nodes map to tasks or agents; status updates can stream in over WebSocket (Claude Code integration). Plain JSON data model, atomic autosave, markdown notes.

> Built on **Electrobun** (not Electron). Runtime is **Bun**.

---

## Install

> **v1.0 ships Windows + Linux installers.** macOS is deferred to v1.1
> (see [Feature status](#feature-status) below).

Download the latest release from
[GitHub Releases](https://github.com/Shuffzord/RoadRaven/releases/latest).

### Windows

1. Download `stable-win-x64-RoadRaven-Setup.zip`.
2. Extract the `.zip`.
3. Double-click `RoadRaven-Setup.exe`.
4. **Windows SmartScreen will warn:** "Windows protected your PC."
   This is expected — RoadRaven v1.0 ships unsigned (no Authenticode
   certificate, deferred to v1.1). To install:
   - Click **More info**.
   - Click **Run anyway**.
5. Follow the installer prompts.

### Linux

1. Download `stable-linux-x64-RoadRaven-Setup.tar.gz`.
2. Extract and run the self-extracting installer:

   <!-- The extracted file is literally named `installer` (no extension). This is the
        Electrobun convention: see `electrobun/src/cli/index.ts` `createLinuxInstallerArchive`
        (~line 1680) which writes `installerPath = join(stagingDir, "installer")` with
        mode 0o755, plus the bundled README.txt that ships inside the archive instructing
        users to "Double-click the 'installer' file" or run "./installer". Verified
        against electrobun@1.18.1. If a future Electrobun version renames this binary,
        update both this section and `tests/release/installer-artifacts.test.ts`. -->
   ```bash
   tar -xzf stable-linux-x64-RoadRaven-Setup.tar.gz
   chmod +x ./installer        # ensure self-extractor is executable (per RESEARCH.md Pitfall 6)
   ./installer
   ```

   The archive extracts contents directly (no nested folder). The
   `chmod +x` step is required: Electrobun's `.tar.gz` bundle does not
   guarantee the executable bit on every Linux filesystem
   (cross-references RESEARCH.md Pitfall 6 — Linux launcher needs `+x`).
   The installer extracts the app to `~/.local/share/` and creates a
   desktop shortcut; the CEF runtime ships bundled (`bundleCEF: true`),
   so no system Chromium dependency is needed.

### npm packages (for producers and library consumers)

[`@roadraven/core`](https://www.npmjs.com/package/@roadraven/core) — Zod
schemas + types. Use this if you're building an Event Producer:

```bash
npm install @roadraven/core
```

[`@roadraven/plugin-claude-code`](https://www.npmjs.com/package/@roadraven/plugin-claude-code)
— MCP wrapper that lets Claude Code push live status updates:

```bash
npx -y @roadraven/plugin-claude-code
```

See the [plugin authoring guide](https://shuffzord.github.io/RoadRaven/plugin-authoring.html)
for the full Event API contract.

---

## Feature status

| What | v1.0 (this release) | v1.1 (planned) |
|------|--------------------|----------------|
| Tree canvas + keyboard editor | available | — |
| Themes (dark / light / high-contrast) | available | — |
| Side-panel CodeMirror notes + metadata | available | — |
| Atomic autosave + `$ref` write-back | available | — |
| Event API (WebSocket — external producers push status) | available | — |
| `@roadraven/plugin-claude-code` (Claude Code MCP wrapper) | available | — |
| Windows installer | available | — |
| Linux installer (`.tar.gz`) | available | — |
| macOS installer | deferred | planned |
| Canary release channel | deferred | planned |
| Code signing (Authenticode / GPG / notarization) | deferred | planned (when commercial pressure justifies) |
| `.deb` packaging + apt repo | deferred | possibly |
| `@roadraven/react` component package | deferred | planned |
| Smart-adapter Plugin System (`RoadmapPlugin`) | deferred | planned |
| Drag-and-drop reordering | deferred | planned |
| Undo / redo | deferred | planned |

See [`.planning/REQUIREMENTS.md`](./.planning/REQUIREMENTS.md) for the
complete v1 vs. v2 requirement breakdown.

---

## Documentation

Published at https://shuffzord.github.io/RoadRaven/

- [Architecture overview](https://shuffzord.github.io/RoadRaven/architecture-overview.html)
- [Development guide](https://shuffzord.github.io/RoadRaven/development-guide.html)
- [RPC and IPC reference](https://shuffzord.github.io/RoadRaven/rpc-and-ipc.html)
- [Design system](https://shuffzord.github.io/RoadRaven/design-system.html)
- [Logging](https://shuffzord.github.io/RoadRaven/logging.html)
- [**Plugin authoring guide**](https://shuffzord.github.io/RoadRaven/plugin-authoring.html) — write your own Event Producer

---

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for local setup, test commands,
code style, and project conventions. Bug reports + feature requests via
[GitHub Issues](https://github.com/Shuffzord/RoadRaven/issues).

---

## Features

- **Tree canvas** rendered with react-d3-tree, custom node cards, TB / LR layouts, fit-view, zoom, pan.
- **Keyboard-first editing**
  - Inline rename: `F2` or double-click a node card
  - Add child / sibling: `Enter`, `Tab`, `Shift+Enter`
  - Delete with confirmation dialog for non-leaf nodes (`Del` / `Backspace`)
  - Duplicate / copy / paste node + subtree: `Ctrl+D`, `Ctrl+C`, `Ctrl+V` (context-aware vs. text inputs)
  - Reorder siblings: `Ctrl+↑` / `Ctrl+↓`
  - Arrow navigation adapts to layout: in TB, `←/→` moves siblings, `↓` enters child, `↑` returns to parent; in LR, `↑/↓` moves siblings, `→` enters child, `←` returns to parent.
- **Right-click context menu** (Radix-based, all platforms) — rename, add, duplicate, move, delete, plus canvas-empty actions.
- **Side panel editor** — click the title, click the pencil `[E]` button, or press `e` while the panel is open to enter edit mode. Editable title, status / type dropdowns (with freeform fallback), key-value metadata table, and a CodeMirror 6 markdown notes editor with `Edit | Preview | Split` toggle. A small `✓ saved` flash appears next to each field for 2s after each commit.
- **Autosave** — debounced flush after edits (1s for in-place changes like notes/status, 2s for structural changes like add/delete/rename), 30s periodic safety sweep, atomic temp+rename writes, and per-file `refMap` so `$ref` subtrees are written back to their source files. A `SaveIndicator` lives in the StatusBar; on the third consecutive save failure a `SaveFailureModal` opens with `Retry / Save As / Dismiss`.
- **Themes** — dark (default), light, high-contrast, plus per-schema status colour and node shape overrides.
- **Live integration ready** — RPC contract has `nodeStatusUpdate`, `integrationEvent`, and `pushFileChanged` messages; plugin host comes in a later phase.

## Quick start (development)

```bash
bun install           # Install dependencies
bun run dev:hmr       # Vite HMR + Electrobun (recommended)
bun run start         # One-shot: vite build then electrobun dev
bun run build:canary  # Production build
```

To edit: open a roadmap JSON (Welcome screen → recent files / sample, or the `Open` button), select a node, then press `e` or click the `[E]` pencil to enter edit mode. Changes autosave to disk.

```bash
bunx vitest run                                              # Tests (CI mode)
bunx @biomejs/biome lint packages/desktop/src/ shared/       # Lint
bunx vite build --root packages/desktop                      # Production build check
```

## Project structure

```
RoadRaven/
├── shared/types.ts          # RPC type contract (single source of truth)
├── packages/
│   ├── core/                # @roadraven/core — Zod schemas, framework-agnostic
│   └── desktop/             # @roadraven/desktop — Electrobun app
│       ├── src/bun/         # Main process: file I/O, atomic writes, refMap, settings, logging
│       └── src/mainview/    # Webview: React 19, Zustand, react-d3-tree, CodeMirror 6
├── samples/                 # Sample roadmap JSON files
├── docs/                    # Developer documentation
└── .planning/               # Project planning artefacts (orchestrator-managed)
```

See [`docs/`](./docs) for the architecture overview, design system, RPC contract, logging, and developer workflow.

## Electrobun

This is **Electrobun**, not Electron — different runtime, different APIs.

- Bundled view URLs use `views://mainview/index.html`
- Main-process imports: `import { BrowserWindow, Updater } from "electrobun/bun"`
- Renderer imports: `import { Electroview } from "electrobun/view"`

Use `bun` and `bunx` for everything. Do not use `npm`, `npx`, `yarn`, or `pnpm`.

- Quick start: https://blackboard.sh/electrobun/docs/guides/quick-start/
- Source: https://github.com/blackboardsh/electrobun
- LLM-friendly API ref: https://blackboard.sh/electrobun/llms.txt
