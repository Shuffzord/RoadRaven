# Phase 5: Packaging & Distribution - Research

**Researched:** 2026-05-03
**Domain:** Cross-platform desktop installer production, npm publishing, GitHub Actions release automation, accessibility audit tooling, GitHub Pages docs hosting
**Confidence:** HIGH (Electrobun packaging surface, npm provenance, Just-the-Docs); MEDIUM (axe-core against bundled CEF webview); LOW (one critical assumption about Linux installer format requires CONTEXT correction — see §"Critical Finding")

## Summary

Phase 5 turns RoadRaven from "a working dev checkout" into a shippable v1.0: tag-triggered GitHub Actions builds Windows + Linux installers via Electrobun, attaches them to a GitHub Release, publishes `@roadraven/core` and `@roadraven/plugin-claude-code` to npm with provenance, deploys `docs/` to GitHub Pages, and ships a manual + automated accessibility audit pass against the production-built app.

The mechanics are well-trodden territory (the GH Actions release pattern is documented in Electrobun's official guide; npm provenance via OIDC went GA July 2025; Just-the-Docs is the lightest-touch GitHub Pages theme with sidebar navigation). The risk surfaces are: (1) **Electrobun does NOT produce native `.deb` files in v1.16.0** — Linux output is `.tar.gz` containing a self-extracting installer, NOT a Debian package. CONTEXT.md and REQUIREMENTS.md PACK-01 both assume `.deb`; the planner must reconcile this before writing tasks. (2) Accessibility tooling against a CEF-bundled production Electrobun build is not a paved path — `@axe-core/playwright` requires a Playwright-driven browser, and Electrobun has no documented Playwright integration for the bundled binary. The pragmatic v1 path is axe-core against the Vite production build served on a static port, with a documented caveat that the audit was not run against the final CEF-bundled binary.

**Primary recommendation:** Resolve the `.deb` mismatch first (planner consults user / discuss-phase). Then split this phase into 4 sequential waves: (1) workspace prep + npm package builds, (2) release workflow + CI core-deps gate, (3) docs site + CONTRIBUTING + README polish, (4) accessibility audit. Use **tsup** for `@roadraven/core` (one config, ESM-only, `.d.ts` included), **Just-the-Docs** for the docs site (Jekyll-based, native GitHub Pages support, has sidebar with zero JS config), **`@axe-core/playwright`** for the automated audit baseline (against `vite preview`, with a documented limitation for the CEF-bundled run), **GitHub Actions OIDC trusted publishing** for npm (no NPM_TOKEN needed), **softprops/action-gh-release** for installer attachment, and a **per-platform job** rather than a matrix (gives clearer log separation for two targets).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**npm package scope (PACK-04):**
- **D-01:** `@roadraven/react` is **deferred to v1.1** — drop from v1 publish list.
- **D-02:** `@roadraven/core` ships in v1 (real content; zero desktop deps).
- **D-03:** `@roadraven/core` is published as **pre-built ESM + `.d.ts`** in `dist/`, with `main`/`types`/`exports` updated and `src/` excluded via `files`.
- **D-04:** **Lockstep versioning** across `packages/desktop`, `packages/core`, `packages/react` (private), `plugins/claude-code`. One git tag per release.
- **D-05:** **Requirement edit (planner action):** Rewrite PACK-04 in REQUIREMENTS.md to (a) use `@roadraven/`, (b) drop `@roadraven/react` from v1, (c) keep "zero desktop dependencies in core, enforced in CI."

**Release & update hosting (PACK-01, PACK-02):**
- **D-06:** **GitHub Releases** is the distribution channel; auto-updater `version.json` URL must be stable. Choose between (a) release asset on latest stable Release, or (b) `gh-pages`-hosted `version.json` — Claude's discretion.
- **D-07:** v1.0 ships **Windows `.exe` and Linux `.deb` only**. macOS deferred to v1.1. *(See Critical Finding §A — `.deb` is not what Electrobun produces.)*
- **D-08:** **Requirement edit (planner action):** Rewrite PACK-01 to v1 = `.exe` + `.deb`; add macOS to v1.1; PROJECT.md "Out of Scope" gains macOS-v1 row.
- **D-09:** **Tag-triggered GitHub Actions release workflow** (`.github/workflows/release.yml`) on `v*` tag. Matrix: `windows-latest` builds `.exe`; `ubuntu-latest` builds `.deb`. npm publish job for `@roadraven/core` at the same tag.
- **D-10:** **Stable channel only in v1.0.** Canary deferred to v1.1. `Updater.localInfo.channel()` continues unchanged (returns "stable" for tagged builds, "dev" for unbundled).
- **D-11:** **Requirement edit (planner action):** Rewrite PACK-02 to "stable channel" for v1; document canary as v1.1 follow-up. Reserve tag pattern `v*-canary.*` for canary.

**Code signing (PACK-01, README):**
- **D-12:** Windows `.exe` ships **unsigned** in v1.0. Document SmartScreen "More info → Run anyway" bypass in README.
- **D-13:** Linux `.deb` ships **unsigned** in v1.0. Document `sudo dpkg -i` install steps.
- **D-14:** **Out of Scope (PROJECT.md edit):** Add row "Code signing for v1.0 (Windows Authenticode, Linux GPG, macOS notarization) — deferred."

**Documentation surface (PACK-05):**
- **D-15:** **GitHub Pages serves `docs/`** in v1.0. Pick simplest config (Jekyll/MkDocs/Just-the-Docs) — Claude's discretion.
- **D-16:** **Plugin authoring guide covers Event API integration only** in v1. Document WebSocket protocol, event contract `{ nodeId, status, meta?, source? }`, sentinel-file discovery, error/toast surfaces, `plugins/claude-code/` as worked example. Honest framing: "v1.0 ships Event API; smart-adapter plugin system is v1.1."
- **D-17:** **`CONTRIBUTING.md` at repo root.** Local setup, tests, code style, branch/PR conventions, pointer to `docs/development-guide.md`.
- **D-18:** **README polish.** Per-platform install instructions, "First run on Windows" section, link to docs site, Contributing section, feature-status block (v1 vs v1.1).

**Accessibility audit (PACK-06):**
- **D-19:** **Manual checklist + automated baseline.** Tool choice: axe-core CLI vs Playwright + `@axe-core/playwright` vs Lighthouse — Claude's discretion.
- **D-20:** Document audit as `05-A11Y-AUDIT.md`. Pass criterion: zero severity-blocker findings.

**MCP wrapper publication:**
- **D-21:** **`@roadraven/plugin-claude-code` published to npm** at lockstep version. Already has `bin: roadraven-mcp`. Flip `private: false`. End users install with `npx -y @roadraven/plugin-claude-code`.

**CI / fallow gate:**
- **D-22:** **Do not enable fallow CI gate** in this phase. Leave commented placeholder. Note in CONTRIBUTING.md that contributors can run `bunx fallow audit --changed-since=HEAD` locally.
- **D-23:** **Add CI invariant for `packages/core` zero-desktop-deps.** Small CI step that fails if `packages/core/package.json` `dependencies` contains anything other than the allowed list (currently `zod`).

**Schema version field:**
- **D-24:** **No new schema version field work** in this phase.

### Claude's Discretion
- Build tool for `@roadraven/core` (tsup vs `tsc -p tsconfig.build.json` vs `bun build`).
- GitHub Pages tooling (Jekyll, MkDocs, Just-the-Docs, raw HTML).
- `version.json` URL strategy (release asset vs `gh-pages` branch).
- Tag pattern for stable releases (`v1.0.0` vs `vX.Y.Z` — semver).
- GitHub Actions matrix syntax + runner pinning.
- Accessibility audit tool choice (axe-core CLI, Playwright + `@axe-core/playwright`, Lighthouse).
- Linux `.deb` distro target (Ubuntu LTS + Debian compat). *(Moot if Electrobun output is not `.deb`.)*
- LICENSE file placement (root + per-package vs root only).
- Whether to include SECURITY.md and CODE_OF_CONDUCT.md.
- Specific release-flow tooling (changesets vs hand-rolled bun script vs `npm version`).
- Whether to enable npm provenance (`--provenance`).
- Whether to wire docs site build into release workflow or separate `pages.yml`.
- `.gitignore` additions for build artifacts.

### Deferred Ideas (OUT OF SCOPE)
- macOS `.dmg` build, signing, notarization (v1.1).
- Canary release channel (v1.1; tag pattern `v*-canary.*` reserved).
- `@roadraven/react` component package (v1.1+; requires extracting React components from `packages/desktop/`).
- Authenticode signing of Windows `.exe` (v1.1+).
- GPG signing of Linux `.deb` + apt repository (v1.1+).
- Self-hosted release infrastructure (S3/R2/CDN) (v1.1+).
- Dedicated documentation site (Astro/Starlight/VitePress) (v1.1+).
- Telemetry, crash reporting, analytics in installers (out of scope, not deferred).
- fallow CI gate (informational; gated on post-GSD dead-code cleanup).
- Schema migration tooling `@roadraven/core` migrator (v3.0).
- Plugin authoring SDK (real `RoadmapPlugin` interface, lifecycle, secrets) (v1.1).
- Code of Conduct + SECURITY.md (small OSS hygiene; planner may include if cheap).
- Auto-updater offline / failure UX polish (future phase).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **PACK-01** | Native installers: macOS `.dmg`, Windows `.exe`, Ubuntu `.deb` | §"Critical Finding" + §"Standard Stack" — Electrobun produces `.exe` (in `.zip`) and Linux self-extracting `.tar.gz`, NOT native `.deb`. Per D-07/D-08, macOS deferred. Per D-08 the requirement gets rewritten in this phase. The planner must also reconcile `.deb` vs `.tar.gz` with the user. |
| **PACK-02** | Electrobun auto-updater configured (canary + stable channels) | §"Auto-Updater & version.json" — Electrobun manifest naming pattern `{channel}-{os}-{arch}-update.json` resolved against `release.baseUrl`. D-10/D-11: stable only in v1; rewrite requirement. |
| **PACK-03** | Linux: `bundleCEF: true` + keyboard-reachable file actions + `process.on('SIGTERM', flushWriteQueue)` | **Already satisfied in code.** Verified `electrobun.config.ts:5,19-21` (bundleCEF on all platforms) and `packages/desktop/src/bun/index.ts:205-212` (SIGTERM handler awaits `flushPending`). Phase 5 task: regression test only. |
| **PACK-04** | npm packages `@roadraven/core` and `@roadraven/react` published; `react`, `react-dom`, `react-d3-tree` as `peerDependencies`; peer deps externalized in Vite library build; `packages/core` zero desktop deps (CI-enforced) | §"Standard Stack" → tsup. §"CI Allowlist Script". Per D-01/D-05: drop `@roadraven/react`; per D-23 add core-deps allowlist CI step. Requirement gets rewritten in this phase. |
| **PACK-05** | README, docs site, contribution guide | §"GitHub Pages with Just-the-Docs", §"README polish patterns", §"Plugin authoring guide structure". |
| **PACK-06** | Accessibility audit passes: keyboard nav, ARIA roles on context menu and modal dialogs, color not sole status indicator, focus indicators visible | §"Accessibility Audit Tooling" — recommend Playwright + `@axe-core/playwright` against `vite preview` (production-built renderer, not Vite dev server) + manual checklist. CEF-bundled-binary audit is not a paved path; documented caveat. |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

| Directive | Source | Phase 5 Implication |
|-----------|--------|---------------------|
| **Electrobun, NOT Electron** | `CLAUDE.md` line 11 | All build/release tooling targets `electrobun build`. No Electron Builder, electron-forge, electron-updater. Auto-updater is Electrobun's `Updater` API, not `electron-updater`. |
| **Use `bun`/`bunx`, not `npm`/`npx`/`yarn`/`pnpm`** | `CLAUDE.md` line 13 | Local dev + CI install steps use `bun install`. **Single exception:** `npm publish` (the npm CLI is the only registry client with first-class provenance support). The planner should label this exception explicitly so contributors don't think it's a regression. |
| **`bun run test*`, never `bunx vitest` direct** | `CLAUDE.md` lines 33-37 | Phase 5 CI verification jobs use `bun run test`, `bun run verify`. |
| **Use only `--rv-*` CSS tokens; no hardcoded colors** | `docs/development-guide.md` Conventions | Accessibility audit verifies tokens hold up in production CSS bundle (especially high-contrast theme). |
| **Use LogTape, not `console.log`** | Same | If Phase 5 adds runtime code (probably none — release artifacts only), use `roadraven.release.*` category. |

## Critical Finding

### A. Electrobun does NOT produce native `.deb` packages

**The conflict:** Both REQUIREMENTS.md PACK-01 and CONTEXT.md (D-07, D-08, code_context Integration Points, README Linux install instructions) assume Phase 5 produces a `.deb` installer. **Electrobun v1.16.0 does not produce `.deb` files.**

**Verified via:**
- `[CITED: blackboard.sh/electrobun/docs/guides/bundling-and-distribution]` — Linux artifact pattern is `{channel}-linux-x64-{AppName}Setup-{channel}.tar.gz` (a self-extracting tarball, NOT a Debian package).
- `[CITED: blackboardsh/electrobun GitHub README]` — "Windows and Linux installers are distributed as archives (.zip and .tar.gz respectively)." No `.deb`/`.rpm`/`.AppImage` formats are mentioned in any official Electrobun documentation page reviewed.
- `[VERIFIED: gh api repos/blackboardsh/electrobun/releases/latest]` — Electrobun's own release artifacts are all `.tar.gz`. The product never ships `.deb` itself.
- `[CITED: blackboard.sh/electrobun/docs/apis/cli/build-configuration]` — The `linux{}` config block lists `bundleCEF`, `defaultRenderer`, `chromiumFlags`, `icons` — no fields for `.deb` packaging metadata (no `maintainer`, `description`, `depends`, etc. that a `.deb` packager would need).

**Three resolution paths the planner can offer the user:**

1. **Ship the `.tar.gz` self-extracting setup as-is** (Electrobun-native). README documents `tar -xzf RoadRavenSetup.tar.gz && cd ... && ./RoadRavenSetup` install flow. Update PACK-01 + PROJECT.md to reflect `.tar.gz` instead of `.deb`. **Lowest cost. Recommended for v1.0.**
2. **Wrap the `.tar.gz` output in a `.deb` post-build hook** using `dpkg-deb --build` in the `postPackage` script. The `.deb` would just unpack the same self-extracting bundle and run a postinst script to extract it. Adds `.deb` infrastructure cost (Debian control file template, dependency declarations, FHS-compliant install paths inside the `.deb` — `/opt/RoadRaven/` is conventional) for a marginal UX improvement (`sudo apt install ./roadraven.deb` vs `tar -xzf && ./setup`).
3. **Defer Linux to v1.1** alongside macOS. Leaves only Windows `.exe` (well, `.zip` containing `-Setup.exe`) for v1.0 — narrows the surface but contradicts D-07's explicit "Windows + Linux only."

The user picked Linux explicitly (D-07) so option 3 is unlikely to be acceptable. Option 1 is the lowest-friction match for "ship v1.0" with documented install steps. Option 2 is the highest-fidelity match for the original intent ("dpkg -i UX") but burns engineering time on packaging that Electrobun was not designed to support.

**This decision must be made before Wave 1 task generation.** Recommend the planner surface this as a discuss-phase question to the user. For the rest of this research document, both `.exe` and `.tar.gz` are treated as the v1 Linux target (option 1), with option 2 noted as the upgrade path.

### B. Windows installer is also wrapped — `-Setup.exe` lives inside a `.zip`

**Verified via:** `[CITED: blackboard.sh/electrobun/docs/guides/bundling-and-distribution]` — pattern is `{channel}-win-x64-{AppName}-Setup-{channel}.zip` (a `.zip` containing `-Setup.exe`).

**Implication:** The README "First run on Windows" instructions need to say "download the `.zip`, extract, double-click `RoadRaven-Setup.exe`, click through SmartScreen warning." Not just "download the `.exe`." Small detail but matters for the SmartScreen UX (D-12).

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| **electrobun** | 1.16.0 (already installed) | Cross-platform desktop packaging + auto-updater | Already in use; no alternative. `[VERIFIED: node_modules/.bun/electrobun@1.16.0/node_modules/electrobun/package.json]` |
| **tsup** | 8.5.1 (latest) | Build `@roadraven/core` ESM + `.d.ts` from TypeScript | Zero-config (one CLI flag), powered by esbuild (fast), handles `.d.ts` generation natively, single command instead of tsc + dts-bundle-generator dance. `[VERIFIED: registry.npmjs.org/tsup 2026-05-03]` |
| **softprops/action-gh-release** | v2 (currently maintained) | Create GitHub Release + attach installer artifacts | Most-used GitHub Action for release attachment; supports glob expressions, prerelease flag, idempotent (updates existing release on re-run). `[CITED: github.com/softprops/action-gh-release]` |
| **just-the-docs** (Jekyll gem) | 0.12.0 (latest) | GitHub Pages docs theme with sidebar navigation | Lightest-touch path to a docs site with sidebar. Native Jekyll = native GitHub Pages support (no separate build action required if using "Deploy from a branch" mode). Supported as a remote_theme. `[VERIFIED: rubygems.org/gems/just-the-docs 2026-01-23]` |
| **@axe-core/playwright** | 4.11.3 (latest) | Automated accessibility baseline against built renderer | Best signal-to-noise; integrates with Playwright (already a project devDep at `@playwright/test ^1.59.1`); supports WCAG2 AA tag filtering. `[VERIFIED: registry.npmjs.org/@axe-core/playwright 2026-05-03]` |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| **@axe-core/cli** | 4.11.3 | Alternative CLI-only audit | Fallback if Playwright integration with `vite preview` proves brittle in CI. Runs as `bunx @axe-core/cli http://localhost:4173 --tags wcag2aa`. `[VERIFIED: registry.npmjs.org/@axe-core/cli 2026-05-03]` |
| **actions/configure-pages** | v5 | Configure Pages context for GitHub Actions deploy path | Required if going the Actions-driven Pages deploy route (recommended over branch-based "build from /docs" for Just-the-Docs because it ensures Jekyll plugin support is consistent). |
| **actions/jekyll-build-pages** | v1 | Build Jekyll site in CI | Pairs with `actions/configure-pages` and `actions/upload-pages-artifact`. |
| **actions/upload-pages-artifact** | v3 | Upload built site as Pages artifact | Standard Pages artifact upload. |
| **actions/deploy-pages** | v4 | Deploy Pages artifact to live site | Final step in the Pages deploy job. |
| **oven-sh/setup-bun** | v2 (already used in `ci.yml`) | Set up Bun in CI runners | Already used; reuse for release workflow. `[VERIFIED: .github/workflows/ci.yml:14-16]` |
| **actions/setup-node** | v4 | Set up Node + register `npmrc` for npm publish | Required for `npm publish --provenance` (npm CLI v9.5.0+; Node 18+ default). |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| **tsup** | `tsc -p tsconfig.build.json` | tsc requires extra config (`composite`/`declaration`/`outDir`/`rootDir`), produces `.d.ts` per source file (need an extra step to bundle if desired), no esbuild speed advantage. **For a single-entry ESM-only package with one dependency (zod), tsc would also work in ~10 lines of config — picking tsup for the smaller package.json `scripts` entry and standard library-author conventions.** |
| **tsup** | `bun build src/index.ts --target node --outdir dist` | `bun build` does not emit `.d.ts` files (must be paired with separate tsc run). **Same number of moving parts as tsc — tsup wins on simplicity.** |
| **Just-the-Docs** | MkDocs (Material) | MkDocs Material is prettier and has better navigation UX, but requires Python in CI, a custom build action, and is overkill for ~6 markdown files. |
| **Just-the-Docs** | Raw HTML / no theme | No sidebar, no navigation — fails the "sidebar navigation without yak-shaving" criterion in the user's research focus item #5. |
| **Just-the-Docs** | Astro / Starlight / VitePress | Explicitly deferred (D-deferred) as v1.1+. |
| **`@axe-core/playwright`** | Lighthouse | Lighthouse CLI requires a running Chrome instance; couples to Chromium devtools protocol. Not a clean fit for an Electrobun WKWebView/CEF target. The accessibility audit would mostly cover the rendered HTML+CSS+ARIA, which is what axe-core does directly. |
| **`@axe-core/playwright`** | `@axe-core/cli` standalone | CLI is simpler but the project already depends on Playwright — reuse the harness. Picking Playwright variant. |
| **OIDC trusted publishing** | NPM_TOKEN classic | Trusted publishing eliminates the long-lived secret rotation burden, gives free provenance attestation, GA since July 2025. Worth the 5-minute npm.com setup. `[CITED: github.blog/changelog/2025-07-31-npm-trusted-publishing-with-oidc-is-generally-available]` |
| **softprops/action-gh-release** | `gh release create` directly via `gh` CLI | `gh` CLI works fine; the action is just a thin wrapper. Action wins on idempotency (re-running the workflow updates the existing release rather than failing). |
| **Per-platform jobs** | Matrix strategy | Two targets (windows-latest, ubuntu-latest) is small enough that a matrix saves ~10 lines of YAML at the cost of mixing logs from both runners in the matrix view. **Per-platform jobs recommended for v1.0 — clearer logs when an installer build fails.** |

**Installation deltas (planner reference):**

```bash
# packages/core devDependencies
bun add -D --cwd packages/core tsup typescript

# Workspace root devDependencies (if axe-core/playwright route picked)
bun add -D @axe-core/playwright

# packages/core production dependency invariant
# packages/core/package.json `dependencies` MUST contain only: zod
# Enforced by CI script (see §"CI Allowlist Script")
```

**Version verification (CRITICAL — confirm before adding to package.json):**

```bash
bun pm view tsup version              # Confirm 8.5.1 still latest
bun pm view @axe-core/playwright version  # Confirm 4.11.3 still latest
bun pm view @axe-core/cli version     # Confirm 4.11.3 still latest
```

`[VERIFIED 2026-05-03]` — All three packages above were confirmed against the npm registry today.

## Architecture Patterns

### Recommended Project Structure (post-Phase 5)

```
RoadRaven/
├── .github/
│   └── workflows/
│       ├── ci.yml                     # EXISTING — PR gate (lint/typecheck/test)
│       │                              # ADD: core-deps allowlist step (D-23)
│       ├── release.yml                # NEW — tag-triggered installer + npm publish
│       └── pages.yml                  # NEW — docs site deploy (or fold into release.yml)
├── docs/
│   ├── _config.yml                    # NEW — Jekyll config (Just-the-Docs theme)
│   ├── index.md                       # NEW — landing page (or symlink/copy README)
│   ├── architecture-overview.md       # EXISTING (front matter added: parent, nav_order)
│   ├── design-system.md               # EXISTING (front matter added)
│   ├── development-guide.md           # EXISTING (front matter added)
│   ├── logging.md                     # EXISTING (front matter added)
│   ├── rpc-and-ipc.md                 # EXISTING (front matter added)
│   └── plugin-authoring.md            # NEW — Event API guide with claude-code worked example
├── packages/
│   ├── core/
│   │   ├── package.json               # MODIFIED — flip private:false, add build script,
│   │   │                              # add main/types/exports/files pointing to dist/
│   │   ├── tsup.config.ts             # NEW — minimal tsup config
│   │   ├── README.md                  # NEW — short package description for npm tarball
│   │   ├── LICENSE                    # NEW — MIT, copy of root LICENSE
│   │   ├── src/
│   │   │   ├── index.ts               # EXISTING — public API surface (no change)
│   │   │   ├── plugin.ts              # EXISTING
│   │   │   └── schema.ts              # EXISTING
│   │   └── dist/                      # GENERATED — index.js + index.d.ts, gitignored
│   ├── desktop/
│   │   ├── electrobun.config.ts       # MODIFIED — bump version per release; add release.baseUrl
│   │   └── package.json               # MODIFIED — add build:stable script (mirrors build:canary)
│   └── react/                         # UNCHANGED — stays private:true in v1
├── plugins/
│   └── claude-code/
│       ├── package.json               # MODIFIED — flip private:false, add files/, add LICENSE
│       ├── README.md                  # EXISTING — already excellent
│       └── LICENSE                    # NEW
├── scripts/
│   └── check-core-deps.ts             # NEW — CI script enforcing core dep allowlist (D-23)
├── CONTRIBUTING.md                    # NEW
├── LICENSE                            # NEW (MIT, repo root) — copied into each tarball
├── README.md                          # MODIFIED — install instructions, feature-status block
└── .gitignore                         # MODIFIED — add packages/core/dist/, artifacts/
```

### Pattern 1: Lockstep Version Bumping (D-04)

**What:** Every release advances `version` in `packages/desktop/package.json`, `packages/core/package.json`, `packages/react/package.json`, `plugins/claude-code/package.json`, AND `packages/desktop/electrobun.config.ts` `app.version` to the same value, in one commit, then tag.

**When to use:** Every Phase 5+ release.

**Recommended mechanism (simplest that prevents drift):** A single bun script `scripts/bump-version.ts`:

```typescript
// scripts/bump-version.ts
// Usage: bun scripts/bump-version.ts 1.0.0
// [ASSUMED: this is the simplest path; user may prefer changesets if they
//  expect to drift package versions later — flag for discuss-phase]
import { readFileSync, writeFileSync } from "node:fs";
const newVersion = process.argv[2];
if (!newVersion?.match(/^\d+\.\d+\.\d+(-[a-z0-9.]+)?$/)) {
  console.error(`Invalid version: ${newVersion}. Expected semver e.g. 1.0.0`);
  process.exit(1);
}
const targets = [
  "packages/desktop/package.json",
  "packages/core/package.json",
  "packages/react/package.json",
  "plugins/claude-code/package.json",
];
for (const path of targets) {
  const pkg = JSON.parse(readFileSync(path, "utf8"));
  pkg.version = newVersion;
  writeFileSync(path, JSON.stringify(pkg, null, "\t") + "\n");
}
// Bump electrobun.config.ts app.version (string replace — small file, one match)
const cfgPath = "packages/desktop/electrobun.config.ts";
const cfg = readFileSync(cfgPath, "utf8");
const updated = cfg.replace(
  /version:\s*"[^"]+"/,
  `version: "${newVersion}"`
);
writeFileSync(cfgPath, updated);
console.log(`Bumped all packages + electrobun.config.ts to ${newVersion}`);
console.log(`Next: git commit -am "release: v${newVersion}" && git tag v${newVersion} && git push --follow-tags`);
```

**Anti-pattern:** Hand-bumping each file individually invites drift. A 3-line Bash one-liner like `sed -i 's/"0.0.1"/"0.1.0"/g' **/package.json` over-matches (catches dependency `^0.0.1` ranges).

**Alternatives considered:**
- **changesets** — overkill for lockstep (its value is independent versioning); adds workspace tooling and a `.changeset/` directory.
- **`npm version`** — works per-package but doesn't touch `electrobun.config.ts`.
- **bun script (above)** — simplest. Recommended.

### Pattern 2: tsup config for `@roadraven/core`

**What:** Single-file config that emits `dist/index.js` + `dist/index.d.ts` from `src/index.ts`.

**Source:** `[CITED: tsup.egoist.dev]` + verified npm package `[VERIFIED: registry.npmjs.org/tsup 8.5.1]`

```typescript
// packages/core/tsup.config.ts
import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],            // ESM only — Node ESM consumers are the target
  dts: true,                  // Emit .d.ts
  clean: true,                // Wipe dist/ before each build
  sourcemap: true,
  target: "node20",           // Match the project's Node baseline (Bun is fine with ES2022+)
  external: ["zod"],          // Zod is a peer-style runtime dep — keep external
  outDir: "dist",
  splitting: false,           // Single-entry; no code splitting needed
  treeshake: true,
});
```

**Resulting `packages/core/package.json` deltas:**

```json
{
  "name": "@roadraven/core",
  "version": "1.0.0",
  "private": false,
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "files": ["dist", "README.md", "LICENSE"],
  "scripts": {
    "build": "tsup",
    "prepublishOnly": "bun run build"
  },
  "dependencies": {
    "zod": "^4.3.6"
  },
  "devDependencies": {
    "tsup": "^8.5.1",
    "typescript": "^6.0.2"
  },
  "publishConfig": {
    "access": "public",
    "provenance": true
  },
  "repository": {
    "type": "git",
    "url": "git+https://github.com/Shuffzord/RoadRaven.git",
    "directory": "packages/core"
  },
  "license": "MIT",
  "homepage": "https://shuffzord.github.io/RoadRaven/",
  "bugs": "https://github.com/Shuffzord/RoadRaven/issues"
}
```

**Notes:**
- `publishConfig.provenance: true` is the package.json equivalent of the `--provenance` CLI flag — makes provenance the default on every publish.
- `repository.directory: "packages/core"` is the npm convention for monorepo subpackages — links the npm page back to the right folder on GitHub.
- `prepublishOnly` (NOT `prepublish`, which is deprecated) ensures `dist/` is fresh before publish, even if a contributor forgets to run `bun run build`.
- `peerDependencies` is NOT needed for `@roadraven/core` — `zod` is a regular runtime dependency. (Per CONTEXT.md "currently `zod` only" allowlist, that's correct.)

### Pattern 3: Release workflow shape (one job per platform + one npm publish job)

**What:** `release.yml` triggered on `v*` tag push, with three jobs running in parallel: `build-windows`, `build-linux`, `publish-npm`. Plus a separate `pages.yml` (or a fourth job in `release.yml`) that deploys docs.

**Why per-platform jobs over matrix:** Two targets is small; matrix would obscure per-OS log streams. Per-platform makes "Windows installer broke, Linux installer fine" obvious in the GitHub Actions UI. (See "Alternatives Considered" above.)

**Source:** `[CITED: blackboard.sh/electrobun/docs/guides/updates]` + `[CITED: docs.npmjs.com/generating-provenance-statements]` + `[CITED: github.com/softprops/action-gh-release]`

```yaml
# .github/workflows/release.yml
name: Release

on:
  push:
    tags:
      - 'v*'    # Stable: v1.0.0, v1.0.1, v1.1.0
                # (Reserved for v1.1: 'v*-canary.*' — out of scope this phase)

# All jobs that publish or upload need explicit permissions (least-privilege).
permissions:
  contents: write    # gh release create + asset upload
  id-token: write    # OIDC token mint for npm provenance

jobs:
  build-windows:
    name: Build Windows installer
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest
      - name: Install workspace dependencies
        run: bun install
      - name: Build webview bundle
        run: bun run --cwd packages/desktop build
      - name: Build Windows installer (stable channel)
        # Verified: electrobun build --env=stable produces
        # artifacts/stable-win-x64-RoadRaven-Setup.zip (which contains -Setup.exe)
        run: bunx electrobun build --env=stable
        working-directory: packages/desktop
      - name: Upload installer + update manifest
        uses: actions/upload-artifact@v4
        with:
          name: windows-installer
          path: |
            packages/desktop/artifacts/stable-win-x64-*.zip
            packages/desktop/artifacts/stable-win-x64-update.json
            packages/desktop/artifacts/stable-win-x64-*.tar.zst
          if-no-files-found: error

  build-linux:
    name: Build Linux installer
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest
      - name: Install workspace dependencies
        run: bun install
      - name: Build webview bundle
        run: bun run --cwd packages/desktop build
      - name: Build Linux installer (stable channel)
        # Verified: produces artifacts/stable-linux-x64-RoadRavenSetup.tar.gz
        # NOT a .deb — see "Critical Finding §A". Planner must reconcile.
        run: bunx electrobun build --env=stable
        working-directory: packages/desktop
      - name: Upload installer + update manifest
        uses: actions/upload-artifact@v4
        with:
          name: linux-installer
          path: |
            packages/desktop/artifacts/stable-linux-x64-*.tar.gz
            packages/desktop/artifacts/stable-linux-x64-update.json
            packages/desktop/artifacts/stable-linux-x64-*.tar.zst
          if-no-files-found: error

  github-release:
    name: Create GitHub Release with installers
    needs: [build-windows, build-linux]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/download-artifact@v4
        with:
          path: artifacts
          merge-multiple: true
      - name: Create release and attach artifacts
        uses: softprops/action-gh-release@v2
        with:
          files: artifacts/**
          draft: false
          prerelease: false
          generate_release_notes: true
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

  publish-npm-core:
    name: Publish @roadraven/core to npm
    needs: [build-windows, build-linux]    # Only publish if installer builds passed
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          registry-url: 'https://registry.npmjs.org'
      - run: bun install
      - run: bun run --cwd packages/core build
      # When using OIDC trusted publishing (configured at npmjs.com), no
      # NODE_AUTH_TOKEN is needed. provenance attestation is automatic.
      # If trusted publishing is NOT configured, fall back to NPM_TOKEN secret
      # and add `env: { NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }} }` below.
      - run: npm publish --access public --provenance
        working-directory: packages/core

  publish-npm-mcp:
    name: Publish @roadraven/plugin-claude-code to npm
    needs: [build-windows, build-linux]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          registry-url: 'https://registry.npmjs.org'
      - run: bun install
      - run: bun run --cwd plugins/claude-code build
      - run: npm publish --access public --provenance
        working-directory: plugins/claude-code

  deploy-docs:
    name: Deploy docs site to GitHub Pages
    needs: [github-release]
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pages: write
      id-token: write
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/configure-pages@v5
      - uses: actions/jekyll-build-pages@v1
        with:
          source: ./docs
          destination: ./_site
      - uses: actions/upload-pages-artifact@v3
      - id: deployment
        uses: actions/deploy-pages@v4
```

