# Sidebar Outline (Navigator) — Architecture + Code Plan

**Status:** Plan only. No source edited.
**Author:** system-architect
**Scope:** Replace the 2 hardcoded `<FileItem>` rows in the Sidebar "Outline" section
(`packages/desktop/src/mainview/components/Sidebar.tsx`) with a live, navigable mini-tree
of the currently open roadmap's nodes. Recent Files + Preferences/Help popups are owned
by a **parallel agent** — this plan touches ONLY the Outline section.

Design intent: `.planning/design/design.md:91` — *"Sections: Recent Files, Navigator (mini tree outline), Settings"*.

---

## 1. Effort Estimate

| Dimension | Estimate |
|---|---|
| **Size** | **M** (Medium) |
| **Hours** | ~5–8h including tests |
| **New files** | 1 (`Outline.tsx`); optional 2nd (`outlineSelectors.ts`) |
| **Files touched** | `Sidebar.tsx` (slot-in), `roadmapStore.ts` (one small selector helper + optional collapse-state), `Outline.test.tsx` (new) |
| **Risk** | **Low–Medium** |

**Risk areas**
- **Collapse/expand source of truth (PRIMARY RISK).** react-d3-tree owns collapse state internally in `nodeDatum.__rd3t.collapsed` (see `Canvas.tsx:~330` `const isCollapsed = nodeDatum.__rd3t?.collapsed`). The store has **no** collapse/expand state. If the outline needs its own expand/collapse, it must hold **its own** UI state — do NOT try to read/write rd3t internals (private, unstable). See Decision D-2.
- **Re-render cost on live updates.** `statusTick` bumps once per live-event batch and on every status/notes/metadata edit. A naive outline subscribing to the whole tree + statusTick will re-render the entire list on every agent event. Must scope subscriptions and memoize (see §2 Performance).
- **Multi-root schemas.** `schema.nodes` is an **array** of roots, but `treeData`/Canvas only renders `nodes[0]` (`toTreeDatum(schema.nodes[0])`, `roadmapStore.ts:~400`). The outline should iterate **all** `schema.nodes` roots for correctness, even though Canvas currently shows only the first. Flag for human (Q-1).

---

## 2. Architecture

### 2.1 Data flow (store → component)

```
roadmapStore (Zustand)
   schema.nodes : RoadmapNode[]    ← recursive tree, source of truth for structure
   selectedNodeId : string | null
   focusedNodeId  : string | null
   statusTick : number             ← bumps on status/notes/meta edits + live batches
   dataKey : string                ← bumps on structural edits (add/del/move/rename)
        │
        ▼  (selectors)
   <Outline/>  — flattens schema.nodes into rows, renders indented list
        │ click row
        ▼
   setSelectedNode(id) + setFocusedNode(id)
        │
        ▼  Canvas effect (Canvas.tsx:214 "targetNodeId = focusedNodeId ?? selectedNodeId")
   pans/centers the node into the viewport comfort-zone
```

**Key insight — reuse the EventLogDrawer precedent.** The reveal/center behavior already
exists and is proven. `EventLogDrawer.tsx:369` does exactly:
```ts
useRoadmapStore.getState().setSelectedNode(row.nodeId);
```
…and Canvas's existing effect (`Canvas.tsx:214-243`) auto-pans the node into the middle
50% comfort zone. **The outline click handler needs nothing more than `setSelectedNode` +
`setFocusedNode`.** No new camera code, no new MCP call. (`cameraFitView`/`store.fitView()`
is a separate "zoom to fit/focus" gesture and is NOT needed for row-click; see D-3.)

### 2.2 Bidirectional selection sync

- **Outline → Canvas:** row click calls `setSelectedNode(id)` + `setFocusedNode(id)`.
  Canvas's `renderNode` reads `selectedNodeId`/`focusedNodeId` from the store and the
  pan effect fires automatically. **Already wired — free.**
- **Canvas → Outline:** Canvas node click already calls `setSelectedNode(nodeId)` +
  `setFocusedNode(nodeId)` (`Canvas.tsx:362-365`). The outline subscribes to
  `selectedNodeId` (and optionally `focusedNodeId`) and applies a highlight class to the
  matching row. **Already wired — free.** Both directions converge on the same two store
  fields, so sync is automatic and cannot drift.

  Decision: highlight on `selectedNodeId` (the "open in side panel" node). Optionally show
  a lighter ring for `focusedNodeId` (keyboard cursor) to mirror Canvas's two-tier
  selected/focused visual — see D-4.

### 2.3 Click → select + reveal

Single handler per row:
```ts
const s = useRoadmapStore.getState();
s.setSelectedNode(node.id);
s.setFocusedNode(node.id);
```
Canvas does the rest. No scroll-into-view needed on the canvas side (the comfort-zone pan
handles off-screen nodes). Within the **outline** list itself, when selection changes from
the Canvas, scroll the active row into view (`element.scrollIntoView({block:'nearest'})`)
via a ref + effect keyed on `selectedNodeId`.

