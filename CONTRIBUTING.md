# Contributing to PMC Knowledge

Welcome. This document tells you exactly how to add or improve content. The
platform exists to make PMC analysis sharper — your contribution serves that
mission.

---

## The four content categories

The library is organised around the four kinds of work the club actually
produces:

| Category | Lives at | Format |
|---|---|---|
| Stock pitches | `/content/pitches/<semester>/<ticker>/index.mdx` | Deck walkthrough with annotated slides |
| Learning sessions | `/content/sessions/<slug>.mdx` | Long-form lesson |
| Macro outlooks | `/content/macro/<slug>.mdx` | Periodic macro reading |
| Quant presentations | `/content/quant/<slug>.mdx` | Quantitative work |

Plus the **glossary** at `/content/glossary/terms.json` — shared vocabulary
referenced from every category.

**Tags** are the subject taxonomy that cuts across categories: `valuation`,
`dcf`, `m-and-a`, `factor-models`, `rates`, etc. Use kebab-case; keep tags
short and reusable.

---

## The workflow

1. **Fork** the repository on GitHub.
2. **Branch** off `main` with a descriptive name, e.g.
   `session/wacc-deep-dive` or `pitch/2026-spring-itri`.
3. **Write** your MDX or JSON.
4. **Run** `pnpm dev` and verify your content renders correctly.
5. **Open a PR** against `main` with a clear title and a short description.
6. **Two senior members review.** Once both approve, the PR is merged and
   the change is live within minutes.

---

## What gets reviewed

Reviewers check four things, in order:

1. **Accuracy.** Numbers tie out, formulas are right, sources are cited where
   it matters.
2. **Clarity.** Short sentences. No jargon without a definition. Concepts
   introduced before they're used.
3. **Correct component use.** The right MDX component for the job.
4. **Consistency.** Tone and style match the existing library.

---

## Frontmatter by category

### Learning session — `/content/sessions/<slug>.mdx`

```yaml
---
title: "WACC: Building It and Defending It"
slug: "wacc-deep-dive"             # optional, derived from filename if absent
author: "Your Name"
team: "Investment Team 1"          # optional
date: "2026-04-28"                 # ISO date
difficulty: "beginner" | "intermediate" | "advanced"
estimatedReadTime: 12              # minutes, integer
tags: ["valuation", "dcf", "cost-of-capital"]
summary: "How to build a defensible WACC and answer the questions seniors will throw at you."
featured: false                    # optional, surfaces on the home page
---
```

### Quant presentation — `/content/quant/<slug>.mdx`

Same shape as a session. Use quant-leaning tags:

```yaml
---
title: "Cross-Sectional Momentum Backtest"
author: "Your Name"
date: "2026-04-28"
difficulty: "intermediate"
estimatedReadTime: 14
tags: ["factor-models", "momentum", "backtesting"]
summary: "Replicating the textbook 12-1 month momentum factor on US large-caps."
---
```

### Macro outlook — `/content/macro/<slug>.mdx`

```yaml
---
title: "Q2 2026 Macro Outlook"
slug: "q2-2026-outlook"
author: "Your Name"
team: "Macro Team"
date: "2026-04-15"
period: "Q2 2026"                  # the reporting period
region: "Global"                   # optional: Global, US, Europe, etc.
tags: ["rates", "growth", "liquidity"]
summary: "Sticky services inflation pushes rate cuts further out; positioning shifts toward duration and quality."
---
```

### Stock pitch — `/content/pitches/<semester>/<ticker>/index.mdx`

```yaml
---
title: "Itron, Inc. (ITRI)"
ticker: "ITRI"
semester: "Spring 2026"
team: "Investment Team 1"
date: "2026-04-27"                 # ISO date
recommendation: "BUY" | "HOLD" | "SELL"
sector: "Technology"
analysts:
  - "Alexandre Amaro"
  - "Leonor Maia Monteiro"
sourcePdfUrl: "/pitches/2026-spring/itri-itron.pdf"  # optional
keyTakeaways:
  - "Switching-cost moat in regulated utility infrastructure"
  - "AMI 2.0 replacement cycle as a non-discretionary catalyst"
  - "Hidden software business priced as hardware"
tags: ["industrials", "utilities", "iot"]
---
```

