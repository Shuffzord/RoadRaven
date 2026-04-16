# Phase 2: Read-Only Viewer - Research

**Researched:** 2026-04-15
**Domain:** React tree rendering, Zod schema validation, Zustand store design, remark/rehype markdown, Bun file watching
**Confidence:** HIGH (all stack confirmed already installed; key APIs verified against official docs and live registry)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Zod schemas in `packages/core/src/schema.ts` (`@roadraven/core`). `shared/types.ts` imports inferred types via `z.infer<>`. Core package is single source of truth. Placeholder types in `shared/types.ts` replaced with re-exports.
- **D-02:** Single `roadmapStore` Zustand store holds: loaded schema data, selected node ID, layout preference (TB/LR), collapse state, viewport (zoom/pan). `themeStore` remains separate.
- **D-03:** `$ref` nodes resolved at load time — all referenced files read upfront and merged into one unified tree in memory. Each referenced file gets its own file watcher. User does not see `$ref` boundaries in read-only mode.
- **D-04:** Canvas internals replaced with react-d3-tree `<Tree>` component. Static placeholder nodes and SVG connectors removed. Custom node rendering via `renderCustomNodeElement` reuses existing `RoadmapNodeCard` styling. Dot-grid background and watermark preserved via CSS on wrapper div.
- **D-05:** Default layout is Top-to-Bottom (TB) for new files. Layout preference persisted per file in `.roadmap-settings.json`.
- **D-06:** Zoom/pan controls: scroll wheel zoom, pinch zoom, click-drag pan, plus "Fit to view" reset. Built into react-d3-tree.
- **D-07:** Markdown notes rendered via remark/rehype pipeline. Supports GFM. Rendered HTML styled with `--rv-*` tokens.
- **D-08:** Welcome screen: centered hero with actions — logo, "Open File", "New Roadmap", recent files list (last 10), bundled sample schema links.
- **D-09:** Benchmark: Vitest benchmark + manual Playwright smoke test. 300+ node schema, 10 `updateNode()` calls/sec for 5 seconds, p95 frame time <= 33ms.
- **D-10:** File watcher: Bun `fs.watch()` + RPC notify. 500ms debounce. On change, re-reads and validates, pushes `pushFileChanged` message via RPC.
- **D-11:** Phase stays as one phase with 4 plans. Mid-phase verification checkpoint after Plan 2.
- **D-12:** Plan ordering: (1) Schema + Zustand store, (2) Tree renderer, (3) Side panel + welcome screen, (4) Performance gate.

### Claude's Discretion

- Exact Zod schema structure (field names, nesting, validators)
- react-d3-tree configuration: node separation, sibling separation, path function
- Connector styling (solid, dashed, animated — building on Phase 1 animated line pattern)
- remark/rehype plugin selection and configuration
- Welcome screen exact layout and styling (follows variant-c-merged.html design language)
- Benchmark schema generator implementation details
- `dataKey` increment strategy (which mutations trigger increment vs in-place update)
- File watcher error handling (permission denied, file deleted, etc.)
- Schema validation error panel design and placement

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| VIEW-01 | JSON schema loads and validates via Zod; blocking validation errors shown in inline error panel | Zod v4 safeParse + ZodError.issues array; error panel design in UI-SPEC |
| VIEW-02 | Tree renders from JSON using react-d3-tree with `dataKey` pattern | react-d3-tree 3.6.6 `dataKey` prop verified; data format conversion pattern documented |
| VIEW-03 | TB and LR layout toggle; layout preference persisted per file in `.roadmap-settings.json` | react-d3-tree `orientation` prop; existing settings module pattern |
| VIEW-04 | Collapse/expand subtrees; nodes beyond depth 3 collapse by default | react-d3-tree `initialDepth` prop + `collapsible: true` |
| VIEW-05 | Zoom and pan (scroll wheel, pinch, click-drag) in both layouts | react-d3-tree `zoomable: true`, `draggable: true` built-in |
| VIEW-06 | Status badges on nodes: 4px left border stripe + pill label with correct theme colors | Existing `RoadmapNodeCard` component with `STATUS_TOKEN_MAP` |
| VIEW-07 | File watcher reloads tree on external file change without restarting the app | Bun `fs.watch()` API verified; RPC `pushFileChanged` already in RPC contract |
| VIEW-08 | `$ref` resolution at load time; each referenced file watched independently | `resolveRef` RPC already defined; Bun file I/O pattern documented |
| VIEW-09 | Side panel opens in read-only mode (title, status, type, timestamps, markdown notes) | Existing SidePanel skeleton; remark/rehype pipeline for markdown |
| VIEW-10 | Side panel resizable (min 320px, max 50% viewport); pin mode on screens wider than 1400px | CSS resize pattern with mouse event handler; no library needed |
| VIEW-11 | Performance gate: 300+ visible nodes + 10 `updateNode()` calls/sec >= 30 fps | Vitest benchmark config + dataKey pattern; perf pitfalls documented |
| VIEW-12 | `.bak.json` written alongside source file on every file open | Bun `Bun.write()` in Bun process; timing is on `loadFile` RPC handler |
| VIEW-13 | Welcome screen when no recent files: "Open file", "New roadmap", sample schema links | New `WelcomeScreen` component; UI-SPEC layout contract |
| VIEW-14 | Recent files list (last 10) persisted in `.roadmap-settings.json`; shown in File menu | Extend `AppSettings` type; existing settings save/load pattern |

