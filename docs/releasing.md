---
title: Releasing
nav_order: 9
layout: default
---

# Releasing

## Prerequisites

- `gh` (authenticated), `claude` CLI, `bun`
- `mcp-publisher` from the [registry releases](https://github.com/modelcontextprotocol/registry/releases)
- npm account with 2FA, member of the `@roadraven` scope

## Steps

1. Merge the feature PRs.
2. Release branch and bump:
   ```bash
   git switch -c chore/release-X.Y.Z
   bun scripts/bump-version.ts X.Y.Z
   grep -rn "<previous version>" README.md docs/   # fix prose pins by hand
   ```
   Set the `## [X.Y.Z] - date` heading in `CHANGELOG.md`.
3. `bun run verify`, then commit `chore(release): bump version to X.Y.Z`.
4. `bun scripts/release-smoke.ts` (fresh install + upgrade from the previous tag in an isolated Claude config, running the app's update-toast commands). It upgrades to the committed `HEAD`, so run it after the bump commit; it refuses to run while the working tree's version differs from `HEAD`'s.
5. Open the PR, wait for green CI, merge.
6. Tag the merge commit (lightweight, like previous tags) and push:
   ```bash
   git switch master && git pull
   git tag vX.Y.Z && git push origin vX.Y.Z
   ```
7. Watch the Release workflow: `gh run watch`. It builds the installers, stages `@roadraven/mcp` (`npm stage publish`) and creates the GitHub release.
8. Approve the npm stage. Find the id in the run's "Publish @roadraven/mcp" log:
   ```bash
   npm stage approve <stage-id>     # 2FA; or approve on npmjs.com
   ```
9. Publish to the MCP Registry:
   ```bash
   cd plugins/claude-code
   mcp-publisher login github && mcp-publisher publish
   ```
10. Replace the GitHub release body with the CHANGELOG notes, including an "already on the plugin" section for users who only need `/plugin marketplace update`:
    ```bash
    gh release edit vX.Y.Z --notes-file notes.md
    ```
11. Verify, then announce:
    ```bash
    bun scripts/release-verify.ts
    ```

## Pitfalls

- Claude Code does not auto-update third-party marketplaces. Users need `/plugin marketplace update roadraven`, or auto-update enabled for it.
- Plugin `update` does not install newly added dependencies; call it out in the notes when a release adds one.
- `raw.githubusercontent.com` caches up to 5 minutes; a marketplace FAIL right after merge may just need a retry.
- The npm publish is stage-only by design: until step 8, `release-verify` reports npm FAIL.
