---
created: 2026-05-05T12:00:00Z
title: Re-enable Windows installer icon when Electrobun fixes rcedit baked-path bug
area: tooling
files:
  - packages/desktop/electrobun.config.ts
  - packages/desktop/scripts/build-icons.ts
  - packages/desktop/assets/icon.ico
  - packages/desktop/assets/icon.png
  - packages/desktop/src/mainview/assets/raven-logo.png
upstream:
  - https://github.com/blackboardsh/electrobun/issues/402
  - https://github.com/blackboardsh/electrobun/issues/235
  - https://github.com/blackboardsh/electrobun/pull/330
  - https://github.com/blackboardsh/electrobun/pull/311
  - https://github.com/blackboardsh/electrobun/issues/298
---

## Status

Deferred (cosmetic, not a blocker). Configuration is already in place per Electrobun docs (`build.win.icon`, `build.linux.icon` in electrobun.config.ts; assets/icon.ico, assets/icon.png generated from raven-logo.png via scripts/build-icons.ts). When upstream lands a real runtime-resolution fix, the icon should "just work" on the next `bun run build:canary` with no further changes from us.

## Problem

On Windows, Electrobun shells out to `rcedit` to embed the icon resource into launcher.exe, bun.exe, and the installer .exe. The Electrobun CLI is a Bun `--compile`'d binary, and Bun bakes module-resolution paths (both `import()` AND `require.resolve()`) at compile time. The CI runner's path (`D:\a\electrobun\electrobun\package\node_modules\rcedit\...`) gets frozen into the published binary. On developer machines without that path, rcedit silently fails with a Warning and the build continues without an icon — the resulting installer + installed app show generic Windows icons.

### Versions verified broken (end-to-end build)
- 1.16.0 — error: `spawn D:\a\electrobun\...\rcedit-x64.exe ENOENT`
- 1.18.1 (current pin) — error: `Cannot find module 'D:\a\electrobun\...\rcedit\package.json' from 'B:\~BUN\root\electrobun'`
- All 1.17.x betas affected per upstream issue #402

### Upstream state (snapshot 2026-05-05)
- **Issue #298** (closed Apr 19) — original report of the baked-CI-path bug. Claimed fixed by PR #311.
- **PR #311** (merged Apr 19) — switched `import('rcedit')` to `require.resolve('rcedit/package.json')`. Does NOT actually fix it because Bun `--compile` bakes both styles at compile time.
- **PR #330** (closed Apr 19, NOT merged) — proposed using `process.execPath` for runtime resolution. **This is the correct fix.** Maintainer YoavCodes rejected it in favor of #311.
- **Issue #402** (open since Apr 27, no maintainer response) — "Windows icon file still missing in v1.17.3-beta.12" — exact same bug as ours.
- **Issue #235** (open since Mar 1) — "Windows icon error Hardcoded Code".

## Solution

### Monitor and act when upstream responds

1. Watch issue #402 for maintainer response: https://github.com/blackboardsh/electrobun/issues/402
2. If silence continues past ~2 weeks (mid-May 2026), comment on #402 with our verification of the same bug in v1.18.1, linking PR #330's correct `process.execPath` approach.
3. When a working fix ships, bump `electrobun` in `packages/desktop/package.json`, run `bun install`, then `bun run --cwd packages/desktop build:canary`. Verify the patched .exe inside `artifacts/canary-win-x64-RoadRaven-Setup-canary.zip` shows the raven on the file thumbnail (extracted size should grow from ~425 KB to ~711 KB once the icon resource is embedded).

### Alternative paths if upstream stays unresponsive

- **Fork Electrobun**, apply PR #330's `process.execPath` patch (~10 LOC change in `package/src/cli/index.ts`), install from fork via git URL or npm tag. Lowest invasion, but adds fork-maintenance burden.
- **Artifact-rewrite postbuild**: decompress `artifacts/canary-win-x64-RoadRaven-canary.tar.zst` and `artifacts/canary-win-x64-RoadRaven-Setup-canary.zip`, run `rcedit` against `RoadRaven-Setup-canary.exe` and the inner `bin/launcher`, then repack. Heavy (~150 LOC, ~30s extra per build, ~265 MB per artifact).

### Rejected approaches — don't retry

- Patching the loose `build/canary-win-x64/RoadRaven-Setup-canary.exe` after Electrobun finishes: Electrobun cleans up the loose .exe; the user-distributable copies live inside `artifacts/`'s tar/zip. Tested on 2026-05-05 — patched copy was correct (711 KB) but never reached the distributable (which stayed at the un-patched 424,960 bytes).
- Bumping Electrobun version alone: same bug in 1.18.1 as 1.16.0 (verified end-to-end on 2026-05-05).

### Source PNG bump (do alongside re-enable)

Current source `packages/desktop/src/mainview/assets/raven-logo.png` is **100×100**. Best-practice Windows .ico needs 16/32/48/256 entries with a 256×256 minimum source. The currently generated .ico has only 32+48 entries; even when upstream is fixed, large-tile views in Explorer will look soft. When re-enabling the icon, also re-rasterize from a higher-res master (1024×1024 from the SVG would be cleanest), then re-run `bun run --cwd packages/desktop icons` to regenerate the .ico.