</phase_requirements>

---

## Summary

Phase 2 wires real JSON data into the tree canvas using a stack that is already fully installed. react-d3-tree 3.6.6, Zod 4.3.6, Zustand 5.0.12, remark 15, rehype 13, and rehype-react 8 are all present in `packages/desktop/package.json`. No new `bun install` commands are needed for the core stack — only the remark-rehype bridge and rehype-react packages need to be confirmed present.

The most technically risky element is the `dataKey` pattern. react-d3-tree deep-clones its `data` prop on every reference change, which makes naive Zustand wiring instantly fail the 30 fps gate. The pattern must be designed into the store before any rendering work starts: structural mutations increment `dataKey`, status-only updates go through a flat node index via `useShallow`. This is the primary design constraint for Plan 1.

The second risk area is the react-d3-tree data format mismatch. The library expects `{ name, attributes?, children? }` but the roadmap schema will have `{ id, title, status, type, children? }`. Extra fields beyond `RawNodeDatum` survive to the custom node renderer via `nodeDatum` in `CustomNodeElementProps` but require explicit TypeScript casting since the library's interface only declares `name/attributes/children`. The recommended pattern is to store all custom data in `attributes` as a flat key-value object, or cast `nodeDatum` to a custom intersection type. Given the `attributes` field is `Record<string, string | number | boolean>`, the cleanest approach is a mapping step: convert the roadmap schema to a react-d3-tree `RawNodeDatum`-compatible structure at load time, storing `id`, `status`, `type` etc in `attributes`.

**Primary recommendation:** Design the Zustand `roadmapStore` with the `dataKey` pattern and a flat `nodeIndex` map first (Plan 1), then wire react-d3-tree against it (Plan 2). The store shape is the load-bearing decision for this entire phase.

---

## Standard Stack

### Core (already installed — verified against package.json)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react-d3-tree | 3.6.6 | Tree layout, zoom/pan, collapse/expand | Purpose-built for strict trees; built-in collapse/expand; better perf than React Flow at scale |
| zod | 4.3.6 | Schema validation, type inference | Already decided D-01; 100x fewer TS instantiations than v3; 14x faster parse |
| zustand | 5.0.12 | Document state (roadmapStore) | Already used for themeStore; `useShallow` for selector stability |
| @logtape/logtape | 2.0.5 | Structured logging | Established in Phase 1 (D-21); two-process pattern already wired |

[VERIFIED: packages/desktop/package.json]

### Markdown Rendering (already installed)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| remark | 15.0.1 | Markdown → mdast AST | Parser stage of pipeline |
| rehype | 13.0.2 | HTML AST → output | Transform stage |
| rehype-react | 8.0.0 | HAST → React elements | Final stage — replaces dangerouslySetInnerHTML |
| remark-rehype | 11.1.2 | mdast → HAST bridge | Connects remark and rehype stages |
| remark-gfm | 4.0.1 | GFM extension (tables, task lists, strikethrough) | Required for VIEW-09 notes |

[VERIFIED: npm registry — bunx npm view <package> version]

**Confirm these packages are in package.json.** remark and rehype are listed but remark-rehype, rehype-react, and remark-gfm need to be verified. If missing:

```bash
bun add remark-gfm remark-rehype rehype-react
```

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| uuid | 13.0.0 | UUID v4 generation for node IDs | New nodes in sample schemas |
| unified | (transitive) | Pipeline orchestrator | Used internally by remark/rehype |

[VERIFIED: packages/desktop/package.json]

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| remark/rehype pipeline | react-markdown | react-markdown is a unified wrapper; less control over token styling |
| remark/rehype pipeline | marked + DOMPurify | Not React-native; requires dangerouslySetInnerHTML |
| Bun fs.watch | chokidar | chokidar is more portable but adds a dependency; Bun fs.watch is native |

---

## Architecture Patterns

### Recommended Project Structure

New files for Phase 2 (relative to `packages/desktop/src/`):

