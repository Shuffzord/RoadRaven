---
phase: 06-agentic-roadmap-authoring
reviewed: 2026-05-07T00:00:00Z
fixed_at: 2026-05-10T00:00:00Z
depth: standard
files_reviewed: 24
files_reviewed_list:
  - packages/desktop/src/bun/agentRequestHandler.ts
  - packages/desktop/src/bun/eventSchema.ts
  - packages/desktop/src/bun/eventServer.ts
  - packages/desktop/src/bun/eventServerStandalone.ts
  - packages/desktop/src/bun/index.ts
  - packages/desktop/src/mainview/rpc.ts
  - packages/desktop/src/mainview/rpc/agentRpcHandler.ts
  - packages/desktop/src/mainview/store/roadmapStore.ts
  - packages/desktop/tests/integration/eventApi.test.ts
  - packages/desktop/tests/unit/bun/agentRequestHandler.test.ts
  - packages/desktop/tests/unit/bun/eventServer.eaddrinuse.test.ts
  - packages/desktop/tests/unit/bun/eventServer.test.ts
  - packages/desktop/tests/unit/mainview/agentRpcHandler.test.ts
  - packages/desktop/tests/unit/store/roadmapStore.moveNode.test.ts
  - plugins/claude-code/README.md
  - plugins/claude-code/src/server.ts
  - plugins/claude-code/src/tools/agentToolCallback.ts
  - plugins/claude-code/src/tools/errors.ts
  - plugins/claude-code/src/tools/schemas.ts
  - plugins/claude-code/src/wsClient.ts
  - plugins/claude-code/tests/agent-contracts.test.ts
  - plugins/claude-code/tests/scaffold.e2e.test.ts
  - plugins/claude-code/tests/wsClient.request.test.ts
  - shared/types.ts
findings:
  blocker: 3
  warning: 9
  total: 12
status: all_fixed
fix_status:
  CR-01: fixed
  CR-02: fixed
  CR-03: fixed
  WR-01: fixed
  WR-02: fixed
  WR-03: fixed
  WR-04: fixed
  WR-05: fixed
  WR-06: fixed
  WR-07: fixed
  WR-08: fixed
  WR-09: fixed
---

# Phase 6: Code Review Report

**Reviewed:** 2026-05-07
**Depth:** standard
**Files Reviewed:** 24
**Status:** issues_found

## Summary

Phase 6 introduces a security-sensitive surface: external MCP agents can now drive
mutations against the in-memory roadmap via a localhost WebSocket. The implementation
follows the documented gate sequence (kill-switch → path-allowlist → cross-ref →
renderer dispatcher → cascade/cycle/last-root) but contains three correctness defects
that allow data loss or gate bypass:

1. **`moveNode(X, X)` silently deletes node X** because neither the dispatcher cycle
   check nor the store action covers `nodeId === newParentId`.
2. **The cycle-detection helper does not catch a node moving onto itself** (it only
   walks `root.children`, never compares `root` itself to `candidateId`).
3. **The cross-ref boundary gate is permissive on agent-created nodes** — newly
   created nodes are absent from the ownership map, so `owner1 && owner2` is false
   and the gate skips silently.

Several quality and robustness defects compound the security surface: missing per-tool
input validation on the Bun side (Zod schemas only run inside the plugin), unsafe
type casts in the dispatcher, an `openFile` autosave-timeout that surfaces as
`internal_error` instead of an actionable code, an unguarded `pushDialogAllowlistPath`
that grows monotonically across file changes, direct schema-object mutation in
`createRoadmap` that bypasses Zustand reactivity, and the audit-drawer event
embedding unbounded `args` payloads.

The test suite covers the happy paths and most error codes but does NOT test the
specific cycle/self-move case identified in CR-01 — `roadmapStore.moveNode.test.ts`
asserts only "node-not-found" and "parent-not-found" no-ops, never `moveNode(X, X)`.

## Blocker Issues

### CR-01: `moveNode(X, X)` silently deletes node X

