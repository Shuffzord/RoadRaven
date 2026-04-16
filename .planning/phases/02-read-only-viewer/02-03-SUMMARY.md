---
phase: 02-read-only-viewer
plan: 03
subsystem: ui, settings
tags: [side-panel, markdown-renderer, welcome-screen, recent-files, remark-gfm, rehype-react, resize-handle]

# Dependency graph
requires:
  - phase: 02-read-only-viewer-02
    provides: react-d3-tree Canvas, roadmapStore with getSelectedNode, file loading RPC, settings RPC
provides:
  - Data-driven SidePanel reading node data from roadmapStore
  - MarkdownRenderer with unified/remark-gfm/rehype-react pipeline for GFM
  - ResizeHandle for panel width drag between 320px and 50% viewport
  - WelcomeScreen with hero card, Open File, New Roadmap, recent files, sample links
  - addRecentFile in settings.ts (deduplicates, caps at 10)
  - Recent file tracking in Bun loadFile handler
affects: [02-04]

# Tech tracking
tech-stack:
  added: [unified, remark-parse, remark-gfm, remark-rehype, rehype-react]
  patterns: [unified markdown pipeline with custom React component mapping, browser-safe basename without node:path, dynamic import for sample schemas, ResizeHandle with mousemove tracking]

key-files:
  created:
    - packages/desktop/src/mainview/components/MarkdownRenderer.tsx
    - packages/desktop/src/mainview/components/ResizeHandle.tsx
    - packages/desktop/src/mainview/components/WelcomeScreen.tsx
    - packages/desktop/tests/unit/settings.test.ts
  modified:
    - packages/desktop/src/mainview/components/SidePanel.tsx
    - packages/desktop/src/mainview/components/RoadmapNode.tsx
    - packages/desktop/src/mainview/components/Canvas.tsx
    - packages/desktop/src/bun/index.ts
    - packages/desktop/src/bun/settings.ts
    - packages/desktop/package.json
    - packages/desktop/tests/unit/ui/components.test.tsx
    - bun.lock

key-decisions:
  - "Used browser-safe basename function instead of node:path -- webview cannot import Node.js built-ins"
  - "Dynamic import for sample schemas instead of RPC call -- samples are bundled with vite, no filesystem access needed from webview"
  - "Kept isPinnable state prefixed with underscore -- pin mode state is tracked for Phase 3 use but not consumed in Phase 2 read-only mode"
  - "Added biome-ignore for role=complementary on aside -- plan acceptance criteria requires explicit role attribute"

patterns-established:
  - "unified pipeline: remark-parse -> remark-gfm -> remark-rehype -> rehype-react with custom component mapping for --rv-* token styling"
  - "ResizeHandle pattern: mousedown on handle, mousemove on window, mouseup cleanup, clamped between min/max"
  - "WelcomeScreen conditional render: treeData === null shows welcome, otherwise shows Tree"
  - "addRecentFile: deduplicate by filtering existing, prepend, slice to 10"

requirements-completed: [VIEW-09, VIEW-10, VIEW-13, VIEW-14]

# Metrics
duration: 9min
completed: 2026-04-15
---

# Phase 2 Plan 3: Side Panel + Welcome Screen Summary

**Data-driven SidePanel with remark/rehype markdown pipeline, ResizeHandle for panel resizing, WelcomeScreen with recent files and sample links, addRecentFile settings persistence with TDD**

## Performance

- **Duration:** 9 min
- **Started:** 2026-04-15T13:42:29Z
- **Completed:** 2026-04-15T13:51:49Z
- **Tasks:** 2 of 2
- **Files created:** 4
- **Files modified:** 8

## Accomplishments

- SidePanel fully data-driven from roadmapStore: shows title, status badge, type, created/updated dates, node ID with copy-to-clipboard, and markdown notes
- MarkdownRenderer uses unified/remark-gfm/rehype-react pipeline with custom component mapping for all --rv-* token styling, including GFM tables, task lists, code blocks, and blockquotes
- ResizeHandle enables drag-to-resize side panel between 320px and 50% viewport width
- WelcomeScreen renders centered hero card when no file is loaded, with Open File button, New Roadmap button (Phase 3 stub), recent files list, and sample schema links
- addRecentFile function in settings.ts: deduplicates entries, caps at 10, most recent first
- Bun loadFile handler tracks recently opened files via addRecentFile
- Canvas conditionally renders WelcomeScreen when treeData === null
- javascript: href blocking in MarkdownRenderer (T-02-08 mitigation)
- formatStatus and STATUS_TOKEN_MAP exported from RoadmapNode for SidePanel reuse

## Task Commits

Each task was committed atomically:

1. **Task 1: Data-driven SidePanel + MarkdownRenderer + ResizeHandle** - `ca864a6` (feat)
2. **Task 2 RED: Failing tests for addRecentFile** - `c43284c` (test)
3. **Task 2 GREEN: WelcomeScreen + recent files + settings** - `c6454eb` (feat)

## Files Created/Modified

