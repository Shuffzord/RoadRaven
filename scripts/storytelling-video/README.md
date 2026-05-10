# Storytelling Video — Agent-Driven Flow

This directory implements the agent-driven recording flow for the ~75s
introductory video described in `.planning/storytelling-video.md`. Instead of
hand-animating Acts 1–3 in After Effects, the real RoadRaven app performs the
choreography itself — driven live by an MCP runner — so what you see is what
the product actually does.

## Files

| File | Role | Authored by |
|---|---|---|
| `timeline.json` | Ordered cue list (22 cues, 75s) — every MCP tool call with `at_ms`, `op`, `args`, optional `alias`/`captureRootAlias`, narrator beat | Choreographer agent |
| `demo.roadmap.json` | Final-state tree for the pitch — cross-checked against the timeline's implied shape | Asset Builder agent |
| `narration.cues.json` | Voiceover line-by-line with timestamps inside their act windows | VO Pacer agent |
| `validate-timeline.ts` | Pre-flight checker: alias ordering, monotonic timestamps, narration bounds, tree-shape parity | Director convergence check |
| `run.ts` | Deterministic runner — spawns the MCP server, plays cues with `setTimeout`-precise timing | Director (delegates to setTimeout, no LLM in loop) |

## Agent topology

The artifacts above are produced by four sub-agents coordinated by a Director:

```
                      Director Agent
                  (orchestrator, run 1×)
   ┌───────────────────┬────────────────┬──────────────────┐
   ▼                   ▼                ▼                  ▼
Choreographer    Asset Builder    Glyph Curator       VO Pacer
(timeline.json) (demo.roadmap)   (plugin icons)   (narration cues)

           run.ts — deterministic playback (no LLM)
                ▼
        plugins/claude-code MCP server (stdio child)
                ▼
        RoadRaven desktop app (operator launched, OBS recording)
```

The **deterministic runner** spawns its own copy of `plugins/claude-code/src/index.ts`
as a child process, speaks newline-delimited MCP JSON-RPC over stdio, and fires
each cue at its `at_ms` mark. LLM-driven runtime was rejected (latency drift
of 1–3s per turn would miss Act 3's sub-2s cadence); LLMs **author** the
artifacts, `setTimeout` **plays** them.

## Validate the timeline

```bash
bun scripts/storytelling-video/validate-timeline.ts
```

Five checks:
1. Every `@alias` referenced in `args` is captured by an earlier cue.
2. `at_ms` is strictly increasing across the cue list.
3. Each narration cue falls inside its declared act window.
4. The tree shape implied by `createNode`/`renameNode` cues equals the shape in `demo.roadmap.json`.
5. (Warning) Final per-node status from cues matches `demo.roadmap.json`.

Validator passes today with 22 cues + 13 narration lines.

## Record the video

1. **Launch the desktop app** so the WS Event API is up:
   ```bash
   bun run dev:hmr
   ```
2. **Start OBS recording** at the desired resolution.
3. **Run the runner**:
   ```bash
   bun scripts/storytelling-video/run.ts
   ```
4. **At t+60s** the runner fires `fitView`. If Prereq 2 has not landed (see
   below), the runner logs a hint and you manually click the TopBar
   "Fit View" button at that moment — visual is identical for the recording.
5. The runner holds the final frame until `t+75000ms`, then exits. Stop OBS.

The runner is deterministic. Same timeline.json + same demo state → bit-identical
recording. Retakes are trivial.

## Prerequisites (UI additions, shipped)

The flow depends on two small UI additions. Both shipped alongside the runner.

### Prereq 1 — Plugin glyph badge on nodes (shipped)
A 16px circular badge in the top-right corner of each node card lights up
when `node.plugin?.id` is set OR `liveEventMeta[nodeId].source` is fresh
within the 30s pulse window. Branded mapping:
- `claude-code` → orange "C" badge (`var(--rv-plugin-claude-code-bg)`)
- `github-actions` → blue "G" badge (`var(--rv-plugin-github-actions-bg)`)
- unknown plugin id → first letter on slate (`var(--rv-plugin-default-bg)`)

Files touched: `packages/desktop/src/mainview/components/RoadmapNode.tsx`,
`packages/desktop/src/mainview/index.css`.

### Prereq 2 — `cameraFitView` MCP tool (shipped)
The runner's last cue (Act 4 pull-back) fires `cameraFitView` which:
1. Calls `store.fitView()`
2. Store dispatches `roadraven:fit-view` CustomEvent
3. `Canvas.tsx` listener walks `nodePositionsRef`, computes bounding box,
   sets zoom + animates pan via existing `animatePanTo()` (900ms ease)

Files touched: store (`fitView` action), `Canvas.tsx` (event listener),
`agentRpcHandler.ts` (dispatch case), `agentToolSchemas.ts` (Bun gate),
`plugins/claude-code/src/server.ts` (tool registration).

The plugin's `dist/index.js` was rebuilt; if you publish the plugin from
this branch, downstream MCP hosts will see the new tool too.

## Out of scope (per .planning/storytelling-video.md Production Plan)

- Voiceover recording (human or ElevenLabs)
- Sound design (synth pad, click/thunk, chime sync)
- OBS scene config, frame grabs, GIF export pipeline
- Final card / logo / Act 4 post-edit overlay

The runner produces a clean live-driven take of Acts 1–4. Voiceover and sound
design are layered in post per the existing Production Plan.