**File:** `packages/desktop/src/mainview/rpc/agentRpcHandler.ts:425-452`
**File:** `packages/desktop/src/mainview/store/roadmapStore.ts:657-689`

**Issue:** The dispatcher accepts `moveNode({nodeId: X, newParentId: X})` and forwards
to `store.moveNode`. The store action then:

1. Calls `findParentAndIndex(nodes, nodeId)` — succeeds (returns the current parent).
2. `nodesAfterRemove = immutablyReplaceArray(nodes, currentParentId, arr => arr.splice(found.index, 1))`
   — node X is removed from the tree.
3. `nextNodes = immutablyReplaceArray(nodesAfterRemove, newParentId /* === X */, ...)`
   — `immutablyReplaceArray` walks the tree looking for a node with id `X`, but X
   was just removed. The mutator callback is never invoked.
4. `bumpStructural(nextNodes)` commits a tree with X gone.

The dispatcher's `isDescendantOf(nodeId, newParentId, ...)` (line 442) does not catch
this — it only walks `root.children` and never compares `root.id === candidateId`
(see CR-02). The Bun-side cross-ref gate (`agentRequestHandler.ts:111-135`) also
does not catch this — it compares ownership of two ids and bails out only if they
differ (`owner1 !== owner2`); for `nodeId === newParentId` they trivially match.

**Impact:** An agent (or a malicious WS client connecting directly to the localhost
port) can erase any node from the tree by issuing `moveNode({nodeId, newParentId: nodeId})`.
The deletion bypasses the `cannot_delete_last_root` gate and the `cascade_required`
gate. The drawer audit row records `tool: moveNode`, not `deleteNode`, so log
review will not catch the data loss.

**Fix:** Reject `nodeId === newParentId` in the dispatcher (preferred — the
store action is already documented as "callers have validated"):

```ts
case "moveNode": {
  const nodeId = args.nodeId as string;
  const newParentId = args.newParentId as string;
  if (nodeId === newParentId) {
    return {
      ok: false,
      error: "Cannot move a node onto itself.",
      code: "move_would_create_cycle",
    };
  }
  // ...existing checks...
}
```

Add a regression test to `roadmapStore.moveNode.test.ts` that asserts
`moveNode(X, X)` is a no-op (or rejected upstream) — the current test file's three
cases do not cover this.

---

### CR-02: `isDescendantOf` cycle-detection helper misses self-move

**File:** `packages/desktop/src/mainview/rpc/agentRpcHandler.ts:18-33`

**Issue:** The helper:

```ts
function isDescendantOf(rootNodeId, candidateId, nodeIndex): boolean {
  const root = nodeIndex.get(rootNodeId);
  if (!root) return false;
  const stack: RoadmapNode[] = [...(root.children ?? [])];
  while (stack.length) {
    const n = stack.pop()!;
    if (n.id === candidateId) return true;
    if (n.children) stack.push(...n.children);
  }
  return false;
}
```

Returns `false` for `isDescendantOf(X, X, ...)` — root itself is never compared
to `candidateId`. The function name implies it answers "is `candidateId` in the
subtree rooted at `rootNodeId`?" — the tree rooted at X *includes* X, but this
helper excludes the root by construction.

**Impact:** Direct cause of CR-01. Also weakens the cycle gate for any caller
that expected reflexive coverage. Not currently called from anywhere else, but the
function signature does not signal "excludes root" — future callers will hit
the same trap.

**Fix:** Either include the root in the check, or rename to make the exclusion
explicit (`isStrictDescendant` or similar).

```ts
function isDescendantOf(rootNodeId, candidateId, nodeIndex): boolean {
  if (rootNodeId === candidateId) return true; // a node is in its own subtree
  const root = nodeIndex.get(rootNodeId);
  if (!root) return false;
  // ...rest unchanged...
}
```

Note: this also has the side-benefit of fixing CR-01 in one stroke, because the
existing `if (isDescendantOf(nodeId, newParentId, ...))` in `moveNode` would then
catch the self-move case naturally.

---

### CR-03: Cross-ref boundary gate fails open for agent-created nodes

**File:** `packages/desktop/src/bun/agentRequestHandler.ts:111-135`

