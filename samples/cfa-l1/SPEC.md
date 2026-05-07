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

## 13. Coverage floor — Topic 03 Economics

**Hour budget (informational):** sum of leaf `estimated_hours` ∈ [25, 35].

**Learning Modules (8-10 phase nodes, canonical 2026 names):**
- The Firm and Market Structures
- Aggregate Output, Prices, and Economic Growth
- Understanding Business Cycles
- Monetary and Fiscal Policy
- Introduction to Geopolitics
- International Trade
- Capital Flows and the FX Market
- Exchange Rate Calculations

**Coverage floor (each item = its own task leaf):**

Microeconomics:
- Demand function, Supply function, Equilibrium price/quantity
- Price elasticity of demand, Income elasticity of demand,
  Cross-price elasticity
- Consumer surplus, Producer surplus
- Consumer choice theory (utility maximization), Indifference curves,
  Budget constraint, Substitution effect, Income effect
- Production function, Returns to scale, Marginal product of labor,
  Marginal product of capital
- Cost curves: Fixed cost, Variable cost (separate leaves),
  Marginal cost, Average total cost, Average variable cost
- Profit maximization (MR=MC)
- Market structures (each as own leaf): Perfect competition,
  Monopolistic competition, Oligopoly (Cournot/Bertrand/Stackelberg
  may be one leaf), Monopoly
- Long-run vs short-run equilibrium per structure, Pricing power
- Game theory: Dominant strategy, Nash equilibrium, Prisoner's dilemma

Macroeconomics:
- GDP measurement: Expenditure approach, Income approach,
  Value-added approach (3 separate leaves)
- Nominal vs real GDP, GDP deflator
- Aggregate demand (short-run, long-run), Aggregate supply
  (short-run, long-run), AD-AS shifts
- IS-LM model
- Business cycle phases (expansion/peak/contraction/trough),
  Leading/coincident/lagging indicators
- Inflation: CPI, PPI, Headline vs core inflation, Demand-pull,
  Cost-push, Hyperinflation, Deflation/disinflation
- Unemployment types (frictional/structural/cyclical — separate leaves),
  NAIRU/natural rate
- Phillips curve (short-run), Phillips curve (long-run / vertical)
- Monetary policy tools: Open market operations, Reserve requirements,
  Discount rate / policy rate, Transmission mechanism, Neutral rate,
  Taylor rule
- Fiscal policy: Automatic stabilizers, Discretionary fiscal policy,
  Fiscal multiplier, Crowding-out effect

International economics:
- Foreign exchange: Spot rate, Forward rate, Cross rate,
  Bid-ask spread (FX), Triangular arbitrage
- Covered interest rate parity, Uncovered interest rate parity,
  Purchasing power parity (absolute), PPP (relative),
  International Fisher effect
- Exchange rate regimes (≥3 of: fixed, floating, managed float,
  currency board, dollarization)
- Balance of payments (current account, capital and financial account)
- International trade theory: Absolute advantage, Comparative advantage,
  Heckscher-Ohlin
- Trade restrictions: Tariffs, Quotas, Voluntary export restraints,
  Subsidies

Economic growth:
- Sources of economic growth, Total factor productivity,
  Solow growth model basics, Convergence hypothesis (absolute /
  conditional / club may be 1-3 leaves)

Influence of economic growth on equity markets (1 leaf if in 2026 LM list).

Geopolitics LM: geopolitical risk types, impact on investments
(1-3 leaves).

**Cross-topic prerequisites:**
- FX parity conditions → currency hedging in Equity, FI
- Monetary policy → yield-curve theories in FI

**Difficulty calibration:** most leaves 2-3. Solow / Phillips / Taylor /
Nash / oligopoly modeled at 3.

## 14. Coverage floor — Topic 04 Financial Statement Analysis (LARGEST)

**Hour budget (informational):** sum of leaf `estimated_hours` ∈ [50, 70].
This is the largest topic in CFA L1.

