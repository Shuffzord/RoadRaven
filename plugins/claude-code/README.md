# @roadraven/mcp — RoadRaven for Claude Code

The MCP server and Claude Code plugin for [RoadRaven](https://github.com/Shuffzord/RoadRaven),
a local desktop app that shows your project's plan as a tree and updates it
live as the work happens. The server gives an agent 21 tools to read the open
roadmap, create, edit, move and delete nodes, and set their status. The
plugin adds two skills that tell Claude how to use those tools to plan and
run real work.

Source-available, FSL-1.1-MIT.

## The app must be running

Every tool talks to the RoadRaven desktop app over a local connection on
`127.0.0.1`. With the app closed, tools return `app_not_running`; with no
roadmap open, `no_file_loaded`. The app only opens or saves files where you
already work, so a request for another path returns `path_not_permitted`.
Install the app first: see [Install](https://github.com/Shuffzord/RoadRaven#install).

## Install

Three ways, easiest first.

**Setup Wizard.** Launch RoadRaven. The first-run Setup Wizard detects Claude
Code and OpenCode and registers this server with one click. Re-open it from
the ⚙ button in the top bar. If the Claude Code plugin below is already
installed, the wizard defers to it.

**Claude Code plugin.** Requires Node.js >= 24. From inside Claude Code:

```
/plugin marketplace add Shuffzord/RoadRaven
/plugin install roadraven@roadraven
```

**Any other MCP host.** Requires Node.js >= 24. Pin the version that matches
your installed app (the app warns on a major.minor mismatch):

```bash
claude mcp add -s user roadraven -- npx -y @roadraven/mcp@0.8.9
```

To add a short RoadRaven section to a `CLAUDE.md` (it asks whether to use
the current project or `~/.claude/CLAUDE.md`), run
`npx -y @roadraven/mcp@0.8.9 init`.

## Skills

The skills ship with the Claude Code plugin install only. The Setup Wizard
and `npx` paths give you the tools without them.

**`roadraven:orchestrate`** turns a request into a roadmap tree (goal,
phases, tasks), writes a brief per phase, hands each phase to a sub-agent,
re-runs your project's own checks to verify the result, and keeps node
status current while you watch.

```
Plan the CSV export feature as a roadmap in RoadRaven and run it phase by phase.
```

**`roadraven:work-node`** is how one task gets done: claim a node, set it in
progress, checkpoint into its notes, touch only the files the brief names,
prove a fix with a failing test first, run the checks, report, set the final
status.

```
Pick up the first not-started node in the open roadmap, do the work, and keep its status current.
```

Both skills find your project's test, lint and build commands from its README,
package manifest or CI config, so they work in any language. If the app is
not running they ask you once to start it, then fall back to a markdown
worklog and say so.

More: [MCP install guide](https://github.com/Shuffzord/RoadRaven/blob/master/docs/mcp-install.md),
[plugin authoring guide](https://github.com/Shuffzord/RoadRaven/blob/master/docs/plugin-authoring.md).
