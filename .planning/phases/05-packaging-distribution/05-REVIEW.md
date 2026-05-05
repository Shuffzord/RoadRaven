---
phase: 05-packaging-distribution
reviewed: 2026-05-04T00:00:00Z
depth: standard
files_reviewed: 42
files_reviewed_list:
  - .github/workflows/ci.yml
  - .github/workflows/release.yml
  - .gitignore
  - CONTRIBUTING.md
  - LICENSE
  - README.md
  - docs/_config.yml
  - docs/architecture-overview.md
  - docs/design-system.md
  - docs/development-guide.md
  - docs/index.md
  - docs/logging.md
  - docs/plugin-authoring.md
  - docs/rpc-and-ipc.md
  - package.json
  - packages/core/LICENSE
  - packages/core/README.md
  - packages/core/package.json
  - packages/core/tsconfig.json
  - packages/core/tsup.config.ts
  - packages/desktop/electrobun.config.ts
  - packages/desktop/package.json
  - packages/desktop/src/mainview/components/Canvas.tsx
  - packages/desktop/src/mainview/components/ContextMenu.tsx
  - packages/desktop/src/mainview/components/RoadmapNode.tsx
  - packages/desktop/src/mainview/components/SidePanel.tsx
  - packages/desktop/src/mainview/hooks/useKeyboardRouter.ts
  - packages/desktop/src/mainview/index.css
  - packages/desktop/tests/a11y/audit.spec.ts
  - packages/desktop/tests/a11y/playwright.config.ts
  - packages/desktop/tests/ui/keyboard-routing.spec.ts
  - packages/desktop/tests/unit/hooks/useKeyboardRouter.escape.test.tsx
  - packages/desktop/tests/unit/hooks/useKeyboardRouter.test.ts
  - plugins/claude-code/LICENSE
  - plugins/claude-code/README.md
  - plugins/claude-code/package.json
  - scripts/bump-version.ts
  - scripts/check-core-deps.ts
  - tests/release/core-exports.test.ts
  - tests/release/installer-artifacts.test.ts
  - tests/release/manifest-url.test.ts
  - tests/release/requirements-edits.test.ts
findings:
  blocker: 4
  warning: 9
  info: 6
  total: 19
status: issues_found
---

# Phase 5: Code Review Report

**Reviewed:** 2026-05-04
**Depth:** standard
**Files Reviewed:** 42
**Status:** issues_found

## Summary

Phase 5 ships an npm-publishable `@roadraven/core` (tsup ESM + .d.ts, OIDC trusted publishing), a tag-triggered release workflow, a Jekyll docs site, an axe-core/playwright a11y suite, and the WAI-ARIA tree-pattern fixes (chevron `tabIndex={-1}`, Shift+Tab guard).

The implementation is largely sound and the TypeScript/React code is clean, but there are real defects that ship to production:

- **Pure Contrast theme has 3.66:1 contrast on its primary body text** (`--rv-text-primary: #666666` on `--rv-bg-base: #000000`) — a flat WCAG 2.1 AA fail on every screen rendered in that theme. The a11y audit only exercises `dark`, `light`, and `high-contrast`, so this never reaches the gate.
- **Light-theme Delete menu item is 3.76:1** (`--rv-status-blocked: #ef4444` on `--rv-bg-elevated: #ffffff`). A11y audit test #4 only opens the context menu in the default dark theme, so the violation in the published light-theme bundle is not caught.
- **`bump-version.ts` references `packages/react/package.json` but emits no `private: true` guard** and the same script writes the version with a regex that has no `g` flag (single-replace by accident, not by design).
- **Release workflow `permissions:` are over-scoped at the workflow level** — every job inherits `id-token: write` and `contents: write`, including `build-windows`/`build-linux` that need neither. Per-job least-privilege is straightforward and missing.

The `useKeyboardRouter` Tab vs Shift+Tab guard, chevron `tabIndex={-1}`, and OIDC publishing flow (no `NPM_TOKEN`, `--provenance`) are correctly implemented — those parts hold up.

## Blocker Issues

### B-01: Pure Contrast theme primary text fails WCAG 2.1 AA (3.66:1)