### 2.4 Indentation / nesting rendering

Flatten the tree to rows with a `depth` field; indent via left padding
`paddingLeft: depth * INDENT + BASE`. Render a disclosure chevron for rows with children.
Match existing Sidebar conventions: `text-[12px]`, `text-rv-text-secondary`,
`hover:bg-rv-bg-hover hover:text-rv-text-primary`, row height ~`py-[5px]`, base inset
`px-3.5` (copied from current `FileItem`).

### 2.5 Status indicators

Each row gets a small status dot using the **existing token map**, the single source of
truth: `STATUS_TOKEN_MAP` exported from `RoadmapNode.tsx:8`:
```ts
import { STATUS_TOKEN_MAP } from "./RoadmapNode";
// dot color: `var(${STATUS_TOKEN_MAP[node.status].color})`
```
Statuses are theme-driven CSS vars (`--rv-status-*`, defined per-theme in `index.css`).
Reusing the map means new statuses stay consistent and fallow won't flag drift.

**Live pulse (optional, P2):** `useIsNodeLive(nodeId)` hook (`roadmapStore.ts:964`) can add
a pulse to a row for 30s after a live event, mirroring the canvas glyph. Defer to a
follow-up — see Q-3. If included, note it re-renders the row each 1Hz `liveTick`.

### 2.6 Empty state (no file open)

Canvas shows `WelcomeScreen` when `treeData === null`. The outline's analog: when
`schema === null` (or `schema.nodes.length === 0`), render a muted placeholder
("No roadmap open") instead of rows. Mirror `SectionHeader`'s `text-rv-text-tertiary`
treatment. Hidden entirely when sidebar is collapsed (consistent with `SectionHeader`
returning `null` on `collapsed`).

### 2.7 Collapsed-rail behavior (48px)

When the sidebar is collapsed (`collapsed` state in `Sidebar.tsx`), the existing
`SectionHeader` returns `null` and `FileItem` renders icon-only centered. The Outline mini
tree is **not meaningful at 48px** (no room for indentation/titles). **Decision: render
nothing for the Outline section when `collapsed === true`** (return `null`, like
`SectionHeader`). The `collapsed` prop is already threaded through Sidebar's children — pass
it to `<Outline collapsed={collapsed} />`. See D-5.

### 2.8 Performance considerations

- **Subscription scoping.** Do NOT subscribe to `schema` object identity for the row list
  in a way that re-renders on `statusTick`. Subscribe to **`dataKey`** (changes only on
  structural edits) to recompute the flattened row array, and read `schema.nodes` inside a
  `useMemo` keyed on `dataKey`. Status changes that don't alter structure won't rebuild the
  list.
- **Status dots** read `node.status`. Because `updateNodeStatus`/`applyEventBatch` mutate
  nodes **in place** and bump `statusTick` (do NOT bump `dataKey`, per the D-02 perf
  contract — `roadmapStore.ts:731`, `:929`), a row showing live status must subscribe to
  `statusTick`. Keep this on a **per-row** `<OutlineRow>` (memoized) reading its own
  `node.status` so only changed rows reconcile — or accept a cheap full-list re-render on
  `statusTick` for small trees. See D-6 for the recommended split.
- **Virtualization.** Roadmaps are small (tens of nodes typical; the StatusBar shows
  `nodeCount`). **Do NOT virtualize initially** — KISS/YAGNI. `@tanstack/react-virtual` is
  already a dep (used in `EventLogDrawer.tsx`) if a future large-tree case demands it; add
  a threshold (>200 rows) only if measured. Document as a known follow-up, not built now.
- **Memoization.** `React.memo` on `<OutlineRow>`; flatten in `useMemo`; stable click
  handlers via the store's `getState()` (no per-row closures capturing changing state).

---

## 3. Code Plan

### 3.1 New component: `Outline.tsx`

Location: `packages/desktop/src/mainview/components/Outline.tsx`

