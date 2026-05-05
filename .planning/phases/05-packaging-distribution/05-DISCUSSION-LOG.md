# Phase 5: Packaging & Distribution - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-03
**Phase:** 05-packaging-distribution
**Areas discussed:** @roadraven/react scope, Release & update hosting, Code signing & notarization, Docs site & guide content

---

## Gray Area Selection

| Option | Description | Selected |
|--------|-------------|----------|
| @roadraven/react scope | Empty `export {};`. Extract real components, defer to v1.1, or ship placeholder. | ✓ |
| Release & update hosting | GitHub Releases vs self-hosted vs no auto-updater. | ✓ |
| Code signing & notarization | Sign+notarize, ship unsigned with bypass docs, or macOS-only. | ✓ |
| Docs site & guide content | GitHub Pages vs dedicated site vs README only; plugin guide content. | ✓ |

**User's choice:** All four selected.

---

## @roadraven/react scope

### Q1: What does @roadraven/react actually ship in v1?

| Option | Description | Selected |
|--------|-------------|----------|
| Defer to v1.1 (Recommended) | Publish only @roadraven/core in v1. Update PACK-04. Lowest risk for hitting the milestone. | ✓ |
| Ship a minimal placeholder | Re-export types + maybe a thin TreeRenderer wrapper. Reserves the npm name with little real value. | |
| Extract real components from desktop | Pull TreeCanvas, RoadmapNodeCard, ThemeProvider, SidePanel into a headless library. Substantial scope addition. | |

**User's choice:** Defer to v1.1.
**Notes:** Reflects in CONTEXT D-01 / D-05; PACK-04 needs requirement edit.

### Q2: Should we publish @roadraven/core at all in v1?

| Option | Description | Selected |
|--------|-------------|----------|
| Publish @roadraven/core in v1 (Recommended) | Real content (Zod schemas, IntegrationEvent, RoadmapPlugin types, zero desktop deps). | ✓ |
| Defer all npm publishing to v1.1 | MCP wrapper would have to copy/redeclare the event contract. | |

**User's choice:** Publish @roadraven/core in v1.
**Notes:** D-02.

### Q3: What gets published from @roadraven/core?

| Option | Description | Selected |
|--------|-------------|----------|
| Pre-built ESM + .d.ts (Recommended) | Build to dist/; main/types/exports point at dist/. Works for any consumer. | ✓ |
| Source-only (current shape) | main: src/index.ts. Breaks Node ESM and isolatedModules consumers. | |
| Dual ESM + CJS | Build both with conditional exports. Overkill for current consumers. | |

**User's choice:** Pre-built ESM + .d.ts.
**Notes:** D-03. Tool choice (tsup vs tsc) is Claude's discretion.

### Q4: Versioning across the workspace?

| Option | Description | Selected |
|--------|-------------|----------|
| Lockstep (Recommended) | All packages bump together. One git tag per release. | ✓ |
| Independent versions | Per-package cadence. Adds release-process complexity early. | |
| Defer the question | Pick one for v1.0, revisit on real divergence. | |

**User's choice:** Lockstep.
**Notes:** D-04.

---

## Release & update hosting

### Q1: Where do installers + auto-updater manifests live?

| Option | Description | Selected |
|--------|-------------|----------|
| GitHub Releases (Recommended) | Free, public, integrates with Actions, stable per-asset URLs. | ✓ |
| Cloudflare R2 / S3 bucket | Self-hosted control, custom domain. Adds DNS + secrets overhead. | |
| No auto-updater in v1.0 | Skip auto-update wiring entirely; users re-download. | |

**User's choice:** GitHub Releases.
**Notes:** D-06. version.json hosting strategy (release asset vs gh-pages branch) left to planner.

### Q2: Which platforms ship in v1.0?

| Option | Description | Selected |
|--------|-------------|----------|
| macOS .dmg | Builds on macos-latest. Without notarization, Gatekeeper warning. | |
| Windows .exe | Builds on windows-latest. Without Authenticode, SmartScreen warning. | ✓ |
| Linux .deb | Builds on ubuntu-latest. No signing-pipeline blockers on Linux. | ✓ |

**User's choice:** Windows .exe + Linux .deb. macOS NOT selected.
**Notes:** D-07. Significant scope shift from PACK-01 (which lists all three). Triggers requirement edit.

### Q3: Confirming macOS deferral?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, defer to v1.1 (Recommended) | Drop PACK-01 macOS scope. Avoids Apple Developer cert + notarization tooling cost. | ✓ |
| Keep macOS but ship unsigned | Build .dmg in CI, document Gatekeeper bypass. UX is rough. | |

**User's choice:** Defer to v1.1.
**Notes:** D-08.

### Q4: Release trigger?

| Option | Description | Selected |
|--------|-------------|----------|
| Git tag triggers GH Actions (Recommended) | Push tag → matrix builds + Release attach + npm publish. | ✓ |
| Manual local build + manual upload | Error-prone, doesn't scale, Windows-from-Linux needs Wine. | |
| GH Actions on workflow_dispatch only | Manual trigger from GitHub UI; less automated than tags. | |

**User's choice:** Git tag triggers GH Actions.
**Notes:** D-09.

### Q5: Auto-updater channels?