**File:** `packages/desktop/src/mainview/index.css:441`
**Issue:** `[data-theme="contrast"]` defines `--rv-text-primary: #666666` on `--rv-bg-base: #000000`. Computed contrast is 3.66:1 — below the 4.5:1 AA threshold for normal text. This token feeds `body { color: var(--rv-text-primary) }` (line 731), so every paragraph, label, and field label in the side panel, status bar, welcome screen, etc. is non-compliant when this theme is active. `--rv-text-tertiary` and `--rv-text-secondary` (lines 442–443) have the same problem (`#666666` → 3.66:1, `#9a9a9a` → 7.46:1 — only secondary passes).

The audit suite at `packages/desktop/tests/a11y/audit.spec.ts:159` only exercises `dark | light | high-contrast`, so this theme ships unaudited. The audit doc claims D-20 PACK-06 enforcement; the contract is silently broken for any user who picks Pure Contrast.

**Fix:**
```css
/* index.css around line 441 */
[data-theme="contrast"] {
  /* WCAG 2.1 AA: text on #000000 needs ≥ 4.5:1 (normal) / ≥ 3:1 (large) */
  --rv-text-primary: #d1d1d1;   /* 12.0:1 — primary body text */
  --rv-text-secondary: #9a9a9a; /* 7.46:1 — already passing, keep */
  --rv-text-tertiary: #888888;  /* 5.13:1 — replaces #666666 (3.66:1, FAIL) */
  /* ... */
}
```
Then extend the for-loop in `audit.spec.ts:159` to include the remaining themes (`paper`, `amber`, `contrast`, `slate`, `moss`) so this class of regression cannot ship again, OR explicitly mark the un-audited themes as "experimental — not WCAG-gated" in user-visible UI.

---

### B-02: Light-theme Delete menu item fails WCAG 2.1 AA (3.76:1)

**File:** `packages/desktop/src/mainview/components/ContextMenu.tsx:18-19, 222-231`
**Issue:** `ITEM_DESTRUCTIVE_CLASS` and the inline `style={{ color: "var(--rv-status-blocked)" }}` on the Delete menu item paint red on the menu surface (`--rv-bg-elevated`). In the light theme:
- `--rv-status-blocked: #ef4444` (index.css:193)
- `--rv-bg-elevated: #ffffff` (index.css:141)
- Computed contrast: **3.76:1** — fails WCAG 2.1 AA for normal text (needs 4.5:1).

The a11y audit suite (`audit.spec.ts:113-131`) opens the context menu but only in the default theme (dark) where the same combination is 4.79:1 (just passing). Light-theme context-menu rendering is never audited. The CSS comment claim that "Hint uses standard tertiary color … so the keyboard shortcut meets WCAG 2.1 AA contrast" (line 228-229) is only valid for the hint, not for the destructive item label itself.

**Fix:** Darken the light-theme blocked color so destructive menu items meet contrast:
```css
/* index.css line 193 — light theme */
--rv-status-blocked: #c92020;  /* ≈ 5.5:1 on #ffffff; or use #b91c1c (~6.4:1) */
--rv-status-blocked-bg: rgba(201, 32, 32, 0.08);
```
Also add a `theme-light + context-menu open` audit case to `audit.spec.ts` so the regression cannot recur.

---

### B-03: `release.yml` tag trigger `'v*'` matches accidental canary tags

**File:** `.github/workflows/release.yml:5-7`
**Issue:** The workflow triggers on `tags: ['v*']`. `requirements-edits.test.ts:67-77` already documents that this glob ALSO matches `v1.x-canary.*` tags — the comment calls it a "v1.0 limitation" and only asserts no canary-specific broadening exists, but the literal `v*` already includes them. If anyone (developer, CI script, dependabot) pushes a `v1.0.1-canary.0` tag during v1.0 to test scaffolding, the workflow fires `npm publish --access public --provenance` against a not-yet-stable build, and `softprops/action-gh-release@v2` creates a public GitHub Release with `prerelease: false` and `generate_release_notes: true`. There is no semver-stability gate inside any job. The `deploy-docs` job's `if: startsWith(github.ref, 'refs/tags/v')` guard accepts the same tag.

The defense-in-depth comment on `deploy-docs` is misleading because it does not actually gate publish — only the docs deploy.

