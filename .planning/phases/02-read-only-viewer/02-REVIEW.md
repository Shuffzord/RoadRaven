---
phase: 02-read-only-viewer
reviewed: 2026-04-16T12:00:00Z
depth: standard
files_reviewed: 28
files_reviewed_list:
  - packages/core/src/index.ts
  - packages/core/src/schema.ts
  - packages/desktop/src/bun/fileWatcher.ts
  - packages/desktop/src/bun/index.ts
  - packages/desktop/src/bun/settings.ts
  - packages/desktop/src/mainview/App.tsx
  - packages/desktop/src/mainview/components/Canvas.tsx
  - packages/desktop/src/mainview/components/MarkdownRenderer.tsx
  - packages/desktop/src/mainview/components/ResizeHandle.tsx
  - packages/desktop/src/mainview/components/RoadmapNode.tsx
  - packages/desktop/src/mainview/components/SchemaErrorPanel.tsx
  - packages/desktop/src/mainview/components/SidePanel.tsx
  - packages/desktop/src/mainview/components/StatusBar.tsx
  - packages/desktop/src/mainview/components/TopBar.tsx
  - packages/desktop/src/mainview/components/WelcomeScreen.tsx
  - packages/desktop/src/mainview/rpc.ts
  - packages/desktop/src/mainview/rpcHandlers.ts
  - packages/desktop/src/mainview/store/roadmapStore.ts
  - packages/desktop/tests/bench/generateSchema.ts
  - packages/desktop/tests/bench/perf.bench.ts
  - packages/desktop/tests/unit/fileWatcher.test.ts
  - packages/desktop/tests/unit/schema.test.ts
  - packages/desktop/tests/unit/settings.test.ts
  - packages/desktop/tests/unit/store/roadmapStore.test.ts
  - packages/desktop/tests/unit/ui/components.test.tsx
  - packages/desktop/tests/unit/ui/viewer-smoke.test.tsx
  - packages/desktop/vitest.config.ts
  - shared/types.ts
findings:
  critical: 2
  warning: 5
  info: 3
  total: 10
status: issues_found
---

# Phase 02: Code Review Report

**Reviewed:** 2026-04-16T12:00:00Z
**Depth:** standard
**Files Reviewed:** 28
**Status:** issues_found

## Summary

Phase 02 implements the read-only viewer: Zod schema validation, file loading with `$ref` resolution, a Zustand store for tree rendering via react-d3-tree, a side panel for node details, file watching with debounce, and settings persistence. Overall code quality is solid with good separation of concerns, comprehensive test coverage, and proper error handling in most paths.

Key concerns center on two security issues in the Bun main process (path traversal in `resolveRef` RPC handler, and a bypassable directory escape guard in `resolveRefs`), plus several correctness issues including settings using `console.warn` instead of the project's LogTape logger, missing error propagation in the `useFileActions` hook, and an unused `Sidebar` import that could indicate dead code.

## Critical Issues

### CR-01: Path Traversal in `resolveRef` RPC Handler -- No Validation

**File:** `packages/desktop/src/bun/index.ts:243-255`
**Issue:** The `resolveRef` RPC handler reads any file path from the webview without any validation. Unlike the `resolveRefs` function (which has a `baseDir` guard), this handler takes a raw `refPath` parameter from the renderer process and reads it directly via `Bun.file(refPath).text()`. A compromised or malicious webview payload could read arbitrary files on the user's filesystem (e.g., `../../etc/passwd`, `C:\Users\...\credentials.json`).
**Fix:** Add path validation to ensure the resolved path is within the project directory or the directory of the currently loaded file:
```typescript
resolveRef: async ({ refPath }) => {
  const { filePath } = useRoadmapStore?.getState?.() ?? {};
  if (!filePath) return [];
  const baseDir = dirname(filePath);
  const absPath = pathResolve(baseDir, refPath);
  if (!absPath.startsWith(baseDir + sep)) {
    bunLogger.error`resolveRef escapes base directory: ${refPath}`;
    return [];
  }
  try {
    const raw = await Bun.file(absPath).text();
    // ... rest of handler
  }
}
```

### CR-02: `resolveRefs` Directory Escape Guard Is Bypassable

**File:** `packages/desktop/src/bun/index.ts:65`
**Issue:** The guard `!refAbsPath.startsWith(baseDir + sep)` fails for paths that resolve to the base directory itself (i.e., `baseDir` without a trailing separator). More critically, on Windows, path comparison is case-insensitive, but `startsWith` is case-sensitive. A `$ref` like `./../../SomeDir/../OriginalDir/file.json` that resolves to a path with different casing could bypass the check. Additionally, on Windows, mixed forward/back slashes can produce paths that bypass the `startsWith` check.
**Fix:** Normalize both paths before comparison and use a case-insensitive comparison on Windows:
```typescript
const normalizedBase = baseDir.toLowerCase() + sep;
const normalizedRef = refAbsPath.toLowerCase();
if (!normalizedRef.startsWith(normalizedBase)) {
  bunLogger.error`$ref escapes base directory: ${node.$ref}`;
  resolved.push(node);
  continue;
}
```
Or better, use `path.relative()` and check it does not start with `..`:
```typescript
const rel = path.relative(baseDir, refAbsPath);
if (rel.startsWith('..') || path.isAbsolute(rel)) {
  bunLogger.error`$ref escapes base directory: ${node.$ref}`;
  resolved.push(node);
  continue;
}
```

## Warnings

### WR-01: Settings Module Uses `console.warn` Instead of Project Logger

