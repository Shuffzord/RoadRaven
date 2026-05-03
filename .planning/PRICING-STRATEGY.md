# RoadRaven — Pricing Strategy

**Created:** 2026-04-13

---

## 1. Value Delivered

| Dimension | Detail |
|---|---|
| **Core value** | Turns static roadmaps into live dashboards — nodes update themselves from external systems |
| **Customer's alternative** | Manual updates in Notion/Jira + switching between 3-5 monitoring tools. Cost: ~15-30 min/day of context-switching and manual status updates |
| **Quantifiable outcome** | Eliminates "plan vs. reality" drift; saves ~5-8 hrs/week for developers running AI agents or multi-tool pipelines |
| **Unique moat** | Only tool combining: tree visualization + JSON file backing + live push updates. 20+ tools reviewed, none cover all three |

---

## 2. Recommended Pricing Model: Open Core + Prosumer Tier (Obsidian Model)

This is the strongest fit for RoadRaven based on three factors:

1. **Local-first, file-based** — identical DNA to Obsidian, which proved this model at scale
2. **Developer audience** — developers accept "free for personal, paid for commercial" licensing
3. **Plugin ecosystem potential** — natural upsell path without gating core functionality

### Why NOT Other Models

| Model | Why Not |
|---|---|
| Per-seat | No collaboration in v1; feels wrong for a personal tool |
| Usage-based | Nothing to meter — it's a desktop app opening files |
| Pure freemium | No network effects to drive viral adoption |
| Flat-rate SaaS | No cloud component in v1; would feel forced |

---

## 3. Competitive Pricing Landscape

| Tool | Pricing | What It Does Differently |
|---|---|---|
| **Obsidian** | Free personal / $50/yr commercial | Local-first markdown knowledge base — closest pricing analogy |
| **Linear** | Free (small teams) / $8/seat/mo | Cloud-first issue tracker — coordination tool, not instrumentation |
| **Jira** | Free (10 users) / $8.15/seat/mo | Enterprise project management — heavyweight, SaaS |
| **Notion** | Free personal / $10/seat/mo | General workspace — manual updates, no live feeds |
| **n8n** | Free self-hosted / $20/mo cloud | Workflow automation — engine, not dashboard |
| **Mermaid/D2** | Free (OSS) | Static diagram rendering — no live updates |

**RoadRaven's position:** Premium personal tool (Obsidian tier), not enterprise SaaS. The product competes on *category creation* (live roadmap dashboard), not on features within an existing category.

---

## 4. Pricing Structure

| Tier | Price | Target Segment | Key Features | Positioning |
|---|---|---|---|---|
| **Personal** | **Free** (MIT open source) | Solo devs, students, hobbyists, OSS contributors | Full desktop app, all 3 themes, JSON editor, tree viewer, WebSocket Event API, unlimited nodes, local file storage | "Your plan, always current" |
| **Pro** | **$49/year** or **$5/month** | Professional developers, freelancers, indie hackers using commercially | Everything in Personal + commercial use license + priority bug fixes + early access to new features | "Built for builders who ship" |
| **Team** | **$12/seat/month** (min 3 seats) | Small teams (3-15 people) wanting shared roadmaps | Everything in Pro + cloud sync (v1.1+) + shared file collaboration + team plugin marketplace access | "One tree, one team, one truth" |

### Value Metric

**Licensed user** — not nodes, not files, not connections. Simple and predictable.

### Annual Discount

- Pro: $49/yr (18% discount vs monthly)
- Team: $10/seat/month billed annually (17% discount)

---

## 5. Feature Gating Strategy

The gating philosophy: **the core product is never crippled.** Revenue comes from commercial licensing and cloud features — not from artificial limits on the local experience.

| Feature | Personal (Free) | Pro ($49/yr) | Team ($12/seat/mo) |
|---|---|---|---|
| Desktop app (all platforms) | Yes | Yes | Yes |
| All themes + custom themes | Yes | Yes | Yes |
| Unlimited nodes/files | Yes | Yes | Yes |
| WebSocket Event API | Yes | Yes | Yes |
| Claude Code MCP wrapper | Yes | Yes | Yes |
| Commercial use | No | **Yes** | **Yes** |
| Priority support | No | **Yes** | **Yes** |
| Early access builds | No | **Yes** | **Yes** |
| Premium plugins (GitHub Actions, Linear, Jira) | Community-built only | **Official plugins included** | **Official plugins included** |
| Cloud sync | No | No | **Yes** |
| Shared/team roadmaps | No | No | **Yes** |

