# wscat command cheatsheet

Copy-paste ready. Run from repo root. Replace `a0000000-...` with a real node id from your loaded roadmap if you want the pulse to fire.

## Health check (no wscat needed)

```bash
curl -s http://127.0.0.1:47921/
# => {"service":"roadraven-event-api","ok":true}
```

## Pipe a full scenario

```bash
wscat -c ws://127.0.0.1:47921 -w 5 < packages/desktop/tests/manual/event-api/frames-happy-path.jsonl
wscat -c ws://127.0.0.1:47921 -w 5 < packages/desktop/tests/manual/event-api/frames-meta-payload.jsonl
wscat -c ws://127.0.0.1:47921 -w 5 < packages/desktop/tests/manual/event-api/frames-error-paths.jsonl
```

## Interactive — paste frame-by-frame

```bash
wscat -c ws://127.0.0.1:47921
```

Then at each `>` prompt paste any line from the `.jsonl` files.

## Single-frame one-shots

### Hello (must come first per connection — D-05 grace window 2s)

```bash
wscat -c ws://127.0.0.1:47921 -x '{"type":"hello","source":"uat-wscat","version":"1.0"}' -w 2
```

### Happy path — status transitions

```bash
wscat -c ws://127.0.0.1:47921 -x '{"type":"hello","source":"uat-wscat","version":"1.0"}' -x '{"nodeId":"a0000000-4102-4000-8000-000000000000","status":"in-progress"}' -w 5
```

```bash
wscat -c ws://127.0.0.1:47921 -x '{"type":"hello","source":"uat-wscat","version":"1.0"}' -x '{"nodeId":"a0000000-4102-4000-8000-000000000000","status":"completed"}' -w 5
```

```bash
wscat -c ws://127.0.0.1:47921 -x '{"type":"hello","source":"uat-wscat","version":"1.0"}' -x '{"nodeId":"a0000000-4102-4000-8000-000000000000","status":"blocked"}' -w 5
```

### Event with meta payload

```bash
wscat -c ws://127.0.0.1:47921 -x '{"type":"hello","source":"uat-wscat","version":"1.0"}' -x '{"nodeId":"a0000000-4102-4000-8000-000000000000","status":"in-progress","meta":{"taskId":"04-01","note":"UAT smoke test","attempt":1}}' -w 5
```

### Event with overridden source

```bash
wscat -c ws://127.0.0.1:47921 -x '{"type":"hello","source":"uat-wscat","version":"1.0"}' -x '{"nodeId":"a0000000-4102-4000-8000-000000000000","status":"in-progress","source":"override-source"}' -w 5
```

### Error — unknown_node

```bash
wscat -c ws://127.0.0.1:47921 -x '{"type":"hello","source":"uat-wscat","version":"1.0"}' -x '{"nodeId":"deadbeef-0000-0000-0000-000000000000","status":"in-progress"}' -w 2
```

### Error — invalid_status

```bash
wscat -c ws://127.0.0.1:47921 -x '{"type":"hello","source":"uat-wscat","version":"1.0"}' -x '{"nodeId":"a0000000-4102-4000-8000-000000000000","status":"halfway"}' -w 2
```

### Error — malformed JSON (note: literal text, no quoting)

```bash
wscat -c ws://127.0.0.1:47921 -x '{"type":"hello","source":"uat-wscat","version":"1.0"}' -x 'not json at all' -w 2
```

## Test 3 (D-06) — producer count + error pill

For the status-bar pill states described in `04-HUMAN-UAT.md` Test 3:

- **listening, 0 producers**: don't connect any client.
- **listening, 1+ producers**: hold a wscat session open with the interactive command above.
- **error**: send `not json at all` from the malformed one-shot — the pill should tick to error.

## PowerShell (Windows native)

PowerShell quoting differs — escape inner double-quotes by doubling them, or use single-quoted JSON:

```powershell
wscat -c ws://127.0.0.1:47921 -x '{\"type\":\"hello\",\"source\":\"uat-wscat\",\"version\":\"1.0\"}' -w 2
```

If that gets fiddly, the `bash`/Git Bash invocations above are simpler.
