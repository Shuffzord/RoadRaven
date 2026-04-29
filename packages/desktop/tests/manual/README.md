# Manual tests

Tests that need a human, a running app, or external CLI tooling — anything that can't run inside `vitest` or `bun test`.

This folder is **excluded from automated runs** (see `packages/desktop/vitest.config.ts` — `tests/manual/**` is not in the `include` globs).

## Layout

| Path | Purpose |
|------|---------|
| `event-api/` | WebSocket frames + commands for exercising the Bun Event API at `ws://127.0.0.1:47921` |

## Prerequisites

1. RoadRaven must be running (`bun run dev:hmr`).
2. A roadmap with at least one node must be loaded (the Event API allowlist is sourced from the live store via `pushAllowlistFromStore`).
3. Whichever WebSocket client you're using — typically [`wscat`](https://www.npmjs.com/package/wscat):

   ```bash
   bun add -g wscat
   ```