**Fix:** Tighten the trigger to stable-only and gate canary in v1.1 via a separate workflow:
```yaml
on:
  push:
    tags:
      # Stable semver only (v1.0.0, v1.0.1). Pre-release tags (e.g. v1.x-canary.*,
      # v1.x-rc.*) are reserved for v1.1's separate canary workflow.
      - 'v[0-9]+.[0-9]+.[0-9]+'
```
Then update `tests/release/requirements-edits.test.ts:74` to assert the new pattern, dropping the comment that v1.0 accepts the foot-gun.

---

### B-04: `bump-version.ts` will crash if `packages/react/package.json` is removed

**File:** `scripts/bump-version.ts:15-26`
**Issue:** The `targets` array hard-codes `packages/react/package.json`, but per D-05 / Plan 05-02 the `@roadraven/react` package is explicitly deferred to v1.1 and is intentionally `private: true` (verified in repo). Today the file exists, so the script works, but:
1. **The script silently bumps a private package's version** — it ships nowhere, but the version field drifts away from the published packages and confuses anyone debugging the release. (Soft issue — info-level.)
2. **Removing or renaming `packages/react/` is now a breaking change for the release process** because `readFileSync` will throw `ENOENT` and abort mid-loop, leaving some package.jsons bumped and others not. The error isn't surfaced as actionable — the release engineer sees a stack trace.

The script also has no `try/catch` around `readFileSync` / `JSON.parse`, so a malformed package.json kills the run partway through, leaving the workspace in an inconsistent state with no rollback hint. The lockstep contract (D-04) is the whole point of this script — partial application is the worst possible failure mode.