```tsx
import { useEffect, useMemo, useRef } from "react";
import type { RoadmapNode } from "../../../../../packages/core/src/schema";
import { useRoadmapStore } from "../store/roadmapStore";
import { STATUS_TOKEN_MAP } from "./RoadmapNode";

interface OutlineRowData { node: RoadmapNode; depth: number; }

// Pure flatten — exported for unit testing. Walks all roots in schema.nodes.
export function flattenOutline(
  nodes: RoadmapNode[],
  collapsedIds: Set<string>,
  depth = 0,
): OutlineRowData[] {
  const out: OutlineRowData[] = [];
  for (const node of nodes) {
    out.push({ node, depth });
    if (node.children?.length && !collapsedIds.has(node.id)) {
      out.push(...flattenOutline(node.children, collapsedIds, depth + 1));
    }
  }
  return out;
}

export function Outline({ collapsed }: { collapsed: boolean }) {
  // dataKey-scoped: rebuild rows only on structural edits, not status ticks.
  const dataKey = useRoadmapStore((s) => s.dataKey);
  const schema  = useRoadmapStore((s) => s.schema);
  const selectedNodeId = useRoadmapStore((s) => s.selectedNodeId);
  // local expand/collapse state — NOT in the store (see D-2)
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(() => new Set());

  const rows = useMemo(
    () => (schema ? flattenOutline(schema.nodes, collapsedIds) : []),
    [dataKey, collapsedIds, schema], // schema ref changes with dataKey
  );

  if (collapsed) return null;                       // 48px rail: hide (D-5)
  if (!schema || rows.length === 0) return <OutlineEmpty />;

  return (
    <div role="tree" aria-label="Roadmap outline">
      {rows.map(({ node, depth }) => (
        <OutlineRow
          key={node.id}
          node={node}
          depth={depth}
          isSelected={node.id === selectedNodeId}
          hasChildren={!!node.children?.length}
          isCollapsed={collapsedIds.has(node.id)}
          onToggle={() => toggle(node.id)}
        />
      ))}
    </div>
  );
}
```

`<OutlineRow>` — `React.memo`, subscribes to its own `statusTick`-driven status only:
```tsx
const OutlineRow = memo(function OutlineRow({ node, depth, isSelected, ... }) {
  // status read via a selector so only this row re-renders on its status change
  const status = useRoadmapStore((s) => s.nodeIndex.get(node.id)?.status ?? node.status);
  const rowRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (isSelected) rowRef.current?.scrollIntoView({ block: "nearest" }); }, [isSelected]);

  return (
    <button
      ref={rowRef}
      role="treeitem"
      aria-selected={isSelected}
      className={`flex items-center w-full text-[12px] gap-1.5 py-[5px] pr-2 transition-colors duration-150
        ${isSelected ? "bg-rv-bg-hover text-rv-text-primary" : "text-rv-text-secondary hover:bg-rv-bg-hover hover:text-rv-text-primary"}`}
      style={{ paddingLeft: 14 + depth * 12 }}
      onClick={() => {
        const s = useRoadmapStore.getState();
        s.setSelectedNode(node.id);
        s.setFocusedNode(node.id);
      }}
    >
      {/* chevron (toggles local collapse) or spacer */}
      {/* status dot: backgroundColor: `var(${STATUS_TOKEN_MAP[status].color})` */}
      <span className="truncate">{node.title}</span>
    </button>
  );
});
```

Note: chevron `onClick` must `e.stopPropagation()` so toggling expand does not also select.

### 3.2 Store selectors / actions

**Reuse (no change needed):**
- `selectedNodeId`, `focusedNodeId`, `setSelectedNode`, `setFocusedNode` — selection + reveal.
- `schema.nodes` — structure.
- `dataKey` — structural-change subscription key.
- `statusTick` / `nodeIndex.get(id).status` — live status per row.
- `STATUS_TOKEN_MAP` (from `RoadmapNode.tsx`) — status dot colors.
- `useIsNodeLive(id)` — optional live pulse.

**New (minimal):** None strictly required. The flatten lives in the component (pure,
testable). **Do NOT add collapse state to the store** unless cross-component persistence is
desired (D-2). If the team wants outline expand state to survive remount or be controllable
elsewhere, add:
```ts
// roadmapStore — OPTIONAL, only if D-2 chooses store-backed collapse
outlineCollapsedIds: Set<string>;
toggleOutlineCollapse: (id: string) => void;
```
Recommended default: keep it local `useState` in `Outline.tsx` (YAGNI).

### 3.3 Slotting into `Sidebar.tsx` (alongside parallel Recent Files work)

