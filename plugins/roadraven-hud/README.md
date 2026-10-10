# roadraven-hud

A **mod** for Claude Code: a brand-new kind of extension that changes Claude
Code's own interface. It adds a live RoadRaven pane inside your terminal
session, plus a status-line entry such as `RR 2 active · 1 UAT`. The pane
opens by itself once RoadRaven is running with a roadmap open, or any time
with `/roadraven`. Until then it stays closed and checks back less often.

![UAT section with Pass and Fail buttons](../../screenshots/hud-uat.png)

## What it does on your machine

- **Reads the open roadmap through the RoadRaven MCP server** (the `roadraven` plugin's server, or one you configured), polling every few seconds while RoadRaven is running.
- **Writes to the roadmap only when you press a button:** Send writes the UAT statuses and failure notes, Next sets a node's priority.
- **Reads RoadRaven's settings and theme files** (`settings.json` and `themes/*.json` in RoadRaven's user-data folder, plus the theme copies bundled with the mod) to follow the app's theme.
- **Starts a Claude Code sub-agent only when you press Run and confirm.**
- **Adds notes to your Claude Code session:** Send submits one summary prompt to the orchestrating agent; Run and Next add a short note it reads at its next turn.
- **Keeps agent labels in Claude Code's plugin store** (`$.store`), per roadmap file, so they survive a restart.
- Makes no network requests of its own and runs no programs.

## Install

| Setup | Command |
| --- | --- |
| New | `/plugin marketplace add Shuffzord/RoadRaven`, then `/plugin install roadraven@roadraven` (the HUD is a dependency, so it installs too) |
| Already on the plugin | `claude plugin install roadraven-hud@roadraven`; later `claude plugin update roadraven-hud@roadraven` |
| MCP only (Setup Wizard, no plugin) | Add the marketplace as above, then `/plugin install roadraven-hud@roadraven` |

## Sections

| Section | Shows | Actions |
| --- | --- | --- |
| Active work | In-progress nodes with the agent on each: name, model, effort, elapsed time, current action, tokens when done | none |
| UAT | Nodes with type `uat` that are ready | Pass / Fail per item, note per failed item, optional batch note, then "Send N decision(s) to orchestrator" |
| Backlog | `not-started` nodes (`[show]` / `[hide]`) | **Run**: asks first (Start agent / Cancel), then a one-off sub-agent on the node, orchestrator told. **Next**: sets `metadata.priority = "next"`, taken first by the orchestrate and work-node skills |

UAT decisions: Pass sets `completed`, Fail sets `blocked`. Failure notes are
appended to the node and the session gets one summary.

## UAT convention

Agents create acceptance checks as nodes with `type: "uat"`. Status is the
readiness rule:

| Node status | Meaning in the HUD |
| --- | --- |
| `not-started` | Not ready, hidden |
| `in-progress` | Ready, shown for you to pass or fail |
| `completed` | Passed |
| `blocked` | Failed, latest reason shown in the pane |

## Theme

- Follows the RoadRaven app theme by default (reads `~/.config/RoadRaven/settings.json`).
- Override with the `theme` option in `/config`: `follow-app`, `amber`, `dark`,
  `light`, `moss`, `paper`, `slate`, `contrast`, `high-contrast`.

## Requirements

- The RoadRaven app running with a roadmap open.
- The HUD reads through the RoadRaven MCP server.
