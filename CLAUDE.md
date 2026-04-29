# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**Fragment** is an **internal knowledge tool** for the Portfolio Management Club at Nova School of Business & Economics (Nova SBE). It exists to consolidate the club's institutional knowledge — pitches, learning sessions, macro outlooks, quant presentations, glossary — into one searchable, well-presented surface that helps members produce **sharper research and sharper reports**. Plus a glossary.

Repository: <https://github.com/miguel9monteiro/Fragment>. Deployed on Vercel.

### Fragment vs pmcnovasbe.com — keep these straight

PMC has two web surfaces, and they have different jobs:

| | **Fragment (this repo)** | **pmcnovasbe.com** |
|---|---|---|
| Purpose | Internal knowledge tool for members | External marketing site for the club |
| Audience | Current and incoming PMC members | Recruiters, prospective members, sponsors, public |
| Goal | Sharper research, sharper reports | Brand presence, recruitment, partnerships |
| Tone | In-house, dense, technical, member-to-member | Polished, externally-facing, narrative |
| What lives here | Pitches, sessions, macro, quant, glossary | About-us, alumni list, FMC conference, recruitment, contact form |

The repository is public (it's on GitHub and Vercel free tier with no auth — see Tier 1 below) but **the writing audience is internal**. Don't draft content as if a recruiter or an outside reader is the primary reader: address members directly, assume the institutional context, use the in-house terminology, prioritise technical density over rhetorical polish. Marketing-style copy ("join us," "discover our work," external CTAs to apply / contact / follow) belongs on pmcnovasbe.com, not here.

When in doubt about whether a page or feature belongs on Fragment: ask "does this make a member's next pitch better?" If yes, it belongs. If it's about how the club presents itself to outsiders, it goes on pmcnovasbe.com.

## About the Portfolio Management Club

This section is grounding context for any content you write or layout you design. Information current as of Spring 2026; rosters change each semester, so verify before naming individuals.

### Identity

- **Full name**: Portfolio Management Club, abbreviated **PMC**.
- **Affiliation**: Nova School of Business & Economics (Nova SBE), Carcavelos, Portugal. Address: R. da Holanda 1, 2775-405 Carcavelos.
- **Founded**: 2016. Roughly a decade of operating history.
- **Public identity (verbatim)**: *"Nova SBE's Asset Management Club with specialised divisions in investments, macroeconomic analysis and quantitative research."*
- **Mission (verbatim)**: *"To fast-track PMC members to the job market by providing a transversal, hands-on portfolio management experience."*
- **The four pillars the club operates by**:
  1. **Member experience** — "to learn a ton, and have as much fun"
  2. **Operational excellence** — "deliver high quality work, every time"
  3. **Over-performance** — "beat the market"
  4. **Brand value** — talent, knowledge, professionalism
- **Channels**: pmcnovasbe.com (public site), LinkedIn (Portfolio Management Club), Instagram (@pmcnovasbe), GitHub (Nova-SBE-Portfolio-Management-Club).

### Organisational structure

PMC has roughly 80+ active members across two divisions plus a Presidency.

**Asset Management** — where the investment work happens:

- **Portfolio Managers** (currently 3) — own portfolio-level decisions; senior investment role.
- **Investment Teams 1–4**, each with a Team Head plus 5–6 analysts. Most stock pitches come from a specific Investment Team and are bylined "Investment Team N" plus the analyst names.
- **Macro Department** — Head plus ~8 analysts. Produces macro overviews and macro-driven pitches (sovereigns, FX, rates).
- **Quant Department** — Head plus ~4 analysts. Produces factor models, backtesting, and tools (e.g. the Credit Scoring Model referenced in the Bonds session).

**Operations** — the support spine:

- **External Affairs** — partnerships, sponsorships, alumni relations.
- **Marketing & Events** — including the Financial Markets Compass conference.
- **IT & Human Resources** — including the team that maintains *this* platform.

**Presidency** sits above both: a **President**, a **VP of Asset Management**, and a **VP of Operations**. Rotates annually. Treat any individual names as Spring-2026-current; verify before referencing in evergreen content.

### The portfolio

PMC manages a **virtual portfolio** — not real money, but treated with full institutional discipline. The "real-portfolio identity" the club aspires to is the same as the virtual one. Specs:

- **Inception**: 1 October 2020.
- **Initial value**: USD 1,000,000.
- **Denomination**: dollar.
- **Asset classes**: equities, fixed income, commodities, FX. **No crypto, no derivatives.**
- **Style**: value investing, fundamentals-based, long-only, momentum-aware, multi-strategy, long-term-driven, global scope.
- **Benchmark**: 60% SPY / 40% IEI (S&P 500 ETF + iShares 3–7 Year Treasury Bond ETF).
- **Operational constraints**: no OTC instruments accepted (T-bills excepted); technical analysis is viewed with skepticism — claims should be backtested.

When writing about the portfolio, treat the virtual nature factually but not as a caveat. Members operate with institutional discipline.

### What the club produces

Five recurring artefacts plus one annual event:

1. **Stock pitches** — equity research reports produced by Investment Teams. Each pitch carries: ticker, semester (e.g. "Spring 2026"), team byline, named analysts, recommendation (BUY/HOLD/SELL), sector, key takeaways. The platform's `/pitches` route is purpose-built for this format.
2. **Learning sessions** — internal teaching, ~30–60 minutes each, on topics from technical (DCF, LBO, credit scoring) to soft (slide-making, presentation craft). Often authored by the Presidency, Portfolio Managers, or department heads. Platform's `/sessions` route.
3. **Macro overviews** — periodic readings of the macro environment by the Macro Department. Platform's `/macro` route.
4. **Quant presentations** — the Quant Department's research output. Platform's `/quant` route.
5. **Semester newsletters** — curated digest of important economic events for the period. The 2025 Annual Newsletter is a recent example. Not yet a content category on this platform.

**Financial Markets Compass** is the club's annual flagship conference, hosted at the Grand Auditorium Jerónimo Martins on Nova SBE's Carcavelos campus. Industry panel format covering financial literacy, AI in investing, private equity, and global markets. 13:00–19:30 with networking dinner. Sponsored by BPI, Euronext, CFA Society Portugal among others.

### Naming and bylining conventions

- **Stock pitch**: byline is "Investment Team N" plus named analysts. Title is the ticker plus company name (e.g. "Itron, Inc. (ITRI)"). Filename slug uses ticker plus a hyphenated company name.
- **Learning session**: bylined by the author(s) — often Presidency or department heads.
- **Macro outlook**: bylined "Macro Department" or named analysts within it.
- **Quant presentation**: bylined "Quant Department" or named analysts.
- **Semester format**: Fall and Spring. The site uses both long-form ("Spring 2026", "Fall 2025") and short-form ("S1 2025" = first semester / spring, "S2 2025" = second / fall). Long-form is preferred in the platform's frontmatter.

### Partner / source ecosystem

The credibility ecosystem the club routinely cites and partners with:

- **Nova SBE** — parent business school, consistently top-ranked in Portugal.
- **Bloomberg** — terminal access; Bloomberg data shows up extensively in pitches (LQA Liquidity Score, etc.).
- **CFA Society Portugal** — professional society partnership; CFA-related events.
- **BNP Paribas**, **BPI Asset Management** — finance industry sponsors.
- **Euronext** — sponsor of the Financial Markets Compass.

When a pitch references a data source, it is most often Bloomberg, Refinitiv, PitchBook, or 10-K filings. These are the conventional citations.

### Voice the platform must match

PMC is the top finance student society at Nova SBE, the leading business school in Portugal. Members wear suits to pitches. The writing should match:

- Confident, professional, never breezy.
- Numbers to one decimal place by default; basis points where rate-relevant; specify currency on every figure.
- Companies named in full on first use, ticker thereafter.
- Sources cited inline or in footnotes — pitches without citations get rejected at review.
- Sentences short. Paragraphs short. White space is structure.
- Quote primary sources (10-Ks, regulatory filings, central-bank statements) over commentary.

The pitch deck is the artefact a senior reviewer judges the work by. The platform's content should match the production value of the deck the article came from. This is the standard set out in detail in *Quality bar for long-form content* below.

## Scope is binding (Tier 1)

Hard constraints — push back if asked to violate any:

- **No backend, no database, no auth, no user accounts.**
- **No AI features.** No model calls, no chatbots, no embeddings. Search is in-memory client-side.
- **No CMS / admin UI.** Content lands via PR.
- **All routes must be statically generable.** No serverless functions at runtime. Vercel free tier is the deploy target.
- **No analytics yet.** A clean integration point exists in `app/layout.tsx` but is not wired up.

If a request implies any of the above, surface the constraint before implementing.

## Quality bar for long-form content

**This is the most important section in this file when you are writing or revising an article (sessions, macro outlooks, quant presentations, pitch teaching pages).**

The Portfolio Management Club is the top finance student society at Nova SBE — the leading business school in Portugal — and the audience expects work that reflects that. Members produce decks with strong visual identity: navy section dividers, light-blue stat callouts, Pillars-style concept grids, big numbers, deliberate rhythm. **Every article on this platform must transport the same visual identity into the reading layout.** A wall of plain prose with one or two bullet lists is below the bar, even if the writing is good. The standard is: a member should feel the article matches the production value of the deck it came from.

### What this means concretely

When you write or revise a long-form piece, you must use the visual MDX components throughout — not as decoration, but as the primary way of communicating structured information. Specifically:

- **Sets of related concepts** (LPs / GPs / Fund; the four fund types; the five deal stages; the three pillars of a thesis) belong in `<Pillars>`, not in paragraph prose.
- **Headline numbers** (target IRR, target MOIC, market shares, growth rates, key valuation multiples) belong in `<Stats>` rows or `<BigStat>` blocks. Identify the 3–6 numbers in the source material that most deserve to land visually and surface them.
- **One or two emphatic statements per article** belong in `<PullQuote>`. Used sparingly — never more than 2 in a piece.
- **Major content beats** should be separated by `<Divider>` to give the reader breathing room.
- **Tables** are GFM markdown with `|---:|` for right-aligned numerics. They get full institutional styling automatically via `prose-pmc`. Use them whenever data is structured.
- **Comprehension checks** belong in `<SelfCheck>`, not as inline parenthetical asides.
- **Tangential depth** belongs in `<DeepDive>`, not in extra paragraphs.
- **Defined terms** that exist in the glossary should be wrapped in `<KeyTerm slug="...">` on first material use.

### Self-test before shipping

Before considering a long-form article done, audit it against this checklist:

1. **Drop cap fires on the opening paragraph?** (Automatic via CSS, but check the lead paragraph reads well with the large first letter.)
2. **At least one `<Pillars>` block?** Most pieces have 2–3.
3. **At least one `<Stats>` row or `<BigStat>` for headline numbers?**
4. **At least one `<PullQuote>` at a moment that genuinely deserves the emphasis?**
5. **`<Divider>` between major content beats** — not after every H2, but at the natural rhythm points.
6. **Tables styled and right-aligned where numerics demand it?**
7. **`<SelfCheck>` blocks at points where comprehension matters?**
8. **`<KeyTerm>` links on the first material use of glossary-defined terms?**
9. **Opening lead paragraph reads like a magazine intro, not a brief?**
10. **No three consecutive paragraphs without a visual element breaking them up.**

If the answer to four or more of these is "no," the piece is below the bar. Revise.

### The failure mode to avoid

The instinct, when adapting a deck or a transcript, is to flatten the source into paragraphs. Resist that. The deck had visual rhythm for a reason — the same rhythm needs to live in the article. **Plain prose with a few markdown headers is not acceptable output**, regardless of how good the writing is. The visual components exist to be used, and a session without them looks unfinished — like a draft someone forgot to format.

Inspiration to match in vibe: Stripe's blog, Linear's changelog, the Substack longform aesthetic, McKinsey Quarterly's article layout. Bloomberg/Goldman research-note restraint for the typography; magazine-style visual breaks for the rhythm.

## Commands

```bash
pnpm install        # first time only; needs corepack-enabled pnpm
pnpm dev            # local dev server with hot reload
pnpm build          # full static build; fails on bad MDX frontmatter
pnpm typecheck      # tsc --noEmit
pnpm lint           # next lint
```

If `pnpm build` reports `PageNotFoundError` on routes that exist on disk, the `.next` cache is stale — `rm -rf .next && pnpm build`. This usually happens after a route is renamed or deleted.

There are no tests yet. If asked to add tests, first ask whether unit tests, integration tests, or visual tests are wanted — there's no existing harness to extend.

## Architecture

### Content pipeline (the core abstraction)

All published material lives under `/content/`. There are two flavours:

**MDX kinds** — long-form, edited as `.mdx` with Zod-validated frontmatter:

```
content/
  pitches/<semester>/<ticker>/index.mdx     ← stock pitches (deck walkthrough)
  sessions/<slug>.mdx                        ← learning sessions
  macro/<slug>.mdx                           ← macro outlooks
  quant/<slug>.mdx                           ← quant presentations
```

**Data feeds** — JSON regenerated from source data, edited only via PR or extraction script:

```
content/
  glossary/terms.json                        ← shared vocabulary
  polls/polls.json                           ← voting record (powers /votings)
  portfolio/portfolio.json                   ← virtual portfolio (powers /portfolio)
```

Both flavours validate against Zod schemas in `lib/types.ts` at build time. A malformed schema fails the build — this is intentional, do not soften it. Loaders in `lib/content.ts` walk the directories on every build and return cached, sorted entries. `readDirSafe` returns `[]` for missing directories, so it's fine for some MDX kinds to be empty (currently `pitches/`, `macro/`, `quant/` have no entries; the index pages render an empty state). `content/modules/` is empty legacy and can be removed.

Subjects (M&A, valuation, factor models, rates, …) are **free-form tags**, not enums. Every MDX category supports tags; tags drive the filterable indexes.

### Why pitches are separate from sessions/macro/quant

Sessions, macro outlooks, and quant presentations are all long-form MDX. They share schemas and renderers — a `LibraryEntry` discriminated union with `kind: "session" | "macro" | "quant"`. Three thin route shells under `app/{sessions,macro,quant}/` delegate to:

- `components/LibraryIndex.tsx` — filterable index (search, tag chips, difficulty chips, grid/list views, URL state)
- `components/LibraryItemPage.tsx` — detail renderer with sticky TOC, reading progress, tags rail, prev/next nav
- `components/LibraryItemCard.tsx` — card used on indexes and the home page

**Pitches do not use the library renderer.** They have a fundamentally different format (institutional research-note hero with ticker, recommendation badge, key takeaways; the body is a teaching walkthrough of annotated slides via `<PitchSlide>`). Don't try to fold them into `LibraryItemPage`.

When adding a new content kind, the pattern is: schema in `lib/types.ts` → loader in `lib/content.ts` → route shell that calls the shared `LibraryIndex` and `LibraryItemPage`. No new components needed unless the format genuinely differs.

### Voting record (`/votings`) and Portfolio (`/portfolio`)

These are **data-feed pages**, not MDX. They bypass the library renderer entirely and read JSON directly:

- **/votings** reads `content/polls/polls.json` (currently 29 polls). Schema is `pollSchema` in `lib/types.ts`. Each poll stores raw vote counts in `options[]`; `options[i].kind` (`buy`/`sell`/`hold`/`increase`/`abstain`) drives the bar colour via `components/VoteBar.tsx`. **Outcome is derived, not stored** — `deriveOutcome()` in `app/votings/VotingsClient.tsx` computes winner / win share / conviction / `motionApproved` at render time. Don't add derived fields to the schema. Polls are filterable by semester / asset class / forum with URL state; the page defaults to the current semester. Polls can carry `pitchSlug` to link back to the corresponding pitch teaching page.
- **/portfolio** reads `content/portfolio/portfolio.json` and renders six sections in `app/portfolio/page.tsx`: hero, KPI band, chart, risk metrics, allocation bar, sector exposure, holdings table. The chart (`components/PortfolioChart.tsx`) is a **hand-rolled SVG** client component with a 1M/6M/YTD/1Y/SI toggle that rebases cumulative returns to 0% per window. Holdings carry optional `pitchSlug` and `pollSlug` so positions can deep-link back to the pitch and the vote that authorised them.

The visual quality bar applies to these pages too. KPI bands, allocation bars, sector bars, sortable tables with totals — same standard as long-form articles. A data page that's just a `<table>` is below the bar.

### Charts and visualisations

No chart library — no `recharts`, no `chart.js`, no `d3`. Visualisations are hand-rolled SVG (see `PortfolioChart.tsx` for the canonical pattern: pure SVG paths, manual scales, `tnum` axis labels). The dependency footprint stays minimal and the visuals match the typography exactly. If a visualisation genuinely warrants a library, surface the trade-off before pulling one in.

### MDX rendering

`next-mdx-remote/rsc` v6 compiles MDX server-side. Plugins are configured in `lib/mdx.ts` (`remarkGfm`, `remarkMath`, `rehypeKatex`, `rehypeSlug`).

Custom components are injected via `components/mdx/index.tsx`'s `mdxComponents` map, passed to `MDXRemote`'s `components` prop. Authors use them in MDX without imports:

`<Callout>` (4 types), `<SelfCheck>`, `<DeepDive>`, `<KeyTerm>` (looks up the glossary at render time), `<FormulaBlock>` (KaTeX), `<PitchSlide>` (annotated hotspots — pitches only), `<MetricsTable>`, `<ProsCons>`, `<Pillars>` / `<Pillar>` (concept grid), `<Stats>` / `<Stat>` / `<BigStat>` (numerical callouts), `<PullQuote>`, `<Divider>` (visual section break).

**Known limitation in `next-mdx-remote@6` (post-CVE fix):** array literals passed as JSX attribute values are silently dropped — they arrive at the component as `undefined`. This breaks any component that takes array props from MDX content: currently `MetricsTable.rows`, `ProsCons.pros/cons`, and `PitchSlide.annotations`. Workarounds when authoring:

- For tables: use a GFM markdown table (`| col | col |` with `|---:|` for right-alignment) — they pick up the prose styles and look fine.
- For pros/cons layouts: use two side-by-side `<Callout>`s inside a `<div className="not-prose grid gap-4 md:grid-cols-2 my-8">` wrapper.
- The components themselves still work when invoked from React (e.g. on index pages) — only the MDX path is broken.

A proper fix is to refactor these components to accept children rather than array props, but that's a follow-up. Don't try to "fix" the MDX expression syntax; the issue is in the v6 sanitization layer, not the source.

The TOC is extracted by **regex** from raw MDX source (see `lib/mdx.ts::extractToc`) — not from the rendered HTML — because it runs on the server and the rendered tree isn't available at that point. It strips code fences before scanning.

### Search

`lib/search.ts` is a 30-line token-prefix matcher (no fuse.js dependency). The `SearchableItem` union covers all four content kinds plus glossary terms.

The **`Header` is a server component** (`components/Header.tsx`) that loads all library entries, pitches, and glossary terms at build time, maps them into `SearchableItem`s, and passes the array to the `<SearchCommand>` client component. `⌘K` opens it. This means search is fully static — the client gets a JSON blob in the page, not a live API.

### Design system (locked)

The visual system mirrors the PMC pitch decks:

- **One typeface only**: Source Sans 3 (Adobe's current name for Source Sans Pro). `font-sans`, `font-serif`, and `font-mono` all alias to it in `tailwind.config.ts`. Hierarchy is weight, not family.
- **Palette**: navy primary `~#1A2C4D`, steel accent `~#5A7FA3` (replaces the old gold), success `~#33B055`, destructive `~#D14545`. CSS variables in HSL in `styles/globals.css`.
- **Tabular numerics**: any element with class `tnum` or any `<th>`/`<td>` gets `font-feature-settings: "tnum"`.
- **Radii are tight**: 2–4px (lg=4px in Tailwind config). Don't use rounded-full or rounded-lg outside icon containers.

Exceptions:
- KaTeX keeps its math fonts. Math notation is not a display-font choice.
- Icons are from `lucide-react`.

### Routing notes (Next 15 specifics)

- `params` and `searchParams` are Promises in route handlers — `await params` before use.
- `outputFileTracingRoot` is pinned in `next.config.mjs` because the parent directory contains a stray `pnpm-lock.yaml` Next would otherwise pick up.
- All dynamic routes (`/sessions/[slug]`, `/macro/[slug]`, `/quant/[slug]`, `/pitches/[slug]`) implement `generateStaticParams` so the build is fully prerendered.
- Static routes shipping today: `/`, `/pitches`, `/votings`, `/portfolio`, `/sessions`, `/macro`, `/quant`, `/glossary`, `/contribute`. Header `navItems`, footer Library column, and `app/sitemap.ts` are the three places to update when adding a top-level route.

### Glossary integration

`<KeyTerm slug="WACC">WACC</KeyTerm>` is a server component that calls `getGlossaryTerm(slug)` at render time. If the slug doesn't resolve, it falls back to a plain link to `/glossary#<slug>`. Slug matching is case-insensitive and ignores spaces.

## Style notes for contributions

- The platform's audience is finance students at a top European business school. Tone is professional and confident — never breezy, never marketing-y. Members wear suits to pitches; the writing matches.
- Don't add backwards-compat shims, deprecation comments, or feature flags. The codebase is young; refactor cleanly.
- Don't pre-empt features. If asked to "remove sample content," remove it; don't replace it with new placeholders.
- Don't switch package managers. pnpm via corepack is the standard.

## Things that have been tried and rejected

Save the next session a redo:

- **WebGL / fragment-shader hero backdrop**: built once, rejected outright ("its terrible, go back to the previous state"). The home hero now uses CSS gradient orbs with a grid overlay and slow drift via `components/HeroBackdrop.tsx`. Don't reach for shaders again unless the user explicitly asks for it.
- **Chart libraries** (recharts, chart.js, d3): not used. SVG is hand-rolled — see `PortfolioChart.tsx`.
- **Auto-sync from xlsx**: the user picked the manual extraction workflow over a sync script. The xlsx is gitignored; only the derived JSON is committed. Don't propose a watcher / cron / scheduled extractor.
- **Array-prop MDX components** (`MetricsTable.rows`, `ProsCons.pros/cons`, `PitchSlide.annotations`): broken in `next-mdx-remote@6` since the CVE fix. Use the documented workarounds (GFM tables, side-by-side `<Callout>`s). Don't try to "fix" the MDX expression syntax — the issue is in v6's sanitisation layer.

## When fixing or extending

- **Frontmatter changes**: update the Zod schema in `lib/types.ts` first, then the loader, then any UI that reads the field. The schema is the single source of truth.
- **New content kind**: model after sessions/macro/quant. Add to `LIBRARY_KINDS` in types if it should share the library renderer; otherwise build a parallel shell like pitches.
- **New MDX component**: add the file to `components/mdx/`, register it in `components/mdx/index.tsx`, document it in `CONTRIBUTING.md` and the contribute page (`app/contribute/page.tsx::COMPONENTS`).
- **Stale `.next` after route changes**: clear it. Cached route types reference deleted files and cause confusing typecheck errors.

### Refreshing the portfolio data

The portfolio is dropped as an xlsx report each cycle. The repo workflow is **manual extraction, not a sync script**:

1. Drop the new `Portfolio Report.xlsx` into `/data/` (gitignored — only the derived JSON is committed).
2. Run a one-shot extraction script (the previous run lived at `/tmp/extract-portfolio.js` — not committed; rewrite it from the workbook each time, or recover from `git log` once a stable version is checked in). It reads two sheets: **Portfolio Overview** (totals, perf metrics, holdings, sector + asset-type breakdowns) and **Portfolio Performance** (daily returns and cumulative series).
3. The script handles: Excel-serial → ISO-date conversion, European decimal-comma cleanup in security names (`"Altria Group, 2,45%, 02/04/2032"` → `"Altria Group, 2.45%, 02/04/2032"`), rounding to 2 dp for currency / 6 dp for ratios.
4. Output is written to `content/portfolio/portfolio.json` and validated by `portfolioSchema` at build time.
5. Holdings' `pitchSlug` and `pollSlug` default to `null` after a fresh extraction. Re-link them by hand (or diff against the previous JSON) — these are the deep-links that make the holdings table cross-reference into `/pitches/<slug>` and `/votings`.

The `portfolioSchema` is permissive on metric values (`number | string | null`) because the source xlsx sometimes carries `"-"` for not-yet-computed cells (e.g. SI skew/kurtosis). Format helpers (`fmtPct`, `fmtNum`) on the page coerce sensibly.

### Refreshing the voting record

`content/polls/polls.json` is hand-edited. After a vote, append a new entry with `slug` (`YYYY-MM-DD-<asset>`), date, semester, subject, `assetClass`, `motionType`, `forum`, optional `motion` and `pitchSlug`, and the raw `options[]` with `count` and `kind`. Don't precompute outcome fields — the page derives them.

## Related docs

- `README.md` — installation and stack overview (note: the README still references the older `/modules` taxonomy in places; update it if you touch it).
- `CONTRIBUTING.md` — full authoring guide with frontmatter examples per category and copy-pasteable component usage.
