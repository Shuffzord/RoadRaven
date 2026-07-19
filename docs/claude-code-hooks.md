---
title: Claude Code Hooks
nav_order: 8
layout: default
---

# Claude Code hooks with `roadraven-notify`

`roadraven-notify` is a one-shot CLI that pushes a single status update to a
running RoadRaven app — built for [Claude Code hooks](https://docs.anthropic.com/en/docs/claude-code/hooks),
where a long-lived MCP connection is overkill. It ships in the
[`@roadraven/plugin-claude-code`](https://www.npmjs.com/package/@roadraven/plugin-claude-code)
npm package alongside the `roadraven-mcp` server:

```bash
npm install -g @roadraven/plugin-claude-code   # or: bunx roadraven-notify ...
```

## Usage

```
roadraven-notify <nodeId> <status> [--meta k=v ...] [--source name]
```

- `nodeId` must exist in the roadmap currently open in the app (events for
  unknown nodes are logged as `unknown_node` and dropped).
- `status` must be a status id from that roadmap's `statusConfig`
  (otherwise logged as `invalid_status` and dropped).
- `--meta k=v` may repeat; pairs are sent as the event's `meta` object.
- `--source` defaults to `claude-code-hook`.

It finds the app via the sentinel file (falling back to scanning ports
47921–47930) and gives up after **~2 seconds** — a hook never hangs on a
closed app. Exit codes: `0` delivered (no output), `1` app not reachable
(one line on stderr), `2` bad arguments (usage on stderr).

## Hook examples

Add to `.claude/settings.json` (or `~/.claude/settings.json`). Mark a node
in-progress after every file edit, stamping the current branch and commit:

```json
{
	"hooks": {
		"PostToolUse": [
			{
				"matcher": "Edit|Write",
				"hooks": [
					{
						"type": "command",
						"command": "roadraven-notify my-node-id in-progress --meta branch=$(git branch --show-current) --meta commit=$(git rev-parse --short HEAD)"
					}
				]
			}
		]
	}
}
```

Mark the node done when Claude finishes responding:

```json
{
	"hooks": {
		"Stop": [
			{
				"hooks": [
					{
						"type": "command",
						"command": "roadraven-notify my-node-id done --meta branch=$(git branch --show-current) --meta commit=$(git rev-parse --short HEAD)"
					}
				]
			}
		]
	}
}
```

Replace `my-node-id` with a real node id from your open roadmap, and
`in-progress` / `done` with status ids from its `statusConfig`. Because the
CLI exits `1` quietly when the app is closed, the hooks are safe to leave
enabled permanently.