**Learning Modules (typically 12-17 phase nodes):**
- Introduction to Financial Statement Analysis
- Analyzing Income Statements
- Analyzing Balance Sheets
- Analyzing Statements of Cash Flows I (preparation)
- Analyzing Statements of Cash Flows II (analysis)
- Analysis of Inventories
- Analysis of Long-Term Assets
- Analysis of Income Taxes
- Analysis of Non-Current Liabilities
- Financial Reporting Quality
- Financial Analysis Techniques
- Introduction to Financial Statement Modeling

**Coverage floor (each item = its own task leaf):**

Introduction to FSA:
- Role and scope of financial reporting
- Standard setters: IASB, FASB (separate leaves)
- Regulatory authorities: SEC, ESMA, IOSCO (separate leaves)
- Audit reports: Unqualified, Qualified, Adverse, Disclaimer (4 leaves)

Balance sheet:
- Current vs non-current asset classification
- Current vs non-current liability classification
- Asset valuation: Cost, Fair value, Present value (3 leaves)
- Equity components, Common-size balance sheet

Income statement (IFRS 15 / ASC 606):
- 5-step revenue recognition: Identify contract, Identify performance
  obligations, Determine transaction price, Allocate transaction price,
  Recognize revenue (5 separate leaves)
- Expense recognition / matching principle, Capitalizing vs expensing
- Non-recurring items, Discontinued operations,
  Unusual or infrequent items
- EPS basic, EPS diluted (treasury stock method, if-converted method
  as separate leaves)
- Comprehensive income vs net income, OCI components

Cash flow statement:
- Operating, Investing, Financing sections (3 leaves)
- Direct method, Indirect method (separate leaves)
- Conversion indirect→direct
- IFRS vs US GAAP classification of interest paid/received and dividends
  paid/received (each as a separate IFRS-vs-GAAP-difference leaf)
- FCFF calculation from CFO, FCFE calculation from CFO

Financial ratios — EVERY named ratio is its OWN leaf:

Activity:
- Inventory turnover, Days of inventory on hand (DOH),
  Receivables turnover, Days of sales outstanding (DSO),
  Payables turnover, Days payables outstanding (DPO),
  Working capital turnover, Fixed asset turnover, Total asset turnover

Liquidity:
- Current ratio, Quick ratio, Cash ratio,
  Defensive interval ratio, Cash conversion cycle

Solvency:
- Debt-to-assets, Debt-to-capital, Debt-to-equity,
  Financial leverage, Interest coverage, Fixed charge coverage

Profitability:
- Gross profit margin, Operating profit margin, Pretax profit margin,
  Net profit margin, Return on assets (ROA), Operating ROA,
  Return on equity (ROE), Return on common equity,
  Return on total capital, Return on invested capital (ROIC)

Valuation:
- P/E (trailing, forward — separate leaves), P/B, P/S, P/CF,
  Dividend yield

DuPont:
- 3-factor DuPont, 5-factor DuPont (2 separate leaves)

Inventory (IAS 2 / ASC 330):
- FIFO, LIFO, Weighted average cost, Specific identification (4 leaves)
- Effect on COGS / gross margin / ending inventory under rising vs
  falling prices
- LIFO reserve, LIFO liquidation, LIFO→FIFO conversion adjustment
- Inventory writedowns: LCM (US GAAP), NRV (IFRS) — separate leaves
- Reversal of inventory writedown (IFRS-vs-GAAP own leaf)

Long-lived assets (IAS 16, IAS 38, IAS 36, ASC 360, ASC 350):
- Capitalization vs expensing, Capitalized interest
- Depreciation: Straight-line, Double-declining balance,
  Units of production (3 separate leaves)