**File:** `packages/desktop/src/bun/settings.ts:35,59`
**Issue:** The settings module uses `console.warn` for error logging, while the rest of the Bun process uses `bunLogger` from LogTape (per the project's D-21 logging decision). This means settings errors will not appear in structured logs and will be missed in production log aggregation. The project's memory notes specifically flag logging as a critical concern.
**Fix:** Import and use the project logger:
```typescript
import { bunLogger } from "./logging";
// Replace console.warn calls:
bunLogger.warn`Failed to parse settings.json: ${String(e)}`;
bunLogger.warn`Failed to save settings: ${String(e)}`;
```

### WR-02: `loadAndApply` Swallows Schema Errors When `response.data` Is Null

**File:** `packages/desktop/src/mainview/hooks/useFileActions.ts:7-11`
**Issue:** When `loadFile` returns `{ data: null, errors: [...] }` (a Zod validation failure), `loadAndApply` calls `setSchemaErrors` but does NOT clear the previous schema from the store. The old tree data remains displayed alongside the new error panel, creating a misleading UI state where the user sees a stale tree plus errors from a different file.
**Fix:** Clear the schema when data is null:
```typescript
if (response?.data) {
  useRoadmapStore.getState().loadSchema(response.data, path);
} else {
  // Clear stale data when new file fails validation
  useRoadmapStore.getState().loadSchema(
    { version: "", title: "", nodes: [] } as any,
    path
  );
}
useRoadmapStore.getState().setSchemaErrors(response?.errors ?? []);
```

### WR-03: `resolveRefs` Does Not Validate Parsed JSON Against Schema

**File:** `packages/desktop/src/bun/index.ts:78-83`
**Issue:** When resolving `$ref` nodes, the parsed JSON from referenced files is used directly as `RoadmapNode[]` without Zod validation. Malformed referenced files could inject unexpected data shapes into the tree, causing runtime errors in the renderer (e.g., missing `id`, `title`, or `status` fields that components access without null checks).
**Fix:** Validate the parsed nodes against `RoadmapNodeSchema` before including them:
```typescript
const { RoadmapNodeSchema } = await import("../../../../packages/core/src/schema");
const refNodes: RoadmapNode[] = (Array.isArray(parsed) ? parsed : (parsed.nodes ?? [parsed]))
  .filter((n: unknown) => RoadmapNodeSchema.safeParse(n).success);
```

### WR-04: `generateLargeSchema` Produces Non-UUID Node IDs

**File:** `packages/desktop/tests/bench/generateSchema.ts:28`
**Issue:** The benchmark schema generator creates node IDs like `"node-0"`, `"node-1"` which do not pass `z.string().uuid()` validation in `RoadmapNodeSchema`. This means the generated schemas would fail Zod validation if ever validated, making the benchmarks test a code path that differs from production. The `loadSchema` store action does not re-validate, so this works in tests, but it is a false-confidence pattern.
**Fix:** Use deterministic UUIDs in the generator:
```typescript
function deterministicUUID(index: number): string {
  const hex = index.toString(16).padStart(12, '0');
  return `00000000-0000-4000-8000-${hex}`;
}
```

### WR-05: `openRecent` Does Nothing Outside Electrobun

**File:** `packages/desktop/src/mainview/hooks/useFileActions.ts:46-50`
**Issue:** The `openRecent` callback has no dev-mode fallback -- when `electroview` is null (running in browser via HMR), clicking a recent file does nothing silently. The `openFile` callback has a dev fallback, but `openRecent` does not. This makes the WelcomeScreen's recent files list non-functional during HMR development.
**Fix:** Add a dev-mode fallback or at minimum log a warning:
```typescript
const openRecent = useCallback(async (path: string) => {
  if (electroview) {
    await loadAndApply(path);
  } else {
    webLogger.warn("openRecent called outside Electrobun -- not supported in dev mode");
  }
}, []);
```

## Info

### IN-01: Unused `Sidebar` Import in App.tsx

**File:** `packages/desktop/src/mainview/App.tsx:2`
**Issue:** `App.tsx` imports `Sidebar` from `./components/Sidebar` and renders `<Sidebar />`, but `Sidebar` is not in the list of reviewed files for this phase. If `Sidebar` is a minimal/placeholder component, this is fine; if it was renamed or replaced, the import should be cleaned up.
**Fix:** Verify `Sidebar` is intentional. If it is placeholder/empty, consider removing until it has content.

### IN-02: `StatusBar` Always Shows "Connected" Status

**File:** `packages/desktop/src/mainview/components/StatusBar.tsx:13-14`
**Issue:** The status bar hardcodes a green dot and "Connected" text regardless of actual connection state. There is no WebSocket or RPC health check driving this indicator. This is acceptable for Phase 02 (read-only viewer) but should be wired to actual connection state in Phase 03.
**Fix:** No action needed for Phase 02. Track for Phase 03 when WebSocket integration is added.

### IN-03: Zoom In/Out Buttons Have No `onClick` Handler

**File:** `packages/desktop/src/mainview/components/TopBar.tsx:130-168`
**Issue:** The zoom in and zoom out buttons in the TopBar render with no `onClick` handler -- clicking them does nothing. The `handleFitView` function exists for the Fit button, but zoom increment/decrement is not wired up.
**Fix:** Wire the buttons to `setZoomLevel` from the store:
```typescript
onClick={() => {
  const current = useRoadmapStore.getState().zoomLevel;
  useRoadmapStore.getState().setZoomLevel(Math.min(current + 0.1, 3));
}}
```

---

_Reviewed: 2026-04-16T12:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
