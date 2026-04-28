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

`next-mdx-remote/rsc` compiles MDX server-side. Plugins are configured in `lib/mdx.ts` (`remarkGfm`, `remarkMath`, `rehypeKatex`, `rehypeSlug`).

Custom components are injected via `components/mdx/index.tsx`'s `mdxComponents` map, passed to `MDXRemote`'s `components` prop. Authors use them in MDX without imports:

`<Callout>` (4 types), `<SelfCheck>`, `<DeepDive>`, `<KeyTerm>` (looks up the glossary at render time), `<FormulaBlock>` (KaTeX), `<PitchSlide>` (annotated hotspots — pitches only), `<MetricsTable>`, `<ProsCons>`.

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
