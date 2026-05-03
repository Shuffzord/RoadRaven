# RoadRaven — Storytelling Video Draft

**Status**: Draft v1 — concept locked, production not started
**Format**: ~75s narrated MP4 (hero pinned video) + 5-8s looping GIF (README banner)
**Audience**: Devs landing on the GitHub repo — 3-second hook or they bounce
**Direction**: "Imagine…" — morphing-node story (selected from 6-direction brainstorm)

---

## Big-Picture Concept

A single `[IDEA]` node morphs and branches as a narrator tells the story of going from a vague intention to a live, self-watching roadmap. The morph sells the *promise*; a hard-cut to real RoadRaven footage at the end sells the *proof*.

### Why this direction

- Answers "what is this?" without requiring product literacy
- Visual metaphor matches the actual product mechanic (tree of nodes, status changes)
- Loop point is clean (final tree → seed node) — works as a banner GIF too
- Truthful: the morphing nodes are stylized, but they reflect what the app actually does

### Vibe / tone

Warm, aspirational, "this is for you." Not a demo. Not a pitch deck. A story.

---

## Full Storyboard

**Total length**: ~75 seconds
**Background**: Black throughout
**Voice**: Single warm narrator
**Sound**: Soft synth pad underneath, gentle *click* on each node morph, deeper *thunk* on branch-out, subtle UI-style chime when status changes color

---

### Act 1 — The seed (0:00 – 0:12)

**Visual**: One node, center screen. Label: `[ IDEA ]`. Cursor blinks inside it.

**Narrator**: *"Imagine you have an idea."*

Text inside the node ripples — `IDEA → LEARN`.

*"Maybe you want to learn something."*

Ripple again — `LEARN → BUILD`.

*"Or build something."*

Beat. Ripple — `BUILD → SHIP A PRODUCT`.

*"Of course you want to build with AI. Everyone does. So let's say… you want to ship a product."*

---

### Act 2 — The tree unfolds (0:12 – 0:35)

**Visual**: The single node sprouts two children with a soft *thunk*: `web app` and `native app`.

**Narrator**: *"A web app. A native app. Why not both?"*

Each child branches further — `web app` → `auth`, `payments`, `landing`. `native app` → `iOS`, `Android`, `auto-update`. Tree fills the screen organically, like roots.

*"You sketch the tree. You name the pieces. The plan is yours — no sprints, no story points, no opinions baked in."*

A faint outline appears around the entire tree: a `roadmap.json` file glyph fades in at the corner.

*"It's just a JSON file. Living in your repo. Diffable. Reviewable. Yours."*

---

### Act 3 — The proof: it watches itself (0:35 – 0:60)

**Visual**: A small icon appears next to the `auth` node — a Claude Code glyph. The node pulses amber → green. Then `payments` lights up amber. Then `landing` flashes green. Status ripples through the tree on its own.

**Narrator**: *"Now connect each node to something real. An AI agent. A CI pipeline. A local script. Anything that can send a message."*

The `iOS` node turns green. A small GitHub Actions glyph blinks beside it.

*"GitHub Actions finishes — the node turns green. Claude Code completes a task — the node updates. You don't touch anything. You just open the app, and the current state of your project is right there."*

A subtle `127.0.0.1` watermark fades in and out at the bottom.

*"All local. Nothing leaves your machine. No accounts. No cloud. No subscription."*

---

### Act 4 — The reveal (0:60 – 0:75)

**Visual**: Pull back. The whole tree is alive — some nodes pulsing, some checked, some queued. It looks like a living organism.

**Narrator**: *"Your plan. Watching itself."*

Hard cut to a real RoadRaven recording — same tree shape, same motion, but unmistakably the actual product. Hold for 2 seconds.

*"RoadRaven."*

Final card: logo + `github.com/[org]/roadraven` + tagline:

> **Your plan. Always current. Zero manual updates.**

---

## Narrator Script (clean read-through for VO talent)

> Imagine you have an idea.
>
> Maybe you want to learn something.
>
> Or build something.
>
> Of course you want to build with AI. Everyone does. So let's say… you want to ship a product.
>
> A web app. A native app. Why not both?
>
> You sketch the tree. You name the pieces. The plan is yours — no sprints, no story points, no opinions baked in.
>
> It's just a JSON file. Living in your repo. Diffable. Reviewable. Yours.
>
> Now connect each node to something real. An AI agent. A CI pipeline. A local script. Anything that can send a message.
>
> GitHub Actions finishes — the node turns green. Claude Code completes a task — the node updates. You don't touch anything. You just open the app, and the current state of your project is right there.
>
> All local. Nothing leaves your machine. No accounts. No cloud. No subscription.
>
> Your plan. Watching itself.
>
> RoadRaven.

**Tone direction for VO**: Conversational, low-stakes, almost confidential. Not announcer-voice. Think "friend explaining a tool they love" — pauses are real, not theatrical.