- Useful life and residual value
- Component depreciation (IFRS-vs-GAAP own leaf)
- Impairment under IFRS (one-step), Impairment under US GAAP (two-step)
- Reversal of impairment for non-goodwill assets (IFRS-vs-GAAP own leaf)
- Revaluation model under IFRS (IFRS-vs-GAAP own leaf)
- Investment property under IFRS (IFRS-vs-GAAP own leaf)
- Derecognition / gain-loss on sale
- Intangible assets: finite life, indefinite life, goodwill
- Goodwill impairment testing (IFRS-vs-GAAP own leaf)
- Internally developed intangibles, R&D capitalization
  (IFRS-vs-GAAP own leaf — IFRS allows development capitalization,
  US GAAP expenses)

Income taxes (IAS 12, ASC 740):
- Permanent vs temporary differences
- Origination and reversal of temporary differences
- Deferred tax assets, Deferred tax liabilities
- Valuation allowance (US GAAP own leaf)
- Effective tax rate vs statutory tax rate reconciliation
- Deferred tax classification (IFRS-vs-GAAP own leaf)

Long-term liabilities:
- Bonds payable: Issuance at par, Issuance at premium,
  Issuance at discount (3 separate leaves)
- Effective interest rate method amortization
- Debt covenants
- Leases under IFRS 16 (lessee single-model)
- Leases under ASC 842 (finance vs operating — IFRS-vs-GAAP own leaf)
- Lessor accounting
- Defined contribution pension plan, Defined benefit pension plan basics
- Off-balance-sheet financing

Quality of financial reports:
- Earnings quality, Cash flow quality, Balance sheet quality
- Aggressive vs conservative accounting choices
- Earnings management techniques (each as own leaf):
  Revenue recognition manipulation, Expense capitalization,
  Cookie jar reserves, Channel stuffing, Bill-and-hold transactions
- Beneish M-score, Altman Z-score, Sloan accruals ratio

IFRS vs US GAAP differences (each its OWN leaf, in addition to those
already listed above):
- LIFO permitted in US GAAP, prohibited under IFRS
- Reversal of inventory writedowns
- Revaluation model for PP&E
- Investment property fair value option
- Development costs capitalization
- Impairment reversals (non-goodwill)
- Goodwill impairment testing procedure
- Deferred tax classification
- Lease classification criteria
- Component depreciation requirement
- CFO classification of interest/dividends paid/received

**Cross-topic prerequisites:**
- Income statement → ratio analysis (used in Equity, Corporate Issuers)
- Balance sheet → ratio analysis
- Cash flow statement → FCFF/FCFE → equity DCF (Equity)

**Difficulty calibration:** most leaves 2-3. LIFO→FIFO conversion 3.
Pension nuances 3-4. IFRS-vs-GAAP differences mostly 2 (recognition is
enough at L1). Deferred tax interpretation 3.

## 15. Coverage floor — Topic 05 Corporate Issuers

**Hour budget (informational):** sum of leaf `estimated_hours` ∈ [20, 30].

**Learning Modules (typically 7-9 phase nodes):**
- Organizational Forms, Corporate Issuer Features, and Ownership
- Investors and Other Stakeholders / Corporate Governance
- Working Capital and Liquidity
- Capital Investments / Capital Allocation
- Capital Structure
- Cost of Capital — Foundational Topics
- Business Models

**Coverage floor (each item = its own task leaf):**

Organization and ownership:
- Goals of the firm
- Legal forms (5 separate leaves): Sole proprietorship, General partnership,
  Limited partnership, Corporation, Limited liability company
- Public vs private company
- Stakeholders (each as own leaf): Shareholders, Creditors,
  Board of directors, Employees, Customers, Suppliers, Regulators, Community

Principal-agent and governance:
- Shareholder–manager principal-agent problem
- Controlling vs minority shareholder conflict
- Manager–creditor conflict
- Shareholder–creditor conflict
- Corporate governance overview
- Board structure: One-tier vs two-tier (separate leaves)
- Independent directors
- Board committees (each as own leaf): Audit, Compensation,
  Nominating, Risk
- Shareholder rights (5 separate leaves): Voting rights, Proxy voting,
  Cumulative voting, Statutory voting, Preemptive rights
