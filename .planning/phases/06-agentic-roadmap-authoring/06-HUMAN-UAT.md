# Phase 6 — Human UAT

**Plan:** 06-06
**Phase:** 06-agentic-roadmap-authoring
**Status:** Awaiting tester sign-off

The functional implementation is complete (Plans 06-01..06-05): 19 MCP tools register and route through the full transport, gate, and dispatch chain; one E2E connectivity test (`plugins/claude-code/tests/scaffold.e2e.test.ts`) proves the layers wire together. This UAT walks the same chain through a real Claude Code session against a running desktop app to validate the named user story and each safety gate end-to-end.

---

## Pre-flight

1. **Build the plugin**

   ```bash
   bun install
   bun run --cwd plugins/claude-code build
   ```

   Produces `plugins/claude-code/dist/index.js` (Node-compatible, runnable as `node dist/index.js`).

2. **Start the desktop app**

   ```bash
   bun run dev:hmr
   ```

   Confirm the canvas opens and the status bar shows the Event API URL (e.g., `ws://127.0.0.1:47921`).

3. **Configure Claude Code to use the local build**

   Add to your Claude Code MCP servers config:

   ```json
   {
     "mcpServers": {
       "roadraven": {
         "command": "node",
         "args": ["C:/Work/RoadRaven/plugins/claude-code/dist/index.js"]
       }
     }
   }
   ```

   Restart Claude Code if it was already running. The MCP host should list 19 `roadraven_*` tools.

4. **Open a test roadmap** (Scenarios 3 and 4 need a real file)

   Either open the bundled `examples/sample-roadmap.json` or create one in a writable directory like `/tmp/test/roadmap.json`.

---

## Scenario 1 — The named user story (CORE)

In a Claude Code session, ask:

> Scaffold a roadmap for migrating service X from MySQL to Postgres.

**Expected:**

- Claude calls `createRoadmap` then a sequence of `createNode` calls.
- The canvas in the desktop app shows the tree assembling node-by-node.
- After ~2 seconds of inactivity, autosave fires (saved indicator in status bar).
- Open Ctrl+Shift+L: the drawer shows one `claude-code` row per agent call, with the tool name and args visible.
- Quit and reopen the file — the assembled tree persists.

**Pass criteria:** All of the above occur without errors.

---

## Scenario 2 — Kill-switch

1. Locate the app's `settings.json` in the platform userData directory:
   - Windows: `%LOCALAPPDATA%\RoadRaven\settings.json` (e.g. `C:\Users\<you>\AppData\Local\RoadRaven\settings.json`)
   - macOS: `~/Library/Application Support/RoadRaven/settings.json`
   - Linux: `~/.config/RoadRaven/settings.json` (or `$XDG_CONFIG_HOME/RoadRaven/settings.json`)
2. Edit the file, adding or modifying:

   ```json
   {
     "agentApi": {
       "enabled": false
     }
   }
   ```

3. Save the file. (No app restart needed — the setting is hot-loaded.)
4. From a Claude Code session, call any tool (e.g., ask Claude to "list the nodes in the current roadmap" so it calls `getRoadmap`).

**Expected:** Tool returns `Error (agent_api_disabled): Agent API is disabled in application settings.` The MCP host shows the error message; no mutation reaches the canvas.

5. After confirming, set `agentApi.enabled` back to `true` (or remove the field) so the remaining scenarios work.

---

## Scenario 3 — Path-allowlist denial

Pre-condition: a roadmap is loaded from a known directory (e.g., `/tmp/test/roadmap.json`).

1. Ask Claude to `openFile` at a path outside the allowlist, e.g., `/etc/passwd` (Linux/Mac) or `C:/Windows/System32/drivers/etc/hosts` (Windows).
2. **Expected:** `Error (path_not_permitted): Path is outside the permitted directory.`
3. Ask Claude to `saveFileAs` at `/tmp/test/copy.json` (or `<loaded-dir>/copy.json`).
4. **Expected:** Succeeds (within the loaded directory).

---

## Scenario 4 — Cascade gate

Pre-condition: a roadmap with at least one non-leaf node that has 3 or more children.

1. Pick a non-leaf node (note its title).
2. Ask Claude to `deleteNode` on that node WITHOUT `cascade: true`.
3. **Expected:** `Error (cascade_required): Node has N children. Pass cascade:true to delete subtree.` (where `N >= 3`).
4. Ask Claude to retry with `cascade: true`.
5. **Expected:** Succeeds; the node and its subtree disappear from the canvas.

---

## Scenario 5 — Cycle prevention

Pre-condition: a roadmap with at least one non-root node `X` that has at least one child `Y`.

1. Ask Claude to `moveNode(X, Y)` (move `X` under its own descendant). Provide both UUIDs explicitly so Claude doesn't second-guess.
2. **Expected:** `Error (move_would_create_cycle): Cannot move a node into its own subtree.`

---

## Scenario 6 — Last-root protection

1. Open (or create) a roadmap with exactly one root node.
2. Ask Claude to `deleteNode` on that root with `cascade: true`.
3. **Expected:** `Error (cannot_delete_last_root): Cannot delete the last root node.`

---

## Scenario 7 — Drawer audit visibility

1. Run Scenario 1 to completion (or any sequence with at least 3 mutating tool calls).
2. Open Ctrl+Shift+L (or use the View menu) to reveal the event-log drawer.
3. **Expected:**
   - Each agent call appears as a row.
   - `source` column = `claude-code`; the row label reads `Claude → <toolName>` (e.g., `Claude → createNode`).
   - Click a row → the canvas selects the affected node and animates camera-follow.
   - The drawer's filter bar lets you filter by `source = claude-code`.

---

## Sign-off

- [ ] Scenario 1 passed
- [ ] Scenario 2 passed
- [ ] Scenario 3 passed
- [ ] Scenario 4 passed
- [ ] Scenario 5 passed
- [ ] Scenario 6 passed
- [ ] Scenario 7 passed

**Tester:** ____________________
**Date:** ____________________
**Notes:**

<!--
If any scenario fails, document:
  - which scenario, what was expected vs. observed
  - whether to gap-close in a 06-07-PLAN (real bug) or accept (environmental — e.g., plugin not built)
  - resume the orchestrator only after the failure is resolved or accepted
-->
