# RoadRaven — Pitch

## Tagline

**A local-first, non-opinionated roadmap planner that watches your systems so you don't have to.**

---

## One Paragraph

RoadRaven is a desktop app for developers who want their plan and their tooling to be the same thing. Build a tree of your project in plain JSON, connect nodes to whatever is actually running — CI pipelines, AI agents, local scripts, custom tools — and watch status update live without touching anything. No sprints. No story points. No accounts. No cloud.

---

## The Problem

You're building something. Your plan lives in Notion or your head. Your actual work is spread across GitHub, CI pipelines, AI agents, terminal sessions. These two things are never connected. Your roadmap is out of date the moment you write it — and nobody updates it.

---

## The Solution

RoadRaven turns your roadmap into a live dashboard. Each node in your plan can subscribe to a real system. A GitHub Actions workflow finishes — the node turns green. Claude Code completes a task — the node updates. A local script writes a status file — the node reflects it. You open the app and the current state of your project is just there.

```json
{
  "id": "deploy-prod",
  "title": "Deploy to production",
  "plugin": {
    "id": "github-actions",
    "config": { "repo": "org/app", "workflow": "deploy.yml" }
  }
}
```

---

## Why Not Jira / Linear / Notion

**Jira and Linear** track what your team committed to doing. RoadRaven tracks what your systems are actually doing right now. Different job entirely — one is coordination, the other is instrumentation.

**Notion** is a static doc. You update it manually. It has no concept of a live feed from your tooling.

**n8n** automates what machines do. RoadRaven shows what state your plan is in. One is an engine, the other is a dashboard. They're composable — n8n can feed RoadRaven.

**The real gap:** no existing tool combines a local plain-text plan format, a user-defined status schema, and live status feeds from arbitrary systems — without requiring a server, a cloud account, or a SaaS subscription.

---

## Integration Model

Two tiers, cleanly separated:

**Tier 1 — Local (zero config)**
Any process on your machine connects via WebSocket to `ws://127.0.0.1:<port>`. Claude Code, local dev servers, file watchers, terminal scripts. This covers 80% of solo dev use cases with no setup.

**Tier 2 — Plugins as workers**
For external systems (GitHub Actions, Linear, etc.) a plugin running inside the app reaches out to the external API on a schedule. The plugin owns the connection logic, normalises the schema, and pushes a status update to the correct node. No inbound server, no tunnels, no exposed ports.

The node doesn't know about the external system. The plugin knows about both:

```
node:   { id: "deploy-prod" }
plugin: { watches: github-actions:org/app:deploy.yml, updatesNode: "deploy-prod" }
```

---

## Key Properties

- **Plan-as-file** — `roadmap.json` lives in your repo, versioned alongside code, reviewed in PRs
- **Zero-opinion schema** — you define statuses, types, hierarchy; the tool has no model of its own
- **Local-first** — binds to `127.0.0.1` by default, works air-gapped, nothing leaves your machine
- **Git-friendly** — plain JSON, fully diffable, no binary blobs, no proprietary format
- **Extensible** — any process that can send a message can update a node; plugins handle the rest
- **Embeddable** — `@roadraven/core` and `@roadraven/react` ship as npm packages

---

## 5 Scenarios Where Nothing Else Works

1. **AI agent supervision** — watching Claude Code or other autonomous agents work through your plan in real-time. No tool has a connector for this. RoadRaven's plugin connects directly, zero infrastructure.

2. **Plan-as-code** — the roadmap is a versioned artifact in the repository. `git diff main..feature roadmap.json` shows what changed in the plan on this branch. PR review covers code and plan simultaneously. No SaaS tool can make its data a native git artifact.

3. **Mixed toolchain aggregation** — three client projects, three different CI systems, one window. Each node subscribes to whatever transport that client uses. No common infrastructure required.

4. **Domain-agnostic tracking** — learning roadmaps, research trees, writing pipelines. Every other tool encodes assumptions about what "work" means (sprints, issues, epics). RoadRaven doesn't. Your status types are whatever you define in the file.

