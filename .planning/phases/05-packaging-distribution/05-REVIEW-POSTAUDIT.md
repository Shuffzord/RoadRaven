---
phase: 05-packaging-distribution
reviewed: 2026-05-05T00:00:00Z
depth: standard
files_reviewed: 13
files_reviewed_list:
  - .github/workflows/ci.yml
  - .github/workflows/release.yml
  - README.md
  - packages/desktop/electrobun.config.ts
  - packages/desktop/package.json
  - packages/desktop/scripts/build-icons.ts
  - packages/desktop/src/mainview/index.css
  - packages/desktop/tests/a11y/audit.spec.ts
  - packages/desktop/tests/unit/smoke.test.ts
  - scripts/bump-version.ts
  - scripts/check-core-deps.ts
  - tests/release/installer-artifacts.test.ts
  - tests/release/requirements-edits.test.ts
findings:
  blocker: 1
  warning: 5
  info: 5
  total: 11
status: issues_found
---

# Phase 5: Code Review Report (Post-Audit Re-review)

**Reviewed:** 2026-05-05
**Depth:** standard
**Scope:** 13 files modified since `6739fd8` — covers the four blocker fixes (B-01..B-04), the two verifier-flagged warning fixes (W-02, W-04, W-06), the Truth #1 installer-filename fix, the icon embedding (`build-icons.ts`, icon assets, electrobun.config.ts), and the electrobun runtime bump to 1.18.1.
**Status:** issues_found

## Summary

The four blocker fixes from `05-REVIEW.md` (B-01/B-02 contrast, B-03 release tag glob, B-04 bump-version validate-then-write) genuinely landed and the regression guards are tight. The verifier-flagged Truth #1 (installer artifact filename mismatch) is also resolved — `release.yml` comments, `installer-artifacts.test.ts` regexes, and `README.md` install instructions all consistently reference `stable-{os}-x64-RoadRaven-Setup.{zip,tar.gz}`. Cross-file consistency on installer filenames was specifically verified via grep across all three locations.

However, the re-review surfaces ONE new BLOCKER and several quality issues introduced or untouched by the fixes:

- **BLOCKER:** `README.md` Linux install instructions tell users to `chmod +x ./installer && ./installer`, but no documented Electrobun output uses the binary name `installer`. The planning docs (`05-RESEARCH.md` Pitfall 6) explicitly call out the exact name as needing local verification (`./RoadRaven` or `./RoadRavenSetup` are mentioned, never `./installer`). On a real release, the user runs `chmod` against a non-existent file and the install flow silently breaks at step 2 of 3.
- **WARNING (regression of fix):** `installer-artifacts.test.ts` asserts the `.zip`/`.tar.gz` and `update.json` exist but does NOT assert the `tar.zst` payload (which Electrobun produces and `release.yml` uploads). If `tar.zst` is missing, the smoke test passes, the upload step succeeds (matching glob still finds the zip), but auto-updater can't fetch a payload to apply. Truth #1 closed half the gap.
- **WARNING:** `smoke.test.ts:9-15` requires `packages/react/package.json` to exist, which directly contradicts the `bump-version.ts` rationale comment ("Re-add when packages/react/ is flipped from private to public-publishable" — implies the file may be deleted in v1.1). The two scripts will diverge: deleting `packages/react/` is now a breaking change ONLY because of an SCAF-01 monorepo-structure assertion that was never updated when D-21 deferred the package.
- **WARNING:** `check-core-deps.ts` extension to peer/optional/bundled deps is sound and the array-vs-map handling is correct, but it doesn't detect the npm-permitted alternate spelling `bundleDependencies` (without trailing 'd'). npm and Bun both honor the singular form — that's an evasion vector.
- The `build-icons.ts` script writes to `packages/desktop/assets/` unconditionally (no idempotency check, no error handling for `pngToIco`); the icon embedding is otherwise sound.

The contrast fixes, B-03 tag glob anchoring, B-04 validate-then-write, and W-02 ci.yml `permissions: contents: read` are all clean.

## Blocker Issues

### CR-01: README Linux install instructions tell users to `chmod` a binary that doesn't exist by that name

**File:** `README.md:32-38`
**Issue:** The Linux install steps instruct:

