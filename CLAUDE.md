# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**Fragment** — a static learning platform for the Portfolio Management Club at Nova School of Business & Economics (Nova SBE). Hosts the four kinds of material the club publishes: stock pitches, learning sessions, macro outlooks, quant presentations. Plus a glossary.

Repository: <https://github.com/miguel9monteiro/Fragment>. Deployed on Vercel.

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

All published material lives under `/content/`:

```
content/
  pitches/<semester>/<ticker>/index.mdx     ← stock pitches (deck walkthrough)
  sessions/<slug>.mdx                        ← learning sessions
  macro/<slug>.mdx                           ← macro outlooks
  quant/<slug>.mdx                           ← quant presentations
  glossary/terms.json                        ← shared vocabulary
```

Frontmatter is validated at build time by **Zod schemas in `lib/types.ts`**. A malformed frontmatter fails the build — this is intentional, do not soften it. Loaders in `lib/content.ts` walk the directories on every build and return cached, sorted entries.

Subjects (M&A, valuation, factor models, rates, …) are **free-form tags**, not enums. Every category supports tags; tags drive the filterable indexes.

### Why pitches are separate from sessions/macro/quant

Sessions, macro outlooks, and quant presentations are all long-form MDX. They share schemas and renderers — a `LibraryEntry` discriminated union with `kind: "session" | "macro" | "quant"`. Three thin route shells under `app/{sessions,macro,quant}/` delegate to:

- `components/LibraryIndex.tsx` — filterable index (search, tag chips, difficulty chips, grid/list views, URL state)
- `components/LibraryItemPage.tsx` — detail renderer with sticky TOC, reading progress, tags rail, prev/next nav
- `components/LibraryItemCard.tsx` — card used on indexes and the home page

**Pitches do not use the library renderer.** They have a fundamentally different format (institutional research-note hero with ticker, recommendation badge, key takeaways; the body is a teaching walkthrough of annotated slides via `<PitchSlide>`). Don't try to fold them into `LibraryItemPage`.

When adding a new content kind, the pattern is: schema in `lib/types.ts` → loader in `lib/content.ts` → route shell that calls the shared `LibraryIndex` and `LibraryItemPage`. No new components needed unless the format genuinely differs.

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

### Glossary integration

`<KeyTerm slug="WACC">WACC</KeyTerm>` is a server component that calls `getGlossaryTerm(slug)` at render time. If the slug doesn't resolve, it falls back to a plain link to `/glossary#<slug>`. Slug matching is case-insensitive and ignores spaces.

## Style notes for contributions

- The platform's audience is finance students at a top European business school. Tone is professional and confident — never breezy, never marketing-y. Members wear suits to pitches; the writing matches.
- Don't add backwards-compat shims, deprecation comments, or feature flags. The codebase is young; refactor cleanly.
- Don't pre-empt features. If asked to "remove sample content," remove it; don't replace it with new placeholders.
- Don't switch package managers. pnpm via corepack is the standard.

## When fixing or extending

- **Frontmatter changes**: update the Zod schema in `lib/types.ts` first, then the loader, then any UI that reads the field. The schema is the single source of truth.
- **New content kind**: model after sessions/macro/quant. Add to `LIBRARY_KINDS` in types if it should share the library renderer; otherwise build a parallel shell like pitches.
- **New MDX component**: add the file to `components/mdx/`, register it in `components/mdx/index.tsx`, document it in `CONTRIBUTING.md` and the contribute page (`app/contribute/page.tsx::COMPONENTS`).
- **Stale `.next` after route changes**: clear it. Cached route types reference deleted files and cause confusing typecheck errors.

## Related docs

- `README.md` — installation and stack overview (note: the README still references the older `/modules` taxonomy in places; update it if you touch it).
- `CONTRIBUTING.md` — full authoring guide with frontmatter examples per category and copy-pasteable component usage.