**Notes:**
- `permissions:` block is at workflow level so all jobs inherit it; `deploy-docs` overrides with the additional `pages: write`. Without `id-token: write`, npm provenance fails at the OIDC token mint step.
- `npm publish --provenance` requires npm CLI 9.5.0+ (`actions/setup-node@v4` ships Node 22, npm 10+, satisfies). `[CITED: docs.npmjs.com/generating-provenance-statements]`
- `softprops/action-gh-release@v2` is idempotent: re-running the workflow updates the existing release rather than failing on "tag already exists."
- The `bun run --cwd packages/desktop build` step is needed because `electrobun build` expects the Vite bundle in `packages/desktop/dist/` (the `copy:` config in `electrobun.config.ts` references `dist/index.html` and `dist/assets`).
- `bunx electrobun build` resolves to the platform-native CLI binary downloaded by the npm postinstall script (verified in `node_modules/.bun/electrobun@1.16.0/.../bin/electrobun.cjs`). On a fresh runner, the first `bunx electrobun` call downloads `electrobun-cli-{win,linux}-x64.tar.gz` from Electrobun's GitHub releases — this adds ~30s to the cold path but no other setup is needed.
- The `deploy-docs` job depends on `github-release` so the docs only update if the release succeeded — keeps docs in sync with shipped binaries. **Alternatively**, deploy docs on every push to `master` (separate `pages.yml`) for faster docs iteration. **Recommended:** keep coupled to release for v1.0; revisit if docs PRs become frequent.

