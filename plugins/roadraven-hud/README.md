# roadraven-hud

A Claude Code mod: a live RoadRaven pane inside your Claude Code terminal
session, plus a status-line entry such as `RR 2 active · 1 UAT`. The pane
opens at session start on wide terminals, or any time with `/roadraven`.

<!-- screenshot: HUD pane -->

## Install

It is a dependency of the `roadraven` plugin, so this installs it too:

```text
/plugin marketplace add Shuffzord/RoadRaven
/plugin install roadraven@roadraven
```

Already on the plugin? `claude plugin install roadraven-hud@roadraven`, then
`claude plugin update roadraven-hud@roadraven` for later updates. MCP-only
setup (Setup Wizard, no plugin): add the marketplace as above, then
`/plugin install roadraven-hud@roadraven`.

## Sections

- **Active work**: in-progress nodes with the agent on each (name, model,
  effort, elapsed time, current action, tokens when done).
- **UAT**: nodes with type `uat`. Mark each item Pass or Fail, add a note per
  failed item and an optional batch note, then "Send N decision(s) to
  orchestrator". Pass sets `completed`, fail sets `blocked`; failure notes are
  appended to the node and the session gets one summary.
- **Backlog**: `not-started` nodes (`[show]` / `[hide]`). **Run** starts a
  one-off sub-agent on the node and tells the orchestrator. **Next** sets
  `metadata.priority = "next"`, which the orchestrate and work-node skills
  take first.

## Theme

Follows the RoadRaven app's theme by default (reads
`~/.config/RoadRaven/settings.json`). Override with the `theme` option in
Claude Code's `/config`: `follow-app`, `amber`, `dark`, `light`, `moss`,
`paper`, `slate`, `contrast`, `high-contrast`.

## UAT convention

Agents create acceptance checks as nodes with `type: "uat"`; they show up in
the UAT section for you to pass or fail.

## Requirements

The RoadRaven app running with a roadmap open. The HUD reads through the
RoadRaven MCP server.
