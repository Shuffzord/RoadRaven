# Working without the app

Use this only after the human has been asked once and the app is still not
available, or straight away when nobody can be asked (a non-interactive run,
or a sub-agent with no channel to the human); then say so in the report. The plan keeps the same tree, in one markdown file, so it can be
moved into RoadRaven later without rethinking it.

## Tell the human once

"RoadRaven isn't available, so I'll keep the plan in `<plan path>`. There is
no live tree to watch; open that file to see progress."

## Where it goes

Ask. The default is a `.roadraven/` folder at the project root: `plan.md`
for the plan, and `phase-<n>.md` plus `phase-<n>-report.md` for each phase's
sub-agent. Ask whether to keep that folder out of version control (for
example in `.gitignore`); it is the human's call, not yours.

## Plan file layout

```markdown
# <goal> — in-progress

## Phase 1 — <name> — completed
| Check | Result |
|---|---|
| tests | 212 passed |
| lint | clean |
| commit | abc1234 |

### <task> — completed
Worklog: phase-1.md. Report: phase-1-report.md.

Decisions
- D-1 <decision>. Chosen because ... Rejected: <option>, because ...

Noticed, left alone
- `path:line` <problem>

## Phase 2 — <name> — not-started
```

- The last word of every heading is its status, one of `not-started`,
  `in-progress`, `completed`, `blocked`. Change it in place.
- The table under a phase stands in for node metadata; text under a heading
  stands in for node notes.
- Only the orchestrator edits `plan.md`. Each sub-agent appends to its own
  phase worklog, so no file has two writers.

## In the brief, instead of a node id

> **Use the `work-node` skill for this task.** RoadRaven is not available,
> so there is no node id. Append your checkpoints to `.roadraven/phase-<n>.md`
> (create it if missing) and write your report to
> `.roadraven/phase-<n>-report.md`. Both files are always allowed and are
> not part of the change under review.
