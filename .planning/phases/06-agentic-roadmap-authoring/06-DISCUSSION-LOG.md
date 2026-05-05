# Phase 6: Agentic Roadmap Authoring - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-05
**Phase:** 06-agentic-roadmap-authoring
**Areas discussed:** Tool scope for v1, App-required vs disk-direct reads, Concurrency with human edits, Destructive operation gating

---

## Tool scope for v1

### Q1: How wide should the v1 tool surface be?

| Option | Description | Selected |
|--------|-------------|----------|
| Full set as sketched | All 5 categories — reads + creates + updates + deletes + file lifecycle (~17 new tools). | ✓ |
| Reads + non-destructive create/update | All reads + createNode/createRoadmap + non-status updates. No delete, no file lifecycle. | |
| Reads + import a subtree | All reads + a single importSubtree tool. No fine-grained per-node mutations. | |
| Reads-only | Read tools only; defer all mutation to v1.1. | |

**User's choice:** Full set as sketched (recommendation).
**Notes:** Delivers the "scaffold a roadmap from a prompt" end-to-end story.

### Q2: How should the agent build a tree from scratch?

| Option | Description | Selected |
|--------|-------------|----------|
| Single-node createNode only | Per-node tool calls; no atomic bulk import. | ✓ |
| Both — single + importSubtree | createNode for incremental + importSubtree for atomic bulk. | |
| importSubtree only | Always send a complete subtree, even for single adds. | |

**User's choice:** Single-node createNode only — deviated from the recommendation (Both).
**Notes:** Atomic bulk-paste stays a human Ctrl+V capability; agents take the slow road. Simpler primitives accepted at the cost of ~N tool calls per scaffold.

### Q3: What query shape should findNodes accept?

| Option | Description | Selected |
|--------|-------------|----------|
| Title substring only | findNodes({titleContains: string}); agent filters status/type/metadata client-side. | |
| Structured filter object | findNodes({titleContains?, status?, type?, metaKey?, metaValue?, parentId?}) AND across fields. | ✓ |
| Free-form text query | DSL like 'word1 word2 status:done type:epic'. | |

**User's choice:** Structured filter object (recommendation).
**Notes:** Server-side AND across fields; reuses nodeIndex for O(N) walk. No DSL.

### Q4: How should updateNodeMetadata behave?

| Option | Description | Selected |
|--------|-------------|----------|
| Merge | Shallow-merge patch into existing metadata; null deletes a key. | ✓ |
| Replace | Overwrites entire metadata object; agent must read-then-write. | |
| Both — separate tools | updateNodeMetadata (merge) + replaceNodeMetadata (full overwrite). | |

**User's choice:** Merge (recommendation).
**Notes:** PATCH-like semantics; safer default for agents that don't have the full picture.

---

## App-required vs disk-direct reads

### Q5: Should read tools work when the desktop app is off?

| Option | Description | Selected |
|--------|-------------|----------|
| App-required for everything | All tools require the app running; sentinel-missing returns Phase 4 error. | ✓ |
| Reads fall back to disk; writes need app | Read tools accept a path arg, parse JSON from disk; no live overlay. | |
| MCP server can launch the app | Tool detects sentinel missing and launches the app. | |

**User's choice:** App-required for everything (recommendation).
**Notes:** Single source of truth = renderer store; reads see the live event overlay. No disk-direct fallback in v1.

### Q6: When the app is up but no roadmap is loaded, what should reads return?

| Option | Description | Selected |
|--------|-------------|----------|
| Distinct 'no file loaded' error | Structured error with hint to call openFile. | ✓ |
| Empty/null result | getRoadmap returns null; findNodes returns []. | |
| Auto-open most recent file | Tool triggers loading of most-recent file before returning. | |

**User's choice:** Distinct 'no_file_loaded' structured error (recommendation).
**Notes:** Distinguishable from "app not running" so the agent reacts differently.

### Q7: What status should reads return for a node with a live-event overlay?

| Option | Description | Selected |
|--------|-------------|----------|
| Merged — live overlay wins | getNode.status returns what the user sees on the badge. | ✓ |
| Authored only | Always returns the value persisted in the JSON file. | |
| Both fields | Returns { status, liveStatus, lastEventAt, source }. | |

**User's choice:** Merged — live overlay wins (recommendation).
**Notes:** Agent reasons about "current state of the world." 30s overlay window from Phase 4 D-14 still applies.

---

## Concurrency with human edits

### Q8: What's the default behavior when an agent mutation arrives while the human is editing the same node?

| Option | Description | Selected |
|--------|-------------|----------|
| Last-write-wins, silent | Agent ops apply through existing store mutations; no locks/modals/queues. | ✓ |
| Queue while a text input is focused | Agent op queues until focus-blur or 2s idle. | |
| Conflict toast — agent op pending | Toast 'Agent wants to update [node]. [Apply] [Reject]'; tool blocks. | |
| Read-only lock during agent op | Modal 'Claude is editing the roadmap...' covers the canvas. | |