**One-time setup the user must do at npmjs.com (not in this workflow):**
1. Sign in to npmjs.com.
2. For each package (`@roadraven/core`, `@roadraven/plugin-claude-code`):
   - Settings → "Trusted Publishers" → Add publisher → GitHub.
   - Repository: `Shuffzord/RoadRaven`. Workflow: `release.yml`. Environment: (leave blank).
3. After this is configured, `npm publish` from the workflow above just works without `NODE_AUTH_TOKEN`. `[CITED: docs.npmjs.com/trusted-publishers]`

If trusted publishing is NOT configured, add `NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}` to the publish step's env, and create an automation token at npmjs.com → Access Tokens.

### Pattern 4: GitHub Pages with Just-the-Docs (D-15)

**What:** Add `_config.yml` to `docs/`, add front matter to existing markdown files, configure repo Pages settings to "GitHub Actions" source.

**Source:** `[CITED: just-the-docs.com/docs/configuration]` + `[VERIFIED: rubygems.org/gems/just-the-docs 0.12.0 2026-01-23]`

```yaml
# docs/_config.yml
title: RoadRaven
description: Keyboard-first desktop editor for visual roadmap trees
remote_theme: just-the-docs/just-the-docs
url: https://shuffzord.github.io
baseurl: /RoadRaven                # Repo name; Pages serves at https://shuffzord.github.io/RoadRaven

# Just-the-Docs settings
search_enabled: true
heading_anchors: true
nav_enabled: true

color_scheme: dark                 # matches RoadRaven's default dark theme
logo: /assets/logo.png             # optional; only if a logo asset exists

# Plugins (GitHub Pages allows these by default)
plugins:
  - jekyll-remote-theme

# Aux links (top-right corner)
aux_links:
  GitHub: https://github.com/Shuffzord/RoadRaven
  npm @roadraven/core: https://www.npmjs.com/package/@roadraven/core

aux_links_new_tab: true

# Footer
footer_content: 'RoadRaven is MIT-licensed. <a href="https://github.com/Shuffzord/RoadRaven/blob/master/LICENSE">License</a>.'

# Exclude
exclude:
  - vendor
  - "*.gemspec"
  - Gemfile
  - Gemfile.lock
```