| Option | Description | Selected |
|--------|-------------|----------|
| Canary + stable from day one (Recommended) | Two version.json manifests; tag pattern decides channel. | |
| Stable only in v1.0, canary in v1.1 | Single channel until there's a real reason to split. Simpler initially. | ✓ |

**User's choice:** Stable only in v1.0.
**Notes:** D-10 / D-11. Roadmap PACK-02 needs requirement edit.

---

## Code signing & notarization

### Q1: Sign the Windows .exe in v1.0?

| Option | Description | Selected |
|--------|-------------|----------|
| Ship unsigned with bypass docs (Recommended) | Document SmartScreen warning in README. Cert costs ($200-500/yr) not justified for v1.0 OSS. | ✓ |
| Sign with a code-signing cert in v1.0 | Avoids SmartScreen warning. Real yearly cost, ops effort. | |
| Defer the decision | Ship unsigned, revisit if user feedback shows friction. | |

**User's choice:** Ship unsigned with bypass docs.
**Notes:** D-12. README must include SmartScreen bypass section. D-14 adds to PROJECT Out of Scope.

### Q2: Linux .deb signing / repo hosting?

| Option | Description | Selected |
|--------|-------------|----------|
| Unsigned .deb in GitHub Releases (Recommended) | Manual `sudo dpkg -i`. Matches small-OSS norms. | ✓ |
| Signed .deb + a hosted apt repo | Better UX (`apt install`) at the cost of GPG/repo overhead. Defer to v1.1. | |

**User's choice:** Unsigned .deb in GitHub Releases.
**Notes:** D-13.

---

## Docs site & guide content

### Q1: How are docs published in v1?

| Option | Description | Selected |
|--------|-------------|----------|
| GitHub Pages from /docs (Recommended) | Zero new infra, builds for free in Actions, search-indexable. | ✓ |
| Dedicated docs site (Astro / Starlight / VitePress) | Best UX but real time investment to set up + maintain. | |
| README only — no separate site | Polish README only; keep docs/ in-repo. | |

**User's choice:** GitHub Pages from /docs.
**Notes:** D-15. Tool choice (Jekyll, MkDocs, Just the Docs) is Claude's discretion.

### Q2: What does the plugin authoring guide cover in v1?

| Option | Description | Selected |
|--------|-------------|----------|
| Event API integration only (Recommended) | Document WS protocol, event contract, sentinel discovery; claude-code MCP as worked example. Honest framing of v1.1 plugin system. | ✓ |
| Event API + v1.1 plugin foreshadowing | Document both. Risks documenting an unstable interface. | |
| Skip the guide entirely in v1 | Drop PACK-05 plugin-guide requirement to v1.1. | |

**User's choice:** Event API integration only.
**Notes:** D-16. Walk through plugins/claude-code/ as the canonical example.

### Q3: How do contributors learn the workflow?

| Option | Description | Selected |
|--------|-------------|----------|
| CONTRIBUTING.md at repo root (Recommended) | Standard OSS pattern. Local setup, tests, GSD workflow, code style, PR conventions. | ✓ |
| Inline in README | Less discoverable; would bloat README. | |

**User's choice:** CONTRIBUTING.md at repo root.
**Notes:** D-17.

---

## Wrap-up

### Q: Anything else to discuss before writing CONTEXT.md?

| Option | Description | Selected |
|--------|-------------|----------|
| I'm ready for context | Write CONTEXT.md with decisions captured. | ✓ |
| Explore more gray areas | Discuss accessibility audit approach, schema-version field, etc. | |

**User's choice:** Ready for context.

---

## Claude's Discretion

Captured in CONTEXT.md `<decisions>` "Claude's Discretion" subsection. Items deferred to planner:

- Build tool for `@roadraven/core` (tsup vs tsc vs `bun build`)
- GitHub Pages tooling (Jekyll, MkDocs, Just the Docs, raw HTML)
- `version.json` URL strategy (release asset vs `gh-pages` branch)
- Tag pattern specifics (`vX.Y.Z` confirmed, exact regex left to workflow)
- GH Actions matrix syntax and runner pinning
- Accessibility audit tool (axe-core CLI, Playwright + axe, Lighthouse)
- Linux `.deb` distro target
- LICENSE file placement (root vs per-package)
- SECURITY.md / CODE_OF_CONDUCT.md inclusion
- Release-flow tooling (changesets vs hand-rolled bun script vs `npm version`)
- npm provenance (`--provenance` on publish)
- Coupling docs-site build into release workflow vs separate `pages.yml`
- Specific `.gitignore` additions for build artifacts

## Deferred Ideas

Captured in CONTEXT.md `<deferred>`:

- macOS `.dmg` (v1.1)
- Canary channel (v1.1)
- `@roadraven/react` component package (v1.1+)
- Windows Authenticode signing (v1.1+)
- Linux GPG signing + apt repo (v1.1+)
- Self-hosted release infra (v1.1+)
- Dedicated docs site (v1.1+)
- Telemetry / crash reporting (out of scope, not deferred)
- fallow CI gate (post-GSD cleanup phase)
- Schema migrator (v3.0)
- Real plugin SDK (v1.1)
- Auto-updater offline UX polish (future)