```bash
tar -xzf stable-linux-x64-RoadRaven-Setup.tar.gz
chmod +x ./installer
./installer
```

The binary name `installer` does not appear in:
- Any local build output (`packages/desktop/build/canary-win-x64/` — Windows-only, but the naming convention transfers).
- `05-RESEARCH.md` Pitfall 6 (line 826) which uses `./RoadRaven`.
- `05-RESEARCH.md` Resolution Path 1 (line 128) which uses `./RoadRavenSetup`.
- Electrobun docs cited in research: `{channel}-linux-x64-{AppName}Setup-{channel}.tar.gz` containing `{AppName}Setup`.

The planning research explicitly flags this as needing local verification: *"exact paths depend on what `electrobun build` produces — verify by running `electrobun build --env=stable` once locally and inspecting the output structure"* (`05-RESEARCH.md:826`). That verification has not happened on Linux yet (no Linux artifacts in `packages/desktop/artifacts/` — only Windows). On the first real `v1.0.0` tag push, every Linux user attempting to install gets:

```
$ chmod +x ./installer
chmod: cannot access './installer': No such file or directory
```

The README's claim *"The archive extracts contents directly (no nested folder)"* is also unverified — Electrobun's Linux self-extracting bundle may extract into a subdirectory (e.g., `RoadRaven-stable/`) per the standard pattern. None of `05-VERIFICATION.md`'s 18 spot-checks tested this end-to-end on a Linux runner.

This is the Truth #1 verifier-flag pattern repeating on the Linux side: the Windows filename was guessed, found wrong, and corrected; the Linux *binary-inside-the-archive* name was guessed and never corrected because there was no local artifact to compare against.

**Fix:** Either (a) build Linux artifacts locally, extract, and document the actual binary name + folder layout in README + `05-RESEARCH.md` Pitfall 6, OR (b) replace the literal `./installer` with a generic instruction that survives Electrobun naming churn:

```markdown
### Linux

1. Download `stable-linux-x64-RoadRaven-Setup.tar.gz`.
2. Extract the archive:
   ```bash
   tar -xzf stable-linux-x64-RoadRaven-Setup.tar.gz
   ```
3. The extracted directory contains a self-extracting installer
   (binary name varies by Electrobun version — typically `RoadRaven`
   or `RoadRavenSetup`). Make it executable and run it:
   ```bash
   chmod +x ./RoadRaven       # or ./RoadRavenSetup — check ls output
   ./RoadRaven                 # the launcher will do an in-place install
   ```
4. The installer creates a desktop shortcut and installs to
   `~/.local/share/RoadRaven/`. CEF runtime is bundled
   (`bundleCEF: true`); no system Chromium is required.
```

OR add an explicit human-verification step to `05-VERIFICATION.md` requiring a real Linux extract before phase close. The current form fails on first user contact.

---

## Warnings

### WR-01: `installer-artifacts.test.ts` asserts only 2 of 3 produced artifacts — `.tar.zst` payload is unguarded

**File:** `tests/release/installer-artifacts.test.ts:46-93`
**Issue:** The Truth #1 fix updated the regex assertions for `.zip` (Windows) and `.tar.gz` (Linux), plus the `update.json` manifest. But the local artifact directory shows three Electrobun outputs:

```
stable-win-x64-RoadRaven-Setup.zip
stable-win-x64-RoadRaven.tar.zst       ← NOT asserted
stable-win-x64-update.json
```

`release.yml:55-58` and `release.yml:92-95` upload the `.tar.zst` glob explicitly (`stable-{win,linux}-x64-*.tar.zst`). The test does not assert this third file exists. If a future Electrobun bump silently drops the `.tar.zst` payload (or renames it), the smoke test passes, the upload step succeeds (the `.zip` matches the upload glob), and the auto-updater contract silently breaks: `Updater.applyUpdate()` fetches `${baseUrl}/{channel}-{os}-{arch}-update.json` for the manifest, then fetches the `.tar.zst` payload referenced in that manifest. No payload = update fails.

This is precisely the W-06 "fail loud in CI" intent that Truth #1 partially restored. The fix made the `.zip`/`.tar.gz` regex match real output but stopped one file short.

**Fix:** Add a third assertion per platform:

