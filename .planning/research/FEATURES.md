# Features Research: Roadmap Viewer

**Domain:** Desktop hierarchical tree / roadmap / mindmap editor with live integration
**Researched:** 2026-04-12
**Confidence:** MEDIUM-HIGH (domain knowledge of XMind, Obsidian, Notion, Miro, Whimsical, Heptabase, Logseq, OmniGraffle; spec cross-referenced for gap analysis. WebSearch unavailable — flagged where external verification would increase confidence.)

---

## Summary

Roadmap Viewer sits in a competitive but coherent niche: it is not a generic mindmap tool (XMind, Miro) nor a note-taking graph (Obsidian), but a **live-status tree editor** backed by a plain JSON file. Its closest analogues are Heptabase (structured card hierarchies), Markmap (live markdown → tree), and internal developer tools like Linear or Jira dependency views — none of which do exactly what this product does.

The spec is well-developed. Most table-stakes for the category are present. The meaningful gaps are around **undo/redo** (conspicuously absent), **node search**, and **multi-select operations** — all deferred or unspecified. The live-status differentiator is correctly identified as the core moat. The primary risk areas are the plugin system design (acknowledged with a research gate) and PNG export (implementation complexity noted but approach is underspecified).

---

## Table Stakes
(Must have or users will leave)

| Feature | Why Expected | Spec Status | Notes |
|---------|-------------|-------------|-------|
| Undo / Redo | Every editor since 1984. Users will lose work and blame the app immediately. | **MISSING** | Not mentioned anywhere in the spec or out-of-scope list. Critical gap. |
| Keyboard navigation of the tree | Tree tools without arrow-key traversal feel broken. Tab/Enter editing is present but tree traversal (arrow keys to move focus between nodes) is unspecified. | Partial | Spec covers Tab/Enter for editing but not arrow-key focus movement through the tree for navigation. |
| Open file via native dialog + recent files | Users expect `File > Open` and a list of recently opened roadmaps. | Partial | File picker for opening is mentioned (US-01); recent files list is not. |
| Inline status visible without opening panel | Status badge on node (left border color + pill). | Present | Well-specified. |
| Collapse / expand subtrees | Standard for any tree UI. | Present | Specified with depth-3 default collapse. |
| Zoom and pan canvas | Standard for canvas-based tools. | Present | Specified. |
| Copy / paste nodes | Cut/copy/paste is expected in any editor. | **MISSING** | Duplicate is present (Ctrl+D), but explicit copy/paste across files or sessions is not addressed. |
| Context menu discoverability | Mouse-first users must be able to discover all actions. | Present | Well-specified in US-03 with keyboard nav. |
| Autosave / persistence | Users should never think about saving. | Present | Debounced 2s + 30s periodic + flush on quit. Well-specified. |
| Readable output format | Plain text so git, grep, and editors work. | Present | Nested JSON; human-readable by design. |
| Error feedback | Schema validation errors must be visible. | Present | Inline error panel specified. |
| Performance at scale | Freezing on 500 nodes makes the tool unusable. | Present | 300-node / 10 fps benchmark gate in place. |

---

## Differentiators
(What makes this product stand out from Miro, XMind, Obsidian)

