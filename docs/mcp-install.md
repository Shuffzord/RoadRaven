---
title: MCP Install Guide
nav_order: 8
layout: default
---

# Connect an MCP host to RoadRaven

> **Requires Node.js >= 22** for every install path below that runs `npx -y
> @roadraven/mcp` (the package ships as a published npm binary, `roadraven-mcp`).
> The RoadRaven desktop app must also be running — every tool call talks to it
> over the local Event API (`127.0.0.1`); with the app closed, tools return
> `app_not_running`.

Pick the section for your MCP host below. If you'd rather skip all of this,
use the built-in Setup Wizard instead — see the main
[README](https://github.com/Shuffzord/RoadRaven#connect-an-mcp-host): launch
RoadRaven, it detects Claude Code and OpenCode, and registers both with one
click, no commands needed.

## Claude Code

**Plugin (recommended).** From inside Claude Code:

```
/plugin marketplace add Shuffzord/RoadRaven
/plugin install roadraven@roadraven
```

**CLI one-liner.**

```bash
claude mcp add roadraven -- npx -y @roadraven/mcp
```

**Raw config.** Add this to `~/.claude.json` (or a project's `.mcp.json`) by hand:

```json
{
  "mcpServers": {
    "roadraven": {
      "command": "npx",
      "args": ["-y", "@roadraven/mcp"]
    }
  }
}
```

## OpenCode

**CLI (interactive).**

```bash
opencode mcp add roadraven
```

Follow the prompts and give it the command `npx -y @roadraven/mcp`.

**Raw config.** OpenCode uses the `mcp` key (not `mcpServers`) and a `command`
array (not a `command` / `args` split). Add this to
`~/.config/opencode/opencode.json`:

```json
{
  "mcp": {
    "roadraven": {
      "type": "local",
      "command": ["npx", "-y", "@roadraven/mcp"],
      "enabled": true
    }
  }
}
```

## Any other MCP host (Cursor, Codex, Copilot, Gemini, ...)

Any host that speaks the standard MCP stdio transport can run the same
command:

```json
{
  "command": "npx",
  "args": ["-y", "@roadraven/mcp"]
}
```

Consult your host's docs for where that block goes — most read a
`mcpServers` map keyed by server name (`roadraven` is a good default), the
same shape as the Claude Code raw config above.

## Full tool catalog

For the complete tool list, configuration, kill-switch, and security model,
see [`plugins/claude-code/README.md`](https://github.com/Shuffzord/RoadRaven/tree/master/plugins/claude-code).