```typescript
// inside Windows block, after the update.json assertion
it("produces stable-win-x64-RoadRaven.tar.zst (auto-updater payload)", () => {
  const files = readdirSync(ARTIFACTS_DIR);
  const zstPayload = files.find((f) =>
    /^stable-win-x64-RoadRaven\.tar\.zst$/.test(f),
  );
  expect(
    zstPayload,
    `auto-updater .tar.zst payload not found in ${files.join(", ")}`,
  ).toBeTruthy();
});

// And the symmetric Linux assertion:
it("produces stable-linux-x64-RoadRaven.tar.zst (auto-updater payload)", () => {
  const files = readdirSync(ARTIFACTS_DIR);
  const zstPayload = files.find((f) =>
    /^stable-linux-x64-RoadRaven\.tar\.zst$/.test(f),
  );
  expect(zstPayload, `auto-updater payload not found`).toBeTruthy();
});
```

---

### WR-02: `smoke.test.ts` requires `packages/react/package.json` to exist — contradicts D-21 deferral rationale in `bump-version.ts`

**File:** `packages/desktop/tests/unit/smoke.test.ts:9-20`
**Issue:** SCAF-01 asserts `packages/react/package.json` MUST exist:

```typescript
const requiredPackages = [
  "packages/core/package.json",
  "packages/react/package.json",       // ← still required by smoke test
  "packages/desktop/package.json",
  "plugins/claude-code/package.json",
];
```

But `bump-version.ts:19-22` documents the opposite intent:

> Publishable packages only. @roadraven/react is deferred to v1.1 (D-21) and is intentionally absent from this list — re-add when packages/react/ is flipped from private to public-publishable.

The phrase *"re-add when packages/react/ is flipped"* strongly implies the package may be deleted before v1.1. If a future cleanup PR removes `packages/react/` (which is `private: true` and unused per `05-REVIEW.md` I-02 disposition), the smoke test fails AND the bump-version script would not have caught it because the target was deliberately removed. The two scripts express incompatible invariants.

This is not a regression introduced by the B-04 fix — `smoke.test.ts` predates Phase 5 — but the B-04 fix made the inconsistency observable by removing the `packages/react/` reference from the lockstep target list while leaving the SCAF-01 monorepo-structure assertion alone.

**Fix:** Either:

```typescript
// Option A (preferred): drop packages/react from required list since it's
// deferred to v1.1 per D-21. Re-add when the package is flipped public.
const requiredPackages = [
  "packages/core/package.json",
  "packages/desktop/package.json",
  "plugins/claude-code/package.json",
];
```

OR add an inline comment explaining why both invariants exist and aren't actually contradictory:

```typescript
// Option B: keep the assertion but document the intent.
const requiredPackages = [
  "packages/core/package.json",
  // @roadraven/react: stub package, private: true, deferred to v1.1 per D-21.
  // Required to exist (workspace structure invariant) but NOT included in
  // bump-version.ts targets (lockstep is publishable-only).
  "packages/react/package.json",
  "packages/desktop/package.json",
  "plugins/claude-code/package.json",
];
```

---

### WR-03: `check-core-deps.ts` does not detect npm-alternate spelling `bundleDependencies` (no trailing `d`)

**File:** `scripts/check-core-deps.ts:21-26`
**Issue:** The `DEP_FIELDS` allowlist coverage extension (W-04 fix) checks `dependencies`, `peerDependencies`, `optionalDependencies`, and `bundledDependencies`. But the npm `package.json` spec officially supports BOTH `bundledDependencies` AND `bundleDependencies` (singular, no trailing 'd') as synonyms. From npm docs at https://docs.npmjs.com/cli/v10/configuring-npm/package-json#bundledependencies:

> "Both bundleDependencies and bundledDependencies are supported. The bundleDependencies version was added in npm 1.0.0."

A contributor who adds `"bundleDependencies": ["something-desktop"]` to `packages/core/package.json` evades the gate entirely. Both bun and npm pack/publish will bundle the dep regardless of spelling.

This is the same evasion class W-04 was designed to close.

**Fix:**

```typescript
const DEP_FIELDS = [
  "dependencies",
  "peerDependencies",
  "optionalDependencies",
  "bundledDependencies",
  "bundleDependencies",            // npm-alternate spelling
] as const;
```