**Front matter to add to each existing `docs/*.md`:**

```markdown
---
title: Architecture Overview
nav_order: 2
---
# Architecture Overview
... (existing content) ...
```

**Suggested `nav_order` per page:**
| File | nav_order |
|------|-----------|
| `index.md` (new — landing page) | 1 |
| `architecture-overview.md` | 2 |
| `development-guide.md` | 3 |
| `rpc-and-ipc.md` | 4 |
| `design-system.md` | 5 |
| `logging.md` | 6 |
| `plugin-authoring.md` (NEW) | 7 |

**Anti-pattern:** Don't try to use Just-the-Docs as a local gem (`gem 'just-the-docs'` in a Gemfile) — `remote_theme` is simpler, requires no Gemfile, and is GitHub Pages' first-class path. `[CITED: github.com/just-the-docs/just-the-docs-template]`

### Pattern 5: Auto-updater & version.json strategy (D-06)

**What:** `electrobun build --env=stable` produces `artifacts/stable-{os}-{arch}-update.json` per-platform. The `Updater` polls `{release.baseUrl}/{channel}-{os}-{arch}-update.json` to check for updates.

**Source:** `[CITED: blackboard.sh/electrobun/docs/guides/updates]`

**Two URL strategies (per D-06):**

**Strategy A (recommended): GitHub Releases `latest/download` URL**

```typescript
// packages/desktop/electrobun.config.ts (addition)
release: {
  baseUrl: "https://github.com/Shuffzord/RoadRaven/releases/latest/download",
}
```

The Updater fetches `https://github.com/Shuffzord/RoadRaven/releases/latest/download/stable-win-x64-update.json`, which GitHub redirects to the manifest attached to the most recent non-prerelease Release.

- **Pro:** Zero extra infrastructure. The same release artifacts that go to `gh release create` serve double-duty as update manifests.
- **Pro:** Atomic — when a release is published, its update manifest is live the same instant.
- **Con:** Only works for stable. Per `[CITED: blackboard.sh/electrobun/docs/guides/updates]`: "GitHub's `/releases/latest/download` URL only resolves to non-prerelease builds." This is fine for v1.0 (stable only per D-10) but the v1.1 canary work will need a different mechanism (gh-pages branch with a per-channel folder, or R2/S3).

**Strategy B (alternative): `gh-pages` branch with per-channel folder**

```typescript
release: {
  baseUrl: "https://shuffzord.github.io/RoadRaven/updates",
}
```

Add a CI job that copies the latest release's manifest files into a `gh-pages` branch's `updates/` folder. The Updater fetches `https://shuffzord.github.io/RoadRaven/updates/stable-win-x64-update.json`.

- **Pro:** Channel-agnostic; canary support comes free.
- **Con:** More moving parts; requires a `gh-pages` branch + an extra commit per release.

**Recommendation:** **Strategy A for v1.0** (matches D-10 "stable only"). **Document the migration path to Strategy B in the v1.1 canary phase.**

**Manifest JSON shape:** The exact field names are not documented in the public Electrobun docs (verified via WebFetch on the updates guide — schema is referenced but not specified). What IS documented:
- File naming: `{channel}-{os}-{arch}-update.json` (e.g., `stable-win-x64-update.json`).
- Generated automatically by `electrobun build`.
- Contains version + SHA-256 hash for binary diff calculation.
- Updater compares local `version`/`hash` against remote.

`[ASSUMED]` — Based on Electrobun source code patterns: the manifest is likely `{ version: string, hash: string, baseUrl: string, channel: string, name: string, identifier: string }` (mirrors the `Updater.localInfo` shape extracted from the docs). **The planner does NOT need to know the exact field names** — Electrobun generates the manifest, the Updater reads it, the developer never touches it directly. The only requirement is that the file is hosted at the URL the Updater polls.

### Pattern 6: `@axe-core/playwright` against the production-built renderer (D-19)

**What:** Build the Vite production bundle (the same one that ships in the `.zip`/`.tar.gz`), serve it via `vite preview` on port 4173, and run a Playwright test that injects axe-core and audits each route.

**Source:** `[CITED: playwright.dev/docs/accessibility-testing]` + `[VERIFIED: registry.npmjs.org/@axe-core/playwright 4.11.3]`

**Why `vite preview` rather than the bundled CEF binary:**
- **HIGH confidence:** axe-core works against any browser environment Playwright can drive (Chromium, Firefox, WebKit). `[CITED: @axe-core/playwright README]`
- **LOW confidence:** Whether Playwright can drive an Electrobun-bundled CEF binary in CI is undocumented. Electrobun's docs do not mention Playwright integration with the bundled binary; no community examples found. Treating this as "not a paved path" — would require launching the binary, attaching to its CEF debugger port (if exposed), and connecting Playwright to that. Out of scope for v1.0.
- **Pragmatic compromise:** The Vite production bundle (`vite build`) IS the same HTML+CSS+JS that runs in CEF. A `vite preview` audit catches every issue except: (1) WebView2/CEF-specific rendering bugs, (2) bugs in the Bun process (RPC failures, unhandled errors). Neither category is what an axe audit detects — axe audits the rendered DOM, ARIA attributes, color contrast, focus order. All of those are deterministic from the bundled HTML+CSS+JS, which is what `vite preview` serves.

**The audit test:**

```typescript
// packages/desktop/tests/a11y/audit.spec.ts
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// Pre-condition: `bun run build` has produced packages/desktop/dist/.
// Vite preview serves dist/ on http://localhost:4173.
// Playwright config can launch `vite preview` as a webServer.

test.describe("Accessibility audit (production bundle)", () => {
  test("Welcome screen passes WCAG 2.1 AA", async ({ page }) => {
    await page.goto("http://localhost:4173/");
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    // Per D-20: zero severity-blocker findings is the pass criterion.
    // `serious` and `critical` are blockers; `moderate` and `minor` are tracked.
    const blockers = results.violations.filter(
      v => v.impact === "critical" || v.impact === "serious"
    );
    expect(blockers).toEqual([]);
  });

  test("Loaded roadmap (sample) passes WCAG 2.1 AA", async ({ page }) => {
    await page.goto("http://localhost:4173/?sample=hello-world");
    // Wait for tree to render
    await page.waitForSelector('[role="application"]', { timeout: 5000 });
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      // Exclude react-d3-tree's SVG (foreignObject content is what we audit)
      .exclude('svg .rd3t-link')
      .analyze();
    const blockers = results.violations.filter(
      v => v.impact === "critical" || v.impact === "serious"
    );
    expect(blockers).toEqual([]);
  });

  // Additional tests per requirement: side panel open, edit mode, context menu open,
  // confirmation dialog open, all three themes (dark/light/high-contrast).
});
```

**Manual checklist (PACK-06 requirement):** axe-core does NOT verify keyboard navigation correctness — only that focusable elements have tabindex/role/labels. Manual testing is required for:
- Tab order across canvas → side panel → status bar (PACK-06)
- F2 / arrow keys / Ctrl+D / Ctrl+C+V on the canvas
- Context menu keyboard navigation (Esc, arrow keys, Enter)
- Confirmation dialog keyboard handling (Esc, Tab cycle within dialog)
- Side panel edit mode (Esc to cancel, Tab into CodeMirror, etc.)