- Anti-takeover provisions (4 separate leaves): Poison pills,
  Staggered boards, Supermajority voting, Golden parachutes
- ESG considerations (Environmental, Social, Governance — at least 1 leaf,
  ideally 3)

Working capital:
- Cash conversion cycle
- Primary sources of liquidity, Secondary sources of liquidity
- Drags on liquidity, Pulls on liquidity
- Short-term financing instruments (commercial paper, line of credit,
  factoring — separate leaves)

Capital allocation:
- NPV method, IRR method, Payback period, Discounted payback period,
  Profitability index (5 separate leaves)
- Conflicts between NPV and IRR (multiple IRRs, scale, timing)
- Real options (4 separate leaves): Timing, Abandonment, Expansion,
  Flexibility

Cost of capital:
- WACC formula, Marginal cost of capital, Optimal capital budget
- Cost of debt: YTM approach, Cost of debt: Debt-rating approach
  (separate leaves), After-tax cost of debt
- Cost of preferred stock
- Cost of equity: CAPM, Cost of equity: DDM approach,
  Cost of equity: Bond-yield-plus-risk-premium (3 separate leaves)
- Beta estimation: Regression method, Beta estimation: Pure-play method
  (unlevered/relevered) — separate leaves
- Country risk premium adjustment, Project beta vs company beta

Capital structure:
- Modigliani-Miller without taxes (Proposition I, Proposition II — separate)
- Modigliani-Miller with taxes
- Static trade-off theory, Pecking order theory
- Bankruptcy costs (direct, indirect — separate leaves)
- Optimal capital structure determinants
- Business risk vs financial risk
- DOL formula and interpretation, DFL formula and interpretation,
  DTL (3 separate leaves)
- Breakeven analysis (sales breakeven), Operating breakeven

Dividends and share repurchases:
- Dividend types (5 separate leaves): Cash, Stock dividend, Stock split,
  Special, Liquidating
- Dividend policy (3 separate leaves): Stable, Constant payout ratio,
  Residual
- Dividend chronology dates (4 separate leaves): Declaration,
  Ex-dividend, Holder of record, Payment
- Share repurchases vs cash dividends
- Share repurchase methods (4 separate leaves): Open market,
  Fixed-price tender offer, Dutch auction tender, Direct negotiation
- Effects of repurchase on EPS and book value per share

Business models:
- Types of business models, revenue models, value creation/capture,
  pricing strategies (1-3 leaves)

**Cross-topic prerequisites:**
- WACC depends on CAPM (CI) which depends on regression (QM)
- NPV/DCF depends on TVM (QM)

**Difficulty calibration:** most leaves 2-3. Pure-play beta 3.
MM propositions 3. Real options 3.

## 16. Coverage floor — Topic 06 Equity Investments

**Hour budget (informational):** sum of leaf `estimated_hours` ∈ [35, 50].

**Learning Modules (typically 8-10 phase nodes):**
- Market Organization and Structure
- Security Market Indexes
- Market Efficiency
- Overview of Equity Securities
- Company Analysis: Past and Present
- Industry and Competitive Analysis
- Company Analysis: Forecasting
- Equity Valuation: Concepts and Basic Tools

**Coverage floor (each item = its own task leaf):**

Equity security types:
- Common stock
- Preferred stock — Cumulative, Participating, Convertible, Callable,
  Putable (5 separate preferred-stock leaves)
- Private equity vs public equity
- Depository receipts: ADR (sponsored vs unsponsored — 2 leaves), GDR

Markets and trading:
- Primary markets (3 separate leaves): IPO, Seasoned/follow-on,
  Private placement
- Secondary markets (4 separate leaves): Exchanges, OTC, ATS,
  Dark pools
- Order types (4 separate leaves): Market, Limit, Stop-loss, Stop-limit
- Long position, Short position
- Margin trading: Initial margin, Maintenance margin (separate leaves)
- Margin call calculation, Short selling mechanics, Securities lending