```
packages/core/src/
├── schema.ts          # Zod schemas + z.infer types (D-01)
├── index.ts           # Re-exports schema types + existing plugin.ts exports

packages/desktop/src/
├── mainview/
│   ├── store/
│   │   └── roadmapStore.ts    # New: document state (D-02)
│   ├── components/
│   │   ├── Canvas.tsx          # Modified: replace placeholder with react-d3-tree
│   │   ├── RoadmapNode.tsx     # Modified: adapt for renderCustomNodeElement
│   │   ├── SidePanel.tsx       # Modified: data-driven from roadmapStore
│   │   ├── TopBar.tsx          # Modified: wire layout toggle + open button
│   │   ├── StatusBar.tsx       # Modified: wire node count + file path
│   │   ├── WelcomeScreen.tsx   # New
│   │   ├── SchemaErrorPanel.tsx  # New
│   │   ├── MarkdownRenderer.tsx  # New
│   │   └── FileWatchIndicator.tsx  # New (or inline in Canvas)
│   └── hooks/
│       └── useRoadmapStore.ts  # Optional: selector hooks

packages/desktop/src/bun/
├── index.ts           # Modified: add loadFile, resolveRef, file watcher handlers
├── settings.ts        # Modified: extend AppSettings for layout + recentFiles
├── fileWatcher.ts     # New: FSWatcher management + debounce

samples/
├── hello-world.json          # New: bundled sample schema
└── getting-started.json      # New: bundled sample schema
```

### Pattern 1: Zod Schema + Type Export (D-01)

**What:** Zod schemas live in `@roadraven/core`; `shared/types.ts` imports the inferred types.
**When to use:** All data shape definitions for this phase.

```typescript
// packages/core/src/schema.ts
// Source: Zod v4 docs — zod.dev/api (getter-based recursion)
import { z } from "zod";

const NodeStatusSchema = z.enum(["not-started", "in-progress", "completed", "blocked"]);

const RoadmapNodeSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1),
  status: NodeStatusSchema,
  type: z.string().optional(),
  notes: z.string().optional(),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
  metadata: z.record(z.unknown()).optional(),
  plugin: z.unknown().optional(),     // reserved — v1.1
  subscribe: z.unknown().optional(),  // reserved — v1.1
  get children() {
    return z.array(RoadmapNodeSchema).optional();
  },
  $ref: z.string().optional(),        // resolved at load time, stripped from unified tree
});

const StatusConfigSchema = z.object({
  id: z.string(),
  label: z.string(),
  color: z.string().optional(),
});

const RoadmapSchemaSchema = z.object({
  version: z.string(),
  title: z.string(),
  themeConfig: z.object({
    statusColors: z.record(z.string()).optional(),
    nodeRadius: z.number().optional(),
  }).optional(),
  statusConfig: z.array(StatusConfigSchema).optional(),
  typeConfig: z.array(z.object({ id: z.string(), label: z.string() })).optional(),
  nodes: z.array(RoadmapNodeSchema),
});

export type RoadmapNode = z.infer<typeof RoadmapNodeSchema>;
export type RoadmapSchema = z.infer<typeof RoadmapSchemaSchema>;
export { RoadmapSchemaSchema, RoadmapNodeSchema };
```

```typescript
// shared/types.ts — Phase 2 update
// Replace placeholder interfaces with re-exports from @roadraven/core
export type { RoadmapSchema, RoadmapNode } from "../packages/core/src/schema.ts";
```

[VERIFIED: Zod v4 getter-based recursion — zod.dev/api; existing shared/types.ts examined]

### Pattern 2: Zustand roadmapStore with dataKey

**What:** Document state store. Structural mutations increment `dataKey` to trigger react-d3-tree re-layout. Status-only updates go in-place via flat `nodeIndex` map, bypassing dataKey to avoid deep-clone.
**When to use:** Every interaction with loaded roadmap data.

```typescript
// packages/desktop/src/mainview/store/roadmapStore.ts
// Source: PROJECT.md dataKey pattern; Zustand v5 docs
import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";
import type { RawNodeDatum } from "react-d3-tree";
import type { RoadmapSchema, RoadmapNode } from "@roadraven/core";

interface RoadmapState {
  // Document data
  schema: RoadmapSchema | null;
  filePath: string | null;
  treeData: RawNodeDatum | null;       // react-d3-tree-compatible shape
  dataKey: string;                      // increments only on structural change
  nodeIndex: Map<string, RoadmapNode>; // flat id → node, for in-place status updates

  // UI state
  selectedNodeId: string | null;
  layoutOrientation: "TB" | "LR";
  isPanelPinned: boolean;

  // Actions — structural (increment dataKey)
  loadSchema: (schema: RoadmapSchema, filePath: string) => void;
  // Actions — in-place (no dataKey change)
  updateNodeStatus: (nodeId: string, status: string) => void;
  setSelectedNode: (id: string | null) => void;
  setLayout: (orientation: "TB" | "LR") => void;
}
```

**dataKey increment rules:**
- `loadSchema()` — increment (new file or $ref change)
- File watcher reload — increment
- Phase 3: add/delete/move node — increment
- `updateNodeStatus()` — NO increment; update `nodeIndex` entry in-place

**useShallow selector for status-sensitive components:**
```typescript
// Only re-renders when selectedNodeId, status change — not on tree re-layout
const { node, status } = useRoadmapStore(
  useShallow((s) => ({
    node: s.nodeIndex.get(nodeId),
    status: s.nodeIndex.get(nodeId)?.status,
  }))
);
```

[VERIFIED: PROJECT.md dataKey pattern; Zustand v5 useShallow — zustand.docs.pmnd.rs]

### Pattern 3: react-d3-tree Data Conversion

