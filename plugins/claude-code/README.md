# @roadraven/plugin-claude-code

MCP wrapper that lets Claude Code push node status updates to a running RoadRaven
app via its WebSocket Event API.

## Install (recommended)

```bash
# Run as a one-shot via npx — no install needed
npx -y @roadraven/plugin-claude-code

# Or install globally
npm install -g @roadraven/plugin-claude-code
roadraven-mcp
```

Then register with Claude Code (see "Register with Claude Code" below); use
`roadraven-mcp` as the command instead of an absolute path to a local build.

## Build (from source)

```sh
bun install
bun run --cwd plugins/claude-code build
```

Produces `dist/index.js` — a Node-compatible bundle with a shebang, runnable as a
binary via `node dist/index.js` or directly as `./dist/index.js` after `chmod +x`.

## Register with Claude Code

Add to your Claude Code MCP servers config (location varies by host; for Claude Code
desktop, see Settings → MCP pane):

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

Or, if you installed from npm globally:

```json
{
  "mcpServers": {
    "roadraven": {
      "command": "roadraven-mcp"
    }
  }
}
```

## How it works

1. Start the RoadRaven desktop app.
2. The app binds its Event API server on `ws://127.0.0.1:47921` (or a fallback port)
   and writes `<userData>/event-api.json` with the URL + pid.
3. This wrapper reads that sentinel file to auto-discover the URL and connects.
4. Claude invokes the `updateNodeStatus` tool; the wrapper pushes the event over
   WebSocket; the roadmap node badge re-renders live.

If the app isn't running, the wrapper returns a clear error — no queueing
(per D-28; producer-side buffering is a v1.1 concern).

## Tools

- `updateNodeStatus({ nodeId, status, meta? })` — push a status update to a node.
  `nodeId` must match a node UUID in the loaded roadmap. `status` must be a valid
  status id from the roadmap's `statusConfig`. `meta` is optional arbitrary metadata
  (e.g. `{ branch, commit, ci_run_id }`).

- `getEventApiStatus()` — introspect the current Event API connection: returns port,
  pid, and startedAt from the sentinel file, or an error if the app is not running.

## Error messages

| Condition | Message |
|-----------|---------|
| App not running | `Roadmap Viewer is not running. Start the app and retry.` |
| App running, WS unreachable | `Roadmap Viewer is running but the Event API is unreachable at {url}. Check the logs for startup errors.` |
| Success | (silent — tool returns `ok`) |

## Troubleshooting

- Make sure RoadRaven is running before invoking the tool.
- Check the app's log file (platform log dir shown in the app status bar) if the
  Event API is unreachable despite the app being open.
- The wrapper retries the sentinel file read up to 6 times (500ms apart, 3s total)
  to handle the race condition when the app is still starting up.
