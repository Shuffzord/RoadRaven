# CFA Level I 2026 — Per-Topic Generation Spec

This spec is the contract every per-topic generation agent must follow. The
goal is to produce a single milestone-shaped JSON file describing a CFA L1
2026 topic area, fitted to the RoadRaven application schema.

## 1. RoadRaven JSON node shape (FIXED — do not invent fields)

```jsonc
{
  "id": "string (unique, see ID convention below)",
  "title": "string (canonical CFA Institute terminology in EN)",
  "status": "not-started",
  "type": "milestone | phase | plan | task",
  "notes": "string (markdown; see Notes template below)",
  "createdAt": "2026-05-06T00:00:00Z",
  "updatedAt": "2026-05-06T00:00:00Z",
  "metadata": { /* free-form; see Metadata fields below */ },
  "children": [ /* recursive nodes */ ]
}
```

Tasks (leaves) MUST omit `children` (or set it to `[]`).

Status for every node = `"not-started"` (this is a fresh study plan).

`createdAt` / `updatedAt` = `"2026-05-06T00:00:00Z"` for every node.

## 2. Type mapping (CFA → RoadRaven)

| CFA concept                                            | RoadRaven `type` |
|--------------------------------------------------------|------------------|
| Topic area (your assigned topic)                       | `milestone`      |
| Learning Module (LM)                                   | `phase`          |
| Major sub-section inside an LM (grouping of leaves)    | `plan`           |
| Atomic concept / formula / ratio / IFRS-vs-GAAP diff   | `task` (leaf)    |

For very small LMs you can skip the `plan` layer and put `task`s directly
under the `phase`. For large LMs (e.g. FSA Long-Lived Assets) you SHOULD use
`plan` groupings to keep the tree navigable.

## 3. ID convention (must be globally unique across all 10 topic files)

UUID-shaped strings — first segment EXACTLY 8 hex chars (Zod's
`z.string().uuid()` rejects 9-char first segments). Format:

`cfa{TT}{LL}{S}-{XXXX}-4000-8000-{NNNNNNNNNNNN}`

- `cfa` — literal prefix (3 chars)
- `TT` — your topic number, two digits (01..10)
- `LL` — LM index inside topic, two digits (00 = milestone root, 01..NN per LM)
- `S`  — single-hex sub-section index (0..9, a..f gives up to 16 plans per LM)
- That makes the first segment exactly 8 chars: `c f a T T L L S`
- `XXXX` — 4-hex leaf counter inside the sub-section (0000 = plan root,
  0001..ffff per task — gives 65k leaves per plan, plenty)
- `4000` — fixed (UUID v4 marker not enforced by Zod but harmless)
- `8000` — fixed (UUID variant not enforced by Zod but harmless)
- `NNNNNNNNNNNN` — 12-hex unique tail; use `000000000000` if no collision,
  otherwise increment

Examples (Topic 01 Ethics):
- Milestone root: `cfa01000-0000-4000-8000-000000000000`
- LM 03 root:    `cfa01030-0000-4000-8000-000000000000`
- Plan 02 in LM 03: `cfa01032-0000-4000-8000-000000000000`
- Leaf 7 in plan 02 of LM 03: `cfa01032-0007-4000-8000-000000000000`

**Why 8 chars matter:** `cfa010000` (9 chars) is rejected by the Zod schema
in `packages/core/src/schema.ts` and produces "uuid_shape_invalid" warnings
in the validator. The 8-char format passes Zod cleanly.

## 4. Notes template (markdown)

For `task` leaves:

```markdown
# {{Title}}

**LOS:** {{LOS code(s) if known, e.g. "LOS 1.a"}}
**Difficulty:** {{1..5}} · **Estimated:** {{hours}}h

## Opis
{{2-5 zdań po polsku — co to jest, dlaczego ma znaczenie, jak jest egzaminowane}}

## Formuły / kluczowe relacje
- {{plain-text formula or "—" if conceptual}}

## Prerequisites
- {{cross-topic prereq titles if any, else "—"}}

## Common pitfalls
- {{1-3 specific traps candidates fall into}}

## Suggested resources
- CFA Institute Curriculum 2026, Volume {{X}}, Reading "{{name}}"
- {{Schweser / Kaplan / AnalystPrep / Mark Meldrum reference}}
```

