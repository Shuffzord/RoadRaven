# Phase 3: Full Editor - Research

**Researched:** 2026-04-16
**Domain:** Interactive tree editing (inline rename, CRUD on hierarchical data, CodeMirror 6, atomic file persistence, ARIA context menus, keyboard routing)
**Confidence:** HIGH (Context7/official docs verified for every library claim; installed versions cross-checked against `bun pm view`)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Context menu structure:**
- **D-01:** Flat layout with separators, single sub-menu for Status. Action order: `[Rename F2]` --- `[Add Child Enter | Add Sibling Above Shift+Enter | Add Sibling Below Tab]` --- `[Duplicate Ctrl+D | Copy Ctrl+C | Paste Ctrl+V]` --- `[Move Up Ctrl+↑ | Move Down Ctrl+↓]` --- `[Change Status ▶]` --- `[Delete Del]`.
- **D-02:** Custom webview-rendered `<div>` context menu on ALL platforms. Skip Electrobun's native `ContextMenu.showContextMenu()` entirely. Keyboard-navigable (arrows + Enter + Escape), ARIA-compliant, appears within 50ms.
- **D-03:** Canvas-background right-click shows subset: `[Paste]` `[Add Root Child]` `[Fit to View]` `[Toggle Layout]`.

**Keyboard shortcuts:**
- **D-04:** Enter = Add Child (go deeper), Tab = Add Sibling Below, Shift+Enter = Add Sibling Above.
- **D-05:** Space = select node (opens side panel). ARIA listbox semantics.
- **D-06:** Focus (dashed outline) and selection (solid accent outline) are distinct and may coexist.
- **D-07:** F6 toggles focus canvas ↔ side panel.
- **D-08:** Ctrl+C/Ctrl+V context-aware via `document.activeElement`.
- **D-09:** Full shortcut table locked in CONTEXT.md.

**Side panel:**
- **D-10:** Panel opens in Preview mode by default; edit button `[E]` or clicking a field switches to Edit mode.
- **D-11:** Notes segmented toggle `[Edit | Preview | Split]`, default Preview, CodeMirror 6 + GFM, 1s debounce autosave.
- **D-12:** Metadata as add/edit/delete rows with inline key-value inputs.
- **D-13:** Title editable in both canvas (double-click / F2 floating `<input>` with inverse D3 zoom transform) and panel.

**External edits & save failures:**
- **D-14:** External file change → non-blocking toast `[Reload] [Keep mine]`; autosave pauses.
- **D-15:** Escalating save failure: 1st = auto-retry 5s, 2nd = manual click retry, 3rd = modal dialog.

### Claude's Discretion
- Exact floating `<input>` positioning math (inverse D3 zoom transform)
- Context menu animation and render pipeline
- CodeMirror 6 extension selection and configuration
- Autosave debounce and periodic timer implementation
- Atomic write implementation details
- `$ref` file ownership tracking data structure
- Store mutation action implementations
- New node defaults (UUID v4 generation, timestamps)
- Confirmation dialog design for non-leaf delete
- `File > New` in-memory schema structure

### Deferred Ideas (OUT OF SCOPE)
None — CONTEXT.md explicitly states "None — discussion stayed within phase scope."
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| EDIT-01 | Inline rename (double-click/F2) with floating `<input>` over SVG with inverse D3 zoom transform | §2 Floating rename input math; verified `react-d3-tree` `onUpdate` callback exposes transform |
| EDIT-02 | Add child, add sibling above/below (keyboard + context menu) | §3 Store mutation actions (addChild, addSibling); §4 Keyboard router |
| EDIT-03 | Delete: immediate for leaf, confirmation for non-leaf with child count | §3 deleteNode action; UI-SPEC ConfirmationDialog component |
| EDIT-04 | Duplicate node + subtree (Ctrl+D) | §3 duplicateNode action with fresh UUID assignment to every copied descendant |
| EDIT-05 | Copy/paste node + subtree (Ctrl+C / Ctrl+V); JSON clipboard; cross-file works | §5 Clipboard strategy; `navigator.clipboard.writeText/readText` |
| EDIT-06 | Move node up/down within siblings (Ctrl+↑ / Ctrl+↓) | §3 moveNode action; no cross-parent moves in v1 via arrow keys |
| EDIT-07 | Arrow-key focus navigation | §4 Keyboard router + focus model |
| EDIT-08 | Change status via context menu sub-menu and panel dropdown | §1 Radix Sub/SubTrigger; UI-SPEC D-01 |
| EDIT-09 | Context menu with full action set; keyboard-navigable, ARIA compliant, appears within 50ms | §1 Context menu architecture; Radix Context Menu + pre-portaled tree |
| EDIT-10 | Side panel: CodeMirror 6 editor; Edit/Preview/Split; 1s debounced autosave; no Save button | §6 CodeMirror 6 setup |
| EDIT-11 | Side panel: editable metadata key-value table | UI-SPEC PanelEditMode Metadata table |
| EDIT-12 | Side panel: editable title, status/type dropdowns, timestamps, copy-ID | UI-SPEC PanelEditMode |
| EDIT-13 | Autosave: 2s debounce, 30s periodic, flush on `before-quit` + SIGTERM | §7 Autosave scheduler; Electrobun `before-quit` event verified |
| EDIT-14 | Atomic write: `.tmp` → rename; Windows 3× 50ms retry | §8 Atomic write implementation |
| EDIT-15 | Status bar save indicator (Saved / Saving / Error) | UI-SPEC SaveIndicator |
| EDIT-16 | `$ref` write-back; cross-boundary moves blocked | §9 `$ref` ownership map |
| EDIT-17 | File > New: in-memory schema, prompt for save on first edit | §10 File > New + Save As workflow |
| EDIT-18 | Linux context menu fallback (handled via D-02 — all platforms use custom div) | §1 Custom div via Radix satisfies Linux natively |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **Runtime:** Electrobun (NOT Electron). Use Electrobun-specific patterns only (`Electrobun.events.on("before-quit")`, `BrowserWindow`, `Updater`). Reject any Electron docs/APIs if encountered.
- **Package manager:** `bun`/`bunx` ONLY. Never `npm`, `npx`, `yarn`, or `pnpm` in scripts, docs, or instructions.
- **Loading views:** `views://mainview/index.html` (production), Vite dev URL in development.
- **Imports:**
  - Main process: `import { BrowserWindow, Updater } from "electrobun/bun"`
  - Renderer: `import { Electroview } from "electrobun/view"`
- **Verification gates** (MUST pass before PR):
  1. `bunx vitest run` — all unit tests green
  2. `bunx vite build` — production build succeeds (catches import/CSS issues)
  3. `bunx @biomejs/biome lint packages/desktop/src/ shared/` — zero lint errors
- **No console.logs** without explicit user request (global CLAUDE.md rule). Use `bunLogger` / LogTape categories for logging.
- **Completion:** User confirms via "for verification" — never assume completion.

## Summary

Phase 3 converts RoadRaven from a read-only viewer into a complete editor. The heavy lifting splits into five concerns: (a) the Zustand store gains a tight family of mutation actions with strict `dataKey` discipline so structural changes re-render the tree and status/metadata edits don't thrash react-d3-tree's deep-clone; (b) a single canvas-level keyboard router routes shortcuts context-aware via `document.activeElement`; (c) a floating inline rename input overlays the node by reading `hierarchyPointNode.x/y` (local tree coordinates) and applying the zoom/translate transform exposed by react-d3-tree's `onUpdate` callback; (d) a CodeMirror 6 editor with GFM + a CSS-variable-driven theme powers notes editing with a debounced autosave listener; (e) a Bun-side atomic write pipeline uses `.tmp` + rename with a 3×50ms Windows retry loop, flushed on `Electrobun.events.on("before-quit")` and `process.on("SIGTERM", ...)`.

Every critical library is already in `packages/desktop/package.json` at current versions: `@codemirror/state` 6.6.0, `@codemirror/view` 6.41.0, `@codemirror/lang-markdown` 6.5.0, `@radix-ui/react-context-menu` 2.2.16, `@radix-ui/react-dialog` 1.1.15, `uuid` 13.0.0, `electrobun` 1.16.0. No new npm installs required — Phase 0/1 installed everything speculatively when scaffolding the `package.json`.

One key interpretation of CONTEXT.md D-02: "custom webview-rendered `<div>` context menu on ALL platforms" means *not the native OS menu*. Radix's Context Menu primitive renders as a `<div>` in the webview via React portal — it satisfies D-02 exactly while giving us W3C-correct ARIA roles, keyboard navigation (Arrow keys, Home/End, Escape, typeahead), roving tabindex, viewport clamping, and submenu management out of the box. Hand-rolling the same behavior to W3C standard is a multi-task engineering risk with zero upside.

**Primary recommendation:** Use Radix Context Menu and Radix Dialog for the two modal surfaces (context menu, confirmation dialog, save-failure modal). Write the store mutations, keyboard router, CodeMirror theme, atomic write pipeline, and `$ref` ownership map from scratch — those are project-specific and have no "library for that" equivalent. Treat the ARIA/keyboard layer as *already solved by Radix* and spend the planning budget on the file-persistence + `$ref` write-back code paths, which are the real risk surface.

## Standard Stack

### Core (already installed — verified via `bun pm view`)

| Library | Installed Version | Latest (2026-04) | Purpose | Why Standard |
|---------|------------------|------------------|---------|--------------|
| `@codemirror/state` | 6.6.0 | 6.6.0 | Editor state primitives (`EditorState`, `Compartment`) | [CITED: codemirror.net/examples/config/] Canonical CM6 core |
| `@codemirror/view` | 6.41.0 | 6.41.0 | DOM view (`EditorView`), update listener | [CITED: codemirror.net] Required for any rendered CM6 editor |
| `@codemirror/lang-markdown` | 6.5.0 | 6.5.0 | Markdown + GFM (tables, task lists) syntax highlighting | [CITED: npm + CodeMirror docs] Official CodeMirror markdown language pack |
| `@radix-ui/react-context-menu` | 2.2.16 | — | Headless context menu with ARIA, submenu, viewport clamping | [CITED: radix-ui.com] Implements WAI-ARIA Menu pattern; satisfies D-02 (renders custom `<div>` via portal) |
| `@radix-ui/react-dialog` | 1.1.15 | — | Focus-trapped modal for ConfirmationDialog and SaveFailureModal | [CITED: radix-ui.com] Handles focus trap, Escape-to-close, `aria-modal` |
| `uuid` | 13.0.0 | — | UUID v4 for new node IDs | [VERIFIED: Zod schema in `@roadraven/core` requires `z.string().uuid()`] |
| `zustand` | 5.0.12 | — | Existing store — extend with mutation actions | [VERIFIED: Phase 2 uses Zustand with `useShallow`] |

