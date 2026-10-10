---
name: work-node
description: Carries out one task or phase while keeping its node in the RoadRaven desktop app current. Claims or creates a node, sets it in progress, checkpoints progress into the node's notes, stays inside the files the brief names, proves a fix with a failing test first, runs the project's own checks, reports in a fixed format and sets the final status. Use when a brief or an orchestrator says to use work-node, when a sub-agent is handed a phase brief with a roadmap node id, or when the user says "pick up the next roadmap task", "work on this node", "do the first not-started node and update its status as you go". Needs the RoadRaven app running with a roadmap open.
---

# Work a roadmap node

You are doing one piece of work that someone is watching in RoadRaven. The
node is how they see it: its status says where you are, its notes say what
you found. Keep both honest and current.

## 1. Check the app

Call `getOpenFile()` first. If it returns `filePath` null and `nodeCount` 0,
nothing is loaded; an untitled roadmap (`isUntitled` true, `nodeCount` above
0) is loaded and fine to work in. A failed call returns text that begins
`Error (<code>):`; the code in brackets is what the table below means. In
either case, stop and ask the human once:

| Code | Meaning | Ask for |
|---|---|---|
| `app_not_running` | The desktop app is closed. | "Please start RoadRaven." |
| `no_file_loaded` | The app is open with no roadmap. | "Please open the roadmap file." |
| `path_not_permitted` | The app only opens or saves files where the human already works. | "Please open that file in the app yourself." |
| `agent_api_disabled` | The human switched agent access off. | Whether they want to turn it back on. |

If that does not resolve it, write the same checkpoints to a markdown
worklog: the path your brief names, or ask (the layout is in the
orchestrate skill's
[worklog-fallback.md](../orchestrate/references/worklog-fallback.md)). If you
are working directly for the human, tell them once, plainly, that without
the app there is no live tree to watch, only a markdown file; either way,
say in your report that the roadmap was not updated and why. When the
session cannot ask anyone (a non-interactive run, or you are a sub-agent
without a channel to the human), skip the question, go straight to the
worklog, and say in your report that the app was unavailable and nobody
could be asked. The worklog is
the sanctioned fallback. A workaround is trying other paths, editing the
roadmap file on disk (the app's next save wins), or changing the app's
settings to get past a refusal; never do those.

## 2. Claim your node

- **Given a phase node id:** confirm it with `getNode({ nodeId })`, check
  `getTypeConfig()`, then create your task under it with
  `createNode({ parentId, title, status: "in-progress", notes })`. Add
  `type` only if the document defines a fitting id such as `task`. Keep the
  returned id.
- **Given a node to work on directly:** set it with
  `updateNodeStatus({ nodeId, status: "in-progress" })`.
- **Asked to pick the next task yourself:** use
  `findNodes({ status: "not-started" })` (add `parentId` to stay inside one
  branch), tell the human which node you picked, then set it in progress.
  A node whose metadata has `priority: "next"` (set by the human from the
  RoadRaven pane) is taken before other not-started work; once started,
  clear the flag with `updateNodeMetadata({ nodeId, patch: { priority: null
  } })`.

Start the notes with a two-line summary of the task and a `## Checkpoints`
heading. Statuses are always one of `not-started`, `in-progress`,
`completed`, `blocked`; `getStatusConfig()` only shows their display labels.

## 3. Checkpoint as you go

Append to the notes with
`updateNodeNotes({ nodeId, notes, mode: "append" })` about every 20 minutes
and at every milestone: what landed, what is failing, what surprised you.
A restart or a cut-off session loses everything that exists only in your
context; the notes survive. Put numbers (test counts, timings, commit ids)
in metadata with `updateNodeMetadata({ nodeId, patch })`.

## 4. Prove before you fix

A cause in a brief, or one you found by reading code, is a hypothesis until
a test fails on it. Write the failing test first and keep its output: it is
the only proof the test was ever red. If the cause will not reproduce, stop
and report it; do not fix what is not proven.

## 5. Stay inside your lane

- **Touch only the files the brief names**, formatting included. Read
  anything. If you need another file, stop and ask.
- **Notice, don't fix.** Unrelated problems go in the report, with
  `path:line`.
- **Leave version control to the orchestrator.** Do not commit, stash,
  switch branches or reset unless the brief says so. Other people or agents
  may be editing the same working tree, and a stash or reset destroys their
  work.
- **Only write to your own node**, or the one you were given. The rest of
  the roadmap belongs to the human. Pass `expectedRevision` from your last
  `getNode({ nodeId })` when a write must not clobber an edit; on
  `stale_write`, read again and redo it.
- **Temporary instrumentation goes away** before you report. Show the
  search that proves no debug logging or timers are left.

## 6. Run the project's checks

Use the commands the brief names. If it names none, find the project's own
test, lint, type-check and build commands in the README, the package
manifest or the CI config, or ask. Paste real output, not a summary of it.
If a check fails because of files that are not yours, say so and leave them
alone.

## 7. Report and finish

Write the report using
[references/report-template.md](references/report-template.md), every
heading in order, to the path the brief names or as your final message.
Then set the final status with
`updateNodeStatus({ nodeId, status: "completed" })` when the checks pass,
or `status: "blocked"` when you stopped, and append a last note pointing at
the report. The orchestrator or the human re-runs the checks before
accepting it, so report what you actually saw.
