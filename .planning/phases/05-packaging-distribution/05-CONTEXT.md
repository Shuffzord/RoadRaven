# Phase 5: Packaging & Distribution - Context

**Gathered:** 2026-05-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Make RoadRaven distributable for end users on Windows and Linux, publish the canonical schema/types package to npm, and ship the docs and contribution surface that an external developer needs to integrate with the Event API. Concretely: native Windows `.exe` and Linux `.deb` installers built from CI on git-tag, attached to a GitHub Release; Electrobun auto-updater wired to a stable-channel `version.json` hosted on GitHub; `@roadraven/core` (pre-built ESM + `.d.ts`) published to npm at the same tag; an accessibility audit pass; GitHub Pages serving `docs/` with a plugin authoring guide for the Event API and a `CONTRIBUTING.md` at the repo root.

This phase delivers PACK-01 through PACK-06 as scoped below, plus the requirement edits enumerated under "Requirement Edits" in `<decisions>`.

**Explicitly NOT in scope (deferred to v1.1):**
- macOS `.dmg` build, signing, and notarization
- Canary release channel (auto-updater wiring still respects `Updater.localInfo.channel()`, but no canary manifest is published)
- `@roadraven/react` npm package (currently a `export {};` stub; no extracted React component library)
- Authenticode signing of the Windows `.exe` (ship unsigned with documented SmartScreen bypass)
- GPG signing of the Linux `.deb` and any apt-repo hosting (ship unsigned `.deb` for manual `dpkg -i`)
- Self-hosted release infrastructure (S3 / R2 / custom CDN)
- Dedicated documentation site beyond GitHub Pages (Astro / Starlight / VitePress)
- Telemetry, crash reporting, or any phone-home behavior in installers

</domain>

<decisions>
## Implementation Decisions