**Issue:** The gate:

```ts
const owner1 = ownershipMap?.get(nodeId);
const owner2 = ownershipMap?.get(newParentId);
if (owner1 && owner2 && owner1 !== owner2) {
  // reject cross_ref_boundary
}
```

The ownership map (`refMap.ts`) is populated only at `loadFile` time, by walking
the resolved tree and tagging every visited node with its owning file. Nodes
created via `createNode` (agent tool, dispatcher line 285-309) are inserted into
the renderer-side tree via `store.addChild` and never propagated back to the Bun-
side ownership map — see `setOwnership` callsites: only `resolveRefs.ts:75`. As
a result, `ownershipMap.get(newCreatedNodeId)` returns `undefined`, the
`owner1 && owner2` guard short-circuits to false, and the cross-ref gate skips.

**Impact:** Phase 3 EDIT-16 invariant ("cross-`$ref`-boundary moves are blocked")
is violated for any node the agent created since the last `loadFile`. An agent
can `createNode` under a `$ref`-loaded subtree, then `moveNode` it into a node
in the main file's owned area (or vice-versa) with no rejection. On the next
`saveFile`, `splitSchemaByOwnership` will assign the orphan to the main file by
default, silently disconnecting it from the `$ref` it was supposedly created
under.

**Fix:** Default to "deny" semantics when ownership is unknown — both ids must
have an explicit owner, OR require that the renderer push every newly-created
node's ownership back to Bun (mirror of `pushOwnershipMap` in reverse). Minimum
fix:

```ts
if (owner1 !== owner2) {
  // owner being undefined for either side now also rejects;
  // renderer-side dispatcher should populate ownership on createNode
  // before the next moveNode. For v1, agents must not move freshly
  // created nodes across boundaries — this is documented in the README.
  ...
}
```

