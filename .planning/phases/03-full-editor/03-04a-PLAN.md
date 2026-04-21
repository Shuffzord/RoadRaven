---
phase: 03-full-editor
plan: 04a
type: execute
wave: 1
depends_on: []
files_modified:
  - shared/types.ts
  - packages/desktop/src/bun/atomicWrite.ts
  - packages/desktop/src/bun/refMap.ts
  - packages/desktop/src/bun/index.ts
  - packages/desktop/src/renderer/components/_dev/DevHarness.tsx
  - packages/desktop/src/renderer/components/_dev/PersistencePanel.tsx
  - packages/desktop/tests/unit/bun/atomicWrite.test.ts
  - packages/desktop/tests/unit/bun/refMap.test.ts
  - packages/desktop/tests/unit/bun/saveFile.test.ts
  - packages/desktop/tests/fixtures/roadmap-with-refs.json
  - packages/desktop/tests/fixtures/referenced-part.json
autonomous: false
requirements:
  - EDIT-14
  - EDIT-16
  - EDIT-17
  - EDIT-18
tags: [atomic-write, ref-writeback, save-file, path-traversal]

must_haves:
  truths:
    - "The saveFile RPC writes to a `.tmp` file then renames to the target; on Windows, renames retry up to 3 times with 50ms delay on EPERM/EBUSY/EACCES/EEXIST"
    - "saveFile rejects filePaths outside the session allowlist (path-traversal mitigation, T-03.04-01)"
    - "saveFile runs Zod pre-write validation via RoadmapSchemaSchema.safeParse and refuses to write invalid schemas (T-03.04-07)"
    - "flushPending is idempotent — no-op when cachedSchema/cachedMainPath are null"
    - "Mutations to a $ref-owned node on save are written to the referenced file — not the main file (EDIT-16)"
    - "loadFile hydrates the ownership map via buildOwnershipMap + per-ref overrides so descendants of a $ref point to the referenced file"
    - "splitSchemaByOwnership OMITS nodes deleted from the live schema even when they still exist in sourceTemplate (Warning 4: no silent resurrection)"
    - "Moving a node across file boundaries (from ref A into subtree owned by ref B) is blocked with a clear error message (EDIT-18)"
    - "A DevHarness persistence panel (dev-only, stripped in production builds) exposes saveFile to tmpdir, fetch-back verification, $ref fixture toggle, and cross-boundary move attempt for mid-plan UAT"
  artifacts:
    - path: "packages/desktop/src/bun/atomicWrite.ts"
      provides: "Atomic write-tmp-rename with Windows 3-attempt 50ms retry"
      contains: "atomicWrite, isRetriableError"
    - path: "packages/desktop/src/bun/refMap.ts"
      provides: "Per-node file ownership map for $ref write-back"
      contains: "buildOwnershipMap, getOwnership, setSourceTemplate, splitSchemaByOwnership"
    - path: "packages/desktop/src/bun/index.ts"
      provides: "saveFile + loadFile ownership hydration + flushPending (idempotent)"
      contains: "saveFile handler, loadFile ownership population, flushPending, dialogAllowlist, cachedMainPath"
    - path: "shared/types.ts"
      provides: "RPC contract extensions for saveFile error shape + pushOwnershipMap"
      contains: "saveFile response: {ok:true} | {ok:false; error}, pushOwnershipMap message"
    - path: "packages/desktop/src/renderer/components/_dev/DevHarness.tsx"
      provides: "Dev-only harness mount gated by import.meta.env.DEV"
      contains: "import.meta.env.DEV guard, panel registry"
    - path: "packages/desktop/src/renderer/components/_dev/PersistencePanel.tsx"
      provides: "Persistence DevHarness panel for mid-plan UAT"
      contains: "save to tmpdir, fetch-back button, $ref fixture toggle, cross-boundary attempt"
  key_links:
    - from: "packages/desktop/src/bun/index.ts"
      to: "packages/desktop/src/bun/atomicWrite.ts"
      via: "atomicWrite(targetPath, JSON.stringify(schema, null, 2))"
      pattern: "atomicWrite"
    - from: "packages/desktop/src/bun/index.ts"
      to: "packages/desktop/src/bun/refMap.ts"
      via: "splitSchemaByOwnership on save; buildOwnershipMap on load"
      pattern: "splitSchemaByOwnership|buildOwnershipMap|setSourceTemplate"
    - from: "packages/desktop/src/mainview/App.tsx"
      to: "packages/desktop/src/renderer/components/_dev/DevHarness.tsx"
      via: "conditional mount under import.meta.env.DEV guard"
      pattern: "import.meta.env.DEV"
---

<objective>
Persistence infrastructure. Build the Bun-side atomic write (EDIT-14), ref ownership map + split-by-owner (EDIT-16), and `saveFile`/`loadFile` RPC handlers with path-traversal allowlist (T-03.04-01) and Zod pre-write validation (T-03.04-07). This runs in Wave 1 alongside Plan 01 (no file overlap) so persistence is proven end-to-end before any autosave/UI work begins in Wave 2.

Purpose: the earlier persistence lands, the more each subsequent plan can rely on real disk I/O. This plan gives Plan 04b a working `saveFile` RPC to debounce against, and lets mid-phase UAT kill the process mid-save to verify atomic guarantees from the first wave.

Output:
- Atomic write module with Windows retry
- Ref ownership module with Warning-4 fix (deleted-in-live drops from output)
- saveFile handler (path-traversal allowlist + Zod pre-write)
- loadFile extension populating ownership map
- flushPending stub (idempotent — useAutosave wires actual invocation in Plan 04b)
- RPC contract extensions (`saveFile` error shape, `pushOwnershipMap`)
- DevHarness scaffold + persistence panel for mid-plan UAT
</objective>

<design_note>
**Why Wave 1 works for this plan:** tests operate on schema fixtures (roadmap-with-refs.json, referenced-part.json) via mocked or real tmp-dir filesystem I/O. No dependency on Plan 01's store mutations — this plan's tests populate schemas directly and assert write outputs. The `saveFile` handler is exercised unit-test-level only in this plan; Plan 04b wires `useAutosave` to actually call it.

