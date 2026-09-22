# Changelog

All notable changes to RoadRaven are documented in this file. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [0.8.2] - 2026-09-22

### Added

- A **File menu** in the top bar: New, Open…, Open Recent ▸, Save, Save As…,
  Reveal in Folder, Copy Path and Close File, with live enablement and
  shortcut hints. Shortcuts: `Ctrl+N` new, `Ctrl+O` open, `Ctrl+S` save now,
  `Ctrl+Shift+S` save as, `Ctrl+B` toggle the sidebar, `Ctrl+,` preferences
  (`⌘` on macOS). Save and Save As also work while a text field has the
  caret, so you can save from the notes editor.
- A **document chip** in the top-bar centre shows the open file's name with a
  save-state dot; its tooltip carries the full path and any linked (`$ref`)
  files, and clicking it opens the File menu. The OS window title mirrors the
  open file.
- **Preferences** behind the top-bar cog (or `Ctrl+,`): theme, "Reopen last
  roadmap on launch", the Event API WebSocket port (applies after restart),
  the Agent API on/off switch (immediate), an Integrations button that opens
  the setup wizard, and an About section with the app version and
  Documentation / Releases links.
- **Reopen last file on launch** — the most recent roadmap opens on start
  unless you switch it off in Preferences.
- An **Outline** section in the sidebar: an indented list of every node with
  its status dot. Click a row to select the node and reveal it on the canvas
  (collapsed ancestors expand and the side panel opens, as on a canvas
  click). Expand/collapse in the outline is independent of the canvas.
  `↑`/`↓`, `←`/`→`, `Home`/`End` and `Enter`/`Space` navigate it from the
  keyboard; a status tick from an integration re-renders only the changed
  row.
- A **context menu on recent files** (Open, Reveal in Folder, Remove from
  Recent, Clear Recent). The open file's row is highlighted, the list
  refreshes as soon as it changes, and a recent file that no longer exists
  is dropped from the list with a toast when you try to open it.
- A **Discard changes?** dialog guards unsaved edits in an untitled document
  when you choose New, Open, Close File, or close the window.
- The sidebar is **resizable**: drag its right edge (160–480 px), use the
  arrow keys on the handle, or double-click it to restore the default width.
  The width is remembered across launches.

### Changed

- The sidebar is now **Files**. Collapsed, its rail shows one icon per
  section (Recent Files, Outline) that expands the sidebar and scrolls to
  that section, instead of an unlabelled icon per recent file. The empty
  Preferences and Help buttons are gone; Preferences lives in the top bar.
- The footer shows status only (Event API status, save indicator, node
  count); the file name moved to the document chip.
- **New** and the **samples** open as untitled documents. The Save As dialog
  appears after the first real edit rather than the moment the document
  opens, so `File > New` no longer pops a native dialog immediately.
- **Save As** opens in the folder of the current file, writes the root file
  only, and warns when linked `$ref` files were merged into the standalone
  copy.
- Closing the window with unsaved untitled edits asks first. If the renderer
  does not answer within 3 seconds the window closes anyway.
- The app version has one source, `packages/desktop/package.json`; the main
  process, the Electrobun config and the renderer derive from it, and the
  footer shows the running version.
- Search matches node titles only by default; a toggle in the search box
  includes notes, and the choice is remembered.
- Deferred to a later release: drag-and-drop to open a file (the Electrobun
  2 view runtime exposes no path for dropped files) and a native application
  menu.

### Fixed

- The top-bar zoom buttons did nothing. Each press now steps the camera ×1.2
  about the centre of the canvas, clamped to the tree's zoom range.
- The recent-files list could go stale after Save As or Close File; it now
  refreshes after any change made from inside the app.

## [0.8.1] - 2026-09-22

### Added

- One-line Windows install (`irm … | iex`) that verifies the installer's
  checksum before running it.
- When the connected MCP server's version does not match the app's, the
  warning now shows how to fix it (pin `@roadraven/mcp` to the app version).
- CI runs the Playwright `ui` specs and typechecks the whole `tests/` folder
  on pull requests.

### Changed

- Canvas focus is real DOM focus with a roving `tabindex`: focus requests are
  explicit and reveal the node with DOM-measured scrolling, the canvas and
  side panel hand focus to each other (`F6`), and creating a node goes
  through one create-and-rename path that respects collapsed ancestors.
- One **Fit to View** implementation shared by every caller, instead of
  several slightly different ones.
- Canvas performance: node cards are memoised and context-menu state no
  longer lives in `Canvas`, so a status tick re-renders one card, not the
  tree. A 1.4k-node interaction probe guards this in the `ui` Playwright
  project.
- App identifier set to `io.github.shuffzord.roadraven`.

### Fixed

- The store's viewport now stays in sync with pan and zoom gestures, so Fit
  to View and focus reveals start from where the canvas actually is instead
  of a stale position.

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