For `plan` and `phase` parents:

```markdown
# {{Title}}

{{1-3 zdań overview po polsku — co obejmuje, jak się wpisuje w topic}}

**Learning Modules:** {{count}} · **Egzamin weight (topic):** {{X.X%}}
```

For the `milestone` (topic root):

```markdown
# {{Topic name}}

{{Short English description of the topic and exam relevance}}

**Exam weight (mid-point):** {{X.X%}}
**Learning Modules:** {{count}}
**Estimated study time:** {{hours range}}
```

## 5. Metadata fields

For `task` leaves (the metadata-rich layer):

```jsonc
{
  "los_codes": ["1.a", "1.b"],         // strings; LOS codes if known, else []
  "difficulty": 1..5,                   // integer
  "estimated_hours": 0.25..6.0,         // number; SUM of leaves must hit topic budget
  "prerequisites": [                    // titles or IDs of prereq nodes
    "Time Value of Money",
    "Probability distributions"
  ],
  "formulas": [                         // plain-text formulas; can be empty
    "FV = PV * (1 + r)^n"
  ],
  "common_pitfalls": [                  // 1-3 strings
    "Confusing Macaulay vs modified duration"
  ],
  "suggested_resources": [              // 2+ strings, identifiable
    "CFA Institute Curriculum 2026, Volume 1, Reading 'Time Value of Money'",
    "Schweser SchweserNotes Book 1, SS2, Reading 6"
  ],
  "tags": ["formula", "ratio", "ifrs-gaap-diff", "standard"]  // free
}
```

For `phase` (LM) nodes:

```jsonc
{
  "lm_index": "01..NN",
  "lm_name_canonical": "Time Value of Money",
  "los_count": 4,
  "topic": "Quantitative Methods"
}
```

For `plan` nodes: `{ "section_index": "01..NN" }` (optional).

For the `milestone` root:

```jsonc
{
  "topic_number": "01..10",
  "topic_name": "Ethics & Professional Standards",
  "exam_weight_share": 17.5,
  "lm_count": <integer matching official 2026 curriculum>,
  "estimated_hours_total": <sum of leaf hours>
}
```

## 6. Quality bar (this is the CRITICAL part — read carefully)

Apply the master prompt's standard verbatim:

- **Canonical CFA terminology** in English (titles, formula names, model
  names). Never invent or translate fixed names ("Macaulay duration" stays
  "Macaulay duration", not "duracja Macaulaya").
- **English prose** for descriptions, common pitfalls, learning notes.
- **Granularity floor**: each named ratio, each named formula, each
  IFRS-vs-GAAP difference, each Standard sub-letter, each named valuation
  model gets its OWN leaf. NEVER lump them together.
- **Cross-topic prerequisites**: if your topic depends on a concept owned by
  another topic (e.g. CAPM depends on regression which lives in QM), put the
  prereq title in `metadata.prerequisites`.
- **Difficulty calibration**: most leaves 2-3. Difficulty 5 is exceptional
  (pension calc nuances, OAS interpretation, advanced derivatives strategies,
  currency translation gain/loss).
- **Estimated hours per topic** (your hours-budget — sum of LEAF hours):
  - Topic 01 Ethics: 35-50h
  - Topic 02 Quantitative Methods: 30-40h
  - Topic 03 Economics: 25-35h
  - Topic 04 Financial Statement Analysis: 50-70h
  - Topic 05 Corporate Issuers: 20-30h
  - Topic 06 Equity Investments: 35-50h
  - Topic 07 Fixed Income: 40-55h
  - Topic 08 Derivatives: 20-30h
  - Topic 09 Alternative Investments: 15-25h
  - Topic 10 Portfolio Management: 25-35h
