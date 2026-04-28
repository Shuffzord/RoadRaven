# Event API — manual WebSocket scenarios

Frames built against the Zod schemas in `packages/desktop/src/bun/eventSchema.ts`:

```typescript
type HelloFrame = { type: "hello"; source: string; version?: string };
type EventFrame = {
  nodeId: string;
  status: string;
  meta?: Record<string, unknown>;  // <= 8KB JSON-stringified
  source?: string;                  // overrides hello-frame source
};
```

All scenarios use the placeholder `nodeId` `a0000000-4102-4000-8000-000000000000`. Replace it with a real node id from your loaded roadmap if you want to see the pulse animation — the allowlist filters everything else into the `unknown_node` error class.

## Find a real nodeId

In RoadRaven DevTools (Ctrl+Shift+I in the renderer):

```js
__roadraven_store?.getState().schema.nodes[0].id
```

Or click any node and read the id from the side-panel header.

## Files

| File | Scenario |
|------|----------|
| `frames-happy-path.jsonl` | hello + four status transitions (`in-progress` → `completed` → `blocked` → `not-started`) |
| `frames-meta-payload.jsonl` | hello + event with `meta` payload + event with overridden `source` |
| `frames-error-paths.jsonl` | hello + `unknown_node` + `invalid_status` + `malformed` |

## Run modes

### Interactive (paste at `>` prompt)

```bash
wscat -c ws://127.0.0.1:47921
```

Then paste each line of any `.jsonl` file in turn.

### Pipe a whole scenario

`wscat` reads each stdin line as a separate message:

```bash
wscat -c ws://127.0.0.1:47921 -w 5 < packages/desktop/tests/manual/event-api/frames-happy-path.jsonl
```

The `-w 5` keeps the socket open 5s after the last frame so you can watch the pulse decay (the indicator clears at ~30s after the last event).

### One-shot single frame

```bash
wscat -c ws://127.0.0.1:47921 -x '{"type":"hello","source":"uat-wscat","version":"1.0"}' -w 2
```

Use this to fire a single error/edge-case frame without juggling stdin.

## Expected outcomes

| Frame class | Pulse animation | Status badge updates | Drawer row | Error pill |
|-------------|-----------------|---------------------|------------|------------|
| Happy path  | yes (~30s) | yes | yes | unchanged |
| `unknown_node` | no | no | yes (with `_error: unknown_node`) | tick |
| `invalid_status` | no | no | yes (with `_error: invalid_status`) | tick |
| `malformed` | no | no | yes (synthesized line) | tick |

Source: `packages/desktop/src/bun/eventServer.ts` — `parseIncoming` + `classifyEventFrame`.

## Reduced-motion fallback (Test 1, PLUG-04 / D-15)

After firing a happy-path frame, toggle Win11 reduced-motion:
**Settings → Accessibility → Visual effects → Animation effects: Off**

The `rv-node-pulse` ring should swap to a static 2px solid outline while the live state persists.