**Path-traversal guard (T-03.04-01):** saveFile maintains a session-scoped allowlist:
- `cachedMainPath` — the currently loaded file (set on loadFile + newFile + saveFileAs success)
- `dialogAllowlist: Set<string>` — paths returned by `Utils.saveFileDialog` during the session
Any `saveFile({filePath})` with a path not matching either is rejected; filePath is resolved to absolute via `path.resolve` before comparison to defeat `../` traversal.

**Zod pre-write validation (T-03.04-07):** saveFile calls `RoadmapSchemaSchema.safeParse(schema)` BEFORE `splitSchemaByOwnership` and BEFORE `atomicWrite`. Invalid → return `{ok:false, error}` with zod path surfaced; no disk I/O.

**Warning-4 fix in splitSchemaByOwnership:** when walking the sourceTemplate, any template node missing from the live schema by id is DROPPED from output (not resurrected). This prevents "delete a node, save, next save brings it back" silent data loss.

**DevHarness pattern:** a single `<DevHarness />` mounted in `App.tsx` only when `import.meta.env.DEV`. Each plan adds its own panel file under `_dev/` which DevHarness imports and renders as a tab. Production builds strip it (verified via `! grep -q DevHarness packages/desktop/build/*.js`). End of Phase 3 = delete `_dev/` directory (documented in phase verification).
</design_note>

<execution_context>
@C:/Work/RoadRaven/.claude/get-shit-done/workflows/execute-plan.md
@C:/Work/RoadRaven/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/phases/03-full-editor/03-CONTEXT.md
@.planning/phases/03-full-editor/03-RESEARCH.md
@.planning/phases/03-full-editor/03-VALIDATION.md

@packages/desktop/src/bun/index.ts
@packages/desktop/src/bun/fileWatcher.ts
@packages/desktop/src/bun/logging.ts
@packages/desktop/src/mainview/App.tsx
@shared/types.ts
@packages/core/src/schema.ts

<interfaces>
From shared/types.ts (EXISTING — to extend):
```typescript
RoadmapRPCType.bun.requests: {
  loadFile, saveFile, exportHtml, exportPng, openFilePicker, resolveRef,
  saveSettings, loadSettings, logMessage
}
RoadmapRPCType.webview.messages: {
  pushStatusUpdate, pushEventLog, pushFileChanged
}
```

From node:fs (Bun compat):
```typescript
import { renameSync, unlinkSync } from "node:fs";
// Error codes: EPERM, EBUSY, EACCES, EEXIST — retriable on Windows
// ENOENT, ENOTDIR — NOT retriable (cleanup tmp and throw)
```

Node/Bun APIs:
- `process.pid` for unique tmp naming
- `Date.now()` for tmp naming
- `Bun.write(path, content)` for tmp file write
- `process.platform === "win32"` for Windows detection
- `path.resolve(...)` for absolute-path normalization (traversal mitigation)