**User's choice:** Last-write-wins, silent (recommendation).
**Notes:** Matches Phase 4 D-11's overlay model. Simplest, most live-feeling behavior.

### Q9: How should agent mutations surface in the UI after they land?

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse the Phase 4 event log drawer | Synthetic IntegrationEvents with source='claude-code' and tool-name. | ✓ |
| Pulse + status-bar pill (no log) | Mutated nodes pulse; pill shows 'Claude editing...'. | |
| Both — pulse and log | Drawer record + per-node pulse. | |
| Silent — git diff is the audit trail | No in-app indication. | |

**User's choice:** Reuse the Phase 4 event log drawer (recommendation).
**Notes:** Drawer is the durable audit channel. Explicitly NO new pulse on agent mutations — node-appearance/movement is the in-canvas visual signal; pulse stays Phase 4's "live event" indicator.

### Q10: When should an agent tool call return 'ok'?

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse existing autosave | Tool returns on store-mutation; debounce/periodic/before-quit handle durability. | ✓ |
| Synchronous write per tool call | Each mutating tool flushes the autosave debouncer before returning. | |
| Configurable per tool | Default reuse autosave; agent passes `flush: true` for final steps. | |

**User's choice:** Reuse existing autosave (recommendation).
**Notes:** Same crash-window guarantees as a human edit. Bursts coalesce naturally.

---

## Destructive operation gating

### Q11: How should destructive agent operations be gated?

| Option | Description | Selected |
|--------|-------------|----------|
| Tool-args only — explicit cascade flag | deleteNode requires {nodeId, cascade:true} for non-leaf; openFile/saveFileAs use existing path-traversal allowlist. | ✓ |
| Route through the existing UI modal | Agent's deleteNode triggers Phase 3's confirmation modal; tool blocks. | |
| Per-tool toggle in .roadmap-settings.json | agentApi.confirmDelete / confirmOpenFile / confirmSaveAs toggles. | |
| Disallow in v1 | Don't ship deleteNode/openFile/saveFileAs at all in v1. | |

**User's choice:** Tool-args only — explicit cascade flag (recommendation).
**Notes:** Agent has full responsibility; trusts Claude Code's host-level approval. No UI confirmation.

### Q12: When agent calls openFile(path) with unsaved edits, what should happen?

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-flush autosave then open | Synchronous flush before opening; flush failure surfaces as openFile failure. | ✓ |
| Hard-fail — require explicit saveFile first | Tool returns error; agent must choreograph save → open. | |
| Discard silently | openFile drops in-memory edits. | |

**User's choice:** Auto-flush autosave then open (recommendation).
**Notes:** No data loss. If flush fails, open fails too with the saveFile error.

### Q13: What paths should the agent be allowed to read/write via openFile/saveFileAs?

| Option | Description | Selected |
|--------|-------------|----------|
| Same allowlist as user actions | Same dir, $ref-siblings, recent files, picker-history paths. | ✓ |
| Allow any path under user home | $HOME / %USERPROFILE% scope. | |
| Require new picker prompt per agent call | First agent call to a new path triggers a system file-picker. | |

**User's choice:** Same allowlist as user actions (recommendation).
**Notes:** Reuses isPathWithinMainDir / pushDialogAllowlistPath. User widens by opening the dir manually first.

---

## Claude's Discretion

The user explicitly deferred these to the planner / Claude (see CONTEXT.md "Claude's Discretion"):

- Exact MCP tool naming convention (e.g., `getRoadmap` vs `roadraven_getRoadmap`)
- WebSocket request/response framing mechanism (correlation IDs, JSON-RPC, envelope format)
- Specific shape of Bun → renderer RPC additions (per-tool methods vs generic dispatcher)
- Whether `getRoadmap` paginates or always returns the full tree
- How `getNode` reports ancestry
- Subtree depth in `getNode` / `getRoadmap` responses
- Synthetic IntegrationEvent shape for agent activity in the drawer
- Tool error response taxonomy
- Idempotency keys for create operations
- Whether `createRoadmap` mirrors File > New exactly
- Tool-input Zod validation specifics
- Bun-side logging (LogTape category, structured fields)
- Optional kill-switch setting (`agentApi.enabled: false` in `.roadmap-settings.json`)

## Deferred Ideas

(See CONTEXT.md `<deferred>` section for the full list with rationale.)

- importSubtree atomic bulk import — v1.1 if agent-latency complaints surface
- Pulse animation on agent-mutated nodes — v1.1 if visibility complaints surface
- Conflict UI / queue / lock for concurrent edits — v1.1 if collisions become real
- Synchronous-flush-per-tool-call durability — v1.1 if crash-loss complaints surface
- Auto-launching the desktop app from a tool call — v1.1 territory at most
- Disk-direct read fallback when app is off — v1.1 if a headless agent use case emerges
- Per-tool settings toggles (confirm* knobs) — v1.1 if needed
- System-picker prompt per agent path — v1.1 if needed
- Multi-agent / agent identity beyond `source` field — out of scope for v1.0
- Plugin host activation (PLUG-V2-01..V2-09) — v1.1 (Phase 6 stays Tier 1)