**Fix:**
```typescript
// scripts/bump-version.ts
const targets = [
  "packages/desktop/package.json",
  "packages/core/package.json",
  "plugins/claude-code/package.json",
  // Skip @roadraven/react — private, deferred to v1.1. Re-add when published.
];

// Validate ALL targets before writing ANY of them so the workspace can never
// land in a half-bumped state.
const parsed = targets.map((path) => {
  if (!existsSync(path)) {
    console.error(`Missing target: ${path}`);
    process.exit(1);
  }
  try {
    return { path, pkg: JSON.parse(readFileSync(path, "utf8")) };
  } catch (e) {
    console.error(`Failed to parse ${path}: ${(e as Error).message}`);
    process.exit(1);
  }
});

for (const { path, pkg } of parsed) {
  pkg.version = newVersion;
  writeFileSync(path, `${JSON.stringify(pkg, null, "\t")}\n`);
}
```
Also add a guard around the electrobun.config.ts replace (currently `cfg.replace(/version:\s*"[^"]+"/, ...)` will silently no-op if the regex doesn't match; the script reports success regardless):
```typescript
if (!/version:\s*"[^"]+"/.test(cfg)) {
  console.error(`No version field found in ${cfgPath}`);
  process.exit(1);
}
```

---

## Warnings

### W-01: `release.yml` workflow-level `permissions:` are over-scoped

**File:** `.github/workflows/release.yml:13-15`
**Issue:** `permissions: { contents: write, id-token: write }` is set at the workflow level, so every job inherits both. `build-windows` and `build-linux` mint no OIDC tokens and create no Releases — they only upload-artifact, which uses `actions/upload-artifact` (no special permissions). `publish-npm-core` and `publish-npm-mcp` need `id-token: write` (provenance) but NOT `contents: write`. `github-release` needs `contents: write` but not `id-token: write`. Per least-privilege:

**Fix:**
```yaml
permissions:
  contents: read       # default — every job gets read-only checkout

jobs:
  build-windows:
    # no permissions override — read-only is enough
    ...
  build-linux:
    ...
  github-release:
    permissions:
      contents: write  # softprops/action-gh-release writes Releases
    ...
  publish-npm-core:
    permissions:
      id-token: write  # OIDC for provenance
      contents: read
    ...
  publish-npm-mcp:
    permissions:
      id-token: write
      contents: read
    ...
  deploy-docs:
    # already overrides correctly — leave as-is
```

---

### W-02: `ci.yml` has no explicit workflow `permissions:` block

**File:** `.github/workflows/ci.yml:1-7`
**Issue:** No `permissions:` declared, so the workflow inherits whatever the repo's default token permissions are. On older repos this defaults to `permissions: write-all` for the `GITHUB_TOKEN`, granting CI broader access than needed for a lint/typecheck/test workflow. Hardening best practice (and required by `actions/checkout` security guidance) is to declare:

**Fix:** Add at workflow scope (after line 7):
```yaml
permissions:
  contents: read
```
This makes the principle of least-privilege explicit regardless of repo default. None of the existing jobs need write access.

---

### W-03: `bump-version.ts` regex replace uses no `g` flag — fragile single-match

**File:** `scripts/bump-version.ts:31`
**Issue:** `cfg.replace(/version:\s*"[^"]+"/, ...)` replaces only the first match. The script comment says "small file, one match", which is true today, but the regex matches *any* `version:` string field — adding a `version:` field to an `app.config` block, plugin metadata, comment, or test fixture in `electrobun.config.ts` later will silently bump the wrong field. There is no assertion that the replacement succeeded (a no-op `.replace()` returns the original string and emits a success log).

**Fix:** Anchor the match to the `app:` block:
```typescript
// Match: app: { ... version: "x.y.z" ... }
const re = /(app:\s*\{[^}]*?version:\s*")[^"]+(")/;
if (!re.test(cfg)) {
  console.error(`Could not find app.version in ${cfgPath}`);
  process.exit(1);
}
const updated = cfg.replace(re, `$1${newVersion}$2`);
writeFileSync(cfgPath, updated);
```

---

### W-04: `check-core-deps.ts` does not check `peerDependencies` or `optionalDependencies`

**File:** `scripts/check-core-deps.ts:15-31`
**Issue:** The allowlist checker only inspects `pkg.dependencies`. The PACK-04 invariant in the script comment says "@roadraven/core has zero desktop dependencies" — but a contributor could trivially evade the gate by adding desktop deps under `peerDependencies`, `optionalDependencies`, or `bundledDependencies`. npm/bun resolve all of these at install time for downstream consumers; only `devDependencies` is truly invisible to consumers.

**Fix:**
```typescript
const FIELDS_TO_CHECK = [
  "dependencies",
  "peerDependencies",
  "optionalDependencies",
  "bundledDependencies",
] as const;

const violations: string[] = [];
for (const field of FIELDS_TO_CHECK) {
  const deps = Object.keys(
    (pkg as Record<string, Record<string, string> | undefined>)[field] ?? {},
  );
  for (const d of deps) {
    if (!ALLOWLIST.has(d)) violations.push(`${field}.${d}`);
  }
}
```

---

### W-05: `check-core-deps.ts` resolves `packages/core/package.json` from `process.cwd()` only

**File:** `scripts/check-core-deps.ts:16`
**Issue:** Hard-codes the relative path `"packages/core/package.json"`, so it only works when run from the repo root. CI invokes it that way today, but anyone running `bun run scripts/check-core-deps.ts` from inside `packages/core/` (a natural thing to do while iterating on core) gets a confusing `ENOENT` instead of useful output.

**Fix:** Resolve relative to the script location:
```typescript
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const pkgPath = resolve(scriptDir, "../packages/core/package.json");
```

---

### W-06: `tests/release/installer-artifacts.test.ts` skip semantics mask CI failures

**File:** `tests/release/installer-artifacts.test.ts:14-17, 33-35`
**Issue:** `describe.skipIf(!hasArtifacts)` skips the entire block when `packages/desktop/artifacts/` is missing. In CI, the workflow runs this test step *after* `bunx electrobun build --env=stable`. If `electrobun build` exits 0 but produces no `artifacts/` directory (e.g. config drift, silent failure mode in the bun bin, output dir override), the test will SKIP rather than FAIL. The CI step shows "1 passed file (skipped)" and the release continues to publish empty/wrong artifacts.

**Fix:** Convert the directory existence to an assertion in CI mode:
```typescript
const ARTIFACTS_DIR = join(process.cwd(), "packages/desktop/artifacts");
const hasArtifacts = existsSync(ARTIFACTS_DIR);

// In CI, the artifacts dir MUST exist after `electrobun build` ran. Skipping
// silently when CI=true is a release-time foot-gun.
if (process.env.CI && !hasArtifacts) {
  throw new Error(
    `CI=true but ${ARTIFACTS_DIR} does not exist. ` +
    `Did 'electrobun build' run before this test step?`,
  );
}

describe.skipIf(!hasArtifacts)("Installer artifacts (PACK-01)", () => { ... });
```

---

### W-07: `useKeyboardRouter` `Ctrl+C` empty-focused branch leaks default browser copy

**File:** `packages/desktop/src/mainview/hooks/useKeyboardRouter.ts:111-116`
**Issue:** When `e.key === "c"` with Ctrl/Cmd held and `inTextInput === false` and `focusedId == null`, the handler `return`s without `preventDefault()`. The native browser handles Ctrl+C, which copies the document selection — fine in most cases, but combined with the `setSelectedNode(null)` Escape behavior, a user who pressed Escape to deselect, then Ctrl+C expecting to copy a node, gets a silent no-op (and any incidentally-selected text from the canvas SVG ends up on the clipboard). Worse: an addon or extension that listens on document-level `copy` events sees this fall through.

This is sloppy more than a vulnerability, but the explicit comment "Context-aware Ctrl+C / Ctrl+V — defers to native when typing in a text input" implies intent that doesn't match the `focusedId == null && !inTextInput` branch.

**Fix:**
```typescript
if (e.key === "c") {
  if (!focusedId) return; // intentionally fall through to native (no node to copy)
  // ... existing
}
```
Or document the fall-through behavior explicitly:
```typescript
if (e.key === "c") {
  if (!focusedId) {
    // No focused node → defer to native copy of any text selection.
    return;
  }
  ...
}
```
The current code already does the right thing functionally, but the missing comment makes it look like a bug to reviewers.

---

### W-08: `useKeyboardRouter` `isMenuOpen` / `isModalOpen` document-wide selectors over-broad

**File:** `packages/desktop/src/mainview/hooks/useKeyboardRouter.ts:28-45`
**Issue:** `document.querySelector('[role="dialog"][data-state="open"]')` and `document.querySelector('[role="menu"]')` will match ANY element on the page with those attributes. RoadRaven embeds CodeMirror (`@codemirror/*`), Radix UI, and react-d3-tree. A future component that uses `role="menu"` for non-modal navigation (toolbar menus, dropdown menus that don't trap focus) will silently disable the entire keyboard router.

**Fix:** Scope the selector to the Radix portal layer (Radix uses `data-radix-popper-content-wrapper` or similar wrapper attributes), or at minimum check for `data-state="open"` on menu too:
```typescript
function isMenuOpen(): boolean {
  return !!document.querySelector('[role="menu"][data-state="open"]');
}
```
Verify against `@radix-ui/react-context-menu` v2.2 — it does emit `data-state="open"` on menu Content. The current selector is too loose.

---

### W-09: `Canvas.tsx` `onClick` deselect uses identity comparison that breaks with portals/overlays

**File:** `packages/desktop/src/mainview/components/Canvas.tsx:344-349`
**Issue:** `if (e.target === e.currentTarget) setSelectedNode(null)` — the click only deselects when the target is *exactly* the canvas div. If the user clicks any descendant (the dot-grid pseudo-element, the watermark `<div aria-hidden>`, the SVG background fill from react-d3-tree), `e.target !== e.currentTarget` and the deselect never fires. The watermark `<div>` (line 357-370) is `pointer-events: none`, so it correctly passes clicks through. But the `<Tree>` SVG (line 386-405) catches clicks across its full extent regardless of node positions — clicking on empty SVG canvas does NOT deselect because `e.target` becomes the SVG, not the canvas div.

**Fix:** Check that no node was clicked by walking up from `e.target` looking for `[data-source-id]`:
```typescript
onClick={(e) => {
  const inNode = (e.target as Element).closest?.("[data-source-id]");
  if (!inNode) setSelectedNode(null);
}}
```
This correctly deselects on any click outside a node card.

---

## Info

### I-01: `bump-version.ts` `console.log` violates global "no console.log unless asked" rule

**File:** `scripts/bump-version.ts:34-37`
**Issue:** Per the global user preferences and `CONTRIBUTING.md` line 95-96, no `console.log` should appear unless explicitly debugging. The CLI script case is gray-area (CLI scripts MUST emit user-visible output), and the project has explicitly authorized `console.error` in `check-core-deps.ts`. But the script doesn't use the `LogTape` categories the rest of the codebase uses, and there's no comment explaining the exemption.

**Fix:** Add a one-line comment justifying the CLI-script exemption, or migrate to `process.stdout.write` for true CLI output:
```typescript
// CLI script: console.log/error are the standard channel for terminal output.
console.log(`Bumped all packages + electrobun.config.ts to ${newVersion}`);
```

---

### I-02: `electrobun.config.ts` hard-codes `version: "0.0.1"` that will drift from published packages

**File:** `packages/desktop/electrobun.config.ts:11`
**Issue:** The desktop `app.version` is `"0.0.1"`, but the release workflow publishes from `tags: ['v*']`. The first real release will tag `v1.0.0`, and the bump script (B-04) updates this field. Until that bump runs, anyone building locally produces an installer reporting itself as `0.0.1`. Document or add a release-checklist item.

**Fix:** Document in `RELEASE-OPS.md` that `bun scripts/bump-version.ts X.Y.Z` MUST run before tagging.

---

### I-03: `release.yml` `softprops/action-gh-release@v2` is unpinned to a major

**File:** `.github/workflows/release.yml:100`
**Issue:** Pinning to `@v2` means a malicious or buggy v2.x release can compromise the release pipeline. GitHub Actions security best practice is to pin to a SHA for third-party actions on critical paths (release/publish workflows). Same applies to `softprops/action-gh-release@v2` and any non-`actions/*` action.

**Fix:** Pin to a commit SHA (Dependabot can keep them updated):
```yaml
- uses: softprops/action-gh-release@a74c6b72af54cfa997e81df42d94703d6313a2d0  # v2.x.y
```

---

### I-04: `tests/release/manifest-url.test.ts` uses non-null assertion on `URL`

**File:** `tests/release/manifest-url.test.ts:14`
**Issue:** `await fetch(URL!)` — the `!` non-null assertion is unnecessary because `describe.skipIf(!URL)` already gates the entire block. But the assertion can mask future refactors that change the gate. Type-narrow instead:
```typescript
const URL = process.env.RR_TEST_MANIFEST_URL;
describe.skipIf(!URL)("...", () => {
  it("...", async () => {
    if (!URL) throw new Error("guarded by skipIf"); // narrow
    const res = await fetch(URL);
    ...
  });
});
```

---

### I-05: `useKeyboardRouter.ts` `enterChild` uses bare `parentArray[index]` without bounds check

**File:** `packages/desktop/src/mainview/hooks/useKeyboardRouter.ts:56-64`
**Issue:** `const target: RoadmapNode = found.parentArray[found.index]` — `findParentAndIndex` is contracted to return a valid index, but if it ever returns an out-of-bounds index (refactor regression, schema corruption mid-flight), `target` becomes `undefined` and `target.children?.[0]` throws `TypeError: Cannot read properties of undefined (reading 'children')`. Defensive check is a one-liner.

**Fix:**
```typescript
const target = found.parentArray[found.index];
if (!target) return;
const first = target.children?.[0];
if (first) useRoadmapStore.getState().setFocusedNode(first.id);
```

---

### I-06: `index.css` `--rv-pulse` token defined but not mapped in `@theme`

**File:** `packages/desktop/src/mainview/index.css:127, 197, 264, 332, 410, 483, 563, 641`
**Issue:** Every theme defines `--rv-pulse` but the token is missing from the `@theme` block (lines 10-60). Tailwind utility classes like `bg-rv-pulse` won't generate. The token is currently consumed only via `var(--rv-pulse)` in CSS rules (`.node[data-live="true"]::after { animation ... }`), so functionally fine, but inconsistent with every other theme token. If a contributor expects `text-rv-pulse` to work for an alert badge, it silently won't.

**Fix:**
```css
/* index.css around line 51 (inside @theme block) */
--color-rv-pulse: var(--rv-pulse);
```

---

_Reviewed: 2026-05-04_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