Market efficiency:
- EMH — Weak form, Semi-strong form, Strong form (3 separate leaves)
- Implications of each form for active vs passive management
- Anomalies (≥5 separate leaves): Momentum effect, Value effect,
  Size effect, Calendar effects, Post-earnings announcement drift

Behavioral finance biases — EACH as own leaf:
- Representativeness, Overconfidence, Loss aversion, Herding, Anchoring,
  Framing, Mental accounting, Disposition effect, Confirmation bias,
  Availability bias

Indices:
- Index methods (4 separate leaves): Price-weighted, Market-cap weighted,
  Equal-weighted, Fundamental-weighted
- Float-adjusted market cap, Rebalancing, Reconstitution, Tracking error

Industry and company analysis:
- Industry classification systems (3 separate leaves): GICS, ICB, NAICS
- Industry life cycle (embryonic, growth, shakeout, mature, decline —
  separate leaves or combined ≥3 leaves)
- Porter's Five Forces (5 separate leaves): Threat of new entrants,
  Bargaining power of suppliers, Bargaining power of buyers,
  Threat of substitutes, Industry rivalry
- PESTLE analysis
- Company analysis framework

Equity valuation models — EACH as own leaf:
- DDM single-stage Gordon growth, DDM two-stage growth, DDM H-model,
  DDM three-stage (4 separate leaves)
- FCFF model, FCFE model
- Residual income / EVA overview (if in 2026)
- Multiplier models (each as own leaf): P/E trailing, P/E forward,
  P/E justified, P/B, P/S, P/CF, EV/EBITDA, EV/Sales (8 separate leaves)
- Asset-based valuation
- Method of comparables vs method of forecasted fundamentals

Required return / supporting concepts:
- Sustainable growth rate (g = b × ROE)
- Required return on equity via CAPM
- Required return via multifactor models
- Required return via build-up method
- Justified P/E derivation from Gordon model

**Cross-topic prerequisites:**
- DCF and DDM depend on TVM (QM)
- CAPM depends on regression (QM) and beta (Corp Issuers)
- WACC for FCFF inputs comes from Corp Issuers
- FCFE/FCFF reconstruction requires CFO from FSA

**Difficulty calibration:** most leaves 2-3. H-model 3.
EV/EBITDA adjustments 3. Justified P/E derivation 3-4.

## 17. Coverage floor — Topic 07 Fixed Income

**Hour budget (informational):** sum of leaf `estimated_hours` ∈ [40, 55].

**Learning Modules (typically 10-12 phase nodes, canonical 2026 names):**
- Fixed-Income Instrument Features
- Fixed-Income Cash Flows and Types
- Fixed-Income Issuance and Trading
- Fixed-Income Markets for Corporate Issuers
- Fixed-Income Markets for Government Issuers
- Fixed-Income Bond Valuation: Prices and Yields
- Yield and Yield Spread Measures for Fixed-Rate Bonds
- Yield and Yield Spread Measures for Floating-Rate Instruments
- The Term Structure of Interest Rates: Spot, Par, and Forward Curves
- Interest Rate Risk and Return
- Yield-Based Bond Duration Measures and Properties
- Yield-Based Bond Convexity and Portfolio Properties
- Curve-Based and Empirical Fixed-Income Risk Measures
- Credit Risk
- Credit Analysis for Government Issuers
- Credit Analysis for Corporate Issuers
- Fixed-Income Securitization
- Asset-Backed Security (ABS) Instrument and Market Features
- Mortgage-Backed Security (MBS) Instrument and Market Features

(Trim/group LMs to actual 2026 LM count — typically 10-12 phases.)

**Coverage floor (each item = its own task leaf):**

Bond fundamentals:
- Par value, Coupon rate (fixed vs floating — separate leaves), Maturity,
  Currency denomination