### Supporting (may need installation — verify before adding)

| Library | Purpose | When to Use | Decision |
|---------|---------|-------------|----------|
| `zustand/middleware/immer` | Drafts-based deep updates for nested tree mutations | Deeply nested `node.children[i].children[j]` updates | **OPTIONAL — recommended.** `bun pm view zustand` confirms middleware is part of the zustand package (no extra install). Immer simplifies `duplicateNode`/`moveNode` but adds a learning curve. Planner may choose raw set-with-path-walk for correctness. |
| `chokidar` 5.0.0 | Cross-platform file watcher | Replacement for current `fs.watch` if Bun native proves flaky on Windows rename events | **DEFER.** Phase 2 shipped with `node:fs`/`fs.watch` + 500ms debounce. Stick with it unless a specific bug surfaces. Adding chokidar = extra dependency for marginal benefit. |
| `write-file-atomic` 6.x | npm's atomic write helper | Not used | **REJECT.** Per [CITED: github.com/npm/write-file-atomic/issues/227], it does NOT retry on Windows EPERM/EBUSY. We need explicit 3×50ms retry per EDIT-14 — hand-rolling is simpler than layering logic on top. |

### Alternatives Considered (do NOT use)

| Instead of | Could Use | Why Rejected |
|------------|-----------|-------------|
| `@radix-ui/react-context-menu` | Hand-rolled `<div role="menu">` | D-02 says "custom webview-rendered `<div>`" meaning "not native OS menu". Radix IS a custom `<div>` via portal — it meets D-02. Hand-rolling W3C ARIA compliance is 200+ LOC + test surface + typeahead + submenu positioning math. Reject. |
| `@radix-ui/react-dropdown-menu` | Already in `package.json` (2.1.16) | Dropdown is for click-triggered menus (e.g., File menu). Context menu primitive is for right-click — use the correct primitive. `react-dropdown-menu` stays available for a future File menu but is **not** used for right-click in Phase 3. |
| `react-codemirror` / `@uiw/react-codemirror` | React wrapper for CM6 | Adds a dependency for ~40 LOC of React wrapping. Wrapping CM6 ourselves in a `useEffect` is a known pattern and gives full control over the `EditorView` lifecycle. [CITED: codiga.io tutorial] — still recommended by CM community for full control. |
| `write-file-atomic` | Atomic write helper | No built-in Windows rename retry [CITED: github.com/npm/write-file-atomic/issues/227]. We need retry → hand-roll. |
| `html2canvas` for export | Rejected at roadmap level | Already excluded in Phase 5 — mentioned only to confirm it's irrelevant to Phase 3. |

**Installation:**
```bash
# Nothing to install — all Phase 3 dependencies already in packages/desktop/package.json.
# Verify lockfile is clean:
cd packages/desktop && bun install --frozen-lockfile
```

**Version verification commands (run before planning):**
```bash
bun pm view @codemirror/state version          # → 6.6.0 (current)
bun pm view @codemirror/view version           # → 6.41.0 (current)
bun pm view @codemirror/lang-markdown version  # → 6.5.0 (current)
bun pm view @radix-ui/react-context-menu version  # → 2.2.16 (current)
bun pm view @radix-ui/react-dialog version     # → 1.1.15 (current)
bun pm view uuid version                        # → 13.0.0 (current)
bun pm view electrobun version                  # → 1.16.0 (current)
```

## Architecture Patterns

### Recommended File Layout (Phase 3 additions)

```
packages/desktop/src/mainview/
├── components/
│   ├── ContextMenu.tsx                  # NEW — Radix ContextMenu wrapper with RoadRaven menu items
│   ├── ConfirmationDialog.tsx           # NEW — Radix Dialog for non-leaf delete
│   ├── SaveFailureModal.tsx             # NEW — Radix Dialog for 3rd-failure escalation
│   ├── ExternalEditToast.tsx            # NEW — File-changed-externally toast
│   ├── SaveIndicator.tsx                # NEW — StatusBar child (replaces hardcoded "Connected")
│   ├── InlineRenameInput.tsx            # NEW — floating input over focused node
│   ├── MetadataEditor.tsx               # NEW — key-value table for side panel
│   ├── NotesEditor.tsx                  # NEW — CodeMirror 6 instance (edit/preview/split)
│   ├── Canvas.tsx                       # EDIT — add KeyboardRouter, ContextMenu trigger, inline rename host
│   ├── SidePanel.tsx                    # EDIT — add edit mode toggle, CodeMirror wiring
│   ├── RoadmapNode.tsx                  # EDIT — add dashed focus ring (separate from solid selection)
│   └── StatusBar.tsx                    # EDIT — embed SaveIndicator
├── store/
│   ├── roadmapStore.ts                  # EDIT — add mutation actions + saveState + fileOwnership
│   └── clipboard.ts                     # NEW — helpers for subtree JSON serialize/parse
├── hooks/
│   ├── useKeyboardRouter.ts             # NEW — single canvas-level keydown handler
│   ├── useAutosave.ts                   # NEW — 2s debounce + 30s periodic + flush on unload
│   ├── useInlineRename.ts               # NEW — position math + lifecycle
│   └── useCodeMirror.ts                 # NEW — EditorView lifecycle + updateListener + theme
└── theme/
    └── codemirrorTheme.ts               # NEW — EditorView.theme with var(--rv-*) tokens

packages/desktop/src/bun/
├── atomicWrite.ts                       # NEW — write-tmp-then-rename with Windows retry
├── fileWatcher.ts                       # REUSE — Phase 2 module already debounces
├── index.ts                             # EDIT — add saveFile handler, newFile, saveFileAs, saveAs; register before-quit + SIGTERM
└── refMap.ts                            # NEW — track which node ID → originating file path

shared/
└── types.ts                             # EDIT — add saveFile impl contract, saveAs, newFile RPC requests
```

### Pattern 1: Store Mutation Actions with `dataKey` Discipline

**What:** Extend `roadmapStore` with a family of mutation actions. Each mutation decides whether it's *structural* (bumps `dataKey`, triggers react-d3-tree re-render) or *in-place* (mutates `nodeIndex` entry, bumps a separate counter like `statusTick`).

**Which actions bump `dataKey`:**

| Action | Structural (bumps `dataKey`)? | Rebuild `nodeIndex`? | Trigger autosave? |
|--------|-------------------------------|---------------------|-------------------|
| `addChild(parentId, newNode?)` | ✅ Yes (new node added) | ✅ Yes | ✅ Yes (structural: 2s debounce) |
| `addSiblingAbove(nodeId)` | ✅ Yes | ✅ Yes | ✅ Yes |
| `addSiblingBelow(nodeId)` | ✅ Yes | ✅ Yes | ✅ Yes |
| `deleteNode(nodeId)` | ✅ Yes | ✅ Yes | ✅ Yes |
| `duplicateNode(nodeId)` | ✅ Yes | ✅ Yes | ✅ Yes |
| `moveNodeUp(nodeId)` / `moveNodeDown(nodeId)` | ✅ Yes (reorders siblings) | ❌ No (same nodes, different order — IDs unchanged) | ✅ Yes |
| `renameNode(nodeId, title)` | ❌ No (visual-only change, same tree shape) | ❌ No | ✅ Yes (notes debounce: 1s) |
| `updateNodeStatus(nodeId, status)` | ❌ No | ❌ No (nodeIndex already has ref) | ✅ Yes (1s) |
| `updateNodeType(nodeId, type)` | ❌ No | ❌ No | ✅ Yes (1s) |
| `updateNodeMetadata(nodeId, metadata)` | ❌ No | ❌ No | ✅ Yes (1s) |
| `updateNodeNotes(nodeId, notes)` | ❌ No | ❌ No | ✅ Yes (1s) |
| `pasteNode(parentId, subtreeJson)` | ✅ Yes | ✅ Yes | ✅ Yes |

**Rule of thumb [VERIFIED: roadmapStore.ts D-02 comment]:** *Shape changes* bump `dataKey`. *Visual changes* (title text, status color, etc.) increment `statusTick` only — Canvas's `renderCustomNodeElement` reads from `nodeIndex` via that tick.

**Critical:** `renameNode` is NOT structural because it doesn't change tree shape — but the existing `renderCustomNodeElement` in Canvas.tsx reads `nodeDatum.name` (the tree-data copy, not `nodeIndex`). To make rename show up without bumping `dataKey`, we must either (a) also update `treeData` immutably and bump `dataKey` (simpler but re-renders tree), or (b) switch `renderCustomNodeElement` to look up the current title via `nodeIndex.get(nodeId)?.title` plus `statusTick` as a re-render trigger.

**Recommendation:** Bump `dataKey` on rename. A rename is rare enough in practice that the full tree re-render is acceptable. Only `updateNodeStatus` happens at a rate (10/sec) where `statusTick` optimization matters.

**Example shape:**

```typescript
// Source: project pattern — extends existing roadmapStore.ts (Phase 02)
interface RoadmapState {
  // ... existing fields ...

  // NEW — save state machine (surfaces in StatusBar)
  saveState: "saved" | "saving" | "error-retrying" | "error-manual" | "error-modal";
  lastSaveError: { message: string; attemptedAt: number } | null;
  pendingStructuralWrite: boolean;
  pendingNotesWrite: boolean;

  // NEW — file ownership for $ref write-back
  nodeFileOwnership: Map<string, string>;  // nodeId → absolute file path that "owns" it

  // NEW — focus (keyboard nav) separate from selection (panel)
  focusedNodeId: string | null;

  // NEW — mutation actions
  addChild: (parentId: string, title?: string) => string;  // returns new node ID
  addSiblingAbove: (nodeId: string) => string;
  addSiblingBelow: (nodeId: string) => string;
  deleteNode: (nodeId: string) => { deletedCount: number };
  duplicateNode: (nodeId: string) => string;
  moveNodeUp: (nodeId: string) => void;
  moveNodeDown: (nodeId: string) => void;
  renameNode: (nodeId: string, title: string) => void;
  updateNodeStatus: (nodeId: string, status: string) => void;  // already exists
  updateNodeType: (nodeId: string, type: string) => void;
  updateNodeMetadata: (nodeId: string, metadata: Record<string, unknown>) => void;
  updateNodeNotes: (nodeId: string, notes: string) => void;
  setFocusedNode: (id: string | null) => void;
  copySubtreeToClipboard: (nodeId: string) => Promise<void>;
  pasteFromClipboard: (parentId: string | null) => Promise<string | null>;
  setSaveState: (state: RoadmapState["saveState"], error?: string) => void;
}
```

