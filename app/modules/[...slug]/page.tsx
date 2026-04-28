import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { Github, ArrowUpRight, Clock, User2, Tag } from "lucide-react";
import { MDXRemote } from "next-mdx-remote/rsc";
import { mdxOptions, extractToc } from "@/lib/mdx";
import { mdxComponents } from "@/components/mdx";
import {
  getAllModules,
  getModule,
  getAdjacentModules,
} from "@/lib/content";
import { CATEGORY_LABELS, MODULE_CATEGORIES } from "@/lib/types";
import { TableOfContents } from "@/components/TableOfContents";
import { ReadingProgress } from "@/components/ReadingProgress";
import { ModuleNav } from "@/components/ModuleNav";
import { DifficultyBadge } from "@/components/DifficultyBadge";
import { formatDate } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";

type Params = { slug: string[] };

export async function generateStaticParams() {
  const modules = await getAllModules();
  return modules.map((m) => ({ slug: [m.category, m.slug] }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const [category, moduleSlug] = slug;
  const mod = await getModule(category, moduleSlug);
  if (!mod) return {};
  return {
    title: mod.frontmatter.title,
    description: mod.frontmatter.summary,
  };
}

export default async function ModulePage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;
  if (slug.length !== 2) notFound();
  const [category, moduleSlug] = slug;
  if (!MODULE_CATEGORIES.includes(category as never)) notFound();

  const mod = await getModule(category, moduleSlug);
  if (!mod) notFound();

  const toc = extractToc(mod.source);
  const { prev, next } = await getAdjacentModules(mod);
  const fm = mod.frontmatter;
  const editPath = `https://github.com/miguel9monteiro/Fragment/edit/main/content/modules/${mod.category}/${mod.slug}.mdx`;

  return (
    <>
      <ReadingProgress />

      {/* Breadcrumb + title */}
      <section className="container pt-10 pb-8">
        <nav className="text-xs text-muted-foreground mb-6 flex items-center gap-1.5">
          <Link href="/modules" className="hover:text-foreground">
            Modules
          </Link>
          <span aria-hidden>/</span>
          <Link
            href={`/modules?category=${mod.category}`}
            className="hover:text-foreground"
          >
            {CATEGORY_LABELS[mod.category]}
          </Link>
        </nav>

        <p className="eyebrow-accent mb-4">{CATEGORY_LABELS[mod.category]}</p>
        <h1 className="font-bold text-4xl sm:text-5xl font-semibold tracking-tight leading-[1.05] max-w-4xl">
          {fm.title}
        </h1>
        <p className="mt-5 text-lg text-muted-foreground leading-relaxed max-w-3xl">
          {fm.summary}
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <User2 className="h-3 w-3" />
            {fm.author}
            {fm.team && (
              <span className="text-muted-foreground/70"> · {fm.team}</span>
            )}
          </span>
          <span className="inline-flex items-center gap-1.5 tnum">
            <Clock className="h-3 w-3" />
            {fm.estimatedReadTime} min read
          </span>
          <DifficultyBadge difficulty={fm.difficulty} />
          <span className="tnum">Updated {formatDate(fm.lastUpdated)}</span>
        </div>
      </section>

      <Separator />

      {/* Two-column layout */}
      <section className="container py-14">
        <div className="grid gap-12 lg:grid-cols-[220px_1fr] xl:grid-cols-[260px_1fr_220px]">
          {/* Left rail (desktop) */}
          <aside className="hidden lg:block sticky top-24 self-start space-y-8">
            <div>
              <p className="eyebrow mb-3">About this module</p>
              <dl className="space-y-3 text-xs">
                <div>
                  <dt className="text-muted-foreground/70">Category</dt>
                  <dd className="text-foreground mt-0.5">
                    {CATEGORY_LABELS[mod.category]}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground/70">Author</dt>
                  <dd className="text-foreground mt-0.5">{fm.author}</dd>
                </div>
                {fm.team && (
                  <div>
                    <dt className="text-muted-foreground/70">Team</dt>
                    <dd className="text-foreground mt-0.5">{fm.team}</dd>
                  </div>
                )}
                <div>
                  <dt className="text-muted-foreground/70">Last updated</dt>
                  <dd className="text-foreground mt-0.5 tnum">
                    {formatDate(fm.lastUpdated)}
                  </dd>
                </div>
              </dl>
            </div>

            {fm.tags.length > 0 && (
              <div>
                <p className="eyebrow mb-3 inline-flex items-center gap-1.5">
                  <Tag className="h-3 w-3" /> Tags
                </p>
                <ul className="flex flex-wrap gap-1.5">
                  {fm.tags.map((t) => (
                    <li
                      key={t}
                      className="text-[11px] text-muted-foreground border border-border rounded-sm px-2 py-0.5"
                    >
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* TOC on smaller desktops */}
            <div className="xl:hidden">
              <TableOfContents items={toc} />
            </div>
          </aside>

          {/* Main content */}
          <article className="prose-pmc max-w-prose">
            <MDXRemote
              source={mod.source}
              components={mdxComponents}
              options={{ mdxOptions, parseFrontmatter: false }}
            />

            <hr />

            {/* Footer meta */}
            <div className="not-prose mt-12 grid gap-6 sm:grid-cols-2">
              {fm.prerequisites.length > 0 && (
                <PrereqList slugs={fm.prerequisites} />
              )}
              <div className="sm:col-span-2 sm:col-start-1">
                <a
                  href={editPath}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Github className="h-3.5 w-3.5" />
                  Found a mistake? Edit this module on GitHub
                  <ArrowUpRight className="h-3 w-3" />
                </a>
              </div>
            </div>

            <div className="not-prose">
              <ModuleNav prev={prev} next={next} />
            </div>
          </article>

          {/* TOC right rail (xl+) */}
          <aside className="hidden xl:block sticky top-24 self-start">
            <TableOfContents items={toc} />
          </aside>
        </div>
      </section>
    </>
  );
}

async function PrereqList({ slugs }: { slugs: string[] }) {
  const all = await getAllModules();
  const prereqs = slugs
    .map((s) => all.find((m) => m.slug === s))
    .filter(
      (m): m is NonNullable<typeof m> => Boolean(m),
    );
  if (prereqs.length === 0) return null;

  return (
    <div>
      <p className="eyebrow mb-3">Prerequisites</p>
      <ul className="space-y-2">
        {prereqs.map((p) => (
          <li key={p.slug}>
            <Link
              href={`/modules/${p.category}/${p.slug}`}
              className="group inline-flex items-center gap-2 text-sm hover:text-steel transition-colors"
            >
              <span className="font-bold font-medium">
                {p.frontmatter.title}
              </span>
              <ArrowUpRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