Slide images go in `/public/pitches/<semester>/<ticker>/`. Filename
convention: `slide-<topic>.png` or `.svg`. Aspect ratio 16:9
(1600×900 recommended). Keep file size under 500 KB per image.

### Glossary term — `/content/glossary/terms.json`

```json
{
  "term": "WACC",
  "fullName": "Weighted Average Cost of Capital",
  "definition": "...",
  "category": "valuation",
  "relatedItems": ["wacc-deep-dive", "dcf-fundamentals"]
}
```

Keep `definition` to two sentences. The glossary is a quick lookup, not a
mini-encyclopedia. `relatedItems` is a list of slugs from any category
(session, macro, quant) where the concept is explored further.

---

## Naming and slugs

- Filenames are kebab-case; the slug is derived from the filename if not
  specified in frontmatter.
- The build will fail if the frontmatter is invalid. That's a feature.
- Tags are kebab-case (`m-and-a`, `factor-models`, not `M&A` or
  `factorModels`).

---

## MDX components reference

These are available inside any module, pitch, macro, or quant MDX file. No
imports needed.

### `<Callout>`

A pulled-out box for an insight, warning, question, or definition.

```mdx
<Callout type="insight" title="Optional override">
The whole point of a DCF is to be wrong on purpose, not accidentally.
</Callout>
```

| `type` | When to use |
|---|---|
| `insight` | A key takeaway worth highlighting |
| `warning` | A common mistake or trap |
| `question` | An "ask yourself" prompt for the reader |
| `definition` | An inline definition |

### `<SelfCheck>`

A collapsible self-test. Question shown, answer hidden until clicked.

```mdx
<SelfCheck question="Why do we use unlevered FCF rather than levered FCF?">
Because unlevered FCF is independent of capital structure...
</SelfCheck>
```

### `<DeepDive>`

A collapsible "for the curious" section.

```mdx
<DeepDive title="Why 10-year Treasury, not 30-year?">
The conventional answer is duration matching...
</DeepDive>
```

### `<KeyTerm>`

Inline link to a glossary entry. Hover shows the short definition; click
goes to the glossary.

```mdx
The cost of equity comes from <KeyTerm slug="CAPM">CAPM</KeyTerm>.
```

The `slug` prop matches the `term` field in `terms.json` (case-insensitive).

### `<FormulaBlock>`

LaTeX-rendered formula via KaTeX.

```mdx
<FormulaBlock
  formula="WACC = \frac{E}{V} \cdot r_e + \frac{D}{V} \cdot r_d \cdot (1 - t)"
  caption="Weighted Average Cost of Capital."
/>
```

### `<PitchSlide>`

A slide image with positioned hotspots. Used inside pitch teaching pages.

```mdx
<PitchSlide
  src="/pitches/2026-spring/itri-itron/slide-thesis.svg"
  alt="Investment thesis slide"
  caption="Slide 4 — Investment thesis."
  annotations={[
    {
      x: 12,                    // % from left
      y: 42,                    // % from top
      label: "Why this works",
      detail: "Switching-cost moats are observable. The team supports..."
    }
  ]}
/>
```

### `<MetricsTable>` — temporarily use markdown tables instead

There is a known issue with `next-mdx-remote@6` where array props (the
`rows` prop here) are silently dropped during MDX compilation. **Until
that is fixed, use a standard GFM markdown table.** They pick up the
platform's prose styling and render with tabular numerics. Use
`|---:|` for right-aligned columns.

```mdx
| Input | Value | Source |
|---|---:|---|
| Risk-free rate | 4.20% | 10-year US Treasury |
| Equity risk premium | 5.50% | Damodaran implied |
| Beta (re-levered) | 1.15 | Peer median, 5y weekly |

<p className="text-xs text-muted-foreground italic mt-[-1rem] mb-8">WACC build for a mid-cap industrial.</p>
```