**The `05-A11Y-AUDIT.md` artifact (D-20)** documents both the automated baseline output and the manual checklist results.

### Anti-Patterns to Avoid

- **Hand-bumping versions in 5 files independently** — drift inevitable. Use Pattern 1 script.
- **Publishing `@roadraven/core` with `main: src/index.ts`** — breaks Node ESM consumers (no `.ts` resolution). Per D-03, must point at `dist/`. The `tsup` config in Pattern 2 handles this.
- **Including `samples/`, `docs/`, `tests/` in the npm tarball** — bloats download for consumers. Use the `files` field as the allowlist (whitelist what to publish, not blacklist via `.npmignore`).
- **Forgetting `--access public` on first publish under `@roadraven/` scope** — `npm publish` defaults to `restricted` for scoped packages, fails. Set `publishConfig.access: "public"` in package.json so the flag is implicit.
- **Coupling docs deploys to release tags only** — slows docs iteration. Decoupling (separate `pages.yml` triggered on master push to `docs/**`) is fine. Per the recommendation above, start coupled in v1.0; decouple if needed.
- **Running axe against `bun run dev:hmr`** — Vite dev server. The audit must run against the production build per D-19's "automated baseline against production-built app." See Pattern 6 for the `vite preview` solution.
- **Trusting `bunx npm publish` for provenance** — bunx invokes the npm CLI but the provenance attestation flow checks the OIDC token issuer. Verified to work via setup-node ensures the npm registry sees the GitHub Actions OIDC issuer correctly. **Use `npm publish` directly** in the workflow (after `setup-node@v4` registers the registry URL), not `bunx npm publish`.
- **Putting `LICENSE` only at the repo root** — npm tarballs need a per-package `LICENSE` (the npm registry pulls from the package, not the repo). Either copy or symlink (Windows-compat: copy).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| TypeScript → ESM + `.d.ts` | A custom tsc + dts-bundle-generator pipeline | **tsup** | One config file vs two; tsup handles `.d.ts` natively. |
| GitHub Release + asset upload | `gh release create` shell script with retry logic | **softprops/action-gh-release@v2** | Idempotent (re-runnable on tag re-push), handles rate limits, supports glob patterns. |
| GitHub Pages docs theme | Hand-rolled HTML/CSS theme | **Just-the-Docs** (Jekyll remote theme) | Sidebar + search + nav out of the box; serves natively from Pages. |
| Accessibility audit framework | Hand-rolled DOM walker checking ARIA roles | **`@axe-core/playwright`** | Maintained by Deque, Microsoft uses it, covers WCAG 2.1 AA, integrated with Playwright (already in project devDeps). |
| Lockstep version bump | Manual edits to 5 files | **`scripts/bump-version.ts`** (Pattern 1) | One source of truth, fewer typos. |
| Auto-updater | Custom polling + diff + relaunch logic | **Electrobun's `Updater` API** | Already wired (Phase 0 D-10). Just configure `release.baseUrl`. Binary diff support included. |
| Self-extracting Linux installer | Custom `tar.gz` + `chmod` shell script | **Electrobun's built-in `.tar.gz` self-extracting setup** | What `electrobun build` already produces. (See Critical Finding §A — this is what ships, not a `.deb`.) |
| npm provenance attestation | Custom signing | **npm's built-in `--provenance` + GitHub OIDC** | Free supply-chain attestation; community expectation in 2026. |
| Per-platform CI runner setup | Hand-managed Docker images | **GitHub-hosted `windows-latest` + `ubuntu-latest`** | Free for public OSS repos (RoadRaven is public). |

**Key insight:** This is a "wire together standard tooling" phase, not a "build infrastructure" phase. Every problem in this phase has an off-the-shelf, well-tested solution. Resist the temptation to roll custom scripts where a published action / npm package does the same job.

## Runtime State Inventory

> Phase 5 is primarily build/release/docs work. Most categories below are "nothing found" — but stating it explicitly per the protocol.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| **Stored data** | None — Phase 5 doesn't change schema, doesn't migrate user data. The `dataKey` invariant and existing `.roadmap-settings.json`, `.bak.json`, `.events.jsonl` files all keep working unchanged. The `applicationSupportPath` (`<userData>`) location is unchanged. | None. |
| **Live service config** | None — Phase 5 does not run any live services. The Event API server is per-app-instance, not a hosted service. | None. |
| **OS-registered state** | **`identifier: "RoadRaven.electrobun.dev"`** in `electrobun.config.ts` is the bundle identifier. Once a user installs v1.0 and the OS registers the app under this identifier, changing it later (e.g., to a more conventional reverse-DNS form like `dev.electrobun.RoadRaven` or `com.shuffzord.roadraven`) would orphan the user's settings, the Event API sentinel file location, and any OS-level association. **Verify this identifier is the intended permanent value before v1.0 ships.** Per Phase 0 D-01 / SCAF context, this identifier was set day-1 and has been carried unchanged — so it's intentional. **No action needed unless the planner wants to reconsider the identifier shape.** | Verify identifier is intended. |
| **Secrets and env vars** | If npm trusted publishing is NOT configured: `NPM_TOKEN` repo secret needed. Otherwise none. Auto-updater does not require any signing keys for unsigned-binary v1.0 (D-12/D-13). The `release.baseUrl` value in `electrobun.config.ts` is public and can be committed to git. | Add `NPM_TOKEN` if not using trusted publishing. |
| **Build artifacts / installed packages** | New `packages/core/dist/` directory will be generated by tsup — must be in `.gitignore` (and in `electrobun.config.ts` `watchIgnore` if dev mode otherwise picks it up). New `packages/desktop/artifacts/` directory will be generated by `electrobun build` — must be in `.gitignore`. The existing `packages/core/node_modules` directory survives unchanged. **Existing `packages/desktop/dist/` from `vite build`** is already implicitly used by `electrobun build` — verified in `electrobun.config.ts` line 14-17 `copy:` field. | Add `packages/core/dist/`, `packages/desktop/artifacts/` to `.gitignore`. |

## Common Pitfalls

### Pitfall 1: `bunx npm publish` provenance attestation failure

**What goes wrong:** Provenance fails with "OIDC token verification failed" or the published package has no provenance badge on npm.

**Why it happens:** `bunx` invokes the npm CLI but the OIDC token mint relies on the GitHub Actions environment variables that `actions/setup-node` sets up (`NPM_CONFIG_REGISTRY`, `NODE_AUTH_TOKEN`). When `bunx` is in the path, npm picks the wrong CLI or the env isn't set correctly.

**How to avoid:** Use `npm publish` directly (NOT `bunx npm publish`) after `actions/setup-node@v4`. This is the explicit exception to the "no npm" rule (CLAUDE.md), justified by provenance support. Document the exception in CONTRIBUTING.md.

**Warning signs:** No "Provenance" badge on the npm package page; warning in CI logs about OIDC token.

### Pitfall 2: Electrobun CLI binary download silently fails on first CI run

**What goes wrong:** The first `bunx electrobun build` invocation on a fresh runner downloads `electrobun-cli-{platform}-{arch}.tar.gz` from GitHub Releases. If the GitHub Release for the installed Electrobun version is missing or the runner has no network egress (corporate firewall, etc.), the download fails with a vague "Failed to download electrobun CLI" error.

**Why it happens:** Verified in `node_modules/.bun/electrobun@1.16.0/.../bin/electrobun.cjs` lines 80-110 — the CLI is not in the npm tarball, it's downloaded post-install on first run.

**How to avoid:** (1) Pin a specific Electrobun version in `package.json` (already done: `"electrobun": "1.16.0"`). (2) Optionally cache `node_modules/.bun/electrobun@*/.cache/` between CI runs. (3) Verify GitHub Release exists for the pinned version before relying on it (it does for v1.16.0 — verified via `gh api`).

**Warning signs:** "Downloading electrobun CLI for your platform..." appears every CI run (cache miss); "Download failed: 404" or similar in logs.

### Pitfall 3: `@roadraven/core` build emits `__esm`/`__commonJSStrictHelpers` shims that break consumers

**What goes wrong:** When tsup mixes ESM + CJS output, it emits compatibility shims that some bundlers (older Webpack, Metro for React Native) choke on.

**Why it happens:** Dual-format output. Picking ESM-only (per Pattern 2 — `format: ["esm"]`) sidesteps this entirely.

**How to avoid:** ESM-only. Node 18+ supports ESM natively; consumers needing CJS interop can use dynamic `import()`. `[ASSUMED]` — based on the project's existing posture (everything else is ESM, including `packages/core/package.json` `"type": "module"`).

**Warning signs:** Consumer build error mentioning `module.exports = void 0` or "cannot use import statement outside a module."

### Pitfall 4: GitHub Pages doesn't pick up the new `_config.yml` until repo settings change

**What goes wrong:** Pushing `docs/_config.yml` and front matter to master doesn't deploy the docs site.

**Why it happens:** GitHub Pages source must be set to "GitHub Actions" (not "Deploy from a branch") in repo Settings → Pages, OR set to "Deploy from a branch: master / docs folder" if NOT using the workflow approach. Default is "None."

**How to avoid:** As part of the docs setup task, manually flip Settings → Pages → Source to "GitHub Actions." This is a one-time UI step, NOT a code change. Document it in the task as a human-verification step.

**Warning signs:** GitHub Actions workflow runs successfully but `https://shuffzord.github.io/RoadRaven/` returns 404.

### Pitfall 5: `npm publish` rejects the package because `prepublishOnly` ran in a non-CI context with stale `dist/`

**What goes wrong:** A contributor runs `npm publish` locally (during testing) and the `prepublishOnly` script doesn't actually rebuild because the local `dist/` was hand-edited.

**Why it happens:** `prepublishOnly` runs the `build` script, but if a user has stale state, weird things happen.

**How to avoid:** (1) Only publish from CI. (2) `.gitignore` covers `dist/` so it's always regenerated. (3) Document in CONTRIBUTING.md: "Do not run `npm publish` locally — use the tag-triggered release workflow."

**Warning signs:** Published package contains stale code that doesn't match the tag.

### Pitfall 6: Linux installer permissions — `bundleCEF: true` Linux output requires `+x` on the launcher

**What goes wrong:** User downloads `.tar.gz`, extracts, double-clicks the launcher in their file manager → "permission denied" or nothing happens.

**Why it happens:** `tar` preserves permissions but Linux file managers sometimes don't honor `+x` for downloaded executables (security default).

**How to avoid:** README documents the install steps explicitly: `tar -xzf RoadRavenSetup.tar.gz && cd RoadRaven && chmod +x ./RoadRaven && ./RoadRaven` (exact paths depend on what `electrobun build` produces — verify by running `electrobun build --env=stable` once locally and inspecting the output structure).

**Warning signs:** First-Linux-user feedback complaining the app "doesn't run." Trivial fix (chmod) but high friction without docs.

### Pitfall 7: SmartScreen reputation requires the cert to age in — "Run anyway" UX must be in README

