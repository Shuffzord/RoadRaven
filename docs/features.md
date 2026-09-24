---
title: Features
nav_order: 4
layout: default
---

# Features (v0.8)

The full feature list and keyboard reference. For a short overview see the
[README](https://github.com/Shuffzord/RoadRaven#readme).


- **Tree canvas** rendered with react-d3-tree, custom node cards, TB / LR layouts, fit-view, zoom, pan.
- **Layout knobs** — a popover next to the TB/LR toggle sets sibling gap, depth gap and card density (comfortable / compact), applied live and remembered per file alongside the layout orientation.
- **Custom layout** — tick "Custom layout" in the same popover to drag cards anywhere on the canvas; connectors follow. Positions are remembered per file and per orientation (TB and LR each keep their own), unticking snaps cards back to the automatic layout without forgetting them, and "Reset positions" clears them. View state only: the roadmap file and agents never see positions.
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
- **File management**
  - `File` menu in the top bar: New `Ctrl+N`, Open… `Ctrl+O`, Open Recent ▸, Save `Ctrl+S`, Save As… `Ctrl+Shift+S`, Reveal in Folder, Copy Path, Close File (`⌘` on macOS). `Ctrl+B` toggles the sidebar, `Ctrl+,` opens Preferences.
  - Document chip in the top-bar centre: file name + save-state dot, full path and linked `$ref` files in the tooltip; the OS window title mirrors the open file.
  - Preferences dialog (cog or `Ctrl+,`): theme (Edit… / Duplicate / Import / Open themes folder), reopen last file on launch, Event API port, Agent API toggle, Integrations wizard, About.
  - **Files** sidebar: recent files with a right-click menu (Open / Reveal in Folder / Remove / Clear) and an **Outline** navigator of the open roadmap — click a row to reveal the node on the canvas, arrow keys to move around it.
  - New and the samples open as untitled; you are asked where to save after the first edit, and a Discard-changes dialog guards unsaved untitled edits on New / Open / Close / quit.
- **Themes** — eight built-in (Amber is the default; Dark, Light, High Contrast, Paper, Contrast, Slate, Moss), every one gated on WCAG 2.x contrast in CI. Your own themes are JSON files in the app's `themes` folder: Preferences → Duplicate current theme… / Import theme file… / Open themes folder, hot-reloaded on save, and an in-app **theme editor** (Preferences → Theme → Edit…) that paints the canvas live with a pass / warn / fail contrast chip per colour and a one-click Suggest fix. See [`docs/design-system.md`](docs/design-system.md).
- **Live integration ready** — RPC contract has `nodeStatusUpdate`, `integrationEvent`, and `pushFileChanged` messages; plugin host comes in a later phase.