- Indenture, Affirmative covenants, Negative covenants (separate leaves)
- Sources of bond returns (coupon, reinvestment, capital gain/loss)

Bond classification:
- Sovereign bonds — developed market, Sovereign bonds — emerging market
  (separate leaves)
- Supranational bonds, Agency / quasi-government, Municipal bonds,
  Corporate bonds (separate leaves)
- Investment-grade vs high-yield (separate leaves)
- Secured vs unsecured, Senior vs subordinated (separate leaves)

Special features / structures:
- Callable bond, Putable bond, Convertible bond (3 separate leaves)
- Sinking fund provision, Floating-rate notes, Inflation-linked bonds (TIPS),
  Step-up notes, Deferred coupon bonds, Credit-linked notes,
  Zero-coupon bonds (each its own leaf)

Markets:
- Auction process for government bonds, Primary dealers
- OTC nature of bond markets
- Repo market, Repo rate, Haircut, Reverse repo (each its own leaf)

Securitization:
- SPE/SPV structure
- Asset-backed securities (ABS)
- Mortgage-backed securities (MBS)
- Tranching: senior/mezzanine/equity (subordination)
- Prepayment risk, Extension risk, Contraction risk (3 separate leaves)
- CDOs, CLOs (separate leaves)
- MBS prepayment models (PSA)
- Sequential pay tranches, Planned amortization class (PAC) tranches
- Stripped MBS — IO and PO (separate leaves)

Bond pricing:
- Bond price as PV of cash flows
- Spot rates, Forward rates, Par rates (3 separate leaves)
- Bootstrapping spot curve from par yields
- Z-spread, Option-Adjusted Spread (OAS), Asset swap spread
  (3 separate leaves)
- Flat (clean) price vs full (dirty) price, Accrued interest
- Day count conventions (3 separate leaves): 30/360, Actual/Actual,
  Actual/360

Yield measures — EACH as own leaf:
- Current yield, Yield-to-maturity, Yield-to-call, Yield-to-put,
  Yield-to-worst, Effective annual yield, Bond equivalent yield,
  Money market yield, Discount basis yield (T-bill),
  Holding period yield, Total return

Yield curve and term structure:
- Spot curve, Par curve, Forward curve (3 separate leaves)
- Term structure theories (4 separate leaves): Pure expectations,
  Liquidity preference, Market segmentation, Preferred habitat
- Yield curve shapes (4 separate leaves): Normal (upward), Inverted,
  Flat, Humped

Risk measures (duration & convexity):
- Macaulay duration, Modified duration, Effective duration,
  Key rate duration (4 separate leaves)
- Convexity: Effective convexity, Modified convexity (separate leaves)
- Money duration, Price value of basis point (PVBP/PV01) — separate leaves
- Spread duration
- Empirical duration vs analytical duration (separate leaves)
- Bullet vs barbell portfolio (in context of duration matching)

Credit risk:
- Credit rating agencies (3 separate leaves): S&P, Moody's, Fitch
- Rating scales — investment grade thresholds
- Probability of default, Loss given default, Expected loss
  (each its own leaf)
- Credit spread, Credit migration risk
- Structural models (Merton overview), Reduced-form models (overview)
- Credit cycles, Sovereign credit risk vs corporate credit risk

**Cross-topic prerequisites:**
- Bond pricing depends on TVM (QM)
- Spot/forward parity is reused in DER (forwards, swaps)
- Credit spread analysis ties to Equity multipliers

**Difficulty calibration:** most leaves 2-3. OAS interpretation 4.
Empirical vs analytical duration 3. PSA prepayment model 3.
Bootstrapping spot curve 3-4.

## 18. Coverage floor — Topic 08 Derivatives

**Hour budget (informational):** sum of leaf `estimated_hours` ∈ [20, 30].

