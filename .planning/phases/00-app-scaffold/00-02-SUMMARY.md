---
phase: 00-app-scaffold
plan: 02
subsystem: rpc-contract
tags: [types, rpc, electrobun, safety]
dependency_graph:
  requires: [00-01]
  provides: [shared-types, rpc-contract, safe-updater]
  affects: [packages/desktop/src/bun/index.ts]
tech_stack:
  added: []
  patterns: [typed-rpc-contract, safe-channel-detection]
key_files:
  created:
    - shared/types.ts
  modified:
    - packages/desktop/src/bun/index.ts
decisions:
  - Used re-export pattern for RoadmapRPCType from bun entry to satisfy noUnusedLocals while proving import works
  - Exported mainWindow to resolve TS unused variable warning (will be used by RPC setup in Phase 2)
  - Kept placeholder domain types (RoadmapSchema, RoadmapNode, IntegrationEvent) as simple interfaces until Phase 2 Zod schemas
metrics:
  duration: ~2min
  completed: 2026-04-13
  tasks_completed: 1
  tasks_total: 1
  files_created: 1
  files_modified: 1
---

# Phase 00 Plan 02: RPC Type Contract & Updater Safety Summary

Typed RPC contract skeleton in shared/types.ts with RoadmapRPCType defining all bun requests/messages and webview messages, plus Updater.localInfo.channel() wrapped in try/catch for safe dev-mode boot.

## What Was Done

### Task 1: Create shared/types.ts RPC contract and fix Updater wrapper
- **Commit:** 69fb7ed
- Created `shared/types.ts` at workspace root with:
  - `RoadmapSchema`, `RoadmapNode`, `IntegrationEvent` placeholder interfaces
  - `RoadmapRPCType` type with full bun requests (loadFile, saveFile, exportHtml, exportPng, openFilePicker, resolveRef), bun messages (nodeStatusUpdate, integrationEvent, fileChanged), and webview messages (pushStatusUpdate, pushEventLog, pushFileChanged)
- Rewrote `packages/desktop/src/bun/index.ts`:
  - Wrapped `Updater.localInfo.channel()` in try/catch with `"dev"` fallback (SCAF-09)
  - Re-exported `RoadmapRPCType` from shared/types.ts
  - Exported `mainWindow` for downstream use
- Verified `packages/desktop/tsconfig.json` already includes `"../../shared"` in include array (set by Plan 01)
- TypeScript compilation passes for all files in this plan (pre-existing errors in App.tsx and electrobun's three.js dep are out of scope)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed incorrect relative import path**
- **Found during:** Task 1
- **Issue:** Plan specified `import from "../../shared/types.ts"` but correct relative path from `packages/desktop/src/bun/` to workspace root `shared/` is `../../../../shared/types.ts`
- **Fix:** Updated import to use correct 4-level-up relative path
- **Files modified:** packages/desktop/src/bun/index.ts

**2. [Rule 1 - Bug] Fixed noUnusedLocals TypeScript errors**
- **Found during:** Task 1
- **Issue:** `noUnusedLocals: true` in tsconfig flagged `mainWindow` and unused `_typeCheck` type variable
- **Fix:** Exported `mainWindow` (will be used in Phase 2 for RPC binding), removed `_typeCheck` in favor of `export type { RoadmapRPCType }` re-export which proves importability at compile time
- **Files modified:** packages/desktop/src/bun/index.ts

## Verification Results

- shared/types.ts exists with all required exports (RoadmapRPCType, RoadmapSchema, RoadmapNode, IntegrationEvent, RPCSchema)
- packages/desktop/src/bun/index.ts re-exports RoadmapRPCType from shared/types.ts
- Updater.localInfo.channel() is in try/catch block with "dev" fallback
- Old bare `const channel = await Updater.localInfo.channel()` pattern eliminated
- tsconfig.json includes "../../shared" for TypeScript resolution
- `bunx tsc --noEmit` shows zero errors from plan files (pre-existing errors in App.tsx and electrobun node_modules are out of scope)

## Self-Check: PASSED