---

## Key Features Woven In

Source: `.planning/pitch.md`

| Feature (from pitch) | Where it appears | Beat |
|---|---|---|
| Non-opinionated schema (no sprints/points) | Act 2 | *"no sprints, no story points, no opinions baked in"* |
| Plan-as-file — plain JSON, repo-versioned, diffable | Act 2 | `roadmap.json` glyph reveal + *"living in your repo, diffable, reviewable, yours"* |
| You own it 100% | Act 2 | *"Yours."* (final word of Act 2 — delivered as a beat) |
| Live status from anything (WebSocket Tier 1) | Act 3 | *"AI agent. CI pipeline. Local script. Anything that can send a message."* |
| Plugin tier (external systems) | Act 3 | GitHub Actions glyph appears alongside Claude Code glyph |
| AI agent supervision (Claude Code) | Act 3 | First node to light up — establishes the killer use case early |
| Mixed toolchain aggregation | Act 3 | Multiple glyph types (Claude + Actions) on different nodes simultaneously |
| Local-first, `127.0.0.1`, air-gapped | Act 3 | Watermark + *"nothing leaves your machine"* |
| Zero accounts / no SaaS | Act 3 | *"No accounts. No cloud. No subscription."* |
| Tagline | Act 4 final card | *"Your plan. Always current. Zero manual updates."* |

---

## Deliberate Cuts (and why)

- **Jira / Linear / Notion comparisons** — kill momentum in a hero video. Belongs in the README body, not the reel.
- **Tier 1 vs Tier 2 plugin architecture** — too architectural. Viewer just needs to believe nodes can watch anything.
- **`@roadraven/core` / `@roadraven/react` embeddability** — wrong audience for the hero reel; this is for devs evaluating the *app*, not API consumers.
- **5 Scenarios from pitch.md** — too many proof points dilute the story. Act 3 demonstrates two (AI agents + CI), which is enough.
- **Friend Pitch / Real Story sections** — those are pitch artifacts, not narration. The script borrows their tone but is its own thing.

---

## Companion: 5-8s README GIF

A compressed loop of the morphing-node beat only. No narration. No real-product cut.

- **Frame 1**: `[ IDEA ]` node, blinking cursor
- **Frames 2-4**: Text ripples through `LEARN → BUILD → PRODUCT`
- **Frames 5-8**: Tree branches into `web app` / `native app`, then deeper children
- **Final frame**: Full tree visible, one node pulsing green
- **Loop**: Fade back to single `[ IDEA ]` node

Goal: zero-context shareable. Even with no audio and no captions, you understand "this is a planning thing that builds out a tree."

---

## Production Plan

### What to build vs. what to record

| Asset | Tool | Notes |
|---|---|---|
| Acts 1–3 (stylized morphing tree) | After Effects, Rive, or Motion | Pure motion design — black BG, custom node component, controlled timing |
| Act 4 hard-cut (real product) | OBS / native screen recorder | Real RoadRaven session with a pre-built demo `roadmap.json` and a scripted Claude Code run |
| Narration | Voiceover talent (or AI VO for v0 draft) | ~75s read, conversational pace |
| Sound design | Royalty-free synth pad + custom UI sounds | Match clicks/thunks to node beats — sync is critical |
| README GIF | Same AE/Rive comp, exported short | Strip narration, loop the morph beat |

### Demo `roadmap.json` for Act 4

A minimal but believable tree that mirrors what was just shown stylized. Suggested shape:

```
ship-product/
├── web-app/
│   ├── auth          [plugin: claude-code]
│   ├── payments      [plugin: claude-code]
│   └── landing       [plugin: github-actions]
└── native-app/
    ├── ios           [plugin: github-actions]
    ├── android       [plugin: github-actions]
    └── auto-update   [plugin: claude-code]
```

Act 4 holds for 2 seconds — long enough to recognize the shape, short enough to not invite scrutiny.

### Order of operations

1. Lock narrator script (this doc)
2. Throwaway HTML sketch of Act 2 motion to validate timing
3. Demo `roadmap.json` + scripted Claude Code run for Act 4
4. AE/Rive comp for Acts 1–3
5. Record Act 4 footage
6. VO record + sync
7. Sound design pass
8. Export MP4 (75s) + GIF (5–8s)

---

## Open Questions

- **Voiceover**: AI VO for v0 (ElevenLabs etc.) or invest in human VO from the start?
- **Music**: Is there a license-safe synth pad we already like, or do we commission?
- **Logo**: Final logo + wordmark ready for the Act 4 card, or placeholder?
- **GIF host**: README inline (size budget ~2MB) or external (e.g., asciinema-style host)?
- **Captions**: Burn-in subtitles for sound-off viewing? GitHub auto-plays README videos muted.
