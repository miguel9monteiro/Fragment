# Contributing to PMC Knowledge

Welcome. This document tells you exactly how to add or improve content. The
platform exists to make PMC analysis sharper — your contribution serves that
mission.

---

## The workflow

1. **Fork** the repository on GitHub.
2. **Branch** off `main` with a descriptive name, e.g.
   `module/wacc-deep-dive` or `pitch/2026-spring-itri`.
3. **Write** your MDX or JSON.
4. **Run** `pnpm dev` and verify your content renders correctly.
5. **Open a PR** against `main` with a clear title and a short description.
6. **Two senior members review.** Once both approve, the PR is merged and
   the change is live within minutes.

---

## What gets reviewed

Reviewers check four things, in order:

1. **Accuracy of finance content.** Numbers tie out, formulas are right,
   sources are cited where it matters.
2. **Clarity of writing.** Short sentences. No jargon without a definition.
   Concepts introduced before they're used.
3. **Correct use of MDX components.** The right component for the job.
4. **Consistency.** Tone and style match the existing library.

---

## Adding a learning module

### 1. Pick a category

Modules live under `content/modules/<category>/`. Choose from:

- `valuation`
- `accounting`
- `credit`
- `industry`
- `ma-corporate-actions`
- `portfolio-risk`
- `macro-markets`
- `q-and-a-prep`

If you think a module needs a new category, open an issue first — adding a
category requires a code change.

### 2. Create the file

Filename = slug. Use kebab-case. For example:

```
content/modules/valuation/wacc-deep-dive.mdx
```

### 3. Write the frontmatter

```yaml
---
title: "WACC: Building It and Defending It"
slug: "wacc-deep-dive"             # optional, derived from filename if absent
category: "valuation"              # must match the parent folder
author: "Your Name"
team: "Investment Team 1"          # optional
difficulty: "beginner" | "intermediate" | "advanced"
estimatedReadTime: 12              # in minutes, integer
prerequisites: ["dcf-fundamentals"] # slugs of prerequisite modules
lastUpdated: "2026-04-28"          # ISO date
tags: ["valuation", "dcf", "cost-of-capital"]
summary: "How to build a defensible WACC and answer the questions seniors will throw at you."
featured: false                    # optional, surfaces on the home page
---
```

The build will fail if the frontmatter is invalid. That's a feature.

### 4. Write the body

Modules read like research notes. Short paragraphs, clear sub-sections,
lots of breathing room. Use `## H2` for major sections and `### H3` for
sub-sections. The H2/H3 structure auto-populates the table of contents on
the right rail.

---

## Adding a pitch teaching page

### 1. Create the folder

```
content/pitches/<semester>/<ticker>/
```

For example: `content/pitches/2026-spring/itri-itron/`.

`<semester>` is kebab-case (`2026-spring`, `2026-fall`).

### 2. Add the index file

`index.mdx` in that folder, with frontmatter:

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
---
```

### 3. Add slide images

Put slide images in `public/pitches/<semester>/<ticker>/`. Filename
convention: `slide-<topic>.png` or `.svg`.

| Format | Use when |
|---|---|
| PNG | Photographs or screenshots from the original deck |
| SVG | Charts, diagrams, anything vector |

Aspect ratio: 16:9 (1600×900 recommended). Keep file size under 500 KB
per image.

### 4. Write the teaching annotation

This is **not** a reproduction of the deck. It is a teaching walkthrough.
Use `<PitchSlide>` to embed slides with annotations, and write commentary
explaining what worked, what didn't, and what a senior would ask.

---

## Adding a glossary term

Open `content/glossary/terms.json` and add an entry:

```json
{
  "term": "WACC",
  "fullName": "Weighted Average Cost of Capital",
  "definition": "...",
  "category": "valuation",
  "relatedModules": ["wacc-deep-dive", "dcf-fundamentals"]
}
```

Keep `definition` to two sentences. The glossary is a quick lookup, not a
mini-encyclopedia. Link to modules where the concept is explored further.

---

## MDX components reference

These are available inside any module or pitch MDX file. No imports needed.

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
Because unlevered FCF is independent of capital structure. We discount it
at WACC to get enterprise value, then subtract net debt to get equity
value. This separates the operating thesis from the financing thesis.
</SelfCheck>
```

### `<DeepDive>`

A collapsible "for the curious" section.

```mdx
<DeepDive title="Why 10-year Treasury, not 30-year?">
The conventional answer is duration matching. The fuller answer is...
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

You can also place TeX as children:

```mdx
<FormulaBlock caption="Hamada equation.">
  \beta_u = \frac{\beta_l}{1 + (1 - t) \cdot D/E}
</FormulaBlock>
```

### `<PitchSlide>`

A slide image with positioned hotspots. The core teaching component for
the pitch archive.

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

`x` and `y` are percentages of the image dimensions (0–100). Hover or tap
the numbered marker to reveal the detail.

### `<MetricsTable>`

A finance-styled table — right-aligned numbers, monospace tabular figures,
optional row highlighting.

```mdx
<MetricsTable
  caption="WACC build for a mid-cap industrial."
  headers={["Input", "Value", "Source"]}
  highlightRow={2}              // optional, 0-based
  align={["left", "right", "left"]}  // optional per-column
  rows={[
    ["Risk-free rate", "4.20%", "10-year US Treasury"],
    ["Equity risk premium", "5.50%", "Damodaran implied"],
    ["Beta (re-levered)", "1.15", "Peer median, 5y weekly"]
  ]}
/>
```

### `<ProsCons>`

Side-by-side catalysts/risks layout.

```mdx
<ProsCons
  prosLabel="Catalysts"
  consLabel="Risks"
  pros={[
    "Switching-cost moat in regulated infrastructure",
    "Non-discretionary capex cycle"
  ]}
  cons={[
    "Software margin sensitive to allocation policy",
    "Customer concentration in top three utilities"
  ]}
/>
```

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
