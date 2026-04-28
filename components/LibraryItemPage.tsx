import Link from "next/link";
import {
  Github,
  ArrowUpRight,
  Clock,
  User2,
  Tag,
  Calendar,
  Globe,
  FileDown,
} from "lucide-react";
import { MDXRemote } from "next-mdx-remote/rsc";
import { mdxOptions, extractToc } from "@/lib/mdx";
import { mdxComponents } from "@/components/mdx";
import { LIBRARY_META, type LibraryEntry } from "@/lib/types";
import { TableOfContents } from "@/components/TableOfContents";
import { ReadingProgress } from "@/components/ReadingProgress";
import { LibraryItemNav } from "@/components/LibraryItemNav";
import { DifficultyBadge } from "@/components/DifficultyBadge";
import { formatDate } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";

const REPO_EDIT_BASE =
  "https://github.com/miguel9monteiro/Fragment/edit/main/content";

export function LibraryItemPage({
  item,
  prev,
  next,
}: {
  item: LibraryEntry;
  prev: LibraryEntry | null;
  next: LibraryEntry | null;
}) {
  const meta = LIBRARY_META[item.kind];
  const fm = item.frontmatter;
  const toc = extractToc(item.source);
  const editPath = `${REPO_EDIT_BASE}/${meta.dir}/${item.slug}.mdx`;

  return (
    <>
      <ReadingProgress />

      {/* Header */}
      <section className="container pt-10 pb-8">
        <nav className="text-xs text-muted-foreground mb-6 flex items-center gap-1.5">
          <Link href={meta.route} className="hover:text-foreground">
            {meta.label}
          </Link>
        </nav>

        <p className="eyebrow-accent mb-4">{meta.singular}</p>
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight leading-[1.05] max-w-4xl">
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
            <Calendar className="h-3 w-3" />
            {formatDate(fm.date)}
          </span>
          {item.kind !== "macro" ? (
            <>
              <span className="inline-flex items-center gap-1.5 tnum">
                <Clock className="h-3 w-3" />
                {item.frontmatter.estimatedReadTime} min read
              </span>
              <DifficultyBadge difficulty={item.frontmatter.difficulty} />
            </>
          ) : (
            <>
              <span className="inline-flex items-center rounded-sm border border-steel/30 bg-steel/10 text-steel px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider">
                {item.frontmatter.period}
              </span>
              {item.frontmatter.region && (
                <span className="inline-flex items-center gap-1.5">
                  <Globe className="h-3 w-3" />
                  {item.frontmatter.region}
                </span>
              )}
            </>
          )}
          {fm.sourcePdfUrl && (
            <a
              href={fm.sourcePdfUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors group"
            >
              <FileDown className="h-3 w-3" />
              View original PDF
              <ArrowUpRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
            </a>
          )}
        </div>
      </section>

      <Separator />

      {/* Two-column layout */}
      <section className="container py-14">
        <div className="grid gap-12 lg:grid-cols-[220px_1fr] xl:grid-cols-[260px_1fr_220px]">
          {/* Left rail */}
          <aside className="hidden lg:block sticky top-24 self-start space-y-8">
            <div>
              <p className="eyebrow mb-3">About</p>
              <dl className="space-y-3 text-xs">
                <div>
                  <dt className="text-muted-foreground/70">Type</dt>
                  <dd className="text-foreground mt-0.5">{meta.singular}</dd>
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
                  <dt className="text-muted-foreground/70">Date</dt>
                  <dd className="text-foreground mt-0.5 tnum">
                    {formatDate(fm.date)}
                  </dd>
                </div>
                {item.kind === "macro" && (
                  <>
                    <div>
                      <dt className="text-muted-foreground/70">Period</dt>
                      <dd className="text-foreground mt-0.5">
                        {item.frontmatter.period}
                      </dd>
                    </div>
                    {item.frontmatter.region && (
                      <div>
                        <dt className="text-muted-foreground/70">Region</dt>
                        <dd className="text-foreground mt-0.5">
                          {item.frontmatter.region}
                        </dd>
                      </div>
                    )}
                  </>
                )}
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
              source={item.source}
              components={mdxComponents}
              options={{ mdxOptions, parseFrontmatter: false }}
            />

            <hr />

            <div className="not-prose mt-12">
              <a
                href={editPath}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <Github className="h-3.5 w-3.5" />
                Found a mistake? Edit this page on GitHub
                <ArrowUpRight className="h-3 w-3" />
              </a>
            </div>

            <div className="not-prose">
              <LibraryItemNav prev={prev} next={next} />
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