**New node defaults** (per CONTEXT.md Claude's Discretion):
```typescript
function makeNewNode(title = "Untitled"): RoadmapNode {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),  // Built-in Web API — no uuid lib call needed in renderer
    title,
    status: "not-started",
    createdAt: now,
    updatedAt: now,
  };
}
```
Note: `crypto.randomUUID()` is native to the V8/CEF webview context and Bun. Both processes have it. The `uuid` package is installed but not needed — prefer native API.

### Pattern 2: Floating Inline Rename Input (EDIT-01 — the core math)

**The math:**

react-d3-tree places each node in a local coordinate space via `hierarchyPointNode.x` and `hierarchyPointNode.y` (d3-hierarchy conventions). The Tree renders a `<g>` element wrapping the whole tree, with transform attribute `translate(Tx, Ty) scale(k)` where `Tx, Ty, k` come from the zoom/pan state. react-d3-tree exposes this state via `onUpdate` — verified [CITED: react-d3-tree/lib/types/Tree/types.d.ts, line 73-77]:

```typescript
onUpdate?: (target: {
  node: TreeNodeDatum | null;
  zoom: number;
  translate: Point;
}) => any;
```

Given local `(lx, ly)` (from `hierarchyPointNode.x`, `hierarchyPointNode.y`) and the transform `(Tx, Ty, k)`, the screen position of the node center is:

```
screenX = lx * k + Tx + svgContainerLeft
screenY = ly * k + Ty + svgContainerTop
```

Here `svgContainerLeft/Top` come from the Canvas container's `getBoundingClientRect()`. This is the standard d3 affine transform, verified [CITED: d3js.org/d3-zoom] — `transform.apply([x, y]) = [x*k + tx, y*k + ty]`.

**Why this works despite using `foreignObject`:** The `<foreignObject x={-120} y={-50} width={240} height={100}>` in Canvas.tsx centers the node card around the node's local position. The title text inside the `foreignObject` is at local `(lx, ly)` — the SVG transform still applies.

**The orientation wrinkle:** react-d3-tree internally swaps x/y for horizontal orientation. We don't need to care — we just read `hierarchyPointNode.x` and `.y` which react-d3-tree has already oriented correctly for the rendered layout.

**Pre-selecting text + font match:** The input must match the node title's exact font (13px / 600 / Inter). Use the `--rv-*` tokens declared in UI-SPEC InlineRenameInput.

**Recalculation on pan/zoom:** `onUpdate` fires on every zoom/pan event. If the input is open, recompute `screenX/screenY` inside that callback and update via state.

**Example hook shape:**

```typescript
// Source: project pattern — hook for Canvas to expose
interface InlineRenameState {
  nodeId: string | null;
  screenPos: { x: number; y: number } | null;
  title: string;
}

export function useInlineRename() {
  const [state, setState] = useState<InlineRenameState>({ nodeId: null, screenPos: null, title: "" });

  // Open: caller passes hierarchyPointNode.x, .y, current transform, container rect
  const open = (nodeId: string, localX: number, localY: number, transform: {x: number; y: number; k: number}, containerRect: DOMRect) => {
    setState({
      nodeId,
      screenPos: {
        x: localX * transform.k + transform.x + containerRect.left,
        y: localY * transform.k + transform.y + containerRect.top,
      },
      title: useRoadmapStore.getState().nodeIndex.get(nodeId)?.title ?? "",
    });
  };

  const commit = () => {
    if (state.nodeId && state.title.trim()) {
      useRoadmapStore.getState().renameNode(state.nodeId, state.title.trim());
    }
    setState({ nodeId: null, screenPos: null, title: "" });
  };

  const cancel = () => setState({ nodeId: null, screenPos: null, title: "" });

  // Caller uses react-d3-tree onUpdate to feed new transform while input is open
  const updateForTransform = (transform: {x: number; y: number; k: number}, containerRect: DOMRect) => {
    if (!state.nodeId) return;
    const node = useRoadmapStore.getState().nodeIndex.get(state.nodeId);
    const hpn = /* look up hierarchyPointNode from tree render — see below */;
    if (hpn) {
      setState(s => ({
        ...s,
        screenPos: { x: hpn.x * transform.k + transform.x + containerRect.left, y: hpn.y * transform.k + transform.y + containerRect.top },
      }));
    }
  };

  return { state, open, commit, cancel, updateForTransform };
}
```

**The `hierarchyPointNode` access question:** `CustomNodeElementProps` (which Canvas's `renderCustomNodeElement` receives per node render) includes `hierarchyPointNode` [VERIFIED: common.d.ts lines 34-43]. Stash `hierarchyPointNode.x/.y` into a `ref`-keyed map at render time so the rename hook can look up positions for any node by ID.

**Fallback if hierarchyPointNode coordinates prove unreliable:** Query `document.querySelector('[data-source-id]')` for the node's rendered DOM element (react-d3-tree tags each node's SVG group with `data-source-id`). Call `getBoundingClientRect()` on it. This works on whatever orientation/transform is live. Document this as an escape hatch — use `hierarchyPointNode` first.

### Pattern 3: Context Menu (Radix + UI-SPEC layout)

**What:** Wrap `@radix-ui/react-context-menu` in `ContextMenu.tsx`. The Radix primitives give us W3C-correct ARIA for free [CITED: radix-ui.com/primitives/docs/components/context-menu]:

- `ContextMenu.Root`, `Trigger`, `Portal`, `Content`, `Item`, `Separator`, `Sub`, `SubTrigger`, `SubContent`
- Keyboard: ArrowDown/Up/Left/Right, Space, Enter, Escape, Home, End, typeahead — all built-in
- `aria-haspopup`, `aria-expanded`, roving tabindex — all built-in
- `avoidCollisions` (default true) — viewport clamping built-in
- `forceMount` available but NOT used (Radix default is on-demand render, mounted via portal on trigger)

**50ms render budget (EDIT-09):**
[CITED: radix-ui.com] Radix portals mount via React on trigger. Typical render time is 10-30ms for a small menu tree. If measurement shows >50ms, the fallback is `forceMount` + CSS `display: none` / `display: flex` toggled via `data-state="open"` — the menu DOM is always in the tree, just hidden. This is a documented Radix pattern for render-budget-sensitive contexts.

**Styling:** Radix ships with data attributes (`data-state="open"`, `data-side`, `data-disabled`), CSS custom properties (`--radix-context-menu-trigger-width`). Apply Tailwind v4 utilities via `className` — all `--rv-*` tokens work since they're just CSS custom properties.

**Trigger on canvas:**
```tsx
// Source: Radix docs adapted
<ContextMenu.Root>
  <ContextMenu.Trigger asChild>
    <div ref={containerRef} /* Canvas div */ />
  </ContextMenu.Trigger>
  <ContextMenu.Portal>
    <ContextMenu.Content className="... --rv-bg-elevated ...">
      {/* Conditional content based on whether right-click was on a node */}
    </ContextMenu.Content>
  </ContextMenu.Portal>
</ContextMenu.Root>
```

**Distinguishing node-click vs canvas-click:** Radix's Trigger fires on any right-click inside it. We need to know which node (if any) was targeted. Two options:
1. **Read target from native event:** `event.target.closest('[data-source-id]')` — if matches, find node ID. If null, canvas-background click.
2. **Per-node trigger wrapping:** Wrap each `foreignObject` node in its own `ContextMenu.Trigger`. Radix supports nested triggers — the innermost wins.

**Recommendation:** Option 1 (single trigger on Canvas). Simpler, avoids nesting Radix primitives through react-d3-tree's render pipeline. Use `onContextMenu` on the Canvas div to capture the native MouseEvent *before* Radix's handler, stash the target node ID in state, then let Radix open the menu. Radix's `onOpenChange` callback confirms when menu opens.

**Separator:** `<ContextMenu.Separator className="h-px bg-rv-border-subtle my-1" />` — Radix renders with `role="separator"`.

**Sub-menu (Change Status):**
```tsx
<ContextMenu.Sub>
  <ContextMenu.SubTrigger>Change Status</ContextMenu.SubTrigger>
  <ContextMenu.Portal>
    <ContextMenu.SubContent>
      {statusConfig.map(s => (
        <ContextMenu.Item key={s.id} onSelect={() => updateNodeStatus(nodeId, s.id)}>
          {s.label}
        </ContextMenu.Item>
      ))}
    </ContextMenu.SubContent>
  </ContextMenu.Portal>
</ContextMenu.Sub>
```

### Pattern 4: CodeMirror 6 with CSS-Variable Theme (EDIT-10)

**Minimum extension set** [CITED: codemirror.net/examples/config/, discuss.codemirror.net/t/8649]:

```typescript
// NotesEditor.tsx — hook-based lifecycle
import { useEffect, useRef } from "react";
import { EditorState, Compartment } from "@codemirror/state";
import { EditorView, keymap, lineNumbers, highlightActiveLine, drawSelection, rectangularSelection, crosshairCursor, placeholder } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { syntaxHighlighting, defaultHighlightStyle, bracketMatching, indentOnInput } from "@codemirror/language";
import { closeBrackets } from "@codemirror/autocomplete";
import { codemirrorRvTheme } from "../theme/codemirrorTheme";

function createExtensions(onChange: (value: string) => void) {
  return [
    history(),
    drawSelection(),
    indentOnInput(),
    bracketMatching(),
    closeBrackets(),
    highlightActiveLine(),
    markdown({ base: markdownLanguage, codeLanguages: [] }),  // codeLanguages: [] = no fenced-block highlighting, keeps bundle small
    syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
    keymap.of([...defaultKeymap, ...historyKeymap]),
    placeholder("Write notes in markdown…"),
    EditorView.lineWrapping,
    codemirrorRvTheme,  // --rv-* tokens (see next code block)
    EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        onChange(update.state.doc.toString());
      }
    }),
  ];
}
```

**Debouncing the updateListener** [CITED: discuss.codemirror.net/t/how-to-debounce-in-an-updatelistener/8649]:

> "The debounce should occur **outside the updateListener callback**, not within it."

```typescript
// Source: forum-recommended pattern
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

const updateListener = EditorView.updateListener.of((update) => {
  if (update.docChanged) {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      const content = update.state.doc.toString();
      useRoadmapStore.getState().updateNodeNotes(currentNodeId, content);
      // updateNodeNotes is not structural — won't bump dataKey — won't re-render tree
    }, 1000);  // D-11: 1s debounce
  }
});
```

**Theme via CSS variables** [VERIFIED — CSS vars are plain strings in theme values]:

```typescript
// theme/codemirrorTheme.ts
import { EditorView } from "@codemirror/view";

export const codemirrorRvTheme = EditorView.theme({
  "&": {
    backgroundColor: "var(--rv-bg-input)",
    color: "var(--rv-text-primary)",
    fontSize: "13px",
    fontFamily: "inherit",  // Inherits Inter from body
    border: "1px solid var(--rv-border)",
    borderRadius: "6px",
  },
  ".cm-content": {
    caretColor: "var(--rv-accent)",
    padding: "12px",
  },
  "&.cm-focused": {
    outline: "none",
    borderColor: "var(--rv-border-focus)",
  },
  "&.cm-focused .cm-selectionBackground, ::selection": {
    backgroundColor: "var(--rv-accent-muted)",
  },
  ".cm-cursor": {
    borderLeftColor: "var(--rv-accent)",
    borderLeftWidth: "2px",
  },
  ".cm-gutters": {
    backgroundColor: "transparent",
    color: "var(--rv-text-tertiary)",
    border: "none",
  },
}, { dark: true });  // dark:true tells CM to use its dark defaults for anything we don't override
```

The `dark: true` flag toggles based on theme at runtime. Two strategies:
1. **Simple (recommended):** Always pass `dark: true` — RoadRaven defaults to dark, and for light/high-contrast the `--rv-*` tokens already invert. CodeMirror's "dark" internal behavior is just a fallback for unthemed CSS; our explicit vars dominate.
2. **Theme-reactive:** Use a `Compartment` [CITED: codemirror.net/docs/ref/#state.Compartment] to swap the theme extension when `themeStore` changes. Over-engineered for Phase 3 — defer unless visual bugs appear in light mode.

**Lifecycle hook shape:**

```typescript
// hooks/useCodeMirror.ts
export function useCodeMirror(container: RefObject<HTMLDivElement>, initialDoc: string, onChange: (v: string) => void) {
  const viewRef = useRef<EditorView | null>(null);

  useEffect(() => {
    if (!container.current) return;
    const state = EditorState.create({
      doc: initialDoc,
      extensions: createExtensions(onChange),
    });
    const view = new EditorView({ state, parent: container.current });
    viewRef.current = view;
    return () => view.destroy();
  }, []);  // Only on mount — initialDoc and onChange should be stable via closure

  // External changes (e.g., node switched) — push new doc
  const setDoc = (newDoc: string) => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: newDoc } });
  };

  return { setDoc };
}
```

### Pattern 5: Keyboard Router (single canvas-level listener)

**What:** A single `keydown` listener on the Canvas container (or `document` with filters) dispatches shortcuts based on `document.activeElement`. [CITED: CONTEXT.md D-08] — context-aware detection.

**Why not distributed listeners:** React synthetic events fire in the order components mount. A single listener is easier to reason about — all shortcuts documented in one file.

**Pseudocode:**

```typescript
// hooks/useKeyboardRouter.ts
export function useKeyboardRouter() {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const active = document.activeElement;
      const inTextInput = active && (
        active.tagName === "INPUT" ||
        active.tagName === "TEXTAREA" ||
        active.closest(".cm-editor")  // CodeMirror editor
      );

      // Ctrl+C / Ctrl+V — context-aware
      if ((e.ctrlKey || e.metaKey) && (e.key === "c" || e.key === "v")) {
        if (inTextInput) return;  // Let browser handle text copy/paste
        if (e.key === "c") { e.preventDefault(); copyFocusedNode(); return; }
        if (e.key === "v") { e.preventDefault(); pasteIntoFocusedOrRoot(); return; }
      }

      // All other shortcuts only fire when canvas is effectively "focused"
      // Use focusedNodeId from store as ground truth, plus check that we're NOT in a text input
      if (inTextInput) return;

      const focusedId = useRoadmapStore.getState().focusedNodeId;

      switch (e.key) {
        case "F2":  /* inline rename */ break;
        case "Enter":
          if (e.shiftKey) { /* Add Sibling Above */ } else { /* Add Child */ }
          break;
        case "Tab": { e.preventDefault(); /* Add Sibling Below */ } break;
        case "Delete": case "Backspace": /* delete with confirmation if non-leaf */ break;
        case "ArrowUp": case "ArrowDown": case "ArrowLeft": case "ArrowRight":
          if (e.ctrlKey) { /* move up/down */ } else { /* focus navigation */ }
          break;
        case " ":  /* Select (open panel) */  break;
        case "d": if (e.ctrlKey) { /* duplicate */ } break;
        case "F6": /* toggle focus to/from panel */ break;
        case "Escape": /* deselect or close rename */ break;
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);
}
```

**Focus vs selection model (D-06):**

- `selectedNodeId` — existing field. Panel displays this node.
- `focusedNodeId` — NEW field. Keyboard navigation moves this. Arrow keys mutate `focusedNodeId` only. Space copies `focusedNodeId` → `selectedNodeId`.
- Node visual state:
  - Dashed ring: `focusedNodeId === this.id && keyboardNavActive`
  - Solid ring: `selectedNodeId === this.id`
  - Both can coexist — `RoadmapNode.tsx` composes both outlines.

**`keyboard-nav-active` body class (D-06 fallback):**
[CITED: UI-SPEC FocusRing note] — "react-d3-tree's `foreignObject` may not propagate focus-visible state correctly. Use the `keyboard-nav-active` body class approach."

```typescript
// Set class on keydown (any), clear on mousedown
document.addEventListener("keydown", () => document.body.classList.add("keyboard-nav-active"));
document.addEventListener("mousedown", () => document.body.classList.remove("keyboard-nav-active"));
```

Then CSS:
```css
/* index.css */
.keyboard-nav-active .node[data-focused="true"] {
  outline: 2px dashed var(--rv-accent);
  outline-offset: 2px;
}
```

### Pattern 6: Autosave Scheduler (EDIT-13)

**Three triggers** per D-15 / EDIT-13:
1. 2s debounce after any structural mutation (add/delete/move/duplicate/paste/rename)
2. 1s debounce after any content mutation (notes, metadata, status, type) — different channel because notes are more "live"
3. 30s periodic regardless of mutations
4. Flush on `before-quit` (Electrobun) + `SIGTERM` (Linux)

**Implementation sketch:**

```typescript
// hooks/useAutosave.ts — runs once, mounted in App
export function useAutosave() {
  const structuralTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notesTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const periodicTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // 30s periodic
  useEffect(() => {
    periodicTimer.current = setInterval(() => flushNow(), 30000);
    return () => { if (periodicTimer.current) clearInterval(periodicTimer.current); };
  }, []);

  // Subscribe to store — schedule debounces on mutation
  useEffect(() => {
    const unsub = useRoadmapStore.subscribe((state, prev) => {
      const structuralChanged = state.dataKey !== prev.dataKey;
      const statusChanged = state.statusTick !== prev.statusTick;
      // Note: title rename also bumps dataKey per recommendation above
      if (structuralChanged) {
        if (structuralTimer.current) clearTimeout(structuralTimer.current);
        structuralTimer.current = setTimeout(() => flushNow(), 2000);
      } else if (statusChanged) {
        if (notesTimer.current) clearTimeout(notesTimer.current);
        notesTimer.current = setTimeout(() => flushNow(), 1000);
      }
    });
    return unsub;
  }, []);
}

async function flushNow() {
  const { schema, filePath, saveState } = useRoadmapStore.getState();
  if (!schema || !filePath) return;
  if (saveState === "saving") return;  // avoid overlap
  useRoadmapStore.getState().setSaveState("saving");
  try {
    await electroview.rpc.request.saveFile({ schema });
    useRoadmapStore.getState().setSaveState("saved");
  } catch (err) {
    useRoadmapStore.getState().setSaveState("error-retrying", String(err));
    // Escalation timer per D-15 handled inside setSaveState
  }
}
```

**Flush on quit — main process side [CITED: blackboard.sh/electrobun/llms.txt]:**

```typescript
// bun/index.ts
import { Electrobun } from "electrobun/bun";  // hypothetical import — verify exact Electrobun events API in planning phase

// This is the documented pattern per Electrobun LLM docs
Electrobun.events.on("before-quit", async (e) => {
  await flushWriteQueue();
  // Optionally cancel quit if flush failed with unrecoverable error:
  // if (saveFailed) e.response = { allow: false };
});

// SIGTERM on Linux (also caught by Electrobun's before-quit per docs, but belt-and-braces)
process.on("SIGTERM", async () => {
  await flushWriteQueue();
  process.exit(0);
});
```

[ASSUMED: Exact `Electrobun.events` import path and `before-quit` event name — the llms.txt doc reference uses `Electrobun.events.on("before-quit", ...)`. The planner must verify the exact import and subscribe API in the Electrobun type definitions at `packages/desktop/node_modules/electrobun/` before writing the task. Fallback: if the event is exposed differently, use `process.on("exit")` + `process.on("SIGINT")` + `BrowserWindow.on("close")`.]

**Flush coordination between processes:** The webview owns the in-memory schema. On `before-quit`, Bun must ask the webview for the current state. Options:
1. **Bun-side cache:** webview pushes the full schema to Bun on every autosave trigger. Bun's `saveFile` handler then writes from the cached state. `before-quit` writes whatever's in the cache. **Simpler.**
2. **RPC call on quit:** Bun's `before-quit` handler makes a synchronous RPC to webview asking for state. Risk: webview may have already unmounted or RPC latency exceeds the quit timeout.

**Recommendation:** Option 1 (Bun-side cache). Any webview-initiated autosave sends the full `RoadmapSchema` to Bun, which caches it in a module-scope variable. `before-quit` flushes the cache. This is also the only way to guarantee flush if the webview process crashes.

### Pattern 7: Atomic Write + Windows Retry (EDIT-14)

**Algorithm:**
1. Write payload to `<path>.<pid>.<timestamp>.tmp` using `Bun.write`.
2. Optionally call `fsyncSync` on the tmp file descriptor for durability (Bun: use `node:fs` interop).
3. Rename tmp → target path using `fs.renameSync` (atomic on POSIX, best-effort on Windows).
4. On Windows EPERM/EBUSY/EACCES, retry up to 3 times with 50ms delay [per EDIT-14].

**Code sketch:**

```typescript
// bun/atomicWrite.ts
import { renameSync, unlinkSync } from "node:fs";
import { dirname, basename, join } from "node:path";

export async function atomicWrite(targetPath: string, content: string): Promise<void> {
  const tmpPath = join(
    dirname(targetPath),
    `.${basename(targetPath)}.${process.pid}.${Date.now()}.tmp`
  );
  try {
    await Bun.write(tmpPath, content);  // Bun.write handles fsync internally per Bun docs
  } catch (err) {
    throw new Error(`Failed to write temp file ${tmpPath}: ${err}`);
  }

  const isWindows = process.platform === "win32";
  const maxAttempts = isWindows ? 3 : 1;
  let lastErr: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      renameSync(tmpPath, targetPath);
      return;  // success
    } catch (err: unknown) {
      lastErr = err;
      const code = (err as NodeJS.ErrnoException).code;
      const retriable = code === "EPERM" || code === "EBUSY" || code === "EACCES" || code === "EEXIST";
      if (!retriable || attempt === maxAttempts) break;
      await new Promise(r => setTimeout(r, 50));
    }
  }

  // Cleanup tmp on failure
  try { unlinkSync(tmpPath); } catch { /* best effort */ }
  throw lastErr;
}
```

**Windows EEXIST corner case** [CITED: openclaw issue #52093]: Windows `fs.renameSync` can throw EEXIST if the destination exists under certain conditions (some networked filesystems, antivirus locks). The retry loop handles transient EEXIST. If EEXIST persists, we could `unlinkSync(targetPath)` before retry — but that breaks atomicity (brief window where file doesn't exist). For RoadRaven, acceptable since `.bak.json` is written on every load and provides recovery.

**Bun.write vs Node fs:** `Bun.write` is faster and handles the fastest syscall per platform [CITED: bun.sh/docs/runtime/file-io]. For `renameSync`, Bun delegates to Node's `node:fs` compat layer — identical semantics.

### Pattern 8: `$ref` Write-Back Map (EDIT-16)

**The problem:** At load time, `resolveRefs` in `bun/index.ts` merges referenced files into one unified tree. We lose the information "node X came from file Y." To write mutations back correctly:
- A rename of a node from file Y must update file Y, not the main file.
- A move of a node from file Y to within file Z's subtree would cross boundaries — forbidden in v1.

**Data structure:** `Map<nodeId, filePath>` — the "owner" of each loaded node. Built during `resolveRefs` and maintained by store mutations.

**Where it lives:** Bun main process — the single source of truth, since Bun is the writer. Pushed to the webview on load for UI decisions (e.g., blocking cross-boundary paste with a preview error before it hits Bun).

**Bun-side shape (`bun/refMap.ts`):**

```typescript
// Source: new module — pattern
type FilePath = string;

// Map every node ID to the file path that owns it
let ownershipMap = new Map<string, FilePath>();

export function buildOwnershipMap(rootNodes: RoadmapNode[], mainFilePath: string): Map<string, FilePath> {
  const map = new Map<string, FilePath>();
  // During resolveRefs, every node gets tagged with its source file
  // (requires resolveRefs to pass the current file path as a parameter)
  walkAndTag(rootNodes, mainFilePath, map);
  ownershipMap = map;
  return map;
}

function walkAndTag(nodes: RoadmapNode[], currentFile: FilePath, map: Map<string, FilePath>) {
  for (const node of nodes) {
    map.set(node.id, currentFile);
    if (node.children) walkAndTag(node.children, currentFile, map);
  }
}

export function getOwnership(): Map<string, FilePath> { return ownershipMap; }
```

**Refactor required in `bun/index.ts`'s `resolveRefs`:** Pass the current "owning file" down the recursion. When entering a `$ref`'d subtree, switch `currentFile` to the referenced file path. Every node tagged accordingly.

**Writing back on saveFile:**
[CITED: existing pattern — Phase 2 reads all $ref files upfront]

When the webview issues `saveFile({schema})`, Bun must split the schema back into per-file payloads:

```typescript
// Source: new logic in bun/index.ts saveFile handler
async function saveFileSplit(schema: RoadmapSchema, mainFilePath: string) {
  const ownership = getOwnership();
  // Group nodes by owning file
  const fileGroups = new Map<FilePath, RoadmapNode[]>();
  const mainFileNodes: RoadmapNode[] = [];

  function collectNodes(nodes: RoadmapNode[], parentOwner: FilePath) {
    for (const node of nodes) {
      const owner = ownership.get(node.id) ?? parentOwner;
      if (owner === mainFilePath) {
        mainFileNodes.push(node);  // nope — need to preserve tree shape, see below
      }
      // ...
    }
  }
  // Actually this is more complex — see "Cross-boundary detection" below
}
```

**The split-back problem:** A `$ref` in the source file expands to N nodes at load time. At save time, we need to compress those N nodes back into a `$ref` placeholder in the main file and write the N nodes to the referenced file separately.

**Simpler design:** The source file's JSON already has a `$ref` placeholder where the subtree expanded. Keep the original pre-resolution schema in Bun as a "template":

```typescript
// bun-side module state
let sourceTemplate: RoadmapSchema | null = null;   // what the main file looked like with $refs unresolved
let resolvedSchema: RoadmapSchema | null = null;   // what's in memory after resolveRefs
```

At save time:
1. Iterate `resolvedSchema.nodes` and build per-file trees based on ownership.
2. For the main file: walk `sourceTemplate.nodes`; wherever a `$ref` existed in the template, replace the expanded subtree in `resolvedSchema` with a `$ref` placeholder matching the template. Write the rest of the main file nodes (which may have been edited in place — those edits stay in the main file).
3. For each referenced file path: write the subtree of nodes owned by that file.

**Cross-boundary move detection (EDIT-16):**

A cross-boundary move occurs when a structural mutation causes a node owned by file A to become a descendant of a node owned by file B (where A ≠ B). Detect at the store level before committing:

```typescript
// In store's moveNode / pasteNode / addChild actions
function wouldCrossBoundary(nodeBeingMoved: string, newParentId: string): boolean {
  const ownership = /* mirror of Bun's ownership map, synced to webview */;
  const ownerA = ownership.get(nodeBeingMoved);
  const ownerB = ownership.get(newParentId);
  return ownerA !== undefined && ownerB !== undefined && ownerA !== ownerB;
}
```

**How ownership propagates through mutations:**
- `addChild(parentId, newNode)` → newNode inherits `ownership[parentId]`.
- `duplicateNode` → duplicated subtree inherits `ownership` of the duplicate's new parent (source inherits from target parent).
- `deleteNode` → ownership entries removed for deleted nodes.
- `moveNode up/down` within same siblings → no ownership change (same parent).
- `pasteNode(parentId, json)` → pasted nodes inherit `ownership[parentId]`.
- **Move or paste that would change owner:** Block with error "Cannot move this node across file boundaries. Move it within the same file." (UI-SPEC Copywriting).

**Sync strategy:** Mirror the Bun-side map to the webview on `loadFile` response. Webview mutations update its mirror optimistically; saveFile round-trips and Bun re-validates.

### Anti-Patterns to Avoid

- **Do NOT** increment `dataKey` on every mutation. react-d3-tree deep-clones the entire tree on `dataKey` change — that's why `dataKey` exists [VERIFIED: roadmapStore.ts comments]. Status/notes/metadata edits MUST use `statusTick` or a similar in-place counter.
- **Do NOT** hand-roll a context menu when Radix ships one. D-02's "custom `<div>`" means "not native OS menu" — it does not exclude a headless UI library that also renders `<div>`s.
- **Do NOT** use `setTimeout`-based polling for react-d3-tree's transform. Use the `onUpdate` callback — it's the official API.
- **Do NOT** call `fs.renameSync` without retry on Windows. EPERM/EBUSY from Windows Defender scanning tmp files is a known issue [CITED: github.com/nodejs/node/issues/29481].
- **Do NOT** write the entire schema on every status change. Debounce at the store-subscription layer.
- **Do NOT** expose the webview clipboard `readText` without a fallback. Some CEF security configs restrict clipboard-read even when write works. [CITED: Phase 2 already uses `writeText` successfully.] Check `readText` permission before Ctrl+V and fall back to a stored last-copied subtree if permission denied.
- **Do NOT** open the context menu on `mousedown` — right-click should fire on `contextmenu` event. Radix handles this correctly.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Context menu with ARIA + keyboard nav + submenu + viewport clamping | Custom `<div role="menu">` with manual arrow/Home/End/Escape handling, roving tabindex, portal mounting, collision detection | `@radix-ui/react-context-menu` (already installed) | W3C-compliant ARIA [CITED: w3.org/WAI/ARIA/apg/patterns/menu/] is fragile to implement. Radix has shipped this for 4+ years. [CITED: radix-ui.com] |
| Focus-trapped modal with Escape-to-close, aria-modal, initial focus management | Custom modal with manual focus ring cycling, Tab trap, Escape handler | `@radix-ui/react-dialog` (already installed) | Focus trapping edge cases (iframe, disabled items, tabindex=-1 inside) are notorious for accessibility bugs |
| UUID v4 generation | Import `uuid` + call `v4()` | `crypto.randomUUID()` (built-in) | Zero-dep, native in Bun and CEF. `uuid` package installed but not needed — one less import. |
| Markdown rendering | Custom parser | Existing `MarkdownRenderer` (remark/rehype) | Already shipped in Phase 2, full GFM support |
| Syntax highlighting for markdown edit | Custom tokenizer | `@codemirror/lang-markdown` (already installed) | GFM + extensible; part of CodeMirror canonical stack |
| Debounce utility | `lodash.debounce` or custom | Inline `clearTimeout`/`setTimeout` per the CM forum pattern [CITED: discuss.codemirror.net/t/8649] | 5 LOC; no dep cost |
| File watcher | custom `fs.watch` wrapper | Existing `packages/desktop/src/bun/fileWatcher.ts` | Phase 2 already ships a debounced cross-platform watcher |
| Atomic file write | ~~npm `write-file-atomic`~~ | Hand-rolled per §8 (no lib solves Windows retry) | [CITED: github.com/npm/write-file-atomic/issues/227] — lib does NOT retry Windows. Requirement says 3×50ms — hand-roll. |
| Side-panel resize | Custom drag logic | Existing `ResizeHandle` component | Ships in Phase 2 |
| React 18+ + React 19 compat | Version juggling | React 19.2.5 already installed in `packages/desktop` | Verified via `package.json` |

**Key insight:** The most alluring hand-roll trap is the context menu (D-02 reads like "build custom"). Reading closely: D-02 says "custom webview-rendered `<div>` on ALL platforms" — this distinguishes from *native OS menus* (Electrobun's `ContextMenu.showContextMenu()`). Radix Context Menu renders as a custom `<div>` via React portal — it satisfies the decision exactly while giving us W3C compliance. Using Radix is NOT deviation from D-02; it's the most efficient way to satisfy D-02.

## Runtime State Inventory

*Not applicable — Phase 3 is a greenfield feature-add (editor capabilities on top of read-only viewer). No renames, migrations, or refactors of existing runtime state.*

**Verification:** Searched `.planning/STATE.md` and CONTEXT.md for any rename/refactor/migration language — none present. The phase adds new mutation actions, new components, new RPC handlers, new file watcher uses. No existing nodeIds, ChromaDB collections, Task Scheduler registrations, SOPS keys, egg-info, or any other runtime artifacts change identity.

## Common Pitfalls

### Pitfall 1: `dataKey` incremented on every mutation → 30fps gate regression
**What goes wrong:** Adding a mutation action that naively calls `set({ treeData: toTreeDatum(...), dataKey: String(n+1) })` on every update causes react-d3-tree to deep-clone the tree. Phase 2's 300-node benchmark breaks.
**Why it happens:** Pattern-matching against existing `loadSchema`/`reloadSchema` actions without distinguishing structural from in-place.
**How to avoid:** Enforce the table in Pattern 1 above. Add a unit test: `updateNodeStatus` must NOT change `dataKey`. `addChild` MUST change `dataKey`. Write these tests FIRST (TDD per project norm).
**Warning signs:** Benchmark test fails at p95 > 33ms. Panel "flickers" when editing notes.

### Pitfall 2: Inline rename input drifts on zoom/pan
**What goes wrong:** User opens rename, pans canvas, input is now over the wrong position.
**Why it happens:** Position computed once on open; not updated on transform change.
**How to avoid:** Wire `onUpdate` callback on the Tree. While rename is open, recompute position from new transform on every `onUpdate` fire.
**Warning signs:** Visual drift during zoom; input can be trapped offscreen.

### Pitfall 3: react-d3-tree interferes with interactive inputs
**What goes wrong:** User clicks/drags inside the inline rename input, triggering canvas pan.
**Why it happens:** react-d3-tree propagates drag events through foreignObject contents.
**How to avoid:** Set `hasInteractiveNodes={true}` on `<Tree>` [CITED: react-d3-tree types.d.ts line 266]. From the docs: *"Disables drag/pan/zoom D3 events when hovering over a node. Useful for cases where D3 events interfere when interacting with inputs or other interactive elements on a node. Tip: Holding Shift while hovering over a node re-enables D3 events."* Also call `e.stopPropagation()` on input keydown/mousedown.
**Warning signs:** Canvas pans while typing; unable to click inside input.

### Pitfall 4: Windows atomic rename fails silently
**What goes wrong:** Windows Defender scans the `.tmp` file, locks it, rename fails with EPERM. Without retry, the temp file accumulates and the real file never updates.
**Why it happens:** Transient locks from AV or indexer [CITED: nodejs/node#29481].
**How to avoid:** The 3×50ms retry pattern in §8. Cleanup tmp on final failure.
**Warning signs:** User reports "my changes disappeared." `.tmp` files accumulate in the data directory.

### Pitfall 5: Autosave fires during unmount / app quit before Bun receives the write
**What goes wrong:** Webview unmounts (via Cmd+Q); debounce timer cancelled; pending write never fires.
**Why it happens:** Local debounce state lost on unmount.
**How to avoid:**
- Push state to Bun on every store change (the "Bun-side cache" pattern in §6).
- Main process `before-quit` flushes from its cache, not from the webview.
- Also set `setInterval` 30s periodic as a floor.
**Warning signs:** "Saved ✓" appears but restart shows stale file.

### Pitfall 6: `navigator.clipboard.readText` permission denied in some builds
**What goes wrong:** Ctrl+V in canvas-focus mode fails; user confused.
**Why it happens:** CEF security policies vary by platform/build. Phase 2 uses `writeText` successfully, so write is granted — but `readText` may still prompt or deny.
**How to avoid:** Wrap `readText` in a try/catch. On failure, fall back to an in-memory "last copied" buffer maintained alongside the clipboard write. This also supports copy-within-app without clipboard latency.
**Warning signs:** Paste works intermittently; silent failures.

### Pitfall 7: `Enter` key conflicts between context menu and "Add Child"
**What goes wrong:** While context menu is open, Enter activates the selected menu item. That's correct. But the keyboard router also listens for Enter → "Add Child." Both fire.
**Why it happens:** Both handlers active simultaneously.
**How to avoid:** Radix handles focus trapping inside the context menu — when a menu item is focused, keyboard events are captured by Radix before reaching our document-level handler. Verify by checking `e.defaultPrevented` and `document.activeElement` at the top of the keyboard router.
**Warning signs:** Pressing Enter on a menu item both closes the menu AND creates a new child node.

### Pitfall 8: CodeMirror theme not reacting to light/dark theme switch
**What goes wrong:** User switches from Dark to Light theme; CodeMirror editor stays dark.
**Why it happens:** CodeMirror's `{dark: true}` option is baked in at extension creation; CSS variables update but CM's internal computed styles don't.
**How to avoid:** Either (a) ignore — `--rv-*` tokens invert and the editor follows, even with `dark:true` flag (flag only affects unthemed CM defaults, which shouldn't be visible because we override); or (b) use a Compartment to swap the theme extension when `themeStore` updates.
**Warning signs:** Editor background stays dark on light theme, but panel goes light.

### Pitfall 9: react-d3-tree's `dataKey` silent de-optimization
**What goes wrong:** Accidentally passing a new object reference to `data` without `dataKey` change (or with wrong `dataKey` logic) causes a re-render that looks visually correct but throws off zoom/pan state.
**Why it happens:** Phase 2 comment in roadmapStore.ts warns this is brittle.
**How to avoid:** Always set `data` and `dataKey` together in the store. Unit test: after `updateNodeStatus`, the store's `treeData` must be the SAME reference. After `addChild`, treeData MUST be a new reference AND `dataKey` MUST have incremented.
**Warning signs:** Zoom resets unexpectedly during editing.

### Pitfall 10: Context-menu 50ms render budget under React 19 concurrent rendering
**What goes wrong:** Menu takes >50ms to appear on right-click when tree is under load.
**Why it happens:** React 19 may defer updates under concurrent mode.
**How to avoid:** Use `ContextMenu.Portal forceMount` with `data-state`-driven CSS visibility if measurements show >50ms. Alternative: wrap menu mount in `flushSync` (React 18+).
**Warning signs:** UAT measurement (performance.now from right-click to menu-visible) exceeds 50ms.

## Code Examples

### Example 1: react-d3-tree onUpdate wiring

```typescript
// Source: react-d3-tree/lib/types/Tree/types.d.ts line 73
// In Canvas.tsx — add onUpdate and store the latest transform
import { useCallback } from "react";

const [transform, setTransform] = useState({ x: 0, y: 0, k: 1 });

const handleUpdate = useCallback((target: { node: TreeNodeDatum | null; zoom: number; translate: { x: number; y: number } }) => {
  setTransform({ x: target.translate.x, y: target.translate.y, k: target.zoom });
  // Persist to store if needed (we already persist translate/zoom for FitView)
  setTranslate({ x: target.translate.x, y: target.translate.y });
  setZoomLevel(target.zoom);
}, [setTranslate, setZoomLevel]);

<Tree
  data={treeData}
  dataKey={dataKey}
  onUpdate={handleUpdate}
  hasInteractiveNodes={true}
  // ...
/>
```

### Example 2: Radix Context Menu with conditional node/canvas content

```tsx
// Source: radix-ui.com/primitives/docs/components/context-menu, adapted
import * as ContextMenu from "@radix-ui/react-context-menu";

function CanvasContextMenu({ children }: { children: React.ReactNode }) {
  const [targetNodeId, setTargetNodeId] = useState<string | null>(null);

  const handleContextMenu = (e: React.MouseEvent) => {
    // Identify if right-click hit a node
    const target = (e.target as Element).closest("[data-source-id]") as HTMLElement | null;
    setTargetNodeId(target?.dataset.sourceId ?? null);
  };

  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>
        <div onContextMenu={handleContextMenu}>{children}</div>
      </ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Content className="min-w-[200px] bg-[var(--rv-bg-elevated)] border border-[var(--rv-border)] rounded-[8px] py-1 shadow-[var(--rv-shadow-config)]">
          {targetNodeId ? <NodeMenuItems nodeId={targetNodeId} /> : <CanvasMenuItems />}
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}
```

### Example 3: CodeMirror 6 mount + debounced autosave

```typescript
// Source: forum recommendation + CM6 docs adaptation
// hooks/useCodeMirror.ts
import { useEffect, useRef } from "react";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { createExtensions } from "./createExtensions";

export function useCodeMirror(
  container: RefObject<HTMLDivElement>,
  nodeId: string,
  initialDoc: string,
  onPersist: (nodeId: string, content: string) => void,  // store.updateNodeNotes
  debounceMs = 1000,
) {
  const viewRef = useRef<EditorView | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!container.current) return;

    const exts = createExtensions((newContent: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => onPersist(nodeId, newContent), debounceMs);
    });

    const view = new EditorView({
      state: EditorState.create({ doc: initialDoc, extensions: exts }),
      parent: container.current,
    });
    viewRef.current = view;
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      view.destroy();
    };
  }, [nodeId]);  // Remount when node switches

  return viewRef;
}
```

### Example 4: Atomic write with Windows retry

```typescript
// Source: project-authored, based on npm/write-file-atomic#227 discussion
// bun/atomicWrite.ts
import { renameSync, unlinkSync } from "node:fs";
import { dirname, basename, join } from "node:path";
import { bunLogger } from "./logging";

export async function atomicWrite(targetPath: string, content: string): Promise<void> {
  const tmpPath = join(dirname(targetPath), `.${basename(targetPath)}.${process.pid}.${Date.now()}.tmp`);

  await Bun.write(tmpPath, content);  // Bun.write uses fsync internally

  const isWindows = process.platform === "win32";
  const maxAttempts = isWindows ? 3 : 1;
  let lastErr: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      renameSync(tmpPath, targetPath);
      return;
    } catch (err) {
      lastErr = err;
      const code = (err as NodeJS.ErrnoException).code;
      const retriable = code === "EPERM" || code === "EBUSY" || code === "EACCES" || code === "EEXIST";
      if (!retriable || attempt === maxAttempts) break;
      bunLogger.warn`atomicWrite rename attempt ${attempt} failed: ${code} — retrying in 50ms`;
      await new Promise(r => setTimeout(r, 50));
    }
  }

  try { unlinkSync(tmpPath); } catch { /* best effort cleanup */ }
  throw lastErr;
}
```

### Example 5: File ownership tagging during $ref resolution

```typescript
// Source: refactor of bun/index.ts resolveRefs
async function resolveRefs(
  nodes: RoadmapNode[],
  basePath: string,
  currentOwner: FilePath,
  watchCallback: (path: string) => void,
  ownershipMap: Map<string, FilePath>,  // NEW
  visited: Set<string> = new Set(),
): Promise<RoadmapNode[]> {
  const baseDir = dirname(basePath);
  const resolved: RoadmapNode[] = [];
  for (const node of nodes) {
    if (node.$ref) {
      const refAbsPath = pathResolve(baseDir, node.$ref);
      // ... existing guards ...
      const raw = await Bun.file(refAbsPath).text();
      const parsed = JSON.parse(raw);
      const refNodes: RoadmapNode[] = Array.isArray(parsed) ? parsed : (parsed.nodes ?? [parsed]);
      // NEW: tag each ref'd node (and descendants) with the ref'd file as owner
      const tagged = await resolveRefs(refNodes, refAbsPath, refAbsPath, watchCallback, ownershipMap, visited);
      resolved.push(...tagged);
    } else {
      ownershipMap.set(node.id, currentOwner);  // NEW: tag this node
      const next = { ...node };
      if (node.children) {
        next.children = await resolveRefs(node.children, basePath, currentOwner, watchCallback, ownershipMap, visited);
      }
      resolved.push(next);
    }
  }
  return resolved;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| CodeMirror 5 (single-bundle) | CodeMirror 6 (modular extensions) | CM6 released 2022-06; now standard | Must install `state`, `view`, `lang-markdown` separately; use `EditorState` + `EditorView` pattern |
| Hand-rolled ARIA context menus | Headless libraries (Radix, Headless UI) | 2020-2022 ecosystem shift | Install a library; get W3C compliance + keyboard nav for free |
| `uuid` v4 npm package | `crypto.randomUUID()` native | Node 14.17+, all modern browsers | Drop the uuid dep unless v7/v1 needed |
| Electron `will-quit` event | Electrobun `before-quit` event | Electrobun docs (2024-2026) | Electrobun has its own event taxonomy — do not use Electron patterns |
| `fs.watch` (Node native) | `chokidar` for cross-platform edge cases | ongoing | Phase 2 uses `fs.watch` + debounce — acceptable; chokidar is fallback if issues surface |
| `window.prompt` for inline rename | Floating custom `<input>` positioned via inverse transform | WCAG compliance + modern UX | EDIT-01 explicitly requires this |

**Deprecated/outdated:**
- `html2canvas` — excluded at roadmap level (Phase 5). Confirmed irrelevant to Phase 3.
- `react-transition-group` CSS transitions in react-d3-tree (`enableLegacyTransitions={true}`) — legacy, already `false` in Phase 2 Canvas.tsx.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Electrobun exposes `Electrobun.events.on("before-quit", handler)` as documented in llms.txt | Pattern 6 | EDIT-13 flush-on-quit breaks. Planner MUST verify exact API during first task of Plan 4 by inspecting `packages/desktop/node_modules/electrobun/dist` type definitions. Fallback: `process.on("SIGINT")` + `BrowserWindow.on("close")`. |
| A2 | `navigator.clipboard.readText` works in Electrobun CEF webview (writeText is verified working via SidePanel.tsx line 42) | Pitfall 6 | Ctrl+V for cross-file paste breaks. Fallback: in-memory buffer + restrict to paste-within-session. Test during Plan 1 execution. |
| A3 | `hierarchyPointNode.x / .y` reliably reports local SVG coordinates matching the post-transform rendered position | Pattern 2 | Inline rename positioning wrong. Fallback: `document.querySelector('[data-source-id="X"]').getBoundingClientRect()`. Test during Plan 1 execution. |
| A4 | Radix Context Menu renders within 50ms on a 300-node tree under React 19 concurrent mode | Pitfall 10 | EDIT-09 performance requirement missed. Fallback: `forceMount` pattern + CSS visibility toggle. Measure in UAT. |
| A5 | `crypto.randomUUID()` available in the Electrobun CEF webview | Pattern 1 | New nodes created without IDs; Zod validation fails. Verified available in Node 14.17+ and Bun; CEF based on Chromium also supports. Fallback: import `uuid` package (already installed). |
| A6 | Bun `bun pm view` version output is current as of 2026-04 | Standard Stack table | Packages might be outdated. Verified via live `bun pm view` against the installed package.json — latest matches installed. |

**If this table has entries:** The planner MUST either verify each assumption before committing to a plan, OR include a fallback task in the plan to validate early (e.g., "Task 1.1: Verify `Electrobun.events.on('before-quit')` API exists; if not, adopt fallback pattern X").

## Open Questions (RESOLVED)

1. **Does Electrobun expose clipboard-read permission toggling?**
   - What we know: `navigator.clipboard.writeText` works in Phase 2. `readText` behavior is undocumented for Electrobun.
   - What's unclear: Whether the CEF build grants clipboard-read by default.
   - Recommendation: Plan 1 first task probes `navigator.clipboard.readText()` and logs result. If denied, implement the in-memory buffer fallback for Ctrl+V (still works within-app, fails gracefully for cross-app paste).
   - **RESOLVED:** Clipboard probe + in-memory buffer fallback specified in Plan 01 Task 0 and Plan 01 clipboard.ts (A2).

2. **How does react-d3-tree handle `dataKey` changes while the inline rename is open?**
   - What we know: `dataKey` change deep-clones the tree, which would re-render all nodes.
   - What's unclear: Does the rename's `<input>` get unmounted, or does its `ref` survive because it's a DOM peer of the SVG tree, not a child?
   - Recommendation: The rename input is rendered as a portal to `document.body` (per UI-SPEC "position: fixed"). It's NOT inside the Tree's SVG. It survives tree re-renders. **Not actually an issue** — but verify during Plan 1.
   - **RESOLVED:** Rename input is a portal to document.body — survives dataKey-driven tree re-renders. Verified pattern in Plan 01.

3. **What happens to `selectedNodeId` when a node is deleted?**
   - What we know: Selection is a single ID reference.
   - What's unclear: Should selection move to the parent, to the previous sibling, or simply clear?
   - Recommendation: Clear selection (set to `null`) — simplest, consistent with "no undo." UI-SPEC copy suggests "Keep Node" is the confirmation default, so this path is rare. Phase 3 ships with clear-on-delete; Phase v2 could add smarter focus retargeting.
   - **RESOLVED:** Delete clears selectedNodeId to null (simplest, consistent with no-undo semantics). Encoded in Plan 01 deleteNode.

4. **Should `File > New` show the welcome screen or create an untitled tree immediately?**
   - What we know: EDIT-17 says "creates in-memory schema with a single root node and prompts for save location on first edit."
   - What's unclear: Does the prompt happen on the user's first mutation, or on first autosave timer fire (which is 2s after the first mutation)?
   - Recommendation: Prompt on first *autosave attempt*, not first mutation. This matches the 2s debounce — user gets 2s to hit Escape without being prompted. If user clicks File > New then immediately closes the app, no prompt is needed.
   - **RESOLVED:** Prompt fires on first autosave attempt (2s after first mutation), not first mutation. Encoded in Plan 04 useAutosave / flushNow.

5. **How does `$ref` ownership handle a $ref file that fails to resolve (e.g., permission denied)?**
   - What we know: Phase 2 handles failure by pushing the unresolved `$ref` node through.
   - What's unclear: In Phase 3, an unresolved `$ref` has no owner. Mutations inside it become ambiguous.
   - Recommendation: If a `$ref` fails to resolve, the `$ref` node itself remains — user sees the error via SchemaErrorPanel. Mutations are blocked on that subtree because there are no descendant nodes to mutate (the $ref didn't expand). No special code needed beyond Phase 2's existing handling.
   - **RESOLVED:** Unresolved ref keeps placeholder node; no owner needed because descendants were never expanded. No extra code beyond Phase 2 handling.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Bun runtime | All | ✓ (via project) | — | — |
| Electrobun | All | ✓ | 1.16.0 | — |
| Node fs (compat) | atomicWrite | ✓ via Bun node:fs compat | native | — |
| `crypto.randomUUID()` | New node ID generation | ✓ in Bun + CEF | native Web API | `uuid` npm package (installed v13.0.0) |
| `navigator.clipboard.writeText` | EDIT-05 copy | ✓ (Phase 2 uses in SidePanel) | native | — |
| `navigator.clipboard.readText` | EDIT-05 paste | ? (A2 assumption) | native | In-memory buffer for within-session paste |
| `@codemirror/state`, `view`, `lang-markdown` | EDIT-10 notes editor | ✓ installed | 6.6.0 / 6.41.0 / 6.5.0 | — |
| `@radix-ui/react-context-menu` | EDIT-09 context menu | ✓ installed | 2.2.16 | Hand-roll (would fail 50ms budget + ARIA) |
| `@radix-ui/react-dialog` | EDIT-03, EDIT-15 modals | ✓ installed | 1.1.15 | — |

**Missing dependencies with no fallback:** None — all dependencies in place.
**Missing dependencies with fallback:** clipboard-read (if Electrobun CEF denies permission — fall back to in-memory buffer).

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.4 + @testing-library/react 16.3.2 + jsdom 29.0.2 |
| Config file | `packages/desktop/vite.config.ts` (Vite + Vitest shares config), `packages/desktop/vitest.config.ts` if present — verify in Wave 0 |
| Quick run command | `bunx vitest run packages/desktop/src/mainview/...` (filtered) |
| Full suite command | `bunx vitest run` (from repo root) |
| E2E framework | Playwright 1.59.1 installed; Phase 2 validated two-tier pattern |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| EDIT-01 | Inline rename commits new title via store | unit | `bunx vitest run packages/desktop/src/mainview/hooks/useInlineRename.test.ts` | ❌ Wave 0 |
| EDIT-01 | Position math: lx·k + tx matches getBoundingClientRect | unit | `bunx vitest run packages/desktop/src/mainview/hooks/useInlineRename.test.ts -t "position"` | ❌ Wave 0 |
| EDIT-01 | Cancel (Escape) restores original title | unit | same file, `-t "cancel"` | ❌ Wave 0 |
| EDIT-02 | `addChild(parentId)` creates UUID, default status "not-started", adds to parent.children, bumps dataKey | unit | `bunx vitest run packages/desktop/src/mainview/store/roadmapStore.mutations.test.ts -t "addChild"` | ❌ Wave 0 |
| EDIT-02 | `addSiblingAbove`/`Below` correct ordering | unit | same file, `-t "addSibling"` | ❌ Wave 0 |
| EDIT-03 | Leaf delete: no dialog, immediate | unit | `roadmapStore.mutations.test.ts -t "deleteNode leaf"` | ❌ Wave 0 |
| EDIT-03 | Non-leaf delete: returns deletedCount; dialog shown on UI side | unit + integration | unit for store count; integration for dialog | ❌ Wave 0 |
| EDIT-04 | `duplicateNode` assigns fresh UUIDs to every descendant; same tree shape | unit | `roadmapStore.mutations.test.ts -t "duplicateNode"` | ❌ Wave 0 |
| EDIT-04 | Duplicated nodes inherit parent's ownership | unit | same + ref ownership fixture | ❌ Wave 0 |
| EDIT-05 | `copySubtreeToClipboard` writes correct JSON | unit | `clipboard.test.ts` | ❌ Wave 0 |
| EDIT-05 | `pasteFromClipboard` from valid JSON creates nodes with fresh UUIDs | unit | same | ❌ Wave 0 |
| EDIT-05 | Malformed clipboard JSON handled gracefully | unit | same | ❌ Wave 0 |
| EDIT-06 | `moveNodeUp` / `moveNodeDown` swaps siblings; bumps dataKey | unit | `roadmapStore.mutations.test.ts -t "moveNode"` | ❌ Wave 0 |
| EDIT-06 | moveNodeUp on first child = no-op | unit | same | ❌ Wave 0 |
| EDIT-07 | Arrow key navigation: Up/Down cycles siblings, Right enters child, Left returns to parent | unit | `useKeyboardRouter.test.ts -t "arrow"` | ❌ Wave 0 |
| EDIT-08 | Status sub-menu lists all `statusConfig` entries | integration | React Testing Library mounts ContextMenu | ❌ Wave 0 |
| EDIT-09 | Context menu mounts and is visible within 50ms | manual UAT (instrumented) | Timed via performance.now() in a Playwright step | ❌ Manual |
| EDIT-09 | Context menu ARIA roles correct (menu, menuitem, separator, haspopup) | unit | `ContextMenu.test.tsx` queries by role | ❌ Wave 0 |
| EDIT-09 | Keyboard nav cycles menu items | unit | same + userEvent.keyboard | ❌ Wave 0 |
| EDIT-10 | CodeMirror mounts and initial doc is rendered | unit | `NotesEditor.test.tsx` | ❌ Wave 0 |
| EDIT-10 | Debounce: 1 change within 1s = 1 persist call | unit | fake timers + `updateNodeNotes` spy | ❌ Wave 0 |
| EDIT-10 | Edit/Preview/Split toggle switches mode | unit | `NotesEditor.test.tsx -t "segmented"` | ❌ Wave 0 |
| EDIT-11 | Metadata row add/edit/delete | unit | `MetadataEditor.test.tsx` | ❌ Wave 0 |
| EDIT-12 | Panel title edit persists via `renameNode` | unit | `SidePanel.edit-mode.test.tsx` | ❌ Wave 0 |
| EDIT-12 | Status/type dropdown updates store | unit | same | ❌ Wave 0 |
| EDIT-13 | Autosave debounce: N mutations within 2s = 1 saveFile call | unit | `useAutosave.test.ts` with fake timers | ❌ Wave 0 |
| EDIT-13 | 30s periodic fires even without mutations | unit | fake timers advance 30s | ❌ Wave 0 |
| EDIT-13 | flushNow on before-quit calls saveFile synchronously | integration | Playwright process test that triggers quit and verifies file written | ❌ Wave 0 |
| EDIT-14 | Atomic write: tmp file created, renamed to target, tmp absent after | unit | `atomicWrite.test.ts` with tmp dir | ❌ Wave 0 |
| EDIT-14 | Windows retry: simulate EPERM on first rename, succeed on second | unit | mock `renameSync` to throw then succeed | ❌ Wave 0 |
| EDIT-14 | Non-retriable errors fail fast | unit | same with ENOENT | ❌ Wave 0 |
| EDIT-15 | SaveIndicator displays correct state | unit | `SaveIndicator.test.tsx` for each state transition | ❌ Wave 0 |
| EDIT-15 | 3rd failure triggers modal | unit | `useAutosave.test.ts` with 3 consecutive error responses | ❌ Wave 0 |
| EDIT-16 | Ownership map correctly tagged after $ref resolution | unit | `refMap.test.ts` with fixture schemas | ❌ Wave 0 |
| EDIT-16 | Cross-boundary move blocked with error copy from UI-SPEC | unit | `roadmapStore.mutations.test.ts -t "cross-boundary"` | ❌ Wave 0 |
| EDIT-16 | Save splits schema: main file gets $ref placeholder, ref file gets subtree | integration | Bun-side test that writes a 2-file fixture, mutates, saves, reads back | ❌ Wave 0 |
| EDIT-17 | File > New creates in-memory schema with 1 root node | unit | `fileActions.test.ts` | ❌ Wave 0 |
| EDIT-17 | First mutation on untitled doc prompts for save path on autosave fire | integration | Mock openFileDialog; verify prompt | ❌ Wave 0 |
| EDIT-18 | Linux right-click opens custom menu (handled via D-02 = all platforms) | manual | Playwright on Linux CI + visual | ❌ Manual |

### Sampling Rate

- **Per task commit:** `bunx vitest run <test-file>` (changed files only, fast feedback <5s)
- **Per wave merge:** `bunx vitest run` (all Phase 3 tests, <30s expected)
- **Phase gate:** `bunx vitest run` (ALL tests) + `bunx vite build` + `bunx @biomejs/biome lint packages/desktop/src/ shared/` must all be green before `/gsd-verify-work`
- **Manual UAT per phase exit:** Right-click → menu visible within 50ms (instrumented via Playwright `performance.now()` delta); atomic write under kill (background save in progress; `process.kill`; verify `.tmp` cleanup and file intact or recoverable).

### Wave 0 Gaps

Test files to create (all missing):

- [ ] `packages/desktop/src/mainview/store/roadmapStore.mutations.test.ts` — covers EDIT-02, EDIT-03, EDIT-04, EDIT-06, EDIT-16
- [ ] `packages/desktop/src/mainview/store/clipboard.test.ts` — covers EDIT-05
- [ ] `packages/desktop/src/mainview/store/fileActions.test.ts` — covers EDIT-17
- [ ] `packages/desktop/src/mainview/hooks/useKeyboardRouter.test.ts` — covers EDIT-07, keyboard dispatch
- [ ] `packages/desktop/src/mainview/hooks/useInlineRename.test.ts` — covers EDIT-01 position math + commit/cancel
- [ ] `packages/desktop/src/mainview/hooks/useAutosave.test.ts` — covers EDIT-13, EDIT-15 state machine
- [ ] `packages/desktop/src/mainview/components/ContextMenu.test.tsx` — covers EDIT-09 ARIA + keyboard
- [ ] `packages/desktop/src/mainview/components/NotesEditor.test.tsx` — covers EDIT-10 CodeMirror + segmented toggle
- [ ] `packages/desktop/src/mainview/components/MetadataEditor.test.tsx` — covers EDIT-11
- [ ] `packages/desktop/src/mainview/components/SidePanel.edit-mode.test.tsx` — covers EDIT-12
- [ ] `packages/desktop/src/mainview/components/SaveIndicator.test.tsx` — covers EDIT-15 UI
- [ ] `packages/desktop/src/bun/atomicWrite.test.ts` — covers EDIT-14
- [ ] `packages/desktop/src/bun/refMap.test.ts` — covers EDIT-16 ownership
- [ ] `packages/desktop/tests/process/save-flush.test.ts` — Playwright process-tier integration for EDIT-13 flush-on-quit
- [ ] `packages/desktop/tests/ui/context-menu-50ms.test.ts` — Playwright UI-tier instrumented timing for EDIT-09 render budget

Framework install: none — Vitest + Playwright already configured in Phase 0.

Shared fixtures needed:
- [ ] `packages/desktop/src/mainview/store/__fixtures__/basic-schema.json` — 3 nodes, 1 level
- [ ] `packages/desktop/src/mainview/store/__fixtures__/ref-schema.json` + `referenced-part.json` — main file + $ref file for ownership tests
- [ ] `packages/desktop/src/mainview/store/__fixtures__/large-schema.json` — 50+ nodes for autosave debounce tests

## Sources

### Primary (HIGH confidence)

- **react-d3-tree type definitions** — `packages/desktop/node_modules/react-d3-tree/lib/types/Tree/types.d.ts` lines 73-77 (`onUpdate` callback with transform), line 266 (`hasInteractiveNodes`), `common.d.ts` lines 33-66 (`CustomNodeElementProps` including `hierarchyPointNode`). Verified locally.
- **Electrobun LLM docs** — https://blackboard.sh/electrobun/llms.txt (before-quit event, Utils.openFileDialog, no save dialog, SIGTERM catching)
- **CodeMirror 6 documentation** — https://codemirror.net/examples/config/, https://codemirror.net/examples/styling/ (EditorView.theme, basicSetup, extension model)
- **d3-zoom documentation** — https://d3js.org/d3-zoom (zoomTransform object, apply/invert methods, affine transform math)
- **Radix UI Context Menu** — https://www.radix-ui.com/primitives/docs/components/context-menu (ARIA, keyboard nav, submenus, viewport clamping)
- **W3C WAI-ARIA Authoring Practices — Menu pattern** — https://www.w3.org/WAI/ARIA/apg/patterns/menubar/ (keyboard contract, roving tabindex, aria-haspopup, aria-expanded)
- **Bun File I/O documentation** — https://bun.sh/docs/runtime/file-io (Bun.write signature, syscall optimization)
- **CodeMirror forum — debounce pattern** — https://discuss.codemirror.net/t/how-to-debounce-in-an-updatelistener/8649 (debounce outside callback, exact code pattern)
- **Verified installed versions** — `bun pm view` run live for all Phase 3 dependencies (2026-04-16)

### Secondary (MEDIUM confidence)

- **npm/write-file-atomic issue #227** — https://github.com/npm/write-file-atomic/issues/227 (confirms no Windows retry; justifies hand-roll)
- **nodejs/node issue #29481** — https://github.com/nodejs/node/issues/29481 (Windows EPERM rename known issue)
- **openclaw issue #52093** — Windows EEXIST on atomic write (referenced in web search result)

### Tertiary (LOW confidence — needs verification during planning)

- A1 (Electrobun `before-quit` exact API) — documented in LLM text, not verified against live type defs
- A2 (clipboard.readText availability in Electrobun CEF) — no dedicated source; must probe at runtime

## Metadata

**Confidence breakdown:**

- Standard stack: **HIGH** — every version verified against installed `node_modules` + `bun pm view`
- Architecture patterns (store, keyboard, autosave): **HIGH** — building on Phase 2's verified-working foundation
- Floating rename math: **HIGH** — verified against react-d3-tree type defs + d3-zoom official docs
- Context menu (Radix): **HIGH** — official Radix docs + W3C ARIA spec cross-referenced
- CodeMirror theme + debounce: **HIGH** — CM official docs + community-accepted forum pattern
- Atomic write (Windows retry): **MEDIUM** — pattern is well-known but we're hand-rolling; integration-test in situ during Plan 4
- `$ref` ownership map: **MEDIUM** — design is new, no canonical pattern to reference; tests will validate
- Electrobun `before-quit` exact API: **LOW** — assumption A1; planner must verify during Plan 4

**Research date:** 2026-04-16
**Valid until:** 2026-05-16 (30 days — dependency landscape is stable; verify versions again if phase delayed)
