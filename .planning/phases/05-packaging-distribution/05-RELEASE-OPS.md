# Phase 5 Release Operations Checklist

**Audience:** The human shipping v1.0.
**Status:** One-time setup BEFORE the first release tag is pushed.

> Per R-03: this project uses npm OIDC trusted publishing — there is **no
> `NPM_TOKEN` repo secret to manage**. The trade-off is a one-time setup at
> npmjs.com (per package). Per R-04 + Pitfall 4: GitHub Pages source must be
> flipped to "GitHub Actions" once via repo Settings.

---

## A. Pre-flight: confirm npm package names are available

BEFORE pushing the first `v*` tag, verify the canonical names are unclaimed
(or already owned by you on npmjs.com).

```bash
# Both commands MUST return either:
#   - 404 (package not yet published — claim it via release)
#   - YOUR account as the owner (already published in a prior session)
bunx npm view @roadraven/core
bunx npm view @roadraven/plugin-claude-code
```

If either name is owned by someone else: STOP. Pick a different scope or
contact the owner BEFORE tagging — the release workflow will fail with a 403
and you'll waste a tag burn.

## B. npmjs.com — Trusted Publishers config (per package, one-time)

1. Sign in to https://www.npmjs.com.
2. For each package (`@roadraven/core`, `@roadraven/plugin-claude-code`):
   a. Navigate to package settings → **Trusted Publishers**.
   b. **Add publisher → GitHub Actions**:
      - Repository owner: `Shuffzord`
      - Repository name: `RoadRaven`
      - Workflow filename: `release.yml`
      - Environment name: *(leave blank)*
   c. Save.
3. The first publish for a brand-new package name must be done as a "new
   package publish" — npm requires the publisher to bootstrap the package
   record. The `publish-npm-core` and `publish-npm-mcp` workflow jobs handle
   this on the first `v*` tag push as long as the names are unclaimed (Step A).

Reference: https://docs.npmjs.com/trusted-publishers

## C. GitHub Pages — flip source to "GitHub Actions" (one-time)

Required so the `deploy-docs` job in `release.yml` (Plan 05-03 Task 4) can
deploy. Without this, the Actions job runs successfully but
`https://shuffzord.github.io/RoadRaven/` returns 404.

1. Navigate to https://github.com/Shuffzord/RoadRaven/settings/pages
2. Under **Build and deployment** → **Source**, select **GitHub Actions**
   (NOT "Deploy from a branch").
3. Save. No further config needed.

Reference: RESEARCH.md Pitfall 4.

## D. First release dry-run (optional but recommended)

Before tagging `v1.0.0`, do a low-stakes dry-run with a smaller version:

```bash
# 1. Bump versions to a test version
bun scripts/bump-version.ts 0.0.2-test.1

# 2. Commit + tag
git add -A
git commit -m "chore: dry-run release v0.0.2-test.1"
git tag v0.0.2-test.1
git push --follow-tags

# 3. Watch the Actions tab — release.yml should run
# 4. Verify in npmjs.com that @roadraven/core and @roadraven/plugin-claude-code
#    appear with the test version
# 5. If anything failed: deprecate the test version on npm
bunx npm deprecate @roadraven/core@0.0.2-test.1 "test release"
bunx npm deprecate @roadraven/plugin-claude-code@0.0.2-test.1 "test release"

# 6. Bump back to the real version and tag for real
bun scripts/bump-version.ts 1.0.0
git add -A
git commit -m "release: v1.0.0"
git tag v1.0.0
git push --follow-tags
```

## E. Tag pattern reservation

| Pattern | Purpose | Status |
|---------|---------|--------|
| `v1.0.0`, `v1.0.1`, `v1.1.0` | Stable channel (this phase) | active |
| `v*-canary.*` (e.g., `v1.1.0-canary.1`) | Canary channel | RESERVED for v1.1 |
| `v*-test.*` (e.g., `v0.0.2-test.1`) | Pre-release dry-runs | available |

The release workflow `on.push.tags` matches `v*`. To avoid canary tags
accidentally going through stable in v1.0, the v1.1 canary work will narrow
the trigger to a regex like `v[0-9]+.[0-9]+.[0-9]+` (semver-strict). For
v1.0, we trust the human not to push canary tags.

## F. Post-release smoke checklist (every release)

1. https://github.com/Shuffzord/RoadRaven/releases — release exists with the
   Windows `.zip` and Linux `.tar.gz` attached + auto-generated release notes.
2. https://www.npmjs.com/package/@roadraven/core — new version listed with
   a "Provenance" badge.
3. https://www.npmjs.com/package/@roadraven/plugin-claude-code — same.
4. https://shuffzord.github.io/RoadRaven/ — site reflects the latest content
   (front-page version mention if you decide to add one).
5. Auto-updater manifest probe (after the first stable release, set this and
   run from any clean machine):
   ```bash
   RR_TEST_MANIFEST_URL="https://github.com/Shuffzord/RoadRaven/releases/latest/download/stable-win-x64-update.json" \
     bunx vitest run tests/release/manifest-url.test.ts
   ```
   Should exit 0 with the URL responding 200 + valid JSON.

## G. Failure recovery

| Failure | Recovery |
|---------|----------|
| npm publish fails with "package name unavailable" | Confirm Step A. Re-tag with a fresh patch version after fixing. |
| npm publish fails with "OIDC token verification failed" | Confirm Step B for the failing package; check workflow has `permissions: id-token: write` at workflow level. |
| `softprops/action-gh-release` fails with 403 | The workflow needs `permissions: contents: write` — confirm release.yml has it. |
| `bunx electrobun build` fails with "Failed to download electrobun CLI" | RESEARCH.md Pitfall 2 — Electrobun CLI binary downloaded post-install on first run; if the runner can't reach `github.com/blackboardsh/electrobun/releases`, it fails. Re-run the workflow; if persistent, pin to a different Electrobun version. |
| GH Pages deploy succeeds but site 404s | Confirm Step C (Pages source = "GitHub Actions"). |
| Release attached but installer file missing | `if-no-files-found: error` should have failed the build job — check the build logs for "no files matching the path were found." |

---

*Last updated: 2026-05-03 (initial creation, Phase 5 Plan 05-03)*
