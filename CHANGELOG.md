# Changelog

All notable changes to RoadRaven are documented in this file. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [0.8.0] - 2026-09-23

First stable 0.8 release; everything from 0.8.0-beta.1 below, plus:

### Added

- **One-line installers.** Linux:
  `curl -fsSL https://raw.githubusercontent.com/Shuffzord/RoadRaven/master/install.sh | sh`;
  Windows:
  `irm https://raw.githubusercontent.com/Shuffzord/RoadRaven/master/install.ps1 | iex`.
  Both download the latest release, verify it against the release's
  `SHA256SUMS`, and refuse to install on a checksum mismatch.
- Releases ship a `SHA256SUMS` asset and GitHub build attestations
  (`gh attestation verify <file> --repo Shuffzord/RoadRaven`).
- `@roadraven/mcp` is published on npm, so the Claude Code marketplace plugin
  and the `npx -y @roadraven/mcp@0.8.0` one-liner work.
- The version-mismatch toast now tells you how to fix it for the way the
  server was installed (Setup Wizard, Claude Code plugin, or npm), with a
  **Copy** button where there is a command to run. A wizard-installed server
  is updated automatically at app startup.

### Changed

- **Windows uses the system WebView2** instead of bundling CEF: the Windows
  installer drops from ~260 MB to ~18 MB.
- **App identifier is now `io.github.shuffzord.roadraven`** (was the
  Electrobun template default `RoadRaven.electrobun.dev`). New installs land
  in `%LOCALAPPDATA%\io.github.shuffzord.roadraven\stable`
  (Linux: `~/.local/share/io.github.shuffzord.roadraven/`). Settings, recent
  files and backups stay in `%LOCALAPPDATA%\RoadRaven` and carry over.
  **Upgrading from v0.6:** the old install in
  `%LOCALAPPDATA%\RoadRaven.electrobun.dev\` and its Start-menu shortcut are
  not removed (v0.6 had no uninstaller) — delete them by hand.
- `bun install` is required for development; `npm`/`pnpm`/`yarn install` are
  rejected with an explanatory error.

## [0.8.0-beta.1] - 2026-09-20

### Added

- Setup Wizard now detects and registers **OpenCode** alongside Claude Code,
  with a checkbox per detected host. Registers into
  `~/.config/opencode/opencode.json` (`mcp` key, `command` as an array),
  distinct from Claude Code's `~/.claude.json` (`mcpServers`, split
  `command`/`args`).
- The wizard **defers to the RoadRaven Claude Code plugin** for Claude Code
  when it's already installed, instead of registering a second server — two
  installs would mean two running server processes and a duplicated,
  differently-namespaced tool set.
- RoadRaven ships as a **Claude Code marketplace plugin**:
  `/plugin marketplace add Shuffzord/RoadRaven` then
  `/plugin install roadraven@roadraven`.
- The app now reads the connected MCP server's real version from its hello
  frame and warns on a `major.minor` mismatch with the app's own version.

### Changed

- **Migrated from Electrobun 1.18.1 to 2.0.1.** The main process now runs on
  **Cottontail** (2.x's default main-process runtime). The toolchain is
  Hutch-projected into a gitignored `.hutch/devkit`, created automatically by
  a new root `postinstall` (`electrobun prepare`) so a clean checkout has a
  working build without a manual step.
- Electrobun touchpoints isolated behind an adapter seam
  (`src/bun/platform/{window,lifecycle,updater,dialogs,notifications}.ts`)
  ahead of the migration, so the version swap touched five small files
  instead of scattered call sites across the main process.
- `tsconfig.json` maps the two Electrobun path specifiers
  (`electrobun/bun`, `electrobun/view`) explicitly instead of extending the
  devkit's own tsconfig, avoiding a TypeScript 6 error on the devkit's
  `baseUrl`.
- Renamed the npm package **`@roadraven/plugin-claude-code` → `@roadraven/mcp`**
  — the server speaks plain MCP over WebSocket and serves any host, not just
  Claude Code.
- `bump-version.ts` now also rewrites the plugin manifest, the marketplace
  entry, and the pinned `@roadraven/mcp` version in the plugin's `.mcp.json`,
  so a release can't leave the plugin pointing at a stale published version.
- `index.ts` (696 lines, all RPC handlers plus window/event-server/updater
  wiring) decomposed into per-domain RPC modules under
  `rpc/{file,dialog,setup,eventApi}Rpc.ts` — mechanical move, no behavior
  change.
- Release artifact naming updated for Electrobun 2.x, which drops the
  channel prefix from installer wrappers (`win-x64-RoadRaven-Setup.zip`, not
  `stable-win-x64-...`); the updater triplet (`update.json`, `.tar.zst`,
  `.patch`) keeps its `stable-<os>-<arch>-` prefix so 1.x clients can still
  consume a 2.0 release.
- Root `vitest.config.ts` now delegates to each workspace's own config via
  `test.projects` instead of falling back to Vitest's default recursive
  glob, which had been sweeping up 78 unrelated test files from the
  projected devkit.

### Fixed

- A race where an MCP client reconnecting from an earlier session (e.g. a
  leftover server process) could hit the Event API port before `mainWindow`
  existed, crashing the main process with `"undefined is not an object
  (evaluating 'mainWindow.webview')"`. The event-server push callbacks now
  guard on `mainWindow` and drop the fire-and-forget notification instead of
  dereferencing a window that isn't there yet.
- The release workflow's artifact upload glob (`stable-win-x64-*.zip`) no
  longer matched Electrobun 2.x's installer filenames, which would have
  published a GitHub release with **no installer attached** — silently,
  since `upload-artifact` only fails when every pattern in a step matches
  nothing, and the tarball/manifest globs still hit.
- The MCP server's reported version was hardcoded to `0.1.0` regardless of
  the package's actual version; it now reads from `package.json`.