Or, more robust: have the dispatcher track per-node ownership inheritance on
`createNode` (child inherits parent's owner) and push that map up to Bun on every
mutation. Either way, the current "bail out unless both owners present and
different" is the wrong default for a security gate.

---

## Warnings

### WR-01: No per-tool input validation on the Bun side; renderer relies on cast

**File:** `packages/desktop/src/bun/eventSchema.ts:35-40`
**File:** `packages/desktop/src/mainview/rpc/agentRpcHandler.ts` (multiple sites)

**Issue:** `AgentRequestSchema` validates only the envelope — `params` is
`z.record(z.string(), z.unknown())`. Per-tool input validation lives only in
`plugins/claude-code/src/tools/schemas.ts`, which runs INSIDE the MCP plugin, not
inside the desktop app. A direct WebSocket client (or a non-Claude-Code MCP
plugin) can connect to `ws://127.0.0.1:47921` and send any shape it likes.

The renderer dispatcher then does unsafe casts: `args.nodeId as string`,
`args.patch as Record<string, unknown | null>`, `args.position as number | undefined`,
`args.statusConfig as typeof post.schema.statusConfig` — none of which actually
check the type. Real-world consequences:

- `updateNodeMetadata({patch: 42})` → `Object.entries(42)` returns `[]`, no-op
  silently (no error returned to caller).
- `updateNodeMetadata({patch: null})` → `Object.entries(null)` throws TypeError
  → caught by `agentRequestHandler` outer try/catch → returns `internal_error`
  with no actionable detail.
- `moveNode({position: "first"})` → `args.position as number | undefined` is the
  string `"first"`; `Math.min("first", copy.length)` returns NaN; `splice(NaN, 0, node)`
  splices at index 0. Wrong placement, no error.
- `createRoadmap({statusConfig: "x"})` → `Array.isArray("x")` is false, branch
  skipped. Quiet success.

**Fix:** Add Bun-side per-tool Zod validation (mirror of the plugin's schemas)
before forwarding to the renderer. The dispatcher should still treat its inputs
as already-validated, but at least one layer must validate. The simplest fix is
to import the plugin's schemas (or duplicate them in a shared module) and
`safeParse` against the tool name as a discriminator.

---

### WR-02: `pushDialogAllowlistPath` accumulates paths with no expiry/cleanup

**File:** `packages/desktop/src/bun/agentRequestHandler.ts:107`

**Issue:** Every successful `openFile` and `saveFileAs` agent call adds the
target path to `dialogAllowlist` (a `Set<string>` in `saveFile.ts`). The allowlist
is never trimmed — when the user opens a different roadmap (different `mainDir`),
the old paths remain in the allowlist. A subsequent agent `saveFile({filePath})`
with a path the user no longer "owns" will pass `isAllowlisted()` because the
set is global to the process.

**Impact:** The path-traversal mitigation degrades over time. After a user
opens roadmap-A from `/a/`, then roadmap-B from `/b/`, an agent can write to
`/a/somefile.json` because the allowlist still contains it. This is a slow
violation of D-13 (path within currently-loaded main file's dir).

The current handler also calls `pushDialogAllowlistPath(path)` BEFORE the
renderer call returns — even if openFile fails (file missing, JSON broken),
the path is still in the allowlist for future writes.

**Fix:** Clear `dialogAllowlist` on every `loadFile` / `setCachedMainPath` (the
existing path-allowlist concept is rooted at the main dir; once main dir
changes, prior session paths should be invalidated). Move the
`pushDialogAllowlistPath` call to AFTER the renderer reports success.

---

### WR-03: `createRoadmap` mutates schema object directly, bypassing Zustand

**File:** `packages/desktop/src/mainview/rpc/agentRpcHandler.ts:311-337`

**Issue:**

```ts
case "createRoadmap": {
  store.newUntitledSchema();
  const post = useRoadmapStore.getState();
  if (post.schema) {
    if (typeof args.title === "string") post.schema.title = args.title;
    if (Array.isArray(args.statusConfig)) {
      post.schema.statusConfig = args.statusConfig as typeof post.schema.statusConfig;
    }
    if (Array.isArray(args.typeConfig)) {
      post.schema.typeConfig = args.typeConfig as typeof post.schema.typeConfig;
    }
  }
  ...
}
```

The post-creation overrides directly mutate `post.schema` (the same object
reference Zustand holds). No `set()` call — Zustand's subscribers are not
notified of the title/configs change. The drawer audit (and any UI bound to
`schema.title`) will not re-render until something else triggers a state update.

Worse, `args.statusConfig as typeof post.schema.statusConfig` is unchecked.
A malformed config (missing required `id` or `label`) passes through; subsequent
operations that assume `statusConfig` items have an `id` will throw or behave
incorrectly.

**Fix:** Use a proper store action to apply the overrides, with Zod validation
of statusConfig/typeConfig:

```ts
const updates: Partial<RoadmapSchema> = {};
if (typeof args.title === "string") updates.title = args.title;
if (Array.isArray(args.statusConfig)) {
  const parsed = z.array(StatusConfigSchema).safeParse(args.statusConfig);
  if (parsed.success) updates.statusConfig = parsed.data;
}
// ... similar for typeConfig ...
useRoadmapStore.setState((s) => ({
  schema: s.schema ? { ...s.schema, ...updates } : s.schema,
}));
```

---

### WR-04: `openFile` autosave-timeout surfaces as `internal_error`

**File:** `packages/desktop/src/mainview/rpc/agentRpcHandler.ts:550-572`

**Issue:** The `openFile` dispatcher branch waits up to 5 seconds for autosave
to flush before loading the new file:

```ts
await new Promise<void>((resolve, reject) => {
  const t = setTimeout(() => {
    unsub();
    reject(new Error("autosave timeout"));
  }, 5000);
  ...
});
```

If the timeout fires, the rejection propagates out of `handleAgentRequest` and
is caught by `agentRequestHandler.ts:169-178`, which returns the generic
`internal_error` code with message "An internal error occurred." The agent has
no way to distinguish "autosave timed out — your previous file was not saved"
from any other internal failure.

**Impact:** Data-loss risk is masked. The agent might assume the open succeeded
silently and proceed with mutations under the new file, abandoning the unsaved
work in the old one.

**Fix:** Catch the timeout in the dispatcher branch and return a structured
error (e.g., a new `save_error` code, or a dedicated `autosave_timeout`):

```ts
try {
  await new Promise<void>(...);
} catch {
  return {
    ok: false,
    error: "Autosave did not complete within 5s. Previous file may be unsaved.",
    code: "save_error",
    hint: "Call saveFile manually before retrying openFile.",
  };
}
```

---

### WR-05: Drawer-audit `meta.args` has unbounded size; row cap is 1000

**File:** `packages/desktop/src/mainview/rpc/agentRpcHandler.ts:42-62`
**File:** `packages/desktop/src/mainview/store/eventLogStore.ts:5,45-53`

**Issue:** `appendAgentDrawerEvent` stuffs the entire `args` payload into
`event.meta.args`. For tools like `updateNodeNotes` (notes is unbounded markdown)
or `createNode` (metadata can be arbitrary), this can be megabytes per row.
`EVENT_LOG_ROW_CAP = 1000` rows cap, so worst case the drawer holds ~1000
megabytes of agent-supplied data — a memory pressure vector that an agent (or
malicious WS client) can trigger by spamming `updateNodeNotes` with large
payloads.

The eventSchema's `META_MAX_BYTES = 8 * 1024` cap applies only to event-frame
meta, NOT to drawer-audit entries built renderer-side.

**Fix:** Truncate or strip large fields when writing to the drawer audit:

```ts
const auditArgs = sanitizeForAudit(args); // omit notes/metadata when > N bytes
event.meta = { tool, args: auditArgs, label: `Claude → ${tool}` };
```

Or apply the same 8KB cap on the renderer side.

---

### WR-06: `eventServerStandalone` does not exit on invalid `ROADRAVEN_EVENT_PORT`

**File:** `packages/desktop/src/bun/eventServerStandalone.ts:13-22`

**Issue:**

```ts
if (envPortRaw && (envPortParsed === null || Number.isNaN(envPortParsed))) {
  process.stderr.write(
    `${JSON.stringify({ ok: false, error: "invalid_port", value: envPortRaw })}\n`,
  );
}
```

Logs the error but does not `process.exit(1)`. Execution falls through to
`requestedPort = envPort ?? DEFAULT_PORT` where `envPort` is null (because
`envPortParsed` was NaN), so the standalone silently binds the default port
47921 instead of the user-requested invalid value. The parent E2E test cannot
distinguish "invalid port → using default" from "invalid port → boot failed."

**Fix:** Exit non-zero on invalid env port:

```ts
if (envPortRaw && (envPortParsed === null || Number.isNaN(envPortParsed))) {
  process.stderr.write(
    `${JSON.stringify({ ok: false, error: "invalid_port", value: envPortRaw })}\n`,
  );
  process.exit(1);
}
```

---

### WR-07: `agentRequestHandler` annotates `getOwnership()` with a never-true type

**File:** `packages/desktop/src/bun/agentRequestHandler.ts:117-120`

**Issue:**

```ts
const ownershipMap = getOwnership() as
  | Map<string, string>
  | undefined
  | null;
```

`getOwnership()` (refMap.ts:47) is declared `(): OwnershipMap` and always returns
the module-level `activeOwnership` Map (initialized to `new Map()` and replaced
by `buildOwnershipMap` / `clearOwnershipMap`). It is never undefined or null.
The cast is misleading and the subsequent `ownershipMap?.get(...)` adds a
runtime branch that can never fire.

This is also a defensive bug-hide: if a future refactor of refMap accidentally
returns null, this cast suppresses the resulting type error and the gate
silently fails open.

**Fix:** Drop the cast. If defensive checks are wanted, assert a non-null
return at call time and fail loud.

```ts
const ownershipMap = getOwnership(); // typed as Map<string,string>
const owner1 = ownershipMap.get(nodeId);
const owner2 = ownershipMap.get(newParentId);
```

---

### WR-08: `'__lifecycle__'` magic string used as nodeId in drawer events

**File:** `packages/desktop/src/mainview/rpc/agentRpcHandler.ts:42-49,326-332,498-503,527-533,584-589`

**Issue:** Lifecycle tools (`createRoadmap`, `saveFile`, `saveFileAs`, `openFile`)
synthesize an audit-drawer event with `nodeId: "__lifecycle__"`. Any consumer
that looks up `nodeIndex.get(event.nodeId)` for these rows will return undefined
and may trip null checks downstream. Filter UIs that show "rows for selected
node" will not match these rows for any selection, which is the intent — but
filter UIs that allow "exclude lifecycle events" need to know this magic string.
Worse: nothing prevents a real node from being assigned the literal id
`"__lifecycle__"` (UUIDs are not strictly enforced for `node.id` in the schema —
see `eventSchema.ts:13` "permissive — NOT .uuid() per RESEARCH §2.1").

**Fix:** Add a separate `kind: "lifecycle" | "node"` field to the drawer audit
event metadata, instead of overloading `nodeId` with a sentinel value. Or, if
keeping the sentinel, declare it as an exported constant and document it in the
`IntegrationEvent` type.

---

### WR-09: `walkAndMerge` rebuilds the entire tree on every `getRoadmap` call

**File:** `packages/desktop/src/mainview/rpc/agentRpcHandler.ts:135-148,209-224`

**Issue:** `getRoadmap` calls `walkAndMerge` per root, which clones every node
top-down (`{ ...merged, children: merged.children.map(...) }`). The internal
`mergeLiveStatus` is documented as a no-op — Phase 4 already mutated
`node.status` in place. So `walkAndMerge` allocates a full copy of the tree
purely to re-assert an invariant that the comments admit is already maintained.

(Performance is out-of-scope per the review charter, but this is also a quality
signal: dead-by-construction code is harder to maintain. If `mergeLiveStatus`
is truly a no-op, `getRoadmap` can return `schema.nodes` directly. If it is NOT
a no-op in some future configuration, the tree clone should be conditional on
a non-empty `liveEventMeta` window.)

**Fix:** Either return `schema!.nodes` directly with a comment pointing to the
in-place mutation invariant, or simplify `walkAndMerge` to a single pass that
short-circuits when `liveEventMeta` is empty:

```ts
case "getRoadmap": {
  const hasLive = Object.keys(liveEventMeta).length > 0;
  const nodes = hasLive
    ? schema!.nodes.map((n) => walkAndMerge(n, liveEventMeta))
    : schema!.nodes;
  return { ok: true, data: { schema: { ...schema!, nodes }, ... } };
}
```

---

## Notes (non-blocking observations)

- **`AgentRequestSchema.method` accepts any non-empty string.** That is by design
  (forward compatibility for new tools), but it means a typo'd tool name from
  the plugin produces an `unknown_tool` round-trip instead of being caught at
  the WS-frame parse stage. Consider validating against
  `["getRoadmap", "getNode", ...19 names]` if the registry is stable.

- **`wsClient.request` does not enforce a max payload size.** A malicious or
  buggy server could send a multi-MB response and the JSON.parse would block
  the event loop. Out-of-scope (perf), but worth noting for future hardening.

- **`scaffold.e2e.test.ts` at `plugins/claude-code/tests/` cross-imports from
  `packages/desktop/src/mainview/...`.** This crosses workspace boundaries and
  defeats package isolation; if the plugin is published to npm, this file
  cannot be shipped. Move the connectivity test to `packages/desktop/tests/` or
  refactor it to drive the WebSocket transport rather than the in-process
  dispatcher.

- **`openFile` dispatcher branch dynamically imports `../store/roadmapStore`
  twice** (lines 549, then implicitly via the top-of-handler import at line
  187). The second import returns the cached module so it is correct, but
  reads as redundant.

- **`pushOwnershipMap` renderer handler is a no-op** (`rpc.ts:45-49`). The
  renderer should be the source of ownership truth post-Phase-6 (it owns
  mutations and should propagate ownership for new nodes back to Bun). Related
  to CR-03.

---

_Reviewed: 2026-05-07_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
