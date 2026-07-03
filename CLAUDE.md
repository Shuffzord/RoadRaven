# CLAUDE.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

Don't assume. Don't hide confusion. Surface tradeoffs.

Before implementing:

- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

Minimum code that solves the problem. Nothing speculative.

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

Touch only what you must. Clean up only your own mess.

When editing existing code:

- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:

- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

Define success criteria. Loop until verified.

Transform tasks into verifiable goals:

- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:

```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

These guidelines are working if: fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

 ## 5. Codegraph — use it before reading/writing code
 
 This repo is indexed by **codegraph** (a SQLite knowledge graph of every symbol, edge, and file; `.codegraph/` at repo root, available via the `codegraph` MCP tools). Reads are sub-millisecond; the index lags writes by ~1s via a file watcher. **Consult it BEFORE writing or editing code**, not during.
 
 - **Almost any question** — "how does X work", architecture, a bug, "what/where is X", surveying an area → `codegraph_explore` (PRIMARY; call FIRST). One capped call returns the verbatim source of the relevant symbols grouped by file — Read-equivalent, usually the ONLY call needed. Treat its output as already-Read; don't re-Read those files.
 - **"How does X reach/become Y / the flow / path"** → `codegraph_explore`, naming the symbols that span the flow (it surfaces dynamic-dispatch hops grep can't follow).
 - **"Where/what is symbol X" (location only)** → `codegraph_search`.
 - **"What calls this / what does this call / what would changing this break"** → `codegraph_callers` / `codegraph_callees` / `codegraph_impact`.
 
 Codegraph IS the prebuilt search index: a direct answer is typically 1–few calls, vs dozens for a grep/read loop. Don't delegate the same lookup to a sub-agent or re-run it with grep — that repeats work codegraph already did. Reach for raw Read/Grep only to confirm a specific detail codegraph didn't cover.
 
---

## Project specific
@PROJECT.MD