| Feature | Differentiation | Risk |
|---------|----------------|------|
| Live node status from external systems | No desktop tree editor does this out of the box. Turns the roadmap into a live dashboard, not a static document. This is the core moat. | Plugin system complexity. Integration reliability (dropped connections, retries, auth) is hard to get right quietly. |
| Zero-opinion, user-defined status and type system | XMind and Miro hardcode statuses/colors. This schema approach is flexible enough for CI pipelines, learning roadmaps, task boards, and data pipeline maps. | Risk of overwhelming new users who don't know what statuses to define. Need a good default schema. |
| Plain JSON + git-friendly | Notion/Miro lock data in proprietary formats. This is fully diff-able and version-controllable. | Low — this is a pure win. Minor risk: merging concurrent JSON edits is hard (but multi-user is out of scope). |
| Embeddable as npm package | `@roadmap-viewer/core` and `@roadmap-viewer/react` make this a platform, not just an app. | Package boundary discipline is hard to maintain. The monorepo must enforce that `packages/core` has no desktop dependencies. |
| $ref split-file support | Large roadmaps can be decomposed into separate files. Unique to this tool. | Cross-boundary node moves are blocked in MVP — users will hit this. The error message must be clear and actionable. |
| Per-schema theme overrides | Allows organisations to brand their roadmaps. | Low risk, high polish impact. |
| Keyboard-first editing (Tab/Enter/F2 model) | Matches how developers think. Tools like Workflowy pioneered this; most tree editors still require mouse for structural changes. | Discoverability — users must be told this exists. An onboarding tooltip or empty-state guide is needed. |

---

## Anti-Features
(Things that sound good but should not be built yet)

| Feature | Why to Avoid | Defer To |
|---------|-------------|---------|
| Drag-and-drop node reordering | High implementation complexity with react-d3-tree (SVG drag has poor DX; touch targets are tricky). Conflicts with pan/drag on canvas. Already deferred in spec — this is the right call. | v1.1 |
| Rich text in node titles | Bold/italic/links inside the node label (not the notes panel) adds a second markdown engine context and complicates inline rename. Notes panel already handles rich content. | Never for titles; notes panel is the right place |
| Comment threads on nodes | Adds collaboration mental model to a single-user tool. Scope creep toward Notion/Linear. | Never for v1 |
| Templates library | Useful but locks the team into maintaining N templates. The sample schemas (`hello-world.json`) achieve 80% of the value. | v2 |
| Timeline / Gantt view | Fundamentally different data model (dates, durations, dependencies). Would require schema changes. | Out of scope |
| Custom SVG node shapes | Already deferred to v1.1. Each custom shape requires layout and hit-testing rework. | v1.1 |
| Inline image attachments on nodes | Bloats the JSON; requires binary data handling (base64 or external file refs). Notes panel already supports markdown image links. | Never — use links |
| Cloud backup / sync | Authentication, conflict resolution, data residency concerns. Explicitly out of scope for good reasons. | Never for v1 |
| Plugin marketplace / discovery UI | Before there are third-party plugins, a marketplace is premature infrastructure. | v2 after first third-party plugin ships |
| Real-time collaboration | CRDT complexity is enormous. Already excluded. | Out of scope |

---

## Gap Analysis
(Features users will expect that are not in the current spec)

### Critical Gap: Undo / Redo

**Severity: High.** This is the most significant missing feature in the entire spec. Every editor — Notion, Obsidian, XMind, VS Code — supports `Ctrl+Z` / `Ctrl+Y`. Users will accidentally delete a subtree and expect to undo it. Without undo, the "no unsaved-changes confirmation" design (which is otherwise correct) becomes a data loss risk.

**Recommended approach:** Implement a command-pattern undo stack in the Zustand store. Each mutating operation (add, delete, rename, move, status change) pushes a reversible command. Cap at 50 entries. This is not architecturally complex given the Zustand store model, but it must be planned from Phase 2 or retrofitting it is painful.

**The spec explicitly says "no unsaved-changes confirmation" and "flush on before-quit" — without undo, a user who fat-fingers Delete on a root node has no recovery path.** This is a product-quality blocker.

### Gap: Tree Focus Navigation via Arrow Keys

**Severity: Medium.** The keyboard-first positioning requires arrow key traversal of tree nodes (Up/Down between siblings, Right to expand/enter, Left to collapse/go to parent). This is the standard keyboard model for trees (matches VS Code Explorer, macOS Finder, Windows Explorer). The spec specifies Tab/Enter/F2 for *editing operations* but is silent on *focus navigation*. These are different concerns.

**Recommended addition to US-02:** Arrow keys navigate focus; Tab/Enter remain for structural edits.

