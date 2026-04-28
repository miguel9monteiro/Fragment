# PMC Knowledge

A learning platform for the **Portfolio Management Club** at **Nova School of
Business & Economics**. Hosts structured modules, an annotated archive of past
investment pitches, and a shared glossary — built so members produce sharper
analysis and defend it confidently in Q&A.

This is a **static site**. No backend, no database, no auth. Content lives as
MDX in `/content` and is published via pull request.

---

## Get running locally — under 5 minutes

You need Node 20+ and pnpm. If you don't have pnpm, enable it with corepack:

```bash
corepack enable pnpm
```

Then:

```bash
pnpm install
pnpm dev
```

Open <http://localhost:3000>.

---

## Scripts

| Command | What it does |
|---|---|
| `pnpm dev` | Start the local dev server with hot reload |
| `pnpm build` | Build the production site (fully static) |
| `pnpm start` | Serve the built output locally |
| `pnpm typecheck` | Run TypeScript without emitting |
| `pnpm lint` | ESLint on the codebase |

---

## How to add content

See [CONTRIBUTING.md](./CONTRIBUTING.md) for the full authoring guide. The
short version:

- **A module** lives at
  `content/modules/<category>/<slug>.mdx`. Pick the category folder, write
  your frontmatter, write your MDX. Custom components like `<Callout>`,
  `<SelfCheck>`, `<FormulaBlock>` are available without imports.
- **A pitch** lives at
  `content/pitches/<semester>/<ticker>/index.mdx`, with slide images in the
  same folder.
- **A glossary term** is a JSON entry in `content/glossary/terms.json`.

Frontmatter is validated at build time with Zod schemas in [`lib/types.ts`](./lib/types.ts).
A malformed frontmatter fails the build — that is intentional.

---

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS + custom design tokens |
| MDX | `next-mdx-remote/rsc` (React Server Components) |
| Math | KaTeX (via `remark-math` + `rehype-katex`) |
| UI primitives | Radix UI, custom-styled |
| Icons | lucide-react |
| Fonts | Inter (body), Source Serif 4 (headings), JetBrains Mono (numbers) |
| Search | In-memory client-side, see `lib/search.ts` |
| Hosting | Vercel |

---

## Repository structure

```
app/                Next.js App Router pages
components/         Shared React components
  ui/               Low-level primitives (Button, Card, etc.)
  mdx/              Components used inside MDX content
content/            All published content
  modules/<category>/<slug>.mdx
  pitches/<semester>/<ticker>/index.mdx
  glossary/terms.json
lib/                Content loading, types, search, utils
public/             Static assets (logos, slide images)
styles/             Global CSS
```

---

## Deploying to Vercel

1. Push the repository to GitHub.
2. Import the repo in Vercel (it will auto-detect Next.js).
3. No environment variables required for v1.
4. Push to `main` to deploy.

The site is fully static. No serverless functions are used at runtime.

---

## License & purpose

Educational use only — not investment advice. Built by and for members of the
Portfolio Management Club at Nova SBE.