### npm package scope (PACK-04)
- **D-01:** **`@roadraven/react` is deferred to v1.1.** The package is currently `export {};` (no real components). Extracting reusable components from `packages/desktop/` would require decoupling from the Electrobun RPC layer, the Zustand stores, the file watcher, and the autosave engine — that is its own phase, not a packaging task. Drop `@roadraven/react` from the v1 publish list.
- **D-02:** **`@roadraven/core` ships in v1.** It already has real content (Zod schemas, `IntegrationEvent`, `RoadmapPlugin` types) and zero desktop dependencies. Publishing it gives external producers (the Claude Code MCP wrapper, future producers) a canonical import for the schema and event contract instead of copying types.
- **D-03:** **`@roadraven/core` is published as pre-built ESM + `.d.ts`.** Add a build step (planner picks tsup or tsc — Claude's discretion) that emits `dist/index.js` and `dist/index.d.ts`. Update `main`, `types`, and `exports` in `packages/core/package.json` to point at `dist/`. Keep `src/` out of the published tarball via `files`. Reason: `main: src/index.ts` (current shape) breaks Node ESM consumers and TS projects with `isolatedModules`.
- **D-04:** **Lockstep versioning across the workspace.** `packages/desktop`, `packages/core`, `packages/react` (private in v1), and `plugins/claude-code` all bump together to the same version on each release. One git tag per release (e.g., `v1.0.0`). Reason: simpler than independent versioning before there's a real reason to diverge; one tag = one shippable system.
- **D-05:** **Requirement edit (planner action):** PACK-04 in `.planning/REQUIREMENTS.md` references `@roadmap-viewer/core` and `@roadmap-viewer/react`. The scope is `@roadraven/` per Phase 0 D-01 (the `@roadmap-viewer/` name is stale). Rewrite PACK-04 to: (a) use `@roadraven/`, (b) drop `@roadraven/react` from v1, (c) keep the "zero desktop dependencies in core, enforced in CI" invariant.

### Release & update hosting (PACK-01, PACK-02)
- **D-06:** **GitHub Releases is the distribution channel.** Installer artifacts (`.exe`, `.deb`) attach to a tagged Release. The auto-updater `version.json` for the stable channel is published at a stable URL — planner picks between (a) a release asset on the latest stable Release, or (b) a `gh-pages` branch served via GitHub Pages. Either is fine; the URL must be stable across releases so `Updater` can poll it.
- **D-07:** **v1.0 ships Windows `.exe` and Linux `.deb` only.** macOS `.dmg` is deferred to v1.1 to avoid the Apple Developer + notarization tooling cost on the first release.
- **D-08:** **Requirement edit (planner action):** PACK-01 currently lists all three platforms. Rewrite to v1 = `.exe` + `.deb`; add macOS to v2/v1.1 requirements. PROJECT.md "Out of Scope" gains a row: "macOS distribution in v1.0 — deferred to v1.1; framework supports it, packaging effort + Apple Developer cert deferred."
- **D-09:** **Tag-triggered GitHub Actions release workflow.** A new `.github/workflows/release.yml` runs on `v*` tag push. Matrix: `windows-latest` builds `.exe`; `ubuntu-latest` builds `.deb`. Both upload artifacts to a GitHub Release for the tag. A separate job publishes `@roadraven/core` to npm (using `NPM_TOKEN` repo secret) at the same tag. Existing `ci.yml` (lint/typecheck/test on PRs) stays as-is.
- **D-10:** **Stable channel only in v1.0.** The roadmap originally listed canary + stable. Canary is deferred to v1.1. The existing `Updater.localInfo.channel()` call in `packages/desktop/src/bun/index.ts` still runs unchanged — it returns "stable" for tagged builds and "dev" for unbundled checkouts (already correct per Phase 0 D-10).
- **D-11:** **Requirement edit (planner action):** PACK-02 says "canary + stable channels" — rewrite to "stable channel" for v1; document canary as a v1.1 follow-up. Add a note in CONTEXT for whichever phase introduces canary that the tag pattern reserved for it is `v*-canary.*`.

### Code signing (PACK-01, README)
- **D-12:** **Windows `.exe` ships unsigned in v1.0.** No Authenticode certificate purchase. Reason: cert costs ($200–500/yr), SmartScreen reputation requires the cert to age in, and there is no commercial pressure for v1.0 of an MIT-licensed OSS project. Document the SmartScreen warning + "More info → Run anyway" bypass in README.
- **D-13:** **Linux `.deb` ships unsigned in v1.0.** No GPG signing, no apt repository hosted. Users download and `sudo dpkg -i` manually. Document the install steps in README.
- **D-14:** **Out of Scope (PROJECT.md edit):** add "Code signing for v1.0 (Windows Authenticode, Linux GPG, macOS notarization) — deferred; document install warnings instead." This makes the deferral durable across phases.

### Documentation surface (PACK-05)
- **D-15:** **GitHub Pages serves `docs/`** in v1.0. Pick the simplest config that gives navigation + a landing page (Jekyll default theme, MkDocs, or Just the Docs — Claude's discretion). README links to the published site. Existing `docs/architecture-overview.md`, `docs/design-system.md`, `docs/development-guide.md`, `docs/logging.md`, `docs/rpc-and-ipc.md` form the bulk of the content; new docs added in this phase (plugin authoring guide, README polish) live alongside.
- **D-16:** **Plugin authoring guide covers Event API integration only** in v1. Document the WebSocket protocol, the event contract `{ nodeId, status, meta?, source? }`, sentinel-file discovery for the port, error/toast surfaces, and a worked example walking through `plugins/claude-code/` as the reference Event Producer. Honest framing: "v1.0 ships the Event API. The smart-adapter plugin system (in-process `RoadmapPlugin`) is v1.1." Do not document the v1.1 interface in detail — it may change.
- **D-17:** **`CONTRIBUTING.md` at the repo root.** Covers: local setup (`bun install`, `bun run dev:hmr`), running tests (`bun run verify`), code style (Biome via lint-staged + husky pre-commit), branch and PR conventions, and a pointer to `docs/development-guide.md` for deeper detail. References `.planning/` as orchestrator-managed (no contributor edits needed there).
- **D-18:** **README polish.** Existing README is good; v1 adds: install instructions per platform (Windows SmartScreen note, Linux dpkg command), a "First run on Windows" section, a link to the published docs site, a Contributing section linking to `CONTRIBUTING.md`, and an explicit feature-status block listing what's in v1 (Event API) vs v1.1 (plugin system, macOS, canary, React component library).

### Accessibility audit (PACK-06)
- **D-19:** **Manual checklist + automated baseline.** Run an automated tool against the rendered app (planner picks: axe-core CLI against the Vite dev server, Playwright + `@axe-core/playwright`, or Lighthouse — Claude's discretion). Then walk a manual checklist against PACK-06's specific items: full keyboard navigation through every interaction (tree edits, context menu, side panel, settings, save flow, drawer), ARIA roles on Radix-based menus and dialogs, color-not-sole-status (status badges already have text labels — verify there are no remaining color-only signals), focus indicators visible in all themes including high-contrast.
- **D-20:** Document the audit result as `05-A11Y-AUDIT.md` next to other phase artifacts. Findings are either fixed in this phase or filed as backlog items with severity. The audit pass criterion is: zero severity-blocker findings.

### MCP wrapper publication (existing in plugins/claude-code/)
- **D-21:** **`@roadraven/plugin-claude-code` is published to npm at the same lockstep version.** It already has `bin: roadraven-mcp` configured. Set `private: false` in the release flow (currently `private: true`). End users install with `npx -y @roadraven/plugin-claude-code` or wire it into their MCP config by package name. Reason: Phase 4 already shipped the wrapper as the reference Event Producer; making it pip-installable is a small packaging tweak that completes the Phase-4 promise. If lockstep versioning becomes a problem because the wrapper iterates faster, revisit in v1.1.

### CI / fallow gate
- **D-22:** **Do not enable the fallow CI gate in this phase.** A commented-out placeholder exists in `.github/workflows/ci.yml`. Per CLAUDE.md, fallow is informational and slated to be wired in "after the post-GSD dead-code cleanup lands." That cleanup is not part of Phase 5; treating it as a Phase 5 deliverable would balloon scope. Leave the placeholder commented out; note in CONTRIBUTING.md that contributors can run `bunx fallow audit --changed-since=HEAD` locally for guidance.
- **D-23:** **Add a CI invariant for `packages/core` zero-desktop-deps.** PACK-04 demands this. Implementation: a small CI step that fails if `packages/core/package.json` `dependencies` contains anything other than the allowed list (currently `zod`). Planner picks the exact mechanism (a tiny script run in the existing `lint` job is enough).

### Schema version field (tangential — confirming scope)
- **D-24:** **No new schema version field work in this phase.** PROJECT.md notes the version field is reserved for v3.0's migrator. Phase 5 does not touch the schema; if a `version` field is already emitted on save (it is not, per current code), nothing changes. If a "before-publish" cleanup wants to set the schema version explicitly, planner can decide as a tiny detail — but it is not a Phase 5 requirement.

### Claude's Discretion
- Build tool for `@roadraven/core` (tsup vs `tsc -p tsconfig.build.json` vs `bun build` — pick whichever is simplest and produces clean ESM + `.d.ts`)
- GitHub Pages tooling (Jekyll default theme, MkDocs, Just the Docs, raw HTML — pick the lightest path that gives a navigation sidebar)
- `version.json` URL strategy (release asset vs `gh-pages` branch — both work; the URL must be stable across releases)
- Tag pattern for stable releases (`v1.0.0` vs `vX.Y.Z` — semver is fine; just be consistent)
- Exact GitHub Actions matrix syntax and runner pinning
- Accessibility audit tool choice (axe-core CLI, Playwright + `@axe-core/playwright`, Lighthouse — pick what gives the cleanest signal)
- Linux `.deb` distro target (Ubuntu LTS version + Debian compatibility — `bundleCEF: true` covers most of the variance)
- LICENSE file placement (root + per-package vs root only — npm wants a LICENSE in each published package)
- Whether to include a SECURITY.md and a CODE_OF_CONDUCT.md alongside CONTRIBUTING.md (standard OSS hygiene; small effort)
- Specific release-flow tooling (changesets vs a hand-rolled bun script vs `npm version` — lockstep means the simplest works)
- Whether to enable npm provenance (`--provenance`) on publish (recommended if running from GH Actions OIDC; small extra step)
- Whether to wire the docs site build into the same release workflow or a separate `pages.yml`
- Specific `.gitignore` additions for build artifacts not yet ignored

### Folded Todos
None — `gsd-tools todo match-phase 05` returned zero matches.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 5 Requirements
- `.planning/REQUIREMENTS.md` §Packaging (PACK-01 through PACK-06) — full acceptance criteria. **Note edits required (D-05, D-08, D-11):** PACK-01 drop macOS, PACK-02 drop canary, PACK-04 use `@roadraven/` and drop `@roadraven/react` from v1.

### Roadmap
- `.planning/ROADMAP.md` §Phase 5 — phase goal, plan stubs, done-when criteria. Same edits flow through here.

### Architecture & Decisions
- `.planning/PROJECT.md` §Architecture — two-process model, Bun/Electrobun boundary, npm package roles.
- `.planning/PROJECT.md` §Constraints — TDD-first, MIT licensing, security default `127.0.0.1`.
- `.planning/PROJECT.md` §Key Decisions — Electrobun (not Electron), MCP wrapper + Event API as Claude Code integration, plugin system deferred to v1.1.
- `.planning/PROJECT.md` §Out of Scope — gains rows for macOS-v1, canary-v1, signing-v1 (D-14, D-08, D-11 cumulative requirement edits).

### Existing Code (already correct — must not regress)
- `packages/desktop/electrobun.config.ts` — `bundleCEF: true` on `mac`, `linux`, `win` (Phase 0 D-09). PACK-03 invariant satisfied.
- `packages/desktop/src/bun/index.ts:205` — `process.on("SIGTERM", …)` flushes pending writes and stops the event server (Phase 3 + 4). PACK-03 invariant satisfied.
- `packages/desktop/src/bun/index.ts` (full file) — uses `Updater.localInfo.channel()` wrapped in try/catch with "dev" fallback (Phase 0 D-10, SCAF-09). Auto-updater channel resolution must keep working.
- `packages/core/package.json` — only depends on `zod`. PACK-04 zero-desktop-deps invariant satisfied; CI must enforce it.
- `packages/core/src/index.ts` — re-exports schemas and types intended for the public package surface. This is what `@roadraven/core` ships.
- `plugins/claude-code/package.json` — `@roadraven/plugin-claude-code`, `bin: roadraven-mcp`, currently `private: true`. Flip to `private: false` for v1 publish.
- `.github/workflows/ci.yml` — existing PR-time gates (lint/typecheck/test) stay; release workflow is new.

### Prior Phase Context
- `.planning/phases/00-app-scaffold/00-CONTEXT.md` — `@roadraven/` package scope (D-01); `bundleCEF: true` from day one (D-09); `Updater.localInfo.channel()` try/catch (D-10); two-tier Playwright; Biome.
- `.planning/phases/01-visual-foundation-themes/01-CONTEXT.md` — Tailwind v4, `--rv-*` tokens, ThemeProvider, LogTape logging foundation. Accessibility audit must verify token-driven contrast in all themes including high-contrast.
- `.planning/phases/02-read-only-viewer/02-CONTEXT.md` — Zustand `roadmapStore`, `dataKey` invariant, react-d3-tree custom node rendering.
- `.planning/phases/03-full-editor/03-CONTEXT.md` — Radix primitives (ContextMenu, Dialog, DropdownMenu) — accessibility audit MUST verify ARIA roles + keyboard navigation through every Radix surface.
- `.planning/phases/04-event-api/04-CONTEXT.md` — Event API contract, sentinel file at `<userData>/event-api.json`, MCP wrapper at `plugins/claude-code/`. Plugin authoring guide is essentially a polished walkthrough of this surface.

### Tooling References
- Electrobun docs: https://blackboard.sh/electrobun/docs/guides/quick-start/
- Electrobun LLM API reference: https://blackboard.sh/electrobun/llms.txt — auto-updater config, channel detection, `electrobun build` flags.
- Electrobun source: https://github.com/blackboardsh/electrobun — verify auto-updater `version.json` shape and channel resolution behavior.
- GitHub Actions docs (matrix builds, artifact upload, release attach, `pages-deploy` action) — version pinning is Claude's discretion.
- npm publish docs (provenance, scoped public packages, `--access public` for first publish under a scope).

### Existing Repo Docs (reuse, do not rewrite)
- `README.md` — feature list, architecture, electrobun-vs-electron note. Phase 5 polishes, does not replace.
- `docs/architecture-overview.md` — process model + package structure diagram.
- `docs/development-guide.md` — local dev workflow.
- `docs/design-system.md`, `docs/logging.md`, `docs/rpc-and-ipc.md` — supporting reference.
- `CLAUDE.md` — project-level conventions (Electrobun not Electron, bun not npm). Linked from CONTRIBUTING.md.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `packages/desktop/electrobun.config.ts` — `bundleCEF: true` already on all three platforms; `app: { name: "RoadRaven", identifier: "RoadRaven.electrobun.dev", version: "0.0.1" }`. The version string here must be bumped on each release (planner picks: a script reading `package.json`, or `bun -e` substitution, or hand-edit + commit gate).
- `packages/desktop/src/bun/index.ts` — auto-updater channel resolution + dev-server fallback already correct (Phase 0). Release builds will simply have `Updater.localInfo.channel()` return "stable"; no code change needed for v1's stable-only model.
- `packages/desktop/package.json` — `build:canary` script (`vite build && electrobun build --env=canary`) is the existing build entry; planner adds an analogous `build:stable` for production tagged builds, or generalizes to `build` taking a channel arg.
- `packages/core/package.json` — currently `private: true`, `main: src/index.ts`, only `zod` as a dep. Three changes for publish: flip `private: false`, add a build script + `dist/` outputs, update `main`/`types`/`exports`/`files`.
- `packages/core/src/index.ts` — re-exports `IntegrationEvent`, `RoadmapPlugin`, schema types, and Zod schemas. This file IS the public API of `@roadraven/core`. No changes needed here — just ensure the build emits it correctly.
- `packages/react/package.json` — already has `peerDependencies: { react, react-dom }`. Stays `private: true` in v1 (per D-01).
- `plugins/claude-code/package.json` — already has `bin: { roadraven-mcp: "./dist/index.js" }` and a `build` script. Two changes for publish: flip `private: false`, ensure `dist/` is in the published tarball and that `dependencies` contains real semver ranges (currently fine).
- `plugins/claude-code/README.md` — exists; reuse + extend as the worked example in the plugin authoring guide.
- `.github/workflows/ci.yml` — existing PR gate. New `release.yml` lives alongside; no changes to the PR gate.
- `.husky/pre-commit` — already has fallow placeholder commented out (matches D-22).
- Existing `docs/` directory — five rich markdown files. Phase 5 adds: a plugin authoring guide, polishes README, adds CONTRIBUTING.md. Does not rewrite the existing five.

### Established Patterns
- **`@roadraven/` workspace scope** for every package (Phase 0 D-01). The release flow assumes this and the `--access public` flag on first publish.
- **Lockstep versioning** (D-04). All `package.json` `version` fields move together. `electrobun.config.ts` `app.version` also moves together. One git tag per release.
- **Atomic write pattern** for any new files this phase produces (release manifests, etc.). Reuse `packages/desktop/src/bun/atomicWrite.ts` if any in-app file generation appears.
- **LogTape categories** — if Phase 5 adds any new runtime code (probably it does not), use `roadraven.release.*` or fold into existing categories.
- **`--rv-*` CSS custom property tokens only** — accessibility audit verifies no token bypass in high-contrast theme.
- **Radix UI primitives** — accessibility audit verifies ARIA roles render correctly when bundled (production CEF webview, not just Vite dev).
- **Bun + bunx, never npm/npx/yarn/pnpm** — release workflow uses `bun install`, `bun run …`. Publish step still uses `bunx npm publish` or `npm publish` (npm CLI is the registry client; `bun publish` is workable but `npm publish` has the most predictable provenance support).

### Integration Points
- `packages/core/package.json` — add `build` script, `files: ["dist", "README.md", "LICENSE"]`, flip `private: false`, point `main`/`types`/`exports` to `dist/`. Add a per-package `LICENSE` (MIT) and a small `README.md` explaining what the package contains.
- `packages/core/tsconfig.build.json` (new) — emits `dist/` from `src/`. OR: use tsup config in `packages/core/tsup.config.ts`. Planner picks.
- `plugins/claude-code/package.json` — flip `private: false`, ensure `files`/`bin`/`exports` correctly publish the wrapper.
- `.github/workflows/release.yml` (new) — tag-triggered, matrix build for `windows-latest` + `ubuntu-latest`, artifact upload, GitHub Release creation/attach, `npm publish --access public --provenance` for `@roadraven/core` and `@roadraven/plugin-claude-code` on the same job.
- `.github/workflows/pages.yml` (new) OR an extra job in `release.yml` — builds and deploys `docs/` to GitHub Pages on tag push (or on master merge — planner decides; simpler to couple it to the release workflow).
- `.github/workflows/ci.yml` — add a small lint-job step that fails if `packages/core/package.json` dependencies drift outside the allowlist (D-23). Keep the fallow placeholder commented (D-22).
- `README.md` — polish: add v1.0 install instructions per platform, SmartScreen note, link to docs site, link to CONTRIBUTING.md, feature-status block.
- `CONTRIBUTING.md` (new, repo root) — local setup, test/lint/build commands, branch and PR conventions, link to `docs/development-guide.md`.
- `LICENSE` — MIT — at repo root and copied/symlinked into each published package's tarball via the `files` field.
- `docs/plugin-authoring.md` (new) — worked example: connect to the Event API, push events, handle errors, sentinel discovery; reference `plugins/claude-code/` as the canonical example. Honest about v1.1 plugin system being a separate, future story.
- `docs/_config.yml` or `mkdocs.yml` (new) — minimal GitHub Pages config (Claude's discretion which tool).
- `packages/desktop/electrobun.config.ts` — version bumped per release. Planner decides if this is automated (script reading workspace version) or hand-bumped (commit gate).
- New: small CI-time script verifying `packages/core/package.json` dependency allowlist (D-23). Lives wherever feels right (`scripts/check-core-deps.ts` or similar).

</code_context>

<specifics>
## Specific Ideas

- **Tag pattern reservation:** v1.0 stable releases use `vX.Y.Z` (e.g., `v1.0.0`). Reserve `vX.Y.Z-canary.N` for the v1.1 canary work so the workflow's tag-pattern matcher can be extended without renaming existing tags.
- **README "First run on Windows" section** is non-negotiable — without it the unsigned `.exe` decision (D-12) creates avoidable user friction. Include a screenshot of the SmartScreen dialog and the exact "More info → Run anyway" path.
- **Linux install instructions** in README: `sudo dpkg -i roadraven_VERSION_amd64.deb` followed by the optional `sudo apt-get install -f` for dependency resolution. Mention that `bundleCEF: true` keeps the CEF runtime self-contained (no system Chromium dependency).
- **`@roadraven/core` README** in the published tarball is small but matters — covers what's exported, links to the docs site for the full schema reference, and clearly states "Type and schema package — not a runtime; pair with `@roadraven/plugin-claude-code` or your own producer for live integration."
- **Claude Code MCP wrapper as the worked example** in the plugin authoring guide: walk through `plugins/claude-code/src/server.ts`, `wsClient.ts`, sentinel resolution, hello-frame, exponential backoff. The reader should be able to fork it as a template for a new producer (e.g., a CI-pipeline wrapper).
- **Accessibility audit timing:** run the audit against a production-built app, not the dev server. Reason: a Phase-1 token bypass or a Radix ARIA regression might only appear in CEF-bundled production output. Audit ordering: build .exe + .deb first → install one → audit the installed app.
- **Don't ship `samples/` in the published `@roadraven/core` tarball.** Samples are for the desktop app's WelcomeScreen, not the schema package. Use `files` to scope the published tree.
- **npm provenance:** if running publish from GH Actions OIDC, use `npm publish --provenance --access public`. Adds ~30s but provides supply-chain attestation that's becoming a community expectation.

</specifics>

<deferred>
## Deferred Ideas

Captured here so they're not lost, but explicitly out of scope for this phase.

- **macOS `.dmg` build, signing, notarization** — v1.1. Requires Apple Developer Program membership ($99/yr), notarization tooling, hardware/keychain wiring in CI.
- **Canary release channel** — v1.1. Tag pattern `v*-canary.*` reserved; a future phase wires the second `version.json` and ships a separate canary GitHub Release stream.
- **`@roadraven/react` component package** — v1.1+. Requires extracting reusable React components from `packages/desktop` (TreeCanvas, RoadmapNodeCard, ThemeProvider, SidePanel) into a headless library decoupled from the Electrobun RPC layer. Likely needs its own discuss/plan/execute cycle.
- **Authenticode signing of the Windows `.exe`** — v1.1+. Buy an OV or EV certificate when commercial pressure or user feedback demands it. Sign in CI via GitHub Secrets + signtool.exe (OV) or hardware token (EV).
- **GPG signing of the Linux `.deb` + apt repository** — v1.1+. Better install UX (`apt install`) at the cost of GPG key management and apt repo metadata generation.
- **Self-hosted release infrastructure (S3 / R2 / custom CDN)** — v1.1+. Only if GitHub Releases bandwidth or geographic latency becomes a real complaint.
- **Dedicated documentation site (Astro / Starlight / VitePress)** — v1.1+. GitHub Pages from `docs/` is enough until the project has external contributors and a real DX expectation.
- **Telemetry, crash reporting, or analytics in installers** — out of scope, not just deferred. Would change the "no phone home" posture; revisit if and when there's a clear policy.
- **fallow CI gate** — informational tool, gated on the post-GSD dead-code cleanup (per CLAUDE.md). Enable in a future phase, not Phase 5.
- **Schema migration tooling (`@roadraven/core` migrator)** — v3.0. Reserved version field and hook point already in scope; the migrator itself is far future.
- **Plugin authoring SDK (real `RoadmapPlugin` interface, lifecycle, secrets management)** — v1.1, parallel to the plugin-system work.
- **Code of Conduct + SECURITY.md** — small OSS hygiene additions; planner may include if cheap, otherwise file as a backlog follow-up.
- **Auto-updater offline / failure UX polish** — currently the Updater silently falls through. A future phase can add a status surface; not blocking v1.0.

</deferred>

<reconciliation>
## Post-Research Reconciliation (2026-05-03)

Research surfaced four open questions; user resolved each. These decisions LOCK and SUPERSEDE the conflicting items above where noted.

### R-01: Linux installer format → `.tar.gz` (supersedes D-07/D-08 Linux assumption)
**Decision:** Ship Electrobun's native `.tar.gz` self-extracting setup. Do NOT attempt to wrap in `.deb`.
**Why:** Electrobun v1.16.0 does not produce native `.deb` files. Linux output is `{channel}-linux-x64-RoadRavenSetup-{channel}.tar.gz` containing a self-extracting installer. Wrapping in `.deb` via `dpkg-deb --build` would burn engineering time on packaging Electrobun was not designed to support, for marginal UX improvement.
**Planner action — UPDATE D-07/D-08 effective scope:**
- v1.0 Linux installer = `.tar.gz` (NOT `.deb`)
- PACK-01 requirement edit: rewrite Linux line to `.tar.gz` (Ubuntu/Debian self-extracting bundle), NOT `.deb`
- PROJECT.md "Out of Scope" gains row: "`.deb` packaging for v1.0 (Electrobun-native `.tar.gz` ships instead) — `.deb` wrapper deferred to v1.1 alongside GPG signing + apt repo if user demand emerges."
- README Linux install instructions: `tar -xzf RoadRavenSetup-stable.tar.gz && cd <extracted> && ./RoadRavenSetup` — NOT `sudo dpkg -i`. Mention `bundleCEF: true` keeps CEF runtime self-contained.
- D-13 still applies (unsigned), but the "GPG signing of Linux `.deb`" deferral row in PROJECT.md should be reworded to "GPG signing + `.deb` packaging for Linux."

### R-02: Windows installer surface → `-Setup.exe` inside `.zip`
**Decision:** Document the actual Electrobun output shape in README.
**Why:** Electrobun produces `{channel}-win-x64-RoadRaven-Setup-{channel}.zip` containing the `-Setup.exe`. README "First run on Windows" must instruct users to download the `.zip`, extract, and run `RoadRaven-Setup.exe`.
**Planner action:**
- README Windows install section: "Download `.zip` → extract → double-click `RoadRaven-Setup.exe` → SmartScreen warning (More info → Run anyway)" — not "download `.exe` directly."
- PACK-01 requirement edit: clarify Windows artifact is `-Setup.exe` distributed inside a `.zip`.

### R-03: npm authentication → OIDC trusted publishing
**Decision:** Use OIDC trusted publishing (npm trusted publishers, GA July 2025). No `NPM_TOKEN` secret.
**Why:** Eliminates long-lived secret rotation burden, gives free supply-chain provenance attestation. Requires one-time npmjs.com Trusted Publishers config + `permissions: { id-token: write, contents: read }` in the publish workflow job.
**Planner action:**
- `.github/workflows/release.yml` npm publish job uses `permissions: { id-token: write, contents: read }`
- Publish command: `npm publish --provenance --access public` (npm CLI is the only authorized exception to bun-only — explicit comment in workflow)
- README/CONTRIBUTING.md does NOT need to mention auth — it's invisible to contributors
- One-time setup checklist (planner generates as a `RELEASE-OPS.md` or similar): npmjs.com → Settings → Trusted Publishers → add publisher for `@roadraven/core` and `@roadraven/plugin-claude-code` pointing at `Shuffzord/RoadRaven` repo + `release.yml` workflow + `release` environment (if used)
- Pre-flight: confirm both `@roadraven/core` and `@roadraven/plugin-claude-code` package names are unclaimed on npm (or owned by the user) BEFORE the first release tag

### R-04: Accessibility audit scope → `vite preview` + `@axe-core/playwright`
**Decision:** Run `@axe-core/playwright` against `vite preview` (port 4173, production renderer bundle). NOT against the CEF-bundled binary.
**Why:** `vite preview` serves the production-built renderer bundle (same CSS/JS that ships in the installer's webview). Driving the shipped CEF binary with Playwright is not a paved path — Electrobun has no documented Playwright integration. The pragmatic compromise gives 95% audit coverage with paved-path tooling.
**Planner action:**
- Add `@axe-core/playwright@4.11.3` (verify latest at task time) as workspace devDependency
- Audit harness: a Playwright test that runs `vite preview` on port 4173, navigates to the rendered app, runs `AxeBuilder` with `withTags(['wcag2a', 'wcag2aa'])`, asserts zero violations after manual override list (any token-bypass false positives go in the override list with rationale)
- `05-A11Y-AUDIT.md` documents:
  - Tool: `@axe-core/playwright` against `vite preview` build output
  - Caveat: audit was NOT run against the final CEF-bundled binary; production CEF rendering of `--rv-*` tokens, Radix ARIA, and focus rings should be visually spot-checked manually post-install
  - Manual checklist: keyboard-only navigation through tree edits, context menu (Radix), side panel, settings drawer, save flow, theme switcher (axe doesn't verify tab order)
  - Findings: severity-classified, blocker findings fixed in this phase, lower severity filed as backlog
  - Pass criterion: zero severity-blocker findings in axe + zero blocking issues in manual checklist

### R-05: Bundle identifier → keep `RoadRaven.electrobun.dev` (no change)
**Decision:** Do NOT change `app.identifier` in `electrobun.config.ts` for v1.0.
**Why:** Already in production-ready code. The `RoadRaven.` prefix is unique enough; changing identifiers after v1.0 ships orphans installed users' settings/data directories. One-way door — only change for compelling reason.
**Planner action:** No change to `electrobun.config.ts` `app.identifier`. No task needed.

### R-06: Wave breakdown (planner guidance, not a locked decision)
**Recommended structure** (planner may adjust if dependency graph dictates):
- **Wave 1:** Workspace prep + npm package builds — `@roadraven/core` tsup config, `package.json` deltas (private→public, main/types/exports/files), build script, per-package LICENSE, README; same shape for `@roadraven/plugin-claude-code` private→public flip.
- **Wave 2:** Release workflow + CI core-deps gate — `.github/workflows/release.yml` (tag-triggered, per-platform jobs not matrix, npm publish job with OIDC), small CI script enforcing `packages/core` zero-desktop-deps allowlist as new step in `ci.yml` lint job.
- **Wave 3:** Docs site + CONTRIBUTING + README polish (PARALLEL with Wave 2) — Just-the-Docs `_config.yml`, GitHub Pages deploy job (either appended to release.yml or separate `pages.yml`), `CONTRIBUTING.md`, README install/feature-status/Contributing sections, `docs/plugin-authoring.md`, per-package READMEs.
- **Wave 4:** Accessibility audit (depends on Wave 3 docs landing for stable surfaces, but Wave 3 itself doesn't change UI — can start as soon as Wave 1 settles) — `@axe-core/playwright` test harness, run against `vite preview`, manual checklist walk, `05-A11Y-AUDIT.md` write-up.
- **Wave 5 (optional):** Requirement edits — touch REQUIREMENTS.md (PACK-01/02/04) and PROJECT.md ("Out of Scope" rows). Could fold into Wave 1 if planner prefers; doc-only diffs are low-risk.

</reconciliation>

---

*Phase: 05-packaging-distribution*
*Context gathered: 2026-05-03*
*Reconciled: 2026-05-03 (post-research)*