- **Resources**: every leaf has ≥2 entries in `metadata.suggested_resources`.
- **Pitfalls**: every leaf has ≥1 entry in `metadata.common_pitfalls`.
- **Formulas**: plain text, no LaTeX. Greek letters spelled out (sigma, beta).
- **Standards**: full notation — IFRS 15, IAS 36, ASC 842, ASC 606.

## 7. Output file shape — both subtree AND envelope are valid

Each topic agent writes ONE file: `samples/cfa-l1/topic-{TT}-{slug}.json`.

**Two shapes are accepted by the RoadRaven `$ref` resolver:**

(A) Subtree shape — single milestone-node at root:
```json
{
  "id": "cfa01000-0000-4000-8000-000000000000",
  "title": "Ethics & Professional Standards",
  "status": "not-started",
  "type": "milestone",
  "notes": "...",
  "createdAt": "2026-05-06T00:00:00Z",
  "updatedAt": "2026-05-06T00:00:00Z",
  "metadata": { ... },
  "children": [ /* phase nodes for each LM */ ]
}
```

(B) Envelope shape — RoadmapSchema with `nodes: [<milestone>]`:
```json
{
  "version": "1.0",
  "title": "<topic name>",
  "themeConfig": { ... },          // optional but harmless
  "statusConfig": [ ... ],         // optional but harmless
  "typeConfig": [ ... ],           // optional but harmless
  "nodes": [
    {
      "id": "cfa01000-...",
      "type": "milestone",
      ...
      "children": [ ... ]
    }
  ]
}
```

**Why both work:** `resolveRefsWithOwnership` does
`parsed.nodes ?? [parsed]` — if the file has `nodes`, it pulls them; if
not, it wraps the whole object as a single node.

**Which one to write:** prefer (A) subtree. RoadRaven will rewrite the
file to (B) envelope on the next save (see `splitSchemaByOwnership` in
`packages/desktop/src/bun/refMap.ts`), so don't fight that flow — both
shapes round-trip identically.

The validator (`scripts/validate-roadmap.mjs`) accepts both; you'll see
`shape: subtree` or `shape: entry` in its output but neither is an error.

## 8. Validation gate (1-shot rule — no retry loop)

After writing your file, run the GENERIC structural validator ONCE:

```bash
bun run scripts/validate-roadmap.mjs <yourfile> --json
```

The validator returns a single JSON array. Each entry has:

- `ok`: boolean — `true` means zero structural errors
- `errors[]`: hard errors (e.g. `leaf_missing_hours:<id>`,
  `leaf_under_2_resources:<id>`, `leaf_missing_pitfall:<id>`,
  `duplicate_id:<id>`, `missing_required_field:...`)
- `warnings[]`: non-blocking signals (e.g. `uuid_shape_invalid` if you
  used 9-char IDs by mistake)
- `stats`: `{ phases, plans, tasks, leaves, leafHours, ids, refsFound, refsResolved }`

**Acceptance for this workflow:**
- `ok === true` (zero errors)
- `warnings.length === 0` (zero warnings — including no `uuid_shape_invalid`,
  meaning your IDs followed the 8-char convention from §3)

**1 attempt only — no retry loop.** If validation fails, return the
report and STOP. The user inspects and decides next steps. Do NOT keep
re-writing the file in a fix-loop.

The CFA-specific budget validator (`scripts/validate-cfa-roadmap.mjs`)
is NOT used at this stage — content/budget validation is a separate
later step.

## 8a. Hard constraints (avoid past mistakes)

- **One file, one write.** Output ONLY the assigned target file. Do NOT
  write `_lm.json`, drafts, intermediate files, or anything else into
  `samples/cfa-l1/`.
- **No prose to stdout.** Return ONLY the compact status report described
  in your spawn prompt. No CFA explanation, no narration, no apologies.
- **8-char IDs.** Every node ID's first segment must be exactly 8 hex
  chars. `cfa010000` (9 chars) is wrong. `cfa01000` (8 chars) is right.