### Gap: Node Search / Find

**Severity: Medium.** Roadmaps grow to 100+ nodes quickly. Finding a specific node without search forces manual tree traversal. This is listed in the v1.1 section, but the absence of even a basic `Ctrl+F` find-in-tree feels like a gap for 1.0. Markmap, XMind, and Obsidian all have this.

**Recommendation:** Defer to v1.1 as currently planned, but ensure the store design makes it trivially addable (a flat node index alongside the nested tree is already a good practice for perf anyway).

### Gap: Copy / Paste

**Severity: Medium.** `Ctrl+D` (duplicate in place) is present. But users will want to copy a node (or subtree) to the clipboard and paste it elsewhere — including into another roadmap file. The spec does not address clipboard copy/paste. This is distinct from duplicate.

**Recommendation:** Add `Ctrl+C` / `Ctrl+V` for node copy/paste as part of Phase 2 (Editor), with a JSON clipboard format. Cross-file paste can be clipboard-text-based (paste the node JSON).

### Gap: New File / Empty Canvas

**Severity: Medium.** The spec describes loading existing JSON files. It does not describe creating a new roadmap from scratch within the app (File > New). Users who want to start a fresh roadmap need to either edit JSON by hand or use a provided template. This is a friction point for new users.

**Recommendation:** `File > New` creates an in-memory schema with a single root node and the default statusConfig. The user names it and the app saves it when they first make an edit.

### Gap: Recent Files List

**Severity: Low-Medium.** Standard `File > Recent Files` submenu is expected. Without it, users who close and reopen the app must navigate the file picker every time. `.roadmap-settings.json` already exists as a settings persistence mechanism — a `recentFiles` array there costs almost nothing.

### Gap: Status Bar / Connection Health Visibility

**Severity: Low.** US-07 mentions "Integration status bar shows all active connections and their health" but this is only specified at the user story level. The exact UI placement, format, and dismissal behavior for connection errors (toast vs. persistent indicator) is underspecified. This will need a design decision before Phase 3.

### Gap: Empty State / Onboarding

**Severity: Low.** What does a first-time user see? The spec provides sample schemas but doesn't define the empty state UX — whether the app opens to a file picker, a welcome screen with sample templates, or a blank canvas. This affects perceived polish significantly. Tools like Heptabase and Obsidian put effort into this.

---

## Risky / Underspecified Areas
(Things in the spec that need more thought)

### Risk 1: Plugin System Design (acknowledged, research-gated)

The spec already flags this: "A research phase is required before any implementation begins." This is the right call. The specific risks that need the research document to resolve:

- **Security/sandbox model:** Plugins running in the Bun process have full filesystem and network access. There is no sandbox. A malicious or buggy plugin can do anything. The spec says "all adapters bind to 127.0.0.1 by default" but that only covers outbound connections, not what a plugin *does* with inbound data.
- **Plugin loading timing:** Static loading at app startup vs. dynamic loading as nodes are encountered. Dynamic loading means the first render may block on plugin initialization.
- **Side panel component handoff:** How does a plugin inject React components into the side panel Integration zone? This requires a plugin UI API — which is a significant contract that must be versioned.
- **Plugin versioning and compatibility:** If `@roadmap-viewer/core` is published to npm and plugins depend on it, a core version bump can silently break all third-party plugins. The interface needs a stability guarantee.

### Risk 2: PNG Export Implementation

The spec notes: "The capture originates in the webview (html2canvas or equivalent). The resulting blob is sent to the Bun process via RPC for file write." 

The risks here are:
- **html2canvas limitations:** html2canvas does not render SVG foreignObject, CSS custom properties (without inline resolution), or WebGL reliably. react-d3-tree renders SVG — but node labels and status badges involve CSS that html2canvas may misrender.
- **Large tree capture:** A 300-node tree at 2x resolution may be a very large canvas (potentially 8000x6000px or more). html2canvas has memory limits and will crash on large captures.
- **Alternative:** A purpose-built SVG-to-PNG path (serialize the SVG to a string, use a canvas to draw it, export as PNG) would be more reliable for an SVG-based renderer. This should be investigated before Phase 4.

