# @roadraven/plugin-claude-code

The reference MCP wrapper for the [Roadmap Viewer](https://github.com/Shuffzord/RoadRaven) desktop app. Exposes 19 MCP tools so any MCP-capable LLM (Claude Code first) can read, create, edit, move, delete, and persist roadmap nodes — turning the Roadmap Viewer into a substrate for agent-authored project plans.

## Installation

```bash
# Run as a one-shot via npx — no install needed
npx -y @roadraven/plugin-claude-code

# Or install globally
npm install -g @roadraven/plugin-claude-code
roadraven-mcp
```

The binary is `roadraven-mcp` (Phase 4 D-21 lockstep version).

## Configuration in Claude Code

Add to your Claude Code MCP servers config (location varies by host; for Claude Code desktop, see Settings → MCP pane):

```json
{
  "mcpServers": {
    "roadraven": {
      "command": "roadraven-mcp"
    }
  }
}
```

Or, if you are running the wrapper from a local build:

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

## Prerequisites

The Roadmap Viewer desktop app must be running. The plugin discovers the app via the sentinel file at the platform-equivalent userData location (`event-api.json`); if the app is not running, every tool returns the `app_not_running` error.

## Tool Catalog (19 tools)

### Read tools (6)

- `getRoadmap()` — Return the full schema tree with live-merged statuses (D-07 30s overlay window)
- `getNode({nodeId})` — Return a node + parentId + ancestorIds
- `findNodes({titleContains?, status?, type?, metaKey?, metaValue?, parentId?})` — AND-combined filter; `titleContains` is case-insensitive substring
- `getStatusConfig()` — Return the schema's `statusConfig` array
- `getTypeConfig()` — Return the schema's `typeConfig` array
- `getOpenFile()` — Return `filePath`, `isUntitled`, `title`, `nodeCount` (works even with no file loaded)

### Create tools (2)

- `createNode({parentId, title, type?, status?, notes?, metadata?})` — Add a child; returns the new UUID
- `createRoadmap({title?, statusConfig?, typeConfig?})` — Initialize an in-memory untitled schema (mirrors File > New)

### Update tools (6)

- `renameNode({nodeId, title})`
- `updateNodeStatus({nodeId, status, meta?})` — Phase 4 carry-forward; now writes a drawer-audit row through the agent dispatcher
- `updateNodeType({nodeId, type})`
- `updateNodeNotes({nodeId, notes})`
- `updateNodeMetadata({nodeId, patch})` — shallow PATCH; `null` for a key deletes it; unlisted keys are preserved
- `moveNode({nodeId, newParentId, position?})` — re-parent; blocks cycles + cross-`$ref`-boundary moves

### Delete tool (1)

- `deleteNode({nodeId, cascade?})` — leaf deletes immediately; non-leaf requires `cascade: true`

### File-lifecycle tools (3)

- `saveFile()` — flush pending autosave debounce
- `saveFileAs({path})` — save to a new path (allowlist-checked)
- `openFile({path})` — load a roadmap (auto-flushes pending changes first per D-12)

### Phase 4 carry-forward (1)

- `getEventApiStatus()` — return the Event API URL, PID, and `startedAt` from the sentinel file

## Error Taxonomy (13 codes)

Errors are returned as MCP `isError: true` results with `Error (<code>): <message>. <hint?>` text:

| Code | When |
|------|------|
| `app_not_running` | Sentinel missing — the desktop app is not running |
| `no_file_loaded` | App running but no roadmap loaded — call `openFile` or `createRoadmap` first |
| `node_not_found` | `nodeId` / `parentId` / `newParentId` does not exist in the loaded roadmap |
| `cascade_required` | `deleteNode` on a non-leaf without `cascade: true`; `data.childCount` tells you how many would be removed |
| `cannot_delete_last_root` | `deleteNode` would leave the schema with zero root nodes |
| `path_not_permitted` | `openFile`/`saveFileAs` path outside the allowlist (loaded directory or recently picked paths) |
| `cross_ref_boundary` | `moveNode` target parent is in a different `$ref` file (Phase 3 EDIT-16) |
| `move_would_create_cycle` | `moveNode` target parent is a descendant of the node being moved |
| `file_read_error` | `openFile` failed at the OS layer (file missing, permission denied) |
| `save_error` | `saveFile`/`saveFileAs` atomic write failed |
| `agent_api_disabled` | The user has set `agentApi.enabled: false` in their settings (kill-switch) |
| `unknown_tool` | The plugin sent a tool name the desktop app does not recognize (version mismatch) |
| `internal_error` | Unhandled exception — check the desktop app's logs |

## Kill-Switch

Users can disable the entire agent API while keeping the event-push API alive by editing their `.roadmap-settings.json`:

```json
{
  "agentApi": {
    "enabled": false
  }
}
```

When set to `false`, every tool returns `agent_api_disabled`. The setting is hot-loaded — no restart needed.

## Security Model

- **Localhost-only.** The Roadmap Viewer's WebSocket binds to `127.0.0.1`; the plugin connects to the same loopback. There is no auth handshake — same-machine trust is the boundary.
- **Path-traversal allowlist.** `openFile` and `saveFileAs` accept only paths within the loaded file's directory, or paths the user previously chose via the file picker (session-scoped allowlist; not persisted across app restarts).
- **No disk-direct writes.** All mutations route through the renderer's Zustand store and the existing autosave pipeline; the same atomic-write + retry guarantees as user edits apply.
- **Audit log.** Every mutating tool call writes a row into the event-log drawer (Ctrl+Shift+L in the desktop app) with `source: "claude-code"`, the tool name, and the args. The user has a durable record of what the agent did. The `source` field is hardcoded in the renderer — agents cannot spoof it.

## Concurrency Model

- **Last-write-wins.** No locks. If the user is typing in the side panel while the agent calls `renameNode` on the same node, the most recent write wins.
- **Eventual consistency on disk.** Tools return `ok` after the in-memory mutation lands. The Phase 3 autosave debounce (2s) batches multiple agent calls into a single atomic write. A 50-call scaffold typically results in one disk write 2s after the last call.
- **Single-agent assumption.** v1 supports one agent at a time per app instance; multi-agent coordination is out of scope.

## Tested Against

- MCP SDK 1.29.0+
- Claude Code (latest)
- Roadmap Viewer 1.0+

## Troubleshooting

- Make sure RoadRaven is running before invoking any tool.
- Check the app's log file (platform log dir shown in the app status bar) if the Event API is unreachable despite the app being open.
- The wrapper retries the sentinel file read up to 6 times (500 ms apart, 3 s total) to handle the race condition when the app is still starting up.
- If you see `agent_api_disabled`, check your `.roadmap-settings.json` — the kill-switch is on.

## License

MIT — see [LICENSE](./LICENSE).