5. **Air-gapped / security-sensitive environments** — a desktop binary that opens a file. No server, no account, no telemetry, no data leaving the machine. Self-hosted Jira is still a server. RoadRaven is a file and an app.

---

## Built For

Solo developers, small teams, anyone building with AI agents, anyone working across multiple tools with no common SaaS layer, anyone in environments where data cannot leave the machine.

---

## Friend Pitch (English)

You're building something. You have a plan in Notion or your head. You have tasks running in GitHub, CI pipelines, AI agents doing work. These two things are never connected. Your roadmap is out of date the moment you write it.

What if your roadmap watched itself?

RoadRaven is a desktop app where you build a tree of your plan and each node can subscribe to a real system. A GitHub Action finishes — node turns green. Claude Code completes a task — node updates. You open the app and the current state of your build is just there.

It's a plain JSON file you can `git diff`. A visual tree you navigate with a keyboard. And a live dashboard that watches your tools so you don't have to.

*Your plan. Always current. Zero manual updates.*

---

## Friend Pitch (Polish)

Budujesz coś. Twój plan siedzi w Notion albo w głowie. Masz zadania w GitHubie, pipeline CI, agenty AI które robią robotę. Te dwie rzeczy nigdy nie są połączone. Twój roadmap jest nieaktualny w chwili gdy go piszesz.

A co gdyby roadmap obserwował się sam?

RoadRaven to aplikacja desktopowa, w której budujesz drzewo swojego projektu — a każdy węzeł może subskrybować prawdziwy system. GitHub Actions kończy workflow — węzeł zmienia kolor. Claude Code kończy zadanie — węzeł się aktualizuje. Otwierasz apkę i aktualny stan twojego projektu jest po prostu tam.

Zwykły plik JSON, który możesz wersjonować w gicie. Wizualne drzewo obsługiwane klawiaturą. I live dashboard, który obserwuje twoje narzędzia zamiast ciebie.

*Twój plan. Zawsze aktualny. Zero ręcznych aktualizacji.*

---

## The Real Story

Hey, so I'm building this desktop app. You know how when you're working on something bigger — like a proper project with multiple moving parts — you end up with this disconnect between your plan and what's actually happening? Like you have a Notion doc or whatever that says "phase 2: build the API" but your actual work is scattered across terminal sessions, GitHub, maybe some AI agent you're running. And the doc is just... lying there, never updated, slowly becoming fiction.

I got annoyed enough to build something. It's basically a tree editor — you write your plan as a JSON file, it renders as a collapsible tree, you can add notes to nodes, set statuses, all that. But the thing that made it click for me is that each node can watch something real. Like I have a node called "deploy pipeline" and it's connected to my GitHub Actions workflow. When the workflow finishes, the node turns green. I didn't touch anything. I just opened the app and it was green.

Same with Claude Code — I've been using it to work through tasks autonomously and it's kind of wild to just watch nodes in your plan flip status as the agent works through them.

The file is just JSON so it lives in the repo, you can diff it, it's always next to the code. No account, no server, no subscription. It just opens a file.

Someone always asks "why not just use Jira?" and honestly I get it. But Jira is a team coordination tool — it's built around the idea that humans pick up tickets, do work, and close them. It has sprints, velocity, story points, all that. What I'm building isn't about coordinating a team, it's about one developer (or a small team) having a live view of what their systems are doing. Jira also lives in Atlassian's cloud, your data is their data, and getting status from a random local script into a Jira ticket requires writing a whole integration. And then you're maintaining that. The other thing is the hierarchy — Jira gives you three levels (epic, story, task) and that's it. A JSON tree is just... a tree. As deep as you want it.

The n8n question is more interesting because n8n actually looks similar from the outside — boxes, connections, automation. But n8n is a workflow executor. You build flows and it runs them, does actions, moves data around. It's a machine that does things. RoadRaven is a view of what state your plan is in — it doesn't do anything, it just reflects reality. The other difference is that n8n needs a server running. Even self-hosted, it's a web app with a database and a process you have to keep alive. RoadRaven is a desktop binary that opens a file. You could actually use n8n as a data source for RoadRaven — build an n8n flow that polls some API and posts a status update to a node. They're not competing, they're just different tools.
