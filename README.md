
# RoadRaven

[![License: PolyForm Noncommercial 1.0.0](https://img.shields.io/badge/License-PolyForm--Noncommercial--1.0.0-blue.svg)](./LICENSE)
[![Status: Alpha v0.8](https://img.shields.io/badge/status-alpha%20v0.8-orange.svg)](#feature-status)
[![Platform: Windows | Linux](https://img.shields.io/badge/platform-Windows%20%7C%20Linux-blue.svg)](#install)
[![Watch the demo](https://img.shields.io/badge/%E2%96%B6-Watch_the_demo-FF4500.svg)](#demo)


<img width="1920" height="1080" alt="brag" src="https://github.com/user-attachments/assets/7a5ee9e9-33b1-4bab-9dad-f680a36fdc21" />

**Your plan. Watching itself.**

A keyboard-first desktop editor for visual roadmap trees — backed by a plain JSON
file you own. Wire each node to something real (an AI agent, a CI pipeline, a local
script) and watch status update live over WebSocket. No sprints, no story points,
no cloud, no accounts. It's just a file, living in your repo.

> Built on **Electrobun** (not Electron). Runtime is **Bun**.

> ⚠️ **Alpha (v0.8.0-beta.1).** RoadRaven is an early public release. Core editing and
> the live Event API work today, but expect rough edges — the data format, APIs, and
> packaging may still change before v1.0. Bug reports and feedback are very welcome.

## Demo

How the tree looks like

![RoadRaven — navigate your project as a living tree: phases, plans, and tasks expand left-to-right with live status at every node](screenshots/tree.png)

Inspect any node in the side panel — status, type, metadata, markdown notes:

![RoadRaven Node Details side panel](screenshots/sidepanel-details.png)

🎬 **Watch the demo:**

https://user-images.githubusercontent.com/4171628/607591096-bc94a8c8-36c9-44dc-8cdb-6417437949b9.mp4

---

## Why RoadRaven

Imagine you have an idea. You sketch it as a tree, name the pieces, set your own
statuses — the plan is yours, with no opinions baked in. Then you connect each node
to whatever is actually running, and the tree keeps itself current.

- **🌳 Plan-as-file** — your roadmap is plain `roadmap.json`, living in your repo. Diffable, reviewable, yours. No database, no proprietary format.
- **📡 Live status from anything** — any process that can send a message updates a node. A GitHub Action finishes → the node turns green. Claude Code completes a task → the node updates. You don't touch a thing.
- **🤖 Built for agent supervision** — watch Claude Code work through your plan in real time via the [MCP integration](#connect-an-mcp-host).
- **🔒 Local-first** — binds to `127.0.0.1`, works air-gapped. Nothing leaves your machine. No accounts, no cloud, no subscription.
- **⌨️ Keyboard-first** — navigate and edit the entire tree without reaching for the mouse.
- **🎚️ Zero-opinion schema** — you define the statuses, types, and hierarchy. The app stays dumb; your tools do the talking.

---

## Install

> **This alpha (v0.8) ships Windows + Linux installers.** macOS is planned
> (see [Feature status](#feature-status) below).

Download the latest release from
[GitHub Releases](https://github.com/Shuffzord/RoadRaven/releases/latest).

### Windows

1. Download `stable-win-x64-RoadRaven-Setup.zip`.
2. Extract the `.zip`.
3. Double-click `RoadRaven-Setup.exe`.
4. **Windows SmartScreen will warn:** "Windows protected your PC."
   This is expected — RoadRaven ships unsigned in this alpha (no Authenticode
   certificate yet; code signing is planned for a later release). To install:
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

### Packages (for producers and library consumers)

> **Heads-up (v0.8.0-beta.1):** these npm packages are **not published yet**. When they
> are, `@roadraven/mcp` will go out as a **prerelease under the `beta` dist-tag**, so
> plain `latest` stays unclaimed at `0.8.0` until a stable release ships — a bare
> `bun add @roadraven/mcp` / `npx -y @roadraven/mcp` won't resolve anything until then.
> Pin the exact version once it's live, e.g. `@roadraven/mcp@0.8.0-beta.1`. For now,
> clone the repo and build from source. RoadRaven is **bun-first**, but these are plain
> npm packages, so any package manager works.

`@roadraven/core` — Zod schemas + types. Use this if you're building an Event Producer:

```bash
bun add @roadraven/core          # not published yet — see note above
```

`@roadraven/mcp` — the MCP wrapper that lets Claude Code (and any MCP
host) read, edit, and push live status updates to your roadmap. Until it's published,
build it locally — see [Connect an MCP host](#connect-an-mcp-host) below.

See the [plugin authoring guide](docs/plugin-authoring.md) for the full Event API contract.

---

## Connect an MCP host

**Why.** RoadRaven's headline use case is letting an AI agent author and maintain
your roadmap. `@roadraven/mcp` is an MCP server exposing **19 tools** so any MCP
host — Claude Code, OpenCode, and others — can create, edit, move, and delete
nodes, and push live status as it works. Your plan becomes something the agent
keeps current for you. Three ways to connect it, easiest first.

**Path 1 (easiest — the built-in Setup Wizard).** RoadRaven ships an MCP server
bundle inside the app. On first launch a **Setup Wizard** opens (re-openable any
time from the ⚙ button in the top bar). It detects installed hosts — Claude Code
and OpenCode — and registers both with one click:

1. copies the bundled MCP server into your user data directory, and
2. registers it in each detected host's config (`~/.claude.json` for Claude
   Code, `~/.config/opencode/opencode.json` for OpenCode) — without touching
   any other server you have configured.

If the RoadRaven Claude Code plugin (Path 2 below) is already installed, the
wizard defers to it for Claude Code instead of registering a second server —
two installs would mean two running server processes and a duplicated tool
set (plugin tools are namespaced `mcp__plugin_roadraven_roadraven__*`, the
wizard's `mcp__roadraven__*`).

Zero commands, works fully offline, **works today** — no npm publish needed.
Restart your MCP host with RoadRaven running and the tools are live.

**Path 2 (Claude Code plugin).** ⚠️ Not usable yet — the plugin's `.mcp.json`
runs `npx -y @roadraven/mcp@0.8.0-beta.1`, and `@roadraven/mcp` isn't
published to npm yet (see [Packages](#packages-for-producers-and-library-consumers)
above). Once it's published, install straight from this repo's marketplace,
from inside Claude Code:

```
/plugin marketplace add Shuffzord/RoadRaven
/plugin install roadraven@roadraven
```

**Path 3 (one-liner — any other host).** ⚠️ Same caveat — requires the npm
publish. Requires **Node.js >= 22**. Pin the exact prerelease version; a bare
`npx -y @roadraven/mcp` resolves `latest`, which won't exist while only betas
are published:

```bash
claude mcp add roadraven -- npx -y @roadraven/mcp@0.8.0-beta.1
```

```bash
opencode mcp add roadraven   # interactive — prompts for the command to run; give it `npx -y @roadraven/mcp@0.8.0-beta.1`
```

For Cursor, Codex, Copilot, Gemini, or another MCP host, see the
[MCP install guide](docs/mcp-install.md) for a generic stdio config block and
the raw JSON shapes for the hosts above.

**Fallback (build from source).** Prefer to wire it up yourself, or building
before a release is published:

```bash
git clone https://github.com/Shuffzord/RoadRaven.git
cd RoadRaven
bun install
bun run --cwd plugins/claude-code build   # produces plugins/claude-code/dist/index.js
```

Start the RoadRaven desktop app, then register the server with your MCP host, pointing
at the built file (use an absolute path). For Claude Code, add it to your MCP config:

```json
{
  "mcpServers": {
    "roadraven": {
      "command": "node",
      "args": ["/absolute/path/to/RoadRaven/plugins/claude-code/dist/index.js"]
    }
  }
}
```

> The desktop app **must be running** — the plugin talks to it over the local Event
> API (`127.0.0.1`). If the app is closed, every tool returns `app_not_running`.

Full tool catalog, configuration, kill-switch, and security model:
[`plugins/claude-code/README.md`](plugins/claude-code/README.md).

![Live event log — every Claude Code MCP tool call streams into a filterable feed over WebSocket](screenshots/events.png)

---

## Feature status

| What | v0.8 (this alpha) | Planned |
|------|-------------------|---------|
| Tree canvas + keyboard editor | available | — |
| Themes (dark / light / high-contrast) | available | — |
| Side-panel CodeMirror notes + metadata | available | — |
| Atomic autosave + `$ref` write-back | available | — |
| Event API (WebSocket — external producers push status) | available | — |
| MCP server version-mismatch warning | available | — |
| First-run Setup Wizard — one-click MCP install (Claude Code + OpenCode) | available | — |
| Claude Code marketplace plugin (`@roadraven/mcp`) | ships this release¹ | — |
| Windows installer | available | — |
| Linux installer (`.tar.gz`) | available | — |
| Electrobun 2.x runtime (Cottontail main process) | available | — |
| macOS installer | deferred | planned |
| Canary release channel | deferred | planned |
| Code signing (Authenticode / GPG / notarization) | deferred | planned (when commercial pressure justifies) |
| `.deb` packaging + apt repo | deferred | possibly |
| `@roadraven/react` component package | deferred | planned |
| Smart-adapter Plugin System (`RoadmapPlugin`) | deferred | planned |
| In-app self-update | deferred | planned — `Updater.checkForUpdate`/`downloadUpdate`/`applyUpdate` exist in the Electrobun SDK but aren't wired into the app yet |
| Drag-and-drop reordering | deferred | planned |
| Undo / redo | deferred | planned |

¹ `@roadraven/mcp` is not published to npm yet — see
[Packages](#packages-for-producers-and-library-consumers) above. The plugin
manifest and marketplace entry ship in this release, but installing them only
works once the npm publish lands; the Setup Wizard (bundled server, no
publish needed) works today.

See the [documentation](docs/) for more detail on current capabilities and
what's planned next.

---

## Documentation

Browse the docs in [`docs/`](docs/) — rendered right here on GitHub:

- [Architecture overview](docs/architecture-overview.md)
- [Development guide](docs/development-guide.md)
- [Design system](docs/design-system.md)
- [Logging](docs/logging.md)
- [**Plugin authoring guide**](docs/plugin-authoring.md) — write your own Event Producer

<!-- A Jekyll config (docs/_config.yml) is set up for a GitHub Pages site at
     https://shuffzord.github.io/RoadRaven/. It is NOT enabled yet, so those URLs
     404 — enable Pages (Settings → Pages → source: docs/ folder) to publish it,
     then these links can point at the .html site instead of the .md files. -->

---

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for local setup, test commands,
code style, and project conventions. Bug reports + feature requests via
[GitHub Issues](https://github.com/Shuffzord/RoadRaven/issues).

---

## A note from the creator

I built RoadRaven to scratch my own itch. When you're working on something with a
lot of moving parts, your plan and your actual work drift apart fast — the plan
lives in a doc or in your head, while the real state is scattered across terminals,
CI, and AI agents. The doc is out of date the moment you write it, and slowly turns
into fiction.

It started as a personal study- and project-tracker. The moment it clicked was
watching nodes flip status on their own as Claude Code worked through tasks — I
hadn't touched anything, I just opened the app and the current state was right
there. That's the whole idea: **your plan, watching itself.**

It's an alpha, and it's open source, because I'd love for it to be useful to more
than just me. If you have ideas, hit rough edges, or want a node to watch something
I haven't thought of yet — please open an [issue](https://github.com/Shuffzord/RoadRaven/issues)
or a PR. Contributions, feedback, and wild suggestions are all genuinely welcome.

— [Shuffzord](https://github.com/Shuffzord)

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
bun run verify        # Full check: tests + typecheck + build + lint (recommended)
bun run test          # Tests only
bun run test:lint     # Lint only
bun run test:build    # Production build check
```

> Use the `bun run` scripts rather than calling `bunx vitest` / `bunx vite`
> directly — the wrappers pin the workspace versions (see
> [CONTRIBUTING.md](./CONTRIBUTING.md) for the full workflow).

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
└── docs/                    # Developer documentation
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