**Learning Modules (typically 5-7 phase nodes, canonical 2026 names):**
- Derivative Instrument and Derivative Market Features
- Forward Commitment and Contingent Claim Features and Instruments
- Derivative Benefits, Risks, and Issuer and Investor Uses
- Arbitrage, Replication, and the Cost of Carry in Pricing Derivatives
- Pricing and Valuation of Forward Contracts and for an Underlying
  with Varying Cash Flows
- Pricing and Valuation of Futures Contracts
- Pricing and Valuation of Interest Rates and Other Swaps
- Pricing and Valuation of Options
- Option Replication Using Put–Call Parity
- Valuing a Derivative Using a One-Period Binomial Model

(Trim/group LMs to actual 2026 LM count — typically 5-7 phases.)

**Coverage floor (each item = its own task leaf):**

Derivative basics:
- Forward commitments vs contingent claims
- Exchange-traded vs OTC derivatives
- Linear vs non-linear payoffs
- Hedger / speculator / arbitrageur (3 separate leaves)
- Functions of derivatives in capital markets

Forwards:
- Forward contract definition and mechanics
- Forward pricing (no-arbitrage / cash-and-carry)
- Valuation between dates
- Settlement: cash settlement, Settlement: physical settlement
  (separate leaves)
- Counterparty risk in forwards

Futures:
- Standardization features
- Marking-to-market (daily settlement)
- Initial margin, Maintenance margin, Variation margin (3 separate leaves)
- Basis (cash − futures)
- Contango, Backwardation (separate leaves)
- Open interest, Convergence at expiration
- Equity index futures, Interest rate futures, Currency futures,
  Commodity futures (4 separate futures-category leaves)

Forward rate agreements (FRA):
- FRA mechanics, FRA pricing, FRA settlement formula (each its own leaf)

Swaps:
- Plain vanilla interest rate swap (fixed-for-floating)
- Currency swap, Equity swap (separate leaves)
- Swap as a portfolio of FRAs, Swap as a pair of bonds (separate leaves)
- Swap pricing at inception (par swap), Swap valuation during life
- Swap counterparty risk and clearing

Options:
- Call option, Put option (separate leaves)
- American option, European option, Bermudan option (3 style leaves)
- Moneyness: ITM, ATM, OTM (3 separate leaves)
- Intrinsic value of an option, Time value of an option (separate leaves)
- Payoff diagrams (4 separate leaves): long call, short call,
  long put, short put
- Profit diagrams (with premium netting, separate from payoff diagrams)

Option price relationships:
- Put-call parity, Put-call-forward parity (separate leaves)
- Lower bound on European call, Upper bound on European call,
  Lower bound on European put, Upper bound on European put
  (4 separate bound leaves)
- Effects of inputs on call/put price (S, X, T, r, sigma, dividends —
  may be 1 grouped leaf or 2-3 leaves)

Option pricing models:
- One-period binomial pricing model
- Multi-period binomial pricing model
- Risk-neutral probability
- Black-Scholes-Merton inputs (overview, no derivation): S, X, T, r,
  sigma, dividends
- BSM assumptions
- Greeks at L1 overview (5 separate leaves): Delta, Gamma, Vega,
  Theta, Rho

Option strategies:
- Protective put, Covered call, Collar (3 separate leaves)
- Long straddle, Long strangle, Short straddle, Short strangle
  (4 separate leaves)
- Bull call spread, Bear put spread, Butterfly spread (3 separate leaves)

Credit derivatives:
- Credit Default Swap (CDS) mechanics
- Single-name CDS, Index CDS (separate leaves)
- CDS payoff and settlement

Arbitrage relationships:
- Cash-and-carry arbitrage, Reverse cash-and-carry arbitrage
- Implied repo rate

**Cross-topic prerequisites:**
- Forward pricing depends on spot rates and TVM (FI, QM)
- BSM inputs include sigma — variance from descriptive statistics (QM)
- Hedging uses duration (FI)

**Difficulty calibration:** most leaves 2-3. Swap valuation between
dates 4. Option strategies (multi-leg) 3. Binomial pricing 3.
Greeks interpretation 3.