The TypeScript narrowing for the array-vs-map distinction needs to handle the new key the same way:

```typescript
type PackageJson = {
  [K in DepField]?: K extends "bundledDependencies" | "bundleDependencies"
    ? string[]
    : Record<string, string>;
};
```

---

### WR-04: `bump-version.ts` final write loop has no atomicity guard against partial filesystem failure

**File:** `scripts/bump-version.ts:60-64`
**Issue:** The B-04 fix correctly validates ALL targets BEFORE writing ANY of them. But the write phase itself is sequential and non-atomic:

```typescript
for (const { path, pkg } of parsedPkgs) {
  pkg.version = newVersion;
  writeFileSync(path, `${JSON.stringify(pkg, null, "\t")}\n`);
}
writeFileSync(cfgPath, cfgUpdated);
```

If `writeFileSync` to `packages/desktop/package.json` succeeds but the next write to `packages/core/package.json` fails (disk full, permissions, AV interference on Windows), the workspace lands in a half-bumped state with NO error recovery hint. The B-04 commit message explicitly claims:

> "Failing find/replace on electrobun.config.ts now aborts with actionable error instead of silently leaving the workspace half-bumped (D-04 invariant)."

That's true for the FIND/REPLACE path. The WRITE path still has the original D-04 violation: pkg-1 written, pkg-2 fails, pkg-3 never attempted. The `cfgPath` write is last so the electrobun version is the canary — but if pkg writes fail before that, the script terminates without touching cfg, so the user sees pkg.json files bumped but `electrobun.config.ts` still on the old version. From the next `bun run verify` they'll see "version drift across packages" with no clear recovery path.

The validate-then-write pattern is one half of the invariant; the other half is "write atomically OR roll back on failure." The script does neither.

**Fix:** Either (a) write to `<path>.tmp` and rename only after all writes succeed (real atomicity), or (b) catch errors mid-loop and report which files were already bumped:

```typescript
const succeeded: string[] = [];
try {
  for (const { path, pkg } of parsedPkgs) {
    pkg.version = newVersion;
    writeFileSync(path, `${JSON.stringify(pkg, null, "\t")}\n`);
    succeeded.push(path);
  }
  writeFileSync(cfgPath, cfgUpdated);
  succeeded.push(cfgPath);
} catch (e) {
  console.error(`Write failed mid-bump: ${(e as Error).message}`);
  console.error(
    `Already-bumped files (NEED MANUAL ROLLBACK):\n  ${succeeded.join("\n  ")}`,
  );
  console.error(`Run: git checkout -- ${succeeded.join(" ")}`);
  process.exit(1);
}
```

The original review explicitly identified this class of failure (B-04 *"Removing or renaming `packages/react/` is now a breaking change for the release process because `readFileSync` will throw `ENOENT` and abort mid-loop, leaving some package.jsons bumped and others not"*). The fix addressed the read side; the write side has the same shape of failure mode.

---

### WR-05: `electrobun.config.ts` `app.version: "0.0.1"` will be the version baked into the `1.0.0` tag's installer if `bump-version.ts` is forgotten

**File:** `packages/desktop/electrobun.config.ts:11`
**Issue:** `05-REVIEW.md` I-02 raised this and `RELEASE-OPS.md` was supposed to document the bump-before-tag step. But the *enforcement mechanism* for "bump before tag" remains entirely manual — if a release engineer types `git tag v1.0.0 && git push --follow-tags` without first running `bun scripts/bump-version.ts 1.0.0`, the release pipeline will:

1. Trigger on `v1.0.0` (tag glob matches).
2. Build with `app.version: "0.0.1"`.
3. Publish `stable-win-x64-RoadRaven-Setup.zip` containing an installer that reports its own version as `0.0.1` to the auto-updater.
4. Publish `@roadraven/core@0.0.1` to npm — and the next user who tags v1.0.1 hits "version 0.0.1 cannot be re-published" because npm doesn't allow re-publish of an already-published version.

Subsequent releases would then need a manual unpublish-then-bump-again recovery (or just publishing v1.0.2 and skipping the bricked v1.0.1).

