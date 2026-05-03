---
phase: 05-packaging-distribution
plan: 04
type: execute
wave: 3
depends_on: ["05-01", "05-03"]
files_modified:
  - docs/_config.yml
  - docs/index.md
  - docs/architecture-overview.md
  - docs/development-guide.md
  - docs/rpc-and-ipc.md
  - docs/design-system.md
  - docs/logging.md
  - docs/plugin-authoring.md
  - .github/workflows/release.yml
  - CONTRIBUTING.md
  - README.md
autonomous: true
requirements: [PACK-05]
threats: [T-05-06, T-05-10]
tags: [packaging, docs, github-pages, contributing, readme]

must_haves:
  truths:
    - "docs/_config.yml exists with Just-the-Docs remote_theme + sidebar nav configuration"
    - "Existing docs/*.md files have Just-the-Docs front matter (title, nav_order); content is NOT rewritten"
    - "docs/index.md exists as the landing page (replaces /README at the docs site root)"
    - "docs/plugin-authoring.md exists covering Event API integration with the claude-code MCP wrapper as the worked example (D-16)"
    - "CONTRIBUTING.md at the repo root covers local setup, tests, code style, branch/PR conventions, fallow-as-local-tool note (D-22)"
    - "README.md gains: per-platform install instructions (R-01 Linux .tar.gz, R-02 Windows .zip→-Setup.exe with SmartScreen note D-12), feature-status block (v1 vs v1.1), Contributing section, link to published docs site"
    - ".github/workflows/release.yml gains a `deploy-docs` job that runs after `github-release` to deploy GH Pages"
    - "fallow IS NOT enabled in CI (D-22 — verify the placeholder remains commented after Plan 05-03's edits)"
  artifacts:
    - path: "docs/_config.yml"
      provides: "Just-the-Docs Jekyll site config with sidebar"
      contains: "remote_theme: just-the-docs/just-the-docs"
    - path: "docs/index.md"
      provides: "Landing page for the published docs site"
      contains: "title: Home"
    - path: "docs/plugin-authoring.md"
      provides: "Event API integration guide; references claude-code wrapper"
      contains: "IntegrationEvent"
    - path: "CONTRIBUTING.md"
      provides: "Repo-root contributor guide"
      contains: "bun install"
    - path: "README.md (modified)"
      provides: "Polished v1 README with install, feature-status, contributing, docs links"
      contains: "RoadRaven-Setup.exe"
    - path: ".github/workflows/release.yml (modified — adds deploy-docs job)"
      provides: "GH Pages deploy step in the release pipeline"
      contains: "actions/deploy-pages@v4"
  key_links:
    - from: "docs/_config.yml"
      to: "remote_theme just-the-docs/just-the-docs"
      via: "Jekyll remote_theme plugin"
      pattern: "just-the-docs"
    - from: "docs/plugin-authoring.md"
      to: "plugins/claude-code/ source files"
      via: "worked-example walkthrough"
      pattern: "plugins/claude-code"
    - from: "README.md"
      to: "CONTRIBUTING.md + docs site URL + docs/plugin-authoring.html"
      via: "markdown links"
      pattern: "CONTRIBUTING.md"
    - from: ".github/workflows/release.yml deploy-docs job"
      to: "docs/_config.yml + actions/jekyll-build-pages"
      via: "Jekyll build → Pages deploy"
      pattern: "jekyll-build-pages"
---

<objective>
Land the docs surface (PACK-05). Three deliverables, one workflow:

1. **GitHub Pages site** — Just-the-Docs theme with sidebar; existing 5 markdown
   files in `docs/` get front matter (no content rewrite); new `docs/index.md`
   landing page; new `docs/plugin-authoring.md` covering Event API integration.

2. **CONTRIBUTING.md** — repo root; covers local setup, tests, code style,
   branch/PR conventions; mentions `bunx fallow audit --changed-since=HEAD` as
   an optional local tool (D-22 — fallow is NOT a CI gate).

3. **README polish** — v1 install instructions per R-01 (Linux .tar.gz) and
   R-02 (Windows .zip → -Setup.exe with SmartScreen warning per D-12);
   feature-status block (v1 vs v1.1); Contributing + docs links.

