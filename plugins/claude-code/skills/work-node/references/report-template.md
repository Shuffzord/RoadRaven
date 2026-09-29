# Work report template

Copy the eight headings below exactly, in this order, so whoever verifies
the work can find each part without reading everything. Write "None" under
a heading that has nothing to say rather than dropping it.

## Files changed
Every path you created or modified, each in backticks. Compare it with the
working tree (`git status`, or your editor's change list) before you send
it; a path missing here is a change nobody reviews. Your worklog and this
report are not part of the change; name them under "Work node" instead.

## Failing test first
Per cause: the test name, and the failure output from before the fix. If a
cause did not reproduce, say so and leave it unfixed.

## Checks
Each command you ran and its real result (pass or fail, counts). Name any
check you did not run and why.

## Tests removed or merged
One line per test you deleted or merged, naming what still protects that
behaviour.

## Deviations
Anything you did differently from the brief, and why: a file you had to
add, a required design that turned out impossible, a claim in the brief
that turned out wrong.

## Noticed, left alone
Unrelated problems you saw, each with `path:line`. The orchestrator turns
these into roadmap nodes.

## Cleanup
The search that shows no temporary logging, timers or debug flags
survived, with its output. Empty output is the point.

## Work node
The node id and its final status, or, if the app was unavailable, the
reason (the error code) and the path of the markdown worklog you used.