The phase-5 verification gate has no automated check that the tag matches the package version. This is gold-plating risk: one missed bump breaks the very first release.

**Fix:** Add a CI gate to `release.yml` that fails fast if tag and `package.json.version` disagree:

```yaml
- name: Verify tag matches package version (D-04 lockstep)
  run: |
    TAG="${GITHUB_REF#refs/tags/v}"
    CORE_VERSION=$(node -p "require('./packages/core/package.json').version")
    if [ "$TAG" != "$CORE_VERSION" ]; then
      echo "::error::Tag v${TAG} does not match @roadraven/core@${CORE_VERSION}. Did you forget to run 'bun scripts/bump-version.ts ${TAG}'?"
      exit 1
    fi
    DESKTOP_VERSION=$(node -p "require('./packages/desktop/package.json').version")
    if [ "$TAG" != "$DESKTOP_VERSION" ]; then
      echo "::error::Tag v${TAG} does not match @roadraven/desktop@${DESKTOP_VERSION}."
      exit 1
    fi
```

Add this as the FIRST step of `build-windows` (the failure surfaces before any 5-minute installer build wasted).

---

## Info

### IN-01: `build-icons.ts` lacks error handling around `pngToIco` and writes destination unconditionally

**File:** `packages/desktop/scripts/build-icons.ts:21-22`
**Issue:** `await pngToIco(SRC_PNG)` can throw on malformed PNG input (e.g., non-square images, unsupported PNG variants like 16-bit depth). The script doesn't wrap the call in try/catch, so a bad source PNG results in an unhandled rejection with no actionable error. Additionally, the script writes `OUT_PNG` and `OUT_ICO` unconditionally on every run — there's no idempotency check (mtime, hash) to skip if the source hasn't changed. Minor — for a build script invoked rarely, this is fine. But the unhelpful error message on failure (just a stack trace) is worth one line.

**Fix:**

```typescript
let ico: Buffer;
try {
  ico = await pngToIco(SRC_PNG);
} catch (e) {
  console.error(
    `Failed to convert ${SRC_PNG} to .ico: ${(e as Error).message}`,
  );
  console.error(
    `png-to-ico requires a square RGBA PNG, 8-bit depth. Re-export the source.`,
  );
  process.exit(1);
}
await writeFile(OUT_ICO, ico);
```

---

### IN-02: `audit.spec.ts` test #6 doesn't reset `data-theme` after each iteration — possible cross-test leakage if Playwright reuses the page context

**File:** `packages/desktop/tests/a11y/audit.spec.ts:165-188`
**Issue:** The for-loop sets `data-theme` on `document.documentElement` per iteration. Playwright's default config gives each `test(...)` its own page (unless `test.describe.serial` is used with shared state). But Test #7 (line 195) does `setAttribute("data-theme", "light")` in a separate test — fine because it gets a fresh page. The concern is forward-looking: if a test author later adds `test.describe.serial` for performance, the `data-theme` mutations leak between tests. Also, the `await page.waitForTimeout(200)` is brittle — CSS transitions are token-driven and instant in this codebase (no `transition` declarations on theme tokens), so 200ms is mostly slack. A better signal would be to use `page.evaluate(() => document.documentElement.getAttribute("data-theme"))` and assert it returned the new value, then proceed.

The `expect(actualTheme).toBe(theme)` assertion at line 178-181 already does this — but the `waitForTimeout(200)` AFTER it is the brittle bit.

**Fix (low priority):** Drop the `waitForTimeout` since the theme set is synchronous and there are no actual transition styles on `--rv-*` tokens:

```typescript
await page.evaluate((t) => {
  document.documentElement.setAttribute("data-theme", t);
}, theme);
const actualTheme = await page.evaluate(() =>
  document.documentElement.getAttribute("data-theme"),
);
expect(actualTheme).toBe(theme);
// No waitForTimeout — theme application is synchronous CSS variable cascade.
await auditPage(page, `theme-${theme}`, { exclude: ["svg .rd3t-link"] });
```

---

### IN-03: `requirements-edits.test.ts` regex tag-trigger assertion has multi-line `(?:\s*#[^\n]*\n)*` group that may not anchor as intended