- **Preserve existing content when re-running on a file that already
  exists.** If your target file already has rich notes, common_pitfalls,
  and suggested_resources, you may keep them. Don't regenerate prose
  unless you have a concrete improvement.

  Note: subtree vs envelope file shape is not a hard constraint
  (see §7). Both pass validation and round-trip through RoadRaven save.

## 9. Coverage minimums (per-topic)

The lists in §11 below are the floor for each topic. Every concept named
there is a leaf in your tree. Add anything from the official 2026
curriculum that the floor omits — the floor is not the ceiling.

## 11. Coverage floor — Topic 01 Ethics & Professional Standards

**Hour budget (informational, not enforced by validator at this stage):**
sum of leaf `estimated_hours` should land in [35, 50].

**Learning Modules (5 phase nodes, canonical 2026 names):**
1. Ethics and Trust in the Investment Profession
2. Code of Ethics and Standards of Professional Conduct
3. Guidance for Standards I-VII
4. Introduction to the Global Investment Performance Standards (GIPS)
5. Ethics Application

**Coverage floor (each item = its own task leaf):**

LM 1 — Ethics and Trust:
- Ethics, society, and capital markets (definition; ethics vs law)
- Investment industry's profession of ethics
- Ethical decision-making framework
- Challenges to ethical conduct (situational, personal, organizational)

LM 2 — Code of Ethics: 6 ethical principles, EACH AS ITS OWN LEAF:
1. Act with integrity, competence, diligence, respect, and ethical
   manner with the public, clients, prospective clients, employers,
   employees, colleagues in the investment profession, and other
   participants in the global capital markets.
2. Place the integrity of the investment profession and the interests
   of clients above their own personal interests.
3. Use reasonable care and exercise independent professional judgment
   when conducting investment analysis, making investment recommendations,
   taking investment actions, and engaging in other professional activities.
4. Practice and encourage others to practice in a professional and
   ethical manner that will reflect credit on themselves and the profession.
5. Promote the integrity and viability of the global capital markets
   for the ultimate benefit of society.
6. Maintain and improve their professional competence and strive to
   maintain and improve the competence of other investment professionals.

LM 2 — Standards of Professional Conduct: ALL 22 sub-letters as separate leaves:
- I-A Knowledge of the Law
- I-B Independence and Objectivity
- I-C Misrepresentation
- I-D Misconduct
- II-A Material Nonpublic Information
- II-B Market Manipulation
- III-A Loyalty, Prudence, and Care
- III-B Fair Dealing
- III-C Suitability
- III-D Performance Presentation
- III-E Preservation of Confidentiality
- IV-A Loyalty (to Employer)
- IV-B Additional Compensation Arrangements
- IV-C Responsibilities of Supervisors
- V-A Diligence and Reasonable Basis
- V-B Communication with Clients and Prospective Clients
- V-C Record Retention
- VI-A Disclosure of Conflicts
- VI-B Priority of Transactions
- VI-C Referral Fees
- VII-A Conduct as Participants in CFA Programs
- VII-B Reference to CFA Institute, the CFA Designation, and the CFA Program

Each Standard sub-letter leaf MUST contain in `notes`:
- The standard's exact canonical English title
- 2-4 English sentences explaining what the obligation requires and what
  triggers a violation
- 1-3 realistic violation patterns in `metadata.common_pitfalls`
- ≥2 entries in `metadata.suggested_resources`

LM 3 — Guidance for Standards I-VII (overview of guidance per standard
group; 1-2 leaves explaining how the Standards of Practice Handbook
expands on the Code).

LM 4 — GIPS: separate leaves for:
- Why GIPS exists and overall scope
- Fundamentals of Compliance
- Input data and calculation methodology (including TWR formula)
- Composite construction
- Disclosure requirements
- Presentation and reporting requirements
- Verification

LM 5 — Ethics Application:
- Application case studies overview (1-2 leaves walking through how to
  apply Code + Standards to realistic dilemmas)