- `packages/desktop/src/mainview/components/MarkdownRenderer.tsx` - New: unified pipeline with custom React component mapping for --rv-* tokens
- `packages/desktop/src/mainview/components/ResizeHandle.tsx` - New: drag handle with mousedown/mousemove/mouseup event lifecycle
- `packages/desktop/src/mainview/components/WelcomeScreen.tsx` - New: centered hero card with actions, recent files, sample links
- `packages/desktop/tests/unit/settings.test.ts` - New: 8 tests for settings persistence and addRecentFile
- `packages/desktop/src/mainview/components/SidePanel.tsx` - Rewritten: data-driven from roadmapStore, MarkdownRenderer for notes, ResizeHandle, copy ID
- `packages/desktop/src/mainview/components/RoadmapNode.tsx` - Export formatStatus and STATUS_TOKEN_MAP
- `packages/desktop/src/mainview/components/Canvas.tsx` - WelcomeScreen conditional render, recent files loading, sample schema handlers
- `packages/desktop/src/bun/index.ts` - addRecentFile call after successful loadFile
- `packages/desktop/src/bun/settings.ts` - addRecentFile function (deduplicate, cap at 10)
- `packages/desktop/package.json` - Added unified, remark-parse, remark-gfm, remark-rehype, rehype-react
- `packages/desktop/tests/unit/ui/components.test.tsx` - Updated SidePanel test to set store state for data-driven rendering
- `bun.lock` - Updated with new dependencies

## Decisions Made

- Used browser-safe `basename` function instead of `node:path` -- webview runs in browser context where Node.js built-ins are externalized by Vite
- Dynamic `import()` for sample schemas instead of RPC filesystem call -- samples are bundled by Vite as JSON modules, no filesystem access needed
- Kept `_isPinnable` state with underscore prefix -- pin mode state is tracked for Phase 3 panel behavior but not consumed in Phase 2 read-only mode
- Added `biome-ignore` for `role="complementary"` on `<aside>` -- plan acceptance criteria explicitly requires the attribute despite Biome flagging it as redundant

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Missing `unified` package**
- **Found during:** Task 1 (vite build)
- **Issue:** MarkdownRenderer imports `unified` but the package was not installed (only `remark` and `rehype` were)
- **Fix:** `bun add unified` alongside other markdown packages
- **Files modified:** packages/desktop/package.json, bun.lock
- **Committed in:** ca864a6

**2. [Rule 1 - Bug] node:path import in WelcomeScreen browser context**
- **Found during:** Task 2 (vite build)
- **Issue:** `import { basename } from "node:path"` fails in browser/webview context -- Vite externalizes Node.js modules
- **Fix:** Implemented inline `basename` function using `String.split(/[\\/]/).pop()`
- **Files modified:** packages/desktop/src/mainview/components/WelcomeScreen.tsx
- **Committed in:** c6454eb

**3. [Rule 1 - Bug] Existing SidePanel test assumed hardcoded content**
- **Found during:** Task 2 (full test suite)
- **Issue:** `components.test.tsx` SidePanel test expected field labels to be visible when panel is open but no node is selected -- data-driven panel now shows "Select a node to view details." instead
- **Fix:** Updated test to set roadmapStore with a test node and select it before asserting field labels
- **Files modified:** packages/desktop/tests/unit/ui/components.test.tsx
- **Committed in:** c6454eb

**4. [Rule 1 - Bug] Multiple Biome lint and format violations**
- **Found during:** Tasks 1 and 2 (pre-commit hook)
- **Issue:** Import ordering, unused variable (isPinnable), redundant role, aria-valuenow missing, format inconsistencies
- **Fix:** Auto-fixed formatting; added biome-ignore comments for intentional patterns; prefixed unused variable with underscore; added aria-valuenow to separator
- **Files modified:** MarkdownRenderer.tsx, ResizeHandle.tsx, SidePanel.tsx, WelcomeScreen.tsx, settings.ts, Canvas.tsx, settings.test.ts
- **Committed in:** ca864a6, c6454eb

---

**Total deviations:** 4 auto-fixed (2 bugs, 1 blocking, 1 format compliance)
**Impact on plan:** All auto-fixes necessary for compilation, test passing, and lint compliance. No scope creep.

## Threat Flags

None -- no new security surfaces introduced beyond what was planned. T-02-08 (markdown XSS) mitigated via rehype-react React elements (no dangerouslySetInnerHTML) and javascript: href blocking.

## Known Stubs

| File | Line | Stub | Reason |
|------|------|------|--------|
| Canvas.tsx | handleNewRoadmap | No-op callback | Phase 3 implements File > New |

## Next Phase Readiness

- Plan 02-04 (Performance gate) ready to proceed
- Side panel fully data-driven with markdown rendering
- Welcome screen functional with recent files and sample schemas
- All 112 tests passing, vite build succeeds, lint clean

## Self-Check: PASSED

All 9 created/modified files verified present on disk. All 3 task commits (ca864a6, c43284c, c6454eb) verified in git log. 112 unit tests passing, production build succeeds, lint clean.

---
*Phase: 02-read-only-viewer*
*Completed: 2026-04-15*
