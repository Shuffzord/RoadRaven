---
status: complete
phase: 04-event-api
source: [04-VERIFICATION.md]
started: 2026-04-28T13:10:00Z
updated: 2026-04-29T00:00:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Pulse animation visible + reduced-motion fallback (PLUG-04 / D-15)
test: Open a node that has received a live event within the last 30 seconds. Confirm the animated pulse ring plays on the node card. Toggle OS reduced-motion setting; confirm a static 2px solid outline replaces the animation.
expected: Animated `rv-node-pulse` ring is visible while live; under reduced-motion the ring becomes a static outline.
result: pass
verified: 2026-04-29
notes: |
  Closed by Plan 04-06 (commits a1357db, 24818ae). Pulse repainted as a
  `.node::after` pseudo-element with animated `border-width`, painted inside
  the foreignObject's clearance. Color routed through a new per-theme
  `--rv-pulse` token (8 themes) — the original `--rv-status-completed-bg`
  was 10% alpha green and visually invisible. User confirmed animated ring
  visible (gating step d) and reduced-motion static green border visible
  (gating step i) during 04-06 manual smoke.

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
result: pass
verified: 2026-04-29
notes: |
  Closed by Plan 04-06 (commit 06994f6). EventApiPill now uses a static
  `useEventLogStore` import; the connected-branch handler calls
  `useEventLogStore.getState().setOpen(true)` directly. User confirmed the
  pill click opened the event log drawer during 04-06 manual smoke step (e).
  See separate "Producer connection count over-reports" issue below — that
  is a display-count bug observed during the same step but does NOT regress
  the UAT-3 contract under test (click → drawer open).
verified_states:
  - idle (0 producers): pass — copies URL with Copied ✓ feedback
  - connected (1+ producers): pass — click opens event log drawer (verified 04-29 via 04-06 manual smoke)

### 4. Welcome screen URL copy (D-07)
test: On the welcome screen with the Event API running, locate the URL line near the footer and click the copy button.
expected: The `ws://127.0.0.1:47921` URL string is copied to clipboard.
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

### Drive-by (during Test 3 setup) — Drawer close affordance
test: With the drawer opened via the node integration panel `Open full log →` button (or via Ctrl+Shift+L), close the drawer using a discoverable affordance.
expected: A visible close button (or accessible close gesture such as Escape-while-focused) lets the user dismiss the drawer.
result: pass
verified: 2026-04-29
notes: |
  Closed by Plan 04-06 (commit 06994f6). New `[×]` close button rendered in
  every drawer render state with `aria-label="Close event log"`; clicking it
  calls `setOpen(false)`. Additionally, an Escape-when-focus-inside-drawer
  branch was added to `useKeyboardRouter.ts` (selector
  `section[aria-label="Event log"]`) — Phase 3 outside-drawer Escape semantics
  (cancel rename / deselect node) preserved and verified by behavioral test
  in `useKeyboardRouter.escape.test.tsx`. User confirmed both the [×] close
  click (smoke step f) and the inside-drawer Escape (smoke step g), and
  confirmed Phase 3 fall-through still fires for outside-drawer Escape (smoke
  step h).

### 6. Producer connection count over-reports (unexpected baseline + transient overshoot)
test: With only `wscat` connected as a producer, observe the EventApiPill's connected-count badge.
expected: Pill shows `● :47921 · 1` (one producer = the wscat session).
result: issue
reported: 2026-04-29
severity: medium
notes: |
  Discovered during 04-06 manual smoke step (e). User observed the pill
  displayed `● :47921 · 3` (occasionally briefly jumped to `4`) instead of
  the expected `1` when only the wscat session was the intentional producer.
  This does NOT regress the UAT-3 contract being tested in step (e) (clicking
  the pill correctly opens the event log drawer); it is a separate
  display/connection-accounting bug.

  ROOT CAUSES (orchestrator diagnosis — NOT fixed in this plan):

  1. Baseline overhead (steady state of 3):
     `plugins/claude-code/src/server.ts:9` opens a `wsClient` at module
     top-level. Every Claude Code session with the claude-code MCP server
     enabled holds its own persistent WS connection. Observed count = wscat
     (1) + each running Claude Code session (1+ each), so 2 active Claude
     Code sessions + 1 wscat = 3.

  2. Brief overshoot to 4 (transient):
     `plugins/claude-code/src/wsClient.ts:55-65` — the `close` event handler
     unconditionally fires `scheduleReconnect()`, including for sockets that
     never opened. When a failed handshake fires `error` then `close`, the
     `error` resolves the `connectOnce` promise → `connectLoop`'s while
     iteration retries; meanwhile the `close` handler schedules ANOTHER
     `connectLoop` via setTimeout. Two parallel `connectLoop`s race,
     transiently creating multiple sockets before they settle.
artifacts:
  - plugins/claude-code/src/server.ts
  - plugins/claude-code/src/wsClient.ts
  - packages/desktop/src/mainview/components/EventApiPill.tsx
  - packages/desktop/src/mainview/store/eventApiStore.ts
follow-up:
  - id: producer-count-overcount
    summary: |
      Suggest a small follow-up plan (e.g. 04-07 or a tail to Phase 4) covering:
      (a) wsClient retry-race fix — guard scheduleReconnect against firing
          for sockets that never opened, with a regression test exercising
          the `error → close` ordering on a failed handshake;
      (b) UX decision — whether the displayed producer count should subtract
          self-connections (Claude Code sessions hosting the MCP wrapper) so
          users see only "external" producers, or whether the raw socket
          count is the desired truth.
    raised_by: Plan 04-06 manual smoke step (e)
    severity: medium
    blocks_phase_closure: false

## Summary

total: 6
passed: 5
issues: 1
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "Producer count badge on EventApiPill reflects only intentional external producers (e.g. shows 1 when only wscat is connected)."
  status: failed
  reason: "User observed `● :47921 · 3` (occasionally briefly 4) when only wscat should be connected. Two distinct root causes: (1) every Claude Code session with the claude-code MCP server enabled holds its own persistent WS connection at module load (plugins/claude-code/src/server.ts:9 opens wsClient at top-level); (2) plugins/claude-code/src/wsClient.ts:55-65 unconditionally schedules reconnect on `close` even for sockets that never opened — failed handshakes race two concurrent connectLoops, transiently creating extra sockets."
  severity: medium
  test: 6
  artifacts:
    - plugins/claude-code/src/server.ts
    - plugins/claude-code/src/wsClient.ts
    - packages/desktop/src/mainview/components/EventApiPill.tsx
    - packages/desktop/src/mainview/store/eventApiStore.ts
  missing: []
  blocks_phase_closure: false
