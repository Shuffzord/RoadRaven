# Changelog

All notable changes to RoadRaven are documented in this file. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [0.8.5] - Unreleased

### Added

- **In-app updates.** Installed stable and canary builds check for a newer
  version about 10 seconds after launch and ask before downloading it.
  Once it is downloaded, Preferences › About shows the update and a
  **Restart to update** button, and a status-bar pill says "Update ready".
  Restarting flushes unsaved work first and prompts to save an untitled
  roadmap, same as closing the app. A **Check for updates when RoadRaven
  starts** preference turns off the launch check; dev builds never update.
- Themed screenshot tooling for the docs (`bun run screenshots:cfa`):
  captures the CFA sample roadmap in every built-in theme and generates a
  collage from the set.

### Changed

- The log file is rotated, not truncated, on launch: an existing
  `roadraven.log` is renamed to `roadraven.log.1` (overwriting an older
  `.1`) before the new session's writer opens, so a relaunch — including an
  in-app update's restart — no longer erases the log of the session that
  just ran.

### Fixed

- The release pipeline now verifies the previous GitHub Release has its
  update manifest before building, so delta patches are generated reliably
  instead of silently falling back to a full-bundle-only update when the
  release was published ahead of the build jobs.

## [0.8.4] - 2026-09-24

### Added

- **Status at a glance.** Every node card carries a small diagonal ribbon
  across its top-right corner in its status colour, next to the stripe it
  already had. **In Progress** cards are a little larger, with a coloured
  border and ring. Every node with children says how far along it is
  (`2 / 5 done`), and an In Progress leaf that Claude Code just touched
  says `last event 12s ago`. A node's **type** now shows as a small chip beside the status
  badge.
- **Layout knobs.** A new button next to the TB / LR toggle opens three
  per-file controls: sibling gap, depth gap and card density (comfortable
  or compact). They apply as you drag the slider and are remembered for
  that file.
- **Custom layout.** Tick **Custom layout** in the same popover and cards
  become draggable: move a card, its connectors follow, and the position is
  remembered for that file and that orientation. Untick to snap back to
  the automatic layout without losing the positions; **Reset positions**
  clears them. None of this is written into the roadmap file, so agents
  and the MCP tools keep working with the plain tree.
- **Collapse that stays collapsed.** Collapsing a subtree now survives
  adding, deleting, moving and pasting nodes, and reopening the file. The
  empty-canvas right-click menu gains **Expand all**, **Collapse all**,
  **Collapse to depth 1** and **Collapse to depth 2**.
- **More keyboard editing.** `Alt+↓` (TB) / `Alt+→` (LR) indents the
  focused node under its previous sibling; `Alt+↑` / `Alt+←` outdents it
  to sit after its parent. Both are in the node's right-click menu too,
  with their shortcuts shown for the current layout.
  Keys `1` `2` `3` `4` set Not Started, In Progress, Completed, Blocked.
- **Undo and redo.** `Ctrl+Z` undoes your last edit, `Ctrl+Y` or
  `Ctrl+Shift+Z` redoes it, up to 50 steps. Typing in the notes editor
  counts as one step. Edits made by an agent over MCP are not undone —
  only yours.

### Changed

- **Reorder follows the layout.** In TB, `Ctrl+←` / `Ctrl+→` move a node
  before or after its neighbour, matching how `←` / `→` navigate. The old
  `Ctrl+↑` / `Ctrl+↓` pair still works in both layouts.
- The layout orientation you pick for a file is restored when that file
  opens again. It was saved before but never read back.
- Opening a different file no longer carries over the previous file's view
  settings.
- The default layout is roomier: sibling cards sit a little further apart
  and levels are further apart, so the tree reads more clearly. Files that
  already saved their own layout knobs keep them.
- react-d3-tree 3.6.6 → 3.6.7 (maintenance release).

### Fixed

- A file's per-file settings could be partly overwritten when one setting
  was saved (a layout toggle dropped the file's other stored settings).

## [0.8.3] - 2026-09-23

### Added

- **Your own themes.** A theme is now a small JSON file, and RoadRaven keeps
  yours in its own themes folder. In Preferences → Theme: **Duplicate
  current theme…** writes a copy of whatever you are looking at and switches
  to it, **Import theme file…** brings in a file someone sent you, and
  **Open themes folder** shows you where they live. Edit a file in any text
  editor and the app repaints as you save — no restart. Your themes appear
  in the theme picker under "Your themes"; a broken file gets a badge with
  the reason instead of breaking anything, and if the theme you had
  selected goes missing the app opens in Amber, says so once, and keeps
  your setting so restoring the file brings it back.
- **A theme editor** — Preferences → Theme → **Edit…**. It opens beside the
  canvas rather than over it, and the canvas *is* the preview: every colour
  you change repaints the real nodes, badges and menus as you type. Twelve
  colours are enough for a complete theme; **Advanced** exposes everything
  else with its automatically derived value shown until you override it.
  Next to each colour the editor lists every place that colour is read
  against another, with a live **pass / warn / fail** contrast check — the
  same rules the built-in themes are held to — and a one-click **Suggest
  fix** that nudges a failing colour until it passes. Changes save to the
  file automatically. **Hide** collapses the editor to a small pill so you
  can use the app with the theme applied; hold the eye button (or `Alt`) to
  peek at the canvas underneath. Built-in themes are read-only, so Edit… on
  one first makes a copy and edits that.
- **Deleting a theme you made.** In the theme picker, each entry under
  "Your themes" has a small **×** (shown when you hover the row or reach it
  with the keyboard — `Tab` from the row, or press `Delete` on it). It asks
  first, then removes the theme's file. Deleting the theme you are using
  switches you to Amber and remembers that, so the app does not go looking
  for the missing theme next time.
- **Contrast is now checked, not eyeballed.** Every built-in theme passes a
  WCAG 2.x contrast check twice in CI: once on its colour values and once
  on the rendered app in a real browser, so a stylesheet rule can no longer
  quietly override a readable colour. Theme authors get the same report
  from `bun run theme:lint`.

### Changed

- **Amber is the new default theme** on a fresh install and whenever a
  saved theme cannot be found. An existing saved preference is left alone.
- Slate's headings are a step heavier (semibold rather than medium) now
  that every theme's heading style comes from the same place.
- The lines connecting nodes are a little stronger in every theme, so the
  tree's structure still reads on a dim screen or a projector.
- The per-file `themeConfig` override (status colours and node shape set
  inside a roadmap file) has been removed. It was never wired up and never
  shipped as a working feature; a roadmap file that carries the key still
  opens and keeps it untouched. A file's `statusConfig` colours continue to
  work as before.

### Fixed

- **Contrast** and **Moss**: node titles were close to invisible on the
  white and cream cards. They are now dark on the card, while the rest of
  the interface keeps its light-on-dark text.
- **Contrast**: the Completed and Blocked status stripes were white on a
  white card — you could not tell which status a node had — and the Not
  started badge was too faint. Stripes and badges are readable now.
- **Light**: the Completed and In progress badges used pale green and pale
  blue on white; both are deeper now.
- **Moss**: menu, sidebar and status-bar text was a murky olive-grey that
  failed on every surface; it is cream now, and the theme's status inks and
  accent were retuned to match.
- **Paper**, **Amber**, **Slate**: the faintest text tier (section headings,
  shortcut hints, placeholder text) was too dim to read comfortably.
- **Dark**: the Not started badge was too dim.
- The theme picker's colour swatches are generated from the theme itself,
  so a swatch can no longer show a colour the theme stopped using (Light's
  did).

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