**What goes wrong:** Windows user downloads `.zip`, extracts, runs `-Setup.exe`, SmartScreen blocks "Windows protected your PC." User panics, deletes file, leaves negative review.

**Why it happens:** Unsigned binary (D-12). SmartScreen reputation is built over thousands of downloads + a valid Authenticode signature; an unsigned app starts at zero reputation.

**How to avoid:** README "First run on Windows" section is non-negotiable per the user's research focus item — explicit "More info → Run anyway" path with screenshot if possible. Linked from the GitHub Release page download instructions too.

**Warning signs:** Users opening GitHub issues asking "is this safe?" — that's the expected friction; reduce by clear docs.

## Code Examples

### `packages/core/tsup.config.ts` (NEW)

See Pattern 2 above.

### `packages/core/package.json` (MODIFIED)

See Pattern 2 above.

### `.github/workflows/release.yml` (NEW)

See Pattern 3 above.

### `docs/_config.yml` (NEW)

See Pattern 4 above.

### `scripts/check-core-deps.ts` (NEW — implements D-23)

```typescript
// scripts/check-core-deps.ts
// Runs in CI as part of the lint job. Fails the job if packages/core/package.json
// `dependencies` contains anything outside the allowlist.
//
// PACK-04 invariant: @roadraven/core has zero desktop dependencies.
import { readFileSync } from "node:fs";

const ALLOWLIST = new Set([
  "zod",
  // Add new entries here ONLY after explicit team review. Each addition
  // expands the runtime surface that downstream consumers (the Claude Code
  // MCP wrapper, future producers) take a transitive dep on.
]);

const pkg = JSON.parse(
  readFileSync("packages/core/package.json", "utf8")
) as { dependencies?: Record<string, string> };

const deps = Object.keys(pkg.dependencies ?? {});
const violations = deps.filter((d) => !ALLOWLIST.has(d));

if (violations.length > 0) {
  console.error(
    `packages/core/package.json has forbidden dependencies: ${violations.join(", ")}`
  );
  console.error(
    `Allowlist: ${[...ALLOWLIST].join(", ")}`
  );
  console.error(
    `If you need to add a dependency, edit ALLOWLIST in scripts/check-core-deps.ts and explain in the PR description.`
  );
  process.exit(1);
}

console.log(
  `✓ packages/core has ${deps.length} dependencies, all on the allowlist.`
);
```

**CI integration (one-line addition to `ci.yml`):**

```yaml
# Add to .github/workflows/ci.yml under the `lint:` job, after `bun install`
- name: Verify @roadraven/core dependency allowlist
  run: bun run scripts/check-core-deps.ts
```

### `packages/desktop/electrobun.config.ts` (MODIFIED)

```typescript
import type { ElectrobunConfig } from "electrobun";

const bundleCEF = process.env.ROADRAVEN_RENDERER !== "webkit";

export default {
  app: {
    name: "RoadRaven",
    identifier: "RoadRaven.electrobun.dev",
    version: "1.0.0",                      // BUMP per release (via scripts/bump-version.ts)
  },
  build: {
    copy: {
      "dist/index.html": "views/mainview/index.html",
      "dist/assets": "views/mainview/assets",
    },
    watchIgnore: ["dist/**"],
    mac: { bundleCEF },
    linux: { bundleCEF },
    win: { bundleCEF },
  },
  release: {                                // NEW
    baseUrl: "https://github.com/Shuffzord/RoadRaven/releases/latest/download",
  },
} satisfies ElectrobunConfig;
```

### `packages/desktop/package.json` (MODIFIED — add `build:stable`)

```json
{
  "scripts": {
    "build:canary": "vite build && electrobun build --env=canary",
    "build:stable": "vite build && electrobun build --env=stable"
  }
}
```

### Plugin Authoring Guide outline (`docs/plugin-authoring.md` — NEW)

```markdown
---
title: Event API Plugin Authoring
nav_order: 7
---

# Writing an Event Producer for RoadRaven

> **Scope:** This guide covers RoadRaven v1.0's **Event API** — the way external
> tools push live status updates into a running RoadRaven app. The full plugin
> system (smart adapters that own their own connection lifecycle) is v1.1.

## What you can build

Anything that can speak WebSocket and produce structured status events:

- A CI/CD pipeline wrapper that updates roadmap nodes as builds progress
- A test runner integration that marks nodes "blocked" on test failures
- A daemon that polls an external API (Linear, GitHub, etc.) and reflects
  state into the roadmap
- An LLM-driven agent that updates nodes as it makes progress on tasks
  (the Claude Code MCP wrapper at `plugins/claude-code/` is the reference
  implementation)

## The contract

Every event is a single WebSocket text frame containing JSON:

\`\`\`json
{
  "nodeId": "8a7b...uuid",   // must match a node in the loaded roadmap
  "status": "in-progress",   // must match a status id in the schema's statusConfig
  "meta": { "branch": "main", "commit": "abc123" },  // optional
  "source": "my-tool"        // optional but strongly recommended
}
\`\`\`

[Full contract reference] → see `packages/core/src/plugin.ts:IntegrationEvent`

## Discovering the URL

When RoadRaven boots, it writes a sentinel file at `<userData>/event-api.json`:

\`\`\`json
{
  "port": 47921,
  "url": "ws://127.0.0.1:47921",
  "startedAt": "2026-05-03T18:00:00.000Z",
  "pid": 12345
}
\`\`\`

Where `<userData>` is the Electrobun user-data directory:
- macOS: `~/Library/Application Support/RoadRaven`
- Linux: `~/.config/RoadRaven`
- Windows: `%APPDATA%\RoadRaven`

If the sentinel file is missing, the app is not running.

## Worked example: walk through `plugins/claude-code/`

[Walk through the actual files:
  - src/sentinel.ts: how the wrapper finds the URL
  - src/wsClient.ts: connection management, exponential backoff
  - src/server.ts: the MCP tool surface
  - src/index.ts: the entry point
Each section shows ~20 lines of real code with annotations.]

## Errors

[Document the four error categories from Phase 4 D-22/D-23:
  - malformed event
  - unknown_node
  - invalid_status
  - producer disconnect
Show the toast UX and event log behavior the user will see.]

## Reconnection strategy

[Document the recommended exponential backoff pattern from
plugins/claude-code/src/wsClient.ts; note the cap at 30s.]

## What's NOT in v1

The schema fields `plugin` and `subscribe` on each node are reserved for v1.1
and are silently ignored in v1.0. Do not depend on them.

The full `RoadmapPlugin` interface (with `connect()`, `disconnect()`, `on()`,
`off()` hooks) is defined in `packages/core/src/plugin.ts` for forward
compatibility but is not yet wired. v1.1 will add the plugin host that
calls these methods.
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Long-lived `NPM_TOKEN` secret | OIDC trusted publishing | July 2025 (npm GA) | Eliminates secret rotation; provenance is automatic. |
| `--provenance` CLI flag | `publishConfig.provenance: true` in package.json | npm CLI 9.5.0+ | Cleaner — flag is no longer needed when configured in package.json. |
| Manual GitHub release upload via shell scripts | `softprops/action-gh-release@v2` (or built-in `gh release create`) | 2024+ | Idempotent re-runs; glob support; no shell quoting bugs. |
| MkDocs + Python build job in CI | Just-the-Docs (Jekyll remote_theme) for small repos | Stable for years; GitHub Pages first-class | Zero CI tooling for docs; sidebar UX is competitive. |
| `tsc -p tsconfig.build.json` + `dts-bundle-generator` | tsup | tsup 7.x (2023+) | Single config; faster builds via esbuild. |
| Lighthouse for accessibility | `@axe-core/playwright` | axe-core matures, Playwright adoption | Tighter integration; more accurate ARIA-aware rules. |
| Electron Builder | Electrobun built-in build | n/a — RoadRaven was Electrobun day-1 | N/A; included for context — readers familiar with Electron should not search for `electron-builder`-style configs. |

**Deprecated/outdated:**
- `npm prepublish` script — deprecated; use `prepublishOnly` (only runs on `npm publish`, not on `npm install`).
- `package.json` `bin` paths without leading `./` — inconsistently supported; always prefix `./` (already correct in `plugins/claude-code/package.json`).
- "Build from a branch" GitHub Pages publishing — works but legacy; "GitHub Actions" source is the recommended path for any non-trivial build (Just-the-Docs needs the remote_theme plugin which works either way, but Actions is more flexible if you later add custom plugins).

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest 4.1.4 (existing) + Playwright 1.59.1 (existing) |
| Config files | `packages/desktop/vitest.config.ts` (existing); `packages/desktop/playwright.config.ts` (existing); `packages/desktop/tests/a11y/playwright.config.ts` (NEW — Wave 0 if needed) |
| Quick run command | `bun run --cwd packages/desktop test` (vitest) |
| Full suite command | `bun run verify` (test + typecheck + build + lint, root package.json) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| **PACK-01** | `electrobun build --env=stable` produces `.zip` (Windows) installer artifact | smoke | Local: `bun run --cwd packages/desktop build:stable` then assert `packages/desktop/artifacts/stable-win-x64-*.zip` exists. CI: matrix job `build-windows` fails if `if-no-files-found: error` triggers. | ❌ Wave 0 — Need a `tests/release/installer-artifacts.test.ts` that runs `bunx electrobun build --env=stable --dry-run` (if supported) OR asserts on the artifacts/ directory after a real build. |
| **PACK-01** | `electrobun build --env=stable` produces Linux installer artifact (`.tar.gz` per Critical Finding §A) | smoke | Same as above for `linux-x64`. | ❌ Wave 0 |
| **PACK-02** | Auto-updater `version.json` (manifest) is hosted at `release.baseUrl/{channel}-{os}-{arch}-update.json` and resolves to a real file | integration | After release: `curl -fsSL https://github.com/Shuffzord/RoadRaven/releases/latest/download/stable-win-x64-update.json` returns 200 + valid JSON. | ❌ Wave 0 — A `tests/release/manifest-url.test.ts` that hits the URL after a release. (Manual smoke after first release; automate post-v1.0.) |
| **PACK-02** | `Updater.localInfo.channel()` resolves to "stable" for tagged builds and "dev" for unbundled | unit | Existing tests in `packages/desktop/tests/unit/bun/` cover the try/catch path (SCAF-09 regression test). | ✅ Already covered — verify still passing in `bun run verify`. |
| **PACK-03** | `bundleCEF: true` on all platforms; SIGTERM handler awaits `flushPending` | unit + grep | Grep `electrobun.config.ts` for `bundleCEF`; assert `process.on("SIGTERM"` with await `flushPending` in `packages/desktop/src/bun/index.ts`. | ✅ Already covered — `packages/desktop/src/bun/index.ts:205-212` and `electrobun.config.ts:19-21`. Add a regression test if not present. |
| **PACK-03** | Keyboard shortcuts cover all file actions (no `ApplicationMenu` dependency) | manual + grep | Grep that no `ApplicationMenu` import exists; manual checklist confirms keyboard reachability. | ❌ Wave 0 grep test |
| **PACK-04** | `bunx npm install @roadraven/core` from a fresh directory works (smoke) | integration | `mkdir /tmp/test && cd /tmp/test && npm init -y && npm install @roadraven/core && node -e "import('@roadraven/core').then(m => console.log(m.RoadmapSchemaSchema))"` | ❌ Wave 0 (post-publish only — runs on tag triggers in a separate verify-publish workflow) |
| **PACK-04** | `packages/core/package.json` dependencies are within the allowlist (`zod` only) | unit | `bun run scripts/check-core-deps.ts` (see Code Examples §"check-core-deps.ts") | ❌ Wave 0 — script + ci.yml integration |
| **PACK-04** | `@roadraven/core` exports resolve in a Node ESM consumer | unit | `tests/release/core-exports.test.ts` — import `@roadraven/core/dist/index.js` directly, assert `RoadmapSchemaSchema`, `IntegrationEvent` are present. | ❌ Wave 0 |
| **PACK-05** | GitHub Pages site is live at `https://shuffzord.github.io/RoadRaven/` and shows the docs index + sidebar | integration | After deploy: `curl -fsSL https://shuffzord.github.io/RoadRaven/` returns 200 with HTML containing "RoadRaven". | ❌ Wave 0 — A simple post-deploy curl test in the `deploy-docs` job. |
| **PACK-05** | Plugin authoring guide's worked example (claude-code MCP wrapper) actually runs end-to-end | manual + integration | Existing Phase 4 PLUG-08 acceptance test (verified 2026-04-29). Re-run as part of Phase 5 audit. | ✅ Already covered (Phase 4 04-05 plan). |
| **PACK-06** | Each accessibility checklist item produces a binary pass/fail | unit + manual | `tests/a11y/audit.spec.ts` (see Pattern 6) for automated; `05-A11Y-AUDIT.md` for manual. | ❌ Wave 0 |
| **PACK-06** | Zero severity-blocker findings (D-20) | unit | Same audit.spec.ts asserts on `results.violations` filtered to `critical`+`serious`. | ❌ Wave 0 |
| **All requirement edits (D-05, D-08, D-11)** | REQUIREMENTS.md and PROJECT.md edits land | unit | Grep test: `tests/release/requirements-edits.test.ts` greps `REQUIREMENTS.md` for `@roadmap-viewer/` (must be 0 matches), `macOS .dmg` (must be 0 in v1 section), `canary + stable channels` (must be 0). | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `bun run --cwd packages/desktop test` (existing fast test loop, ~10s)
- **Per wave merge:** `bun run verify` (test + typecheck + build + lint, ~60s)
- **Phase gate:** Full `bun run verify` + `tests/release/*` smoke tests + manual a11y checklist + post-publish smoke (`npm install @roadraven/core` from a clean dir) before `/gsd-verify-work`.

