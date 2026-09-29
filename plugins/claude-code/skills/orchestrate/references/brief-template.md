# Phase brief template

Copy this, fill every section, and paste it as the sub-agent's task. Anything
left vague comes back as a second round.

---

**Use the `work-node` skill for this task.** Phase node id: `<id>` in the
open roadmap `<file>`.

(Without the app, replace that paragraph with the wording at the end of
[worklog-fallback.md](worklog-fallback.md).)

## Goal
One sentence. Then each cause this phase addresses: the claim, the
`path:line` it points at, and the test that will prove it. A cause is a
hypothesis until that test fails; if it does not reproduce, stop and report
instead of fixing it.

## Files you may change
Exact paths to create or modify, nothing else, formatting included. Read
anything. If the work needs a file outside this list, stop and ask. Your
worklog and report paths are always allowed and are not part of the change
under review.

## Required outcome
The behaviour after the change, in the user's words. Plus the design shape
that is required rather than suggested: which module owns each piece of
state, which interface callers use.

## Out of scope
Things you will probably notice and must leave alone: report, don't fix.

## Tests (failing first)
- The failing test to write first, per cause, and where it lives.
- Strings the test depends on (selectors, labels, event names): import them
  from the code, never retype them.
- Existing tests expected to change, and why.

## Checks
The project's commands to run before reporting, exactly as written here:
`<test command>`, `<lint command>`, `<type-check or build command>`. Write
"none in this project" for a category that does not exist rather than
inventing a command. Targets are behaviours (each reproduced bug pinned by a
named test), not a coverage percentage.

## Practical notes
- Do not commit, stash, switch branches or reset; the orchestrator commits.
- Checkpoint into the work node (or the worklog) about every 20 minutes.
- Remove any temporary logging or timers and show the search that proves it.

## Report
Use the `work-node` report template, with every heading, in this order.
Write it to `<report path>` or return it as your final message.