Plus the GH Pages **deploy job** appended to `.github/workflows/release.yml`
(created in Plan 05-03; runs in parallel wave with this plan — both touch
release.yml so coordinate via the file ownership; see "Coordination with Plan
05-03" below).

This plan runs in **parallel** with Plan 05-03 (Wave 2). Plan 05-03 owns the
release workflow's main jobs (build, publish-npm); this plan only APPENDS the
`deploy-docs` job. Both plans CAN modify `.github/workflows/release.yml` if
ordered correctly: Plan 05-03 runs first (creates the file), this plan runs
second (appends). The dependency graph in this plan's frontmatter records
`depends_on: ["05-01", "05-03"]` only because the file-ownership conflict with 05-03
is small (one job append at end of file). If executors run truly in parallel,
the second-to-merge worktree must rebase — orchestrator handles via wave
sequencing if needed.

Output:
- `docs/_config.yml` (Jekyll/Just-the-Docs config)
- `docs/index.md` (landing page)
- `docs/plugin-authoring.md` (Event API guide)
- Front matter added to 5 existing `docs/*.md` files (architecture-overview, development-guide, rpc-and-ipc, design-system, logging)
- `CONTRIBUTING.md` (new, repo root)
- `README.md` (polished — install per platform, feature-status, contributing, docs links)
- `.github/workflows/release.yml` (gains `deploy-docs` job)
</objective>

<execution_context>
@C:\Work\RoadRaven\.claude\get-shit-done\workflows\execute-plan.md
@C:\Work\RoadRaven\.claude\get-shit-done\templates\summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/REQUIREMENTS.md
@.planning/phases/05-packaging-distribution/05-CONTEXT.md
@.planning/phases/05-packaging-distribution/05-RESEARCH.md
@.planning/phases/04-event-api/04-CONTEXT.md
@README.md
@plugins/claude-code/README.md
@docs/architecture-overview.md
@docs/development-guide.md
@docs/rpc-and-ipc.md
@docs/design-system.md
@docs/logging.md

<interfaces>
<!-- TARGET shapes for this plan's deliverables -->

<!-- docs/_config.yml shape: copy from RESEARCH.md Pattern 4 (lines 556-592) -->

<!-- docs/plugin-authoring.md shape: see RESEARCH.md "Plugin Authoring Guide outline"
     (lines 950-1041) — that outline is the SKELETON; flesh out the worked-example
     section by reading actual plugins/claude-code/src/*.ts files. -->

<!-- README polish target: existing README has Quick start, Project structure,
     Electrobun sections. ADD: install (per-platform), feature-status, Contributing,
     Docs site link. KEEP: existing Quick start (rephrase to dev-from-source),
     Project structure, Electrobun. -->

<!-- CONTRIBUTING.md target: per D-17 — local setup (bun install, bun run dev:hmr),
     tests (bun run verify), code style (Biome via lint-staged + husky), branch/PR
     conventions, pointer to docs/development-guide.md, fallow-as-local-tool note. -->

<!-- deploy-docs job: copy from RESEARCH.md Pattern 3 (lines 510-531) -->

<!-- Front-matter pattern for existing docs files (RESEARCH.md ~596-614) -->
<!-- nav_order assignments: -->
<!-- index.md → 1, architecture-overview.md → 2, development-guide.md → 3, -->
<!-- rpc-and-ipc.md → 4, design-system.md → 5, logging.md → 6, -->
<!-- plugin-authoring.md → 7 -->
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create docs/_config.yml + docs/index.md + add front matter to existing docs</name>

  <read_first>
    - .planning/phases/05-packaging-distribution/05-RESEARCH.md `## Architecture Patterns > Pattern 4: GitHub Pages with Just-the-Docs` (lines ~550-616) — copy _config.yml literally; copy front-matter pattern
    - docs/architecture-overview.md (front-matter target — read the existing first 5 lines to know what to PREpend)
    - docs/development-guide.md (same)
    - docs/rpc-and-ipc.md (same)
    - docs/design-system.md (same)
    - docs/logging.md (same)
    - README.md (for the index.md landing-page summary)
  </read_first>

  <files>
    docs/_config.yml
    docs/index.md
    docs/architecture-overview.md
    docs/development-guide.md
    docs/rpc-and-ipc.md
    docs/design-system.md
    docs/logging.md
  </files>

  <action>
    **A. Create `docs/_config.yml`** — copy literally from RESEARCH.md Pattern 4:

    ```yaml
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

    # Plugins (GitHub Pages allows these by default)
    plugins:
      - jekyll-remote-theme

    # Aux links (top-right corner)
    aux_links:
      GitHub: https://github.com/Shuffzord/RoadRaven
      "npm @roadraven/core": https://www.npmjs.com/package/@roadraven/core

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

    Note: omit the `logo: /assets/logo.png` line from RESEARCH.md — there is no logo asset in the repo. Add later if a logo lands.

    **B. Create `docs/index.md`** — landing page (NEW file):

    ```markdown
    ---
    title: Home
    nav_order: 1
    layout: default
    ---

    # RoadRaven

    A keyboard-first desktop editor for visual roadmap trees. Built on
    [Electrobun](https://blackboard.sh/electrobun/) (not Electron); runtime is Bun.

    ## Quick links

    | What | Where |
    |------|-------|
    | Install (Windows + Linux) | [README — install](https://github.com/Shuffzord/RoadRaven#install) |
    | Architecture overview | [Architecture](architecture-overview.html) |
    | Local development | [Development guide](development-guide.html) |
    | RPC contract reference | [RPC and IPC](rpc-and-ipc.html) |
    | Design system + tokens | [Design system](design-system.html) |
    | Structured logging | [Logging](logging.html) |
    | **Build a producer for the Event API** | [Plugin authoring guide](plugin-authoring.html) |

    ## What's in v1

    - Keyboard-first roadmap editor (read + write)
    - JSON schema-driven node types and statuses
    - Live status updates from external producers via WebSocket Event API
    - Reference Event Producer: `@roadraven/plugin-claude-code`
       — npm-installable MCP wrapper for Claude Code

    ## What's NOT in v1 (deferred to v1.1+)

    - macOS `.dmg` installer
    - Canary release channel
    - `@roadraven/react` component package
    - Smart-adapter Plugin System (the in-app `RoadmapPlugin` host)
    - Code signing (Authenticode / GPG / notarization)

    See the [README — feature status](https://github.com/Shuffzord/RoadRaven#feature-status)
    for the full v1 vs. v1.1 split.

    ## Packages on npm

    - [`@roadraven/core`](https://www.npmjs.com/package/@roadraven/core)
       — Zod schemas + types (zero desktop deps)
    - [`@roadraven/plugin-claude-code`](https://www.npmjs.com/package/@roadraven/plugin-claude-code)
       — MCP wrapper that lets Claude Code push live updates to a running app
    ```

    **C. Add front matter to each EXISTING `docs/*.md` file.** Read each file's first line (must currently be a markdown heading like `# Architecture Overview`). PREPEND a front-matter block:

    For `docs/architecture-overview.md` — prepend:
    ```
    ---
    title: Architecture Overview
    nav_order: 2
    layout: default
    ---

    ```

    For `docs/development-guide.md` — prepend:
    ```
    ---
    title: Development Guide
    nav_order: 3
    layout: default
    ---

    ```

    For `docs/rpc-and-ipc.md` — prepend:
    ```
    ---
    title: RPC and IPC
    nav_order: 4
    layout: default
    ---

    ```

    For `docs/design-system.md` — prepend:
    ```
    ---
    title: Design System
    nav_order: 5
    layout: default
    ---

    ```

    For `docs/logging.md` — prepend:
    ```
    ---
    title: Logging
    nav_order: 6
    layout: default
    ---

    ```

    **DO NOT modify the existing content** of these files — the prepended front matter is the only change. The existing content (after the front matter) stays byte-identical.

    **D. Verify each modified file** — open and confirm the original first heading is still present immediately after the front-matter block, with one blank line separating them.
  </action>

  <verify>
    <automated>test -f docs/_config.yml && echo OK</automated>
    <automated>test -f docs/index.md && echo OK</automated>
    <automated>grep -c "remote_theme: just-the-docs/just-the-docs" docs/_config.yml  # MUST be 1</automated>
    <automated>grep -c "baseurl: /RoadRaven" docs/_config.yml  # MUST be 1</automated>
    <automated>grep -c "title: Home" docs/index.md  # MUST be 1 (front matter)</automated>
    <automated>head -5 docs/architecture-overview.md | grep -c "title: Architecture Overview"  # MUST be 1</automated>
    <automated>head -5 docs/development-guide.md | grep -c "title: Development Guide"  # MUST be 1</automated>
    <automated>head -5 docs/rpc-and-ipc.md | grep -c "title: RPC and IPC"  # MUST be 1</automated>
    <automated>head -5 docs/design-system.md | grep -c "title: Design System"  # MUST be 1</automated>
    <automated>head -5 docs/logging.md | grep -c "title: Logging"  # MUST be 1</automated>
  </verify>

  <acceptance_criteria>
    - `docs/_config.yml` exists; contains literal lines `remote_theme: just-the-docs/just-the-docs`, `baseurl: /RoadRaven`, `search_enabled: true`, `nav_enabled: true`
    - `docs/_config.yml` does NOT contain a `logo:` line (no asset in repo yet)
    - `docs/index.md` exists; first 5 lines are the front-matter block ending with `---`; `title: Home`, `nav_order: 1`
    - `docs/index.md` contains links to `architecture-overview.html`, `plugin-authoring.html`, `https://www.npmjs.com/package/@roadraven/core`
    - All 5 existing docs/*.md files have front-matter blocks prepended; `head -5` shows the front matter; line 6+ is the original content unchanged
    - `nav_order` values are 1 (index), 2 (architecture-overview), 3 (development-guide), 4 (rpc-and-ipc), 5 (design-system), 6 (logging)
    - `git diff docs/architecture-overview.md` shows ONLY the prepended front-matter block (no other content changes)
    - Same for the other 4 existing files (no body content modifications)
  </acceptance_criteria>

  <done>
    Just-the-Docs config in place; landing page renders the v1 vs. v1.1 split; existing docs participate in the sidebar nav at the right order.
  </done>
</task>

<task type="auto">
  <name>Task 2: Create docs/plugin-authoring.md (Event API integration guide with claude-code worked example)</name>

  <read_first>
    - .planning/phases/05-packaging-distribution/05-RESEARCH.md `## Code Examples > Plugin Authoring Guide outline` (lines ~948-1041) — use as skeleton, flesh out the worked-example section
    - .planning/phases/04-event-api/04-CONTEXT.md `<decisions>` D-08, D-09, D-22, D-23, D-25, D-27, D-28 (Event API contract, sentinel file, error categories, MCP wrapper)
    - plugins/claude-code/README.md (existing — already excellent, much of it transcribes here)
    - plugins/claude-code/src/index.ts (entry point — show in walkthrough)
    - plugins/claude-code/src/server.ts (MCP tool surface)
    - plugins/claude-code/src/wsClient.ts (connection management + backoff)
    - plugins/claude-code/src/sentinel.ts (sentinel file resolver — if exists; otherwise look in plugins/claude-code/src/)
    - packages/core/src/plugin.ts (IntegrationEvent type — the contract)
  </read_first>

  <files>
    docs/plugin-authoring.md
  </files>

  <action>
    Create `docs/plugin-authoring.md`. Use the RESEARCH.md skeleton (lines 950-1041) but FLESH OUT the worked-example section by reading the actual plugins/claude-code/src/ files and quoting representative ~10-line snippets. Honest framing per D-16: "v1.0 ships Event API; smart-adapter plugin system is v1.1; this guide covers the Event API."

    Full content:

    ```markdown
    ---
    title: Event API Plugin Authoring
    nav_order: 7
    layout: default
    ---

    # Writing an Event Producer for RoadRaven

    > **Scope:** This guide covers RoadRaven v1.0's **Event API** — the way external
    > tools push live status updates into a running RoadRaven app. The full plugin
    > system (smart adapters that own their own connection lifecycle) is v1.1; do
    > not depend on the `plugin` / `subscribe` JSON fields in v1.0 — they are
    > parsed but not acted on.

    ## What you can build

    Anything that can speak WebSocket and produce structured status events:

    - A CI/CD pipeline wrapper that updates roadmap nodes as builds progress
    - A test runner integration that marks nodes "blocked" on test failures
    - A daemon that polls an external API (Linear, GitHub, etc.) and reflects state
      into the roadmap
    - An LLM-driven agent that updates nodes as it makes progress on tasks
       — the [`@roadraven/plugin-claude-code`](https://www.npmjs.com/package/@roadraven/plugin-claude-code)
       MCP wrapper at [`plugins/claude-code/`](https://github.com/Shuffzord/RoadRaven/tree/master/plugins/claude-code)
       is the reference implementation

    ## The contract

    Every event is a single WebSocket text frame containing JSON:

    ```json
    {
      "nodeId": "8a7b...uuid",
      "status": "in-progress",
      "meta": { "branch": "main", "commit": "abc123" },
      "source": "my-tool"
    }
    ```

    | Field | Type | Required | Notes |
    |-------|------|----------|-------|
    | `nodeId` | string | yes | Must match a node in the loaded roadmap. Not necessarily a UUID — any non-empty string the producer agrees on with the roadmap author. |
    | `status` | string | yes | Must match a `statusConfig` id in the loaded schema OR a built-in status (`not-started`, `in-progress`, `completed`, `blocked`). |
    | `meta` | object | no | Arbitrary key-value metadata. Surfaces in the side-panel Integration zone and the event log. |
    | `source` | string | no | Producer identifier; used for toast titles, event log filtering, and connection tracking. Strongly recommended. |

    Full TypeScript contract:

    ```typescript
    import type { IntegrationEvent } from "@roadraven/core";
    // IntegrationEvent = { nodeId: string; status: string; meta?: Record<string, unknown>; source?: string }
    ```

    > Install `@roadraven/core` to import the contract type into your producer:
    > `npm install @roadraven/core`

    ## Discovering the URL

    When RoadRaven boots, it writes a sentinel file at `<userData>/event-api.json`:

    ```json
    {
      "port": 47921,
      "url": "ws://127.0.0.1:47921",
      "startedAt": "2026-05-03T18:00:00.000Z",
      "pid": 12345
    }
    ```

    Where `<userData>` is the Electrobun user-data directory:

    | Platform | Path |
    |----------|------|
    | Linux | `~/.config/RoadRaven` |
    | Windows | `%APPDATA%\RoadRaven` |
    | macOS (post v1.1) | `~/Library/Application Support/RoadRaven` |

    The file is removed on clean shutdown. If it's missing, the app is not running
    (or crashed without cleanup — your producer should treat that as "app not
    running" and surface a clear error).

    > **Race condition:** if your producer starts before the app has bound the
    > server, the file may not exist yet. Retry with backoff (the claude-code
    > wrapper retries 6 times, 500ms apart, ~3s total).

    ## Worked example: walking through `plugins/claude-code/`

    The Claude Code MCP wrapper is the reference Event Producer. Its source is
    [on GitHub](https://github.com/Shuffzord/RoadRaven/tree/master/plugins/claude-code).
    Here are the key pieces in walking order.

    ### 1. Sentinel file resolution (`src/sentinel.ts`)

    Reads `<userData>/event-api.json` with retries to handle the race when the
    app is starting up. Returns `{ url, port, pid }` or throws a clear error.

    Key idea: `<userData>` resolution is platform-aware (`os.homedir()` + a
    per-OS subpath). Retry loop is 6×500ms = 3 seconds total.

    ### 2. WebSocket client (`src/wsClient.ts`)

    Opens the WebSocket to the URL from the sentinel, handles disconnects with
    exponential backoff (capped at 30 seconds). Sends a "hello" frame on
    connect (`{ type: "hello", source: "claude-code", version: "..." }`)
    so the app's connection-tracking pill shows the producer name.

    Key idea: the producer owns the connection lifecycle. The app is purely
    passive — it accepts whatever frames you send and validates against the
    contract. Reconnect on connection loss; do not queue events while
    disconnected (per Phase 4 D-28 — queueing is a v1.1 plugin-system concern).

    ### 3. MCP server (`src/server.ts`)

    Exposes two MCP tools to Claude Code (or any MCP host):

    - `updateNodeStatus({ nodeId, status, meta? })` — push an event over the WebSocket
    - `getEventApiStatus()` — introspect the sentinel file for diagnostics

    Tool calls map almost 1:1 to event frames. The wrapper validates inputs with
    Zod (re-using `@roadraven/core` schemas) before pushing.

    ### 4. Entry point (`src/index.ts`)

    Wires the StdioServerTransport (Claude's stdin/stdout protocol) to the MCP
    server. The published binary `roadraven-mcp` is just `bun build`'s output of
    this file with a `#!/usr/bin/env node` shebang.

    ### Fork as a template

    To build your own producer:

    1. Copy the `sentinel.ts` + `wsClient.ts` modules
       — they're general-purpose
    2. Replace `src/server.ts` with whatever entry surface your producer needs
       (a CLI flag, an HTTP webhook handler, a polling loop, etc.)
    3. Use `@roadraven/core` for `IntegrationEvent` typing and Zod validation
    4. Set a unique `source` field so the user can filter your events in the log

    ## Errors

    The app surfaces four error categories as non-blocking toasts (per Phase 4
    D-22, D-23). All errors also land in `.events.jsonl` (a sidecar file next to
    the source roadmap) with an `_error` field for the in-app event log.

    | Condition | Toast | Log marker |
    |-----------|-------|------------|
    | Bad JSON / missing required field | `Invalid event from [source]. See event log.` | `_error: "malformed"` |
    | `nodeId` not in the loaded roadmap | `Event for unknown node from [source].` | `_error: "unknown_node"` |
    | `status` not in the loaded `statusConfig` | `Unknown status '[s]' from [source].` | `_error: "invalid_status"` |
    | Producer disconnect (abnormal close) | `Producer [source] disconnected.` | (no log entry; connection-only) |

    Toasts of the same type from the same `source` within 5s are merged into one
    counted toast. The underlying events all land in `.events.jsonl` individually.

    No "retry" button — producers own their own retry / reconnect logic (per
    D-22). Dismiss is the only user-side action.

    ## Reconnection strategy

    Recommended pattern (matches `plugins/claude-code/src/wsClient.ts`):

    - On connection loss, wait `min(initial * 2^attempts, cap)` ms before retrying
    - Initial backoff: 500ms
    - Cap: 30 seconds
    - Reset attempts counter on successful connect

    Do NOT queue events while disconnected. If a status change happens during a
    disconnect, push it as a fresh event on reconnect; lossy delivery is
    acceptable for the v1.0 model (the source roadmap remains the authoritative
    state, events are progressive overlays).

    ## What's NOT in v1

    - The schema fields `plugin` and `subscribe` on each node are **parsed but not
      acted on** in v1.0. Reserved for v1.1's smart-adapter plugin system. Do not
      depend on them.
    - The full `RoadmapPlugin` interface (with `connect()`, `disconnect()`,
      `on()`, `off()` lifecycle hooks) is defined in
      [`packages/core/src/plugin.ts`](https://github.com/Shuffzord/RoadRaven/blob/master/packages/core/src/plugin.ts)
      for forward compatibility but is not yet wired. v1.1 will add the plugin
      host that calls these methods.
    - Authentication / token-gated handshake — none in v1.0; the localhost-only
      WebSocket binding is the trust boundary. v1.1 plugin secrets story
      will introduce an auth model.
    - Event queueing across disconnects — producer responsibility for v1.0; v1.1
      plugin host may offer a coordinated buffer.

    ## Quick reference

    - **Contract:** `IntegrationEvent` in `@roadraven/core`
    - **Sentinel file:** `<userData>/event-api.json` (`<userData>` per OS — see above)
    - **Default port:** 47921 (with auto-fallback `+1..+9`)
    - **Reference producer:** `@roadraven/plugin-claude-code`
       — install `npx -y @roadraven/plugin-claude-code` or fork from
       [`plugins/claude-code/`](https://github.com/Shuffzord/RoadRaven/tree/master/plugins/claude-code)
    - **App-side architecture:** see [Architecture Overview](architecture-overview.html)
       and [RPC and IPC](rpc-and-ipc.html) for how events flow from WS → Bun
       process → webview store → React render
    ```
  </action>

  <verify>
    <automated>test -f docs/plugin-authoring.md && echo OK</automated>
    <automated>head -5 docs/plugin-authoring.md | grep -c "title: Event API Plugin Authoring"  # MUST be 1</automated>
    <automated>head -5 docs/plugin-authoring.md | grep -c "nav_order: 7"  # MUST be 1</automated>
    <automated>grep -c "IntegrationEvent" docs/plugin-authoring.md  # MUST be >= 2 (contract section + import example)</automated>
    <automated>grep -c "plugins/claude-code" docs/plugin-authoring.md  # MUST be >= 3 (worked-example references)</automated>
    <automated>grep -c "@roadraven/core" docs/plugin-authoring.md  # MUST be >= 2</automated>
    <automated>grep -c "@roadraven/plugin-claude-code" docs/plugin-authoring.md  # MUST be >= 2</automated>
    <automated>grep -c "v1.1" docs/plugin-authoring.md  # MUST be >= 3 (honest framing per D-16)</automated>
    <automated>grep -c "event-api.json" docs/plugin-authoring.md  # MUST be >= 2 (sentinel-file section)</automated>
  </verify>

  <acceptance_criteria>
    - `docs/plugin-authoring.md` exists; first 5 lines are front-matter (`title: Event API Plugin Authoring`, `nav_order: 7`, `layout: default`)
    - File contains a `## The contract` section with the JSON example AND a TypeScript example importing `IntegrationEvent` from `@roadraven/core`
    - File contains a `## Discovering the URL` section showing the sentinel-file shape AND the per-OS userData paths table
    - File contains a `## Worked example: walking through plugins/claude-code/` section with sub-headings for sentinel.ts, wsClient.ts, server.ts, index.ts
    - File contains a `## Errors` section with the 4-row table mapping conditions to toasts and `_error` log markers (per Phase 4 D-22/D-23)
    - File contains a `## Reconnection strategy` section recommending exponential backoff capped at 30s
    - File contains a `## What's NOT in v1` section explicitly noting `plugin`/`subscribe` are parsed-but-not-acted-on
    - File mentions both `npx -y @roadraven/plugin-claude-code` and the GitHub source URL of `plugins/claude-code/`
    - File does NOT use the term "v1 plugin" to refer to the v1 Event API (the v1.0 thing is the Event API; "plugin" terminology is reserved for v1.1's RoadmapPlugin interface)
  </acceptance_criteria>

  <done>
    A new producer author can read this single document, install `@roadraven/core`, follow the contract + sentinel pattern + reconnection strategy, and have a working producer. The reference implementation is linkable for reference.
  </done>
</task>

<task type="auto">
  <name>Task 3: Create CONTRIBUTING.md + polish README.md + append deploy-docs job to release.yml</name>

  <read_first>
    - README.md (current state — preserve Quick start / Project structure / Electrobun sections)
    - CLAUDE.md (project rules — bun-not-npm exception, Electrobun-not-Electron — must be referenced in CONTRIBUTING)
    - docs/development-guide.md (CONTRIBUTING references it; do not duplicate, just point)
    - .planning/phases/05-packaging-distribution/05-CONTEXT.md D-12, D-17, D-18, D-22 (SmartScreen note, CONTRIBUTING scope, README polish, fallow stays commented)
    - .planning/phases/05-packaging-distribution/05-CONTEXT.md `<reconciliation>` R-01, R-02 (Linux .tar.gz install line, Windows .zip→-Setup.exe install line)
    - .planning/phases/05-packaging-distribution/05-RESEARCH.md `## Architecture Patterns > Pattern 3` deploy-docs job (lines ~510-531) — copy literally
    - .github/workflows/release.yml (created in Plan 05-03 — must coordinate the append; reads file's current end-of-file)
    - .husky/pre-commit (existing — references fallow as informational; CONTRIBUTING should reflect)
  </read_first>

  <files>
    CONTRIBUTING.md
    README.md
    .github/workflows/release.yml
  </files>

  <action>
    **A. Create `CONTRIBUTING.md`** at the repo root:

    ```markdown
    # Contributing to RoadRaven

    Thank you for considering a contribution. RoadRaven is an MIT-licensed
    open-source desktop app built on Electrobun (not Electron) with Bun as the
    runtime. This file covers the basics; for the deeper "how the codebase fits
    together" view, see [`docs/development-guide.md`](./docs/development-guide.md).

    ## Local setup

    Prerequisites:
    - [Bun](https://bun.sh) (v1.x; pinned in CI to `latest`)
    - Git

    Clone + install:

    ```bash
    git clone https://github.com/Shuffzord/RoadRaven.git
    cd RoadRaven
    bun install
    ```

    Run the app in dev mode:

    ```bash
    # Recommended: Vite HMR + Electrobun in parallel
    bun run dev:hmr

    # Alternative: one-shot vite build, then electrobun dev (no HMR)
    bun run start
    ```

    ## Tests, types, lint, build

    Run the full PR-readiness gate before opening a PR:

    ```bash
    bun run verify
    # = test + typecheck + build + lint
    ```

    Individual commands:

    ```bash
    bun run test                          # vitest across all workspaces
    bun run --cwd packages/desktop test   # desktop package only (faster)
    bun run --cwd packages/desktop typecheck  # tsc --noEmit
    bunx @biomejs/biome check --diagnostic-level=error .   # lint
    bunx vite build --root packages/desktop   # production build (catches CSS / import issues unit tests miss)
    ```

    Static analysis (informational — NOT a CI gate per [Phase 5 D-22](./.planning/phases/05-packaging-distribution/05-CONTEXT.md)):

    ```bash
    bunx fallow audit --changed-since=HEAD   # dead code / duplication / complexity scan in your diff
    bunx fallow                                # full repo scan
    ```

    Fallow output is currently signal, not a gate. Treat findings as a planning
    input for refactor PRs rather than a blocking failure on each individual change.

    ## Code style

    - Formatter / linter: [Biome](https://biomejs.dev/) — run via
       `bunx @biomejs/biome check --write .` to auto-fix.
    - TypeScript: strict mode (per `tsconfig.json`); avoid `any`.
    - Tabs for indentation (matches existing files).
    - File comments and code: no console.log unless explicitly debugging
       — use the LogTape categories in `packages/desktop/src/bun/logger.ts`.

    Pre-commit hook (Husky) runs `bunx lint-staged` + `biome check` + `tsc` +
    `vitest` on the staged files. If a hook fails, fix the issue and commit
    again — do NOT bypass with `--no-verify`.

    ## Branches and PRs

    - Main branch: `master`. All PRs target `master`.
    - Branch naming: `gsd/phase-NN-description` for orchestrator-managed work,
       or `feat/short-description`, `fix/short-description`, `docs/short-description`
       for ad-hoc PRs.
    - Commits: conventional-style is appreciated but not enforced (e.g.,
       `feat(03-01): add inline rename`, `fix(04-02): handle WebSocket EADDRINUSE`).
    - PR description: clear summary + test plan + screenshots for UI changes.
       The CI gates (lint, typecheck, test, invariants) must all be green
       before review.

    ## Project conventions

    A few rules that catch new contributors off-guard:

    - **Electrobun, not Electron.** Don't import Electron APIs or look for
       `electron-builder`-style configs. See [`CLAUDE.md`](./CLAUDE.md) and
       [`docs/architecture-overview.md`](./docs/architecture-overview.md).
    - **`bun` and `bunx`, not `npm`/`npx`/`yarn`/`pnpm`.** Single explicit
       exception: the release workflow uses `npm publish` (the npm CLI is the
       only registry client with first-class provenance support).
    - **`@roadraven/core` zero-desktop-deps invariant.** PRs that add anything
       beyond `zod` to `packages/core/package.json` `dependencies` will fail the
       `Verify @roadraven/core dependency allowlist` CI step. Edit
       `scripts/check-core-deps.ts` ALLOWLIST in the same PR if the addition is
       intentional, and explain the addition in the PR description.
    - **`--rv-*` CSS tokens only.** No hardcoded colors anywhere in component
       CSS. See [`docs/design-system.md`](./docs/design-system.md).
    - **`dataKey` invariant for the tree renderer.** Only increment on
       structural mutations (add/delete/move), never on status-only updates.
       See [`docs/architecture-overview.md`](./docs/architecture-overview.md)
       for why.

    ## Planning artifacts

    Anything under `.planning/` (`PROJECT.md`, `REQUIREMENTS.md`, `ROADMAP.md`,
    `STATE.md`, phase folders) is managed by the GSD orchestrator workflow.
    Contributors generally do not need to edit these files directly. If a PR
    requires planning changes (e.g., adding a new `EDIT-XX` requirement),
    flag this in the PR description and the maintainer will handle the edit
    via the orchestrator commands.

    ## Reporting issues

    File issues at https://github.com/Shuffzord/RoadRaven/issues. For bug
    reports, include:

    - OS + version (Windows 11 22H2, Ubuntu 22.04 LTS, etc.)
    - RoadRaven version (visible in the status bar or About dialog)
    - Steps to reproduce
    - Expected vs. actual behavior
    - Log file (location is shown in the app status bar)

    ## License

    By contributing, you agree your contributions are licensed under the
    project's [MIT License](./LICENSE).
    ```

    **B. Polish `README.md`.** Read the current README first. KEEP the existing sections (Features, Quick start as dev workflow, Project structure, Electrobun). ADD new sections AFTER `# RoadRaven` heading and BEFORE `## Features`:

    Insert the new sections at the top (after the title block + tagline):

    ```markdown
    > Built on **Electrobun** (not Electron). Runtime is **Bun**.

    ---

    ## Install

    > **v1.0 ships Windows + Linux installers.** macOS is deferred to v1.1
    > (see [Feature status](#feature-status) below).

    Download the latest release from
    [GitHub Releases](https://github.com/Shuffzord/RoadRaven/releases/latest).

    ### Windows

    1. Download `stable-win-x64-RoadRaven-Setup-stable.zip`.
    2. Extract the `.zip`.
    3. Double-click `RoadRaven-Setup.exe`.
    4. **Windows SmartScreen will warn:** "Windows protected your PC."
       This is expected — RoadRaven v1.0 ships unsigned (no Authenticode
       certificate, deferred to v1.1). To install:
       - Click **More info**.
       - Click **Run anyway**.
    5. Follow the installer prompts.

    ### Linux

    1. Download `stable-linux-x64-RoadRavenSetup-stable.tar.gz`.
    2. Extract and run the self-extracting installer:

       ```bash
       tar -xzf stable-linux-x64-RoadRavenSetup-stable.tar.gz
       cd <extracted-directory>
       ./RoadRavenSetup
       ```

       The CEF runtime ships bundled (`bundleCEF: true`), so no system
       Chromium dependency is needed.

    ### npm packages (for producers and library consumers)

    [`@roadraven/core`](https://www.npmjs.com/package/@roadraven/core) — Zod
    schemas + types. Use this if you're building an Event Producer:

    ```bash
    npm install @roadraven/core
    ```

    [`@roadraven/plugin-claude-code`](https://www.npmjs.com/package/@roadraven/plugin-claude-code)
    — MCP wrapper that lets Claude Code push live status updates:

    ```bash
    npx -y @roadraven/plugin-claude-code
    ```

    See the [plugin authoring guide](https://shuffzord.github.io/RoadRaven/plugin-authoring.html)
    for the full Event API contract.

    ---

    ## Feature status

    | What | v1.0 (this release) | v1.1 (planned) |
    |------|--------------------|----------------|
    | Tree canvas + keyboard editor | ✅ | — |
    | Themes (dark / light / high-contrast) | ✅ | — |
    | Side-panel CodeMirror notes + metadata | ✅ | — |
    | Atomic autosave + `$ref` write-back | ✅ | — |
    | Event API (WebSocket — external producers push status) | ✅ | — |
    | `@roadraven/plugin-claude-code` (Claude Code MCP wrapper) | ✅ | — |
    | Windows installer | ✅ | — |
    | Linux installer (`.tar.gz`) | ✅ | — |
    | macOS installer | ❌ deferred | ✅ |
    | Canary release channel | ❌ deferred | ✅ |
    | Code signing (Authenticode / GPG / notarization) | ❌ deferred | ✅ (when commercial pressure justifies) |
    | `.deb` packaging + apt repo | ❌ deferred | possibly |
    | `@roadraven/react` component package | ❌ deferred | ✅ |
    | Smart-adapter Plugin System (`RoadmapPlugin`) | ❌ deferred | ✅ |
    | Drag-and-drop reordering | ❌ deferred | ✅ |
    | Undo / redo | ❌ deferred | ✅ |

    See [`.planning/REQUIREMENTS.md`](./.planning/REQUIREMENTS.md) for the
    complete v1 vs. v2 requirement breakdown.

    ---

    ## Documentation

    Published at https://shuffzord.github.io/RoadRaven/

    - [Architecture overview](https://shuffzord.github.io/RoadRaven/architecture-overview.html)
    - [Development guide](https://shuffzord.github.io/RoadRaven/development-guide.html)
    - [RPC and IPC reference](https://shuffzord.github.io/RoadRaven/rpc-and-ipc.html)
    - [Design system](https://shuffzord.github.io/RoadRaven/design-system.html)
    - [Logging](https://shuffzord.github.io/RoadRaven/logging.html)
    - [**Plugin authoring guide**](https://shuffzord.github.io/RoadRaven/plugin-authoring.html) — write your own Event Producer

    ---

    ## Contributing

    See [CONTRIBUTING.md](./CONTRIBUTING.md) for local setup, test commands,
    code style, and project conventions. Bug reports + feature requests via
    [GitHub Issues](https://github.com/Shuffzord/RoadRaven/issues).
    ```

    The existing `## Features`, `## Quick start`, `## Project structure`, `## Electrobun` sections stay UNCHANGED below the new content.

    Then INSERT the existing `## Quick start` section heading text — change it from `## Quick start` to `## Quick start (development)` so it doesn't compete with the new `## Install` for "first-time visitor" attention. Keep the body of that section unchanged.

    **C. Append `deploy-docs` job to `.github/workflows/release.yml`.** Plan 05-03 created the file ending after the `publish-npm-mcp` job. Append (do NOT modify the existing 5 jobs):

    ```yaml

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
          - name: Smoke-test GH Pages site is live
            run: |
              # Wait briefly for Pages CDN to propagate, then verify the site responds.
              sleep 10
              curl -fsSL "https://shuffzord.github.io/RoadRaven/" | grep -q "RoadRaven" || (echo "GH Pages site did not return RoadRaven content"; exit 1)
    ```

    The `permissions` block on this job OVERRIDES the workflow-level
    `permissions` (workflow has `contents: write, id-token: write`; this job
    needs `contents: read, pages: write, id-token: write`). The `id-token: write`
    permission must be present for the Pages OIDC deployment.

    The `environment: github-pages` block is required by `actions/deploy-pages@v4`
    so GitHub knows this is the canonical Pages-deploy job.

    The smoke-test step at the end is a soft confirmation — Pages CDN
    propagation can take 30s+ on first deploys; if it fails, re-running the
    workflow re-deploys cleanly.
  </action>

  <verify>
    <automated>test -f CONTRIBUTING.md && echo OK</automated>
    <automated>grep -c "bun install" CONTRIBUTING.md  # MUST be >= 1</automated>
    <automated>grep -c "bun run verify" CONTRIBUTING.md  # MUST be >= 1</automated>
    <automated>grep -c "bunx fallow audit --changed-since=HEAD" CONTRIBUTING.md  # MUST be 1 (D-22 — fallow as local tool)</automated>
    <automated>grep -c "Electrobun, not Electron" CONTRIBUTING.md  # MUST be >= 1</automated>
    <automated>grep -c "scripts/check-core-deps.ts" CONTRIBUTING.md  # MUST be >= 1</automated>
    <automated>grep -c "## Install" README.md  # MUST be >= 1 (new section)</automated>
    <automated>grep -c "RoadRaven-Setup.exe" README.md  # MUST be >= 1 (R-02)</automated>
    <automated>grep -c "tar -xzf stable-linux-x64-RoadRavenSetup-stable.tar.gz" README.md  # MUST be >= 1 (R-01)</automated>
    <automated>grep -c "SmartScreen" README.md  # MUST be >= 1 (D-12)</automated>
    <automated>grep -c "## Feature status" README.md  # MUST be >= 1</automated>
    <automated>grep -c "shuffzord.github.io/RoadRaven" README.md  # MUST be >= 1</automated>
    <automated>grep -c "CONTRIBUTING.md" README.md  # MUST be >= 1 (link to it)</automated>
    <automated>grep -c "deploy-docs:" .github/workflows/release.yml  # MUST be 1</automated>
    <automated>grep -c "actions/deploy-pages@v4" .github/workflows/release.yml  # MUST be 1</automated>
    <automated>grep -c "actions/jekyll-build-pages@v1" .github/workflows/release.yml  # MUST be 1</automated>
    <automated>grep -c "shuffzord.github.io/RoadRaven" .github/workflows/release.yml  # MUST be 1 (smoke-test step)</automated>
    <automated>node -e "const y=require('js-yaml');y.load(require('fs').readFileSync('.github/workflows/release.yml','utf8'));console.log('release.yml still parses')" 2>/dev/null || echo "trust github parser"</automated>
  </verify>

  <acceptance_criteria>
    - `CONTRIBUTING.md` exists at the repo root; contains `## Local setup`, `## Tests, types, lint, build`, `## Code style`, `## Branches and PRs`, `## Project conventions`, `## Reporting issues`, `## License` sections
    - `CONTRIBUTING.md` mentions `bun install`, `bun run dev:hmr`, `bun run verify`, `bunx fallow audit --changed-since=HEAD` (D-22 — informational), and references `CLAUDE.md` for the Electrobun/bun rules
    - `CONTRIBUTING.md` has a project-conventions section explicitly mentioning the `npm publish` exception, the `@roadraven/core` allowlist, the `--rv-*` token rule, and the `dataKey` invariant
    - `CONTRIBUTING.md` does NOT recommend bypassing pre-commit hooks (`--no-verify`)
    - `README.md` contains a NEW `## Install` section as one of the first sections (after the tagline + existing notice, before the existing `## Features` heading)
    - `README.md` Install section has Windows subsection with the literal string `RoadRaven-Setup.exe` AND `SmartScreen` AND `More info` AND `Run anyway` (D-12 + R-02)
    - `README.md` Install section has Linux subsection with the literal command `tar -xzf stable-linux-x64-RoadRavenSetup-stable.tar.gz` (R-01)
    - `README.md` contains a NEW `## Feature status` section with a table mapping features to v1.0 / v1.1 columns; rows include macOS, Canary, code signing, `.deb` packaging, `@roadraven/react`, smart-adapter plugin system
    - `README.md` contains a NEW `## Documentation` section linking to `https://shuffzord.github.io/RoadRaven/` and at least 4 sub-page links
    - `README.md` contains a NEW `## Contributing` section linking to `CONTRIBUTING.md`
    - `README.md` existing `## Quick start` section renamed to `## Quick start (development)` so the new install section is the user-facing entry point
    - `README.md` existing sections (Features, Project structure, Electrobun) preserved
    - `.github/workflows/release.yml` contains a NEW job `deploy-docs:` AFTER `publish-npm-mcp` (file now has 6 jobs total)
    - `deploy-docs` job has `needs: [github-release]` (so docs only update if installer release succeeded)
    - `deploy-docs` job has `permissions: { contents: read, pages: write, id-token: write }` and `environment: github-pages`
    - `deploy-docs` job uses `actions/configure-pages@v5`, `actions/jekyll-build-pages@v1`, `actions/upload-pages-artifact@v3`, `actions/deploy-pages@v4` (the documented Pages deploy chain)
    - `deploy-docs` job ends with a smoke-test step that curls `https://shuffzord.github.io/RoadRaven/` and asserts response body contains "RoadRaven"
    - `release.yml` still parses as valid YAML (existing 5 jobs from Plan 05-03 preserved)
  </acceptance_criteria>

  <done>
    Docs site config + landing page + plugin authoring guide are all in place. CONTRIBUTING.md gives external contributors a one-stop file. README is polished for v1 release. The release workflow now ends with a Pages deploy that runs after the GitHub Release succeeds, ensuring docs always reflect the shipped version.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Docs source markdown → published GH Pages site | The site is a thin Jekyll render of files in `docs/`. No build script, no Jekyll plugins beyond `jekyll-remote-theme`. Trust boundary is "whatever you commit gets published." Sensitive content must not land in `docs/`. |
| README.md install instructions → end-user trust | Documenting "click Run anyway" past SmartScreen is a UX necessity (D-12) but trains users to bypass a security warning. Mitigation: README is explicit that the unsigned status is a known v1.0 limitation deferred to v1.1, not a permanent posture. |
| CONTRIBUTING.md `bunx fallow` recommendation → contributor confusion | Per D-22, fallow is informational. CONTRIBUTING.md must be explicit that fallow is NOT a CI gate so contributors don't waste cycles fixing fallow findings instead of failing tests. |
| `deploy-docs` job → GH Pages OIDC | `id-token: write` permission required by `actions/deploy-pages@v4` (the Pages OIDC flow); same OIDC infrastructure as the npm publish job. Both reuse the same per-run token mechanism. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-05-06 | Repudiation | Unsigned `.exe` runs without warning on machines without SmartScreen | accept (per D-12) | README "First run on Windows" section explicitly documents the SmartScreen warning + bypass path. The deferral to v1.1 is logged in PROJECT.md "Out of Scope" (Plan 05-01). Combined: users see the warning, README explains it, deferral has a documented v1.1 follow-up. |
| T-05-10 | Information Disclosure | Sensitive content accidentally landing in `docs/` and getting published | mitigate | The Pages deploy is gated on the same git commits that pass CI. The biome lint job + planning-invariants gate (Plan 05-03) catch obvious issues. CONTRIBUTING.md note: "Anything under `docs/` is published — no secrets, no internal-only context." Plus: the docs deploy only runs on tag pushes (not every master commit), giving a final review window. |
</threat_model>

<verification>
After all three tasks land, run from repo root:

```bash
# Docs site files
test -f docs/_config.yml
test -f docs/index.md
test -f docs/plugin-authoring.md
for f in architecture-overview development-guide rpc-and-ipc design-system logging; do
  head -5 docs/$f.md | grep -q "title:" || echo "MISSING front matter in $f.md"
done

# CONTRIBUTING + README
test -f CONTRIBUTING.md
grep -q "bunx fallow audit" CONTRIBUTING.md  # D-22
grep -q "## Install" README.md
grep -q "RoadRaven-Setup.exe" README.md
grep -q "tar -xzf stable-linux-x64-RoadRavenSetup-stable.tar.gz" README.md
grep -q "## Feature status" README.md
grep -q "shuffzord.github.io/RoadRaven" README.md

# release.yml gained deploy-docs job
grep -q "deploy-docs:" .github/workflows/release.yml
grep -q "actions/deploy-pages@v4" .github/workflows/release.yml

# Workflow YAML still parses
node -e "require('js-yaml').load(require('fs').readFileSync('.github/workflows/release.yml','utf8'));console.log('OK')"

# Existing tests/lints still pass (no regression)
bunx @biomejs/biome check --diagnostic-level=error .
bun run --cwd packages/desktop test
```

**Manual verification (one-time):**
- After the first `v*` tag is pushed and `deploy-docs` runs, visit `https://shuffzord.github.io/RoadRaven/` and confirm: landing page renders, sidebar nav shows all 7 pages in correct order, each page is reachable, plugin-authoring.md contains the worked example.
</verification>

<success_criteria>
- Docs site is fully configured (Just-the-Docs, sidebar, all pages with front matter)
- Plugin authoring guide is complete with claude-code worked example (D-16)
- CONTRIBUTING.md provides a one-stop contributor onboarding
- README has v1 install instructions per R-01/R-02 + SmartScreen note (D-12) + feature-status block (v1 vs. v1.1) + docs/contributing links
- release.yml gains deploy-docs job that runs after github-release (docs ship in lockstep with installers)
- All existing CI gates still pass; release.yml parses as valid YAML
- fallow remains commented in CI (D-22 invariant); CONTRIBUTING.md notes it as a local-only informational tool
</success_criteria>

<output>
After completion, create `.planning/phases/05-packaging-distribution/05-04-SUMMARY.md` describing:
- Docs site sidebar order + the new index.md + plugin-authoring.md content
- README polish: which sections were added (Install, Feature status, Documentation, Contributing) vs preserved (Features, Quick start, Project structure, Electrobun)
- CONTRIBUTING.md scope and the explicit D-22 framing of fallow
- The deploy-docs job appended to release.yml; coordination note with Plan 05-03 (both touched release.yml — sequenced via wave-2 file ownership)
- Any deviations from RESEARCH.md Pattern 4 (e.g., omitting `logo:` line because no asset)
</output>