### Wave 0 Gaps

- [ ] `packages/desktop/tests/a11y/audit.spec.ts` — automated baseline against `vite preview`
- [ ] `packages/desktop/tests/a11y/playwright.config.ts` (or extend existing) — `webServer: { command: "bunx vite preview", port: 4173 }`
- [ ] `tests/release/installer-artifacts.test.ts` — assert `electrobun build` outputs match expected naming pattern
- [ ] `tests/release/core-exports.test.ts` — import-from-dist smoke
- [ ] `tests/release/requirements-edits.test.ts` — grep test asserting REQUIREMENTS.md/PROJECT.md edits landed
- [ ] `scripts/check-core-deps.ts` — CI-runnable allowlist script
- [ ] `scripts/bump-version.ts` — lockstep version bump script
- [ ] `.github/workflows/release.yml` — release workflow itself (not a test, but Wave-0-shaped)
- [ ] `docs/_config.yml` — Jekyll config
- [ ] Add front matter to existing `docs/*.md` files

*(If no gaps: not applicable — Phase 5 introduces enough net-new test surface that ~7 new test/script files are needed.)*

## Security Domain

> Phase 5 ships installers and publishes packages — both are supply-chain surfaces. Per `security_enforcement` enabled (default).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No login flow in v1 (single-user desktop app) |
| V3 Session Management | no | n/a |
| V4 Access Control | partial | Path-traversal allowlist already exists (Plan 03-04a). Phase 5 adds: artifact directory must be writeable only by the build, not packaged into the published tarball. |
| V5 Input Validation | yes (existing) | Zod schemas at all trust boundaries (Phase 0–4 invariant; Phase 5 ships the schema package as `@roadraven/core` to npm — consumers get the same validation surface). |
| V6 Cryptography | partial (deferred) | D-12/D-13: code signing deferred. Auto-updater binary diff uses SHA-256 hash (handled by Electrobun's Updater natively — no hand-rolled crypto). |
| V14 Configuration | yes | `.gitignore` covers `dist/`, `artifacts/`, `node_modules/`, `.bak.json`, `.events.jsonl`, `.roadmap-settings.json`. **NEW for Phase 5:** ensure no secrets land in `packages/core/dist/`, `packages/desktop/artifacts/`, or `_site/` (docs build output). |

### Known Threat Patterns for {npm package + GitHub Release distribution}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| **Typosquatting on `@roadraven/`** scope | Spoofing | Reserve common typo variants (`@roadraven/core` vs `@roadrven/core` etc.) on npm — out of scope for Phase 5 but flag as v1.1 follow-up. The `@` scope itself is owned via npm scope reservation. |
| **Compromised CI publishes a malicious version** | Tampering | npm provenance attestation (Pattern 3) + GitHub OIDC. End users can verify the package was published from this repo's release.yml workflow. |
| **Stolen `NPM_TOKEN` republishes** | Spoofing | OIDC trusted publishing eliminates the long-lived token. (Per Pattern 3 — recommended.) |
| **Compromised dependency in `@roadraven/core`** | Tampering | The allowlist (D-23, `scripts/check-core-deps.ts`) limits the supply-chain surface to just `zod`. Adding deps requires PR review. |
| **Auto-updater pulls a malicious manifest** | Tampering | Manifest URL (`release.baseUrl`) is HTTPS-pinned to `github.com/Shuffzord/RoadRaven`. GitHub's TLS + origin enforcement is the boundary. **Not stronger than HTTPS+GitHub trust** — code signing (D-12 deferred) would add a stronger guarantee but is explicitly out of scope. |
| **Unsigned `.exe` runs without warning on machines that don't have SmartScreen** | Repudiation | Per D-12 explicitly accepted. README documents the SmartScreen warning + bypass. |
| **Unsigned `.tar.gz` self-extracting installer** | Repudiation | Per D-13 explicitly accepted. README documents `tar -xzf` flow. |
| **Path traversal in `electrobun build` output** | Tampering | Electrobun owns the artifact paths; `packages/desktop/artifacts/` is a known-good directory. CI uses `if-no-files-found: error` to fail loudly if Electrobun produces unexpected paths. |
| **Public `release.baseUrl` reveals release URL pattern** | Information Disclosure | Acceptable — the URL is meant to be public (the auto-updater is a public consumer). |

## Sources

### Primary (HIGH confidence)
- Electrobun LLM-friendly API reference (`https://blackboard.sh/electrobun/llms.txt`) — auto-updater `Updater` API, `release.baseUrl` channel resolution, build CLI flags, lifecycle hook env vars.
- Electrobun docs — Bundling & Distribution (`https://blackboard.sh/electrobun/docs/guides/bundling-and-distribution/`) — installer formats per platform (`.zip`/`.tar.gz`/`.dmg`); flat artifact naming; channel suffix behavior.
- Electrobun docs — Updates (`https://blackboard.sh/electrobun/docs/guides/updates/`) — manifest filename pattern, GitHub Releases `latest/download` limitation for canary, full GH Actions workflow example.
- Electrobun docs — Build Configuration (`https://blackboard.sh/electrobun/docs/apis/cli/build-configuration/`) — full `electrobun.config.ts` schema; per-platform fields.
- npm docs — Generating provenance statements (`https://docs.npmjs.com/generating-provenance-statements/`) — `permissions.id-token: write`, `npm publish --provenance --access public`, npm CLI 9.5.0+ requirement.
- npm docs — Trusted publishers (`https://docs.npmjs.com/trusted-publishers/`) — OIDC setup at npmjs.com, eliminates `NPM_TOKEN` need.
- GitHub changelog 2025-07-31 — npm trusted publishing GA (`https://github.blog/changelog/2025-07-31-npm-trusted-publishing-with-oidc-is-generally-available/`).
- npm registry — version verification: `tsup@8.5.1`, `@axe-core/playwright@4.11.3`, `@axe-core/cli@4.11.3` (verified 2026-05-03).
- RubyGems — `just-the-docs@0.12.0` (verified 2026-05-03; published 2026-01-23).
- GitHub source — `blackboardsh/electrobun` release artifacts list (verified via `gh api repos/blackboardsh/electrobun/releases/latest`); confirms only `.tar.gz` artifacts are produced.
- Phase 0–4 CONTEXT.md and code (`electrobun.config.ts`, `packages/desktop/src/bun/index.ts`, `packages/core/src/index.ts`, `plugins/claude-code/`) — verified by direct file read.

### Secondary (MEDIUM confidence)
- Playwright accessibility testing docs (`https://playwright.dev/docs/accessibility-testing`) — `@axe-core/playwright` AxeBuilder pattern.
- softprops/action-gh-release README (GitHub) — release attachment + glob patterns + idempotency.
- actions/deploy-pages + actions/jekyll-build-pages docs — Pages deployment workflow shape.
- Just-the-Docs configuration page (`https://just-the-docs.com/docs/configuration/`) — `_config.yml` fields, navigation structure.

### Tertiary (LOW confidence — flagged for validation)
- The exact JSON schema of Electrobun's update manifest is not documented in any public-facing docs page reviewed. Inferred to mirror the `Updater.localInfo` shape `{ version, hash, baseUrl, channel, name, identifier }`. **Marked `[ASSUMED]` in §"Auto-Updater & version.json"** — does not block planning because the developer never touches the manifest directly (Electrobun generates it).
- Whether Playwright can drive an Electrobun-bundled CEF binary in CI — undocumented. **Sidestepped by auditing `vite preview` instead of the bundled binary** (Pattern 6). Acceptable for v1.0; documented limitation.
- Whether `bunx electrobun build` works on Windows runners with no extra setup beyond the npm postinstall download — `[ASSUMED]` based on the postinstall script supporting Windows (verified in script source) but not tested end-to-end on `windows-latest` runner. **Recommend a smoke-test job in Wave 0 of the planned implementation.**

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| **A1** | Electrobun's update manifest JSON has fields `{ version, hash, baseUrl, channel, name, identifier }` | Auto-Updater & version.json (Pattern 5) | Low — the developer never reads/writes the manifest directly; Electrobun generates and consumes it. Documentation gap, not a planning blocker. |
| **A2** | ESM-only output for `@roadraven/core` is sufficient (no consumers need CJS) | Code Examples → tsup config | Low — the existing consumers (the desktop app, plugins/claude-code, future producers) are all ESM. If a CJS consumer appears post-v1.0, add `format: ["esm", "cjs"]` to tsup config — minor change. |
| **A3** | `bunx electrobun build` on `windows-latest` and `ubuntu-latest` runners works on first run after `bun install` | Pattern 3 (release.yml) | Medium — the postinstall script downloads the CLI binary on first invocation. If a runner has no network egress to `github.com/blackboardsh/electrobun/releases`, the build fails. **Mitigation:** add a smoke-test job that runs `bunx electrobun build --help` before the actual build to surface CLI-fetch failures early. |
| **A4** | The simplest version-bump mechanism is a hand-rolled bun script; user does not need changesets | Pattern 1 | Low — if the user wants independent versioning later, swap in changesets at zero cost (the lockstep script doesn't preclude it). |
| **A5** | npm provenance via OIDC trusted publishing is preferred over NPM_TOKEN | Standard Stack + Pattern 3 | Low — both work; trusted publishing is the modern recommendation but requires a one-time npmjs.com config step. If the user prefers NPM_TOKEN (simpler initial setup, no provenance), revert to that — three-line change to the workflow. |
| **A6** | Just-the-Docs is the right docs theme choice (over MkDocs/Astro/raw HTML) | Pattern 4 | Low — purely aesthetic / DX choice. If the user prefers MkDocs Material, swap in — adds Python to CI but otherwise no architectural difference. |
| **A7** | The `identifier: "RoadRaven.electrobun.dev"` is the intended permanent bundle identifier | Runtime State Inventory | Medium — once v1.0 ships, changing this orphans installed users' settings. **Recommend the planner verify with the user before v1.0 tag** that this identifier is intended (it appears intentional per Phase 0 SCAF, but it does not match the conventional reverse-DNS form like `dev.electrobun.RoadRaven` or `com.shuffzord.roadraven`). |
| **A8** | The CONTEXT.md PACK-04 update should drop `@roadraven/react` from publish list and `peerDependencies` requirement (since `@roadraven/react` itself is what would have those peers) | User Constraints + Phase Requirements | Low — D-01 explicitly defers `@roadraven/react`; the rewrite of PACK-04 (per D-05) is the planner's task. This is a clean carry-through. |
| **A9** | accessibility audit passing the production Vite bundle (not the CEF-bundled binary) is an acceptable v1.0 compromise | Pattern 6 | Medium — if the user requires the audit run against the actual shipped binary, the planner needs to investigate Playwright→CEF integration in v1.0 (out of paved-path territory). Current recommendation: ship audit-against-vite-preview with documented caveat in `05-A11Y-AUDIT.md`. |
| **A10** | The `.deb` installer requirement (PACK-01, D-07) can be satisfied by Electrobun's `.tar.gz` self-extracting setup, NOT a real Debian package | Critical Finding §A | **High** — see Critical Finding. The user said "Linux `.deb`" explicitly in D-07; if they meant a real `.deb`, the planner needs Resolution Path B (post-build dpkg-deb wrap, ~1 day of extra work) or to defer Linux to v1.1. **Must be reconciled with user before Wave 1.** |

**If this table is empty:** It is not. Items A7, A9, A10 are flagged for user confirmation. A1–A6, A8 are low-risk and the planner can proceed with the noted defaults.

## Open Questions

1. **Should v1.0 ship `.tar.gz` (Electrobun-native) or `.deb` (extra packaging effort)?**
   - What we know: Electrobun produces `.tar.gz`, not `.deb`. CONTEXT and REQUIREMENTS assume `.deb`.
   - What's unclear: Whether the user accepts `.tar.gz` (the path of least resistance) or wants `.deb` (matches original spec but burns ~1 day of dpkg-deb wrapping work).
   - Recommendation: **Discuss-phase question to user.** Default to `.tar.gz` for v1.0 with `.deb` as a v1.1 polish. If user picks `.deb`, planner adds a Wave 2 task for the dpkg-deb postPackage hook.

2. **Is `RoadRaven.electrobun.dev` the intended permanent bundle identifier, or should it move to a conventional reverse-DNS form?**
   - What we know: Set in Phase 0 SCAF; carried unchanged. Functional.
   - What's unclear: Whether the user wants `dev.electrobun.RoadRaven` or `com.shuffzord.roadraven` or similar before locking it in v1.0 (changing later orphans installed users' settings).
   - Recommendation: Quick user check before tagging v1.0. If kept as-is, no action; if changed, change in `electrobun.config.ts` AND document the legacy identifier so power-users with `<userData>/RoadRaven.electrobun.dev/` directories know how to migrate (probably "manually rename the directory" — small audience for v1.0).

3. **OIDC trusted publishing or NPM_TOKEN?**
   - What we know: OIDC is the modern recommendation (no secret rotation, free provenance). NPM_TOKEN works fine if the user prefers it.
   - What's unclear: Whether the user has already set up trusted publishing on npmjs.com (one-time UI step).
   - Recommendation: Default to OIDC trusted publishing (better long-term hygiene); if the user hasn't set it up yet, the planner adds a "human checkpoint" task to do the npmjs.com config before the first release.

4. **Does the audit need to run against the CEF-bundled binary or is `vite preview` acceptable?**
   - What we know: `vite preview` covers DOM/CSS/ARIA correctness (which is what axe-core checks). CEF-bundled audit is not a paved path.
   - What's unclear: User's interpretation of "automated baseline against the production-built app" (D-19) — does "production-built" mean "the production webview bundle" (vite preview is fine) or "the shipped installer" (need CEF integration)?
   - Recommendation: Clarify in discuss-phase. Default: vite preview with documented caveat in `05-A11Y-AUDIT.md`.

5. **Wave breakdown — is 4 waves the right shape?**
   - What we know: This phase has 24 decisions and 6 requirements; touches packaging, npm publishing, CI, docs, a11y. Not small.
   - Recommended split (per user research focus item #12):
     - **Wave 0:** Test scaffolds + Wave-0 gaps from Validation Architecture (audit.spec.ts, check-core-deps.ts, bump-version.ts, requirements-edits grep test). Plus the requirement edits themselves (D-05, D-08, D-11) so subsequent waves work against correct requirements.
     - **Wave 1:** Workspace prep + npm package builds + lockstep version mechanism. Outputs: `@roadraven/core` builds via tsup, `@roadraven/plugin-claude-code` package.json flipped to `private: false`, all package.json `version` fields aligned, LICENSE files in each tarball, scripts/bump-version.ts working, scripts/check-core-deps.ts in CI.
     - **Wave 2:** Release workflow + auto-updater config + CI core-deps gate. Outputs: `release.yml` building installers + publishing npm + creating GitHub Release; `electrobun.config.ts` `release.baseUrl` configured. Smoke-tested via a `v0.0.2-test` tag.
     - **Wave 3:** Docs site + CONTRIBUTING + README polish. Outputs: `docs/_config.yml`, front matter on all `docs/*.md`, `docs/plugin-authoring.md`, `CONTRIBUTING.md`, README polish (install instructions, SmartScreen, feature-status block), GitHub Pages live.
     - **Wave 4:** Accessibility audit. Outputs: `tests/a11y/audit.spec.ts`, `05-A11Y-AUDIT.md` artifact, any blocker fixes that surface.
   - Recommendation: **4 waves + Wave 0** (Wave 0 is a single "test scaffolds + requirement edits" task before any code lands). Waves are mostly sequential because Wave 2 (release) needs Wave 1 (npm package builds), and Wave 4 (audit) needs the production build to exist (Wave 1's `bun run build` chain). Wave 3 (docs) could parallelize with Wave 2 — they touch disjoint files.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| **bun** | Local dev + CI | ✓ | 1.3.4 | — |
| **node** | npm publish + setup-node in CI | ✓ | 24.12.0 (local) / 22 (CI runners) | — |
| **npm** | publishing only | ✓ | 11.6.2 (local) / 10.x (CI via setup-node) | — |
| **gh (GitHub CLI)** | Local release verification | ✓ | 2.79.0 | softprops action handles this in CI |
| **electrobun (npm package)** | Build CLI | ✓ | 1.16.0 (pinned, installed) | — |
| **tsup** | `@roadraven/core` build | ✗ | — | Add to `packages/core` devDependencies in Wave 1 |
| **@axe-core/playwright** | a11y audit | ✗ | — | Add to workspace devDependencies in Wave 4 |
| **Playwright (`@playwright/test`)** | a11y audit harness | ✓ | 1.59.1 | — |
| **vite** | production build for audit | ✓ | 6.0.3 | — |
| **just-the-docs (Jekyll gem)** | docs site theme | n/a — runs in GitHub Pages CI, not locally | 0.12.0 (latest) | If GitHub Pages can't resolve remote_theme, fall back to a local Gemfile-based setup (more setup, same outcome) |
| **GitHub Pages** | docs hosting | ✓ (repo is public; Pages free tier active) | — | — |
| **npmjs.com publish access** | npm publish (under `@roadraven/` scope) | **? — needs verification** | — | If `@roadraven/` scope is not yet owned, register at npmjs.com (one-time UI step) before first publish |
| **dpkg-deb** | Optional .deb wrap if user picks Resolution Path B | N/A on Windows; available on `ubuntu-latest` runner | — | Skip if `.tar.gz` (Path A) is chosen |
| **OIDC trusted publishing config at npmjs.com** | Optional (provenance without NPM_TOKEN) | **? — needs verification** | — | Use NPM_TOKEN secret if not configured |

**Missing dependencies with no fallback:**
- None — all blocking items are addressable with one Wave-1 install command.

**Missing dependencies with fallback:**
- `dpkg-deb` only matters if Resolution Path B (Critical Finding §A) is picked.

**Items requiring user action before first release:**
- Confirm `@roadraven/` scope ownership at npmjs.com (or register).
- Optionally configure OIDC trusted publishing for `@roadraven/core` and `@roadraven/plugin-claude-code` at npmjs.com.
- Flip GitHub Pages source to "GitHub Actions" in repo Settings → Pages.
- (Critical Finding) Confirm `.tar.gz` (Path A) is acceptable for Linux v1.0 OR commission a `.deb` wrap (Path B).

## Metadata

**Confidence breakdown:**
- **Standard stack:** HIGH — All recommended packages verified against npm registry today (2026-05-03). Versions current.
- **Architecture (release workflow shape):** HIGH — Pattern 3 mirrors Electrobun's official documentation example workflow, adapted for the project's bun/npm split. Verified against npm provenance docs.
- **Pitfalls:** MEDIUM — Pitfalls 1-7 are based on documented behaviors and direct code inspection; one ASSUMED (Pitfall 3 about tsup CJS shims) is conservative.
- **Critical Finding §A (.deb vs .tar.gz):** HIGH — Verified against three independent sources (Electrobun docs, Electrobun's own release artifacts, the build-configuration schema lacking .deb fields).
- **Auto-updater manifest JSON shape:** LOW — exact field names not documented publicly; ASSUMED based on `Updater.localInfo` shape. Does not block planning.
- **Accessibility audit against CEF-bundled binary:** LOW — not a paved path; recommended workaround (audit `vite preview`) is HIGH confidence as the equivalent surface.

**Research date:** 2026-05-03
**Valid until:** 2026-06-03 (30 days — packaging stack is stable; revisit if Electrobun ships a major version with new artifact formats or if npm provenance flow changes)