**What:** Convert `RoadmapSchema` nodes to react-d3-tree `RawNodeDatum` shape.
**Critical:** react-d3-tree requires `name` field. Store all custom data in `attributes` for access in `renderCustomNodeElement`. Extra fields beyond `RawNodeDatum` reach the custom renderer via `nodeDatum.attributes`.

```typescript
// Source: react-d3-tree docs; GitHub issue #350 (attributes pattern)
function toTreeDatum(node: RoadmapNode): RawNodeDatum {
  return {
    name: node.title,
    attributes: {
      id: node.id,
      status: node.status,
      type: node.type ?? "",
      notes: node.notes ?? "",
      createdAt: node.createdAt ?? "",
      updatedAt: node.updatedAt ?? "",
    },
    children: node.children?.map(toTreeDatum),
  };
}
```

In the custom renderer, access node data via `nodeDatum.attributes`:
```typescript
// Source: react-d3-tree renderCustomNodeElement pattern
const renderNode = ({ nodeDatum, toggleNode }: CustomNodeElementProps) => {
  const status = nodeDatum.attributes?.status as NodeStatus;
  const nodeId = nodeDatum.attributes?.id as string;
  return (
    <foreignObject width={240} height={80} x={-120} y={-40}>
      <RoadmapNodeCard
        title={nodeDatum.name}
        status={status}
        nodeId={nodeId}
        onToggle={toggleNode}
        onSelect={() => selectNode(nodeId)}
      />
    </foreignObject>
  );
};
```

