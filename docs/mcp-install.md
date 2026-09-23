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
>
> Every command below pins the exact version, `0.8.1`. Pin the version
> that matches your installed app: the app warns when the server's major.minor
> differs from its own (see [Version mismatch](#version-mismatch)).

Pick the section for your MCP host below. If you'd rather skip all of this,
use the built-in Setup Wizard instead — see the main
[README](https://github.com/Shuffzord/RoadRaven#connect-an-mcp-host): launch
RoadRaven, it detects Claude Code and OpenCode, and registers both with one
click, no commands needed. If the RoadRaven Claude Code plugin below is
already installed, the wizard defers to it for Claude Code rather than
registering a second server.

## Claude Code

**Plugin (recommended once published).** From inside Claude Code:

```
/plugin marketplace add Shuffzord/RoadRaven
/plugin install roadraven@roadraven
```

**CLI one-liner.** `-s user` registers it for every project, like the Setup
Wizard and the plugin do (`claude mcp add` defaults to the current project only):

```bash
claude mcp add -s user roadraven -- npx -y @roadraven/mcp@0.8.1
```

**Raw config.** Add this to `~/.claude.json` (or a project's `.mcp.json`) by hand:

```json
{
  "mcpServers": {
    "roadraven": {
      "command": "npx",
      "args": ["-y", "@roadraven/mcp@0.8.1"]
    }
  }
}
```

## OpenCode

**CLI (interactive).**

```bash
opencode mcp add roadraven
```

Follow the prompts and give it the command `npx -y @roadraven/mcp@0.8.1`.

**Raw config.** OpenCode uses the `mcp` key (not `mcpServers`) and a `command`
array (not a `command` / `args` split). Add this to
`~/.config/opencode/opencode.json`:

```json
{
  "mcp": {
    "roadraven": {
      "type": "local",
      "command": ["npx", "-y", "@roadraven/mcp@0.8.1"],
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
  "args": ["-y", "@roadraven/mcp@0.8.1"]
}
```

Consult your host's docs for where that block goes — most read a
`mcpServers` map keyed by server name (`roadraven` is a good default), the
same shape as the Claude Code raw config above.

## Version mismatch

When the MCP server connects, RoadRaven compares its version with the app's.
If the major.minor differs, a toast says so and tells you what to do; where
there is a command, it has a **Copy** button. The fix depends on how the
server was installed (the server reports this itself since v0.8):

- **Setup Wizard.** Nothing to reinstall: at startup RoadRaven updates its
  installed copy of the server
  (`%LOCALAPPDATA%\RoadRaven\mcp\roadraven-mcp.mjs` on Windows) to the one
  bundled with the app. Restart your agent session so it loads the new copy.
  If there's no wizard copy to update, re-run the Setup Wizard and install
  the integration.
- **Claude Code plugin.** Update the plugin, then restart Claude Code:

  ```
  claude plugin marketplace update roadraven; claude plugin update roadraven@roadraven
  ```

- **npm (`npx`).** Re-register the server pinned to the app's version (the
  toast fills it in), then restart your agent:

  ```
  claude mcp remove roadraven; claude mcp add -s user roadraven -- npx -y @roadraven/mcp@<app version>
  ```

If the server is *newer* than the app, update RoadRaven instead — the toast
shows the installer one-liner for your platform.

## Full tool catalog

For the complete tool list, configuration, kill-switch, and security model,
see [`plugins/claude-code/README.md`](https://github.com/Shuffzord/RoadRaven/tree/master/plugins/claude-code).
