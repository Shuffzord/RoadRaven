---
title: Home
nav_order: 1
layout: default
---

# RoadRaven

A keyboard-first desktop editor for visual roadmap trees. Built on
[Electrobun](https://blackboard.sh/electrobun/) (not Electron); runtime is Bun.

## Quick links

| What | Where |
|------|-------|
| Install (Windows + Linux) | [README — install](https://github.com/Shuffzord/RoadRaven#install) |
| Architecture overview | [Architecture](architecture-overview.html) |
| Local development | [Development guide](development-guide.html) |
| RPC contract reference | [RPC and IPC](rpc-and-ipc.html) |
| Design system + tokens | [Design system](design-system.html) |
| Structured logging | [Logging](logging.html) |
| **Build a producer for the Event API** | [Plugin authoring guide](plugin-authoring.html) |

## What's in v1

- Keyboard-first roadmap editor (read + write)
- JSON schema-driven node types and statuses
- Live status updates from external producers via WebSocket Event API
- Reference Event Producer: `@roadraven/plugin-claude-code`
   — npm-installable MCP wrapper for Claude Code

## What's NOT in v1 (deferred to v1.1+)

- macOS `.dmg` installer
- Canary release channel
- `@roadraven/react` component package
- Smart-adapter Plugin System (the in-app `RoadmapPlugin` host)
- Code signing (Authenticode / GPG / notarization)

See the [README — feature status](https://github.com/Shuffzord/RoadRaven#feature-status)
for the full v1 vs. v1.1 split.

## Packages on npm

- [`@roadraven/core`](https://www.npmjs.com/package/@roadraven/core)
   — Zod schemas + types (zero desktop deps)
- [`@roadraven/plugin-claude-code`](https://www.npmjs.com/package/@roadraven/plugin-claude-code)
   — MCP wrapper that lets Claude Code push live updates to a running app
