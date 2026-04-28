---
status: complete
phase: 04-event-api
source: [04-VERIFICATION.md]
started: 2026-04-28T13:10:00Z
updated: 2026-04-28T15:45:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Pulse animation visible + reduced-motion fallback (PLUG-04 / D-15)
test: Open a node that has received a live event within the last 30 seconds. Confirm the animated pulse ring plays on the node card. Toggle OS reduced-motion setting; confirm a static 2px solid outline replaces the animation.
expected: Animated `rv-node-pulse` ring is visible while live; under reduced-motion the ring becomes a static outline.
result: issue
reported: "I dont see any pulse animation nor any visible changes in the node or app itself. The only thing updating is the status, metadata and event log"
severity: major

### 2. Claude Code MCP end-to-end latency (PLUG-08 / D-29)
test: Register `plugins/claude-code` in Claude Code's MCP config. Start RoadRaven. Invoke `updateNodeStatus({nodeId, status})` from a Claude Code conversation. Time the round trip. Also invoke `getEventApiStatus`.
expected: Node badge updates within perceived-instant (<100ms). Event drawer row appears. `getEventApiStatus` returns the correct port + pid.
result: pass
notes: |
  Round-trip latency 35-45ms across 5 happy-path calls (well under 100ms target).
  getEventApiStatus returned port 47921, pid 24400 — matches running app sentinel.
  Status badge + event log updates confirmed in Test 1 against the same server.
  Wrapper is fire-and-forget by design — server-side classification (unknown_node /
  invalid_status) is reflected in drawer rows + error pill, not echoed back through
  the MCP response. User flagged this as a future design consideration (see
  follow-up item below), not a Test 2 defect.

follow-up:
  - id: validation-echo
    summary: |
      Wrapper currently returns `ok` for both unknown_node and invalid_status frames.
      Consider validating against the loaded schema on the desktop side and echoing
      classification back through the MCP response, so CI integrations get explicit
      failure on typos rather than silent no-ops.
    raised_by: Test 2 negative cases (steps 6-7)
    severity: design-decision

### 3. Status-bar pill click UX (D-06)
test: With the app running, click the EventApiPill in each state — listening (0 producers), listening (>0 producers), and error.
expected: Idle click copies `ws://127.0.0.1:47921` to clipboard. Connected click opens the event log drawer. Error state shows the correct copy.
result: issue
reported: "Saw `● :47921 · 1` (connected, 1 producer) — clicking the pill did not open the event log drawer. Idle URL-copy works. Drawer can only be opened via the node integration panel's `Open full log →` button."
severity: major
verified_states:
  - idle (0 producers): pass — copies URL with Copied ✓ feedback
  - connected (1+ producers): FAIL — click should open drawer, copies URL or no-ops instead

### 4. Welcome screen URL copy (D-07)
test: On the welcome screen with the Event API running, locate the URL line near the footer and click the copy button.
expected: The `ws://127.0.0.1:47921` URL string is copied to the clipboard.
result: pass

### 5. Event log drawer resize handle (D-18)
test: Open the event log drawer. Drag the top resize handle through the full range — from the 24px collapsed strip to 70% of viewport height.
expected: Drawer resizes smoothly. Snaps to the 24px collapsed state. Does not exceed 70% viewport height.
result: pass

follow-up:
  - id: drawer-auto-scroll
    summary: |
      User suggested a new-feature toggle: an "auto-scroll to new events" checkbox
      on the event log drawer (default enabled). Today the drawer holds its scroll
      position so a stream of new events scrolls off the bottom; an opt-in tail-
      follow mode would mirror what most log viewers do (e.g. Chrome DevTools
      console "Preserve log" inverse).
    raised_by: Test 5 verification
    severity: enhancement

## Summary

total: 5
passed: 3
issues: 2
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "Animated `rv-node-pulse` ring is visible while live; under reduced-motion the ring becomes a static outline."
  status: failed
  reason: 'User reported: "I dont see any pulse animation nor any visible changes in the node or app itself. The only thing updating is the status, metadata and event log"'
  severity: major
  test: 1
  artifacts: []
  missing: []

- truth: "Connected click on EventApiPill (`● :47921 · N` state, N>=1 producers) opens the event log drawer."
  status: failed
  reason: 'User confirmed pill displayed `● :47921 · 1` while wscat held a connection open; clicking the pill did not open the drawer. Idle (0 producers) URL-copy path works correctly; only the connected branch in EventApiPill.handleClick is broken or the drawer toggle from eventLogStore.setOpen(true) is not landing.'
  severity: major
  test: 3
  artifacts:
    - packages/desktop/src/mainview/components/EventApiPill.tsx
    - packages/desktop/src/mainview/store/eventLogStore.ts
  missing: []

- truth: "User can close the event log drawer once it has been opened."
  status: failed
  reason: 'Drive-by observation during Test 3 setup: drawer opened via the node integration panel `Open full log →` button cannot be closed by the user. Likely missing close affordance (X button, ESC handler, or click-outside) or the close action is wired to a setter that no longer fires.'
  severity: major
  test: drive-by-during-3
  artifacts:
    - packages/desktop/src/mainview/components/EventLogDrawer.tsx
    - packages/desktop/src/mainview/store/eventLogStore.ts
    - packages/desktop/src/mainview/hooks/useKeyboardRouter.ts
  missing: []
