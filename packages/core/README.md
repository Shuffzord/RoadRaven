# @roadraven/core

Type and Zod-schema package for [RoadRaven](https://github.com/Shuffzord/RoadRaven)
roadmaps. Framework-agnostic; zero desktop dependencies.

> **Pair this with** `@roadraven/plugin-claude-code` (or your own producer)
> to push live status updates into a running RoadRaven app via its WebSocket
> Event API.

## Install

```bash
npm install @roadraven/core
# or
bun add @roadraven/core
```

## What's exported

Runtime (Zod schemas):

- `RoadmapSchemaSchema` — full roadmap document schema
- `RoadmapNodeSchema` — single node schema (recursive via children)
- `NodeStatusSchema` — built-in status enum (`not-started`, `in-progress`, `completed`, `blocked`)
- `StatusConfigSchema` — user-defined status config entry
- `TypeConfigSchema` — user-defined node type config entry

Compile-time (TypeScript types):

- `RoadmapSchema`, `RoadmapNode`, `NodeStatus`, `StatusConfig`, `TypeConfig`
- `IntegrationEvent` — Event API contract: `{ nodeId, status, meta?, source? }`
- `RoadmapPlugin` — interface reserved for the v1.1 plugin system (defined now for forward compat; not yet wired)

## Usage

```typescript
import { RoadmapSchemaSchema, type RoadmapSchema } from "@roadraven/core";

const data: unknown = JSON.parse(jsonText);
const result = RoadmapSchemaSchema.safeParse(data);
if (!result.success) {
	console.error(result.error.issues);
} else {
	const roadmap: RoadmapSchema = result.data;
	// ...
}
```

## Scope

`@roadraven/core` is the schema + types layer. It does NOT include:

- The desktop app renderer (`@roadraven/desktop`)
- React components (`@roadraven/react` — deferred to v1.1)
- The Event API server (lives in the desktop app)
- The Claude Code MCP wrapper (`@roadraven/plugin-claude-code`)

## License

MIT — see [LICENSE](./LICENSE).

## Documentation

- [Project README](https://github.com/Shuffzord/RoadRaven#readme)
- [Plugin authoring guide](https://shuffzord.github.io/RoadRaven/plugin-authoring.html) — how to build a producer that uses this package
- [Architecture overview](https://shuffzord.github.io/RoadRaven/architecture-overview.html)
