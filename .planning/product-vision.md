# Product Vision

**Last updated:** 2026-04-13

---

## Vision Statement

> **"Your plans, visualized and alive — every node knows its own status."**

RoadRaven is a desktop roadmap viewer where hierarchical plans stay current automatically — updated by your tools, your agents, your scripts — without you lifting a finger.

---

## Core Problem

Planning tools show you what *should* happen. Monitoring tools show you what *did* happen. Nothing shows you **what's happening right now, in the context of where it fits in your plan** — especially when AI agents are doing the work for you.

Roadmaps go stale the moment you create them. You shouldn't have to check three tools to know where your project stands.

---

## Key Principles

- **JSON-first**: Your data is a file you own — readable, versionable, portable
- **Passive by design**: The app stays dumb; external tools push status updates to it
- **Tree-native**: Hierarchies are how plans actually work — not flat lists, not Kanban columns
- **Personal scale**: One user, one file, zero infrastructure

---

## Pitch Deck Ideas

### Slide 1: The Problem
"Every team has a roadmap. None of them are current."
- Static docs go stale within hours
- Status lives in 5 different tools (CI, Jira, Slack, dashboards, your head)
- AI agents complete tasks silently — you find out when you check

### Slide 2: The Shift
"AI agents are doing more of the work. Who's watching the big picture?"
- 2025-2026: AI coding agents becoming mainstream (Claude Code, Cursor, Copilot Workspace)
- Agents complete tasks but don't update your roadmap
- The gap between "work done" and "plan updated" is growing

### Slide 3: The Solution
"RoadRaven: a live roadmap that updates itself."
- Visual tree editor backed by plain JSON
- WebSocket API — any tool, script, or AI agent pushes status updates
- Desktop app, local-first, no cloud dependency
- Demo: Claude Code agent completes a task → node turns green in real time

### Slide 4: How It Works
- Show the tree UI (phase-1.html reference design)
- JSON file on disk → tree renders → external producer pushes event → node badge updates live
- Three-layer diagram: Your Plan (JSON) → RoadRaven (viewer) → Your Tools (producers)

### Slide 5: Market Gap
"No existing tool combines these three things."
- Tree visualization (not Kanban, not Gantt)
- JSON file backing (not a database, not a SaaS)
- Live push updates from external tools (not polling, not manual)
- Competitive matrix: 20+ tools reviewed, none cover all three

### Slide 6: Use Cases
1. **AI agent monitoring** — Multiple Claude Code agents working on different branches, each updating their node in the tree
2. **Study/learning roadmaps** — Personal learning paths with progress tracked from Goodreads, course platforms, etc.
3. **Project tracking** — Solo developer or small team tracking milestones with CI/CD status feeding into nodes
4. **Data pipeline monitoring** — Pipeline stages as tree nodes, scripts pushing completion status

### Slide 7: Business Model Ideas
- **Open core**: Desktop app is free and open source; premium = cloud sync, team features, hosted plugin marketplace
- **Plugin ecosystem**: Free app, paid premium adapters (GitHub Actions, Linear, Jira connectors)
- **Prosumer tier**: Free for personal use; paid license for commercial/team use (similar to Obsidian model)

### Slide 8: Why Now
- AI agents are mainstream — monitoring them in context is a new need
- Electrobun/Bun ecosystem is maturing — fast, modern desktop apps without Electron overhead
- Developer tooling market is hot — tools that integrate with AI workflows have tailwinds
- JSON/local-first movement growing (Obsidian proved the model)

### Slide 9: Ask
- Seed funding for: v1.1 plugin system, cloud sync layer, first 5 integrations (Claude Code, GitHub Actions, Linear, Goodreads, custom webhook)
- Or: open source launch → community validation → raise on traction

---

## Audience-Specific Taglines

| Audience | Tagline |
|---|---|
| GitHub README | A desktop roadmap viewer where every node knows its own status — powered by JSON, updated by your tools. |
| Pitch deck | RoadRaven turns any JSON roadmap into a live progress dashboard — no workflow lock-in, no cloud dependency. |
| Personal | I shouldn't have to check three tools to know where my project stands. |
| Developer community | Your roadmap is a JSON file. Your tools update it. You just watch the tree. |