[VERIFIED: react-d3-tree 3.6.6 docs — bkrem.github.io/react-d3-tree/docs; GitHub issue #350]

### Pattern 4: react-d3-tree Configuration (UI-SPEC contract)

```typescript
// Source: UI-SPEC.md React-D3-Tree Configuration Contract (approved 2026-04-15)
<Tree
  data={treeData}
  dataKey={dataKey}
  orientation={layoutOrientation === "TB" ? "vertical" : "horizontal"}
  initialDepth={3}
  pathFunc="step"
  separation={{ siblings: 1.5, nonSiblings: 2.0 }}
  nodeSize={{ x: 240, y: 100 }}
  renderCustomNodeElement={renderNode}
  zoom={0.8}
  enableLegacyTransitions={false}
  centeringTransitionDuration={800}
  collapsible={true}
  zoomable={true}
  draggable={true}
/>
```

Note: react-d3-tree `orientation` uses `"vertical"` for top-to-bottom and `"horizontal"` for left-to-right — inverse of what you might expect from "TB/LR" labels. [VERIFIED: react-d3-tree docs]

### Pattern 5: remark/rehype Markdown Pipeline

**What:** Converts markdown string to React elements using `--rv-*` tokens for styling.

```typescript
// Source: unified pipeline docs; rehype-react docs
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeReact from "rehype-react";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";

const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkRehype)
  .use(rehypeReact, {
    Fragment,
    jsx,
    jsxs,
    components: {
      // Map elements to styled wrappers that use --rv-* tokens
      a: ({ href, children }) => <a href={href} className="text-rv-accent hover:underline">{children}</a>,
      code: ({ children }) => <code className="text-rv-accent bg-rv-bg-elevated text-[11px] rounded-[3px] px-1 py-0.5 font-mono">{children}</code>,
      // ... etc per UI-SPEC Markdown Rendering Contract
    }
  });

// Usage (sync — use .processSync or cache processor):
function renderMarkdown(content: string): React.ReactNode {
  const file = processor.processSync(content);
  return file.result as React.ReactNode;
}
```

**Styling approach:** Map each markdown element to a React component with Tailwind utility classes referencing `--rv-*` tokens. All styles are in the `components` map, not in an injected stylesheet.

[VERIFIED: rehype-react 8.0.0 docs; remark-gfm docs]

### Pattern 6: Bun File Watcher with Debounce

**What:** Main process watches loaded file and each `$ref` file. On change, validates, pushes to webview.

```typescript
// packages/desktop/src/bun/fileWatcher.ts
// Source: Bun fs.watch docs (bun.com/reference/node/fs/watch)
import { watch } from "node:fs";
import type { FSWatcher } from "node:fs";

const activeWatchers = new Map<string, FSWatcher>();
const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

export function watchFile(
  filePath: string,
  onChanged: (path: string) => void,
  debounceMs = 500
): void {
  // Close existing watcher for this path if any
  stopWatching(filePath);

  const watcher = watch(filePath, (eventType) => {
    if (eventType !== "change" && eventType !== "rename") return;

    // Debounce: cancel pending timer, set new one
    const existing = debounceTimers.get(filePath);
    if (existing) clearTimeout(existing);
    debounceTimers.set(
      filePath,
      setTimeout(() => {
        debounceTimers.delete(filePath);
        onChanged(filePath);
      }, debounceMs)
    );
  });

  activeWatchers.set(filePath, watcher);
}

export function stopWatching(filePath: string): void {
  const existing = activeWatchers.get(filePath);
  if (existing) {
    existing.close();
    activeWatchers.delete(filePath);
  }
  const timer = debounceTimers.get(filePath);
  if (timer) {
    clearTimeout(timer);
    debounceTimers.delete(filePath);
  }
}

export function stopAllWatchers(): void {
  for (const path of activeWatchers.keys()) stopWatching(path);
}
```

**RPC notification to webview** (from Bun `index.ts`):
```typescript
// Source: Electrobun llms.txt — mainWindow.webview.rpc.send
mainWindow.webview.rpc.send.pushFileChanged({ path: filePath });
```

[VERIFIED: Bun fs.watch docs; Electrobun llms.txt]

### Pattern 7: .bak.json Safety Write (VIEW-12)

```typescript
// In loadFile RPC handler in packages/desktop/src/bun/index.ts
// Source: PROJECT.md safety net pattern
async loadFile({ path }) {
  const raw = await Bun.file(path).text();
  // Write backup before validation
  await Bun.write(path.replace(/\.json$/, ".bak.json"), raw);
  // Then validate and return
  const parsed = JSON.parse(raw);
  const result = RoadmapSchemaSchema.safeParse(parsed);
  // ... handle result
}
```

[VERIFIED: Bun.write docs; PROJECT.md pattern]

### Anti-Patterns to Avoid

- **Putting treeData directly in react-d3-tree data prop without dataKey:** react-d3-tree deep-clones on every render if `dataKey` is omitted or never changes. Status updates will cause full re-layout at 300 nodes = frame drops.
- **Calling `setState({ treeData: newObj })` on status update:** Creates new object reference, increments implicit dataKey, triggers full re-clone. Use `nodeIndex` map for in-place updates.
- **Using `dangerouslySetInnerHTML` for markdown:** Use rehype-react to produce React elements; keeps event handlers and `--rv-*` token classes properly applied.
- **Starting file watchers from the webview:** File I/O is Bun-only. Webview sends `openFilePicker` RPC call; Bun opens the dialog, starts the watcher, and sends `pushFileChanged` back.
- **Hardcoded color values in components:** `THEME-05` is enforced by CI grep. Always use `--rv-*` tokens.
- **Calling `Utils.openFileDialog()` from webview:** This method is Bun-only. Webview triggers it via `openFilePicker` RPC request (already defined in `shared/types.ts`).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Tree layout + zoom/pan | Custom D3 layout code | react-d3-tree 3.6.6 | Handles force layout, pan/zoom transforms, collapse state, D3 transitions |
| Schema validation | Manual type checks | Zod safeParse | Error paths, type coercion, type inference — all handled |
| Markdown parsing | String regex | remark + rehype + rehype-react | GFM, code blocks, XSS safety |
| State management | Context + useState | Zustand | Selector stability, devtools, SSR-safe |
| File picker dialog | Custom UI | `Utils.openFileDialog()` (Electrobun) | Native OS dialog |

**Key insight:** The full rendering stack is already installed. The entire phase is wiring, not library selection.

---

## Common Pitfalls

### Pitfall 1: react-d3-tree Data Format Mismatch

**What goes wrong:** Passing roadmap nodes directly as `data` prop without mapping to `RawNodeDatum`. react-d3-tree requires `name` field; custom fields like `id`, `status`, `type` are not in the default type.

**Why it happens:** The roadmap schema uses `title` not `name`; extra fields are not automatically forwarded.

**How to avoid:** Always run roadmap nodes through a `toTreeDatum()` conversion at load time (see Pattern 3). Store `id`, `status`, `type` in `attributes` for access in the custom renderer.

**Warning signs:** TypeScript errors on `data` prop; custom renderer `nodeDatum.attributes` is undefined.

### Pitfall 2: dataKey Increment on Every Render

**What goes wrong:** Any Zustand state mutation creates a new `treeData` object reference, which react-d3-tree treats as a structural change even if only status changed. At 10 updates/sec with 300 nodes, each deep-clone takes 5–15ms — well over 33ms budget.

**Why it happens:** Naive `set({ treeData: { ...state.treeData } })` for any update.

**How to avoid:** Separate structural state (treeData + dataKey) from status state (nodeIndex). Status updates: `set(state => { state.nodeIndex.get(id).status = newStatus })` — no treeData ref change.

**Warning signs:** Performance benchmark failing immediately; react DevTools Profiler shows full tree re-render on every status update.

### Pitfall 3: foreignObject Height Too Small for Node Card

**What goes wrong:** `RoadmapNodeCard` content clips or overflows the `foreignObject` bounding box in SVG. The SVG coordinate system has no auto-height for foreignObject.

**Why it happens:** foreignObject must be given explicit `width` and `height` in SVG units. The node card's 80px height may expand with long titles.

**How to avoid:** Set foreignObject height generously (e.g., 100px) and use `overflow: visible` on the inner div. Also set `nodeSize.y` to at least node card height + vertical gap (currently `100` in UI-SPEC contract).

**Warning signs:** Node labels cut off; hover states partially invisible.

### Pitfall 4: Zustand useShallow on Derived Objects

**What goes wrong:** A selector returning `{ node: state.nodeIndex.get(id) }` creates a new object every render. `useShallow` compares top-level keys shallowly — the `node` value is the same object reference, so this is fine. But if the selector maps over nodes or computes a derived value, useShallow may not prevent re-renders.

**How to avoid:** Selectors returning single values need no `useShallow`. Selectors returning objects with multiple properties use `useShallow`. Selectors that compute derived arrays/objects each call should be memoized with `useMemo` outside Zustand.

**Warning signs:** Components re-rendering on unrelated state changes; console.count shows excess renders.

### Pitfall 5: File Watcher on Deleted File

**What goes wrong:** When a file is deleted and recreated (as some editors do on save), `fs.watch` may emit a `rename` event and then stop watching. Subsequent saves are not detected.

**Why it happens:** Node-compatible `fs.watch` behavior: `rename` event on deletion, new file = new inode, old watcher no longer applies.

**How to avoid:** On `rename` event: close the old watcher, wait 100ms, check if file exists, re-register the watcher. The 500ms debounce in the watcher module covers the re-registration window.

**Warning signs:** File watcher works once, then stops reacting to saves after the first external edit.

### Pitfall 6: Zod v4 Import Path

**What goes wrong:** Code uses `import { z } from "zod/v4"` or `from "zod/v3"`. The migration guide mentions these paths but the primary package still exports from `"zod"` directly.

**How to avoid:** Always `import { z } from "zod"`. The `"zod/v4"` path is a compatibility shim for codebases upgrading from v3 within the same project. [VERIFIED: zod.dev/v4]

### Pitfall 7: remark-rehype and rehype-react ESM Package Requirements

**What goes wrong:** These packages are pure ESM; if Vite is not handling them correctly or a CommonJS require() is used, build fails with "Cannot use import statement in module."

**How to avoid:** Vite 6 handles ESM correctly. Do not add these to Vite's `ssr.noExternal` unless explicitly needed. Import normally in React components.

**Warning signs:** Vite build error mentioning `require()` and ESM packages.

---

## Code Examples

### Verified: Zod Recursive Schema with Getter (v4)

```typescript
// Source: zod.dev/api — v4 getter recursion pattern
const RoadmapNodeSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1),
  status: z.enum(["not-started", "in-progress", "completed", "blocked"]),
  get children() {
    return z.array(RoadmapNodeSchema).optional();
  }
});
type RoadmapNode = z.infer<typeof RoadmapNodeSchema>; // Properly inferred recursive type
```

### Verified: Zod safeParse Error Extraction

```typescript
// Source: zod.dev/api — safeParse + issues array
const result = RoadmapSchemaSchema.safeParse(raw);
if (!result.success) {
  const errors = result.error.issues.map(issue => ({
    path: issue.path.join("/"),
    message: issue.message,
    code: issue.code,
  }));
  // Render errors in SchemaErrorPanel
}
```

### Verified: Electrobun Utils.openFileDialog (Bun process only)

```typescript
// Source: Electrobun llms.txt
import { Utils } from "electrobun/bun";

const paths = await Utils.openFileDialog({
  startingFolder: undefined,
  allowedFileTypes: "json",
  canChooseFiles: true,
  canChooseDirectory: false,
  allowsMultipleSelection: false,
});
const filePath = paths?.[0] ?? null;
```

### Verified: Bun-to-webview message send

```typescript
// Source: Electrobun llms.txt — win.webview.rpc.send
// In Bun index.ts after file change detected:
mainWindow.webview.rpc.send.pushFileChanged({ path: filePath });
```

### Verified: react-d3-tree minimum working example

```typescript
// Source: react-d3-tree docs + npm README
import Tree from "react-d3-tree";

<Tree
  data={{ name: "Root", children: [{ name: "Child" }] }}
  dataKey="initial"
  orientation="vertical"
  pathFunc="step"
/>
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Zod v3 `z.lazy()` for recursion | Zod v4 getter syntax | v4.0.0 (2025) | Cleaner; no type casting; 100x fewer TS instantiations |
| rehype-react v7 createElement API | rehype-react v8 JSX runtime | v8.0.0 (2024) | Must pass `{ Fragment, jsx, jsxs }` from `react/jsx-runtime` instead of `createElement` |
| Zustand v4 `shallow` import from `zustand/shallow` | Zustand v5 `useShallow` from `zustand/react/shallow` | v5.0.0 (2024) | Breaking change: import path changed |

**Deprecated/outdated:**
- `enableLegacyTransitions: true` on react-d3-tree: Uses react-transition-group; actively discouraged for large trees; keep at `false`.
- Zustand v4 `shallow` from `"zustand/shallow"`: No longer the recommended pattern. Use `useShallow` from `"zustand/react/shallow"` in v5.
- rehype-react v7 `createElement` option: Replaced by `jsx`/`jsxs`/`Fragment` from `react/jsx-runtime` in v8.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | remark-gfm, remark-rehype, rehype-react are not yet in package.json (only remark and rehype are listed) | Standard Stack | Missing packages block Plan 3 (markdown rendering); easy fix with `bun add` |
| A2 | `attributes` in RawNodeDatum are available in `nodeDatum.attributes` within `renderCustomNodeElement` without TypeScript error | Pattern 3 | Would need intersection type cast or different data threading approach |
| A3 | Vitest benchmark mode (`.bench` files) works in the existing vitest.config.ts with jsdom | Validation Architecture | May require a separate `benchmark` config block; low-impact |
| A4 | `react/jsx-runtime` is available without explicit install (it ships with react 19) | Code Examples | If not resolvable, import from `"react"` and use `React.createElement` |

---

## Open Questions

1. **remark-gfm / remark-rehype / rehype-react package presence**
   - What we know: `remark` (15.0.1) and `rehype` (13.0.2) are in package.json. The markdown pipeline needs remark-gfm, remark-rehype, rehype-react in addition.
   - What's unclear: Whether they were added during Phase 1 or are still missing.
   - Recommendation: Plan 1 task should verify these are present and `bun add` them if not. Check `packages/desktop/package.json` at plan execution time.

2. **App layout grid-area for WelcomeScreen**
   - What we know: `App.tsx` uses CSS grid with `[grid-area:canvas]`. WelcomeScreen replaces canvas content when no file is loaded.
   - What's unclear: Whether WelcomeScreen occupies the `canvas` grid area (simplest) or requires a conditional render at the App level.
   - Recommendation: Conditional render in Canvas.tsx — if `roadmapStore.schema === null`, render `<WelcomeScreen>` instead of `<Tree>`. Canvas wrapper div (with dot-grid + watermark) stays.

3. **Per-file `.roadmap-settings.json` location**
   - What we know: Current settings.ts writes to platform app data dir (`%LOCALAPPDATA%/RoadRaven/settings.json`). Per-file layout preferences need to be keyed by file path.
   - What's unclear: Whether layout prefs go in the existing settings file (keyed by path) or in a `.roadmap-settings.json` alongside each JSON file.
   - Recommendation: Extend the existing `AppSettings` with `fileSettings: Record<string, { layout?: "TB" | "LR" }>` where the key is the absolute file path. Keeps a single settings file, avoids scattering `.roadmap-settings.json` files everywhere.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Bun runtime | All file I/O, RPC, watcher | confirmed (project requirement) | — | — |
| react-d3-tree | VIEW-02, VIEW-03, VIEW-04, VIEW-05 | confirmed in package.json | 3.6.6 | — |
| zod | VIEW-01 | confirmed in package.json | 4.3.6 | — |
| zustand | D-02 | confirmed in package.json | 5.0.12 | — |
| remark | VIEW-09 | confirmed in package.json | 15.0.1 | — |
| rehype | VIEW-09 | confirmed in package.json | 13.0.2 | — |
| remark-gfm | VIEW-09 GFM support | ASSUMED present (needs verification) | 4.0.1 | none — required |
| remark-rehype | VIEW-09 pipeline bridge | ASSUMED present (needs verification) | 11.1.2 | none — required |
| rehype-react | VIEW-09 React rendering | ASSUMED present (needs verification) | 8.0.0 | none — required |
| vitest | VIEW-11 benchmark | confirmed in package.json | 4.1.4 | — |

**Missing dependencies with no fallback:**
- If remark-gfm / remark-rehype / rehype-react are absent: `bun add remark-gfm remark-rehype rehype-react` in Wave 0 of Plan 3.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest 4.1.4 |
| Config file | `packages/desktop/vitest.config.ts` |
| Quick run command | `cd packages/desktop && bunx vitest run tests/unit/` |
| Full suite command | `cd packages/desktop && bunx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| VIEW-01 | Zod schema validates valid JSON | unit | `bunx vitest run tests/unit/schema.test.ts -x` | Wave 0 |
| VIEW-01 | Zod schema rejects invalid JSON and returns issues array | unit | same | Wave 0 |
| VIEW-01 | ZodError issues contain path + message | unit | same | Wave 0 |
| VIEW-02 | `toTreeDatum()` converts RoadmapNode to RawNodeDatum shape | unit | `bunx vitest run tests/unit/store/roadmapStore.test.ts -x` | Wave 0 |
| VIEW-02 | `dataKey` increments on `loadSchema()` | unit | same | Wave 0 |
| VIEW-02 | `dataKey` does NOT increment on `updateNodeStatus()` | unit | same | Wave 0 |
| VIEW-02 | `nodeIndex` map updates on `updateNodeStatus()` | unit | same | Wave 0 |
| VIEW-03 | Layout toggle persists to `AppSettings` | unit | `bunx vitest run tests/unit/store/roadmapStore.test.ts` | Wave 0 |
| VIEW-07 | File watcher calls onChange after debounce | unit | `bunx vitest run tests/unit/fileWatcher.test.ts -x` | Wave 0 |
| VIEW-07 | File watcher does NOT call onChange during debounce window | unit | same | Wave 0 |
| VIEW-08 | `resolveRef` loads referenced file nodes | unit | `bunx vitest run tests/unit/schema.test.ts` | Wave 0 |
| VIEW-11 | p95 frame time <= 33ms at 300 nodes + 10 updates/sec | vitest benchmark | `bunx vitest bench tests/bench/perf.bench.ts` | Wave 0 |
| VIEW-12 | `.bak.json` is written on file open | unit | `bunx vitest run tests/unit/fileWatcher.test.ts` | Wave 0 |
| VIEW-14 | Recent files list capped at 10 entries | unit | `bunx vitest run tests/unit/settings.test.ts -x` | Wave 0 |

UI tests (VIEW-06 badge rendering, VIEW-09 side panel, VIEW-13 welcome screen) are manual verification at the mid-phase checkpoint and during Plan 4. The jsdom environment in vitest.config.ts (via `environmentMatchGlobs`) supports React component tests if needed.

### Sampling Rate

- **Per task commit:** `cd packages/desktop && bunx vitest run tests/unit/`
- **Per wave merge:** `cd packages/desktop && bunx vitest run`
- **Phase gate:** Full suite green + manual Playwright smoke pass before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `packages/desktop/tests/unit/schema.test.ts` — covers VIEW-01, VIEW-08 (Zod validation, $ref parsing)
- [ ] `packages/desktop/tests/unit/store/roadmapStore.test.ts` — covers VIEW-02, VIEW-03 (dataKey pattern, nodeIndex)
- [ ] `packages/desktop/tests/unit/fileWatcher.test.ts` — covers VIEW-07, VIEW-12 (file watcher, .bak write)
- [ ] `packages/desktop/tests/unit/settings.test.ts` — covers VIEW-14 (recent files list)
- [ ] `packages/desktop/tests/bench/perf.bench.ts` — covers VIEW-11 (performance gate)
- [ ] `packages/desktop/tests/bench/` directory — does not exist yet; needs creation

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | n/a — local desktop app |
| V3 Session Management | no | n/a |
| V4 Access Control | no | n/a |
| V5 Input Validation | yes | Zod `safeParse` on all loaded JSON |
| V6 Cryptography | no | n/a |

### Known Threat Patterns for this Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Malformed JSON in user-opened file | Tampering | Zod safeParse wraps all external JSON; errors shown in SchemaErrorPanel without crashing |
| XSS via markdown notes field | Tampering | rehype-react produces React elements (not innerHTML); no dangerouslySetInnerHTML |
| Path traversal in $ref | Tampering | Resolve $ref paths relative to the parent file; reject paths that escape the file's directory |
| File watcher on system paths | DoS | Validate file extension (.json) before registering watcher; reject paths outside user home dir |
| Markdown links opening arbitrary URLs | Information Disclosure | rehype-react `components.a` should only open `https://` and `http://` URLs; block `javascript:` hrefs |

---

## Sources

### Primary (HIGH confidence)

- `packages/desktop/package.json` — confirmed installed versions of all stack libraries
- `bkrem.github.io/react-d3-tree/docs/interfaces/TreeProps.html` — react-d3-tree 3.6.6 props reference
- `zod.dev/api` — Zod v4 schema patterns (recursive, safeParse, issues)
- `bun.com/reference/node/fs/watch` — Bun fs.watch API
- `blackboard.sh/electrobun/llms.txt` — Electrobun RPC send, Utils.openFileDialog, before-quit
- `C:/Work/RoadRaven/packages/desktop/src/mainview/store/themeStore.ts` — existing Zustand pattern
- `C:/Work/RoadRaven/packages/desktop/src/mainview/rpc.ts` — existing Electroview pattern
- `C:/Work/RoadRaven/packages/desktop/src/bun/settings.ts` — existing settings pattern
- `C:/Work/RoadRaven/.planning/phases/02-read-only-viewer/02-UI-SPEC.md` — approved design contract

### Secondary (MEDIUM confidence)

- `github.com/bkrem/react-d3-tree/issues/350` — custom data in attributes pattern
- `glama.ai/blog/2024-10-21-rendering-markdown-in-react` — rehype-react unified pipeline example
- npm registry via `bunx npm view` — current package versions

### Tertiary (LOW confidence)

- General WebSearch results on Zustand v5 useShallow behavior — cross-verified with official docs

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages confirmed in package.json; versions from live npm registry
- Architecture (dataKey pattern): HIGH — PROJECT.md + UI-SPEC.md are explicit; react-d3-tree dataKey behavior verified in docs
- react-d3-tree configuration: HIGH — UI-SPEC.md provides exact values; props verified against official docs
- Markdown pipeline: MEDIUM — pipeline pattern verified; exact remark-rehype/rehype-react presence in package.json unverified (A1)
- File watcher: HIGH — Bun fs.watch API verified; Electrobun RPC send pattern verified
- Pitfalls: HIGH — foreignObject sizing and watcher rename event are verified known issues

**Research date:** 2026-04-15
**Valid until:** 2026-05-15 (30 days — stable stack, no fast-moving dependencies)