Current Outline block (`Sidebar.tsx`, inside the `Content` div):
```tsx
{/* Outline section */}
<SectionHeader label="Outline" collapsed={collapsed} />
<FileItem name="Phase 1: Foundation" collapsed={collapsed} />
<FileItem name="Phase 2: Data Wiring" collapsed={collapsed} />
```
Replace **only these three lines** with:
```tsx
{/* Outline section */}
<SectionHeader label="Outline" collapsed={collapsed} />
<Outline collapsed={collapsed} />
```
`collapsed` is already in scope (Sidebar's `useState`). This is a surgical edit that does
NOT touch the Recent Files block above it — safe for the parallel agent. Add the import:
`import { Outline } from "./Outline";`.

### 3.4 Task breakdown (step-by-step)

1. **Create `flattenOutline`** (pure fn) + unit test in `Outline.test.tsx`: depth
   correctness, multi-root, collapsed-id pruning, empty input.
2. **Build `<OutlineRow>`** (memoized): indentation, status dot via `STATUS_TOKEN_MAP`,
   selected highlight, chevron + `stopPropagation`, `scrollIntoView` on select, click →
   `setSelectedNode` + `setFocusedNode`.
3. **Build `<Outline>`**: subscriptions (`dataKey`, `schema`, `selectedNodeId`), local
   collapse `useState`, empty + collapsed-rail guards, `<OutlineEmpty>`.
4. **Slot into `Sidebar.tsx`**: replace the two fake `FileItem`s with `<Outline collapsed/>`.
5. **Manual verify**: open a sample roadmap (`samples/cfa-l1/*.json` or via
   `mcp__roadraven__openFile`), confirm: rows render with indentation + status dots; click
   row pans canvas + opens side panel; click canvas node highlights row; collapse sidebar
   hides outline; empty state shows with no file.
6. **Run gates**: `bun run test:desktop`, `bun run test:typecheck`,
   `bunx @biomejs/biome lint packages/desktop/src/`, `bunx vite build`,
   `bunx fallow audit --changed-since=HEAD`.

---

## 4. Open Questions / Decisions for the Human

**Q-1 (Multi-root).** Canvas renders only `schema.nodes[0]`, but `schema.nodes` is an array.
Should the outline render **all roots** (more correct) or mirror Canvas and show only the
first root? *Recommendation: render all roots; it's a superset and costs nothing.*

**Q-2 (Default expand state).** Start fully expanded, or collapse nodes below depth N for
large trees? *Recommendation: fully expanded (small trees, KISS); revisit with
virtualization if trees grow.*

**Q-3 (Live pulse on rows).** Include `useIsNodeLive` pulse on outline rows (mirrors canvas
glyph, ties into the agent-driven story), or status-dot only for v1? *Recommendation:
status dot only for v1; pulse as a fast follow.*

**Q-4 (focused vs selected highlight).** Single highlight on `selectedNodeId`, or two-tier
selected + focused ring to match Canvas? *Recommendation: single (selected) for v1.*

### Decisions baked into this plan
- **D-2 (Collapse state ownership):** Outline holds its **own** local `useState` collapse
  set. It does NOT read/write react-d3-tree's private `__rd3t.collapsed`, and it does NOT
  drive canvas collapse. Outline expand/collapse is independent of canvas collapse. *(If
  the team wants them linked, that's a larger, riskier change — flag separately.)*
- **D-3 (Reveal mechanism):** Row click uses `setSelectedNode`+`setFocusedNode` only,
  relying on Canvas's existing comfort-zone pan effect (`Canvas.tsx:214`). No `fitView` /
  `cameraFitView`, no new camera code. Mirrors the proven `EventLogDrawer` row-click path.
- **D-5 (Collapsed rail):** Outline renders `null` at 48px (no icon-only fallback).
- **D-6 (Perf split):** `<Outline>` subscribes to `dataKey` (structure); `<OutlineRow>`
  subscribes to its own status via `nodeIndex.get(id).status` so live `statusTick` bumps
  reconcile only changed rows. No virtualization in v1.

---

## Appendix — Key file references (verified)

| Symbol / behavior | Location |
|---|---|
| Hardcoded Outline rows to replace | `Sidebar.tsx` (Outline section, 2× `<FileItem>`) |
| `collapsed` sidebar state + `SectionHeader`/`FileItem` conventions | `Sidebar.tsx` |
| `schema.nodes`, `selectedNodeId`, `setSelectedNode`, `setFocusedNode` | `store/roadmapStore.ts:195,196,269,270,764,768` |
| `dataKey` (structural) vs `statusTick` (in-place) contract | `store/roadmapStore.ts:731,929` |
| `buildNodeIndex`, `nodeIndex.get(id)` | `store/roadmapStore.ts:36` |
| `findParentAndIndex` (tree traversal util) | `store/roadmapStore.ts:77` |
| `useIsNodeLive(id)` (optional pulse) | `store/roadmapStore.ts:964` |
| `STATUS_TOKEN_MAP` (status dot colors) | `components/RoadmapNode.tsx:8` |
| Canvas reveal/pan effect (`focusedNodeId ?? selectedNodeId`) | `components/Canvas.tsx:214-243` |
| Canvas node click sets selected+focused | `components/Canvas.tsx:362-365` |
| Collapse owned by rd3t internals (`__rd3t.collapsed`) | `components/Canvas.tsx` renderNode |
| Click-row→reveal precedent | `components/EventLogDrawer.tsx:369` |
| `--rv-status-*` theme tokens | `mainview/index.css:117-124` (+ per-theme blocks) |
| Sidebar mounted at App scope | `mainview/App.tsx` (`<Sidebar />`) |
| `@tanstack/react-virtual` available if needed | `components/EventLogDrawer.tsx` |
