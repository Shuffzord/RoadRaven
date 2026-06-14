# Public Release — File Exclusion List

> **Purpose:** You are copying clean files into a NEW public repo rather than
> deleting from this working repo. This is the **deny-list** — what to leave
> behind (or scrub) when you copy. Nothing here has been deleted from the
> current repo. Generated 2026-06-14 for the alpha v0.5 public launch.

Confidence legend: **EXCLUDE** = leave out of public repo · **SCRUB** = bring a
cleaned subset · **REVIEW** = your product/judgment call · **KEEP** = bring as-is
(listed only to resolve ambiguity).

---

## 1. Internal process & strategy exhaust — EXCLUDE

| Path | Why exclude |
|------|-------------|
| `.planning/` (entire tree, ~150 files) | GSD planning artifacts: phase plans, discussion logs, UAT, verification reports, debug logs. Internal process exhaust. |
| `.planning/PRICING-STRATEGY.md` | **Business-sensitive** — pricing/moat analysis. Must not be public. |
| `.planning/pitch.md`, `.planning/product-vision.md`, `.planning/PROJECT.md`, `.planning/BACKLOG.md`, `.planning/STATE.md` | Internal strategy / roadmap state. |
| `.planning/PUBLIC-RELEASE-EXCLUDE.md` (this file) | Internal checklist; don't ship it. |

> Note: `README.md` links to `./.planning/REQUIREMENTS.md`. If you exclude
> `.planning/`, **update that link** (point to the published docs site or remove it).

## 2. Vendored tooling / framework copies — EXCLUDE

| Path | Why exclude |
|------|-------------|
| `.claude/get-shit-done/` | Vendored GSD workflow framework (internal). |
| `.claude/gsd-pristine/` | Full pristine copy of GSD — tooling sync state. |
| `.claude/gsd-local-patches/` | Local patch mirror — tooling sync state. |

> **REVIEW:** `.claude/` may also hold reusable commands/agents you *want* public.
> Decide per-subfolder: ship curated `.claude/commands` / `agents` if intended,
> exclude the three `gsd-*` mirrors above regardless.

## 3. Scratch / marketing experiment files — EXCLUDE

| Path | Why exclude |
|------|-------------|
| `Audio/best.mp3`, `Audio/jason file.mp3` | 1.3 MB narration scratch for the storytelling video. Not used by app/build. |
| `Audio/transcribe.py` | Standalone yt-dlp/whisper helper; no references in app/CI. |
| `scripts/storytelling-video/` | Marketing-video automation (run.ts, validate-timeline.ts, demo/timeline/narration JSON). Tied to `.planning/storytelling-video.md`; not part of the app. |

## 4. Stale backups & runtime artifacts — EXCLUDE (and tighten .gitignore)

| Path | Why exclude |
|------|-------------|
| `samples/getting-started.bak.json` | Tracked `.bak.json` (slipped the ignore rule). Duplicate of `getting-started.json`. |
| `samples/gsd-roadmap.bak.json` | Tracked 76 KB `.bak.json` duplicate. |
| `samples/*.events.jsonl` (`cfa-l1-roadmap`, `gsd-roadmap`) | WebSocket event-log runtime output, not source data. |
| any local untracked `*.bak.json`, `*.bak.bak.json` | Already gitignored — just don't copy them. |

> **.gitignore for the public repo:** add `*.events.jsonl`; confirm `*.bak.json`
> is present (it is, but committed-before-the-rule files still tracked here).

## 5. Sample data — REVIEW (product call, not safety)

| Path | Note |
|------|------|
| `samples/cfa-l1/` (10 topic JSONs, ~2.6 MB) | Large CFA exam content; dominates repo size. Consider trimming to ONE representative demo file. |
| `samples/roadmapa-rodzicielska.json` | Polish personal/parenting roadmap (30 KB); off-topic for a public demo set. Likely drop. |
| `samples/getting-started.json`, `hello-world.json`, `gsd-roadmap.json` | KEEP — good public demo set. |

## 6. Build / tool artifacts — already gitignored, just don't copy

`build/`, `dist/`, `.fallow/` — untracked & ignored locally. Don't copy into public.
(`plugins/claude-code/dist/` IS published to npm but is a build output — let CI build it; don't hand-copy.)

---

## Do NOT exclude (KEEP for public)

- `README.md`, `CONTRIBUTING.md`, `LICENSE`, `docs/` (published site source)
- `packages/core`, `packages/desktop`, `plugins/claude-code` (source)
- `shared/`, `scripts/` **except** `scripts/storytelling-video/`
  - KEEP `scripts/check-core-deps.ts` (used in CI), `validate-roadmap.mjs`,
    `validate-cfa-roadmap.mjs`, `bump-version.ts`, `normalize-uuids.mjs`,
    `build-icons.ts` — all referenced/documented.
- `.github/workflows/` (ci.yml, release.yml)
- `.fallowrc.json`, `biome.json`/config, `tsconfig*.json`, `vite.config.*`

---

## Post-copy follow-ups (separate from this list)

- Genuine fallow dead exports (~34) + 2 circular deps (`useFileActions↔rpc`,
  `agentRpcHandler↔rpc`) + 1 stale suppression at `rpcHandlers.ts:15` — real but
  low-risk; refactor as its own task, not a blind delete (some "unused" exports
  may be intentional public API).