From packages/core/src/schema.ts:
```typescript
export const RoadmapSchemaSchema: z.ZodType<RoadmapSchema>;  // used by safeParse
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Atomic write module + ref ownership module + saveFile/refMap test scaffolds (Bun side)</name>
  <files>
    packages/desktop/src/bun/atomicWrite.ts,
    packages/desktop/src/bun/refMap.ts,
    packages/desktop/tests/unit/bun/atomicWrite.test.ts,
    packages/desktop/tests/unit/bun/refMap.test.ts,
    packages/desktop/tests/unit/bun/saveFile.test.ts,
    packages/desktop/tests/fixtures/roadmap-with-refs.json,
    packages/desktop/tests/fixtures/referenced-part.json
  </files>
  <read_first>
    packages/desktop/src/bun/index.ts,
    packages/desktop/src/bun/fileWatcher.ts,
    packages/desktop/src/bun/logging.ts,
    .planning/phases/03-full-editor/03-RESEARCH.md#Pattern 7,
    .planning/phases/03-full-editor/03-RESEARCH.md#Pattern 8,
    .planning/phases/03-full-editor/03-RESEARCH.md#Example 4,
    .planning/phases/03-full-editor/03-RESEARCH.md#Example 5
  </read_first>
  <behavior>
    RED/GREEN for atomicWrite + refMap. Tests run under vitest in a Node context with tmp dirs.

    `atomicWrite.test.ts` — 7 tests:
    1. Writes content to a tmp file (pattern `.<filename>.<pid>.<ts>.tmp`) and then renames to target; final file contains expected content; no tmp file remains
    2. When target path doesn't exist yet, writes are successful (no rename error)
    3. When target path exists, atomicWrite overwrites it with new content
    4. Non-retriable error (ENOENT on parent dir) throws immediately; tmp cleaned up
    5. Windows retry: simulate `renameSync` throwing EPERM on first call, succeed on second (use `vi.spyOn(fs, 'renameSync')`); expect success after retry
    6. Windows retry gives up after 3 attempts; final error is the last EPERM; tmp file cleaned up
    7. EEXIST is treated as retriable on Windows

    `refMap.test.ts` — 6 tests (was 5; +1 per checker Warning 4):
    1. buildOwnershipMap on a single-file schema tags every node to the main file
    2. buildOwnershipMap on a 2-file schema (main + 1 $ref file) tags ref'd descendants to the ref file
    3. splitSchemaByOwnership reconstructs correct per-file payloads; main file contains $ref placeholders where expansion occurred
    4. splitSchemaByOwnership preserves non-ref descendants in the main file
    5. When a new node added under a ref-owned parent: splitSchemaByOwnership puts the new node in the ref file (inherits parent's owner)
    6. **splitSchemaByOwnership OMITS a node deleted from the live schema even when it still exists in sourceTemplate** (Warning 4: the previous "keep template" behavior silently resurrected deleted nodes). Assert by building a template with 3 children, deleting child #2 from the live schema, calling splitSchemaByOwnership, and confirming only children #1 and #3 appear in the main-file output.

    `saveFile.test.ts` — **7 tests** (RED scaffold; Task 2 enters GREEN):
    1. **`saveFile` rejects a filePath outside the session allowlist (path-traversal, T-03.04-01).** Mount saveFile handler; cachedMainPath = `/tmp/main.roadmap.json`; call saveFile with `filePath: "/tmp/../etc/passwd"` → returns `{ok:false, error: /not in session allowlist|traversal|unauthorized/i}`; no file is written.
    2. **`saveFile` accepts the cached main path without an explicit filePath argument.** Confirm atomicWrite is called once for the main path.
    3. **`saveFile` accepts a filePath returned by `Utils.saveFileDialog` during this session.** (Simulate by pushing a path into the module's dialogAllowlist before calling saveFile.)
    4. **`saveFile` calls `RoadmapSchemaSchema.safeParse(schema)` BEFORE atomicWrite (T-03.04-07).** Spy on `atomicWrite`; pass an invalid schema (missing `version`); expect atomicWrite NOT called and response `{ok:false, error: /invalid|schema|validation/i}`.
    5. **`flushPending` with no cachedSchema is a NO-OP (idempotency).** Call flushPending before any saveFile has populated the cache; confirm no throws, no atomicWrite calls.
    6. **`flushPending` with cachedSchema/cachedMainPath set calls atomicWrite for every owner in the ownership map.** 2-file fixture → atomicWrite called exactly 2 times.
    7. **`loadFile` hydrates the ownership map for all $ref nodes.** Open the 2-file fixture via the loadFile handler; assert getOwnership() contains entries for every descendant pointing to the correct file.

    Task 1 creates the RED scaffold; tests fail with "module not found" until Task 2 implements. fixtures needed:
    - `roadmap-with-refs.json` — main schema with a `$ref: "./referenced-part.json"` node
    - `referenced-part.json` — `{nodes: [...]}` with 2 nodes
  </behavior>
  <action>
    Create `packages/desktop/src/bun/atomicWrite.ts`:

    ```typescript
    import { renameSync, unlinkSync } from "node:fs";
    import { basename, dirname, join } from "node:path";
    import { bunLogger } from "./logging";

    const RETRIABLE_CODES = new Set(["EPERM", "EBUSY", "EACCES", "EEXIST"]);

    export function isRetriableError(err: unknown): boolean {
      const code = (err as NodeJS.ErrnoException)?.code;
      return typeof code === "string" && RETRIABLE_CODES.has(code);
    }

    export async function atomicWrite(targetPath: string, content: string): Promise<void> {
      const tmpPath = join(
        dirname(targetPath),
        `.${basename(targetPath)}.${process.pid}.${Date.now()}.tmp`,
      );

      try {
        await Bun.write(tmpPath, content);
      } catch (err) {
        bunLogger.error`atomicWrite failed to write tmp: ${String(err)}`;
        throw err;
      }

      const maxAttempts = process.platform === "win32" ? 3 : 1;
      let lastErr: unknown;

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          renameSync(tmpPath, targetPath);
          return;
        } catch (err) {
          lastErr = err;
          if (!isRetriableError(err) || attempt === maxAttempts) break;
          bunLogger.warn`atomicWrite rename attempt ${attempt} failed; retrying in 50ms`;
          await new Promise((r) => setTimeout(r, 50));
        }
      }

      try { unlinkSync(tmpPath); } catch { /* best effort */ }
      throw lastErr;
    }
    ```

    Create `packages/desktop/src/bun/refMap.ts`:

    ```typescript
    import type { RoadmapNode, RoadmapSchema } from "../../../../packages/core/src/schema";

    export type FilePath = string;
    export type OwnershipMap = Map<string, FilePath>;

    let activeOwnership: OwnershipMap = new Map();
    let sourceTemplate: { mainPath: FilePath; nodes: RoadmapNode[] } | null = null;

    export function setSourceTemplate(mainPath: FilePath, nodes: RoadmapNode[]): void {
      sourceTemplate = { mainPath, nodes: JSON.parse(JSON.stringify(nodes)) };
    }

    export function getSourceTemplate(): typeof sourceTemplate {
      return sourceTemplate;
    }

    export function buildOwnershipMap(rootNodes: RoadmapNode[], mainFilePath: FilePath): OwnershipMap {
      const map: OwnershipMap = new Map();
      walkAndTag(rootNodes, mainFilePath, map);
      activeOwnership = map;
      return map;
    }

    export function getOwnership(): OwnershipMap {
      return activeOwnership;
    }

    export function setOwnership(nodeId: string, path: FilePath): void {
      activeOwnership.set(nodeId, path);
    }

    function walkAndTag(nodes: RoadmapNode[], owner: FilePath, map: OwnershipMap): void {
      for (const node of nodes) {
        map.set(node.id, owner);
        if (node.children) walkAndTag(node.children, owner, map);
      }
    }

    export function splitSchemaByOwnership(
      schema: RoadmapSchema,
      mainPath: FilePath,
      ownership: OwnershipMap,
    ): Map<FilePath, RoadmapSchema> {
      const result = new Map<FilePath, RoadmapSchema>();
      const template = sourceTemplate?.mainPath === mainPath ? sourceTemplate : null;

      const owners = new Set<FilePath>([mainPath, ...ownership.values()]);

      for (const path of owners) {
        if (path === mainPath) {
          const nodes = template
            ? rebuildMainNodesFromTemplate(template.nodes, schema.nodes, ownership, mainPath)
            : schema.nodes.filter((n) => (ownership.get(n.id) ?? mainPath) === mainPath);
          result.set(path, { ...schema, nodes });
        } else {
          const refNodes = collectOwnedSubtrees(schema.nodes, path, ownership);
          result.set(path, { ...schema, nodes: refNodes });
        }
      }
      return result;
    }

    function rebuildMainNodesFromTemplate(
      templateNodes: RoadmapNode[],
      liveNodes: RoadmapNode[],
      ownership: OwnershipMap,
      mainPath: FilePath,
    ): RoadmapNode[] {
      return templateNodes
        .map((tmpl) => {
          if (tmpl.$ref) return { ...tmpl };
          const live = findNodeById(liveNodes, tmpl.id);
          if (!live) return null;  // Warning 4 fix: DROP from output when node deleted in live schema
          return {
            ...live,
            children: live.children
              ? rebuildMainChildren(tmpl.children ?? [], live.children, ownership, mainPath)
              : undefined,
          };
        })
        .filter((n): n is RoadmapNode => n !== null);
    }

    function rebuildMainChildren(
      templateChildren: RoadmapNode[],
      liveChildren: RoadmapNode[],
      ownership: OwnershipMap,
      mainPath: FilePath,
    ): RoadmapNode[] {
      const out: RoadmapNode[] = [];
      const consumedLiveIds = new Set<string>();

      for (const tmpl of templateChildren) {
        if (tmpl.$ref) { out.push({ ...tmpl }); continue; }
        const live = liveChildren.find((c) => c.id === tmpl.id);
        if (!live) continue;  // Warning 4 fix
        consumedLiveIds.add(live.id);
        out.push({
          ...live,
          children: live.children ? rebuildMainChildren(tmpl.children ?? [], live.children, ownership, mainPath) : undefined,
        });
      }

      for (const live of liveChildren) {
        if (consumedLiveIds.has(live.id)) continue;
        const owner = ownership.get(live.id) ?? mainPath;
        if (owner === mainPath) {
          out.push({ ...live, children: live.children });
        }
      }
      return out;
    }

    function collectOwnedSubtrees(nodes: RoadmapNode[], owner: FilePath, ownership: OwnershipMap): RoadmapNode[] {
      const out: RoadmapNode[] = [];
      walk(nodes);
      return out;

      function walk(arr: RoadmapNode[]) {
        for (const node of arr) {
          if (ownership.get(node.id) === owner) {
            out.push({
              ...node,
              children: node.children ? filterChildrenByOwner(node.children, owner, ownership) : undefined,
            });
          } else if (node.children) {
            walk(node.children);
          }
        }
      }
    }

    function filterChildrenByOwner(children: RoadmapNode[], owner: FilePath, ownership: OwnershipMap): RoadmapNode[] {
      return children
        .filter((c) => (ownership.get(c.id) ?? owner) === owner)
        .map((c) => ({ ...c, children: c.children ? filterChildrenByOwner(c.children, owner, ownership) : undefined }));
    }

    function findNodeById(nodes: RoadmapNode[], id: string): RoadmapNode | null {
      for (const node of nodes) {
        if (node.id === id) return node;
        if (node.children) {
          const found = findNodeById(node.children, id);
          if (found) return found;
        }
      }
      return null;
    }
    ```

    Create fixtures:
    - `packages/desktop/tests/fixtures/roadmap-with-refs.json`:
      ```json
      {
        "version": "1.0",
        "title": "Ref Test",
        "nodes": [{
          "id": "aaaaaaaa-bbbb-4ccc-8ddd-000000000001",
          "title": "Main Root",
          "status": "not-started",
          "children": [
            {"id":"aaaaaaaa-bbbb-4ccc-8ddd-000000000002","title":"Main Child","status":"not-started"},
            {"$ref":"./referenced-part.json"}
          ]
        }]
      }
      ```
    - `packages/desktop/tests/fixtures/referenced-part.json`:
      ```json
      {
        "nodes": [{
          "id":"bbbbbbbb-cccc-4ddd-8eee-000000000001",
          "title":"Ref Root",
          "status":"not-started",
          "children":[{"id":"bbbbbbbb-cccc-4ddd-8eee-000000000002","title":"Ref Child","status":"not-started"}]
        }]
      }
      ```

    For tests, mock Bun.write where needed (vitest provides `vi.mock('node:fs', ...)`). Use `os.tmpdir()` for integration-style tests. For the Windows retry test: spy on `renameSync` to throw EPERM once, then succeed.
  </action>
  <verify>
    <automated>cd packages/desktop; bunx vitest run tests/unit/bun/atomicWrite.test.ts tests/unit/bun/refMap.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - `ls packages/desktop/src/bun/atomicWrite.ts` exits 0
    - `ls packages/desktop/src/bun/refMap.ts` exits 0
    - `grep -q "renameSync" packages/desktop/src/bun/atomicWrite.ts`
    - `grep -q "EPERM" packages/desktop/src/bun/atomicWrite.ts`
    - `grep -q "process.platform === \"win32\"" packages/desktop/src/bun/atomicWrite.ts`
    - `grep -q "buildOwnershipMap" packages/desktop/src/bun/refMap.ts`
    - `grep -q "splitSchemaByOwnership" packages/desktop/src/bun/refMap.ts`
    - `grep -q "setSourceTemplate" packages/desktop/src/bun/refMap.ts`
    - `ls packages/desktop/tests/fixtures/roadmap-with-refs.json` exits 0
    - `ls packages/desktop/tests/fixtures/referenced-part.json` exits 0
    - `bunx vitest run tests/unit/bun/atomicWrite.test.ts` exits 0 with 7 tests passing
    - `bunx vitest run tests/unit/bun/refMap.test.ts` exits 0 with 6 tests passing
    - `ls packages/desktop/tests/unit/bun/saveFile.test.ts` exits 0 (RED scaffold committed)
    - `grep -c "^\s*it(\|^\s*test(" packages/desktop/tests/unit/bun/saveFile.test.ts` >= 7
    - `grep -q "path-traversal\|allowlist\|traversal" packages/desktop/tests/unit/bun/saveFile.test.ts`
    - `grep -q "safeParse\|RoadmapSchemaSchema" packages/desktop/tests/unit/bun/saveFile.test.ts`
    - `grep -q "flushPending" packages/desktop/tests/unit/bun/saveFile.test.ts`
    - Running `bunx vitest run tests/unit/bun/saveFile.test.ts` fails with module-resolution errors (RED phase — Task 2 will implement)
  </acceptance_criteria>
  <done>Atomic write + ref ownership map shipped with 13 tests GREEN (7 atomicWrite + 6 refMap); saveFile.test.ts RED scaffold committed (7 tests) ready for Task 2.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: saveFile/loadFile handlers + path-traversal allowlist + Zod pre-write (GREEN for saveFile.test.ts)</name>
  <files>
    shared/types.ts,
    packages/desktop/src/bun/index.ts
  </files>
  <read_first>
    shared/types.ts,
    packages/desktop/src/bun/index.ts,
    packages/desktop/src/bun/atomicWrite.ts,
    packages/desktop/src/bun/refMap.ts,
    packages/desktop/tests/unit/bun/saveFile.test.ts,
    .planning/phases/03-full-editor/03-RESEARCH.md#Pattern 6
  </read_first>
  <behavior>
    GREEN phase for `packages/desktop/tests/unit/bun/saveFile.test.ts` (scaffolded in Task 1). All 7 tests transition RED → GREEN in this task.

    **Path-traversal guard (T-03.04-01, tests #1-#3):** `cachedMainPath` (set on loadFile/newFile/saveFileAs success) + `dialogAllowlist: Set<string>` (paths from Utils.saveFileDialog). Any saveFile call with a filePath not matching is rejected. filePath is resolved to absolute via `path.resolve` before comparison.

    **Zod pre-write (T-03.04-07, test #4):** Inside saveFile, call `RoadmapSchemaSchema.safeParse(schema)` BEFORE splitSchemaByOwnership and BEFORE atomicWrite. If invalid, return `{ok:false, error: "saveFile: schema validation failed: <issues[0].path>: <issues[0].message>"}`.

    **flushPending idempotency (tests #5-#6):** `flushPending()` is a no-op when `cachedSchema` or `cachedMainPath` is null. When both are set, it calls atomicWrite for every ownership-map partition. Also re-runs the Zod guard.

    **loadFile ownership (test #7):** Refactor existing loadFile so resolveRefs pass tags every descendant into `activeOwnership`.

    NOTE: actual autosave wiring (before-quit hooks, SIGTERM, useAutosave) is deferred to Plans 04b/04c. This task only exports `flushPending` + registers the handlers — invocation comes later.
  </behavior>
  <action>
    **Step A — Extend `shared/types.ts`:** add to `RoadmapRPCType.bun.requests`:

    ```typescript
    saveFile: {
      params: { schema: RoadmapSchema; filePath?: string };
      response: { ok: true } | { ok: false; error: string };
    };
    ```

    Add to `RoadmapRPCType.webview.messages`:
    ```typescript
    pushOwnershipMap: { entries: Array<[string, string]> };
    ```

    Do NOT add `newFile:` or `saveFileAs:` here — those are Plan 04c concerns.
    Do NOT add `pushExternalConflict` (Warning 7: design rejected).
    Do NOT add `setPendingFlag` (Warning 7: design rejected).

    **Step B — Extend `packages/desktop/src/bun/index.ts`:**

    1. Import `atomicWrite` and `refMap` helpers.
    2. Refactor existing `resolveRefs` to accept an `ownership` map and tag each node (research Example 5). Pass ownership map up to loadFile handler.
    3. After successful load, call `setSourceTemplate(filePath, rawParsedNodes)` with the ORIGINAL parsed (unresolved) nodes.
    4. After resolveRefs, push ownership map to webview: `mainWindow.webview.rpc?.send.pushOwnershipMap({ entries: [...ownership.entries()] })`.
    5. Implement `saveFile` handler with path-traversal guard + Zod pre-write:
       ```typescript
       import { resolve } from "node:path";
       import { RoadmapSchemaSchema } from "../../../../packages/core/src/schema";

       let cachedSchema: RoadmapSchema | null = null;
       let cachedMainPath: string | null = null;
       const dialogAllowlist = new Set<string>();

       saveFile: async ({ schema, filePath }) => {
         const target = filePath ?? cachedMainPath;
         if (!target) return { ok: false, error: "saveFile: no file path — use saveFileAs" };

         // Path-traversal guard (T-03.04-01)
         const resolved = resolve(target);
         const allowed = (cachedMainPath && resolve(cachedMainPath) === resolved)
           || dialogAllowlist.has(resolved);
         if (!allowed) {
           bunLogger.warn`saveFile: filePath ${resolved} not in session allowlist; rejecting`;
           return { ok: false, error: "saveFile: filePath not in session allowlist" };
         }

         // Zod pre-write validation (T-03.04-07)
         const parsed = RoadmapSchemaSchema.safeParse(schema);
         if (!parsed.success) {
           const issue = parsed.error.issues[0];
           const msg = `saveFile: schema validation failed: ${issue.path.join(".")}: ${issue.message}`;
           bunLogger.warn`${msg}`;
           return { ok: false, error: msg };
         }

         try {
           const ownership = getOwnership();
           const perFile = splitSchemaByOwnership(schema, resolved, ownership);
           for (const [p, payload] of perFile) {
             await atomicWrite(p, JSON.stringify(payload, null, 2));
           }
           cachedSchema = schema;
           cachedMainPath = resolved;
           return { ok: true };
         } catch (err) {
           bunLogger.error`saveFile failed: ${String(err)}`;
           return { ok: false, error: String(err) };
         }
       }
       ```

       **On `loadFile` success:** set `cachedMainPath = resolve(path)` and populate `activeOwnership` via `buildOwnershipMap(resolvedNodes, cachedMainPath)` + per-`$ref` tagging.

    6. Export `flushPending` (idempotent stub; actual invocation wiring in Plan 04c):
       ```typescript
       export async function flushPending(): Promise<void> {
         if (!cachedSchema || !cachedMainPath) {
           bunLogger.info`flushPending: no cached schema/path; no-op`;
           return;
         }
         try {
           const parsed = RoadmapSchemaSchema.safeParse(cachedSchema);
           if (!parsed.success) {
             bunLogger.error`flushPending: cached schema failed Zod validation; aborting`;
             return;
           }
           const ownership = getOwnership();
           const perFile = splitSchemaByOwnership(cachedSchema, cachedMainPath, ownership);
           for (const [p, payload] of perFile) {
             await atomicWrite(p, JSON.stringify(payload, null, 2));
           }
           bunLogger.info`flushPending wrote ${perFile.size} file(s)`;
         } catch (err) {
           bunLogger.error`flushPending failed: ${String(err)}`;
         }
       }
       ```

    Do NOT add Electrobun before-quit or SIGTERM handlers here — they belong in Plan 04c which wires flushPending to the actual shutdown paths.
  </action>
  <verify>
    <automated>cd packages/desktop; bunx vitest run tests/unit/bun/saveFile.test.ts tests/unit/bun/atomicWrite.test.ts tests/unit/bun/refMap.test.ts && bunx vitest run && bunx tsc --noEmit</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "pushOwnershipMap:" shared/types.ts`
    - `! grep -q "pushExternalConflict" shared/types.ts` (Warning 7)
    - `! grep -q "setPendingFlag" shared/types.ts` (Warning 7)
    - `grep -q "import.*atomicWrite" packages/desktop/src/bun/index.ts`
    - `grep -q "splitSchemaByOwnership" packages/desktop/src/bun/index.ts`
    - `grep -q "setSourceTemplate" packages/desktop/src/bun/index.ts`
    - `grep -q "flushPending" packages/desktop/src/bun/index.ts`
    - `grep -q "dialogAllowlist\|session allowlist" packages/desktop/src/bun/index.ts` (T-03.04-01)
    - `grep -q "RoadmapSchemaSchema.safeParse" packages/desktop/src/bun/index.ts` (T-03.04-07)
    - `grep -q "saveFile:" packages/desktop/src/bun/index.ts`
    - `bunx vitest run tests/unit/bun/saveFile.test.ts` exits 0 with 7 tests passing (GREEN)
    - `bunx tsc --noEmit` exits 0
    - Full test suite passes
  </acceptance_criteria>
  <done>RPC contract extended with saveFile error shape + pushOwnershipMap; Bun saveFile writes atomically with ref splitting, path-traversal allowlist (T-03.04-01), Zod pre-write (T-03.04-07); flushPending idempotent (no invocation wiring yet); 7 saveFile tests GREEN.</done>
