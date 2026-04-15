---
status: complete
phase: 02-read-only-viewer
source: [02-01-SUMMARY.md, 02-02-SUMMARY.md, 02-03-SUMMARY.md, 02-04-SUMMARY.md]
started: 2026-04-15T14:30:00Z
updated: 2026-04-15T14:50:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Cold Start Smoke Test
expected: Kill any running dev server. Run `bun run dev:hmr` from scratch. App boots without errors in terminal. The Electrobun window opens and shows the WelcomeScreen.
result: pass

### 2. Welcome Screen
expected: On first launch (no file loaded), a centered hero card appears with an "Open File" button, a "New Roadmap" button (stub), sample schema links (hello-world, getting-started), and a recent files list if any exist.
result: pass

### 3. Open File & Tree Rendering
expected: Click "Open File" in TopBar or WelcomeScreen. A native file dialog opens. Select a roadmap JSON file (e.g., samples/getting-started.json). The tree renders with node cards showing title text, a colored status badge, and step-style connector lines between nodes.
result: pass

### 4. Node Selection & Side Panel
expected: Click any node card in the tree. A selection ring appears around it. The side panel opens showing: node title, status badge, type, created/updated dates, node ID with a copy-to-clipboard button, and markdown notes (if any).
result: issue
reported: "Selection ring does not show on neither of themes. Side panel does open - copy button works. Markdown works but did not test advanced formatting"
severity: major

### 5. Collapse/Expand Nodes
expected: On a node with children, click the collapse chevron (colored badge with child count). Children collapse and disappear. Click again to expand them back. The badge shows the number of hidden children.
result: pass

### 6. Layout Toggle (TB/LR)
expected: In the TopBar, toggle the layout between Top-to-Bottom (TB) and Left-to-Right (LR). The tree reorients accordingly — vertical hierarchy vs horizontal hierarchy.
result: pass

### 7. Fit View Reset
expected: After zooming or panning the tree off-center, click "Fit View" in the TopBar. The tree recenters and resets to its default zoom/position.
result: issue
reported: "Yes - although clicking fit view expands all collapsed elements and thats not the expected behaviour"
severity: minor

### 8. Zoom and Pan
expected: Mouse wheel zooms in/out on the tree canvas. Click-and-drag on empty canvas area pans the view. Both are smooth without visible lag.
result: pass

### 9. Side Panel Resize
expected: Drag the resize handle on the left edge of the side panel. The panel width changes smoothly, clamped between ~320px minimum and ~50% of the viewport maximum.
result: pass

### 10. Markdown Notes in Side Panel
expected: Select a node that has markdown in its notes field (e.g., from getting-started.json). The side panel renders the markdown with proper formatting: headings, bold/italic, code blocks, links, and GFM features like tables or task lists.
result: pass

### 11. Status Bar Info
expected: After loading a file, the status bar at the bottom shows the loaded file name and total node count (e.g., "getting-started.json | 15 nodes").
result: pass

### 12. Schema Validation Errors
expected: Load a malformed or invalid JSON file (e.g., missing required fields). Instead of crashing, a SchemaErrorPanel appears showing Zod validation error messages with paths. The tree does not render.
result: pass

### 13. File Watcher Auto-Reload
expected: With a file loaded, edit that JSON file externally (e.g., in a text editor) and save. Within ~1 second, the tree updates to reflect the changes without manually reopening the file.
result: pass

### 14. Sample Schema Quick Load
expected: From the WelcomeScreen, click one of the sample schema links (e.g., "Getting Started"). The sample loads immediately into the tree without a file dialog.
result: pass

### 15. Recent Files Tracking
expected: After opening one or more files, return to the WelcomeScreen (close file or restart). The recently opened files appear in the recent files list. Clicking one reopens it.
result: pass

### 16. Canvas Click Deselect
expected: With a node selected (ring visible, side panel showing details), click on empty canvas area (not on a node). The selection ring disappears and the side panel shows "Select a node to view details" or similar empty state.
result: skipped
reason: User prefers current behavior (side panel stays open). Deselect UX to be revisited in future phase.

### 17. Performance at Scale
expected: Load a large schema with 300+ nodes (or the getting-started sample). Zoom in/out, pan rapidly, toggle TB/LR layout. The tree renders at 30+ fps with no visible jank or freezing.
result: pass

## Summary

total: 17
passed: 14
issues: 2
pending: 0
skipped: 1
blocked: 0

## Gaps

- truth: "Selection ring appears around clicked node card on both themes"
  status: failed
  reason: "User reported: Selection ring does not show on neither of themes. Side panel does open - copy button works. Markdown works but did not test advanced formatting"
  severity: major
  test: 4
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""
- truth: "Fit View recenters tree without expanding collapsed nodes"
  status: failed
  reason: "User reported: Yes - although clicking fit view expands all collapsed elements and thats not the expected behaviour"
  severity: minor
  test: 7
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""
