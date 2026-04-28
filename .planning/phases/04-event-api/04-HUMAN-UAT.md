---
status: partial
phase: 04-event-api
source: [04-VERIFICATION.md]
started: 2026-04-28T13:10:00Z
updated: 2026-04-28T13:10:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Pulse animation visible + reduced-motion fallback (PLUG-04 / D-15)
test: Open a node that has received a live event within the last 30 seconds. Confirm the animated pulse ring plays on the node card. Toggle OS reduced-motion setting; confirm a static 2px solid outline replaces the animation.
expected: Animated `rv-node-pulse` ring is visible while live; under reduced-motion the ring becomes a static outline.
result: [pending]

### 2. Claude Code MCP end-to-end latency (PLUG-08 / D-29)
test: Register `plugins/claude-code` in Claude Code's MCP config. Start RoadRaven. Invoke `updateNodeStatus({nodeId, status})` from a Claude Code conversation. Time the round trip. Also invoke `getEventApiStatus`.
expected: Node badge updates within perceived-instant (<100ms). Event drawer row appears. `getEventApiStatus` returns the correct port + pid.
result: [pending]

### 3. Status-bar pill click UX (D-06)
test: With the app running, click the EventApiPill in each state — listening (0 producers), listening (>0 producers), and error.
expected: Idle click copies `ws://127.0.0.1:47921` to clipboard. Connected click opens the event log drawer. Error state shows the correct copy.
result: [pending]

### 4. Welcome screen URL copy (D-07)
test: On the welcome screen with the Event API running, locate the URL line near the footer and click the copy button.
expected: The `ws://127.0.0.1:47921` URL string is copied to the clipboard.
result: [pending]

### 5. Event log drawer resize handle (D-18)
test: Open the event log drawer. Drag the top resize handle through the full range — from the 24px collapsed strip to 70% of viewport height.
expected: Drawer resizes smoothly. Snaps to the 24px collapsed state. Does not exceed 70% viewport height.
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