**File:** `tests/release/requirements-edits.test.ts:74-76`
**Issue:** The pattern `/tags:\s*\n(?:\s*#[^\n]*\n)*\s*-\s*['"]v\[0-9\]\+\.\[0-9\]\+\.\[0-9\]\+['"]/` is missing the `s` flag and uses an explicit `\n` to traverse newlines, which is correct. The non-capturing group `(?:\s*#[^\n]*\n)*` consumes zero-or-more comment lines between `tags:` and the literal pattern line. This works for the current 4-comment-line block before the `- 'v[0-9]+...'` literal. But the regex is fragile against future changes:

- If a non-comment, non-empty line is inserted between `tags:` and the pattern (unlikely in YAML, but possible — e.g., a `# vim: ft=yaml` modeline is consumed by the comment group, but a stray blank line is consumed by `\s*` — fine).
- If someone reformats the YAML to inline-flow style `tags: ['v[0-9]+...']`, the regex breaks (no embedded newlines).

The test runs in CI on every push, so a YAML refactor that breaks the assertion would surface immediately. But the failure message would be opaque ("expected to match regex but didn't"). The B-03 fix value would be lost without a clearer error.

**Fix (low priority):** Use a simpler full-content substring assertion that's reformatting-resilient:

```typescript
// Stable-only regex: matches the literal pattern regardless of YAML formatting.
expect(releaseYml).toMatch(/^\s*-\s*['"]v\[0-9\]\+\.\[0-9\]\+\.\[0-9\]\+['"]\s*$/m);
expect(releaseYml).not.toMatch(/^\s*-\s*['"]v\*['"]\s*$/m);
```

The `m` flag anchors to line boundaries, so this matches the literal `- 'v[0-9]+.[0-9]+.[0-9]+'` line directly without trying to walk the comment block.

---

### IN-04: `release.yml` `softprops/action-gh-release@v2` still pinned only to major (I-03 from prior review remains open)

**File:** `.github/workflows/release.yml:108`
**Issue:** I-03 from `05-REVIEW.md` flagged `softprops/action-gh-release@v2` as not SHA-pinned. The post-audit work did not address this. Same for `actions/configure-pages@v5`, `actions/jekyll-build-pages@v1`, `actions/upload-pages-artifact@v3`, `actions/deploy-pages@v4`, `actions/setup-node@v4`, `oven-sh/setup-bun@v2`, and `actions/cache@v4`. The `actions/*` org is generally trusted, but `softprops/action-gh-release` and `oven-sh/setup-bun` are third-party. For a release workflow with `id-token: write` and `contents: write`, supply-chain hardening is the appropriate posture.

The disposition in `05-VERIFICATION.md` was "Defer — supply-chain hardening; track as backlog." That's still defensible for v1.0; flagging for completeness.

**Fix:** Pin third-party actions to commit SHAs once Dependabot is configured to auto-update them. No code change required for v1.0.

---

### IN-05: `installer-artifacts.test.ts` platform gating assumes `process.platform === "win32" | "linux"` covers all CI runners

**File:** `tests/release/installer-artifacts.test.ts:34-35`
**Issue:** The platform gating `const isWin = process.platform === "win32"` and `const isLinux = process.platform === "linux"` is correct for `windows-latest` (returns `"win32"`) and `ubuntu-latest` (returns `"linux"`). But running this test locally on macOS (`process.platform === "darwin"`) skips both blocks — both `describe.skipIf(!isWin)` and `describe.skipIf(!isLinux)` skip — and the test reports as "passed (0 assertions)" rather than "skipped (irrelevant platform)". Same for someone running on FreeBSD or other platforms. Not a release concern (CI matrix only runs the two platforms), but a developer running `bun run test:release` on macOS sees a green test that did nothing.

**Fix (cosmetic):** Add a top-level skip for non-CI macOS/other platforms:

```typescript
const isCIPlatform = isWin || isLinux;
if (!isCIPlatform && !isCI) {
  console.log(
    "[installer-artifacts] Skipped: test only runs on Windows/Linux. Current platform:",
    process.platform,
  );
}

describe.skipIf(!hasArtifacts || (!isCIPlatform && !isCI))(
  "Installer artifacts (PACK-01)",
  () => { ... }
);
```

---

_Reviewed: 2026-05-05_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