---

## 6. Price Sensitivity Estimate

Based on competitive positioning and target audience (individual developers, indie hackers):

| Threshold | Estimated Price Point |
|---|---|
| **Too cheap** (quality concerns) | < $2/month |
| **Good value** (sweet spot) | $4-6/month |
| **Getting expensive** (hesitation) | $8-10/month |
| **Too expensive** (won't buy) | > $15/month |

**$49/year ($4.08/mo effective) sits squarely in the "good value" zone** — mirrors Obsidian's proven price point for the same audience.

---

## 7. Pricing Experiments to Run

| Experiment | Method | What It Tests |
|---|---|---|
| **Landing page price test** | A/B test: $39/yr vs $49/yr vs $69/yr | Conversion elasticity |
| **Annual-only vs monthly option** | A/B test: show monthly toggle vs annual-only | Whether monthly option increases or cannibalizes annual |
| **Plugin bundling** | Offer Pro with 3 plugins vs Pro + plugin marketplace | Whether plugin a la carte drives more revenue |
| **Founder sales calls** | 10 calls with target users before launch | Willingness to pay, feature priority validation |
| **"Pay what you want" launch** | 30-day launch window with suggested $49 | Reveals true WTP distribution |

---

## 8. Revenue Projections (Conservative)

| Metric | Year 1 | Year 2 |
|---|---|---|
| Free users | 2,000 | 8,000 |
| Pro conversion rate | 3-5% | 5-8% |
| Pro subscribers | 60-100 | 400-640 |
| Pro ARR | $2,940 - $4,900 | $19,600 - $31,360 |
| Team subscribers | 0 (not launched) | 50-100 seats |
| Team ARR | $0 | $6,000 - $12,000 |
| **Total ARR** | **$2,940 - $4,900** | **$25,600 - $43,360** |

---

## 9. Key Assumptions to Validate

| Assumption | How to Test |
|---|---|
| Developers will pay $49/yr for a commercial license of a tool they can use free | Obsidian precedent + founder sales calls |
| AI agent monitoring is a compelling enough use case to drive adoption | Landing page conversion test with "AI agent monitoring" vs generic messaging |
| Plugin ecosystem creates meaningful lock-in for Pro tier | Track which plugins drive Pro conversions |
| Cloud sync is the right Team tier differentiator | Survey existing users before building |
| The "personal free / commercial paid" boundary is enforceable enough | Monitor honor-system compliance; add license check in v1.1 if needed |

---

## 10. Risks and Mitigations

| Risk | Mitigation |
|---|---|
| **Free tier is too generous — no reason to pay** | Commercial license enforcement + premium plugins + early access create enough pull; Obsidian proved this works |
| **Market too small — "live roadmap" is too niche** | Broaden positioning: "live project dashboard" covers CI monitoring, learning roadmaps, data pipeline views |
| **Open source competitors copy the model** | Speed + plugin ecosystem + brand. First-mover in the category matters more than defensibility |
| **Cloud sync is expensive to build for Team tier** | Defer Team tier until Pro revenue validates demand; use simple file-sync (Dropbox/Git) as interim |
| **Price anchored too low at $49/yr** | Easier to raise prices than lower them; start at $49, test $69 after establishing value |

---

## Summary

```
Recommended Model: Open Core + Prosumer (Obsidian model)
Value Metric: Licensed user (personal vs commercial use)

| Tier     | Price         | Target              | Key Differentiator           |
|----------|---------------|----------------------|------------------------------|
| Personal | Free (MIT)    | Solo/hobby/OSS       | Full product, non-commercial |
| Pro      | $49/year      | Professional devs    | Commercial license + plugins |
| Team     | $12/seat/mo   | Small teams (v1.1+)  | Cloud sync + collaboration   |

Key Assumptions:
- Obsidian model transfers to dev tooling -> Validate with founder sales calls
- AI agent monitoring drives adoption -> A/B test landing page messaging
- $49/yr is the sweet spot -> Test $39/$49/$69 variants

Risks:
- Free tier too generous -> Mitigate with premium plugins + early access
- Market too niche -> Broaden positioning beyond "roadmaps"
```

The Obsidian model is the strongest fit because RoadRaven shares its DNA: local-first, file-based, developer audience, no cloud dependency in v1. Obsidian generates ~$50M+ ARR with this model. The key is to **never cripple the free product** — revenue comes from commercial licensing and ecosystem features, not artificial limits.