**Recommendation:** Add a spike task to Phase 4 to validate html2canvas against the actual react-d3-tree SVG output before committing to it.

### Risk 3: $ref Cross-File Write-Back

The spec handles this with "cross-boundary moves blocked with error" — which is the right MVP call. But the write-back behavior when editing a node that lives in a `$ref` file is underspecified:

- Does editing a `$ref` node's metadata trigger a write to the referenced file or the parent file?
- If the `$ref` file is also open in another process/editor, the file watcher will trigger a reload — potentially clobbering in-progress edits.
- The atomic write (`.tmp` then rename) applies to which file — the parent or the `$ref` target?

This is low severity for MVP (few users will use `$ref` initially) but should be explicitly documented in the spec before Phase 2.

### Risk 4: No Undo and the "No Unsaved-Changes Confirmation" Combination

As noted in Gap Analysis, the combination of:
1. No undo/redo
2. No unsaved-changes confirmation on close
3. Autosave flushing on `before-quit`

...means a single misplaced `Delete` key can permanently destroy a subtree with zero recovery path. This is acceptable in a note-taking app where the notes are small, but a 100-node subtree deletion is a serious data loss event.

**Recommendation:** Either add undo (preferred) or add a trash/recycle pattern for deleted subtrees stored in the settings file (simpler but less standard). At minimum, the delete confirmation dialog for non-leaf nodes (already specified) should be more prominent.

### Risk 5: Webhook Transport Direction

The spec lists `"webhook"` as a transport in the `subscribe` block. A webhook, by definition, is an *inbound* HTTP request from an external server to your app. This means the app must run an HTTP server (even if only on `127.0.0.1`) to receive webhook events. This is more complex than WebSocket (which the app initiates) or file watching.

- Who manages the server lifecycle (start/stop)?
- What port? Configurable? How does the user communicate the webhook URL to the external service?
- Does this server start even when no nodes have webhook subscriptions?

This is an underspecified transport that needs design work before Phase 3.

### Risk 6: StatusMap Coupling to External Event Schema

The `subscribe.statusMap` field maps inbound status strings to internal `statusConfig` ids. This works when the external tool produces a simple `{ "status": "running" }` event. Real-world integrations are messier:

- GitHub Actions sends JSON with `.conclusion` (not `.status`) and values like `"success"`, `"failure"`, `"cancelled"`, `"skipped"`.
- CI systems may send nested payloads where the relevant field is at `.workflow_run.status`.

A flat `statusMap` object cannot handle field remapping or nested paths. The plugin system is the right place to solve this (plugins can normalize events before they reach the status map), but the raw `subscribe` block without a plugin will be limited to tools that happen to produce `{ "status": "..." }`.

**Recommendation:** Document the limitations of the raw `subscribe` transport in the spec. Encourage plugin-based integrations for non-trivial event schemas.

---

## Confidence Notes

| Area | Confidence | Rationale |
|------|------------|-----------|
| Table stakes (undo, copy/paste, nav) | HIGH | Universal across Notion, XMind, Obsidian, VS Code, OmniGraffle — all pre-cutoff, well-documented |
| Differentiator assessment | HIGH | Based on direct feature comparison with known tools |
| Anti-feature rationale | HIGH | Based on known implementation complexity of each item |
| Gap: new file / recent files | HIGH | Standard macOS/Windows app patterns |
| Risk: html2canvas SVG fidelity | MEDIUM | html2canvas SVG limitations are documented; exact behavior with react-d3-tree not verified experimentally |
| Risk: webhook transport design | HIGH | HTTP server lifecycle management is well-understood complexity |
| Risk: plugin UI handoff | MEDIUM | Specific Electrobun/Bun constraints not externally verified (WebSearch unavailable) |