The italic paragraph pattern after the table mimics the caption style
the `<MetricsTable>` component would have applied.

### `<Pillars>` and `<Pillar>`

A multi-column visual grid for "concept" moments — three or four cards
side by side, each with an eyebrow label, a strong title, and short
prose. Use it when introducing a set of related ideas (LPs/GPs/funds,
deal life cycle stages, valuation drivers, etc.).

```mdx
<Pillars>
  <Pillar eyebrow="Stage 1" title="Deal sourcing">
    Define investment criteria — industry, size, geography — and run
    proprietary networks to surface targets that fit.
  </Pillar>
  <Pillar eyebrow="Stage 2" title="Due diligence" emphasize>
    Commercial, financial, legal, tax. Goal: find reasons not to do the
    deal, not confirm reasons to do it.
  </Pillar>
  <Pillar eyebrow="Stage 3" title="Investment">
    Structure the transaction, arrange debt, execute the SPA, close.
  </Pillar>
</Pillars>
```

`emphasize` adds a steel tint to one card to draw the eye.

### `<Stats>` and `<Stat>`

A horizontal row of large numerical callouts. Use it when 2–4 numbers
deserve to land together — "the headline figures." `<Stat value>` is
the big number, `<Stat label>` is the small uppercase label, `<Stat
caption>` is optional supporting text.

```mdx
<Stats>
  <Stat value="20–30%" label="Target IRR" caption="Healthy buyout deal range" />
  <Stat value="2.0–2.5x" label="Target MOIC" caption="Over a 5-year hold" />
  <Stat value="60–80%" label="Debt at entry" caption="Of total purchase price" />
</Stats>
```

### `<BigStat>`

When ONE number deserves the full visual stage — an emphatic moment
inside the article. Renders centred on a soft secondary background,
with the number sized very large.

```mdx
<BigStat
  value="~75%"
  label="Of VC-backed companies"
  caption="never return cash to investors. Venture economics live or die on the small handful of outliers that 100x."
/>
```

### `<PullQuote>`

A magazine-style emphasised statement — short, punchy, one sentence.
Use sparingly: at most one per major section, and only when the
sentence genuinely deserves it.

```mdx
<PullQuote attribution="The whole pitch in one sentence">
  Take a business someone else built, pay a defensible price, make it
  measurably better in three to seven years, and sell it.
</PullQuote>
```

### `<Divider>`

A horizontal section break with a small steel diamond in the middle.
Stronger visually than `<hr>`, lighter than starting a new H2. Useful
between major content beats.

```mdx
<Divider />
```

### `<ProsCons>` — temporarily use side-by-side `<Callout>`s instead

Same MDX array-prop issue as `<MetricsTable>`. Use two Callouts in a
two-column grid:

```mdx
<div className="not-prose grid gap-4 md:grid-cols-2 my-8">

<Callout type="insight" title="Catalysts">
- Switching-cost moat in regulated infrastructure
- Non-discretionary capex cycle
</Callout>

<Callout type="warning" title="Risks">
- Software margin sensitive to allocation policy
- Customer concentration in top three utilities
</Callout>

</div>
```

The `not-prose` class is important — it stops the prose styles from
re-applying inside the grid wrapper.

---

## Style notes

- **Tone**: professional, confident, never breezy. Members wear suits to
  pitches; the writing should match.
- **Numbers**: always specify units and basis points where relevant.
- **Names**: spell out full company names on first use, ticker thereafter.
- **Citations**: link to primary sources where you can. Damodaran's data
  pages, FERC filings, company 10-Ks.
- **Sentence length**: short. If a sentence runs more than 25 words, ask
  whether it should be two.

---

## A final word

The bar is high because the audience is serious. Every contribution makes
the next pitch a little sharper, and the next member a little more
prepared. Thank you for adding to it.
