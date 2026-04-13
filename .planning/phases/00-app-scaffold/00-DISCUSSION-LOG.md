# Phase 00: App Scaffold - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-12
**Phase:** 00-app-scaffold
**Areas discussed:** Package namespace, Monorepo migration, Linter choice, Playwright Phase 0 scope

---

## Package Namespace

| Option | Description | Selected |
|--------|-------------|----------|
| @roadraven/ | Matches app brand name, pitch doc, and electrobun.config.ts. @roadraven/core, @roadraven/react | ✓ |
| @roadmap-viewer/ | What REQUIREMENTS.md currently says. More descriptive but conflicts with brand. | |

**User's choice:** `@roadraven/`
**Notes:** REQUIREMENTS.md has a stale reference to `@roadmap-viewer/` — this discrepancy was surfaced and resolved in favour of the established brand name.

---

## Monorepo Migration

| Option | Description | Selected |
|--------|-------------|----------|
| packages/desktop absorbs src/ | Root becomes pure workspace container. src/ moves into packages/desktop/. Config files move too. | ✓ |
| Root stays, packages grow alongside | Keep flat src/ at root. packages/ grows alongside as siblings. | |

**User's choice:** `packages/desktop` absorbs `src/`
**Notes:** Root `package.json` becomes workspace-only. `electrobun.config.ts` and `vite.config.ts` move into `packages/desktop/`. `packages/core/` and `packages/react/` are stubs in Phase 0.

---

## Linter Choice

| Option | Description | Selected |
|--------|-------------|----------|
| Biome | Single tool, Rust-based, zero config for TS/React, lint + format in one pass. | ✓ |
| ESLint + Prettier | Familiar, wide plugin ecosystem, more config overhead, slower. | |
| tsc-only | No dedicated linter, rely on strict tsconfig. Fastest, least friction. | |

**User's choice:** Biome
**Notes:** CI step: `bunx biome check --diagnostic-level=error .`

---

## Playwright Phase 0 Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Full two-tier skeleton | Both tiers wired now: tests/ui/ (Vite + mock RPC) + tests/process/ (Bun-native). Each has a smoke test. | ✓ |
| Smoke test only | Single test confirming window launches. Two-tier harness deferred to Phase 1/2. | |

**User's choice:** Full two-tier skeleton
**Notes:** `tests/ui/smoke.test.ts` confirms root element renders. `tests/process/smoke.test.ts` confirms BrowserWindow creates without crashing. Convention established for all subsequent phases.

---

## Claude's Discretion

- Bun workspace version constraints and resolutions config
- `shared/types.ts` import resolution approach (path alias vs relative)
- Biome rule strictness level
- CI caching strategy
- Whether `plugins/claude-code/` gets a `package.json` stub in Phase 0

## Deferred Ideas

None.