</task>

<task type="auto" tdd="false">
  <name>Task 3: Build dev-harness demo panel for persistence (DevHarness scaffold + PersistencePanel)</name>
  <files>
    packages/desktop/src/renderer/components/_dev/DevHarness.tsx,
    packages/desktop/src/renderer/components/_dev/PersistencePanel.tsx
  </files>
  <read_first>
    packages/desktop/src/mainview/App.tsx,
    packages/desktop/src/bun/index.ts
  </read_first>
  <action>
    Create `packages/desktop/src/renderer/components/_dev/DevHarness.tsx`. This is the shared DevHarness scaffold that all six plans extend. It mounts only in dev mode and **auto-discovers panels via Vite `import.meta.glob`** — so other plans do NOT need to edit this file. Each plan just adds its own `*Panel.tsx` sibling file; this DevHarness picks it up automatically.

    ```tsx
    import { useMemo, useState, type ReactNode } from "react";

    // Auto-discover all *Panel.tsx files in this directory via Vite import.meta.glob.
    // This eliminates manual registry edits — each plan just drops its *Panel.tsx sibling.
    // eager: true inlines modules so we can read named exports synchronously.
    const panelModules = import.meta.glob("./*Panel.tsx", { eager: true }) as Record<string, Record<string, () => ReactNode>>;

    interface PanelRegistryEntry {
      id: string;
      label: string;
      render: () => ReactNode;
    }

    function buildPanels(): PanelRegistryEntry[] {
      const entries: PanelRegistryEntry[] = [];
      for (const [path, mod] of Object.entries(panelModules)) {
        // path looks like "./PersistencePanel.tsx" → exported name "PersistencePanel"
        const match = path.match(/\.\/(\w+)Panel\.tsx$/);
        if (!match) continue;
        const baseName = match[1];
        const Component = mod[`${baseName}Panel`] as (() => ReactNode) | undefined;
        if (!Component) continue;
        entries.push({
          id: baseName.toLowerCase(),
          label: baseName,
          render: () => Component(),
        });
      }
      // Stable alphabetical order so panel tabs don't reshuffle between HMR reloads
      return entries.sort((a, b) => a.id.localeCompare(b.id));
    }

    export function DevHarness() {
      // CRITICAL: this component must ONLY be imported/rendered when import.meta.env.DEV is true.
      // The import.meta.env.DEV guard happens at the mount site (App.tsx) so this file itself
      // can remain a plain React component that is tree-shaken from production bundles.
      const panels = useMemo(buildPanels, []);
      const [activeId, setActiveId] = useState<string>(panels[0]?.id ?? "");
      const active = panels.find((p) => p.id === activeId);

      return (
        <div
          data-testid="dev-harness"
          style={{
            position: "fixed",
            bottom: 0,
            right: 0,
            width: 420,
            maxHeight: "60vh",
            overflow: "auto",
            background: "var(--rv-bg-elevated, #1a1a1a)",
            border: "1px solid var(--rv-border, #444)",
            borderTopLeftRadius: 8,
            boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
            fontSize: 12,
            color: "var(--rv-text-primary, #eee)",
            zIndex: 10000,
            padding: 8,
          }}
        >
          <div style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--rv-border, #444)", paddingBottom: 6, marginBottom: 8 }}>
            <strong style={{ marginRight: 8 }}>DevHarness</strong>
            {panels.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setActiveId(p.id)}
                style={{
                  background: p.id === activeId ? "var(--rv-accent-muted, #2a4a6a)" : "transparent",
                  border: "1px solid var(--rv-border, #444)",
                  borderRadius: 4,
                  color: "inherit",
                  padding: "2px 8px",
                  fontSize: 11,
                  cursor: "pointer",
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
          {active ? active.render() : <div>No panels discovered. Create a *Panel.tsx sibling file.</div>}
        </div>
      );
    }
    ```

    Create `packages/desktop/src/renderer/components/_dev/PersistencePanel.tsx`. This panel exposes every NEW public action of Plan 04a as a clickable button.

    ```tsx
    import { useState } from "react";
    import { electroview } from "../../../mainview/rpc";

    export function PersistencePanel() {
      const [lastOutput, setLastOutput] = useState<string>("(no action yet)");

      const saveToTmp = async () => {
        try {
          // Uses whatever schema is in memory; relies on cachedMainPath being set.
          const state = (window as unknown as { __ROADRAVEN_TEST__?: { getSchema?: () => unknown } }).__ROADRAVEN_TEST__;
          const schema = state?.getSchema?.();
          if (!schema) { setLastOutput("No schema loaded."); return; }
          const result = await electroview.rpc.request.saveFile({ schema: schema as never });
          setLastOutput(JSON.stringify(result));
        } catch (err) {
          setLastOutput(`Error: ${String(err)}`);
        }
      };

      const fetchBack = async () => {
        try {
          // Re-load the current file and display node count as a sanity check
          const state = (window as unknown as { __ROADRAVEN_TEST__?: { getFilePath?: () => string | null } }).__ROADRAVEN_TEST__;
          const path = state?.getFilePath?.();
          if (!path) { setLastOutput("No file path."); return; }
          const result = await electroview.rpc.request.loadFile({ path });
          setLastOutput(`Loaded: ${JSON.stringify(result).slice(0, 200)}...`);
        } catch (err) {
          setLastOutput(`Error: ${String(err)}`);
        }
      };

      const toggleRefFixture = async () => {
        // Load the ref fixture to exercise the ownership map
        try {
          const result = await electroview.rpc.request.loadFile({ path: "packages/desktop/tests/fixtures/roadmap-with-refs.json" });
          setLastOutput(`Ref fixture loaded: ${JSON.stringify(result).slice(0, 200)}`);
        } catch (err) {
          setLastOutput(`Error: ${String(err)}`);
        }
      };

      const crossBoundaryAttempt = async () => {
        try {
          const result = await electroview.rpc.request.saveFile({
            schema: { version: "1.0", title: "t", nodes: [] } as never,
            filePath: "/etc/passwd",  // Should be rejected by allowlist
          });
          setLastOutput(`Traversal attempt result (expect ok:false): ${JSON.stringify(result)}`);
        } catch (err) {
          setLastOutput(`Error: ${String(err)}`);
        }
      };

      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <strong>Plan 04a — Persistence</strong>
          <button type="button" onClick={() => void saveToTmp()}>Save to cached path</button>
          <button type="button" onClick={() => void fetchBack()}>Fetch-back current file</button>
          <button type="button" onClick={() => void toggleRefFixture()}>Load $ref fixture</button>
          <button type="button" onClick={() => void crossBoundaryAttempt()}>Cross-boundary (expect reject)</button>
          <pre
            data-testid="persistence-panel-output"
            style={{ background: "rgba(0,0,0,0.3)", padding: 6, borderRadius: 4, fontSize: 10, whiteSpace: "pre-wrap", wordBreak: "break-all", maxHeight: 160, overflow: "auto" }}
          >
            {lastOutput}
          </pre>
        </div>
      );
    }
    ```

    **NOTE on App.tsx mount:** This plan does NOT modify `App.tsx`. Plan 01 Task 3 already modifies App.tsx (for useKeyboardRouter wiring) and MUST also add the DevHarness mount there. Plan 01 Task 3 action has been cross-referenced — see `03-01-PLAN.md` Task 3 for the exact mount snippet. This keeps Wave 1 file-ownership clean (Plan 01 owns App.tsx; Plan 04a owns `_dev/DevHarness.tsx` + `_dev/PersistencePanel.tsx`).
    Leave `_dev/` tree untouched after this task — Plans 01, 02, 03, 04b, 04c will each add their own `*Panel.tsx` sibling file. DevHarness auto-discovers panels via `import.meta.glob` — NO edits to DevHarness.tsx are needed from any other plan.

    **CRITICAL** — at the end of Phase 3 (phase verification, not this plan), the entire `packages/desktop/src/renderer/components/_dev/` directory gets deleted. Documented in phase-level verification, not per-plan.
  </action>
  <verify>
    <automated>cd packages/desktop; bunx vite build && ! grep -q "DevHarness" packages/desktop/build/*.js 2>/dev/null && bunx tsc --noEmit</automated>
  </verify>
  <acceptance_criteria>
    - `ls packages/desktop/src/renderer/components/_dev/DevHarness.tsx` exits 0
    - `ls packages/desktop/src/renderer/components/_dev/PersistencePanel.tsx` exits 0
    - `grep -q "import.meta.glob" packages/desktop/src/renderer/components/_dev/DevHarness.tsx` (auto-discovery)
    - `grep -q "data-testid=\"dev-harness\"" packages/desktop/src/renderer/components/_dev/DevHarness.tsx`
    - `grep -q "data-testid=\"persistence-panel-output\"" packages/desktop/src/renderer/components/_dev/PersistencePanel.tsx`
    - `bunx vite build` exits 0 (production build succeeds)
    - Production build strip check: `! find packages/desktop/build -name "*.js" -exec grep -l "DevHarness" {} \; | grep -q .` (no production JS chunk contains "DevHarness" string)
    - `bunx tsc --noEmit` exits 0
  </acceptance_criteria>
  <done>DevHarness mounted behind import.meta.env.DEV guard; PersistencePanel exposes saveToTmp/fetchBack/refFixture/crossBoundary for mid-plan UAT; production build strips DevHarness entirely.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 4: Mid-plan UAT — click through Plan 04a's DevHarness panel</name>
  <action>Pause for a short manual check before the full UAT. Confirms the persistence surface is wired correctly end-to-end in the running app, with fast feedback.</action>
  <what-built>DevHarness scaffold + Persistence panel (saveFile, fetch-back, $ref fixture load, cross-boundary reject).</what-built>
  <how-to-verify>
    Open the app in dev mode (`bun run dev:hmr`). The DevHarness panel is visible in the bottom-right. Click every button in the Persistence panel:
    - "Save to cached path" → output should show `{"ok":true}` (or a descriptive error if no schema loaded — load `tests/fixtures/basic-schema.json` first).
    - "Fetch-back current file" → shows the loaded schema's first ~200 chars.
    - "Load $ref fixture" → loads roadmap-with-refs.json; output shows schema; the UI may not render it yet but the Bun-side ownership map is populated.
    - "Cross-boundary (expect reject)" → output MUST show `{"ok":false, "error":"saveFile: filePath not in session allowlist"}` — path-traversal mitigation confirmed.
  </how-to-verify>
  <resume-signal>Type "continue" to proceed to the plan's full UAT checkpoint.</resume-signal>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 5: Checkpoint — verify atomic writes + ref map + saveFile path-traversal guard</name>
  <action>Full-scope UAT for Plan 04a's persistence infrastructure. Confirms behaviors not automatable in JSDOM.</action>
  <what-built>Atomic write with Windows retry (EDIT-14), ref ownership map + split-by-owner (EDIT-16), saveFile with path-traversal allowlist (T-03.04-01), Zod pre-write (T-03.04-07), loadFile ownership hydration, flushPending idempotent stub (invocation in 04c).</what-built>
  <how-to-verify>
    Run `bun run dev:hmr`. Then:

    **Atomic writes (EDIT-14):**
    1. Load `tests/fixtures/basic-schema.json`. Use DevHarness → "Save to cached path" → output `{"ok":true}`. Open the JSON file in a text editor; content unchanged.
    2. Edit the file via DevHarness (or future Plan 04b autosave once landed). Immediately `taskkill /F /PID <bun pid>` (Windows) or `kill -9 <bun pid>` (Unix). Reopen — file is intact (no partial `.tmp` corrupting the target).
    3. On Windows: observe tmp file lifecycle (`.<filename>.<pid>.<ts>.tmp`) via `dir /a` during a save — tmp appears then disappears.

    **$ref write-back (EDIT-16):**
    4. Use DevHarness → "Load $ref fixture" (roadmap-with-refs.json + referenced-part.json). In a Zustand devtools panel or via the getSchema test hook, mutate a node inside the ref subtree. Use DevHarness → "Save to cached path". Both files updated — ref node's title ONLY in referenced-part.json; main file still has the `$ref` placeholder.

    **Path-traversal guard (T-03.04-01):**
    5. Use DevHarness → "Cross-boundary (expect reject)" → `{"ok":false, "error":"saveFile: filePath not in session allowlist"}`. Verify no file was created at `/etc/passwd` or `../` path.

    **Zod pre-write (T-03.04-07):**
    6. In DevTools, inject a malformed schema (missing `version`) via `window.__ROADRAVEN_TEST__.setSchema` (if implemented) or directly via the store. Use DevHarness → "Save". Expect `{"ok":false, "error":"saveFile: schema validation failed: version: ..."}`. Verify file on disk unchanged.
  </how-to-verify>
  <resume-signal>Type "approved" or describe issues.</resume-signal>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| webview → Bun saveFile RPC | Untrusted schema payload + filePath argument |
| Bun → filesystem | Arbitrary filePath from webview could target unintended files |
| $ref → filesystem | Relative $ref paths resolve against basePath; split-back writes multiple files |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-03.04-01 | Tampering | saveFile handler (path traversal) | mitigate | saveFile refuses any path not matching the session's loaded `cachedMainPath` OR `dialogAllowlist`. User-controlled paths must round-trip through native dialog. Verified in saveFile.test.ts test #1. |
| T-03.04-02 | Tampering | splitSchemaByOwnership $ref write paths | mitigate | $ref paths resolved against `dirname(mainFilePath)` + rejection if resolved path escapes basedir (Phase 2 resolveRefs pattern). No symlink following. |
| T-03.04-04 | Information Disclosure | tmp file contents | accept | Tmp files in same directory as target; same ACL inherits. On failure, `unlinkSync` cleanup attempted. Residual tmp on crash is low-impact. |
| T-03.04-07 | Tampering | unsanitized schema write | mitigate | saveFile re-validates via `RoadmapSchemaSchema.safeParse` before atomicWrite. If invalid, reject; no disk I/O. Verified in saveFile.test.ts test #4. |
| T-03.04-10 | Tampering | DevHarness panel in production | mitigate | `import.meta.env.DEV` guard at mount site + Vite treeshaking strips DevHarness module from production bundle. Verified via `! grep -q "DevHarness" packages/desktop/build/*.js`. |
</threat_model>

<verification>
- `bunx vitest run tests/unit/bun/` exits 0 (atomicWrite + refMap + saveFile — 20 tests)
- `bunx vite build` exits 0; production bundle has no `DevHarness` string
- `bunx @biomejs/biome lint packages/desktop/src/ shared/` exits 0
- `bunx tsc --noEmit` exits 0
- Mid-plan UAT (Task 4) passes
- Full UAT (Task 5) passes
</verification>

<success_criteria>
- EDIT-14: Atomic write (.tmp + rename) + Windows 3-attempt 50ms retry
- EDIT-16: $ref write-back splits schema per owner; Warning-4 fix prevents deleted-node resurrection
- EDIT-17: saveFile RPC with session-scoped allowlist (path-traversal mitigation)
- EDIT-18 (partial — cross-boundary block via allowlist): node movement across file boundaries will be blocked at the mutation layer in Plan 01; this plan enforces the persistence-layer guarantee
- T-03.04-01 path-traversal guard + T-03.04-07 Zod pre-write
- DevHarness scaffold proven; production build strip verified
- 20 unit tests + 2 checkpoints GREEN
</success_criteria>

<output>
After completion, create `.planning/phases/03-full-editor/03-04a-SUMMARY.md` with:
- Verified path-traversal allowlist behavior (sample call + response log)
- Any Windows retry observed during testing (0 or N of 3 attempts)
- Production bundle strip confirmation (`grep` output)
- Test counts for atomicWrite, refMap, saveFile
- Outstanding work deferred to 04b (autosave wiring) and 04c (before-quit + File>New)
</output>
</content>
</invoke>
