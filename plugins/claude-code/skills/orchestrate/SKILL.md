---
name: orchestrate
description: Plans a multi-step piece of work as a live roadmap tree in the RoadRaven desktop app and runs it phase by phase with sub-agents. Breaks the request into a root, phases and tasks, writes one brief per phase, hands each phase to a sub-agent, re-runs the project's own checks to verify the result, and keeps node status current so the human can watch the tree change. Use when the user says "plan this feature as a roadmap and run it", "orchestrate this", "break this into phases", "run this with sub-agents", "use sub-agents for each phase", or hands over a list of bugs or features and asks for it as a roadmap or in phases. Needs the RoadRaven app running with a roadmap open. Skip it for a single small edit.
---

# Orchestrate work as a live roadmap

You are the orchestrator. You scope the work, brief sub-agents, verify what
they hand back, and make decisions. The sub-agents do the editing, each one
following the `work-node` skill from this plugin. The plan and its progress
live in RoadRaven as a tree of nodes, so the human can glance at the app and
see what is planned, what is running and what is stuck.

## First, check the app

Every RoadRaven tool talks to the desktop app on this machine. Call
`getOpenFile()` before planning anything. If it returns `filePath` null and
`nodeCount` 0, nothing is loaded; an untitled roadmap (`isUntitled` true,
`nodeCount` above 0) is loaded and fine to work in. A failed call returns
text that begins `Error (<code>):`, the code the table below means. In
either case, stop and ask the human once:

| Code | Meaning | Ask for |
|---|---|---|
| `app_not_running` | The desktop app is closed. | "Please start RoadRaven." |
| `no_file_loaded` | The app is open with no roadmap. | "Please open or create a roadmap file." |
| `path_not_permitted` | The app only opens or saves files where the human already works. | "Please open that file in the app yourself." |
| `agent_api_disabled` | The human switched agent access off. | Whether they want to turn it back on. |

If the human declines, or it still fails, keep the plan in markdown as
[references/worklog-fallback.md](references/worklog-fallback.md) describes
and tell the human once that there is no live tree to watch, only a markdown
file. When nobody can be asked (a non-interactive run), go straight to that
fallback and say so in your final message. Never work around the app: no
other paths, no editing the roadmap file on disk (the app holds it in
memory; its next save wins), no changing app settings.

## The loop

1. **Understand, then prove.** Read the code before planning. What you
   conclude from reading is a hypothesis. For a bug, get a failing test or a
   measurement first; if it will not reproduce, report that instead of
   planning a fix. Diagnoses made only by reading code are wrong often
   enough that this step pays for itself.
2. **Find the project's own checks.** Look for the test, lint, type-check
   and build commands in the README, the package manifest (`package.json`
   scripts, `pyproject.toml`, `Cargo.toml`, `Makefile`, `go.mod`) and the CI
   config; ask if unclear. Run them once before any change so "it broke"
   later is a comparison.
3. **Plan as a roadmap.** Build the tree described below. Include, per phase,
   the existing tests it is expected to change and why, so a test that
   changes unexpectedly stands out.
4. **Run each phase.** Brief, spawn, verify, record (see below).
5. **Close.** Tell the human in plain language what changed, what was
   verified and what is still open. Anything noticed and left alone becomes
   a child node, so it is not lost in a chat log.

## The roadmap shape

```
<goal>                    the whole piece of work
  Phase 1 — <name>        one reviewable step, usually one commit
    <task>                created by the sub-agent that does it
    D-1 <decision>        options rejected, and why, in the notes
    <noticed item>        found during the phase, left for later
  Phase 2 — <name>
```

- Put the goal node where the human says, or under the open document's top
  node (`getRoadmap()` shows the tree; `findNodes({ titleContains })` finds
  by name).
- Call `getTypeConfig()` and `getStatusConfig()` first. Use a `type` id only
  if the document defines it; otherwise leave `type` out rather than invent
  one. Statuses are always `not-started`, `in-progress`, `completed` or
  `blocked`.
- Create nodes with `createNode({ parentId, title, type, status, notes })`
  and keep every returned id; the phase ids go into the briefs.
- **UAT checks for the human** are `type: "uat"` nodes (or the document's
  UAT type id), children of the phase they check, created `not-started`,
  with **Steps** and **Expected** lists in the notes.
- Numbers (check results, counts, commit ids) go in metadata with
  `updateNodeMetadata({ nodeId, patch })`, evidence and decisions in notes
  with `updateNodeNotes({ nodeId, notes, mode: "append" })`, progress in
  `updateNodeStatus({ nodeId, status })`.
- Call `cameraFitView()` after building the tree so the human sees all of it.

## Per phase

| Step | What you do |
|---|---|
| Brief | Fill [references/brief-template.md](references/brief-template.md): goal, exact files the agent may touch, required outcome, the failing test to write first. |
| Spawn | One sub-agent per phase, told to use the `work-node` skill, given the brief and the phase node id (or, without the app, its worklog path). Parallel agents only when no two can touch the same file; otherwise one at a time. |
| Verify | Re-run the project's checks yourself and read the diff. Confirm only the briefed files changed. |
| Decide | Accept, or send it back with a precise ask. Patching it yourself hides the defect from the agent and from the record. |
| Record | Set the phase status and write the check results to its metadata. If the human wants commits, one per phase, after verification. |
| UAT | Once the phase is verified, set its UAT child `in-progress`; that shows it to the human and notifies them. Never set a UAT node `completed` or `blocked` yourself. If it comes back `blocked`, read the failure note, fix, re-verify, set it `in-progress` again. |

## Rules that save retries

- **Numbers in a report are claims.** Re-run the checks yourself; trust
  output you produced, not figures typed into a summary.
- **One owner per file at a time.** Two agents editing one file, or you
  committing while an agent is still editing, loses work.
- **`priority: "next"` (set from the pane) goes first;** once started, clear
  it: `updateNodeMetadata({ nodeId, patch: { priority: null } })`.
- **Only write to nodes you created or were given.** The rest of the roadmap
  belongs to the human. Never delete or rename their nodes.
- **Pass `expectedRevision`** from your last `getRoadmap()` or `getNode()`
  when a write must not clobber the human's edits; on `stale_write`, read
  again and redo. `updateNodes({ updates })` is one all-or-nothing write.
- **Decide with defaults.** State the decision, give a one-line reason, and
  move on. Ask the human only when the answer changes direction: scope,
  product behaviour, something irreversible.
- **Test targets are behaviours**, never a coverage percentage, which
  produces tests that protect nothing. Strings a test depends on (selectors,
  labels, event names) live in constants the code and the test both import.
- **Performance claims need interleaved runs** (A, B, A, B on one machine,
  every sample listed): background load alone can outweigh the change.
- **After an interruption,** read the node notes and the working tree before
  resuming. Never assume work landed because a report said so.