**Difficulty calibration:** most Standards leaves at 2-3. GIPS calculation
methodology may be 3. Decision-making framework 2.

**Estimated hours per leaf:** typically 0.5-2.0h for Standards (memorization
heavy). Some short ones (e.g. VII-B reference rules) may be 0.25-0.5.

## 12. Coverage floor — Topic 02 Quantitative Methods

**Hour budget (informational):** sum of leaf `estimated_hours` ∈ [30, 40].

**Learning Modules (10-12 phase nodes, canonical 2026 names):**
- Rates and Returns
- The Time Value of Money in Finance
- Statistical Measures of Asset Returns
- Probability Trees and Conditional Expectations
- Portfolio Mathematics
- Simulation Methods
- Estimation and Inference
- Hypothesis Testing
- Parametric and Non-Parametric Tests of Independence
- Simple Linear Regression
- Introduction to Big Data Techniques

**Coverage floor (each item = its own task leaf):**

Time Value of Money:
- FV (lump sum), PV (lump sum), Annuity (ordinary), Annuity due,
  Perpetuity, Growing annuity, Growing perpetuity, Solving for r,
  Solving for n, Stated vs effective annual rate, Continuous compounding.

Returns (each as own leaf):
- Holding period return, Arithmetic mean return, Geometric mean return,
  Harmonic mean return, Money-weighted return (IRR), Time-weighted return,
  Gross vs net return, Pre-tax vs after-tax return, Real vs nominal return,
  Leveraged return.

Descriptive statistics:
- Mean (separate from median, mode), Median, Mode, Range, Mean absolute
  deviation, Variance, Standard deviation, Skewness, Kurtosis,
  Coefficient of variation, Box plot, Percentiles, Quartiles, Deciles.

Probability:
- Unconditional probability, Conditional probability, Joint probability,
  Total probability rule, Bayes' theorem, Combinations, Permutations,
  Multinomial.

Distributions (each as own leaf):
- Discrete uniform, Bernoulli, Binomial, Continuous uniform,
  Normal distribution, Lognormal distribution, Student's t,
  Chi-square, F-distribution, Standard normal (z-distribution),
  z-score and confidence intervals.

Sampling and estimation:
- Simple random sampling, Stratified random sampling, Cluster sampling,
  Systematic sampling, Sampling distribution, Central limit theorem,
  Standard error, Point estimate vs interval estimate,
  t-distribution vs z-distribution selection.

Hypothesis testing:
- Null vs alternative hypothesis, Type I vs Type II error, p-value,
  One-tailed vs two-tailed test, t-test for single mean,
  t-test for difference of means (paired/unpaired),
  Chi-square test for variance, F-test for variance ratio,
  Parametric vs non-parametric tests.

Regression and correlation:
- Simple linear regression model, Assumptions of linear regression,
  Consequences of assumption violations, R-squared,
  Standard error of estimate, F-statistic,
  t-statistic for coefficients, Confidence interval for predicted value,
  Multiple regression basics, Pearson correlation coefficient,
  Spearman rank correlation, Correlation vs causation.

Simulation, Big Data, Fintech:
- Monte Carlo simulation overview, Bootstrap resampling, Big data basics,
  Machine learning concepts (supervised / unsupervised / deep learning at
  L1 overview level), Fintech overview, Robo-advisors.

**Cross-topic prerequisites to surface in `metadata.prerequisites`:**
- TVM concepts are prereqs for every DCF model (Equity, FI, CI, AI, PM)
- Regression is prereq for beta estimation (CI, PM)
- Descriptive statistics is prereq for portfolio risk measures (PM)
- Probability distributions is prereq for VaR (PM)

**Difficulty calibration:** most leaves 2-3. Bayes' theorem 3.
Regression assumption violations 3-4. Hypothesis testing nuances 3.

## 10. NO OUTPUT BUT THE FILE

Your only side effect is writing one JSON file at the path above. Your
returned message is a short status report (file path, counts, any caveats).
No prose explaining what CFA is. No re-stating instructions.
